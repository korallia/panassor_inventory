// Connexion en deux étapes :
//   1. courriel + mot de passe d'un utilisateur actif de la table atelier_users
//   2. code à 6 chiffres envoyé à ce courriel (valide 10 minutes)
// Le bon code ouvre une session de 12 h, au nom de cette personne.
//
// Rien n'est gardé en mémoire entre deux requêtes (Vercel peut répondre
// avec un serveur différent à chaque fois) : le code attendu voyage dans
// un cookie signé, sous forme d'empreinte (HMAC), jamais en clair.
import crypto from "node:crypto";

import { config } from "./config.js";
import { sendCodeEmail } from "./email.js";
import { readOnly } from "./data.js";
import { verifyPassword, DUMMY_HASH } from "./passwords.js";

const SESSION_COOKIE = "atelier_session";
const CODE_COOKIE = "atelier_code";
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const CODE_MAX_AGE_MS = 10 * 60 * 1000;
const CODE_MAX_TRIES = 5;
// En ligne (https), les cookies ne voyagent que chiffrés.
const SECURE = process.env.VERCEL ? "; Secure" : "";

const hmac = (value) => crypto.createHmac("sha256", config.sessionSecret).update(value).digest("hex");
const b64 = (value) => Buffer.from(value).toString("base64url");
const unb64 = (value) => Buffer.from(String(value), "base64url").toString();

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function setCookie(res, name, value, maxAgeMs) {
  res.append("Set-Cookie", `${name}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(maxAgeMs / 1000)}${SECURE}`);
}

function readCookie(req, name) {
  const header = req.headers.cookie || "";
  const match = header.split(/;\s*/).find((part) => part.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

// Utilisateurs actifs, relus au plus toutes les 60 secondes : désactiver
// quelqu'un dans la table coupe aussi sa session en moins d'une minute.
const USERS_CACHE_MS = 60 * 1000;
let usersCache = { at: 0, byEmail: new Map() };

async function loadUsers() {
  if (Date.now() - usersCache.at < USERS_CACHE_MS) return usersCache.byEmail;
  const result = await readOnly(`SELECT email, password_hash FROM atelier_users WHERE active = true`);
  usersCache = {
    at: Date.now(),
    byEmail: new Map(result.rows.map((row) => [normalizeEmail(row.email), row.password_hash])),
  };
  return usersCache.byEmail;
}

export async function isAllowedEmail(email) {
  return (await loadUsers()).has(normalizeEmail(email));
}

async function checkCredentials(email, password) {
  const hash = (await loadUsers()).get(normalizeEmail(email));
  const ok = verifyPassword(password, hash || DUMMY_HASH);
  return Boolean(hash) && ok;
}

// --- Étape 1 : envoyer un code -------------------------------------------

// Pas plus de 5 codes par courriel en 15 minutes (par serveur).
const CODE_WINDOW_MS = 15 * 60 * 1000;
const CODE_MAX_SENDS = 5;
const codeSends = new Map();

// Pas plus de 5 mauvais courriel/mot de passe par adresse IP en 15 minutes.
const LOGIN_MAX_FAILURES = 5;
const loginFailures = new Map();

function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "?").split(",")[0].trim();
}

export async function requestCode(req, res) {
  const email = normalizeEmail(req.body?.email);
  const ip = clientIp(req);
  const now = Date.now();

  const failures = loginFailures.get(ip);
  const recentFailures = failures && now - failures.first < CODE_WINDOW_MS ? failures : null;
  if (recentFailures && recentFailures.count >= LOGIN_MAX_FAILURES) {
    return res.status(429).json({ error: "Trop d'essais. Réessaie dans 15 minutes." });
  }

  // Même message que le courriel ou le mot de passe soit faux : on ne
  // révèle pas qui est sur la liste.
  if (!(await checkCredentials(email, req.body?.password))) {
    loginFailures.set(ip, { first: recentFailures?.first ?? now, count: (recentFailures?.count ?? 0) + 1 });
    await new Promise((resolve) => setTimeout(resolve, 500));
    return res.status(401).json({ error: "Courriel ou mot de passe invalide." });
  }
  loginFailures.delete(ip);

  const entry = codeSends.get(email);
  const recent = entry && now - entry.first < CODE_WINDOW_MS ? entry : null;
  if (recent && recent.count >= CODE_MAX_SENDS) {
    return res.status(429).json({ error: "Trop de codes demandés. Réessaie dans 15 minutes." });
  }
  codeSends.set(email, { first: recent?.first ?? now, count: (recent?.count ?? 0) + 1 });

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const expires = now + CODE_MAX_AGE_MS;
  writeChallenge(res, { email, expires, tries: 0, codeMac: hmac(`${email}|${expires}|${code}`) });

  try {
    await sendCodeEmail(email, code);
  } catch (error) {
    console.error("[atelier] envoi du code impossible :", error.message);
    return res.status(502).json({ error: "Le courriel n'a pas pu partir. Réessaie." });
  }

  res.json({ ok: true });
}

function writeChallenge(res, challenge) {
  const payload = b64(JSON.stringify(challenge));
  setCookie(res, CODE_COOKIE, `${payload}.${hmac(payload)}`, CODE_MAX_AGE_MS);
}

function readChallenge(req) {
  const value = readCookie(req, CODE_COOKIE);
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature || !safeEqual(signature, hmac(payload))) return null;
  try {
    return JSON.parse(unb64(payload));
  } catch {
    return null;
  }
}

// --- Étape 2 : vérifier le code ------------------------------------------

export async function verifyCode(req, res) {
  const challenge = readChallenge(req);
  const code = String(req.body?.code || "").replace(/\s+/g, "");

  if (!challenge || Date.now() > challenge.expires) {
    return res.status(401).json({ error: "Code expiré. Demande un nouveau code." });
  }
  if (challenge.tries >= CODE_MAX_TRIES || !(await isAllowedEmail(challenge.email))) {
    return res.status(401).json({ error: "Trop d'essais. Demande un nouveau code." });
  }

  const expected = hmac(`${challenge.email}|${challenge.expires}|${code}`);
  if (!safeEqual(expected, challenge.codeMac)) {
    writeChallenge(res, { ...challenge, tries: challenge.tries + 1 });
    return res.status(401).json({ error: "Code invalide." });
  }

  setCookie(res, CODE_COOKIE, "", 0);
  setSession(res, challenge.email);
  res.json({ ok: true, email: challenge.email });
}

// --- Session --------------------------------------------------------------

function setSession(res, email) {
  const value = `${Date.now()}.${b64(email)}`;
  setCookie(res, SESSION_COOKIE, `${value}.${hmac(value)}`, SESSION_MAX_AGE_MS);
}

export function clearSessionCookie(res) {
  setCookie(res, SESSION_COOKIE, "", 0);
}

export async function requireAuth(req, res, next) {
  const value = readCookie(req, SESSION_COOKIE);
  if (value) {
    const [issued, email64, signature] = value.split(".");
    const email = email64 ? unb64(email64) : "";
    if (
      issued &&
      signature &&
      safeEqual(signature, hmac(`${issued}.${email64}`)) &&
      Date.now() - Number(issued) < SESSION_MAX_AGE_MS &&
      // Désactiver quelqu'un coupe aussi sa session en cours.
      (await isAllowedEmail(email).catch(() => false))
    ) {
      req.atelierUser = email;
      return next();
    }
  }
  res.status(401).json({ error: "Connexion requise" });
}
