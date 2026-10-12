// Quote request endpoint for the Cambridge Elevating configurator (Vercel serverless function).
// Receives { contact, configuration, image } from the browser and sends the email through Brevo's
// transactional API. All secrets come from environment variables set in the Vercel project:
//   BREVO_API_KEY      Brevo API v3 key (required)
//   QUOTE_FROM_EMAIL   sender address verified in Brevo (required)
//   QUOTE_TO_EMAIL     recipient(s), comma separated (required)
//   QUOTE_FROM_NAME    optional, default "Cambridge Elevating Configurator"
//   BREVO_LIST_ID      optional, numeric Brevo list id: also add the contact to that list

const MAX_FIELD = 200;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // decoded JPEG; Vercel's request body limit is 4.5 MB
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;
const hits = new Map(); // best-effort per-instance rate limit (resets on cold start)

const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const clean = (value) => String(value ?? "").replace(/[\r\n\t]+/g, " ").replace(/[<>]/g, "").trim().slice(0, MAX_FIELD);

function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 500) for (const [key, times] of hits) if (!times.some((t) => now - t < RATE_WINDOW_MS)) hits.delete(key);
  return list.length > RATE_MAX;
}

function parseRecipients(raw) {
  return String(raw || "")
    .split(",")
    .map((address) => address.trim())
    .filter((address) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(address))
    .map((email) => ({ email }));
}

function buildHtml(contact, configuration, hasImage) {
  const row = (label, value) =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #e6e6e6;color:#666;width:42%">${esc(label)}</td>` +
    `<td style="padding:8px 12px;border-bottom:1px solid #e6e6e6;color:#111;font-weight:600">${esc(value || "-")}</td></tr>`;
  const config = configuration.map((item) => row(item.step, item.value)).join("");
  return `<!doctype html><html><body style="margin:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;background:#fff;border-radius:6px;overflow:hidden">
<tr><td style="background:#111;padding:20px 24px;color:#fff;font-size:18px;letter-spacing:1px">CAMBRIDGE ELEVATING &mdash; New quote request</td></tr>
<tr><td style="padding:24px">
<h2 style="margin:0 0 12px;font-size:16px;color:#a21d21">Contact</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e6e6e6;font-size:14px">
${row("Name", contact.name)}${row("State/Province", contact.state)}${row("Company", contact.company)}${row("Email", contact.email)}${row("Phone", contact.phone)}
</table>
<h2 style="margin:24px 0 12px;font-size:16px;color:#a21d21">Selected configuration</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e6e6e6;font-size:14px">${config}</table>
${hasImage ? '<p style="margin:20px 0 0;font-size:13px;color:#666">A render of the selected configuration is attached to this email.</p>' : ""}
</td></tr></table>
<p style="font-size:12px;color:#999;margin:16px 0 0">Sent from the Cambridge Elevating configurator. Reply to this email to answer the customer directly.</p>
</td></tr></table></body></html>`;
}

async function brevo(path, apiKey, body) {
  const response = await fetch(`https://api.brevo.com/v3${path}`, {
    method: "POST",
    headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  return response;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.QUOTE_FROM_EMAIL;
  const to = parseRecipients(process.env.QUOTE_TO_EMAIL);
  if (!apiKey || !fromEmail || !to.length) {
    console.error("quote: missing BREVO_API_KEY / QUOTE_FROM_EMAIL / QUOTE_TO_EMAIL");
    return res.status(503).json({ ok: false, error: "not_configured" });
  }

  const body = typeof req.body === "string" ? safeJson(req.body) : req.body;
  if (!body || typeof body !== "object") return res.status(400).json({ ok: false, error: "bad_request" });

  // Honeypot: real users never see or fill this field. Pretend success so bots don't retry.
  if (body.website) return res.status(200).json({ ok: true });

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) return res.status(429).json({ ok: false, error: "rate_limited" });

  const c = body.contact || {};
  const contact = {
    name: clean(c.name),
    state: clean(c.state),
    company: clean(c.company),
    email: clean(c.email),
    phone: clean(c.phone),
  };
  if (!contact.name || !contact.state || !contact.phone || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(contact.email)) {
    return res.status(400).json({ ok: false, error: "invalid_contact" });
  }

  const configuration = (Array.isArray(body.configuration) ? body.configuration : [])
    .slice(0, 30)
    .map((item) => ({ step: clean(item && item.step), value: clean(item && item.value) }))
    .filter((item) => item.step);

  let attachment;
  if (typeof body.image === "string" && body.image.startsWith("data:image/jpeg;base64,")) {
    const content = body.image.slice("data:image/jpeg;base64,".length);
    if (Math.floor((content.length * 3) / 4) <= MAX_IMAGE_BYTES && /^[A-Za-z0-9+/=]+$/.test(content)) {
      attachment = [{ name: "cambridge-configuration.jpg", content }];
    }
  }

  const payload = {
    sender: { email: fromEmail, name: process.env.QUOTE_FROM_NAME || "Cambridge Elevating Configurator" },
    to,
    replyTo: { email: contact.email, name: contact.name },
    subject: `New configurator quote request - ${contact.name}${contact.company ? ` (${contact.company})` : ""}`,
    htmlContent: buildHtml(contact, configuration, Boolean(attachment)),
    ...(attachment ? { attachment } : {}),
  };

  try {
    const response = await brevo("/smtp/email", apiKey, payload);
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("quote: brevo error", response.status, text.slice(0, 300));
      return res.status(502).json({ ok: false, error: "send_failed" });
    }
  } catch (error) {
    console.error("quote: brevo request failed", error && error.message);
    return res.status(502).json({ ok: false, error: "send_failed" });
  }

  // Optional: keep the lead in a Brevo list too. Never fails the request (the email already went out).
  const listId = parseInt(process.env.BREVO_LIST_ID || "", 10);
  if (Number.isFinite(listId)) {
    const [firstName, ...rest] = contact.name.split(" ");
    brevo("/contacts", apiKey, {
      email: contact.email,
      updateEnabled: true,
      listIds: [listId],
      attributes: { FIRSTNAME: firstName, LASTNAME: rest.join(" ") },
    }).catch((error) => console.error("quote: brevo contact failed", error && error.message));
  }

  return res.status(200).json({ ok: true });
};

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
