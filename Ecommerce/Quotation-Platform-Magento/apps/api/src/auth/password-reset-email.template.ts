// Deliberately separate from quotes/quote-email.template.ts — this is a
// transactional account-security email, not a quote/invoice, and keeping
// it simple avoids dragging quote-specific fields (sections, totals) into
// something that never needs them.
export interface PasswordResetEmailBranding {
  tenantName: string;
  logoUrl: string | null;
  brandColor: string | null;
  headerTitle: string | null;
}

export function renderPasswordResetEmail(branding: PasswordResetEmailBranding, resetUrl: string): string {
  const accent = branding.brandColor ?? '#0f172a';
  const headerTitle = branding.headerTitle ?? branding.tenantName;

  return `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background:#f8fafc;border-bottom:3px solid ${accent};padding:24px 32px;text-align:center;">
                ${branding.logoUrl ? `<img src="${escapeHtml(branding.logoUrl)}" alt="${escapeHtml(branding.tenantName)}" style="max-height:48px;display:block;margin:0 auto 10px;" />` : ''}
                <p style="margin:0;color:#0f172a;font-size:20px;font-weight:600;">${escapeHtml(headerTitle)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;text-align:center;">
                <p style="margin:0 0 20px;color:#0f172a;font-size:16px;">Reset your password</p>
                <p style="margin:0 0 24px;color:#64748b;font-size:14px;">
                  We received a request to reset the password on your account. Click below to choose a new one —
                  this link expires in 1 hour. If you didn't request this, you can safely ignore this email.
                </p>
                <a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:10px 24px;border-radius:6px;font-size:14px;font-weight:600;">
                  Reset password
                </a>
                <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;word-break:break-all;">
                  Or paste this link into your browser: ${escapeHtml(resetUrl)}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
