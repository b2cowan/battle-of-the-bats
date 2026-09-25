import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readSource, stripComments } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * THE INSIGHTS SCOREBOARD (owner rulings A1 · B1 · C1, 2026-09-25)
 *
 * The owner, on the Dashboard's figures: "why is the format different than our other dashboards
 * (transparent backgrounds instead of white)? can we make it more mobile friendly and not take up
 * so much space?" Measured on the live page at 390×844, the figures were 317px of bare paper — more
 * than half the first screen — and the only unframed block on a page of cards.
 *
 *   B1 **ON A COMPUTER, ONE WHITE FRAME.** The band keeps its shape (the figures side by side,
 *      hairlines between) and wears the kit card's skin. Not five cards: four of the five open the
 *      same Results tab. The hairlines are the band's 1px GAP over a line-coloured ground, so the
 *      band wraps with a divider between its lines too — a `border-right` cannot.
 *
 *   A1 **ON A PHONE, THE OVERVIEW'S ROWS.** The same figures through `CoachFigureRows` — Record and
 *      Form in ONE row (the Overview's Record row), four rows, 207px. The band is hidden at ≤640
 *      by stylesheet, never by a JS width branch.
 *
 *   C1 **THE ATTENDANCE TAB'S FOUR FIGURES** are drawn by the same band: framed at every width, two
 *      a line on a phone. They are not doors and nothing folds, so they do not take the rows.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */

const PAGE = 'app/[orgSlug]/coaches/teams/[teamId]/history/page.tsx';
const ATTENDANCE = 'app/[orgSlug]/coaches/teams/[teamId]/history/attendance/panel.tsx';
const STYLES = 'app/[orgSlug]/coaches/coaches.module.css';

const page = stripComments(readSource(PAGE));
const styles = stripComments(readSource(STYLES));

/** The body of the FIRST rule whose selector is exactly `selector` — the base rule; a phone
 *  override of the same selector sits later, inside its media block. */
function rule(selector: string): string {
  const at = styles.indexOf(`${selector} {`);
  assert.ok(at >= 0, `${selector} is declared`);
  return styles.slice(at, styles.indexOf('}', at) + 1);
}

describe('B1 — the band is on the card', () => {
  it('the band paints the kit card\'s edge and a line-coloured ground; each block paints the card', () => {
    const band = rule('.insightsBand');
    assert.ok(band.includes('border: 1px solid var(--home-line'), 'the kit card\'s hairline edge');
    assert.ok(band.includes('border-radius: 8px'), 'the kit card\'s corner');
    assert.ok(band.includes('gap: 1px'), 'the divider is the gap');
    assert.ok(band.includes('background: var(--home-line'), 'the gap shows the line colour');
    assert.ok(!band.includes('border-top'), 'no bare hairline strip above and below — that was the borderless band');
    const stat = rule('.insightsStat');
    assert.ok(stat.includes('background-color: var(--card-bg'), 'every block paints the card ground');
    assert.ok(!stat.includes('border-right'), 'no border divider — it leaves a stray edge on every wrapped line');
  });

  it('the hover tint is laid OVER the card, never in place of it', () => {
    const hover = rule('a.insightsStat:hover');
    assert.ok(hover.includes('background-image:'), 'the translucent tint is an image over the card ground');
    assert.ok(!/\bbackground:/.test(hover), 'a `background:` shorthand would drop the card and show the line colour through the tint');
  });

  it('the record\'s note is the Overview tile\'s own words — short enough that the band fits one line', () => {
    assert.ok(page.includes("const scopeCaption = 'Scrimmages left out';"),
      'three words (owner, 2026-09-25): the long note made Record 284px and wrapped Attendance below a 1,150px window');
    const overview = stripComments(readSource('app/[orgSlug]/coaches/teams/[teamId]/page.tsx'));
    assert.ok(overview.includes("'Scrimmages left out'"), 'the Overview\'s Record tile says the same thing — one wording, and the record FAQ points at it');
  });

  it('the run bar\'s track is visible on the white card', () => {
    const bar = rule('.insightsSegBar');
    assert.ok(!bar.includes('--home-card'), '`--home-card` is white in the warm skin — a white track on a white card');
    assert.ok(bar.includes('var(--home-line'), 'the kit bar\'s track');
  });
});

describe('A1 — on a phone the Dashboard\'s figures are the Overview\'s rows', () => {
  it('the page renders the band AND the rows, and the stylesheet shows one per width', () => {
    assert.ok(page.includes('<div className={`${styles.insightsBand} ${styles.insightsScoreboard}`}>'), 'the Dashboard\'s band is marked as the one the rows replace');
    assert.ok(page.includes('<CoachFigureRows label="Season scoreboard">'), 'the rows are the shared figure rows, named for the accessibility tree');
    const hide = styles.indexOf('.insightsScoreboard { display: none; }');
    assert.ok(hide > 0, 'the band is hidden where the rows show');
    const before = styles.slice(0, hide);
    assert.ok(before.slice(before.lastIndexOf('@media')).startsWith('@media (max-width: 640px)'), 'inside the ≤640 block');
    assert.ok(!/matchMedia\(|useIsPhone\(/.test(page), 'no width branch in the page — the server and the first client frame must agree');
  });

  it('four rows: Form rides under Record, as on the Overview', () => {
    const rows = page.slice(page.indexOf('<CoachFigureRows'), page.indexOf('</CoachFigureRows>'));
    assert.equal((rows.match(/<CoachFigureRow\b/g) || []).length, 4, 'Record · run differential · Close games · Attendance');
    assert.ok(!rows.includes('label="Form"'), 'no Form row — the pips are the Record row\'s qualifier');
    assert.ok(rows.includes('caption={formPips ?'), 'the Record row carries the pips');
    assert.equal((page.match(/className=\{styles\.wltFormPips\}/g) || []).length, 1, 'the pips are rendered ONCE and placed twice');
    assert.ok(!rows.includes('insightsSegBar'), 'no bar on a row — the words under the label say the ratio');
  });

  it('a row title reads in sentence case beside its siblings', () => {
    assert.ok(page.includes('label={diffLabel}'), 'the run differential row reads the sentence-cased label');
    assert.ok(page.includes('const diffLabel = sportPack.score.diff.charAt(0) + sportPack.score.diff.slice(1).toLowerCase();'),
      'the sport pack keeps its Title Case (the standings\' column heads); the row lowers it');
  });
});

describe('C1 — the Attendance tab\'s figures stay the band, framed, at every width', () => {
  it('its band is not the one the rows replace', () => {
    const panel = stripComments(readSource(ATTENDANCE));
    assert.ok(panel.includes('<div className={styles.insightsBand}>'), 'the same band recipe');
    assert.ok(!panel.includes('insightsScoreboard'), 'never hidden on a phone — it has no rows beside it');
    assert.ok(!panel.includes('CoachFigureRows'), 'four figures that open nothing are not door rows');
  });

  it('on a phone the band is two blocks a line, the gap dividing both ways', () => {
    const phone = styles.indexOf('.insightsStat { flex: 1 1 45%; padding: 0.55rem 0.8rem; }');
    assert.ok(phone > 0, 'two a line, the probe-measured padding');
  });
});
