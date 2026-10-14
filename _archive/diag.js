// Diagnostic (lecture seule) : pourquoi le stock Square revient à 0 ?
// Compare les variations enregistrées dans la base avec celles qui existent dans Square.
import pg from "pg";
import { config } from "./config.js";

const pool = new pg.Pool({ connectionString: config.databaseUrl, ssl: config.databaseSsl, max: 1 });
const BASE = config.square.environment === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com";
const headers = { "Square-Version": "2026-06-18", Authorization: `Bearer ${config.square.accessToken}`, "Content-Type": "application/json" };
const post = (path, body) => fetch(BASE + path, { method: "POST", headers, body: JSON.stringify(body) }).then((r) => r.json());

export async function diagRoute(req, res) {
  const out = { square: config.square.environment, base: config.databaseHost };
  try {
    const client = await pool.connect();
    let ids;
    try {
      await client.query("BEGIN READ ONLY");
      const { rows } = await client.query(`
        SELECT square_default_variation_id AS id FROM products WHERE square_default_variation_id IS NOT NULL
        UNION SELECT square_variation_id FROM product_color_variants WHERE square_variation_id IS NOT NULL`);
      await client.query("COMMIT");
      ids = rows.map((r) => r.id);
    } finally {
      client.release();
    }
    out.variationsDansLaBase = ids.length;

    const locations = await fetch(BASE + "/v2/locations", { headers }).then((r) => r.json());
    out.locations = locations.errors ? `erreur ${locations.errors[0].code}` : locations.locations.map((l) => ({ nom: l.name, celleDuEnv: l.id === config.square.locationId }));

    const found = [];
    for (let i = 0; i < ids.length; i += 1000) {
      const r = await post("/v2/catalog/batch-retrieve", { object_ids: ids.slice(i, i + 1000) });
      if (r.errors) out.catalogueErreur = r.errors[0].code;
      found.push(...(r.objects || []).map((o) => o.id));
    }
    out.variationsTrouveesDansSquare = found.length;

    const all = await post("/v2/inventory/counts/batch-retrieve", { states: ["IN_STOCK"] });
    const counts = all.counts || [];
    out.stockSquare = {
      lignes: counts.length,
      nonNulles: counts.filter((c) => Number(c.quantity) !== 0).length,
      dansLaLocationDuEnv: counts.filter((c) => c.location_id === config.square.locationId && Number(c.quantity) !== 0).length,
      surDesVariationsDeLaBase: counts.filter((c) => ids.includes(c.catalog_object_id) && Number(c.quantity) !== 0).length,
      pagesEnPlus: Boolean(all.cursor),
    };
    res.json(out);
  } catch (error) {
    res.status(502).json({ ...out, erreur: error.message });
  }
}
