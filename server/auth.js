// Connexion en deux étapes :
//   1. courriel + mot de passe d'un utilisateur actif de la table atelier_users
//   2. code à 6 chiffres envoyé à ce courriel (valide 10 minutes)
// Le bon code ouvre une session de 7 jours, au nom de cette personne.
// « Se souvenir de cet appareil » : pendant 90 jours, cet appareil n'a plus
// besoin du code (le mot de passe reste demandé). Un nouvel appareil passe
// toujours par les deux étapes.
//
// Rien n'est gardé en mémoire entre deux requêtes (Vercel peut répondre
// avec un serveur différent à chaque fois) : le code attendu voyage dans
// un cookie signé, sous forme d'empreinte (HMAC), jamais en clair.
import crypto from "node:crypto";

import { config } from "./config.js";
import { sendCodeEmail } from "./email.js";
import { readOnly, writeAccount } from "./data.js";
import { verifyPassword, hashPassword, DUMMY_HASH } from "./passwords.js";

const SESSION_COOKIE = "atelier_session";
const CODE_COOKIE = "atelier_code";
const EMAIL_CODE_COOKIE = "atelier_code_courriel";
const DEVICE_COOKIE = "atelier_appareil";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const DEVICE_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
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

  // Appareil déjà reconnu pour ce courriel : pas besoin du code.
  if (isTrustedDevice(req, email)) {
    setSession(res, email);
    return res.json({ ok: true, trusted: true });
  }

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

function writeChallenge(res, challenge, cookieName = CODE_COOKIE) {
  const payload = b64(JSON.stringify(challenge));
  setCookie(res, cookieName, `${payload}.${hmac(payload)}`, CODE_MAX_AGE_MS);
}

function readChallenge(req, cookieName = CODE_COOKIE) {
  const value = readCookie(req, cookieName);
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
  if (req.body?.remember) rememberDevice(res, challenge.email);
  res.json({ ok: true, email: challenge.email });
}

// --- Appareil reconnu -----------------------------------------------------

function rememberDevice(res, email) {
  const value = `${Date.now() + DEVICE_MAX_AGE_MS}.${b64(email)}`;
  setCookie(res, DEVICE_COOKIE, `${value}.${hmac(`appareil.${value}`)}`, DEVICE_MAX_AGE_MS);
}

function isTrustedDevice(req, email) {
  const value = readCookie(req, DEVICE_COOKIE);
  if (!value) return false;
  const [expires, email64, signature] = value.split(".");
  return Boolean(
    expires &&
      email64 &&
      signature &&
      safeEqual(signature, hmac(`appareil.${expires}.${email64}`)) &&
      Date.now() < Number(expires) &&
      unb64(email64) === email
  );
}

// --- Session --------------------------------------------------------------

function setSession(res, email) {
  const value = `${Date.now()}.${b64(email)}`;
  setCookie(res, SESSION_COOKIE, `${value}.${hmac(value)}`, SESSION_MAX_AGE_MS);
}

export function clearSessionCookie(res) {
  setCookie(res, SESSION_COOKIE, "", 0);
}

// --- Paramètres du compte --------------------------------------------------
// Toutes ces routes passent par requireAuth : req.atelierUser = le courriel.

function forgetUsersCache() {
  usersCache = { at: 0, byEmail: new Map() };
}

export function accountInfo(req, res) {
  res.json({ email: req.atelierUser });
}

export async function changePassword(req, res) {
  const { current, next } = req.body || {};

  if (!(await checkCredentials(req.atelierUser, current))) {
    return res.status(401).json({ error: "Mot de passe actuel invalide." });
  }
  if (typeof next !== "string" || next.length < 12) {
    return res.status(400).json({ error: "Le nouveau mot de passe doit faire 12 caractères minimum." });
  }

  await writeAccount(`UPDATE atelier_users SET password_hash = $1 WHERE email = $2`, [
    hashPassword(next),
    req.atelierUser,
  ]);
  forgetUsersCache();
  res.json({ ok: true });
}

// Changer de courriel : mot de passe actuel, puis un code envoyé à la
// NOUVELLE adresse (on vérifie qu'elle existe et qu'elle t'appartient).
export async function requestEmailChange(req, res) {
  const newEmail = normalizeEmail(req.body?.newEmail);

  if (!(await checkCredentials(req.atelierUser, req.body?.password))) {
    return res.status(401).json({ error: "Mot de passe invalide." });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail)) {
    return res.status(400).json({ error: "Courriel invalide." });
  }
  if (newEmail === req.atelierUser) {
    return res.status(400).json({ error: "C'est déjà ton courriel." });
  }
  if (await isAllowedEmail(newEmail)) {
    return res.status(409).json({ error: "Ce courriel est déjà utilisé." });
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const expires = Date.now() + CODE_MAX_AGE_MS;
  writeChallenge(
    res,
    { email: newEmail, oldEmail: req.atelierUser, expires, tries: 0, codeMac: hmac(`${newEmail}|${expires}|${code}`) },
    EMAIL_CODE_COOKIE
  );
  await sendCodeEmail(newEmail, code);
  res.json({ ok: true });
}

export async function confirmEmailChange(req, res) {
  const challenge = readChallenge(req, EMAIL_CODE_COOKIE);
  const code = String(req.body?.code || "").replace(/\s+/g, "");

  if (!challenge || challenge.oldEmail !== req.atelierUser || Date.now() > challenge.expires) {
    return res.status(401).json({ error: "Code expiré. Recommence." });
  }
  if (challenge.tries >= CODE_MAX_TRIES) {
    return res.status(401).json({ error: "Trop d'essais. Recommence." });
  }
  if (!safeEqual(hmac(`${challenge.email}|${challenge.expires}|${code}`), challenge.codeMac)) {
    writeChallenge(res, { ...challenge, tries: challenge.tries + 1 }, EMAIL_CODE_COOKIE);
    return res.status(401).json({ error: "Code invalide." });
  }

  await writeAccount(`UPDATE atelier_users SET email = $1 WHERE email = $2`, [challenge.email, req.atelierUser]);
  forgetUsersCache();

  setCookie(res, EMAIL_CODE_COOKIE, "", 0);
  // La session (et l'appareil reconnu) suivent la nouvelle adresse.
  setSession(res, challenge.email);
  if (isTrustedDevice(req, req.atelierUser)) rememberDevice(res, challenge.email);
  res.json({ ok: true, email: challenge.email });
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
