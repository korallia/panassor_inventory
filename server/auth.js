// Mot de passe simple + cookie de session signé (HMAC). Valide 12 h.
import crypto from "node:crypto";

import { config } from "./config.js";

const COOKIE = "atelier_session";
const MAX_AGE_MS = 12 * 60 * 60 * 1000;
// En ligne (https), le cookie ne voyage que chiffré.
const SECURE = process.env.VERCEL ? "; Secure" : "";

const sign = (value) => crypto.createHmac("sha256", config.sessionSecret).update(value).digest("hex");

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function checkPassword(password) {
  return typeof password === "string" && safeEqual(password, config.password);
}

export function setSessionCookie(res) {
  const issued = String(Date.now());
  res.setHeader("Set-Cookie", `${COOKIE}=${issued}.${sign(issued)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${MAX_AGE_MS / 1000}${SECURE}`);
}

export function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${SECURE}`);
}

function readCookie(req) {
  const header = req.headers.cookie || "";
  const match = header.split(/;\s*/).find((part) => part.startsWith(`${COOKIE}=`));
  return match ? match.slice(COOKIE.length + 1) : null;
}

export function requireAuth(req, res, next) {
  const value = readCookie(req);
  if (value) {
    const [issued, signature] = value.split(".");
    if (issued && signature && safeEqual(signature, sign(issued)) && Date.now() - Number(issued) < MAX_AGE_MS) return next();
  }
  res.status(401).json({ error: "Connexion requise" });
}
