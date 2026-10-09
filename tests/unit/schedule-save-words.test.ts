import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DRAFT_SAVE_FAILED,
  GAME_DAY_REMINDER_SENTENCE,
  SCHEDULE_REFUSAL,
  draftSaveQuestion,
  draftSaveReadout,
  refusalReason,
} from '../../lib/schedule-words.ts';
import { willScheduleGameDayReminder } from '../../lib/schedule-publish-rules.ts';

/**
 * Tournament admin redesign, Stage 3 defects pass (A45). The words are /marketing's (2026-10-09); these hold the
 * facts they may state.
 */

const base = { division: 'U13', added: 9, replaced: 0, kept: 0, slotBased: false, published: false };

describe('the generator\'s save question (F70) says what it adds, replaces and keeps', () => {
  it('an empty division: only what it adds', () => {
    assert.equal(draftSaveQuestion(base), 'This will save 9 new games for U13.');
  });

  it('replaces games still to play and keeps the rest, singular and plural', () => {
    assert.equal(
      draftSaveQuestion({ ...base, replaced: 3, kept: 6 }),
      'This will save 9 new games for U13 and replace 3 games still to play. 6 games stay as they are.',
    );
    assert.equal(
      draftSaveQuestion({ ...base, added: 1, replaced: 1, kept: 1 }),
      'This will save 1 new game for U13 and replace 1 game still to play. 1 game stays as it is.',
    );
  });

  it('a save that only removes games says so; a save with nothing to do says that', () => {
    assert.equal(
      draftSaveQuestion({ ...base, added: 0, replaced: 3, kept: 6 }),
      'This will remove 3 games still to play from U13. There are no new games to add. 6 games stay as they are.',
    );
    assert.equal(draftSaveQuestion({ ...base, added: 0 }), 'There is nothing to save.');
  });

  it('slot-based drafts name the schedule, not a game count', () => {
    assert.equal(draftSaveQuestion({ ...base, slotBased: true, replaced: 2 }), 'This will save a slot-based schedule for U13 and replace 2 games still to play.');
  });

  it('never says games are cleared, and never that teams are told — a published division says no one is notified', () => {
    for (const c of [base, { ...base, replaced: 3, kept: 6 }, { ...base, published: true }, { ...base, added: 0, replaced: 2, published: true }]) {
      const q = draftSaveQuestion(c);
      assert.doesNotMatch(q, /permanently|clear/i);
      assert.doesNotMatch(q, /\b(teams|families|coaches) (are|will be) (told|notified|emailed)/i);
    }
    assert.match(draftSaveQuestion({ ...base, published: true }), /U13 is published, so the new games show on the public schedule right away\. No one is notified\.$/);
  });

  it('the form readout counts what a save keeps and replaces', () => {
    assert.equal(draftSaveReadout(6, 3), 'Keeps 6 games. Replaces 3 games still to play.');
    assert.equal(draftSaveReadout(1, 0), 'Keeps 1 game. Nothing to replace.');
  });

  it('every one-step failure says nothing was saved', () => {
    for (const sentence of Object.values(DRAFT_SAVE_FAILED)) assert.match(sentence, /Nothing was saved/);
  });
});

describe('a refused schedule save says why (F71)', () => {
  it('the server\'s own reason is shown as it is', () => {
    const finalLocked = 'This game is final. Only someone who can finalize scores can change it.';
    assert.equal(refusalReason(403, finalLocked), finalLocked);
    assert.equal(refusalReason(409, 'This tournament is completed, so its results are locked.'), 'This tournament is completed, so its results are locked.');
    assert.equal(refusalReason(400, 'That field is not one of this event\'s venues.'), 'That field is not one of this event\'s venues.');
  });

  it('a bare permission token becomes a sentence; no reason, a sign-out or a server error falls back', () => {
    assert.equal(refusalReason(403, 'Forbidden'), SCHEDULE_REFUSAL.noPermission);
    assert.equal(refusalReason(403, undefined), SCHEDULE_REFUSAL.noPermission);
    assert.equal(refusalReason(401, 'Unauthorized'), SCHEDULE_REFUSAL.gameFallback);
    assert.equal(refusalReason(400, ''), SCHEDULE_REFUSAL.gameFallback);
    // A 500's text can be a raw database message — never shown.
    assert.equal(refusalReason(500, 'duplicate key value violates unique constraint'), SCHEDULE_REFUSAL.gameFallback);
    assert.equal(refusalReason(500, 'x', SCHEDULE_REFUSAL.divisionFallback), SCHEDULE_REFUSAL.divisionFallback);
  });
});

describe('the Publish window\'s reminder sentence shows only when the reminder is scheduled (F73)', () => {
  const plus = 'tournament_plus' as const;

  it('needs Notify ticked, a plan with schedule notifications, and the reminder setting on — the route\'s conditions', () => {
    assert.equal(willScheduleGameDayReminder({ notify: true, planId: plus, settings: {} }), true);
    assert.equal(willScheduleGameDayReminder({ notify: true, planId: 'club', settings: null }), true);
    // The route returns before the reminders when Notify is unticked…
    assert.equal(willScheduleGameDayReminder({ notify: false, planId: plus, settings: {} }), false);
    // …and on a plan without the email…
    assert.equal(willScheduleGameDayReminder({ notify: true, planId: 'tournament', settings: {} }), false);
    assert.equal(willScheduleGameDayReminder({ notify: true, planId: null, settings: {} }), false);
    // …and schedules none while Event Settings turns the reminder (or every automatic coach email) off.
    assert.equal(willScheduleGameDayReminder({ notify: true, planId: plus, settings: { coach_email_game_day: false } }), false);
  });

  it('no longer promises a reminder "even if the box above is left unchecked"', () => {
    assert.doesNotMatch(GAME_DAY_REMINDER_SENTENCE, /unchecked|even if/i);
  });
});
