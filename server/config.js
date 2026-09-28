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
      return new URL(databaseUrl).hostname.split(".").slice(-3).join(".");
    } catch {
      return "?";
    }
  })(),
  databaseSsl: process.env.DB_DISABLE_SSL === "true" ? false : { rejectUnauthorized: false },
  square: {
    accessToken: required("SQUARE_ACCESS_TOKEN"),
    locationId: required("SQUARE_LOCATION_ID"),
    environment: process.env.SQUARE_ENVIRONMENT === "production" ? "production" : "sandbox",
  },
  password: required("ATELIER_PASSWORD"),
  sessionSecret: process.env.ATELIER_SESSION_SECRET || required("ATELIER_PASSWORD"),
};
