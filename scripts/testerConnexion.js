// Teste un lien de base de données AVANT de le mettre dans .env.atelier ou Vercel.
// Usage (dans le dossier de l'atelier) :
//   node scripts/testerConnexion.js "postgresql://atelier_app:MDP@ADRESSE:5432/BASE"
// Affiche l'hôte, l'utilisateur, et ce que l'atelier peut lire. N'écrit rien.
import pg from "pg";

const link = process.argv[2];
if (!link) {
  console.error('Donne le lien entre guillemets : node scripts/testerConnexion.js "postgresql://..."');
  process.exit(1);
}

let url;
try {
  url = new URL(link);
} catch {
  console.error("Lien mal formé. Si le mot de passe contient @ : / # ? %, il faut les encoder (ou en choisir un sans).");
  process.exit(1);
}
console.log(`Hôte : ${url.hostname}  |  utilisateur : ${url.username}  |  base : ${url.pathname.slice(1)}`);

const client = new pg.Client({ connectionString: link, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
try {
  await client.connect();
  const who = await client.query("SELECT current_user, current_database()");
  console.log("Connexion OK :", who.rows[0]);
  for (const table of ["products", "stock", "stock_movements", "minimums", "atelier_users"]) {
    try {
      const r = await client.query(`SELECT count(*)::int AS n FROM ${table}`);
      console.log(`  ${table.padEnd(16)} ${r.rows[0].n} ligne(s)`);
    } catch (error) {
      console.log(`  ${table.padEnd(16)} ERREUR : ${error.message}`);
    }
  }
  try {
    await client.query("SELECT 1 FROM orders LIMIT 1");
    console.log("  orders           ATTENTION : lisible. Ce lien n'est pas celui de atelier_app.");
  } catch {
    console.log("  orders           bloqué (normal pour atelier_app)");
  }
} catch (error) {
  console.error("Connexion impossible :", error.message);
  if (/timeout|ETIMEDOUT|ECONNREFUSED/i.test(error.message)) {
    console.error("→ La base ne répond pas d'ici : elle n'est pas accessible publiquement, ou son groupe de sécurité bloque ton adresse.");
  } else if (/password authentication failed/i.test(error.message)) {
    console.error("→ Mauvais mot de passe (ou ALTER ROLE pas encore fait / pas commité).");
  } else if (/does not exist/i.test(error.message)) {
    console.error("→ Le nom de la base (après le dernier /) est faux.");
  }
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
