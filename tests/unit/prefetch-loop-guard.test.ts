/**
 * THE COACH PREFETCH LOOP (owner, 2026-11-15; RELEASE_PROCESS_HARDENING_PLAN.md §2.5). Next 16.3's optimistic routing
 * predicts a link's route tree from a sibling it already knows. Under a parallel slot whose catch-all page matches the
 * link (the coaches layout's `@stripFacts/teams/[teamId]/[...rest]`), the prediction for an address with a query
 * leaves the catch-all's param unresolved, and the link re-prefetches about every 300 ms for as long as the page is open.
 * next.config.ts switches the prediction off. This test fails if it is switched back on while such a slot exists.
 *
 * To lift it on a newer Next: re-run the probe in docs/projects/active/COACH_PREFETCH_LOOP_FIX_PROMPT.md against a
 * local production build with the switch removed, on the coach Overview, Roster and the money report. Each door must be
 * prefetched once. (A plain `next dev` never prefetches on sight, so it cannot show the loop either way.)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import nextConfig from '../../next.config.ts';

const APP = path.resolve(import.meta.dirname, '../../app');

/** Every catch-all (`[...x]` / `[[...x]]`) directory inside a parallel slot (`@x`) under app/. */
function slotCatchAlls(dir: string, inSlot: boolean, found: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (!statSync(full).isDirectory() || name === 'node_modules') continue;
    const slot = inSlot || name.startsWith('@');
    if (slot && /^\[\[?\.\.\./.test(name)) found.push(path.relative(APP, full).replaceAll('\\', '/'));
    slotCatchAlls(full, slot, found);
  }
  return found;
}

describe('the prefetch loop stays switched off', () => {
  it('the coaches strip slot still has its catch-all (the condition the switch exists for)', () => {
    assert.ok(
      slotCatchAlls(APP, false).includes('[orgSlug]/coaches/@stripFacts/teams/[teamId]/[...rest]'),
      'the @stripFacts catch-all moved or went: re-read this guard and next.config.ts before keeping either',
    );
  });

  it('optimistic routing is off while any parallel slot has a catch-all', () => {
    const catchAlls = slotCatchAlls(APP, false);
    if (catchAlls.length === 0) return;
    assert.equal(
      nextConfig.experimental?.optimisticRouting,
      false,
      `parallel-slot catch-all(s) ${catchAlls.join(', ')} need experimental.optimisticRouting: false in next.config.ts, ` +
        'or every link to them with a query re-prefetches forever (see this file\'s header)',
    );
  });
});
