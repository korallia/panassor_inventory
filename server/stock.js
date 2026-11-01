// Écriture du stock : ajouter ou retirer des pièces depuis l'atelier, avec
// une raison et une note, et lecture de l'historique.
//
// Chaque ajustement se fait dans UNE transaction :
//   1. on change la quantité (la même requête vérifie qu'on ne descend
//      pas sous 0, donc deux personnes en même temps ne s'écrasent pas) ;
//   2. on écrit le mouvement dans l'historique (qui, combien, pourquoi).
// Si une étape échoue, rien n'est gardé : le stock et l'historique restent
// toujours d'accord.
//
// Droits Postgres d'atelier_app (migrations 014 et 017) : changer la
// quantité du stock, AJOUTER des mouvements. Jamais modifier ni effacer
// un mouvement : l'historique ne se réécrit pas.
import { pool, readOnly } from "./data.js";

const ACTIONS = { ajouter: 1, retirer: -1 };
// Raisons permises selon le sens (type stock_reason, migration 017).
// « vente » est réservée aux ventes Square (étape 4).
const REASONS = {
  ajouter: ["fabrication", "correction"],
  retirer: ["perte", "correction"],
};
const MAX = 100000;

/** Corps : { action: "ajouter" | "retirer", amount, reason, note }. */
export async function adjustStock(req, res) {
  const stockId = Number(req.params.id);
  const { action, reason } = req.body || {};
  const sign = ACTIONS[action];
  const amount = Number(req.body?.amount);
  const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 500) : "";

  if (!Number.isInteger(stockId)) return res.status(400).json({ error: "Pièce inconnue." });
  if (!sign) return res.status(400).json({ error: "Action invalide." });
  if (!REASONS[action].includes(reason)) return res.status(400).json({ error: "Raison invalide." });
  if (!Number.isInteger(amount) || amount < 1 || amount > MAX) return res.status(400).json({ error: "Quantité invalide." });

  const change = sign * amount;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query(
      `UPDATE stock SET quantity = quantity + $2, updated_at = now()
       -- Un retrait à la main ne descend jamais sous 0. Un ajout passe toujours,
       -- même si une vente a rendu le stock négatif (migration 018 du site).
       WHERE id = $1 AND ($2 > 0 OR quantity + $2 >= 0)
       RETURNING quantity`,
      [stockId, change]
    );
    if (!updated.rows[0]) {
      await client.query("ROLLBACK");
      // Rien n'a changé : la pièce n'existe pas, ou il n'y en a pas assez.
      const current = await pool.query(`SELECT quantity FROM stock WHERE id = $1`, [stockId]);
      if (!current.rows[0]) return res.status(404).json({ error: "Pièce inconnue." });
      return res.status(400).json({ error: `Il n'y en a que ${current.rows[0].quantity} en stock.` });
    }
    const after = updated.rows[0].quantity;
    await client.query(
      `INSERT INTO stock_movements (stock_id, change, quantity_after, reason, atelier_user_id, note)
       VALUES ($1, $2, $3, $4, (SELECT id FROM atelier_users WHERE email = $5), NULLIF($6, ''))`,
      [stockId, change, after, reason, req.atelierUser, note]
    );
    await client.query("COMMIT");
    res.json({ ok: true, after });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Historique. Filtres (tous facultatifs) : stock (une pièce), raison,
 * personne (courriel, ou « square » pour les ventes), du / au (AAAA-MM-JJ),
 * limite (100 par défaut, 500 au plus).
 */
export async function listMovements(req, res) {
  const q = req.query || {};
  const where = [];
  const params = [];
  const add = (sql, value) => {
    params.push(value);
    where.push(sql.replace("?", `$${params.length}`));
  };

  if (q.stock && Number.isInteger(Number(q.stock))) add("m.stock_id = ?", Number(q.stock));
  // Une vente précise (lien « pièces manquantes » d'une fiche) : son id Square.
  if (/^[A-Za-z0-9_-]{4,80}$/.test(q.vente || "")) add("m.note LIKE ?", `%(Square ${q.vente})%`);
  if (["fabrication", "perte", "correction", "vente"].includes(q.raison)) add("m.reason = ?::stock_reason", q.raison);
  if (q.personne === "square") where.push("m.atelier_user_id IS NULL");
  else if (q.personne) add("u.email = ?", String(q.personne).toLowerCase());
  if (/^\d{4}-\d{2}-\d{2}$/.test(q.du || "")) add("m.created_at >= ?::date", q.du);
  if (/^\d{4}-\d{2}-\d{2}$/.test(q.au || "")) add("m.created_at < ?::date + 1", q.au);
  const limit = Math.min(Math.max(Number(q.limite) || 100, 1), 500);

  const result = await readOnly(
    `SELECT m.id, m.stock_id, m.change, m.quantity_after, m.reason, m.note, m.created_at,
            u.email AS person, s.product_id, p.name_fr AS product, c2.name_fr AS collection,
            coalesce(v.label_fr, c.name_fr) AS variant
     FROM stock_movements m
     JOIN stock s ON s.id = m.stock_id
     JOIN products p ON p.id = s.product_id
     LEFT JOIN collections c2 ON c2.id = p.collection_id
     LEFT JOIN product_variants v ON v.id = s.variant_id
     LEFT JOIN colors c ON c.id = v.color_id
     LEFT JOIN atelier_users u ON u.id = m.atelier_user_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT ${limit}`,
    params
  );
  // Les personnes qui ont déjà ajusté, pour le filtre « personne ».
  const people = await readOnly(
    `SELECT DISTINCT u.email FROM stock_movements m JOIN atelier_users u ON u.id = m.atelier_user_id ORDER BY u.email`
  );

  res.json({
    people: people.rows.map((row) => row.email),
    movements: result.rows.map((m) => ({
      id: String(m.id),
      stockId: String(m.stock_id),
      productId: String(m.product_id),
      product: m.product,
      collection: m.collection,
      variant: m.variant,
      change: m.change,
      after: m.quantity_after,
      reason: m.reason,
      person: m.person,
      note: m.note,
      at: m.created_at,
    })),
  });
}

/**
 * Ajouter des kits complets d'un coup (fabrication) : l'étui de la couleur
 * choisie + chaque pièce de la composition du kit (kit_components), comme une
 * vente à l'envers. Les aiguilles suivent la recette de leur option par défaut.
 * Corps : { kitId, variantId (couleur de l'étui), count, note }.
 */
export async function addKits(req, res) {
  const kitId = Number(req.body?.kitId);
  const variantId = req.body?.variantId == null ? null : Number(req.body.variantId);
  const count = Number(req.body?.count);
  const extra = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 300) : "";
  if (!Number.isInteger(kitId)) return res.status(400).json({ error: "Kit inconnu." });
  if (!Number.isInteger(count) || count < 1 || count > 200) return res.status(400).json({ error: "Nombre de kits invalide." });

  const kit = (await pool.query(`SELECT id, name_fr FROM products WHERE id = $1 AND is_kit`, [kitId])).rows[0];
  if (!kit) return res.status(404).json({ error: "Kit inconnu." });
  const color = variantId
    ? (await pool.query(
        `SELECT c.name_fr FROM product_variants v JOIN colors c ON c.id = v.color_id WHERE v.id = $1 AND v.product_id = $2`,
        [variantId, kitId]
      )).rows[0]?.name_fr
    : null;
  if (variantId && !color) return res.status(400).json({ error: "Couleur d'étui inconnue pour ce kit." });

  // Ce que le kit ajoute : { stockId: quantité }.
  const adds = new Map();
  const add = (stockId, n) => adds.set(stockId, (adds.get(stockId) || 0) + n);
  const stockOf = async (productId, variant = null) =>
    (await pool.query(
      variant == null
        ? `SELECT id FROM stock WHERE product_id = $1 AND variant_id IS NULL`
        : `SELECT id FROM stock WHERE product_id = $1 AND variant_id = $2`,
      variant == null ? [productId] : [productId, variant]
    )).rows[0]?.id;

  const leather = await stockOf(kitId, variantId);
  if (!leather) return res.status(400).json({ error: "Pas de ligne de stock pour cet étui." });
  add(leather, count);

  const components = (await pool.query(
    `SELECT included_product_id AS product_id, quantity FROM kit_components WHERE kit_product_id = $1`,
    [kitId]
  )).rows;
  for (const component of components) {
    const n = (component.quantity || 1) * count;
    const option = (await pool.query(
      `SELECT quantity, variant_ids FROM product_options WHERE product_id = $1 ORDER BY sort_order, id LIMIT 1`,
      [component.product_id]
    )).rows[0];
    if (option?.variant_ids?.length) {
      for (const sort of option.variant_ids) {
        const row = await stockOf(component.product_id, sort);
        if (row) add(row, n);
      }
      continue;
    }
    const own = await stockOf(component.product_id);
    if (own) {
      add(own, option ? (option.quantity || 1) * n : n);
      continue;
    }
    // Pièce comptée par sortes sans option : un paquet = 1 de chaque sorte.
    const sorts = (await pool.query(
      `SELECT s.id FROM stock s JOIN product_variants v ON v.id = s.variant_id
       WHERE s.product_id = $1 AND v.color_id IS NULL`,
      [component.product_id]
    )).rows;
    for (const sort of sorts) add(sort.id, option ? (option.quantity || 1) * n : n);
  }

  const label = `Kit complet ×${count} · ${kit.name_fr}${color ? ` (${color})` : ""}${extra ? ` · ${extra}` : ""}`;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const [stockId, n] of adds) {
      const after = (await client.query(
        `UPDATE stock SET quantity = quantity + $2, updated_at = now() WHERE id = $1 RETURNING quantity`,
        [stockId, n]
      )).rows[0].quantity;
      await client.query(
        `INSERT INTO stock_movements (stock_id, change, quantity_after, reason, atelier_user_id, note)
         VALUES ($1, $2, $3, 'fabrication', (SELECT id FROM atelier_users WHERE email = $4), $5)`,
        [stockId, n, after, req.atelierUser, label]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
  res.json({ ok: true, lines: adds.size });
}
