/**
 * Guards the "which plans does the pricing grid actually show?" list against PLAN_CONFIG drift.
 *
 * WHY: `RENDERED_PLAN_KEYS` in components/PricingSection.tsx is deliberately a SUBSET of
 * PLAN_CONFIG — `team` is sold by its own callout and `club_large` is a capacity band of Club, so
 * neither gets a card. The pricing page's viewer-aware CTAs test membership of that subset to
 * decide whether the reader's own tier can be marked "Current plan". A /review pass (2026-08-01)
 * found the first cut testing PLAN_CONFIG instead, which silently gave a Club · Association
 * operator a `currentPlan` no card could ever match — no badge, on the highest-paying tier.
 *
 * This test does not demand the two lists match. It demands the DIFFERENCE stays the known one, so
 * that adding a plan to PLAN_CONFIG forces a deliberate decision about whether it gets a card.
 *
 * Runs on Node's built-in runner:  `node --test lib/plan-config.test.ts`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLAN_CONFIG } from './plan-config.ts';

/** Kept in step with components/PricingSection.tsx RENDERED_PLAN_KEYS (which imports React and so
 *  cannot be loaded by this runner — the list is short, stable, and asserted against PLAN_CONFIG). */
const RENDERED = ['tournament', 'tournament_plus', 'league', 'club'];
/** Real plans the grid deliberately does NOT card. Adding one here is the decision point. */
const DELIBERATELY_NOT_CARDED = ['team', 'club_large'];

test('every rendered plan key is a real plan', () => {
  for (const key of RENDERED) {
    assert.ok(key in PLAN_CONFIG, `${key} has a card but no PLAN_CONFIG entry`);
  }
});

test('every real plan is either carded or on the deliberate exclusion list', () => {
  for (const key of Object.keys(PLAN_CONFIG)) {
    assert.ok(
      RENDERED.includes(key) || DELIBERATELY_NOT_CARDED.includes(key),
      `${key} is a real plan with no pricing card and no recorded reason — decide whether it ` +
      `gets a card, then add it to RENDERED_PLAN_KEYS or to the exclusion list.`,
    );
  }
});

test('the exclusion list names only real plans (no stale entries)', () => {
  for (const key of DELIBERATELY_NOT_CARDED) {
    assert.ok(key in PLAN_CONFIG, `${key} is excluded from the grid but no longer exists`);
  }
});
