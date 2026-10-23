/**
 * THE WARM EMAIL ENVELOPE — the account emails' one layout (The first look, Stage 2a: owner Ask 1 + Ask 8 2026-10-19,
 * U5/U6/U8 2026-10-20; drawn in docs/projects/archive/FIRST_LOOK_SIGNUP_HUB.html, S2, and FIRST_LOOK_STAGE2_UNDRAWN.html).
 *
 * The verification email and the password-reset email wear it, in their built-in builders (lib/email.ts) AND when a
 * platform admin customises their template (lib/platform-email-templates.ts), so a saved edit can never bring back the
 * old dark card. Every other email still wears `wrap()` in lib/email.ts; moving them onto this one is The public face's
 * S3, a migration onto this envelope, not a design.
 *
 * Email cannot load the product's fonts or know Warm/Dark, so this is warm and fixed: inline styles throughout,
 * Arial/Helvetica, no web fonts. Two things live in the document head and are progressive only (U8, ruled as
 * recommended): the light-only colour-scheme request, which the mail apps that honour it use to keep the card light in
 * dark mode, and one phone rule that tightens the padding — the inline styles alone are the full design and render
 * where a client drops the head.
 *
 * Framework-free: the send path and the template editor's live preview (a client component) both import it.
 */
import type { EmailLook, LookStyles } from './email-markup';

/** The envelope's colours. Fixed values, not tokens: an email never sees the product's theme. */
export const WARM_EMAIL = {
  ground: '#f6f1ea',
  groundEdge: '#c9c1b2',
  card: '#ffffff',
  // The drawing's rgba(70,55,30,.16) over the ground, flattened so Outlook's desktop app keeps the edge.
  cardEdge: '#dad3c9',
  ink: '#211c15',
  secondary: '#665f57',
  olive: '#55641c',
  hq: '#4b463f',
  lime: '#d9f99d',
  // The editor preview's {{token}} chip: an olive tint, so it reads as a placeholder on the white card.
  chipGround: '#eef3dc',
  chipEdge: '#c7d29a',
  chipInk: '#3d4a12',
  font: 'Arial,Helvetica,sans-serif',
} as const;

/** The templates that wear this envelope when customised. Every other key keeps `wrap()`. */
const WARM_ENVELOPE_KEYS = new Set(['signup_verification', 'password_reset']);

export function wearsWarmEnvelope(key: string | null | undefined): boolean {
  return !!key && WARM_ENVELOPE_KEYS.has(key);
}

/** The markup look a template renders in: the one decision every render path (send, preview, editor) asks. */
export function emailLookFor(key: string | null | undefined): EmailLook {
  return wearsWarmEnvelope(key) ? 'warm' : 'house';
}

const W = WARM_EMAIL;

/** Inline styles for the envelope's text, shared with the customisable markup's warm look (lib/email-markup.ts). */
export const WARM_EMAIL_STYLE = {
  heading: `margin:0 0 14px;font-family:${W.font};font-size:24px;line-height:1.2;font-weight:700;color:${W.ink};`,
  paragraph: `margin:0 0 14px;font-family:${W.font};font-size:16px;line-height:1.55;color:${W.ink};`,
  small: `margin:0 0 14px;font-family:${W.font};font-size:13px;line-height:1.55;color:${W.secondary};`,
} as const;

/** The customisable markup's warm look (lib/email-markup.ts): ink on the white card, the envelope's button. */
export const WARM_MARKUP_LOOK: LookStyles = {
  p: WARM_EMAIL_STYLE.paragraph,
  h: WARM_EMAIL_STYLE.heading,
  ul: `${WARM_EMAIL_STYLE.paragraph}padding-left:22px;`,
  calloutBase: `background:${W.ground};border:1px solid ${W.cardEdge};padding:16px 18px;margin:18px 0;border-radius:10px;`,
  calloutLime: `border-left:3px solid ${W.olive};`,
  calloutBlue: `border-left:3px solid ${W.secondary};`,
  calloutLabel: `margin:0 0 8px;font-family:${W.font};font-size:16px;line-height:1.3;font-weight:700;color:${W.ink};`,
  link: `display:inline-block;color:${W.olive};text-decoration:underline;font-family:${W.font};font-weight:700;font-size:16px;padding:6px 0;`,
  // type-ok: data — a {{token}} placeholder in the template editor's preview
  chip: `background:${W.chipGround};border:1px solid ${W.chipEdge};padding:0 3px;font-family:monospace;font-size:0.9em;color:${W.chipInk};`,
  button: (label, href) => warmEmailButton(label, href),
};

/** A heading, from trusted HTML. */
export function warmEmailHeading(html: string): string {
  return `<h1 style="${WARM_EMAIL_STYLE.heading}">${html}</h1>`;
}

/** A body paragraph, from trusted HTML. */
export function warmEmailParagraph(html: string): string {
  return `<p style="${WARM_EMAIL_STYLE.paragraph}">${html}</p>`;
}

/** A small secondary line, from trusted HTML. */
export function warmEmailSmall(html: string): string {
  return `<p style="${WARM_EMAIL_STYLE.small}">${html}</p>`;
}

/**
 * The lime button with its olive edge (D-F11: the edge holds it against the white card). A table cell carries the
 * colour so Outlook's desktop app, which ignores padding on a link, still draws a button; `mso-padding-alt` gives that
 * cell the link's padding there alone (every other client pads the link, which keeps the whole button tappable).
 */
export function warmEmailButton(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 18px;border-collapse:separate;">`
    + `<tr><td style="background:${W.lime};border:1px solid ${W.olive};border-radius:10px;mso-padding-alt:14px 26px;">`
    + `<a href="${href}" style="display:inline-block;padding:14px 26px;font-family:${W.font};font-size:16px;line-height:1.2;font-weight:700;color:${W.ink};text-decoration:none;border-radius:10px;">${label}</a>`
    + `</td></tr></table>`;
}

/** The wordmark (D-F11): FIELD in ink, LOGIC in olive, HQ in the dark grey. */
// type-ok: wordmark
const WORDMARK = `<p style="margin:0 0 22px;font-family:'Courier New',Courier,monospace;font-size:15px;line-height:1.2;font-weight:700;letter-spacing:0.02em;color:${W.ink};">`
  + `FIELD<span style="color:${W.olive};">LOGIC</span><span style="color:${W.hq};">HQ</span></p>`;

/**
 * The envelope without a document around it: the white card with the wordmark and `inner`. There is no beige frame
 * round the card and no footer word (owner 2026-10-20: the frame held nothing the card did not, and the wordmark
 * already names the sender). The card's edge is the darker one, so it holds against a mail app's white. For a preview
 * that drops it into a page (the template editor); a sent email uses `warmEmailDocument`.
 */
export function warmEmailBody(inner: string): string {
  // A table cell, not a div, carries the card's padding, colour and edge: Outlook's desktop app (the Word engine)
  // drops padding on a div. No indentation: the plain-text part (lib/email.ts htmlToText) keeps a line's leading
  // spaces.
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;margin:0 auto;border-collapse:separate;">
<tr><td class="fl-card" style="background:${W.card};border:1px solid ${W.groundEdge};border-radius:12px;padding:28px 26px;font-family:${W.font};color:${W.ink};text-align:left;">
${WORDMARK}
${inner}
</td></tr>
</table>`;
}

/**
 * The envelope as the whole email: a document whose head asks for light only (U8) and tightens the padding on a phone
 * (the U8 drawing: 22px 18px inside the card). Outlook's desktop app ignores a max-width, so it
 * gets a fixed 600px table of its own.
 */
export function warmEmailDocument(inner: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>FieldLogicHQ</title>
<style>
:root { color-scheme: light only; supported-color-schemes: light only; }
@media (max-width: 480px) {
  .fl-card { padding: 22px 18px !important; }
}
</style>
</head>
<body style="margin:0;padding:0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td align="center" style="padding:24px 8px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
${warmEmailBody(inner)}
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;
}
