// Application de l'atelier (routes /api) — LECTURE SEULE.
//   - lit la base Postgres du site (produits, images, kits, couleurs)
//   - lit le stock dans Square (inventaire)
//   - n'écrit NULLE PART : chaque requête Postgres est en lecture seule
//     et on n'appelle que des routes Square de lecture.
// Utilisée en local par server/index.js et en ligne par api/index.js (Vercel).
import express from "express";

import { checkPassword, requireAuth, setSessionCookie, clearSessionCookie } from "./auth.js";
import { loadAtelierData } from "./data.js";
import { imageRoute } from "./images.js";
import { diagRoute } from "./diag.js";

const app = express();
app.use(express.json());

app.post("/api/login", (req, res) => {
  if (!checkPassword(req.body?.password)) return res.status(401).json({ error: "Mot de passe invalide" });
  setSessionCookie(res);
  res.json({ ok: true });
});

app.post("/api/logout", (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get("/api/data", requireAuth, async (req, res) => {
  try {
    res.json(await loadAtelierData());
  } catch (error) {
    console.error("[atelier] lecture impossible :", error.message);
    res.status(502).json({ error: "Lecture impossible", detail: error.message });
  }
});

app.get("/api/img", requireAuth, imageRoute);
app.get("/api/diag", requireAuth, diagRoute);

export default app;
