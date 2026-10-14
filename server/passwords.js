// Mots de passe des utilisateurs de l'atelier : jamais gardés en clair.
// On garde une empreinte scrypt (fonction lente exprès, avec un sel au
// hasard par mot de passe) : « scrypt$<sel>$<empreinte> ».
import crypto from "node:crypto";

const KEY_LENGTH = 64;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, KEY_LENGTH).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  const [scheme, salt, hash] = String(stored || "").split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = crypto.scryptSync(String(password), salt, KEY_LENGTH);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

// Pour un courriel inconnu, on fait quand même le calcul (même durée) :
// le temps de réponse ne révèle pas qui a un compte.
export const DUMMY_HASH = hashPassword(crypto.randomBytes(16).toString("hex"));
