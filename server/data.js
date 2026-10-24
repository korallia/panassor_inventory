// Lecture des vraies données et conversion vers la forme utilisée par l'atelier
// (la même que src/data/sampleData.js, pour que toutes les pages marchent pareil).
import fs from "node:fs";
import pg from "pg";

import { config } from "./config.js";

export const pool = new pg.Pool({ connectionString: config.databaseUrl, ssl: config.databaseSsl, max: 3 });

// Garde-fou : la lecture passe par readOnly (transaction READ ONLY) : même
// par erreur, un INSERT/UPDATE/DELETE y serait refusé par Postgres.
// Les seules écritures de l'atelier : son propre compte (writeAccount) et
// le stock (server/stock.js). L'utilisateur Postgres atelier_app n'a de
// toute façon le droit d'écrire que là (migrations 012 à 014).
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
  const [collectionsRes, productsRes, imagesRes, variantsRes, componentsRes, stockRes] = await Promise.all([
    readOnly(`SELECT id, name_fr, status FROM collections ORDER BY name_fr`),
    readOnly(`
      SELECT id, collection_id, slug_fr, name_fr, name_en, title_fr, title_en,
             description_fr, description_en, long_description_fr, long_description_en,
             price_cents, customizable, is_kit
      FROM products ORDER BY name_fr`),
    readOnly(`
      SELECT pi.product_id, pi.url, pi.alt_fr, pi.alt_en, pi.is_main, pi.sort_order, c.name_fr AS color
      FROM product_images pi LEFT JOIN colors c ON c.id = pi.color_id
      ORDER BY pi.product_id, pi.sort_order`),
    // Variantes de couleur (étuis des kits) et variantes sans couleur, qui servent
    // seulement au stock (aiguilles : Droite, Courbe, Aiguille — migration 015).
    readOnly(`
      SELECT pcv.id, pcv.product_id, pcv.price_delta_cents, pcv.label_fr, c.name_fr AS color, c.hex_code
      FROM product_variants pcv LEFT JOIN colors c ON c.id = pcv.color_id
      ORDER BY pcv.product_id, c.name_fr, pcv.id`),
    readOnly(`SELECT kit_product_id, included_product_id, quantity FROM kit_components ORDER BY kit_product_id, sort_order`),
    // Le stock vit dans la base (migration 014) : une ligne par produit, ou par variante.
    readOnly(`SELECT id, product_id, variant_id, quantity FROM stock`),
  ]);

  const variantsByProduct = {};
  for (const v of variantsRes.rows) (variantsByProduct[v.product_id] ||= []).push(v);
  const colorVariantsOf = (productId) => (variantsByProduct[productId] || []).filter((v) => v.color);
  const sortsOf = (productId) => (variantsByProduct[productId] || []).filter((v) => !v.color && v.label_fr);

  const stockByProduct = {};
  const stockByVariant = {};
  for (const row of stockRes.rows) {
    if (row.variant_id == null) stockByProduct[row.product_id] = row;
    else stockByVariant[row.variant_id] = row;
  }
  // Une ligne de stock vue par l'atelier : son id sert aux boutons « Ajuster ».
  const line = (row) => ({ stockId: row ? String(row.id) : null, stock: row?.quantity ?? 0, min: 0 });

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
    const sorts = sortsOf(p.id);
    if (sorts.length > 1) {
      // Paquet (aiguilles de suture) : chaque sorte (Droite, Courbe) a son stock.
      // Un paquet = 1 de chaque ; le surplus d'une sorte = orphelines.
      return {
        id: id(p.id),
        collectionId: id(p.collection_id),
        name: p.name_fr,
        type: "paquet",
        min: 0,
        inKit: inAKit.has(id(p.id)),
        packTypes: sorts.map((v) => ({ id: id(v.id), name: `${v.label_fr}s`, ...line(stockByVariant[v.id]) })),
      };
    }
    // Une seule sorte (aiguilles de douleur) : se compte comme une pièce, sur sa variante.
    const row = sorts.length === 1 ? stockByVariant[sorts[0].id] : stockByProduct[p.id];
    return {
      id: id(p.id),
      collectionId: id(p.collection_id),
      name: p.name_fr,
      type: p.customizable ? "outil" : "piece",
      ...line(row),
      inKit: inAKit.has(id(p.id)),
    };
  });

  const kits = kitsRows.map((k) => {
    const variants = colorVariantsOf(k.id);
    // Étuis : une ligne par couleur du kit (stock de la variante de couleur).
    const leather = variants.length
      ? variants.map((v) => ({ color: v.color, swatch: v.hex_code || "#2a180c", ...line(stockByVariant[v.id]) }))
      : [{ color: "Étuis", swatch: "#2a180c", ...line(stockByProduct[k.id]) }];
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
    type: p.is_kit ? undefined : ensembles[p.slug_fr] ? "ensemble" : sortsOf(p.id).length > 1 ? "paquet" : p.customizable ? "outil" : "piece",
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
    // Sous-produits : variantes de couleur (table product_variants), avec écart de prix et stock.
    variants: colorVariantsOf(p.id).map((v) => ({
      color: v.color,
      swatch: v.hex_code || "#2a180c",
      priceDelta: Number(v.price_delta_cents || 0) / 100,
      stock: stockByVariant[v.id]?.quantity ?? null,
    })),
  }));

  return {
    source: "live",
    loadedAt: new Date().toISOString(),
    collections,
    products,
    kits,
    catalog,
  };
}
