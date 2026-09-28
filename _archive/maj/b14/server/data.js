// Lecture des vraies données et conversion vers la forme utilisée par l'atelier
// (la même que src/data/sampleData.js, pour que toutes les pages marchent pareil).
import pg from "pg";

import { config } from "./config.js";

const pool = new pg.Pool({ connectionString: config.databaseUrl, ssl: config.databaseSsl, max: 3 });

// Garde-fou : chaque requête tourne dans une transaction READ ONLY.
// Même par erreur, un INSERT/UPDATE/DELETE serait refusé par Postgres.
async function readOnly(sql) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const result = await client.query(sql);
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

export async function loadAtelierData() {
  const [collectionsRes, productsRes, imagesRes, variantsRes, componentsRes] = await Promise.all([
    readOnly(`SELECT id, name_fr, status FROM collections ORDER BY name_fr`),
    readOnly(`
      SELECT id, collection_id, name_fr, name_en, title_fr, title_en,
             description_fr, description_en, long_description_fr, long_description_en,
             price_cents, customizable, is_kit, square_default_variation_id
      FROM products ORDER BY name_fr`),
    readOnly(`SELECT product_id, url, alt_fr, alt_en, is_main, sort_order FROM product_images ORDER BY product_id, sort_order`),
    readOnly(`
      SELECT pcv.product_id, pcv.square_variation_id, c.name_fr AS color, c.hex_code
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
  const inAKit = new Set(componentsRes.rows.map((c) => id(c.included_product_id)));

  const collections = collectionsRes.rows
    .filter((c) => productsRes.rows.some((p) => p.collection_id === c.id))
    .map((c) => ({ id: id(c.id), name: c.name_fr, status: c.status }));

  const products = pieceRows.map((p) => ({
    id: id(p.id),
    collectionId: id(p.collection_id),
    name: p.name_fr,
    type: p.customizable ? "outil" : "piece",
    stock: stockOf(p),
    min: 0,
    inKit: inAKit.has(id(p.id)),
  }));

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
      components: componentsRes.rows
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
    type: p.is_kit ? undefined : p.customizable ? "outil" : "piece",
    nameFr: p.name_fr || "",
    nameEn: p.name_en || "",
    titleFr: p.title_fr || "",
    titleEn: p.title_en || "",
    descriptionFr: p.description_fr || "",
    descriptionEn: p.description_en || "",
    longDescriptionFr: p.long_description_fr || "",
    longDescriptionEn: p.long_description_en || "",
    price: p.price_cents != null ? (p.price_cents / 100).toFixed(2).replace(".", ",") : "",
    images: (imagesByProduct[p.id] || []).map((img) => ({ url: img.url, altFr: img.alt_fr || "", altEn: img.alt_en || "", main: img.is_main })),
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
