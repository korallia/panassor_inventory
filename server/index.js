// Serveur local de l'atelier — LECTURE SEULE.
//   - lit la base Postgres du site (produits, images, kits, couleurs)
//   - lit le stock dans Square (inventaire)
//   - n'écrit NULLE PART : la session Postgres est forcée en lecture seule
//     et on n'appelle que des routes Square de lecture.
// Écoute seulement sur 127.0.0.1 (ton ordi). Les clés restent dans .env.atelier.
import express from "express";

import { config } from "./config.js";
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

app.listen(config.port, "127.0.0.1", () => {
  console.log(`[atelier] serveur lecture seule sur http://127.0.0.1:${config.port}`);
  console.log(`[atelier] Square : ${config.square.environment} · base : ${config.databaseHost}`);
});
