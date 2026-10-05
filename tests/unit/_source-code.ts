/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * READING SOURCE AS CODE, NOT AS PROSE — shared by the guard tests that assert against source.
 *
 * Several invariants in this repo can only be pinned by reading a component's own text: they live
 * in module-level literals inside client components, and importing a `.tsx` that pulls in
 * next/navigation, lucide and a CSS module into the node runner costs far more than reading the
 * array back.
 *
 * ⚠⚠ **EVERY SUCH GUARD MUST STRIP COMMENTS FIRST, AND THIS HELPER EXISTS BECAUSE TWO OF THEM
 * LEARNED IT THE EXPENSIVE WAY.** A guard that reads raw text is wrong in BOTH directions:
 *   · it FAILS on a doc comment that merely describes the old design — including, both times, the
 *     comment the same commit added to explain why the old design is gone; and
 *   · far worse, it PASSES when someone deletes the code and leaves the paragraph explaining it.
 * A guard that reads prose proves the prose.
 *
 * ⚠ This file is `_source-code.ts`, not `source-code.test.ts`, so the runner's test-file glob does
 * not try to run a module with no tests in it.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const REPO = path.join(import.meta.dirname, '..', '..');

/**
 * A repo-relative file, read whole — with its line endings normalized to LF.
 *
 * ⚠ The repo runs `core.autocrlf=true`, so a Windows checkout (and any file a PowerShell
 * round-trip has touched) carries CRLF, while a file an agent's tool wrote carries LF. A guard
 * that anchors across a line break (`'\n  return ('`) therefore passed or failed on WHICH TOOL
 * LAST SAVED THE FILE, not on the code — found 2026-09-21 when a peer's save flipped the schedule
 * page to CRLF and the phone guard failed on a source it had passed an hour earlier. Normalizing
 * here, once, means no guard has to know.
 */
export const readSource = (rel: string): string =>
  readFileSync(path.join(REPO, rel), 'utf8').replace(/\r\n/g, '\n');

/**
 * `source` with its comments removed.
 *
 * ⚠ The line-comment pass is STRING-AWARE, not a regex. Anything before the `//` on that line which
 * opens an unclosed quote means we are inside a literal, so the line is left alone rather than
 * truncated. Guarding only on a preceding `:` (the first attempt) protected `https://` and nothing
 * else — a doubled slash in a path string or a regex literal would have silently eaten the rest of
 * the line, WEAKENING an assertion instead of breaking it. A guard that fails quiet is the thing
 * these files exist to stop.
 */
export function stripComments(source: string): string {
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, ' ');
  return withoutBlocks.split('\n').map(line => {
    for (let i = 0; i < line.length - 1; i++) {
      const c = line[i];
      if (c === '"' || c === "'" || c === '`') {
        const close = line.indexOf(c, i + 1);
        if (close === -1) return line;   // unterminated literal — do not guess
        i = close;
        continue;
      }
      if (c === '/' && line[i + 1] === '/') return line.slice(0, i);
    }
    return line;
  }).join('\n');
}

/** A repo-relative file, read as CODE — comments gone. The form a source guard should assert on. */
export const readCode = (rel: string): string => stripComments(readSource(rel));

/**
 * The body of ONE function in `code` (read it with `readCode` first), from `function name(` to the
 * next declaration at its own depth. A top-level function ends at the next top-level `function` or
 * `export default function`. ⚠ An INDENTED one (declared inside a component) ends at the next
 * declaration at ITS indentation — bounding it at column 0 swallowed the component's whole render,
 * so a word anywhere in the page satisfied a print-path guard (/review, 2026-09-17; first written in
 * practice-vocabulary-guard, promoted here 2026-09-24 so new guards stop copying a weaker version).
 */
export function functionBody(code: string, name: string): string {
  const start = code.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`function ${name} is gone — the guard reads it`);
  const lineStart = code.lastIndexOf('\n', start) + 1;
  const indent = code.slice(lineStart, start).match(/^\s*/)?.[0] ?? '';
  const rest = code.slice(start);
  const end = indent
    ? rest.search(new RegExp(`\\n${indent}(?:async )?function |\\n${indent}const \\w+ = \\(|\\n${indent}(?:if|return) `))
    : rest.search(/\n(?:async )?function |\nexport default function /);
  return end > 0 ? rest.slice(0, end) : rest;
}

/**
 * The body of ONE hook-bound callback — `const name = useCallback(` (or `useMemo(`) — up to the
 * next statement at ITS OWN indentation: the indentation is read from the declaration, never
 * assumed, for the reason `functionBody` gives above. Its own closing `}, [deps]);` line does not
 * end it. (Promoted 2026-10-05 from notification-open-in-place-guard, whose first copy hard-coded
 * two spaces.)
 */
export function callbackBody(code: string, name: string): string {
  const start = code.search(new RegExp(`const ${name} = use(?:Callback|Memo)\\(`));
  if (start < 0) throw new Error(`${name} is gone — the guard reads it`);
  const lineStart = code.lastIndexOf('\n', start) + 1;
  const indent = code.slice(lineStart, start).match(/^\s*/)?.[0] ?? '';
  const rest = code.slice(start);
  const end = rest.search(new RegExp(`\\n${indent}(?![\\s})\\]])`));
  return end > 0 ? rest.slice(0, end) : rest;
}

/**
 * A stylesheet split at its `@media (max-width: 640px)` blocks: `phone` is their bodies, joined — what
 * a phone-only rule must live inside — and `rest` is everything else, what a desk reads. Brace depth
 * is counted, so a nested block cannot end the query early. (Earlier guards carry their own copy of
 * the `phone` half; new guards import this one.)
 */
export function splitPhoneCss(css: string): { phone: string; rest: string } {
  const inside: string[] = [];
  let rest = '';
  let last = 0;
  const re = /@media \(max-width: 640px\) \{/g;
  for (let m = re.exec(css); m; m = re.exec(css)) {
    let depth = 1;
    let i = m.index + m[0].length;
    const from = i;
    for (; i < css.length && depth > 0; i++) { if (css[i] === '{') depth++; else if (css[i] === '}') depth--; }
    inside.push(css.slice(from, i - 1));
    rest += css.slice(last, m.index);
    last = i;
    re.lastIndex = i;
  }
  return { phone: inside.join('\n'), rest: rest + css.slice(last) };
}

/**
 * The declaration body of the FIRST rule whose selector is exactly `selector` — at the start of a line,
 * indented or not, so a rule inside an `@media` block is found too. Brace depth is counted, so a nested
 * block cannot cut it short. (Earlier guards carry their own `rule` / `block` copies; new guards import
 * this one.)
 */
export function cssRule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(^|\\n)[ \\t]*${escaped}\\s*\\{`).exec(css);
  if (!m) throw new Error(`no \`${selector} {\` rule in the stylesheet the guard reads`);
  const start = m.index + m[0].length;
  let depth = 1;
  let i = start;
  for (; i < css.length && depth > 0; i++) { if (css[i] === '{') depth++; else if (css[i] === '}') depth--; }
  if (depth !== 0) throw new Error(`\`${selector} {\` never closes in the stylesheet the guard reads`);
  return css.slice(start, i - 1);
}
