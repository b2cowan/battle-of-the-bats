/**
 * Palette-contrast guardrail — the fast half of the accessibility story.
 *
 * ⚠ WHY THIS IS A SCRIPT AND NOT JUST A TEST. The assertions live in
 * `tests/unit/warm-palette-contrast.test.ts`, where they belong. But nothing in this repo runs
 * `npm test` automatically: the pre-commit hook checks colour literals and date handling, and
 * `verify:changed` — the gate `/review` runs first — is a chain of `scripts/check-*.mjs`. A test
 * that nothing invokes is exactly the failure this whole exercise was about, so this wrapper puts
 * the palette assertions on the chain that actually runs.
 *
 * It runs ONLY that one file (~0.2s), deliberately, rather than the whole suite: `verify:changed`
 * is run constantly and has to stay fast, and an unrelated failing test elsewhere must never be
 * able to block a colour check.
 *
 * ⚠ SCOPE — this file proves TOKENS, not USAGES. `text-data-gray/40` is a different colour from
 * `--data-gray` and no assertion here has ever seen it; that gap let 22 sub-AA marketing usages
 * pass for months (found 2026-08-11). `scripts/check-text-contrast.mjs` now covers the static half
 * of usage, and `npm run check:layout` covers the rendered half — but only for the 28 coach
 * screens it lists. Three checks, three scopes; know which one you are relying on.
 *
 *   npm run check:contrast
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPEC = 'tests/unit/warm-palette-contrast.test.ts';

const res = spawnSync(
  process.execPath,
  ['--import', './tests/ts-resolver.mjs', '--test', SPEC],
  { cwd: ROOT, encoding: 'utf8' },
);

if (res.error) {
  console.error(`✗ Contrast guardrail could not run: ${res.error.message}`);
  process.exit(1);
}

const out = `${res.stdout ?? ''}${res.stderr ?? ''}`;

if (res.status !== 0) {
  console.error('✗ Palette contrast: a colour is below the WCAG AA floor.\n');
  // Surface the assertion bodies, which name the token, the ground and the measured ratio.
  for (const line of out.split('\n')) {
    if (/AssertionError|needs \d|differs between|collapsed|✖/.test(line)) console.error(`  ${line.trim()}`);
  }
  console.error('\n  A token is a value, not a suggestion — fix the palette rather than the screen.');
  console.error('  Usage (this string, on that painted background) is checked separately by');
  console.error('  `npm run check:layout` (renders real screens, needs a dev server) and by');
  console.error('  `npm run check:text-contrast` (opacity-modified utilities, static).');
  process.exit(1);
}

const passed = /ℹ pass (\d+)/.exec(out)?.[1] ?? '?';
console.log(`✓ Palette contrast: ${passed} assertion(s) — every text token clears AA on its grounds.`);
