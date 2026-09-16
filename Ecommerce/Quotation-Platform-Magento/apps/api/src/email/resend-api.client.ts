// Resend over its HTTPS REST API rather than SMTP — deliberately separate
// from the generic nodemailer path used for every other provider. Render's
// free web services block outbound traffic to SMTP ports (25/465/587)
// entirely as of their Sept 2025 policy change; HTTPS isn't affected, so
// this is what actually lets email send while staying on the free tier.
// Only Resend gets this treatment — every other provider (Brevo, SendGrid,
// Postmark, Mailgun, Custom) still goes over SMTP and is still blocked on
// the free tier; upgrading the Render plan is the fix for those.

export interface ResendMail {
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

// No dedicated "verify this key" endpoint is documented, and Resend's own
// onboarding flow hands out "sending access" restricted keys that are
// rejected (401) by anything other than POST /emails — so a GET to e.g.
// /domains can't be used to check the key. Instead this POSTs a
// deliberately incomplete payload to /emails: a 422 (validation error)
// still means the key authenticated fine and only the payload was
// rejected, while a 401/403 means the key itself is bad. No email is
// actually sent either way.
export async function verifyResendApiKey(apiKey: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (res.status === 401 || res.status === 403) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend API key check failed (${res.status}): ${body || res.statusText}`);
  }
}

export async function sendViaResendApi(apiKey: string, mail: ResendMail): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: mail.from,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend API error (${res.status}): ${body || res.statusText}`);
  }
}
