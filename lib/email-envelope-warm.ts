/**
 * THE WARM EMAIL ENVELOPE — every email's one layout (built for the account emails by The first look, Stage 2a: owner Ask 1 +
 * Ask 8 2026-10-19, U5/U6/U8 2026-10-20; drawn in docs/projects/archive/FIRST_LOOK_SIGNUP_HUB.html, S2, and
 * FIRST_LOOK_STAGE2_UNDRAWN.html; carried to every other email by The public face's S3a, owner Ask 9 2026-10-23).
 *
 * `wrap()` in lib/email.ts, the senders' own shells and the platform templates (built-in, customised, campaigns, the
 * editor's preview and the test-send) all produce this document, so there is no second look to drift. S3a was a
 * migration onto this envelope, not a design.
 *
 * Email cannot load the product's fonts or know Warm/Dark, so this is warm and fixed: inline styles throughout,
 * Arial/Helvetica, no web fonts. Two things live in the document head and are progressive only (U8, ruled as
 * recommended): the light-only colour-scheme request, which the mail apps that honour it use to keep the card light in
 * dark mode, and one phone rule that tightens the padding — the inline styles alone are the full design and render
 * where a client drops the head.
 *
 * Framework-free: the send path and the template editor's live preview (a client component) both import it.
 */
import type { LookStyles } from './email-markup';

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

const W = WARM_EMAIL;

/** Inline styles for the envelope's text, shared with the customisable markup's warm look (lib/email-markup.ts). */
export const WARM_EMAIL_STYLE = {
  heading: `margin:0 0 14px;font-family:${W.font};font-size:24px;line-height:1.2;font-weight:700;color:${W.ink};`,
  paragraph: `margin:0 0 14px;font-family:${W.font};font-size:16px;line-height:1.55;color:${W.ink};`,
  small: `margin:0 0 14px;font-family:${W.font};font-size:13px;line-height:1.55;color:${W.secondary};`,
  // A box lifted off the card (a details block, a callout): the ground tone and the card's edge, as WARM_MARKUP_LOOK's.
  panel: `background:${W.ground};border:1px solid ${W.cardEdge};padding:16px 18px;margin:18px 0;border-radius:10px;`,
  // The label that opens a panel: sentence case, bold ink (P3: no forced capitals).
  panelLabel: `margin:0 0 8px;font-family:${W.font};font-size:16px;line-height:1.3;font-weight:700;color:${W.ink};`,
  // The rule and fine print at the foot of the card: a footer, an unsubscribe line, the coach portal link.
  footRule: `margin:28px 0 0;padding-top:16px;border-top:1px solid ${W.cardEdge};`,
  finePrint: `margin:0;font-family:${W.font};font-size:12px;line-height:1.55;color:${W.secondary};`,
  finePrintLink: `color:${W.olive};text-decoration:underline;`,
  // A bulleted list at paragraph size.
  list: `margin:0 0 14px;font-family:${W.font};font-size:16px;line-height:1.55;color:${W.ink};padding-left:22px;`,
  // The small bold line above a heading that names whose message it is (a team).
  eyebrow: `margin:0 0 14px;font-family:${W.font};font-size:14px;line-height:1.4;font-weight:700;color:${W.secondary};`,
  // A quiet olive text link (the secondary action under a button).
  textLink: `color:${W.olive};text-decoration:underline;font-weight:700;`,
} as const;

/**
 * The style of a boxed block inside an email's content (a details box, a payment box): the ground tone, the card's edge and
 * a 3px accent on the left, olive for the good-news kind and grey for the rest. The builders' wider padding is the default;
 * a box that sits tighter passes its own.
 */
export function warmPanelStyle(edge: 'secondary' | 'olive', box: { padding?: string; margin?: string } = {}): string {
  return `background:${W.ground};border:1px solid ${W.cardEdge};border-left:3px solid ${W[edge]};padding:${box.padding ?? '1.25rem'};margin:${box.margin ?? '1.5rem 0'};`;
}

/** Fine print at the foot of the card, under a rule: a sender line, a reason, a notice. `inner` is trusted HTML. */
export function warmEmailFootnote(inner: string): string {
  return `<div style="${WARM_EMAIL_STYLE.footRule}"><p style="${WARM_EMAIL_STYLE.finePrint}">${inner}</p></div>`;
}

/**
 * Where the card ends. A footer that is added after the content is built (the unsubscribe line) goes in here, so it
 * sits on the white card, not on the mail app's own ground. A comment: the plain-text part strips it with the tags.
 */
export const WARM_CARD_END = '<!--fl-card-end-->';

/**
 * The CASL footer every marketing send carries: why the person is getting it, and the way out. One builder for the send
 * (lib/email-sender.ts) and the admin's preview of it, so a preview can never show a footer the email does not carry.
 */
export function warmUnsubscribeFooterHtml(unsubscribeUrl: string): string {
  return `
<div style="${WARM_EMAIL_STYLE.footRule}">
  <p style="${WARM_EMAIL_STYLE.finePrint}margin-bottom:6px;">
    You're receiving this because you signed up for FieldLogicHQ.
  </p>
  <p style="${WARM_EMAIL_STYLE.finePrint}">
    <a href="${unsubscribeUrl}" style="${WARM_EMAIL_STYLE.finePrintLink}">Unsubscribe</a>
    &nbsp;·&nbsp; FieldLogicHQ · Canada
  </p>
</div>`;
}

/**
 * The words a person reads in a whole-document email, for a page that shows it inline (the dues reminder's sample):
 * the document's head carries a style block that would otherwise reach the page around it, a colour-scheme request
 * included.
 */
export function warmEmailForPreview(html: string): string {
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return body ? body[1] : html;
}

/** `fragment` inside the card, at its end; at the end of `html` when it is not an envelope (a hand-built document). */
export function insertAtWarmCardEnd(html: string, fragment: string): string {
  if (html.includes(WARM_CARD_END)) return html.replace(WARM_CARD_END, () => `${fragment}
${WARM_CARD_END}`);
  if (html.includes('</body>')) return html.replace('</body>', () => `${fragment}
</body>`);
  return html + fragment;
}

/** The customisable markup's warm look (lib/email-markup.ts): ink on the white card, the envelope's button. */
export const WARM_MARKUP_LOOK: LookStyles = {
  p: WARM_EMAIL_STYLE.paragraph,
  h: WARM_EMAIL_STYLE.heading,
  ul: WARM_EMAIL_STYLE.list,
  calloutBase: WARM_EMAIL_STYLE.panel,
  calloutOlive: `border-left:3px solid ${W.olive};`,
  calloutGrey: `border-left:3px solid ${W.secondary};`,
  calloutLabel: WARM_EMAIL_STYLE.panelLabel,
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
${WARM_CARD_END}
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
