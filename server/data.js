// Lecture des vraies données et conversion vers la forme utilisée par l'atelier
// (la même que src/data/sampleData.js, pour que toutes les pages marchent pareil).
import fs from "node:fs";
import pg from "pg";

import { config } from "./config.js";

const pool = new pg.Pool({ connectionString: config.databaseUrl, ssl: config.databaseSsl, max: 3 });

// Garde-fou : chaque requête tourne dans une transaction READ ONLY.
// Même par erreur, un INSERT/UPDATE/DELETE serait refusé par Postgres.
// Seule écriture permise à l'atelier pour l'instant : son propre compte
// (courriel, mot de passe). L'utilisateur Postgres atelier_app n'a de toute
// façon le droit de modifier que ces deux colonnes.
export async function writeAccount(sql, params = []) {
  return pool.query(sql, params);
}

export async function readOnly(sql, params = []) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const result = await client.query(sql, params);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

const SQUARE_BASE = process.env.SQUARE_BASE_URL_OVERRIDE || (config.square.environment === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com");

/** Stock Square (IN_STOCK) pour une liste de variations. Route de lecture seulement. */
async function fetchSquareCounts(variationIds) {
  const counts = {};
  const ids = [...new Set(variationIds.filter(Boolean))];
  for (let i = 0; i < ids.length; i += 500) {
    let cursor;
    do {
      const response = await fetch(`${SQUARE_BASE}/v2/inventory/counts/batch-retrieve`, {
        method: "POST",
        headers: {
          "Square-Version": "2026-06-18",
          Authorization: `Bearer ${config.square.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          catalog_object_ids: ids.slice(i, i + 500),
          location_ids: [config.square.locationId],
          states: ["IN_STOCK"],
          cursor,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(`Square ${response.status} : ${body?.errors?.[0]?.detail || "erreur"}`);
      for (const count of body.counts || []) {
        counts[count.catalog_object_id] = (counts[count.catalog_object_id] || 0) + Number(count.quantity || 0);
      }
      cursor = body.cursor;
    } while (cursor);
  }
  return counts;
}

// Ce que la base ne décrit pas encore (composition des ensembles…) : server/atelier.config.json
function readAtelierConfig() {
  try {
    return JSON.parse(fs.readFileSync(new URL("./atelier.config.json", import.meta.url), "utf8"));
  } catch {
    return { ensembles: {} };
  }
}

export async function loadAtelierData() {
  const atelierConfig = readAtelierConfig();
  const [collectionsRes, productsRes, imagesRes, variantsRes, componentsRes] = await Promise.all([
    readOnly(`SELECT id, name_fr, status FROM collections ORDER BY name_fr`),
    readOnly(`
      SELECT id, collection_id, slug_fr, name_fr, name_en, title_fr, title_en,
             description_fr, description_en, long_description_fr, long_description_en,
             price_cents, customizable, is_kit, square_default_variation_id
      FROM products ORDER BY name_fr`),
    readOnly(`
      SELECT pi.product_id, pi.url, pi.alt_fr, pi.alt_en, pi.is_main, pi.sort_order, c.name_fr AS color
      FROM product_images pi LEFT JOIN colors c ON c.id = pi.color_id
      ORDER BY pi.product_id, pi.sort_order`),
    readOnly(`
      SELECT pcv.product_id, pcv.square_variation_id, pcv.price_delta_cents, c.name_fr AS color, c.hex_code
      FROM product_color_variants pcv JOIN colors c ON c.id = pcv.color_id
      ORDER BY pcv.product_id, c.name_fr`),
    readOnly(`SELECT kit_product_id, included_product_id, quantity FROM kit_components ORDER BY kit_product_id, sort_order`),
  ]);

  const variantsByProduct = {};
  for (const v of variantsRes.rows) (variantsByProduct[v.product_id] ||= []).push(v);

  const variationIds = [
    ...productsRes.rows.map((p) => p.square_default_variation_id),
    ...variantsRes.rows.map((v) => v.square_variation_id),
  ];
  const counts = await fetchSquareCounts(variationIds);

  // Stock d'un produit : ses variations de couleur, sinon sa variation par défaut.
  const stockOf = (product) => {
    const variants = (variantsByProduct[product.id] || []).filter((v) => v.square_variation_id);
    if (variants.length) return variants.reduce((sum, v) => sum + (counts[v.square_variation_id] || 0), 0);
    return counts[product.square_default_variation_id] || 0;
  };

  const id = (value) => String(value);
  const kitsRows = productsRes.rows.filter((p) => p.is_kit);
  const pieceRows = productsRes.rows.filter((p) => !p.is_kit);
  // kit_components sert aux kits (is_kit) ET aux ensembles : une ligne dont le « kit »
  // n'est pas un kit complet décrit un ensemble (solution base de données).
  const kitIds = new Set(kitsRows.map((k) => k.id));
  const kitComponentRows = componentsRes.rows.filter((c) => kitIds.has(c.kit_product_id));
  const inAKit = new Set(kitComponentRows.map((c) => id(c.included_product_id)));
  const ensembleRowsByProduct = {};
  for (const c of componentsRes.rows) if (!kitIds.has(c.kit_product_id)) (ensembleRowsByProduct[c.kit_product_id] ||= []).push(c);

  const collections = collectionsRes.rows
    .filter((c) => productsRes.rows.some((p) => p.collection_id === c.id))
    .map((c) => ({ id: id(c.id), name: c.name_fr, status: c.status }));

  const bySlug = Object.fromEntries(pieceRows.map((p) => [p.slug_fr, p]));
  // En attendant la base : compositions écrites à la main dans atelier.config.json.
  // Dès qu'un ensemble a ses lignes dans kit_components, la base a priorité.
  const ensembles = { ...(atelierConfig.ensembles || {}) };
  for (const p of pieceRows) {
    const rows = ensembleRowsByProduct[p.id];
    if (rows?.length) {
      ensembles[p.slug_fr] = {
        objective: ensembles[p.slug_fr]?.objective ?? 0,
        components: rows.map((c) => ({ slug: pieceRows.find((x) => x.id === c.included_product_id)?.slug_fr, qty: c.quantity || 1 })),
      };
    }
  }
  const paquets = atelierConfig.paquets || {};

  const products = pieceRows.map((p) => {
    const ensemble = ensembles[p.slug_fr];
    if (ensemble) {
      // Ensemble : calculé à partir du stock libre de ses pièces (pas de stock propre).
      return {
        id: id(p.id),
        collectionId: id(p.collection_id),
        name: p.name_fr,
        type: "ensemble",
        objective: ensemble.objective ?? 0,
        components: ensemble.components
          .filter((c) => bySlug[c.slug])
          .map((c) => ({ productId: id(bySlug[c.slug].id), qty: c.qty || 1 })),
      };
    }
    const paquet = paquets[p.slug_fr];
    if (paquet) {
      // Paquet (aiguilles de suture) : Square compte les paquets complets ;
      // les aiguilles seules (orphelines) sont notées dans la config.
      const complete = stockOf(p);
      return {
        id: id(p.id),
        collectionId: id(p.collection_id),
        name: p.name_fr,
        type: "paquet",
        min: 0,
        inKit: inAKit.has(id(p.id)),
        packTypes: paquet.types.map((t) => ({ id: t.id, name: t.name, stock: complete + (t.orphelines || 0) })),
      };
    }
    return {
      id: id(p.id),
      collectionId: id(p.collection_id),
      name: p.name_fr,
      type: p.customizable ? "outil" : "piece",
      stock: stockOf(p),
      min: 0,
      inKit: inAKit.has(id(p.id)),
    };
  });

  const kits = kitsRows.map((k) => {
    const variants = variantsByProduct[k.id] || [];
    // Étuis : une ligne par couleur du kit (stock Square de la variation de couleur).
    const leather = variants.length
      ? variants.map((v) => ({ color: v.color, swatch: v.hex_code || "#2a180c", stock: counts[v.square_variation_id] || 0, min: 0 }))
      : [{ color: "Étuis", swatch: "#2a180c", stock: counts[k.square_default_variation_id] || 0, min: 0 }];
    return {
      id: id(k.id),
      collectionId: id(k.collection_id),
      name: k.name_fr,
      min: 0,
      leather,
      components: kitComponentRows
        .filter((c) => c.kit_product_id === k.id)
        .map((c) => {
          const product = pieceRows.find((p) => p.id === c.included_product_id);
          return { productId: id(c.included_product_id), qty: c.quantity || 1, choice: Boolean(product?.customizable) };
        })
        .filter((c) => pieceRows.some((p) => id(p.id) === c.productId)),
    };
  });

  const imagesByProduct = {};
  for (const img of imagesRes.rows) (imagesByProduct[img.product_id] ||= []).push(img);

  const catalog = productsRes.rows.map((p) => ({
    id: id(p.id),
    collectionId: id(p.collection_id),
    isKit: p.is_kit,
    type: p.is_kit ? undefined : ensembles[p.slug_fr] ? "ensemble" : paquets[p.slug_fr] ? "paquet" : p.customizable ? "outil" : "piece",
    nameFr: p.name_fr || "",
    nameEn: p.name_en || "",
    titleFr: p.title_fr || "",
    titleEn: p.title_en || "",
    descriptionFr: p.description_fr || "",
    descriptionEn: p.description_en || "",
    longDescriptionFr: p.long_description_fr || "",
    longDescriptionEn: p.long_description_en || "",
    price: p.price_cents != null ? (p.price_cents / 100).toFixed(2).replace(".", ",") : "",
    images: (imagesByProduct[p.id] || []).map((img) => ({
      url: img.url,
      altFr: img.alt_fr || "",
      altEn: img.alt_en || "",
      main: img.is_main,
      color: img.color || null, // photo propre à une variante de couleur (product_images.color_id)
    })),
    // Sous-produits : variantes de couleur (table product_color_variants), avec écart de prix et stock Square.
    variants: (variantsByProduct[p.id] || []).map((v) => ({
      color: v.color,
      swatch: v.hex_code || "#2a180c",
      priceDelta: Number(v.price_delta_cents || 0) / 100,
      stock: v.square_variation_id ? counts[v.square_variation_id] || 0 : null,
    })),
  }));

  return {
    source: "live",
    environment: config.square.environment,
    loadedAt: new Date().toISOString(),
    collections,
    products,
    kits,
    catalog,
  };
}
