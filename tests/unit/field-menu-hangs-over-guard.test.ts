/**
 * A FIELD'S LIST HANGS OVER THE WINDOW IT SITS IN (owner ruling, §80 walk 2026-08-23) — held for the payee and
 * payment-method pickers.
 *
 * Found 2026-10-09 on the club Ledger's Add entry window: the "Paid to" list was `position: absolute` inside the
 * window's scroll box, so it was cut off at the window's footer, directly under a "Filed under" picker that already
 * hung over it. The two pickers share one stylesheet and now one placement hook (`useFieldMenu`), which every screen
 * they appear on inherits: the club Ledger's Add entry and line windows, the coach expense form, the coach's
 * commitment window.
 *
 * The venue field (`WhereField`) joined them 2026-10-09 (§284): flipped above the field in the coach's Add practice
 * window, its own guess at the room (a `position: absolute` list in the window's scroll box) cut its top rows off at
 * the window's top edge. Every form that asks where wears it: the coach's event window, a tryout day's session window
 * and house league's game and practice windows. The tag and opponent pickers, which carried the same guess, joined
 * the same day: every tag field (money, practice, drill, goal) and the Add Game opponent. The add-a-test list in a
 * development session keeps its pane on purpose (C11).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cssRule, readCode } from './_source-code.ts';

const css = readCode('components/accounting/PayeeCombobox.module.css');
const payee = readCode('components/accounting/PayeeCombobox.tsx');
const method = readCode('components/accounting/PaymentMethodCombobox.tsx');
const hooks = readCode('lib/overlay-hooks.ts');
const whereCss = readCode('components/venue/WhereField.module.css');
const where = readCode('components/venue/WhereField.tsx');
const coachCss = readCode('app/[orgSlug]/coaches/coaches.module.css');
const tags = readCode('components/coaches/TagSearchCombobox.tsx');
const opponent = readCode('components/coaches/OpponentCombobox.tsx');
const metric = readCode('components/coaches/MetricPickerCombobox.tsx');

describe('a picker’s list hangs over its window (§80)', () => {
  it('the shared list is viewport-fixed over its window, never absolute', () => {
    const dropdown = cssRule(css, '.dropdown');
    assert.match(dropdown, /position: fixed;/, 'fixed — a window’s scroll box cannot clip it');
    assert.doesNotMatch(dropdown, /position: absolute;/, 'absolute is what the window’s footer cut off');
    assert.doesNotMatch(dropdown, /top: calc\(100%/, 'placement is measured, not hung from the field');
    assert.match(dropdown, /z-index: 500;/, 'over everything inside its own window — the footer included');
  });

  for (const [who, src] of [['payee', payee], ['payment method', method]] as const) {
    it(`the ${who} picker places its list with the shared hook`, () => {
      assert.match(src, /import \{[^}]*useFieldMenu[^}]*\} from '@\/lib\/overlay-hooks';/);
      assert.match(src, /useFieldMenu\([^)]*containerRef, menuRef,/, 'measured from the field, written onto the list');
      assert.match(src, /useFieldMenu\(listShown,/, 'placed exactly while the list is mounted');
      assert.match(src, /\{listShown && \(\s*<div className=\{styles\.dropdown\} ref=\{menuRef\}>/, 'the list carries the ref the hook places');
    });
  }

  it('the venue field’s list hangs over its window with the same hook, and keeps no guess of its own', () => {
    const list = cssRule(whereCss, '.list');
    assert.match(list, /position: fixed;/, 'fixed — the window’s scroll box cut the flipped list off at its top');
    assert.doesNotMatch(list, /position: absolute;|top: calc\(100%/, 'placement is measured, not hung from the field');
    assert.match(list, /z-index: 500;/, 'over everything inside its own window — the footer included');
    assert.match(list, /overscroll-behavior: contain;/);
    assert.doesNotMatch(whereCss, /\.listUp\b/, 'the hook decides above or below; no second flip rule');
    assert.match(where, /import \{[^}]*useFieldMenu[^}]*\} from '@\/lib\/overlay-hooks';/);
    assert.match(where, /useFieldMenu\(listShown, inputRef, listRef,/, 'measured from the field, written onto the list, placed while mounted');
    assert.match(where, /\{listShown && \(\s*<div id=\{`\$\{venueId\}-list`\} ref=\{listRef\}/, 'the list carries the ref the hook places');
    assert.doesNotMatch(where, /dropUp|getBoundingClientRect/, 'its own room-guess (270px of room for a 300px list) is gone');
  });

  it('the tag and opponent lists hang over their window with the same hook; the add-a-test list is the ruled exception', () => {
    const list = cssRule(coachCss, '.tagComboDropdown');
    assert.match(list, /position: fixed;/, 'fixed — the guess it replaced still cut the list off where neither side had room');
    assert.doesNotMatch(list, /position: absolute;|top: calc\(100%|max-height/, 'placement and height are measured, not hung from the field');
    assert.match(list, /z-index: 500;/, 'over everything inside its own window — the footer included');
    assert.match(list, /overscroll-behavior: contain;/);
    assert.doesNotMatch(coachCss, /\.tagComboDropdownUp\b/, 'the hook decides above or below; no second flip rule');
    for (const [who, src, shown] of [['tag', tags, 'listShown'], ['opponent', opponent, 'showList']] as const) {
      assert.match(src, /import \{[^}]*useFieldMenu[^}]*\} from '@\/lib\/overlay-hooks';/, `${who}: imports the hook`);
      assert.match(src, new RegExp(`useFieldMenu\\(${shown}, inputRef, listRef,`), `${who}: placed exactly while its list is mounted`);
      assert.match(src, new RegExp(`\\{${shown} && \\(\\s*<div ref=\\{listRef\\} className=\\{styles\\.tagComboDropdown\\}>`), `${who}: the list carries the ref`);
      assert.doesNotMatch(src, /dropUp|getBoundingClientRect/, `${who}: its own room-guess is gone`);
    }
    // ⚖ C11 (2026-09-15): always below, inside the session sheet's pane, which scrolls to hold it.
    assert.match(cssRule(coachCss, '.tagComboDropdownInPane'), /position: absolute;/);
    assert.match(metric, /styles\.tagComboDropdown\} \$\{styles\.tagComboDropdownInPane\}/, 'the add-a-test list keeps its pane');
    assert.doesNotMatch(metric, /useFieldMenu/);
  });

  it('the hook flips above the field, follows a scroll, and lets the list scroll itself', () => {
    const body = hooks.slice(hooks.indexOf('export function useFieldMenu('));
    assert.match(body, /const up = below < Math\.min\(FIELD_MENU_MAX, above\);/, 'opens above when there is genuinely more room there');
    assert.match(body, /window\.visualViewport/, 'room is what a phone can SEE above its keyboard');
    assert.match(body, /addEventListener\('scroll', schedule, true\)/, 'a scroll re-places it — capture, so the window’s own body counts');
    assert.match(body, /menuRef\.current\?\.contains\(t\)\) return;/, 'the list’s own scroll is someone reading it');
  });

  it('it closes only once its field has left the box that scrolls it, and never strands its first rows', () => {
    const body = hooks.slice(hooks.indexOf('export function useFieldMenu('));
    assert.match(body, /const b = box \? box\.getBoundingClientRect\(\) : \{ top: 0, bottom: layoutHeight \};/,
      'the window’s scroll box, or the LAYOUT viewport (a phone’s keyboard covers the visual one before it pans)');
    assert.match(body, /if \(r\.bottom <= b\.top \|\| r\.top >= b\.bottom\) \{ onLostRef\.current\(\); return; \}/,
      'lost only when the field is wholly outside its boundary');
    assert.equal(body.match(/onLostRef\.current\(\)/g)?.length, 1, 'that check is the ONLY way the hook gives the list up — a scroll alone never closes it');
    assert.match(body, /const floor = up \? Math\.min\(FIELD_MENU_MIN, Math\.max\(0, above\)\) : FIELD_MENU_MIN;/,
      'an upward list is never taller than the room above the field');
    assert.match(cssRule(css, '.dropdown'), /overscroll-behavior: contain;/, 'a flick at the list’s end stays in the list');
  });
});
