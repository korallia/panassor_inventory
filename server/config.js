// Configuration lue depuis .env.atelier (à la racine du projet atelier).
// Ce fichier contient des secrets : il est dans .gitignore et ne quitte pas ton ordi.
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.atelier"), quiet: true });

function required(name) {
  const value = process.env[name];
  if (!value) {
    const message = `[atelier] Variable manquante : ${name} (.env.atelier en local, variables d'environnement sur Vercel)`;
    if (process.env.VERCEL) throw new Error(message);
    console.error(message);
    process.exit(1);
  }
  return value;
}

const databaseUrl = required("DATABASE_URL");

export const config = {
  port: Number(process.env.ATELIER_API_PORT || 5181),
  databaseUrl,
  databaseHost: (() => {
    try {
      // Hôte complet + utilisateur (jamais le mot de passe) : on voit tout de suite quelle base est utilisée.
      const url = new URL(databaseUrl);
      return `${url.hostname} (${url.username})`;
    } catch {
      return "?";
    }
  })(),
  databaseSsl: process.env.DB_DISABLE_SSL === "true" ? false : { rejectUnauthorized: false },
  // En ligne, un vrai secret est obligatoire ; en local, une valeur par défaut suffit.
  sessionSecret: process.env.VERCEL
    ? required("ATELIER_SESSION_SECRET")
    : process.env.ATELIER_SESSION_SECRET || "atelier-local",
  resend: {
    // En ligne, obligatoire : sans lui, personne ne recevrait de code.
    apiKey: process.env.VERCEL ? required("RESEND_API_KEY") : process.env.RESEND_API_KEY || "",
    fromEmail: process.env.RESEND_FROM_EMAIL || "Panassor <support@panassor.ca>",
  },
};
