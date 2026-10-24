/**
 * lib/email-plain-text.ts — the plain-text part of an HTML email (the part a mail app shows when it will not show HTML, and
 * what spam filters read). Pure, so a test can hold what it says. Lifted out of lib/email.ts in The public face's S3b, when
 * the club band's tile had to be left out of it.
 */
export function htmlToText(html: string): string {
  return html
    // A whole-document email (the warm envelope, lib/email-envelope-warm.ts) has a head with a style block: none of
    // it is words.
    .replace(/<head\b[\s\S]*?<\/head>/i, '')
    // The club band's tile (its initials or logo) is a picture of the name beside it, not words: the text part starts
    // with the club's name itself (The public face, warm: S3b).
    .replace(/<td\b[^>]*\bdata-fl-tile=[^>]*>[\s\S]*?<\/td>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rarr;/g, '→')
    .replace(/&larr;/g, '←')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
