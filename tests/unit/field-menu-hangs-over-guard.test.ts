/**
 * A FIELD'S LIST HANGS OVER THE WINDOW IT SITS IN (owner ruling, §80 walk 2026-08-23) — held for the payee and
 * payment-method pickers.
 *
 * Found 2026-10-09 on the club Ledger's Add entry window: the "Paid to" list was `position: absolute` inside the
 * window's scroll box, so it was cut off at the window's footer, directly under a "Filed under" picker that already
 * hung over it. The two pickers share one stylesheet and now one placement hook (`useFieldMenu`), which every screen
 * they appear on inherits: the club Ledger's Add entry and line windows, the coach expense form, the coach's
 * commitment window.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cssRule, readCode } from './_source-code.ts';

const css = readCode('components/accounting/PayeeCombobox.module.css');
const payee = readCode('components/accounting/PayeeCombobox.tsx');
const method = readCode('components/accounting/PaymentMethodCombobox.tsx');
const hooks = readCode('lib/overlay-hooks.ts');

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
