// Miniatures des photos du site. Les originaux font ~3000 px (plusieurs Mo) :
// les afficher en 50 px forçait le navigateur à tout télécharger et décoder,
// d'où la lenteur. Ici on les réduit une fois (sharp) et on les garde en cache
// dans .cache/img. Lecture seule : on ne fait que lire assets.panassor.ca.
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ASSETS = process.env.ASSETS_BASE_OVERRIDE || "https://assets.panassor.ca";
// En ligne (Vercel), seul le dossier temporaire est modifiable.
const CACHE_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), "atelier-img")
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".cache", "img");
const WIDTHS = [160, 1000];
const pending = new Map();

let sharpModule;
async function loadSharp() {
  if (sharpModule === undefined) {
    sharpModule = await import("sharp").then((m) => m.default).catch(() => null);
    if (!sharpModule) console.warn("[atelier] sharp absent : photos servies en taille originale (lancer npm install).");
  }
  return sharpModule;
}

async function makeThumb(src, width, file) {
  const response = await fetch(ASSETS + src);
  if (!response.ok) throw Object.assign(new Error("introuvable"), { status: response.status });
  const input = Buffer.from(await response.arrayBuffer());
  const sharp = await loadSharp();
  const output = await sharp(input).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
  await fs.mkdir(CACHE_DIR, { recursive: true }).then(() => fs.writeFile(file, output)).catch(() => {});
  return output;
}

export async function imageRoute(req, res) {
  const src = String(req.query.src || "");
  const asked = Number(req.query.w) || 160;
  const width = WIDTHS.find((w) => w >= asked) ?? WIDTHS.at(-1);
  // Seulement des chemins du site (pas un proxy ouvert).
  if (!src.startsWith("/") || src.includes("..") || src.startsWith("//")) return res.status(400).end();
  if (!(await loadSharp())) return res.redirect(ASSETS + src);

  const key = crypto.createHash("sha1").update(`${src}|${width}`).digest("hex");
  const file = path.join(CACHE_DIR, `${key}.webp`);
  try {
    let body = await fs.readFile(file).catch(() => null);
    if (!body) {
      if (!pending.has(key)) pending.set(key, makeThumb(src, width, file).finally(() => pending.delete(key)));
      body = await pending.get(key);
    }
    res.set({ "Content-Type": "image/webp", "Cache-Control": "private, max-age=604800" }).send(body);
  } catch (error) {
    res.status(error.status === 404 ? 404 : 502).end();
  }
}
