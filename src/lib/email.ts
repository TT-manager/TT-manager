import "server-only";

/**
 * Invio di email del sito con Brevo (email transazionali). La chiave è nelle impostazioni di Vercel
 * (BREVO_API_KEY) e non va mai scritta nel codice. Il mittente è sul dominio del sito, verificato in Brevo
 * (firma DKIM e DMARC): un indirizzo di un servizio di posta pubblico come mittente finisce nello spam
 * o viene scartato. Le risposte vanno all'indirizzo di assistenza.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pongfu.club";

export const hasEmail = () => Boolean(process.env.BREVO_API_KEY);

export async function sendEmail(msg: { to: { email: string; name?: string }[]; subject: string; html: string; text: string }):
  Promise<{ ok: true } | { ok: false; error: string }> {
  const key = process.env.BREVO_API_KEY;
  const from = process.env.EMAIL_FROM || "noreply@pongfu.club";
  const replyTo = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  if (!key) return { ok: false, error: "BREVO_API_KEY mancante" };
  if (!from) return { ok: false, error: "mittente mancante" };
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: from, name: "PongFu" }, ...(replyTo ? { replyTo: { email: replyTo } } : {}), to: msg.to, subject: msg.subject, htmlContent: msg.html, textContent: msg.text,
    }),
  });
  if (res.ok) return { ok: true };
  // Il messaggio di Brevo non contiene dati segreti: serve a capire cosa non va (mittente, chiave, permessi).
  return { ok: false, error: `Brevo ${res.status}: ${(await res.text()).slice(0, 300)}` };
}

/** Testo sicuro dentro l'HTML. */
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
