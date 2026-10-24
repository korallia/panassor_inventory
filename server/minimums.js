// Minimums (table minimums, migration 017) : un seuil par produit, ou par
// variante (étui d'une couleur). Pas de ligne = minimum 0.
// Un minimum n'est pas un mouvement de stock : pas d'historique.
import { pool } from "./data.js";

/** Corps : { productId, variantId (facultatif), minimum }. */
export async function setMinimum(req, res) {
  const productId = Number(req.body?.productId);
  const variantId = req.body?.variantId == null ? null : Number(req.body.variantId);
  const minimum = Number(req.body?.minimum);

  if (!Number.isInteger(productId)) return res.status(400).json({ error: "Produit inconnu." });
  if (variantId !== null && !Number.isInteger(variantId)) return res.status(400).json({ error: "Variante inconnue." });
  if (!Number.isInteger(minimum) || minimum < 0 || minimum > 100000) return res.status(400).json({ error: "Minimum invalide." });

  // Une ligne par produit (sans variante) ou par variante : on crée ou on met à jour.
  const result =
    variantId === null
      ? await pool.query(
          `INSERT INTO minimums (product_id, minimum) VALUES ($1, $2)
           ON CONFLICT (product_id) WHERE variant_id IS NULL
           DO UPDATE SET minimum = EXCLUDED.minimum, updated_at = now()
           RETURNING minimum`,
          [productId, minimum]
        )
      : await pool.query(
          `INSERT INTO minimums (product_id, variant_id, minimum)
           SELECT product_id, id, $3 FROM product_variants WHERE id = $2 AND product_id = $1
           ON CONFLICT (variant_id) WHERE variant_id IS NOT NULL
           DO UPDATE SET minimum = EXCLUDED.minimum, updated_at = now()
           RETURNING minimum`,
          [productId, variantId, minimum]
        );
  if (!result.rows[0]) return res.status(404).json({ error: "Variante inconnue." });
  res.json({ ok: true, minimum: result.rows[0].minimum });
}
