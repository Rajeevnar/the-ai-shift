// Mirrors apps/api/src/quotes/quote-email.template.ts closely enough for
// an accurate live preview on the Settings page — duplicated rather than
// shared, since the two apps aren't set up as a monorepo with a shared
// package. Uses fixed dummy sample data; only the branding fields come
// from the (unsaved, in-progress) form state, so the preview updates as
// you type without needing to save first.

export interface PreviewBranding {
  tenantName: string;
  logoUrl: string;
  brandColor: string;
  emailBgColor: string;
  headerTitle: string;
  introHtml: string;
  footerHtml: string;
}

const SAMPLE_SECTIONS = [
  {
    title: 'Catering',
    subtotal: '245.00',
    vatTotal: '49.00',
    lineItems: [
      { description: 'Breakfast Sharing Platter', quantity: '10', unitPrice: '12.50', discountPercent: '0', vatRate: '20', amount: '125.00' },
      { description: 'Fresh Apple Juice', quantity: '20', unitPrice: '6.00', discountPercent: '0', vatRate: '20', amount: '120.00' },
    ],
  },
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildPreviewHtml(branding: PreviewBranding): string {
  const accent = branding.brandColor || '#0f172a';
  const bgColor = branding.emailBgColor || '#f8fafc';
  const headerTitle = branding.headerTitle || branding.tenantName || 'Your Business';
  const introHtml = branding.introHtml || escapeHtml("Here's your quote from " + (branding.tenantName || 'your business') + '.');

  const columnHeaderRow = `
    <tr style="font-size:11px;color:#94a3b8;text-transform:uppercase;">
      <td style="padding:2px 0;">Description</td>
      <td style="padding:2px 0;text-align:center;">Qty</td>
      <td style="padding:2px 0;text-align:right;">Price</td>
      <td style="padding:2px 0;text-align:right;">Disc %</td>
      <td style="padding:2px 0;text-align:right;">VAT %</td>
      <td style="padding:2px 0;text-align:right;">Amount</td>
    </tr>`;

  const sectionsHtml = SAMPLE_SECTIONS.map(
    (s) => `
      <tr><td colspan="6" style="padding:16px 0 4px;font-weight:600;color:#0f172a;">${escapeHtml(s.title)}</td></tr>
      ${columnHeaderRow}
      ${s.lineItems
        .map(
          (li) => `
        <tr>
          <td style="padding:4px 0;color:#334155;">${escapeHtml(li.description)}</td>
          <td style="padding:4px 0;color:#64748b;text-align:center;">${li.quantity}</td>
          <td style="padding:4px 0;color:#64748b;text-align:right;">${li.unitPrice}</td>
          <td style="padding:4px 0;color:#64748b;text-align:right;">${li.discountPercent}%</td>
          <td style="padding:4px 0;color:#64748b;text-align:right;">${li.vatRate}%</td>
          <td style="padding:4px 0;color:#334155;text-align:right;">£${li.amount}</td>
        </tr>`,
        )
        .join('')}
      <tr>
        <td colspan="6" style="padding:6px 0 0;border-top:1px solid #f1f5f9;text-align:right;color:#94a3b8;font-size:12px;">
          Subtotal £${s.subtotal} · VAT £${s.vatTotal}
        </td>
      </tr>`,
  ).join('');

  return `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:16px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background:${bgColor};border-bottom:3px solid ${accent};padding:24px 32px;text-align:center;">
                ${branding.logoUrl ? `<img src="${escapeHtml(branding.logoUrl)}" alt="" style="max-height:48px;display:block;margin:0 auto 10px;" />` : ''}
                <p style="margin:0;color:#0f172a;font-size:20px;font-weight:600;">${escapeHtml(headerTitle)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <div style="margin:0 0 16px;color:#0f172a;font-size:16px;line-height:1.5;">${introHtml}</div>
                <p style="margin:0 0 24px;color:#64748b;font-size:14px;">
                  Quote <strong>Q-1234</strong> for Jane Smith
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0;font-size:14px;">
                  ${sectionsHtml}
                </table>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-top:1px solid #e2e8f0;padding-top:8px;font-size:14px;">
                  <tr><td style="color:#64748b;">Subtotal</td><td style="text-align:right;color:#64748b;">£245.00</td></tr>
                  <tr><td style="color:#64748b;">VAT</td><td style="text-align:right;color:#64748b;">£49.00</td></tr>
                  <tr><td style="font-weight:600;color:#0f172a;padding-top:4px;">Total</td><td style="text-align:right;font-weight:600;color:#0f172a;padding-top:4px;">£294.00</td></tr>
                </table>
              </td>
            </tr>
            ${
              branding.footerHtml
                ? `<tr><td style="background:${bgColor};padding:20px 32px;color:#64748b;font-size:13px;line-height:1.5;">${branding.footerHtml}</td></tr>`
                : ''
            }
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
