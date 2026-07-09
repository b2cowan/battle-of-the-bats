/**
 * lib/email-markup.ts
 *
 * A small, safe block-markup language for operator-editable email content.
 *
 * WHY THIS EXISTS
 * ---------------
 * The founding-season marketing campaigns (and, once customised, the transactional
 * templates) are edited by platform operators in Platform Admin → Email Templates.
 * We want operators to edit the WORDS without a deploy while keeping each campaign's
 * designed layout — callout boxes, bullet lists, buttons — and WITHOUT handing them a
 * raw-HTML foot-gun. This module turns a compact, forgiving markup into the branded
 * FieldLogicHQ email HTML, and is the SINGLE renderer used by both the send path and
 * the live preview (so preview always equals what's sent).
 *
 * GRAMMAR (line-oriented)
 * -----------------------
 *   plain text line            → paragraph text (consecutive lines join with <br>)
 *   (blank line)               → paragraph break
 *   **bold**                   → <strong>bold</strong>
 *   {{token}}                  → filled with a variable value (escaped) at render time
 *   - item                     → bullet list item (consecutive `- ` lines = one <ul>)
 *   ::button Label | {{url}}   → primary (lime) call-to-action button
 *   ::link Label | {{url}}     → secondary (quiet) text link
 *   ::callout Label            → start a lime callout box titled "Label"
 *   ::callout.blue Label       → start a blue callout box
 *   ::end                      → close the nearest ::callout / ::if
 *   ::if token                 → render the enclosed block only if `token` is truthy
 *   ::else                     → (optional) alternate block for the enclosing ::if
 *
 * The markup itself is authored by trusted operators / our own seeds, so it is NOT
 * HTML-escaped. VARIABLE VALUES (which may carry customer-entered text like an org
 * name) ARE escaped before interpolation.
 */

/**
 * Local copy of the standard HTML escape (mirrors lib/email.ts `escapeHtml`). Kept
 * inline so this module stays a dependency-free leaf — it is imported by both the
 * server send path AND the browser live-preview, and unit-tested in isolation.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}

export type EmailVars = Record<string, string | number | null | undefined>;

export type TokenMode = 'fill' | 'chip';

// ── Style tokens (mirror the hand-built founding/spotlight emails) ─────────────
const P_STYLE = 'margin:0 0 1.1rem;line-height:1.7;color:rgba(241,245,249,0.85);';
const H_STYLE = 'color:#D9F99D;font-size:1.35rem;font-weight:800;margin:0 0 1.25rem;letter-spacing:-0.01em;';
const UL_STYLE = 'margin:0;padding-left:1.25rem;line-height:1.9;color:rgba(241,245,249,0.8);';
const CALLOUT_BASE = 'background:#0F172A;padding:1.25rem;margin:1.5rem 0;';
const CALLOUT_LIME = 'border:1px solid rgba(217,249,157,0.2);border-left:3px solid rgba(217,249,157,0.5);';
const CALLOUT_BLUE = 'border:1px solid rgba(30,58,138,0.25);border-left:3px solid rgba(30,58,138,0.5);';
const CALLOUT_LABEL = 'margin:0 0 0.75rem;font-weight:700;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:#D9F99D;';
const BTN_STYLE = 'display:inline-block;background:#D9F99D;color:#0b0f14;text-decoration:none;font-weight:800;padding:0.8rem 1.5rem;font-size:0.82rem;letter-spacing:0.06em;margin:0.5rem 0 1rem;';
const LINK_STYLE = 'display:inline-block;color:#D9F99D;text-decoration:none;font-weight:700;font-size:0.85rem;padding:0.4rem 0;';
const CHIP_STYLE = 'background:rgba(30,58,138,0.35);border:1px solid rgba(30,58,138,0.6);padding:0 3px;font-family:monospace;font-size:0.9em;color:#93c5fd;';

// ── Token fill ─────────────────────────────────────────────────────────────────

/** A variable is "truthy" (for ::if) when present and not empty / "0" / "false". */
function isTruthyVar(v: string | number | null | undefined): boolean {
  if (v === null || v === undefined) return false;
  const s = String(v).trim().toLowerCase();
  return s !== '' && s !== '0' && s !== 'false';
}

/**
 * Replace {{token}} occurrences.
 * - 'fill': substitute the (HTML-escaped) variable value; unknown tokens are left as
 *   the literal {{token}} so a missing value is visible rather than silently blank.
 * - 'chip': render every token as a styled monospace chip (used by the editor's live
 *   preview so operators see where variables will land).
 */
function fillTokens(text: string, vars: EmailVars, mode: TokenMode): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => {
    if (mode === 'chip') {
      return `<span style="${CHIP_STYLE}">{{${key}}}</span>`;
    }
    const val = vars[key];
    if (val === null || val === undefined) return `{{${key}}}`;
    return escapeHtml(String(val));
  });
}

/** Inline formatting for a run of paragraph/label/button text: tokens then **bold**. */
function inline(text: string, vars: EmailVars, mode: TokenMode): string {
  const filled = fillTokens(text, vars, mode);
  return filled.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

/** Fill tokens for use inside an href attribute (no bold, no chip). */
function fillUrl(text: string, vars: EmailVars): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => {
    const val = vars[key];
    if (val === null || val === undefined) return '#';
    // Strip CR/LF before escaping — a newline in a URL value would otherwise become an
    // unescaped `<br>` (via escapeHtml's `\n`→`<br>` rule) and break out of the href.
    return escapeHtml(String(val).replace(/[\r\n]+/g, ''));
  });
}

// ── Block parser ─────────────────────────────────────────────────────────────

type Cursor = { lines: string[]; i: number };

/**
 * Parse a run of blocks until a terminator (`::end` / `::else`) at THIS nesting level,
 * or end-of-input. Returns the rendered HTML and leaves the cursor positioned ON the
 * terminator line (caller consumes it).
 */
function parseBlocks(cur: Cursor, vars: EmailVars, mode: TokenMode): string {
  const out: string[] = [];
  let para: string[] = [];
  let bullets: string[] = [];

  const flushPara = () => {
    if (para.length) {
      out.push(`<p style="${P_STYLE}">${para.map(l => inline(l, vars, mode)).join('<br>')}</p>`);
      para = [];
    }
  };
  const flushBullets = () => {
    if (bullets.length) {
      const items = bullets.map(b => `<li>${inline(b, vars, mode)}</li>`).join('');
      out.push(`<ul style="${UL_STYLE}">${items}</ul>`);
      bullets = [];
    }
  };
  const flushAll = () => { flushPara(); flushBullets(); };

  while (cur.i < cur.lines.length) {
    const raw = cur.lines[cur.i];
    const line = raw.trim();

    // Terminators for the enclosing block — do NOT consume here.
    if (line === '::end' || line === '::else') { flushAll(); return out.join('\n'); }

    if (line === '') { flushAll(); cur.i++; continue; }

    // Bullet
    const bulletMatch = line.match(/^-\s+(.*)$/);
    if (bulletMatch) { flushPara(); bullets.push(bulletMatch[1]); cur.i++; continue; }
    flushBullets(); // any non-bullet ends a bullet run

    // Button / link
    const btn = line.match(/^::button\s+(.*)$/);
    if (btn) {
      flushPara();
      out.push(renderCta(btn[1], vars, mode, 'button'));
      cur.i++; continue;
    }
    const lnk = line.match(/^::link\s+(.*)$/);
    if (lnk) {
      flushPara();
      out.push(renderCta(lnk[1], vars, mode, 'link'));
      cur.i++; continue;
    }

    // Callout
    const callout = line.match(/^::callout(\.blue)?\s*(.*)$/);
    if (callout) {
      flushPara();
      const variant = callout[1] ? 'blue' : 'lime';
      const label = callout[2].trim();
      cur.i++; // consume the ::callout line
      const inner = parseBlocks(cur, vars, mode);
      consumeEnd(cur); // consume the matching ::end
      const border = variant === 'blue' ? CALLOUT_BLUE : CALLOUT_LIME;
      const labelHtml = label ? `<p style="${CALLOUT_LABEL}">${inline(label, vars, mode)}</p>` : '';
      out.push(`<div style="${CALLOUT_BASE}${border}">${labelHtml}${inner}</div>`);
      continue;
    }

    // Conditional
    const ifMatch = line.match(/^::if\s+(\w+)\s*$/);
    if (ifMatch) {
      flushPara();
      const token = ifMatch[1];
      cur.i++; // consume ::if
      const thenHtml = parseBlocks(cur, vars, mode);
      let elseHtml = '';
      if (cur.i < cur.lines.length && cur.lines[cur.i].trim() === '::else') {
        cur.i++; // consume ::else
        elseHtml = parseBlocks(cur, vars, mode);
      }
      consumeEnd(cur); // consume ::end
      // In chip (preview) mode, show both branches so the operator sees all content.
      if (mode === 'chip') {
        out.push(thenHtml + elseHtml);
      } else {
        out.push(isTruthyVar(vars[token]) ? thenHtml : elseHtml);
      }
      continue;
    }

    // Plain paragraph line
    para.push(line);
    cur.i++;
  }

  flushAll();
  return out.join('\n');
}

function consumeEnd(cur: Cursor): void {
  if (cur.i < cur.lines.length && cur.lines[cur.i].trim() === '::end') cur.i++;
}

function renderCta(spec: string, vars: EmailVars, mode: TokenMode, kind: 'button' | 'link'): string {
  const [labelPart, urlPart] = splitOnLastPipe(spec);
  const label = inline(labelPart.trim(), vars, mode);
  const href = urlPart ? fillUrl(urlPart.trim(), vars) : '#';
  const style = kind === 'button' ? BTN_STYLE : LINK_STYLE;
  return `<a href="${href}" style="${style}">${label}</a>`;
}

/**
 * Split a `Label | url` CTA spec on the LAST `|`, so a label that itself contains a
 * literal `|` (e.g. "Buy 1 | Get 1 Free | {{url}}") keeps the whole label and the URL is
 * the final segment. (A literal `|` in a URL is invalid per RFC 3986, so the URL side is
 * the safe place to anchor the split.)
 */
function splitOnLastPipe(s: string): [string, string | null] {
  const idx = s.lastIndexOf('|');
  if (idx === -1) return [s, null];
  return [s.slice(0, idx), s.slice(idx + 1)];
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Fill {{token}}s in a plain-text string (email subject line). No HTML escaping and no
 * **bold** handling — a subject is plain text, so entities like &amp; must not leak in.
 * Unknown tokens are left as literal {{token}}.
 */
export function fillSubjectTokens(text: string, vars: EmailVars = {}): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => {
    const val = vars[key];
    if (val === null || val === undefined) return `{{${key}}}`;
    return String(val);
  });
}

/**
 * Render body markup to the inner HTML (no envelope). Exported for unit tests and for
 * callers that compose their own wrapper.
 */
export function renderMarkupToHtml(markup: string, vars: EmailVars = {}, mode: TokenMode = 'fill'): string {
  const cur: Cursor = { lines: (markup ?? '').replace(/\r\n/g, '\n').split('\n'), i: 0 };
  // parseBlocks returns when it hits a terminator (`::end` / `::else`) or end-of-input.
  // At the TOP level any such terminator is UNMATCHED (no enclosing ::callout / ::if) —
  // e.g. a typo'd or stray marker. Skip it and keep rendering rather than silently
  // truncating the rest of the email. (Nested, correctly-matched terminators are consumed
  // by their opener before control ever returns here.)
  const parts: string[] = [];
  while (cur.i < cur.lines.length) {
    parts.push(parseBlocks(cur, vars, mode));
    if (cur.i >= cur.lines.length) break;
    const t = cur.lines[cur.i].trim();
    if (t === '::end' || t === '::else') { cur.i++; continue; } // drop the stray marker
    break; // defensive: parseBlocks only stops on a terminator or EOF
  }
  return parts.filter(Boolean).join('\n');
}

/**
 * Render a heading + body markup to inner HTML (NO brand envelope — the caller wraps it
 * with lib/email.ts `wrap()` so the FieldLogicHQ header/footer stays single-sourced on
 * the send path). Returns the `<h2>` heading followed by the rendered body.
 */
export function renderHeadingAndBody(p: {
  heading: string;
  body: string;
  vars?: EmailVars;
  mode?: TokenMode;
}): string {
  const vars = p.vars ?? {};
  const mode = p.mode ?? 'fill';
  const headingHtml = p.heading?.trim()
    ? `<h2 style="${H_STYLE}">${inline(p.heading, vars, mode)}</h2>`
    : '';
  const bodyHtml = renderMarkupToHtml(p.body, vars, mode);
  return `${headingHtml}\n${bodyHtml}`;
}
