// Envoi du code de connexion par Resend (le même service que les courriels
// du site). Sans RESEND_API_KEY (en local), le code s'affiche dans le
// terminal au lieu d'être envoyé.
import { config } from "./config.js";

export async function sendCodeEmail(email, code) {
  if (!config.resend.apiKey) {
    console.log(`[atelier] (local, pas de RESEND_API_KEY) code pour ${email} : ${code}`);
    return;
  }

  const html = `
<div style="font-family:Georgia,serif; background:#f4f1ea; padding:32px 16px;">
  <div style="max-width:420px; margin:0 auto; background:#fff; border:1px solid #e4dcc8; padding:28px 32px; text-align:center;">
    <p style="margin:0 0 4px; color:#8a7a5c; font-size:12px; letter-spacing:.2em; text-transform:uppercase;">Atelier Panassor</p>
    <p style="margin:0 0 20px; color:#2a1d10; font-size:15px;">Ton code de connexion :</p>
    <p style="margin:0 0 20px; color:#2a1d10; font-size:32px; letter-spacing:.3em; font-family:monospace;">${code}</p>
    <p style="margin:0; color:#8a7a5c; font-size:13px;">Valide 10 minutes. Si tu n'as rien demandé, ignore ce courriel.</p>
  </div>
</div>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.resend.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: config.resend.fromEmail,
      to: [email],
      subject: `Atelier Panassor — code ${code}`,
      html,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend ${response.status} ${await response.text().catch(() => "")}`);
  }
}
