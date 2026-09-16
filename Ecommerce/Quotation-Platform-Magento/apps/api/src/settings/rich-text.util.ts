import sanitizeHtml from 'sanitize-html';

// Applied to quoteIntroMessage/quoteFooterMessage before they're ever
// stored — these render both in outgoing HTML emails and in the admin's
// own live preview, so untrusted markup here is a real XSS surface, not
// just a cosmetic concern. Allowlist covers exactly what the Settings
// editor's toolbar can produce (bold, italic, links, line breaks, lists,
// alignment) — nothing else survives. `style` is restricted to
// `text-align` specifically (the only inline style execCommand's
// justifyLeft/Center/Right ever produce) rather than allowed generally,
// which would otherwise let arbitrary CSS (including data-exfiltration
// tricks like background-image: url(...)) through.
export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ['b', 'strong', 'i', 'em', 'a', 'p', 'div', 'br', 'ul', 'ol', 'li'],
    allowedAttributes: { a: ['href', 'target', 'rel'], p: ['style'], div: ['style'] },
    allowedStyles: { '*': { 'text-align': [/^left$/, /^center$/, /^right$/, /^justify$/] } },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }),
    },
  });
}
