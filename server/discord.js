// Rapport → Discord. L'atelier écrit le message (page Alertes, aperçu du
// rapport) ; ici on le poste dans le salon par son webhook
// (ATELIER_DISCORD_WEBHOOK_URL dans Vercel / .env.atelier).
// Discord refuse les messages de plus de 2000 caractères : on coupe par lignes.
const LIMIT = 1900;

function chunks(text) {
  const parts = [];
  let current = "";
  for (const line of text.split("\n")) {
    if (current && (current + "\n" + line).length > LIMIT) {
      parts.push(current);
      current = line;
    } else {
      current = current ? `${current}\n${line}` : line;
    }
  }
  if (current) parts.push(current);
  return parts;
}

/**
 * Poste un texte dans le salon (coupé en morceaux si besoin), avec un fichier
 * joint au dernier morceau (file = { name, content }). Lance une erreur si Discord refuse.
 */
export async function postToDiscord(content, file = null) {
  const url = process.env.ATELIER_DISCORD_WEBHOOK_URL;
  if (!url) throw Object.assign(new Error("Webhook Discord manquant (ATELIER_DISCORD_WEBHOOK_URL)."), { status: 500 });
  const parts = chunks(content);
  for (const [index, part] of parts.entries()) {
    // Pas de mentions (@everyone…) déclenchées par le texte du rapport.
    const payload = { content: part, allowed_mentions: { parse: [] } };
    const withFile = file && index === parts.length - 1;
    let options;
    if (withFile) {
      const form = new FormData();
      form.append("payload_json", JSON.stringify(payload));
      form.append("files[0]", new Blob([file.content], { type: "text/csv;charset=utf-8" }), file.name);
      options = { method: "POST", body: form };
    } else {
      options = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) };
    }
    const response = await fetch(url, options);
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw Object.assign(new Error(`Discord a refusé le message (${response.status}). ${detail.slice(0, 200)}`), { status: 502 });
    }
  }
}

/** Bouton « Envoyer sur Discord » : le texte et le tableau (CSV) viennent de la page Alertes. */
export async function sendReportToDiscord(req, res) {
  const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
  if (!content) return res.status(400).json({ error: "Rapport vide." });
  if (content.length > 20000) return res.status(400).json({ error: "Rapport trop long." });
  const csv = typeof req.body?.csv === "string" ? req.body.csv : "";
  const filename = /^rapport-stock-\d{4}-\d{2}-\d{2}\.csv$/.test(req.body?.filename || "") ? req.body.filename : "rapport-stock.csv";
  if (csv.length > 500000) return res.status(400).json({ error: "Tableau trop long." });
  try {
    await postToDiscord(content, csv ? { name: filename, content: csv } : null);
  } catch (error) {
    return res.status(error.status || 502).json({ error: error.message });
  }
  res.json({ ok: true });
}
