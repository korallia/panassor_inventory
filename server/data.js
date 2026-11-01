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
  const [collectionsRes, productsRes, imagesRes, variantsRes, componentsRes, stockRes, minimumsRes, owedRes, optionsRes] = await Promise.all([
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
    // Minimums (migration 017) : par produit, ou par variante (étui d'une couleur).
    readOnly(`SELECT product_id, variant_id, minimum FROM minimums`),
    // Ventes non comblées : ventes qui ont rendu une ligne de stock négative
    // (migration 018 du site). Les plus récentes d'abord.
    readOnly(`
      SELECT m.stock_id, m.note
      FROM stock_movements m JOIN stock s ON s.id = m.stock_id
      WHERE s.quantity < 0 AND m.reason = 'vente' AND m.note LIKE '%manquait%'
      ORDER BY m.created_at DESC, m.id DESC`),
    // Option par défaut de chaque produit (la première, migration 007) : elle dit
    // ce qu'est un paquet (suture : 1 droite + 1 courbe ; douleur : 2 aiguilles).
    readOnly(`
      SELECT DISTINCT ON (product_id) product_id, quantity, variant_ids
      FROM product_options ORDER BY product_id, sort_order, id`),
  ]);

  const variantsByProduct = {};
  for (const v of variantsRes.rows) (variantsByProduct[v.product_id] ||= []).push(v);
  const colorVariantsOf = (productId) => (variantsByProduct[productId] || []).filter((v) => v.color);
  const sortsOf = (productId) => (variantsByProduct[productId] || []).filter((v) => !v.color && v.label_fr);
  const defaultOption = Object.fromEntries(optionsRes.rows.map((o) => [o.product_id, o]));
  // Un paquet, d'après l'option par défaut : [{ id, name, perPack, row }] par sorte.
  //   suture  : 1 droite + 1 courbe (variant_ids)
  //   douleur : 2 aiguilles (quantity), sur sa sorte unique ou sur le produit lui-même
  // Sans option : 1 de chaque sorte s'il y en a plusieurs. Sinon, pas un paquet.
  const packOf = (productId) => {
    const sorts = sortsOf(productId);
    const option = defaultOption[productId];
    const fromSort = (v, perPack) => ({ id: id(v.id), name: `${v.label_fr}s`, perPack, row: stockByVariant[v.id] });
    if (option?.variant_ids?.length && sorts.length) {
      return sorts.map((v) => fromSort(v, option.variant_ids.filter((x) => x === v.id).length));
    }
    if (option && (option.quantity || 1) > 1 && sorts.length <= 1) {
      if (sorts.length === 1) return [fromSort(sorts[0], option.quantity)];
      return [{ id: `p${productId}`, name: "Aiguilles", perPack: option.quantity, row: stockByProduct[productId] }];
    }
    if (sorts.length > 1) return sorts.map((v) => fromSort(v, 1));
    return null;
  };


  const stockByProduct = {};
  const stockByVariant = {};
  for (const row of stockRes.rows) {
    if (row.variant_id == null) stockByProduct[row.product_id] = row;
    else stockByVariant[row.variant_id] = row;
  }
  const minByProduct = {};
  const minByVariant = {};
  for (const row of minimumsRes.rows) {
    if (row.variant_id == null) minByProduct[row.product_id] = row.minimum;
    else minByVariant[row.variant_id] = row.minimum;
  }

  // Pièces manquantes par ligne de stock : un stock à −3 = 3 pièces dues. On les
  // attribue aux ventes « manquait N », des plus récentes aux plus anciennes
  // (une fabrication comble d'abord les plus anciennes).
  const quantityByStock = Object.fromEntries(stockRes.rows.map((row) => [row.id, row.quantity]));
  const owedByStock = {};
  for (const m of owedRes.rows) {
    const left = -(quantityByStock[m.stock_id] ?? 0) - (owedByStock[m.stock_id] || []).reduce((n, o) => n + o.qty, 0);
    const missing = Number(m.note.match(/manquait (\d+)/)?.[1] || 0);
    const ref = m.note.match(/\(Square ([^)]+)\)/)?.[1];
    if (left <= 0 || !missing || !ref) continue;
    (owedByStock[m.stock_id] ||= []).push({
      ref,
      orderNumber: m.note.match(/Commande #(\d+)/)?.[1] || null,
      qty: Math.min(missing, left),
      // Ce qui a été vendu (« Kit du chirurgien (Noir) ») ; vide si la pièce a été vendue seule.
      source: (m.note.split(" · ")[1] || "").split(", ").filter((x) => x && x !== "vendu seul").join(", "),
    });
  }

  // Une ligne de stock vue par l'atelier : son id sert aux boutons « Ajuster ».
  // stock peut être négatif (ventes non comblées) ; owed = les commandes à combler.
  const line = (row) => ({
    stockId: row ? String(row.id) : null,
    stock: row?.quantity ?? 0,
    owed: row ? owedByStock[row.id] || [] : [],
  });

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
        objective: minByProduct[p.id] ?? ensemble.objective ?? 0,
        components: ensemble.components
          .filter((c) => bySlug[c.slug])
          .map((c) => ({ productId: id(bySlug[c.slug].id), qty: c.qty || 1 })),
      };
    }
    const sorts = sortsOf(p.id);
    const pack = packOf(p.id);
    if (pack) {
      // Paquet (aiguilles) : chaque sorte a son stock ; un paquet = l'option par
      // défaut (suture : 1 droite + 1 courbe ; douleur : 2 aiguilles). Le surplus = orphelines.
      return {
        id: id(p.id),
        collectionId: id(p.collection_id),
        name: p.name_fr,
        type: "paquet",
        min: minByProduct[p.id] ?? 0,
        inKit: inAKit.has(id(p.id)),
        packTypes: pack.map(({ id: typeId, name, perPack, row }) => ({ id: typeId, name, perPack, ...line(row) })),
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
      min: minByProduct[p.id] ?? 0,
      inKit: inAKit.has(id(p.id)),
    };
  });

  // Étuis : minimum enregistré par couleur (réglable à la main ; changer le
  // minimum de kits le répartit automatiquement, voir la page Minimums).
  const kits = kitsRows.map((k) => buildKit(k));
  function buildKit(k) {
    const variants = colorVariantsOf(k.id);
    // Étuis : une ligne par couleur du kit (stock de la variante de couleur).
    const leather = variants.length
      ? variants.map((v) => ({
          variantId: id(v.id),
          color: v.color,
          swatch: v.hex_code || "#2a180c",
          ...line(stockByVariant[v.id]),
          min: minByVariant[v.id] ?? 0,
        }))
      : [{ color: "Étuis", swatch: "#2a180c", ...line(stockByProduct[k.id]), min: 0 }];
    return {
      id: id(k.id),
      collectionId: id(k.collection_id),
      name: k.name_fr,
      min: minByProduct[k.id] ?? 0,
      leather,
      components: kitComponentRows
        .filter((c) => c.kit_product_id === k.id)
        .map((c) => {
          const product = pieceRows.find((p) => p.id === c.included_product_id);
          return { productId: id(c.included_product_id), qty: c.quantity || 1, choice: Boolean(product?.customizable) };
        })
        .filter((c) => pieceRows.some((p) => id(p.id) === c.productId)),
    };
  }

  const imagesByProduct = {};
  for (const img of imagesRes.rows) (imagesByProduct[img.product_id] ||= []).push(img);

  const catalog = productsRes.rows.map((p) => ({
    id: id(p.id),
    collectionId: id(p.collection_id),
    isKit: p.is_kit,
    type: p.is_kit ? undefined : ensembles[p.slug_fr] ? "ensemble" : packOf(p.id) ? "paquet" : p.customizable ? "outil" : "piece",
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

  // Commandes à combler : chaque commande qui doit encore des pièces, avec TOUT
  // ce qu'elle a fait sortir (pour un kit : chaque pièce, comblée ou non).
  const owedFor = (stockId, ref) => (owedByStock[stockId] || []).find((o) => o.ref === ref)?.qty || 0;
  const pendingRefs = [...new Set(Object.values(owedByStock).flat().map((o) => o.ref))];
  const pendingOrders = [];
  if (pendingRefs.length) {
    const salesRes = await readOnly(
      `SELECT m.stock_id, m.change, m.note, m.created_at, p.id AS product_id, p.name_fr, p.is_kit,
              c.name_fr AS collection, coalesce(v.label_fr, col.name_fr) AS variant
       FROM stock_movements m
       JOIN stock s ON s.id = m.stock_id
       JOIN products p ON p.id = s.product_id
       LEFT JOIN collections c ON c.id = p.collection_id
       LEFT JOIN product_variants v ON v.id = s.variant_id
       LEFT JOIN colors col ON col.id = v.color_id
       WHERE m.reason = 'vente' AND m.note LIKE ANY($1)
       ORDER BY m.id`,
      [pendingRefs.map((ref) => `%(Square ${ref})%`)]
    );
    const byRef = new Map();
    for (const m of salesRes.rows) {
      const ref = m.note.match(/\(Square ([^)]+)\)/)?.[1];
      if (!ref) continue;
      let order = byRef.get(ref);
      if (!order) {
        order = { ref, orderNumber: m.note.match(/Commande #(\d+)/)?.[1] || null, at: m.created_at, collections: [], items: [] };
        byRef.set(ref, order);
      }
      if (m.collection && !order.collections.includes(m.collection)) order.collections.push(m.collection);
      const name = m.is_kit && m.variant
        ? `Étui ${m.variant.toLowerCase()}`
        : m.variant
          ? `${m.name_fr} (${m.variant.toLowerCase()})`
          : m.name_fr;
      const sources = (m.note.split(" · ")[1] || "").split(", ").filter((x) => x && x !== "vendu seul");
      const qty = -m.change;
      const missing = Math.min(qty, owedFor(m.stock_id, ref));
      // Ce qui a été vendu (kit, ensemble, option d'aiguilles) sert de titre au groupe ;
      // une pièce vendue seule (« vendu seul ») n'a pas de titre.
      const source = sources[0] || "";
      order.items.push({ name, productId: id(m.product_id), qty, missing, source });
    }
    for (const order of byRef.values()) {
      order.qty = order.items.reduce((n, item) => n + item.qty, 0);
      order.missing = order.items.reduce((n, item) => n + item.missing, 0);
      if (order.missing > 0) pendingOrders.push(order);
    }
    pendingOrders.sort((a, b) => Number(a.orderNumber || 0) - Number(b.orderNumber || 0));
  }

  return {
    source: "live",
    loadedAt: new Date().toISOString(),
    pendingOrders,
    collections,
    products,
    kits,
    catalog,
  };
}
