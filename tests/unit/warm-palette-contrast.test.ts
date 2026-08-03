/**
 * The warm palette must be legible by construction.
 *
 * ⚠ WHY THIS EXISTS. On 2026-08-02 the portal's muted ink (`--home-dim`) was found to be below the
 * WCAG AA floor on every ground it lands on — 3.83:1 on a white card, 2.93:1 on the bottom nav —
 * in 1,835 places. It had been there for months, and the colour-literal guardrail could not see it:
 * every file used the token CORRECTLY. The value itself was the defect.
 *
 * Worse, three separate sessions had already hit it and patched around it locally (forcing a darker
 * ink on the system screens and the Team HQ "not switched on" line, hand-darkening the red on the
 * crash screen). Each noted the failing ratio and moved on. **A token that three surfaces privately
 * work around is a broken token, not three unlucky surfaces.**
 *
 * The browser sweep (`npm run check:layout`) catches this too, but it needs a running dev server, a
 * signed-in session and twenty minutes, so it runs deliberately rather than always. This test is the
 * cheap half: the palette's values and the grounds they sit on are both known numbers, so whether a
 * token CAN be read is arithmetic — no browser required. It runs with every other unit test.
 *
 * Division of labour, so neither is mistaken for the other:
 *   · THIS test asks "can this colour ever be legible on that ground?" — a DEFINITION question.
 *   · the sweep asks "is this actual string legible on what is actually painted behind it?" —
 *     a USAGE question, including alpha compositing this test cannot see.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..', '..');
const COACH_PALETTE = path.join(ROOT, 'app/globals.css');
const CONSUMER_PALETTE = path.join(ROOT, 'components/consumer/warmTheme.module.css');

// ── WCAG 2.1 relative luminance and contrast ─────────────────────────────────
type RGB = readonly [number, number, number];

function parseHex(hex: string): RGB {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]: RGB): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a: RGB, b: RGB): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/**
 * Pull `--home-*: #RRGGBB` out of a stylesheet, first definition wins.
 *
 * ⚠ Reads the REAL source rather than restating the palette here. A test carrying its own copy of
 * the values would keep passing after someone edited the stylesheet, which is the one thing it must
 * never do. The dark-theme gates re-declare these tokens as `var(--something)` rather than literals,
 * so the hex-only pattern skips them and lands on the warm block.
 */
function readPalette(file: string): Record<string, RGB> {
  const css = readFileSync(file, 'utf8');
  const out: Record<string, RGB> = {};
  for (const m of css.matchAll(/--home-([a-z-]+):\s*(#[0-9A-Fa-f]{6})\b/g)) {
    if (!(m[1] in out)) out[m[1]] = parseHex(m[2]);
  }
  return out;
}

const AA_NORMAL = 4.5;

/**
 * The grounds text is painted on.
 *
 * ⚠ These are stated, not parsed, and the reason matters: the bottom nav's surface is a translucent
 * bar composited over whatever scrolls beneath it, so its EFFECTIVE colour only exists once a
 * browser has resolved it. The value below is what `npm run check:layout` measured on the rendered
 * page. If the nav's own background is ever restyled, the sweep is what will catch it — this test
 * cannot, and should not pretend to.
 */
const GROUNDS: Record<string, RGB> = {
  'white card': parseHex('#FFFFFF'),
  'cream paper': parseHex('#F8F4ED'),
  'tinted panel': parseHex('#EEEFE8'),
  'bottom nav': parseHex('#E4E1DA'),
};

/**
 * Tokens that carry PROSE, and therefore have to clear AA on every ground in the product.
 * These are the three-step ink hierarchy: primary, secondary, muted.
 */
const PROSE_INKS = ['ink', 'ink-soft', 'dim'] as const;

/**
 * Status accents. They also render as text — amber 17 times, blue 9, win 7, at the time of writing
 * — but on cards and paper rather than on the tinted panels or the nav, which the browser sweep
 * confirms by finding no real failure from any of them. So they are held to the two grounds they
 * actually land on, and the sweep remains the authority for where they really appear.
 */
const ACCENTS = ['olive', 'live', 'amber', 'blue', 'win'] as const;
const ACCENT_GROUNDS = ['white card', 'cream paper'] as const;

/**
 * Known, argued shortfalls. An entry without a reason is not an exemption — the reason IS the
 * exemption, exactly as `token-exempt` works in the colour-literal guardrail. Keep this list at
 * zero where you can; every entry is debt someone has to re-argue later.
 */
const ACCEPTED: Record<string, string> = {
  'amber on cream paper':
    '4.49:1 — one hundredth under the floor. --home-amber is a status accent ("upcoming"), and the ' +
    'browser sweep finds no instance of it rendering as text on the paper ground. Revisit the moment ' +
    'one appears, or when the amber is next touched for any other reason.',
};

// ── the tests ────────────────────────────────────────────────────────────────

describe('warm palette — legible by construction', () => {
  const coach = readPalette(COACH_PALETTE);
  const consumer = readPalette(CONSUMER_PALETTE);

  it('the stylesheet actually yielded a palette', () => {
    // Guards against the parse silently returning {} after a refactor, which would make every
    // assertion below vacuously true — a green test that checks nothing is worse than no test.
    for (const name of [...PROSE_INKS, ...ACCENTS]) {
      assert.ok(coach[name], `--home-${name} not found in app/globals.css — has the palette moved?`);
      assert.ok(consumer[name], `--home-${name} not found in the consumer warm theme`);
    }
  });

  it('the two palette copies agree', () => {
    // They are declared mirrors. Letting them drift is how one shell gets an accessibility fix and
    // the other does not (design decision 2026-08-02, R3).
    for (const name of [...PROSE_INKS, ...ACCENTS]) {
      assert.deepEqual(
        consumer[name],
        coach[name],
        `--home-${name} differs between the coach and consumer palettes — they must move together`,
      );
    }
  });

  it('every prose ink clears AA on every ground', () => {
    const failures: string[] = [];
    for (const name of PROSE_INKS) {
      for (const [groundName, ground] of Object.entries(GROUNDS)) {
        const ratio = contrast(coach[name], ground);
        if (ratio < AA_NORMAL && !ACCEPTED[`${name} on ${groundName}`]) {
          failures.push(`--home-${name} on ${groundName}: ${ratio.toFixed(2)}:1 (needs ${AA_NORMAL}:1)`);
        }
      }
    }
    assert.deepEqual(failures, [], `Text colours below the AA floor:\n  ${failures.join('\n  ')}`);
  });

  it('every status accent clears AA on the grounds it lands on', () => {
    const failures: string[] = [];
    for (const name of ACCENTS) {
      for (const groundName of ACCENT_GROUNDS) {
        const ratio = contrast(coach[name], GROUNDS[groundName]);
        if (ratio < AA_NORMAL && !ACCEPTED[`${name} on ${groundName}`]) {
          failures.push(`--home-${name} on ${groundName}: ${ratio.toFixed(2)}:1 (needs ${AA_NORMAL}:1)`);
        }
      }
    }
    assert.deepEqual(failures, [], `Accent colours below the AA floor:\n  ${failures.join('\n  ')}`);
  });

  it('the ink hierarchy stays three visibly distinct steps', () => {
    // The reason a well-meaning "make it quieter" change is dangerous: the fix for contrast is to
    // darken, and darkening far enough collapses muted into secondary, at which point the palette
    // has contrast but no hierarchy. Measured against the white card.
    const card = GROUNDS['white card'];
    const ink = contrast(coach['ink'], card);
    const soft = contrast(coach['ink-soft'], card);
    const dim = contrast(coach['dim'], card);

    assert.ok(ink > soft, `--home-ink (${ink.toFixed(2)}) must out-contrast --home-ink-soft (${soft.toFixed(2)})`);
    assert.ok(soft > dim, `--home-ink-soft (${soft.toFixed(2)}) must out-contrast --home-dim (${dim.toFixed(2)})`);
    assert.ok(
      soft - dim >= 1.5,
      `--home-dim (${dim.toFixed(2)}:1) is too close to --home-ink-soft (${soft.toFixed(2)}:1) — ` +
        `muted has collapsed into secondary and the hierarchy is gone`,
    );
  });

  it('the light glyph on a live-red fill is legible', () => {
    // The red is used as a BADGE FILL as well as text. Darkening it for text only helps here, but
    // the pairing is asserted so a future lightening cannot quietly break the badges instead.
    const onLive = consumer['on-live'];
    assert.ok(onLive, '--home-on-live not found');
    const ratio = contrast(onLive, coach['live']);
    assert.ok(
      ratio >= AA_NORMAL,
      `--home-on-live on a --home-live fill is ${ratio.toFixed(2)}:1 (needs ${AA_NORMAL}:1)`,
    );
  });
});
