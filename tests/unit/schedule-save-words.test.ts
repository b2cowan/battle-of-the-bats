import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DRAFT_SAVE_FAILED,
  GAME_DAY_REMINDER_SENTENCE,
  SCHEDULE_REFUSAL,
  GENERATOR_WORDS,
  RAIN_DELAY_WORDS,
  rainDelayMove,
  shiftWords,
  draftStatement,
  refusalReason,
} from '../../lib/schedule-words.ts';
import { willScheduleGameDayReminder } from '../../lib/schedule-publish-rules.ts';

/**
 * Tournament admin redesign, Stage 3 defects pass (A45). The words are /marketing's (2026-10-09); these hold the
 * facts they may state.
 */

const base = { division: 'U13', added: 9, replaced: 0, played: 0, kept: 0, other: 0, published: false };

describe('the generator\'s one statement (S3; F70) says what saving adds, replaces and keeps', () => {
  it('an empty division: what it adds, that nothing is replaced, and who sees it', () => {
    const s = draftStatement(base);
    assert.equal(s.lead, 'Saving adds 9 games to U13.');
    assert.equal(s.rest, " U13 has none yet, so nothing is replaced. They aren't published yet: teams and families see them once you publish U13.");
    assert.deepEqual(s.bullets, []);
    assert.match(draftStatement({ ...base, published: true }).rest, /They show on the public site and in the app as soon as you save\.$/);
  });

  it('a division with games: what it adds, replaces and keeps, singular and plural', () => {
    const s = draftStatement({ ...base, added: 6, replaced: 2, played: 4, kept: 1 });
    assert.equal(s.lead, "Saving changes U13's games.");
    assert.equal(draftStatement({ ...base, division: 'U11 Girls', added: 1, replaced: 1 }).lead, "Saving changes U11 Girls' games.");
    assert.deepEqual(s.bullets, [
      'Adds 6 games from this draft',
      'Replaces 2 games still to play',
      'Keeps 4 played games and their scores, and 1 game you marked Keep',
    ]);
    assert.deepEqual(draftStatement({ ...base, added: 1, replaced: 1, played: 1 }).bullets,
      ['Adds 1 game from this draft', 'Replaces 1 game still to play', 'Keeps 1 played game and its score']);
    assert.deepEqual(draftStatement({ ...base, added: 2, other: 3 }).bullets, ['Adds 2 games from this draft', 'Leaves its 3 other games as they are']);
  });

  it('a save that only removes games says so; a save with nothing to do says that', () => {
    assert.deepEqual(draftStatement({ ...base, added: 0, replaced: 3, played: 6 }).bullets,
      ['Removes 3 games still to play', 'Keeps 6 played games and their scores']);
    assert.equal(draftStatement({ ...base, added: 0 }).lead, 'There is nothing to save.');
  });

  it('never says games are cleared', () => {
    for (const c of [base, { ...base, replaced: 3, played: 6 }, { ...base, published: true }, { ...base, added: 0, replaced: 2, published: true }]) {
      const s = draftStatement(c);
      assert.doesNotMatch([s.lead, s.rest, ...s.bullets].join(' '), /permanently|clear/i);
    }
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

describe('the round-robin generator\'s words (S3, /marketing 2026-10-09)', () => {
  it('the taken line: one division names its times; several divisions count their games', () => {
    assert.equal(
      GENERATOR_WORDS.taken({ divisions: ['U13'], games: 3, fields: ['Diamond 3'], days: ['Friday'], times: ['9:00 a.m.', '10:30 a.m.', '12:00 p.m.'] }),
      "U13's 3 games hold Diamond 3 on Friday at 9:00 a.m., 10:30 a.m. and 12:00 p.m. The drafts leave those times free.",
    );
    assert.equal(
      GENERATOR_WORDS.taken({ divisions: ['U11', 'U15'], games: 9, fields: ['Diamond 1', 'Diamond 2'], days: ['Friday', 'Saturday'], times: [] }),
      "Other divisions' 9 games hold Diamond 1 and Diamond 2 on Friday and Saturday. The drafts leave those times free.",
    );
    assert.match(GENERATOR_WORDS.taken({ divisions: ['U9'], games: 1, fields: ['Diamond 4'], days: ['Sunday'], times: ['4:00 p.m.'] }), /^U9's 1 game holds Diamond 4/);
  });
  it('a card names what decides between the drafts, singular and plural', () => {
    assert.equal(GENERATOR_WORDS.measures.loadAndMoves(0, 2), '0 back-to-backs · 2 field moves');
    assert.equal(GENERATOR_WORDS.measures.loadAndMoves(1, 1), '1 back-to-back · 1 field move');
    assert.equal(GENERATOR_WORDS.measures.clubOne('Diamond 2, Fri 9:00 a.m.'), '1 game on a club booking: Diamond 2, Fri 9:00 a.m.');
    assert.equal(GENERATOR_WORDS.measures.clubClear, 'Clear of club bookings');
    assert.equal(GENERATOR_WORDS.others(['U13']), 'U13');
    assert.equal(GENERATOR_WORDS.others(['U11', 'U13', 'U15']), '3 other divisions');
  });
  it('the replace asks once, and says who is told', () => {
    assert.equal(GENERATOR_WORDS.replace.title(2), 'Replace 2 games still to play?');
    assert.equal(GENERATOR_WORDS.saveReplace(1), 'Save and replace 1 game');
    assert.match(GENERATOR_WORDS.replace.published('U13'), /their followers are told the new time, and a game this draft drops is told as cancelled/);
    assert.equal(GENERATOR_WORDS.replace.unpublished('U13'), "U13 isn't published, so nobody is told.");
  });
});

describe('the rain delay\'s words (S5, /marketing 2026-10-09)', () => {
  it('a row\'s move drops the first a.m./p.m. only when both clocks share it', () => {
    assert.equal(rainDelayMove('16:00', '17:00', false), '4:00 → 5:00 p.m.');
    assert.equal(rainDelayMove('11:30', '12:30', false), '11:30 a.m. → 12:30 p.m.');
    assert.equal(rainDelayMove('23:00', '00:30', true), '11:00 p.m. → 12:30 a.m., the next day');
  });
  it('the lime says what it does, and who it tells when any of it is published', () => {
    assert.equal(RAIN_DELAY_WORDS.apply(2, 0, true), 'Move 2 games · tells their teams');
    assert.equal(RAIN_DELAY_WORDS.apply(1, 1, false), 'Move 1 game, cancel 1');
    assert.equal(RAIN_DELAY_WORDS.apply(0, 2, false), 'Cancel 2 games');
  });
  it('the notice after, and after its Undo', () => {
    assert.equal(RAIN_DELAY_WORDS.done(2, 0, 60), '2 games moved an hour later');
    assert.equal(RAIN_DELAY_WORDS.done(1, 0, 90), '1 game moved 1 hour 30 minutes later');
    assert.equal(RAIN_DELAY_WORDS.done(2, 1, 60), '2 games moved, 1 cancelled');
    assert.equal(RAIN_DELAY_WORDS.done(0, 2, 0), '2 games cancelled');
    assert.equal(RAIN_DELAY_WORDS.undone, 'The day is back as it was');
    assert.equal(shiftWords(120), '2 hours');
    assert.equal(shiftWords(30), '30 minutes');
  });
  it('the shift is a dropdown: 30 minutes · 1 hour · 2 hours · Another amount', () => {
    assert.deepEqual([30, 60, 120].map(m => RAIN_DELAY_WORDS.shiftChoice(m)), ['30 minutes', '1 hour', '2 hours']);
  });
});
