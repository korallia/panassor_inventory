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

/** Poste un texte dans le salon (coupé en morceaux si besoin). Lance une erreur si Discord refuse. */
export async function postToDiscord(content) {
  const url = process.env.ATELIER_DISCORD_WEBHOOK_URL;
  if (!url) throw Object.assign(new Error("Webhook Discord manquant (ATELIER_DISCORD_WEBHOOK_URL)."), { status: 500 });
  for (const part of chunks(content)) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Pas de mentions (@everyone…) déclenchées par le texte du rapport.
      body: JSON.stringify({ content: part, allowed_mentions: { parse: [] } }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw Object.assign(new Error(`Discord a refusé le message (${response.status}). ${detail.slice(0, 200)}`), { status: 502 });
    }
  }
}

/** Bouton « Envoyer sur Discord » : le texte vient de la page Alertes. */
export async function sendReportToDiscord(req, res) {
  const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
  if (!content) return res.status(400).json({ error: "Rapport vide." });
  if (content.length > 20000) return res.status(400).json({ error: "Rapport trop long." });
  try {
    await postToDiscord(content);
  } catch (error) {
    return res.status(error.status || 502).json({ error: error.message });
  }
  res.json({ ok: true });
}
