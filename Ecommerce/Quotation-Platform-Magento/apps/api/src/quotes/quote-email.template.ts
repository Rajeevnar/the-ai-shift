// Deliberately simple inline-styled HTML — no external stylesheet, since
// most email clients strip <link>/<style> blocks anyway. Kept as one
// function (not a templating engine) since this is the only email this
// product sends today; revisit if a second email type is added.
export interface QuoteEmailBranding {
  tenantName: string;
  logoUrl: string | null;
  brandColor: string | null;
  // Background fill for the header and footer bands — separate from
  // brandColor, which is used as an accent border/button color rather
  // than a fill. Falls back to a light grey if unset.
  emailBgColor: string | null;
  headerTitle: string | null;
  // Both are trusted, pre-sanitized HTML by the time they reach this
  // function (see SettingsService.updateBranding, and QuotesService.
  // sendEmail's plainTextToHtml for the per-send/notes override path) —
  // never raw user input, and never escaped here.
  introMessage: string | null;
  footerMessage: string | null;
}

export interface QuoteEmailData {
  documentLabel: string; // "Quote" or "Invoice"
  number: string;
  clientName: string;
  currency: string;
  sections: {
    title: string;
    subtotal: string;
    vatTotal: string;
    lineItems: {
      description: string;
      quantity: string;
      unitPrice: string;
      discountPercent: string;
      vatRate: string;
      amount: string;
    }[];
  }[];
  subtotal: string;
  vatTotal: string;
  grandTotal: string;
}

// Six columns throughout (Description / Qty / Price / Disc % / VAT % /
// Amount) — mirrors the quote builder's own line-item table, so what the
// client receives by email matches what was built on screen instead of
// collapsing everything down to just a quantity and a combined amount.
export function renderQuoteEmail(branding: QuoteEmailBranding, data: QuoteEmailData): string {
  const accent = branding.brandColor ?? '#0f172a';
  const bgColor = branding.emailBgColor ?? '#f8fafc';
  const headerTitle = branding.headerTitle ?? branding.tenantName;
  // Only the generated default needs escaping — a stored introMessage is
  // already-sanitized HTML (see QuoteEmailBranding's doc comment above).
  const introHtml =
    branding.introMessage ?? escapeHtml(`Here's your ${data.documentLabel.toLowerCase()} from ${branding.tenantName}.`);
  const symbol = currencySymbol(data.currency);

  const columnHeaderRow = `
    <tr style="font-size:11px;color:#94a3b8;text-transform:uppercase;">
      <td style="padding:2px 0;">Description</td>
      <td style="padding:2px 0;text-align:center;">Qty</td>
      <td style="padding:2px 0;text-align:right;">Price</td>
      <td style="padding:2px 0;text-align:right;">Disc %</td>
      <td style="padding:2px 0;text-align:right;">VAT %</td>
      <td style="padding:2px 0;text-align:right;">Amount</td>
    </tr>`;

  const sectionsHtml = data.sections
    .map(
      (s) => `
        <tr><td colspan="6" style="padding:16px 0 4px;font-weight:600;color:#0f172a;">${escapeHtml(s.title)}</td></tr>
        ${columnHeaderRow}
        ${s.lineItems
          .map(
            (li) => `
          <tr>
            <td style="padding:4px 0;color:#334155;">${escapeHtml(li.description)}</td>
            <td style="padding:4px 0;color:#64748b;text-align:center;">${escapeHtml(li.quantity)}</td>
            <td style="padding:4px 0;color:#64748b;text-align:right;">${li.unitPrice}</td>
            <td style="padding:4px 0;color:#64748b;text-align:right;">${li.discountPercent}%</td>
            <td style="padding:4px 0;color:#64748b;text-align:right;">${li.vatRate}%</td>
            <td style="padding:4px 0;color:#334155;text-align:right;">${symbol}${li.amount}</td>
          </tr>`,
          )
          .join('')}
        <tr>
          <td colspan="6" style="padding:6px 0 0;border-top:1px solid #f1f5f9;text-align:right;color:#94a3b8;font-size:12px;">
            Subtotal ${symbol}${s.subtotal} · VAT ${symbol}${s.vatTotal}
          </td>
        </tr>`,
    )
    .join('');

  return `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background:${bgColor};border-bottom:3px solid ${accent};padding:24px 32px;text-align:center;">
                ${branding.logoUrl ? `<img src="${escapeHtml(branding.logoUrl)}" alt="${escapeHtml(branding.tenantName)}" style="max-height:48px;display:block;margin:0 auto 10px;" />` : ''}
                <p style="margin:0;color:#0f172a;font-size:20px;font-weight:600;">${escapeHtml(headerTitle)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <div style="margin:0 0 16px;color:#0f172a;font-size:16px;line-height:1.5;">${introHtml}</div>
                <p style="margin:0 0 24px;color:#64748b;font-size:14px;">
                  ${escapeHtml(data.documentLabel)} <strong>${escapeHtml(data.number)}</strong> for ${escapeHtml(data.clientName)}
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0;font-size:14px;">
                  ${sectionsHtml}
                </table>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-top:1px solid #e2e8f0;padding-top:8px;font-size:14px;">
                  <tr><td style="color:#64748b;">Subtotal</td><td style="text-align:right;color:#64748b;">${symbol}${data.subtotal}</td></tr>
                  <tr><td style="color:#64748b;">VAT</td><td style="text-align:right;color:#64748b;">${symbol}${data.vatTotal}</td></tr>
                  <tr><td style="font-weight:600;color:#0f172a;padding-top:4px;">Total</td><td style="text-align:right;font-weight:600;color:#0f172a;padding-top:4px;">${symbol}${data.grandTotal}</td></tr>
                </table>
              </td>
            </tr>
            ${
              branding.footerMessage
                ? `<tr><td style="background:${bgColor};padding:20px 32px;color:#64748b;font-size:13px;line-height:1.5;">${branding.footerMessage}</td></tr>`
                : ''
            }
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// Falls back to "<CODE> " (with a trailing space, since it isn't a glyph)
// for anything not in this list, rather than silently showing nothing.
const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: '£',
  USD: '$',
  EUR: '€',
  INR: '₹',
  AUD: '$',
  CAD: '$',
  JPY: '¥',
};

function currencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code.toUpperCase()] ?? `${code} `;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
