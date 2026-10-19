/**
 * EVENT SETTINGS STAYS, AND IS THE MODEL (Tournament admin redesign Stage 5, Part 3 — E3, A49; F27, F92, J1-032,
 * J1-042). What the build must keep true:
 *   - the status is said once, in the event record's sentence, and Change opens the record — no second status switch;
 *   - the Fee model is a dropdown, and its fourth choice says the fees aren't tracked here — never "Free" — while the
 *     stored value `free` is unchanged;
 *   - the card names the divisions that set their own fee, as a door to Divisions;
 *   - no sentence promises a gate that doesn't exist (Activate needs dates and a division);
 *   - the save word is the floating pill; the page has its "?"; its inline old look is gone.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { EVENT_SETTINGS_WORDS as W } from '../../lib/event-settings-words.ts';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const page = code('app/[orgSlug]/admin/tournaments/settings/event/page.tsx');

describe('Event settings (E3)', () => {
  it('says the status once and opens the record to change it (P5, A49)', () => {
    assert.doesNotMatch(page, /aria-label="Tournament status"/, 'the Draft / Active / Completed switch went');
    assert.doesNotMatch(page, /action: 'set-status'/, 'a status change is the record\'s, never this page\'s');
    assert.match(page, /statusSentence\(\{/);
    assert.match(page, /<RecordFromList /);
  });
  it('never calls untracked fees "Free" — and keeps the stored value (F92)', () => {
    assert.equal(W.feeOptions.free, 'Not tracked here');
    assert.equal(W.feeSummaryNotTracked, 'Not tracked here');
    assert.doesNotMatch(W.feeLine.free, /free|not charged/i);
    assert.doesNotMatch(page, /\['free',\s*'Free'\]|return 'Free'/);
    assert.match(page, /\(\['tournament', 'allow_override', 'per_division', 'free'\] as const\)/, 'the stored `free` is unchanged');
  });
  it('chooses one value with a dropdown, at every width', () => {
    assert.match(page, /<select\s+id="fee-model"/);
    assert.match(page, /<select\s+id="instructions-where"/);
  });
  it('names the divisions that set their own fee, as a door to Divisions (J1-042)', () => {
    assert.match(page, /W\.eachDivisionsFee/);
    assert.match(page, /W\.divisionsWithOwnFee/);
    assert.match(page, /admin\/tournaments\/divisions`/);
  });
  it('promises no gate that doesn\'t exist (J1-032)', () => {
    const raw = read('app/[orgSlug]/admin/tournaments/settings/event/page.tsx');
    assert.doesNotMatch(raw, /Activate once your divisions, fees, and game timing are configured/);
    assert.doesNotMatch(raw, /must configure its own game timing before the tournament can be activated/);
    assert.equal(W.activateNeeds, 'To activate it, it needs its dates and a division.');
  });
  it('saves with the floating pill, has its "?", and its inline old look is gone', () => {
    assert.match(page, /<SavePill/);
    assert.match(page, /const fieldsDirty = isInitialized && \(/, '"loaded" guards every comparison, not just the first');
    assert.doesNotMatch(page, /saveStatusLabel|formFooter/);
    assert.match(page, /subtopicId: 'event-settings-cards'/);
    assert.match(read('lib/help-content/tournaments.tsx'), /id: 'event-settings-cards'/);
    assert.doesNotMatch(page, /useKitStyle|kx\(|legacy=\{/);
  });
  it('a closed card\'s summary sits under its title on a phone', () => {
    assert.match(read('components/admin/CollapsibleCard.module.css'), /@media \(max-width: 640px\) \{\s*:global\(\[data-admin-kit\]\) \.summary \{ flex-wrap: wrap;/);
  });
  // Walk §292 (owner 2026-10-12): a change made inside the 1.2 s pause was dropped without a word when the screen went.
  it('sends a waiting change when the screen goes — another screen, another event, the tab closing', () => {
    assert.match(page, /useEffect\(\(\) => \(\) => flushPendingSave\(\), \[tournamentId, flushPendingSave\]\)/,
      'leaving the screen or switching event flushes, bound to the event the change was made on');
    assert.match(page, /addEventListener\('pagehide', flushPendingSave\)/, 'closing the tab flushes too');
    assert.match(page, /performSaveRef\.current\?\.\(\{ flush: true \}\)/);
    assert.equal((page.match(/keepalive: flush,/g) ?? []).length, 3, 'all three of the save\'s requests outlive the page');
    assert.match(page, /if \(flush\) return;\s*\n\s*if \(!tournamentRes\.ok\)/, 'a flush touches nothing on a page that may show another event');
    assert.match(page, /autoSavePendingRef\.current = true;\s*\n\s*autoSaveTimerRef\.current = setTimeout/);
  });
  it('arms no pause for an event whose own read has not landed', () => {
    assert.match(page, /if \(!tournamentId\) return;\s*\n[\s\S]{0,400}setIsInitialized\(false\);\s*\n\s*Promise\.all\(\[/);
  });
});
