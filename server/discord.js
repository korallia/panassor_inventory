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

export async function sendReportToDiscord(req, res) {
  const url = process.env.ATELIER_DISCORD_WEBHOOK_URL;
  if (!url) return res.status(500).json({ error: "Webhook Discord manquant (ATELIER_DISCORD_WEBHOOK_URL)." });
  const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
  if (!content) return res.status(400).json({ error: "Rapport vide." });
  if (content.length > 20000) return res.status(400).json({ error: "Rapport trop long." });

  for (const part of chunks(content)) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Pas de mentions (@everyone…) déclenchées par le texte du rapport.
      body: JSON.stringify({ content: part, allowed_mentions: { parse: [] } }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return res.status(502).json({ error: `Discord a refusé le message (${response.status}). ${detail.slice(0, 200)}` });
    }
  }
  res.json({ ok: true });
}
