// Application de l'atelier (routes /api) — LECTURE SEULE.
//   - lit la base Postgres du site (produits, images, kits, couleurs)
//   - lit le stock dans Square (inventaire)
//   - n'écrit NULLE PART : chaque requête Postgres est en lecture seule
//     et on n'appelle que des routes Square de lecture.
// Utilisée en local par server/index.js et en ligne par api/index.js (Vercel).
import express from "express";

import { requireAuth, requestCode, verifyCode, clearSessionCookie } from "./auth.js";
import { loadAtelierData } from "./data.js";
import { imageRoute } from "./images.js";

const app = express();
app.use(express.json());

// Connexion par courriel + code (voir auth.js).
app.post("/api/login/code", requestCode);
app.post("/api/login/verify", verifyCode);

app.post("/api/logout", (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get("/api/data", requireAuth, async (req, res) => {
  try {
    res.json({ ...(await loadAtelierData()), user: req.atelierUser });
  } catch (error) {
    console.error("[atelier] lecture impossible :", error.message);
    res.status(502).json({ error: "Lecture impossible", detail: error.message });
  }
});

app.get("/api/img", requireAuth, imageRoute);

export default app;
