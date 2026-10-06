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
  // ⚠ ADDED 2026-08-03. The four grounds above were the whole list, and §8 signed off the
  // --home-dim raise against them. The browser sweep then found real AA failures on grounds this
  // test had never heard of — chips, table rows, status pills, the help hub's link ground. The
  // test was not wrong; its GROUND LIST was incomplete, which is the cheaper thing to fix than any
  // individual finding. Each value below is what the sweep measured on the rendered page.
  // Was #E2DDD4 — the hairline token used as a fill, and the one ground --home-dim failed on.
  // The RULING moved the surface (2026-08-03): --home-fill at 0.08 gives #EAE5DC on paper.
  'chip surface': parseHex('#EAE5DC'),   // roster "Deactivate", tryout count chips
  'table row': parseHex('#E7E5D8'),      // dues table cells
  'status pill': parseHex('#E1E5D6'),    // roster "Active"
  'warm chip': parseHex('#F1E8DA'),      // announcements empty-state chip
  'help link row': parseHex('#EDEFEC'),  // help hub topic links
  // ⚠ ADDED 2026-09-03, and it is the SECOND time the sweep has taught this test a ground.
  // The money tabs' card rows at 361/390 are DARKER than every ground above, and --home-dim
  // measured 4.26:1 on one (the Club tab's "Facilities ·" filing label). The gate had never
  // seen it because no fixture had put a FILED bill on that screen until a reseed did — a green
  // check over data that could not fail. The token moved to #655E57; this line is what stops it
  // drifting back. ⚠ THE LIST IS STILL NOT THE PRODUCT: add the next ground the sweep measures.
  'money card row': parseHex('#E0DBC9'), // dues/club/expenses rows once they become cards
  // ⚠ DARKER STILL, and found only because a PORTAL-WIDE sweep ran rather than a scoped one: the
  // first attempt at the 2026-09-03 correction cleared the card row above and still measured
  // 4.46:1 here. Chasing the ground a finding names, one finding at a time, is the trap.
  'empty-state chip': parseHex('#D9D8C5'), // development "no readings yet", and its siblings
  // ⚠ ADDED 2026-09-03 by the coach-notifications review — the THIRD ground the sweep has taught
  // this test. An unread notification row is the olive accent at 6% over a white card; the feed's
  // timestamps and day headers sit on it. The sweep measured them at 1.43:1 because they were
  // painted with the HAIRLINE token (--white-30 → --home-line-strong in warm) — a token defect, not
  // a ground defect — but the ground was still unheld, and the fix moves that text onto --home-dim,
  // which must now clear it. Lighter than paper, so it cannot fail alone; held so it stays measured.
  'unread row tint': parseHex('#F4F5F1'), // the "See all" feed + bell panel, unread rows
  // ⚠ ADDED 2026-09-25 — THE ADMIN JOINS THIS PALETTE (Admin Design Continuity slice 1). The kit
  // frame paints the portal's own grounds (paper, the white card, the bar, the olive-tinted active
  // row — all held above), plus ONE the coaches portal never does: a CHOSEN filter chip (the
  // portal's `.clubChipOn`, olive at 16%) sitting on the PAPER page rather than on a white card —
  // the admin's lens rows live on the page. Computed (olive over #F8F4ED); the switch-on sweep of
  // Families measured no failure on it. The olive clears it at 4.66:1, the thinnest margin the
  // accent has anywhere, so it is held here before anything nudges either colour.
  'chosen chip on paper': [222, 221, 204] as RGB, // admin Families lenses, switch on
};

/**
 * Tokens that carry PROSE, and therefore have to clear AA on every ground in the product.
 * These are the three-step ink hierarchy: primary, secondary, muted.
 */
const PROSE_INKS = ['ink', 'ink-soft', 'dim'] as const;

/**
 * Status accents. They also render as text — amber 17 times, blue 9, win 7, at the time of writing.
 * The sweep remains the authority for where they really appear.
 */
const ACCENTS = ['olive', 'live', 'amber', 'blue', 'win'] as const;
/**
 * ⚠ THE CLAIM ABOVE WAS FALSIFIED 2026-08-03, and the list is now evidence-driven. "The browser
 * sweep confirms by finding no real failure from any of them" was true only because the sweep could
 * not SEE the tinted grounds — its contrast rule declined on the portal's gradient page ground
 * (plan §10.1). Once un-blinded it found accents rendering as text on exactly the panels this list
 * said they never touched: the win green on a status pill and a table row, the amber on a warm chip,
 * the blue on the help hub's link row. Held to those grounds too, now that they are known.
 *
 * ⚠ PER ACCENT, not one shared list. Holding every accent to every ground cross-produces
 * combinations that do not exist in the product (amber on a status pill, blue on a table row) and
 * would red the shared gate on speculation — the same noise the original two-ground list was right
 * to avoid. Each entry below is a ground the sweep OBSERVED that accent rendering as text on.
 */
const ACCENT_GROUNDS: Record<(typeof ACCENTS)[number], readonly string[]> = {
  olive: ['white card', 'cream paper', 'chosen chip on paper'],
  live:  ['white card', 'cream paper'],
  amber: ['white card', 'cream paper', 'warm chip'],
  blue:  ['white card', 'cream paper', 'help link row'],
  win:   ['white card', 'cream paper', 'status pill', 'table row'],
};

/**
 * Known, argued shortfalls. An entry without a reason is not an exemption — the reason IS the
 * exemption, exactly as `token-exempt` works in the colour-literal guardrail. Keep this list at
 * zero where you can; every entry is debt someone has to re-argue later.
 */
const ACCEPTED: Record<string, string> = {
  // ⚠ EMPTY ON PURPOSE, and worth keeping that way. Five entries lived here for a few hours on
  // 2026-08-03 while the design call was outstanding; the ruling DELETED them rather than extending
  // them — the three accents were darkened and the chip surface moved. The sixth, a long-standing
  // 'amber on cream paper' at 4.49:1, went with them: it was accepted on the argument that no amber
  // text rendered on paper, which the un-blinded sweep then disproved. An acceptance whose premise
  // is "the checker has never seen it" is only as good as the checker's eyesight.
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

  it('the page base under a warm portal is the paper, and its copy agrees with --home-paper', () => {
    // <body> sits outside the marker that declares --home-paper, so globals.css paints it with a copy.
    // Without it the strip reserved for the bottom nav is near-black, and the frosted bar turns grey at
    // the end of every page (owner, 2026-10-06, the §269 walk).
    const css = readFileSync(COACH_PALETTE, 'utf8');
    const base = /html\[data-user-theme="warm"\]:has\(\[data-coach-warm-enabled\]\) body \{ background: (#[0-9a-f]{6}); \}/i.exec(css);
    assert.ok(base, 'the warm page-base rule is gone from app/globals.css');
    const paper = readSelectorTokens(COACH_PALETTE, 'html[data-user-theme="warm"] [data-coach-warm-enabled]')['--home-paper'];
    assert.ok(paper, '--home-paper not found in the warm block');
    assert.deepEqual(parseHex(base[1]), parseHex(paper), 'the page base and --home-paper must move together');
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
      for (const groundName of ACCENT_GROUNDS[name]) {
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

// ══════════════════════════════════════════════════════════════════════════════════════════════
// THE ADMIN'S DARK PALETTE (Admin Design Continuity, slice 0, 2026-09-25)
// ══════════════════════════════════════════════════════════════════════════════════════════════
//
// ⚠ WHY A SECOND PALETTE LIVES IN A FILE CALLED "WARM". This file is the one `npm run
// check:contrast` runs on every `verify:changed`, and a test nothing runs is the failure it exists
// to prevent. The admin has never been held to ANY contrast check: it is dark-only today, and the
// block above holds the warm palette alone. Phase 1 moves the admin onto the warm palette too
// (slice 1 adds its grounds to the block above); THIS block holds the dark one it keeps, which is
// the palette every admin screen wears until the release day — and the one an account set to Dark
// keeps after it.
//
// ⚠ THE INKS ARE READ, NOT RESTATED — from every top-level `:root {}` block of the stylesheet, in
// source order, the LAST definition winning (the cascade's own rule; later `:root` blocks alias
// tokens), `var()` followed to its end. A translucent ink (`--white-40`) is not a colour until it is
// painted on something, so each is composited over each ground before it is judged.
//
// ⚠ THE GROUNDS ARE MEASURED, for the reason the warm block gives: what is painted behind a line of
// text only exists once a browser has resolved it. Each value below is the composited colour behind
// real admin text, read from every admin screen at 1440 and 390 by the slice-0 probe.

type Ink = { rgb: RGB; alpha: number };

/** Declarations of every top-level block whose selector list contains `selector` (last one wins). */
function readSelectorTokens(file: string, selector: string): Record<string, string> {
  const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const decls: Record<string, string> = {};
  let depth = 0;
  let sel = '';
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === '{') {
      if (depth === 0) { sel = css.slice(start, i).trim(); start = i + 1; }
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        // A selector LIST counts when any of its members is the one asked for — `:root, html { … }`
        // would otherwise be skipped in silence and a later override read as the stale value (review
        // finding, 2026-09-25: a wrong-but-plausible number is the worst thing this can return).
        if (sel.split(',').some((part) => part.trim() === selector)) {
          for (const m of css.slice(start, i).matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) decls[m[1]] = m[2].trim();
        }
        start = i + 1;
      }
    } else if (ch === ';' && depth === 0) {
      start = i + 1;
    }
  }
  return decls;
}

function readRootTokens(file: string): Record<string, string> {
  return readSelectorTokens(file, ':root');
}

function resolveInk(decls: Record<string, string>, name: string, seen = new Set<string>()): Ink | null {
  if (seen.has(name)) return null;
  seen.add(name);
  const v = decls[name];
  if (!v) return null;
  if (/^#[0-9a-f]{6}$/i.test(v)) return { rgb: parseHex(v), alpha: 1 };
  const rgba = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/i);
  if (rgba) return { rgb: [+rgba[1], +rgba[2], +rgba[3]], alpha: rgba[4] === undefined ? 1 : +rgba[4] };
  const ref = v.match(/^var\(\s*(--[a-z0-9-]+)\s*(?:,[^)]*)?\)$/i);
  return ref ? resolveInk(decls, ref[1], seen) : null;
}

/** An ink as it is actually seen: painted over its ground. */
function over({ rgb, alpha }: Ink, ground: RGB): RGB {
  return [0, 1, 2].map((i) => Math.round(rgb[i] * alpha + ground[i] * (1 - alpha))) as unknown as RGB;
}

/** Every dark token the admin paints TEXT with: `color:` in admin CSS with 5+ uses, plus `--white-25`,
 *  which the sweep found as the More menu's group labels (2026-09-25). */
const ADMIN_INKS = [
  '--fl-text', '--white', '--white-90', '--white-85', '--white-80', '--white-75', '--white-70', '--white-60',
  '--white-55', '--white-50', '--white-45', '--white-40', '--white-35', '--white-30', '--white-25', '--white-20', '--data-gray',
  '--logic-lime', '--warning', '--warning-light', '--danger', '--danger-light', '--success', '--success-light',
  '--info', '--blueprint-blue', '--primary-light',
] as const;

/**
 * ⚠ RECORDED DEBT, NOT ACCEPTANCE — and deliberately NOT the `ACCEPTED` list above, whose every
 * entry is an argued decision. These are the dark admin inks that fall under AA on their WORST
 * ground, recorded at slice 0 so the admin entered the check without being failed on day one for a
 * palette nobody had argued yet (owner, 2026-09-25: "debt, reasons only if argued"). It is a RATCHET:
 * an ink that gets worse fails, an ink that starts passing fails until its line is deleted, and an
 * ink not listed here fails outright.
 * ⚠ RE-MEASURED AT THE RELEASE (2026-09-28): the admin now paints on the KIT's Dark grounds
 * (`KIT_DARK_GROUNDS` below — the old console's six grounds retired with the switch), so each number
 * is the worst ratio on those, ratcheted down from slice 0's (in brackets where it moved). These inks
 * are the legacy stylesheet's raw `color:` values; the switch-on sweep found no Dark contrast failure
 * on a rendered admin screen (the kit's rules cover every visible use), and Part B's folds retire them.
 */
const ADMIN_DARK_DEBT: Record<string, number> = {
  // The faint whites the admin uses as secondary text — 227+ `color:` uses at 30–45% alone. The
  // layout sweep measures the same thing on rendered screens (40% white at 3.81:1 on a card).
  '--white-45': 4.35,        // (4.16)
  '--white-40': 3.73,        // (3.59)
  '--white-35': 3.15,        // (3.11)
  '--white-30': 2.61,
  '--white-25': 2.13,        // the phone More menu's group labels
  '--white-20': 1.77,
  '--danger': 4.39,          // (3.81) the red as TEXT; --danger-light is the dark theme's legible red
  '--info': 4.49,            // (3.90)
  // ⚠ The platform navy used as a TEXT colour (26 `color:` uses in admin CSS): navy on near-black.
  // Found by this block on its first run — no check had ever held it.
  '--blueprint-blue': 1.59,  // (1.39)
};

describe('admin dark palette — held from its first day in the check', () => {
  const decls = readRootTokens(COACH_PALETTE);

  it('the stylesheet yielded every admin ink and the grounds are stated', () => {
    for (const name of ADMIN_INKS) {
      assert.ok(resolveInk(decls, name), `${name} did not resolve from the :root blocks of app/globals.css — has it moved?`);
    }
    assert.ok(Object.keys(KIT_DARK_GROUNDS).length > 0, 'no admin grounds — every assertion below would be vacuous');
  });

  it('no admin ink falls under AA on any admin ground, beyond its recorded debt', () => {
    const problems: string[] = [];
    for (const name of ADMIN_INKS) {
      const ink = resolveInk(decls, name)!;
      let worst = Infinity;
      let worstGround = '';
      for (const [g, rgb] of Object.entries(KIT_DARK_GROUNDS)) {
        const r = contrast(over(ink, rgb), rgb);
        if (r < worst) { worst = r; worstGround = g; }
      }
      const debt = ADMIN_DARK_DEBT[name];
      if (worst < AA_NORMAL && debt === undefined) {
        problems.push(`${name} on ${worstGround}: ${worst.toFixed(2)}:1 (needs ${AA_NORMAL}:1) — NEW`);
      } else if (debt !== undefined && worst >= AA_NORMAL) {
        problems.push(`${name} now clears AA (${worst.toFixed(2)}:1) — delete its ADMIN_DARK_DEBT line; the ratchet tightens`);
      } else if (debt !== undefined && worst < debt - 0.01) {
        problems.push(`${name} on ${worstGround}: ${worst.toFixed(2)}:1, WORSE than its recorded ${debt.toFixed(2)}:1`);
      }
    }
    assert.deepEqual(problems, [], `Admin dark inks:\n  ${problems.join('\n  ')}`);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
//
// ⚠ THE ADMIN ON THE KIT, IN DARK — the look an organizer who chose Dark gets on release day (Admin
// Design Continuity slice 6, 2026-09-28). The block above holds the legacy stylesheet's raw inks (as debt,
// measured on these grounds since the release); the warm block holds the kit in Warm. This holds the kit's DARK inks — the portal's
// text tiers and the dark gate's `--home-dim` — on the grounds the kit actually paints in Dark, MEASURED
// switch-on by `.probe/6/grounds.mjs` (20 admin + volunteer screens × 1440 + 390; ~99% of text sits on
// these). NO DEBT: the switch-on sweep of every admin screen found no Dark contrast failure outside the
// public previews once the two shared defects were fixed (owner, 2026-09-27: "fix both, both portals" —
// `--home-dim` 45% → 50% white). An ink that falls under AA here fails outright.
// ⚠ Per-ink grounds, as the warm block's accents are held: the prose tiers on every text ground; the
// state inks on the card and the page, where their words sit (a tinted chip's own ink is the sweep's).

const KIT_DARK_GATE = 'html[data-user-theme="dark"] [data-coach-warm-enabled]';

/** Measured 2026-09-28, switch on, Dark (share of text runs in brackets). */
const KIT_DARK_GROUNDS: Record<string, RGB> = {
  'kit card': parseHex('#111827'),        // --card-bg: every card, window and table (63.5%)
  'kit page': parseHex('#0A0A0A'),        // --pitch-black under the 7% grid (14%)
  'phone bar': parseHex('#0D111A'),       // the bar and More sheet at 390 (2.4%)
  'chosen chip': parseHex('#131E39'),     // --home-olive-soft over the card: chosen rows, tabs, chips (2.2%)
  'kit panel': parseHex('#0E141D'),       // a recessed band, measured on the ledger and Families
  'navy row': parseHex('#121B31'),        // a navy-tinted row, measured on the club hub (17 screen-widths)
};
const KIT_DARK_PROSE = ['--text-primary', '--text-secondary', '--text-tertiary', '--home-dim'] as const;
const KIT_DARK_STATE = ['--success-light', '--warning-light', '--danger-light', '--info-light'] as const;

describe('admin kit dark palette — the release-day Dark look, no debt', () => {
  const root = readRootTokens(COACH_PALETTE);
  const gate = readSelectorTokens(COACH_PALETTE, KIT_DARK_GATE);
  // The dark gate's own definitions sit over :root's (the gate is where `--home-dim` lives).
  const decls = { ...root, ...gate };

  it('the dark gate and every kit ink were read', () => {
    assert.ok(Object.keys(gate).length > 10, `the dark gate "${KIT_DARK_GATE}" yielded no tokens — has its selector moved?`);
    for (const name of [...KIT_DARK_PROSE, ...KIT_DARK_STATE]) {
      assert.ok(resolveInk(decls, name), `${name} did not resolve for the kit's Dark palette`);
    }
  });

  it('every prose tier clears AA on every kit ground, and every state ink on the card and the page', () => {
    const problems: string[] = [];
    const check = (name: string, grounds: string[]) => {
      const ink = resolveInk(decls, name)!;
      for (const g of grounds) {
        const r = contrast(over(ink, KIT_DARK_GROUNDS[g]), KIT_DARK_GROUNDS[g]);
        if (r < AA_NORMAL) problems.push(`${name} on ${g}: ${r.toFixed(2)}:1 (needs ${AA_NORMAL}:1)`);
      }
    };
    for (const name of KIT_DARK_PROSE) check(name, Object.keys(KIT_DARK_GROUNDS));
    for (const name of KIT_DARK_STATE) check(name, ['kit card', 'kit page']);
    assert.deepEqual(problems, [], `Kit Dark inks:\n  ${problems.join('\n  ')}`);
  });

  it('a white digit on the danger FILL clears AA in Dark and in Warm — the bell\'s red count (2026-10-06)', () => {
    // The bell's badge paints `--white-fixed` on `--danger-fill`. Dark's --danger (#EF4444) is a glyph and
    // tint red that put the digit at 3.76:1 (the rendered check, 2026-10-05); the fill is its own token.
    const warm = { ...root, ...readSelectorTokens(COACH_PALETTE, 'html[data-user-theme="warm"] [data-coach-warm-enabled]') };
    for (const [theme, d] of [['Dark', decls], ['Warm', warm]] as const) {
      const fill = resolveInk(d, '--danger-fill');
      const digit = resolveInk(d, '--white-fixed');
      assert.ok(fill && digit, `--danger-fill or --white-fixed did not resolve in ${theme}`);
      const r = contrast(digit.rgb, fill.rgb);
      assert.ok(r >= AA_NORMAL, `${theme}: white on --danger-fill is ${r.toFixed(2)}:1 (needs ${AA_NORMAL}:1)`);
    }
  });
});
