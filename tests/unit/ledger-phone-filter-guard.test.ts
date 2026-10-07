import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode, readSource } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * ON A PHONE, BOTH LEDGERS' FILTERS ARE ONE FILTER BUTTON (Ledger Phone Filter, owner rulings D1–D7,
 * 2026-10-02 — hub https://claude.ai/artifact/9MkS5tTMA7RvytnUXCsVdx, plan
 * docs/projects/active/LEDGER_PHONE_FILTER_PLAN.md).
 *
 * The coach's Ledger toolbar is sticky; at 390px its five pills pinned 207px of every screen. On a phone
 * they now sit behind one Filter button and a sheet; a desk keeps the pills. This pins the rulings:
 *
 *   D1 — the narrowings go in a `FilterGroup` on every view of both Ledgers; View, Open all / Fold all,
 *        Cash on hand and Balance stay OUT of it. The stylesheet decides the form, at ≤640.
 *   D2 — the sheet is one row per filter (`FilterSheetRow`), each pill's own choices under it.
 *   D3 — the count is filters OFF THEIR REST, reported by the pills themselves.
 *   D5 — the club's Ledger too, its Balance on the Filter line.
 *   D6 — Reset filters only while something is on, and back to REST (never to "All").
 *   D7 — no Done: picking a checkbox does not close the sheet.
 *
 * Asserted against SOURCE with comments stripped (`_source-code.ts`).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
const COACH = 'app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/panel.tsx';
const CLUB = 'app/[orgSlug]/admin/accounting/ledger/page.tsx';
const GROUP = 'components/coaches/FilterGroup.tsx';
const coach = readCode(COACH);
const club = readCode(CLUB);
const group = readCode(GROUP);
const multi = readCode('components/coaches/MultiSelectDropdown.tsx');
const date = readCode('components/coaches/DateRangeDropdown.tsx');

/** The JSX between an opening tag and the next `</FilterGroup>`. */
function groupBody(code: string, open: string): string {
  const at = code.indexOf(open);
  assert.ok(at >= 0, `no ${open}`);
  const end = code.indexOf('</FilterGroup>', at);
  assert.ok(end > at, `${open} is never closed`);
  return code.slice(at, end);
}

describe('Ledger Phone Filter — one Filter button on a phone, the pills on a desk', () => {
  it('D1: every view of the coach’s Ledger groups its narrowings, and only those', () => {
    const timeline = groupBody(coach, '<FilterGroup key="timeline">');
    for (const label of ['label="Type"', 'label="Status"', 'label="Category"', 'label="Item"']) assert.ok(timeline.includes(label), `Timeline: ${label}`);
    // ⚖ Category sits LEFT of Item, as on the club's Ledger (owner 2026-10-07): both read Type · Status · Category · Item · Date.
    assert.ok(timeline.indexOf('label="Status"') < timeline.indexOf('label="Category"') && timeline.indexOf('label="Category"') < timeline.indexOf('label="Item"'), 'Timeline: Status, Category, Item in that order');
    assert.match(timeline, /<DateRangeDropdown\b/);
    assert.match(timeline, /\{tagFilterPill\}/);
    const bills = groupBody(coach, '<FilterGroup key="bills">');
    for (const label of ['label="Status"', 'label="Item"']) assert.ok(bills.includes(label), `Bills: ${label}`);
    assert.match(bills, /\{tagFilterPill\}/);
    // Not narrowings: the arrangement, the fold verb and the figure stay out of the button.
    for (const body of [timeline, bills]) {
      assert.doesNotMatch(body, /viewPill|SingleSelectDropdown/, 'View is the arrangement, never a filter');
      assert.doesNotMatch(body, /Open all|Fold all/);
      assert.doesNotMatch(body, /Cash on hand/);
    }
    assert.equal((coach.match(/<FilterGroup\b/g) ?? []).length, 2, 'one group per strip face');
  });

  it('D5: the club’s Ledger groups its filters; Balance and the Book pill stay out', () => {
    const body = groupBody(club, '<FilterGroup>');
    for (const label of ['label="Type"', 'label="Status"', 'label="Category"', 'label="Item"']) assert.ok(body.includes(label), `Club: ${label}`);
    assert.ok(body.indexOf('label="Category"') < body.indexOf('label="Item"'), 'Club: Category, then Item');
    assert.match(body, /<DateRangeDropdown\b/);
    assert.doesNotMatch(body, /moneyKit\.balance|SingleSelectDropdown/);
    // Balance joins the Filter line on a phone: the rule that gave it a line of its own is gone.
    const money = readSource('components/admin/kit/club/money/Money.module.css');
    assert.doesNotMatch(money, /\.balance\s*\{[^}]*flex-basis:\s*100%/);
  });

  it('D1: the stylesheet decides the form at ≤640 — both are rendered, no first-paint flash', () => {
    const css = readSource('components/coaches/FilterGroup.module.css');
    assert.match(css, /\.pills\s*\{\s*display:\s*contents;\s*\}/);
    assert.match(css, /\.phone\s*\{\s*display:\s*none;\s*\}/);
    assert.match(css, /@media \(max-width: 640px\)\s*\{\s*\.pills\s*\{\s*display:\s*none;\s*\}\s*\.phone\s*\{\s*display:\s*inline-flex;/);
    assert.match(group, /<div className=\{styles\.pills\}>/);
    assert.match(group, /className=\{styles\.phone\}/);
  });

  it('D2/D3: a pill reports itself and draws a sheet row; outside a group it is exactly a pill', () => {
    for (const [name, code] of [['MultiSelectDropdown', multi], ['DateRangeDropdown', date]] as const) {
      assert.match(code, /useFilterGroupMember\(/, `${name} registers with its group`);
      assert.match(code, /<FilterSheetRow\b/, `${name} draws its sheet row`);
      assert.match(code, /<details ref=\{ref\}/, `${name} is still a <details> pill outside the sheet`);
    }
    // The count is filters OFF THEIR REST — a seeded Status is at rest, not "on".
    assert.match(multi, /const narrowed = restSelection\s*\?\s*!\(selected\.size === restSelection\.size/);
    assert.match(multi, /const atRest = restQuiet && !narrowed;/, 'one rest test feeds the tint and the count');
    assert.match(date, /const narrowed = restPreset !== undefined && selection !== restPreset;/);
    assert.match(group, /const count = \[\.\.\.narrowed\.values\(\)\]\.filter\(Boolean\)\.length;/);
    // Only the DESK copy registers; the sheet's copy of the same pill must not count twice.
    assert.match(group, /mode: 'row', register: noopRegister/);
  });

  it('D6: Reset filters only while something is on, and back to REST', () => {
    assert.match(group, /\{count > 0 && \([\s\S]*?Reset filters/);
    assert.match(multi, /useFilterGroupMember\(label, narrowed, \(\) => onChange\(new Set\(restSelection \?\? \[\]\)\)\)/);
    assert.match(date, /if \(restPreset\) onChange\(\{ selection: restPreset \}\)/);
  });

  it('D7 and the sheet’s frame: a dialog that a pick does not close, its scrim inside the dismiss boundary', () => {
    assert.match(group, /role="dialog"/);
    assert.doesNotMatch(group, /role="menu"/, 'checkboxes and date fields are not menu items');
    // Escape, the phone's Back, a tap outside and Tab past the end are the sheet frame's since Sheet Frame step 5,
    // which hands focus back to the Filter button however the sheet closes (sheet-frame-guard).
    assert.doesNotMatch(group, /useDismissable\(/, 'the sheet’s keys are the frame’s — answered twice, Back would pop two entries');
    assert.match(group, /opener=\{triggerRef\}/, 'and the button is what focus goes home to');
    // Reset just closes: the frame's floor hands focus to the opener as the sheet unmounts, however it closed — its own
    // `rescueFocusTo` was a second hand-back that always found the first had landed (/simplify, Sheet Frame step 5).
    assert.match(group, /resets\.current\.forEach\(reset => reset\(\)\); close\(\); \}\}/, 'Reset closes, the frame hands focus home');
    assert.doesNotMatch(group, /rescueFocusTo/, 'one hand-back, the frame’s');
    // ⚖ The sheet's FRAME is the portal's sheet frame since Sheet Frame step 1 (2026-10-05) — inside the watched
    // root, its dim with it, NOT modal (D1: a stray tap on the bar loses nothing here, and a screen reader held
    // inside a sheet with no close button would have no way out), a tap on the dim handing focus back to the
    // button. All pinned in sheet-frame-guard.
  });
});
