// Rapport hebdomadaire automatique : tous les lundis à 19 h (heure de Montréal),
// Vercel appelle /api/cron/rapport (vercel.json → crons). Le texte est le même
// que le bouton « Envoyer sur Discord » de la page Alertes (src/lib/rapport.js).
//
// Vercel compte en UTC et Montréal change d'heure : deux déclenchements le
// lundi soir (23 h et minuit UTC) ; on n'envoie que celui qui tombe à 19 h ici.
import { loadAtelierData } from "./data.js";
import { postToDiscord } from "./discord.js";
import { computeInventory } from "../src/lib/inventory.js";
import { buildReportText, buildStockCsv, reportDate } from "../src/lib/rapport.js";

function montrealNow(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", weekday: "short", hour: "2-digit", hour12: false })
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  );
  return { weekday: parts.weekday, hour: Number(parts.hour) % 24 };
}

export async function weeklyReport(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Non autorisé." });
  }
  const now = montrealNow();
  // ?forcer=1 : pour tester l'appel à la main (toujours avec le secret).
  if (req.query?.forcer !== "1" && !(now.weekday === "Mon" && now.hour === 19)) {
    return res.json({ ok: true, envoye: false, raison: `Pas l'heure (${now.weekday} ${now.hour} h à Montréal).` });
  }
  const data = await loadAtelierData();
  const all = { ...data, ...computeInventory(data) };
  const text = buildReportText(all, { title: "Rapport hebdomadaire" });
  await postToDiscord(text, { name: `rapport-stock-${reportDate()}.csv`, content: buildStockCsv(all) });
  res.json({ ok: true, envoye: true });
}
