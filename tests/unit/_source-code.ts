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

/** A repo-relative file, read whole. */
export const readSource = (rel: string): string => readFileSync(path.join(REPO, rel), 'utf8');

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
