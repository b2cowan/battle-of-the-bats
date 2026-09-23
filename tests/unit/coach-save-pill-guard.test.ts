import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readSource, stripComments } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * THE AUTOSAVE WORD — ONE PIECE, FIVE SCREENS, TRANSIENT (owner ruling 2026-09-20)
 *
 * The word has had four homes in a week: a docked bar, a floating pill, the page's title row (one
 * morning) and now the pill again — but only while it has something to say. Each move was made
 * screen by screen, and each time one screen was nearly missed. This pins the two facts that a
 * screen-by-screen edit can silently break:
 *
 *   1. **THE VOCABULARY IS THE COMPONENT'S.** Three honest states plus the failure — "Unsaved
 *      changes" (waiting for the debounce), "Saving…" (a request is open), "Saved", and
 *      "Couldn’t save · Retry" as a BUTTON in the pill's place. A screen that hand-rolls its own
 *      word is drift; one that collapses dirty into saving lets the word be untrue.
 *
 *   2. **EVERY AUTOSAVING SCREEN RENDERS THE SAME PIECE, AND NONE HANDS IT TO A HEADER SLOT.**
 *      The title-row home was retired the day it was built because the title row is pinned
 *      nowhere — the word scrolled away exactly when a coach deep in the grid wanted it. The
 *      page-header prop that carried it is gone; the page-actions guard fails on an unknown
 *      prop, so a call site that grows one back is caught there. This file pins the other half:
 *      the five surfaces still render the pill at all.
 *
 * Asserted against SOURCE with comments stripped (see `_source-code.ts` for why).
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */
const PILL = 'components/coaches/SaveStatusPill.tsx';

/**
 * Every surface that autosaves. Adding one here is the deliberate act; forgetting is the bug —
 * and the game-day console is the proof. It autosaved from the day it shipped (the lineup PUT
 * and the quiet score PATCH), it was never added to this list, and so when the word moved to the
 * shared pill on 2026-09-20 the console kept its own hand-rolled "✓ Saved" pinned in its top
 * strip, always visible, for two days. The owner found it, not the build. It is on the list now.
 */
const SURFACES = [
  'app/[orgSlug]/coaches/teams/[teamId]/lineups/[eventId]/page.tsx',
  'app/[orgSlug]/coaches/teams/[teamId]/practice/[eventId]/page.tsx',
  'app/[orgSlug]/coaches/teams/[teamId]/practice/templates/[templateId]/page.tsx',
  'app/[orgSlug]/coaches/teams/[teamId]/practice/circuits/[circuitId]/page.tsx',
  'app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx',
  'app/[orgSlug]/coaches/teams/[teamId]/game/[eventId]/page.tsx',
];

describe('SaveStatusPill — the autosave word', () => {
  const source = stripComments(readSource(PILL));

  it('speaks the three honest states and the failure, with Retry as a button', () => {
    for (const word of ['Unsaved changes', 'Saving…', 'Saved', 'Couldn’t save · Retry']) {
      assert.ok(source.includes(word), `the word "${word}" must come from the component`);
    }
    assert.match(source, /<button[^>]*className=\{styles\.saveRetry\}/, 'Retry is a button in the pill, never a separate line');
  });

  it('is a floating pill that fades — a phase the stylesheet reads, and a live region that is never unmounted', () => {
    assert.ok(source.includes('styles.savePill'), 'the pill floats at the window\'s foot (`.savePill`)');
    assert.ok(source.includes('data-phase={phase}'), 'the fade is a data-phase the stylesheet reads');
    assert.ok(source.includes('aria-live="polite"'), 'the word is announced');
    assert.match(source, /const LINGER_MS = \d+/, '"Saved" lingers before it fades');
    // Only an error persists: the phase is derived — anything but saved is shown — and the linger
    // is set only on a transition INTO saved, so nothing shows at rest.
    assert.ok(source.includes("state !== 'saved' ? 'shown'"), 'anything but "saved" holds the pill on screen');
    assert.ok(source.includes("setLinger(state === 'saved' ? 'shown' : 'none')"), 'only a transition into saved starts the linger');
  });

  it('is rendered by every autosaving surface, and none of them hands it to a header slot', () => {
    for (const rel of SURFACES) {
      const page = stripComments(readSource(rel));
      assert.ok(page.includes('<SaveStatusPill'), `${rel} must render the shared pill`);
      assert.ok(!/status=\{[^}]*SaveStatusPill/.test(page), `${rel} must not hand the pill to a header \`status\` slot — that home is retired`);
    }
  });
});
