// Application de l'atelier (routes /api) — LECTURE SEULE.
//   - lit la base Postgres du site (produits, images, kits, couleurs)
//   - lit le stock dans Square (inventaire)
//   - n'écrit NULLE PART : chaque requête Postgres est en lecture seule
//     et on n'appelle que des routes Square de lecture.
// Utilisée en local par server/index.js et en ligne par api/index.js (Vercel).
import express from "express";

import {
  requireAuth,
  requestCode,
  verifyCode,
  clearSessionCookie,
  accountInfo,
  changePassword,
  requestEmailChange,
  confirmEmailChange,
} from "./auth.js";
import { loadAtelierData } from "./data.js";
import { imageRoute } from "./images.js";

const app = express();
app.use(express.json());

// Connexion par courriel + code (voir auth.js). Une panne (base, Resend…)
// est écrite dans les journaux Vercel et renvoie un message clair.
const safe = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    console.error(`[atelier] ${req.path} :`, error.message);
    if (!res.headersSent) res.status(500).json({ error: `Erreur du serveur : ${error.message}` });
  }
};

app.post("/api/login/code", safe(requestCode));
app.post("/api/login/verify", safe(verifyCode));

// Paramètres du compte (connecté seulement).
app.get("/api/compte", requireAuth, accountInfo);
app.post("/api/compte/mot-de-passe", requireAuth, safe(changePassword));
app.post("/api/compte/courriel", requireAuth, safe(requestEmailChange));
app.post("/api/compte/courriel/confirmer", requireAuth, safe(confirmEmailChange));

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
