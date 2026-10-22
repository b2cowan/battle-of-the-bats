import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A SECONDARY ACTION IS ITS SYMBOL ALONE ON A PHONE (owner ruling 2026-10-20). At phone width (≤640) a secondary action
 * with a familiar symbol has no border, no fill and no visible word, but keeps a 44px tap target and its name in an
 * aria-label; at a desk it keeps its label. The page's primary action keeps its words. An exception is named, never
 * assumed. These pin the first two buttons built to the rule — a new one joins this list; the rule's wording lives in
 * memory/design_decisions.md.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const SUBSCRIBE_TSX = 'components/public/TeamSubscribeButton.tsx';
const SUBSCRIBE_CSS = 'components/public/TeamSubscribeButton.module.css';
const SCHEDULE_TSX = 'components/public/RepTeamPublicSchedule.tsx';
const SCHEDULE_CSS = 'components/public/RepTeamPublicSchedule.module.css';

/** The body of the file's `@media (max-width: 640px)` block that mentions `needle`. */
function phoneBlock(css: string, needle: string): string {
  const blocks = css.split('@media (max-width: 640px)').slice(1);
  const hit = blocks.find(b => b.includes(needle));
  assert.ok(hit, `a phone block for ${needle}`);
  return hit;
}

describe('the public team page — Subscribe and Directions are symbols on a phone', () => {
  it('Subscribe: borderless, fill-free, label hidden, a 44px box, named by aria-label', () => {
    const block = phoneBlock(readCode(SUBSCRIBE_CSS), '.button');
    assert.match(block, /width: 44px/);
    assert.match(block, /border-color: transparent/);
    assert.match(block, /background: none/);
    assert.match(block, /\.label \{ display: none; \}/);
    assert.match(readCode(SUBSCRIBE_TSX), /aria-label=\{W\.publicButton\}/);
  });
  it('Directions: borderless, fill-free, label hidden, a 44px box, named by aria-label', () => {
    const block = phoneBlock(readCode(SCHEDULE_CSS), '.directions');
    assert.match(block, /width: 44px/);
    assert.match(block, /border-color: transparent/);
    assert.match(block, /background: none/);
    assert.match(block, /\.directionsLabel \{ display: none; \}/);
    assert.match(readCode(SCHEDULE_TSX), /aria-label="Directions"/);
  });
});

describe('a tryout status card — Copy is built like Directions above it (owner 2026-10-21)', () => {
  const CARD_TSX = 'components/public/ClubContactCard.tsx';
  const CARD_CSS = 'components/public/TryoutPage.module.css';
  it('a desk: the kit small button, labelled, at the card edge in line with Directions; never wrapped under the address', () => {
    const tsx = readCode(CARD_TSX);
    assert.match(tsx, /kit\.btn\} \$\{kit\.btnSecondary\} \$\{kit\.btnSm\} \$\{styles\.copy\}/);
    assert.match(tsx, /aria-label="Copy email address"/);
    const css = readCode(CARD_CSS);
    assert.match(css, /\.mailRow \.copy \{[^}]*margin-left: auto/);
    assert.doesNotMatch(css.slice(css.indexOf('.mailRow {'), css.indexOf('}', css.indexOf('.mailRow {'))), /flex-wrap: wrap/);
  });
  it('a phone: borderless, fill-free, label hidden, a 44px box', () => {
    const block = phoneBlock(readCode(CARD_CSS), '.copyLabel');
    assert.match(block, /width: 44px/);
    assert.match(block, /border-color: transparent/);
    assert.match(block, /background: none/);
    assert.match(block, /\.copyLabel \{ display: none; \}/);
  });
});
