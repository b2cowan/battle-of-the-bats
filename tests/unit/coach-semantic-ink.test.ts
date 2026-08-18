import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { readSource, stripComments } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * TEXT IN THE COACH PORTAL NAMES A ROLE, NOT A SHADE (design ruling 2026-08-18)
 *
 * ⚠⚠ **THE RULING THIS ENFORCES CAME OUT OF THE OWNER ASKING THE RIGHT QUESTION.** Told that a
 * contrast fix meant editing ~170 places, he asked *"why aren't these colors centralized… shouldn't
 * this be a very small set of colors that permeate across the app?"* — and he was right. The
 * semantic ladder already existed and was already theme-aware; it had simply LOST, 149 uses to
 * 1,605. The portal reached past its own design system nine times in ten.
 *
 * The cause is naming. `--white-45` means "white at 45%", so it inks meta TEXT *and* paints
 * hairlines, and neither can move without the other. A name that describes appearance cannot carry
 * a role, so every role sharing that value has to be edited by hand — forever, once per incident.
 *
 * So: **`color:` in this portal takes `--text-primary` / `--text-secondary` / `--text-tertiary`.**
 * The alpha ladder keeps borders, dividers, tints and fills, which is its actual job. Retuning a
 * tier is now one line in globals.css instead of ~900 edits, in BOTH themes at once.
 *
 * ⚠ This guard is the only thing standing between that and a slow return: every new raw-shade text
 * colour is a site the next ruling has to visit, and none of them announce themselves.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const COACH_SHEETS = [
  'app/[orgSlug]/coaches/coaches.module.css',
  ...readdirSync(path.join(import.meta.dirname, '..', '..', 'components', 'coaches'))
    .filter(f => f.endsWith('.module.css'))
    .map(f => `components/coaches/${f}`),
];

/**
 * The deliberate holdouts, and the reason each is allowed to stay on the ladder.
 *
 * ⚠ Every one renders PUNCTUATION — a separator dot, the middot between W-L-T, and the `·`/`—` that
 * stands in for "nothing here". They carry no information a coach reads, so the AA text floor does
 * not apply and brightening them would make three pieces of visual grammar shout. **This list is the
 * decision point:** adding a class here is claiming it renders no readable text, so say which glyph.
 */
const PUNCTUATION_EXEMPT = ['.statStripDot', '.wltSep', '.lineupZero'];

/** `color:` declarations only — never `border-color:`, `background-color:`, `outline-color:`. */
const RAW_INK = /(?<![-\w])color:\s*var\(--(white[0-9-]*|home-ink[a-z-]*|home-dim|fl-text|data-gray|blueprint-blue)\b/g;

describe('coach portal text names a role, not a shade', () => {
  for (const sheet of COACH_SHEETS) {
    it(`${sheet.split('/').pop()} inks only with the semantic tiers`, () => {
      // ⚠ CODE, not raw source — this file and the stylesheets it reads both discuss the retired
      // token names at length in order to record WHY they are retired. A guard that reads prose
      // proves the prose (tests/unit/_source-code.ts).
      const code = stripComments(readSource(sheet));
      const offenders = [...code.matchAll(RAW_INK)]
        .map(m => {
          // Walk back to the selector that opened this rule, so the failure names something a
          // person can find rather than a byte offset.
          const before = code.slice(0, m.index);
          const open = before.lastIndexOf('{');
          const sel = before.slice(before.lastIndexOf('}', open) + 1, open).trim().split('\n').pop()?.trim() ?? '?';
          return { sel, ink: m[1] };
        })
        // ⚠⚠ WHOLE CLASS TOKENS, never `sel.includes(exempt)` — the first version used substring
        // matching and a class merely CONTAINING an exempt name inherited its exemption. Proven,
        // not theorised: `.wltSepSubtitle { color: var(--white-45) }` — real readable text — was
        // waved straight through while this file reported 41/41 green. A guard that fails quiet is
        // worse than no guard, because it is also a claim that someone checked.
        .filter(o => {
          const classes = o.sel.match(/\.[A-Za-z][\w-]*/g) ?? [];
          return !classes.some(c => PUNCTUATION_EXEMPT.includes(c));
        });

      assert.deepEqual(offenders, [],
        'these rules ink text with a SHADE instead of a ROLE. Use --text-primary (body), '
        + '--text-secondary, or --text-tertiary (meta/label) — they are theme-aware, so one token '
        + 'edit retunes every screen in both themes. The --white-*/--home-* ladder is for borders, '
        + 'dividers and tints. If the rule renders punctuation rather than readable text, add its '
        + 'class to PUNCTUATION_EXEMPT and name the glyph.');
    });
  }

  it('the three tiers are all actually in use — a tier nobody reaches is a tier that rots', () => {
    const all = COACH_SHEETS.map(s => stripComments(readSource(s))).join('\n');
    for (const tier of ['--text-primary', '--text-secondary', '--text-tertiary']) {
      const n = [...all.matchAll(new RegExp(`(?<![-\\w])color:\\s*var\\(${tier}\\)`, 'g'))].length;
      assert.ok(n > 0, `${tier} is defined but no coach stylesheet inks with it`);
    }
  });
});
