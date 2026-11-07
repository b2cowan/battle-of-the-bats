/**
 * THE ADMIN'S PINNED BAR NAMES WHERE YOU ARE (Admin header bar, option 4, owner 2026-11-07) — Phase 1, the bar's shape.
 * Plan: docs/projects/active/ADMIN_HEADER_BAR_PLAN.md.
 *
 * The name sits on top and the facts ride a small line UNDER it, in the coaches portal's masthead meta voice; the bar
 * never shrinks on scroll, at any width (the collapse made content jump under the thumb, and the portal took the same
 * snap out 2026-09-21). If a scroll listener, a collapsed class or a second chip copy comes back, the build says so.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readCode } from './_source-code.ts';

const bar = readCode('components/admin/AdminEventHeader.tsx');
const css = readCode('components/admin/kit/AdminKitEventHeader.module.css');

/** One rule's body, by its exact selector. */
function block(sheet: string, selector: string): string {
  const at = sheet.indexOf(`${selector} {`);
  assert.ok(at >= 0, `${selector} exists`);
  return sheet.slice(at, sheet.indexOf('}', at));
}

describe('the admin bar never shrinks on scroll', () => {
  it('no collapsed state, no scroll listener, no second chip copy, no compact pill', () => {
    assert.doesNotMatch(bar, /setCollapsed|collapsed|addEventListener\('scroll'/);
    assert.doesNotMatch(bar, /chipCollapsed|chipOnDates|compact=/);
    assert.doesNotMatch(css, /\.collapsed\b|\.chipCollapsed\b|transition:\s*padding/);
  });

  it('it still publishes its height for the in-page sticky toolbars', () => {
    assert.match(bar, /setProperty\('--admin-header-h', `\$\{el\.offsetHeight\}px`\)/);
    assert.match(bar, /new ResizeObserver\(publish\)/);
  });

  it('the portal masthead’s padding: 0.45rem on a phone, 0.5rem on desktop; the 44px pill overhangs by 4px', () => {
    assert.match(block(css, '.header'), /padding: calc\(0\.45rem \+ env\(safe-area-inset-top\)\) [^;]* 0\.45rem /);
    assert.match(css, /@media \(min-width: 901px\) \{\s*\.header \{[^}]*padding: 0\.5rem 2rem;/);
    assert.match(css, /\.pill \{ margin-block: -4px; \}/);
  });
});

describe('the small line sits under the name', () => {
  it('the name comes first, then the line of facts: club · dates · chip', () => {
    const identity = bar.slice(bar.indexOf('className={styles.identity}'));
    assert.ok(identity.indexOf('{nameEl}') < identity.indexOf('className={styles.meta}'), 'name above the line');
    const meta = identity.slice(identity.indexOf('className={styles.meta}'));
    assert.ok(meta.indexOf('styles.metaClub') < meta.indexOf('{dates}'), 'club before dates');
    assert.ok(meta.indexOf('{dates}') < meta.indexOf('{phaseLabel}'), 'dates before the chip');
    assert.doesNotMatch(bar, /eyebrow/i, 'no eyebrow above the name');
  });

  it('the line is the portal meta voice: data face, label step, normal weight, no tracking, no capitals', () => {
    const meta = block(css, '.meta');
    for (const decl of [/font-family: var\(--font-data\)/, /font-size: var\(--type-label\)/, /font-weight: 400/,
      /letter-spacing: normal/, /text-transform: none/, /color: var\(--text-tertiary\)/]) assert.match(meta, decl);
  });

  it('the dot is drawn between words, never before the chip, and a phone drops the club without a stranded dot', () => {
    assert.match(css, /\.meta > span:not\(\.chip\) \+ span:not\(\.chip\)::before \{\s*content: '·';/);
    // ⚠ The phone rule must match the separator rule's weight: a bare `.metaClub + span::before` loses to it and leaves
    // "· Nov 1–3, 2026" on a phone (caught in the browser, 2026-11-07).
    assert.match(css, /@media \(max-width: 900px\) \{\s*\.metaClub \{ display: none; \}[^}]*\.meta > span\.metaClub \+ span:not\(\.chip\)::before \{ content: none; \}/);
    assert.ok(css.indexOf('.meta > span.metaClub + span:not(.chip)::before') > css.indexOf('.meta > span:not(.chip) + span:not(.chip)::before'),
      'the phone rule comes after the separator rule, so it wins');
  });

  it('the tournament name still opens its dashboard', () => {
    assert.match(bar, /titleHref = `\/\$\{currentOrg\?\.slug \?\? ''\}\/admin\/tournaments\/dashboard`/);
    assert.match(bar, /<Link href=\{titleHref\} className=\{styles\.nameLink\}/);
  });
});
