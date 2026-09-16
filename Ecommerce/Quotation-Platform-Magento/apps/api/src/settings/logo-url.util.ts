// Converts a tenant's stored logoUrl into whatever an outgoing email should
// actually embed. Uploaded logos are stored as data: URLs (see
// SettingsService.updateLogo) — fine for the admin UI's own <img> tags, but
// most email clients (Gmail included) strip/block data: URIs in an <img
// src>, and embedding one inline also bloats the email HTML past Gmail's
// clip threshold. A data: URL is swapped for a link to the public logo
// endpoint (public-branding.controller.ts), which serves the same bytes
// back out as a normal HTTPS image response. A pasted external http(s) URL
// (the other form this field can hold) is left as-is.
export function toEmailLogoUrl(apiPublicUrl: string, tenantId: string, logoUrl: string | null): string | null {
  if (!logoUrl) return null;
  if (logoUrl.startsWith('data:')) {
    return `${apiPublicUrl}/public/branding/${tenantId}/logo`;
  }
  return logoUrl;
}
