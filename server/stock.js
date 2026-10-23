// Écriture du stock : ajouter ou retirer des pièces depuis l'atelier.
//
// Une seule requête fait le calcul ET la vérification : deux personnes en
// même temps ne peuvent pas s'écraser, et le stock ne descend jamais sous 0.
// Droits Postgres d'atelier_app (migration 014) : changer la quantité du
// stock, rien d'autre.
import { pool } from "./data.js";

const ACTIONS = { ajouter: 1, retirer: -1 };
const MAX = 100000;

/** Corps : { action: "ajouter" | "retirer", amount }. */
export async function adjustStock(req, res) {
  const stockId = Number(req.params.id);
  const sign = ACTIONS[req.body?.action];
  const amount = Number(req.body?.amount);

  if (!Number.isInteger(stockId)) return res.status(400).json({ error: "Pièce inconnue." });
  if (!sign) return res.status(400).json({ error: "Action invalide." });
  if (!Number.isInteger(amount) || amount < 1 || amount > MAX) return res.status(400).json({ error: "Quantité invalide." });

  const change = sign * amount;
  const result = await pool.query(
    `UPDATE stock SET quantity = quantity + $2, updated_at = now()
     WHERE id = $1 AND quantity + $2 >= 0
     RETURNING quantity`,
    [stockId, change]
  );
  if (result.rows[0]) return res.json({ ok: true, after: result.rows[0].quantity });

  // Rien n'a changé : la pièce n'existe pas, ou il n'y en a pas assez.
  const current = await pool.query(`SELECT quantity FROM stock WHERE id = $1`, [stockId]);
  if (!current.rows[0]) return res.status(404).json({ error: "Pièce inconnue." });
  res.status(400).json({ error: `Il n'y en a que ${current.rows[0].quantity} en stock.` });
}
