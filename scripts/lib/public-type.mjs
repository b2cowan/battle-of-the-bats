/**
 * The public face's type signals — the counting half of `check-public-type.mjs`, kept apart so a unit test can
 * feed it a string (tests/unit/public-type-guard.test.ts). Pure: no file access, no process state.
 *
 * Why it is not `check-admin-type.mjs`'s counter: the public side has two things the admin does not. Its
 * emails build their styles as strings (`font-family:'Courier New'…` inside a template literal, not a
 * `fontFamily:` property), and its allowed places are a short list of NAMED roles that each exempt only the
 * signals that role may carry — an `eyebrow` may be in capitals but never in the typewriter face.
 */
import { blankCodeComments, blankCssComments } from './code-comments.mjs';

/** The three signals counted. Tracking (letter-spacing) is deliberately not one — see the header of
 *  scripts/check-public-type.mjs. */
export const KINDS = ['face', 'caps', 'heavy'];

/**
 * The allowed roles on the public side, each with the signals it may carry and the rule it comes from
 * (docs/agents/brand/VISUAL_IDENTITY.md, P1–P10). A `type-ok: <role>` marker exempts a line only for the
 * signals its role allows; any other signal on that line is still counted. `heavy` is allowed by no role:
 * the headline and the wordmark are 700 (P2, P9).
 */
export const ROLES = {
  wordmark: ['face', 'caps'],        // P9 — FIELD · LOGIC · HQ in the typewriter face
  'plan chip': ['face', 'caps'],     // P1 — the one typewriter label besides the wordmark
  eyebrow: ['caps'],                 // P3 — Inter 600, 12px, spaced, olive: capitals, never the typewriter face
  data: ['face'],                    // P1 — a figure or code a person reads as data (a price code)
};
const ROLE_NAMES = Object.keys(ROLES);

// A face keyword inside a font declaration. The patterns run over the whole file, not line by line, so a
// stack broken across lines is one declaration; each match is credited to the line it STARTS on.
const FACE_WORDS = '(?:font-data|font-mono|monospace|courier|plex mono)';
// A declaration's value ends at `;`, `}` or a tag's `>` (an email's `style="font-family:Arial">Courier…`), and
// the scan is bounded so a long run with no face word cannot make it quadratic.
const CSS_BODY = '[^;}<>`]{0,300}?';
const CSS = {
  face: [
    new RegExp(`(?<![-\\w])font-family\\s*:${CSS_BODY}${FACE_WORDS}`, 'gi'),
    new RegExp(`(?<![-\\w])font\\s*:${CSS_BODY}${FACE_WORDS}`, 'gi'),
  ],
  caps: [/(?<![-\w])text-transform\s*:\s*uppercase/gi],
  heavy: [/(?<![-\w])font-weight\s*:\s*(?:800|900)\b/gi, /(?<![-\w])font\s*:\s*(?:italic\s+)?(?:800|900)\b/gi],
};
const TS = {
  // A comma followed by `name:` starts the next property, so the value stops there.
  face: [new RegExp(`(?<![-\\w])fontFamily\\s*:\\s*(?:(?!,\\s*[A-Za-z_]+\\s*:)[^}]){0,300}?${FACE_WORDS}`, 'gi')],
  caps: [/(?<![-\w])textTransform\s*:\s*['"`]uppercase/gi],
  heavy: [/(?<![-\w])fontWeight\s*:\s*['"`]?(?:800|900)\b/g],
};
// ⚠ THE LETTERING A CLASS NAME CARRIES (S4, 2026-10-23). A page can set the typewriter face without a single
// `font-family` in its own code: a Tailwind utility in its markup (`font-mono`, `uppercase`, `font-black`) or a GLOBAL
// class `app/globals.css` gives the face to (`hud-label`, `btn-data`, `badge`, `form-label`). Neither was counted
// at S1, so a page could read as clean with the typewriter still on screen. In a .tsx file, every string literal is
// read as a class list and these tokens are counted. A token preceded by `-` is a custom property (`--font-mono`),
// not a class; a Tailwind variant prefix (`md:uppercase`) still counts.
const CLASS_TOKENS = {
  face: /(?<![-\w])(?:font-mono|hud-label|btn-data|badge|form-label)(?![-\w])/g,
  caps: /(?<![-\w])uppercase(?![-\w])/g,
  heavy: /(?<![-\w])font-(?:black|extrabold)(?![-\w])/g,
};
// A string literal: "…", '…' or `…`, matched leftmost-first so a quote inside another string is part of it. A template
// may span lines; its `${…}` holes are blanked below, apart from the strings inside them.
// ⚠ Known limits (review 2026-10-23), acceptable for a ratchet that only moves when a count changes: an apostrophe in
// JSX text can pair with a later quote; a hole with nested braces or a nested template is not blanked exactly; the
// global classes count as the face only (`.badge` also sets capitals). A wrong count shows up as a changed number,
// and `type-ok: <role>` or Inter is the way through.
const STRING_LITERAL = /"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\[\s\S]|[^`\\])*`/g;

// Blanking comments is the slow part. Comments can only REMOVE hits, and none of these words can be created
// by blanking, so a file holding none of them cannot have a hit and skips it.
const PREFILTER = /uppercase|font-data|font-mono|monospace|courier|plex mono|\b(?:800|900)\b|hud-label|btn-data|badge|form-label|font-black|font-extrabold/i;

// A TS/TSX file holds both shapes: inline style objects (camel) and CSS inside strings (an email's styles).
const SOURCE = Object.fromEntries(KINDS.map((k) => [k, [...CSS[k], ...TS[k]]]));

/** Blank comments for a file's kind. HTML comments go too, then the CSS ones inside its `<style>`. */
function blank(file, raw) {
  if (file.endsWith('.css')) return blankCssComments(raw);
  if (file.endsWith('.html')) return blankCssComments(raw.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' ')));
  return blankCodeComments(raw);
}

/** The role named by a `type-ok: <role>` marker on `line`, `null` when there is no marker, `''` when it names none we know. */
export function markerRole(line) {
  const m = /(?<![\w-])type-ok\s*:\s*(.*)/i.exec(line ?? '');
  if (!m) return null;
  const rest = m[1].toLowerCase();
  return ROLE_NAMES.find((r) => rest.startsWith(r) && !/[a-z]/.test(rest[r.length] ?? '')) ?? '';
}

/**
 * The unmarked type signals in one file's source.
 * @returns {{ c: Record<string, number>, lines: number[], badRoles: number[] }}
 *   `c` the counts by signal; `lines` where they are; `badRoles` lines whose `type-ok:` names no allowed role.
 */
export function countsOfSource(file, raw) {
  const c = {};
  const lines = [];
  const badRoles = [];
  if (!PREFILTER.test(raw)) return { c, lines, badRoles };
  const rules = file.endsWith('.css') || file.endsWith('.html') ? CSS : SOURCE;
  const code = blank(file, raw);
  const codeLines = code.split('\n');
  const rawLines = raw.split('\n');
  // The line each offset falls on: `starts[n]` is where line n begins.
  const starts = [0];
  for (let at = code.indexOf('\n'); at >= 0; at = code.indexOf('\n', at + 1)) starts.push(at + 1);
  const lineOf = (at) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= at) lo = mid; else hi = mid - 1; }
    return lo;
  };
  const hits = new Map(); // line index → { signal: count }
  const hit = (k, at) => {
    const line = lineOf(at);
    const here = hits.get(line) ?? {};
    here[k] = (here[k] ?? 0) + 1;
    hits.set(line, here);
  };
  for (const k of KINDS) {
    for (const re of rules[k]) {
      for (const m of code.matchAll(re)) hit(k, m.index);
    }
  }
  if (file.endsWith('.tsx')) {
    for (const s of code.matchAll(STRING_LITERAL)) {
      // The value of a style property the patterns above already count (`textTransform: 'uppercase'`) is not a class.
      if (/(?:textTransform|fontFamily|fontWeight)\s*:\s*$/.test(code.slice(Math.max(0, s.index - 40), s.index))) continue;
      // A template's `${…}` holes are code, not class text: a variable named `badge` is not the global class. Only the
      // strings INSIDE a hole (`${on ? 'uppercase' : ''}`) are class text; the rest is blanked, newlines kept.
      const text = s[0].startsWith('`') ? s[0].replace(/\$\{[^{}]*\}/g, (hole) =>
        hole.replace(/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|[^\n]/g, (m) => (m.length > 1 ? m : ' '))) : s[0];
      for (const k of KINDS) {
        for (const m of text.matchAll(CLASS_TOKENS[k])) hit(k, s.index + m.index);
      }
    }
  }
  for (const i of [...hits.keys()].sort((a, b) => a - b)) {
    // A marker covers its own line. One standing alone on the line above covers the next line too; a marker
    // trailing another declaration covers only that declaration.
    const aboveStandsAlone = i > 0 && codeLines[i - 1].trim() === '';
    const role = markerRole(rawLines[i]) ?? (aboveStandsAlone ? markerRole(rawLines[i - 1]) : null);
    if (role === '') badRoles.push(i + 1);
    const allowed = role ? ROLES[role] : [];
    const left = Object.entries(hits.get(i)).filter(([k]) => !allowed.includes(k));
    if (!left.length) continue;
    for (const [k, n] of left) c[k] = (c[k] ?? 0) + n;
    lines.push(i + 1);
  }
  return { c, lines, badRoles };
}

/**
 * The ratchet: what rose above `base` and what fell below it. A file missing from `base` holds none.
 * @param {Record<string, Record<string, number>>} now
 * @param {Record<string, Record<string, number>> | null} base
 */
export function compareToBaseline(now, base) {
  const rises = [];
  const drops = [];
  for (const f of new Set([...Object.keys(now), ...Object.keys(base ?? {})])) {
    const c = now[f] ?? {};
    const b = base?.[f];
    const over = KINDS.filter((k) => (c[k] ?? 0) > (b?.[k] ?? 0));
    if (over.length) rises.push({ f, c, b, over });
    if (b && KINDS.some((k) => (c[k] ?? 0) < (b[k] ?? 0))) drops.push({ f, c, b });
  }
  return { rises, drops };
}
