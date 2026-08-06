import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ASK_QUESTIONS,
  visibleAskQuestions,
  assembleAskAnswer,
  formatDayWords,
  gapPhrase,
  sincePhrase,
  type AskInputs,
  type AskQuestionId,
} from '../../lib/coach-ask-questions.ts';
import { money } from '../../lib/insight-findings.ts';
import { resolveCoachCapabilities, type CoachCapabilities } from '../../lib/coach-capabilities.ts';
import { computePositionRecency } from '../../lib/coach-position-recency.ts';
import { computeFamilyDues } from '../../lib/coach-family-dues.ts';
import { computePracticeMisses } from '../../lib/coach-practice-misses.ts';
import type { SeasonLineupAnalytics } from '../../lib/lineup-season-analytics.ts';

const HEAD = resolveCoachCapabilities('head_coach');
const ASSISTANT = resolveCoachCapabilities('assistant_coach');
const DIAMOND = { hasPitcherPosition: true, hasFieldPositions: true };

function inputs(partial: Partial<AskInputs> = {}): AskInputs {
  return { periodsWord: 'innings', ...partial };
}
function answer(id: AskQuestionId, partial: Partial<AskInputs> = {}) {
  return assembleAskAnswer(id, inputs(partial));
}

function analytics(partial: Partial<SeasonLineupAnalytics> = {}): SeasonLineupAnalytics {
  return { gamesWithLineup: 6, fairPlay: [], benchBalance: [], positionVariety: [], armCare: [], reusedLineups: [], ...partial };
}

// ═══ THE LIBRARY CONTRACT ═══════════════════════════════════════════════════
describe('the question library', () => {
  it('stays under the eight-chip ceiling', () => {
    assert.ok(ASK_QUESTIONS.length <= 8, 'past eight the panel becomes a menu — that is the Phase B signal');
  });

  it('gives every question a unique id and a question-shaped label', () => {
    const ids = ASK_QUESTIONS.map(q => q.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const q of ASK_QUESTIONS) assert.ok(q.label.endsWith('?'), `${q.id} must read as a question`);
  });

  it('produces a non-empty sentence and a receipt list for EVERY question, on empty data', () => {
    for (const q of ASK_QUESTIONS) {
      const a = answer(q.id);
      assert.ok(a.sentence.length > 0, `${q.id} rendered a blank sentence`);
      assert.ok(a.receipts.length > 0, `${q.id} rendered no receipts`);
      assert.equal(a.questionId, q.id);
      assert.equal(a.report, q.report);
    }
  });

  it("every empty state names what would fill it in, and links somewhere", () => {
    for (const q of ASK_QUESTIONS) {
      const a = answer(q.id);
      assert.equal(a.empty, true, `${q.id} should be empty with no data`);
      assert.equal(a.receiptsLabel, 'What would fill this in');
      assert.ok(a.receipts.some(r => r.to), `${q.id} empty state has no next step`);
    }
  });

  // ── THE PROMISE, pinned ────────────────────────────────────────────────────
  // "Every fact in the sentence is provable one tap away in the receipts." A plain slice(0, CAP)
  // broke this: the cited record is usually the OLDEST relevant one, so it was the first to fall
  // off. These two tests exist so that can never come back.
  it('keeps the cited game in the receipts even when many later games push past the cap', () => {
    const players = [{ id: 'maya', name: 'Maya' }, ...Array.from({ length: 8 },
      (_, i) => ({ id: `p${i}`, name: `Sub${i}` }))];
    // Maya caught once in May; eight different players have caught since.
    const games = [
      { eventId: 'g0', day: '2026-05-01', label: 'vs Falcons', byPlayer: [{ playerId: 'maya', positionInnings: { C: 5 } }] },
      ...Array.from({ length: 8 }, (_, i) => ({
        eventId: `g${i + 1}`,
        day: `2026-06-0${i + 1}`,
        label: `Game ${i + 1}`,
        byPlayer: [{ playerId: `p${i}`, positionInnings: { C: 7 } }],
      })),
    ];
    const a = answer('position_recency', {
      position: 'C', positionLabel: 'catcher',
      positionRecency: computePositionRecency({ today: '2026-08-02', games, players, position: 'C' }),
    });
    assert.match(a.sentence, /Maya hasn't played catcher/);
    assert.match(a.sentence, /the last time was May 1 vs Falcons/);
    assert.ok(
      a.receipts.some(r => r.text.includes('Maya') && r.meta === 'May 1'),
      'the sentence cited May 1 but no receipt proves it — the cap dropped the cited record',
    );
    assert.ok(a.receipts.length <= 6 + 1);
  });

  it('keeps a receipt for EVERY family the sentence names, even when one family fills the cap', () => {
    const inst2 = (dueDate: string, amount: number) => ({ dueDate, amount, paidAt: null });
    const family = computeFamilyDues({
      todayISO: '2026-08-02',
      players: [
        // One family with eight unpaid installments — enough to fill the cap on its own.
        { playerId: 'p1', playerName: 'Big Owing', guardianKey: 'a@x.com', guardianLastName: 'Alpha',
          outstanding: 800, installments: Array.from({ length: 8 }, (_, i) => inst2(`2026-0${i + 1}-01`, 100)) },
        { playerId: 'p2', playerName: 'Second', guardianKey: 'b@x.com', guardianLastName: 'Beta',
          outstanding: 50, installments: [inst2('2026-09-01', 50)] },
      ],
    });
    const a = answer('family_dues', { family });
    assert.match(a.sentence, /the Alphas/);
    assert.match(a.sentence, /the Betas/);
    assert.ok(
      a.receipts.some(r => r.text.startsWith('Beta family')),
      'the sentence named the Betas but no receipt backs them',
    );
  });

  it('never puts a link on a real receipt — only on a next step', () => {
    const a = answer('practice_misses', {
      practices: computePracticeMisses({
        records: [
          { eventId: 'e1', day: '2026-07-07', label: 'Tuesday practice', playerId: 'dev', status: 'absent' },
          { eventId: 'e2', day: '2026-07-14', label: 'Tuesday practice', playerId: 'dev', status: 'absent' },
          { eventId: 'e3', day: '2026-07-21', label: 'Tuesday practice', playerId: 'dev', status: 'absent' },
          { eventId: 'e4', day: '2026-07-28', label: 'Tuesday practice', playerId: 'dev', status: 'absent' },
        ],
        players: [{ id: 'dev', name: 'Dev' }],
      }),
    });
    assert.equal(a.empty, false);
    assert.ok(a.receipts.every(r => !r.to));
  });
});

// ═══ CAPABILITY FILTERING ════════════════════════════════════════════════════
describe('visibleAskQuestions', () => {
  it('gives a head coach the whole library on a diamond sport', () => {
    assert.equal(visibleAskQuestions(HEAD, DIAMOND).length, ASK_QUESTIONS.length);
  });

  it('hides BOTH money questions from a default assistant', () => {
    const ids = visibleAskQuestions(ASSISTANT, DIAMOND).map(q => q.id);
    assert.ok(!ids.includes('family_dues'));
    assert.ok(!ids.includes('never_paid'));
    assert.deepEqual(ids, ['position_recency', 'practice_misses', 'playing_time', 'arm_care']);
  });

  it('shows money questions to an assistant granted read-only money', () => {
    const caps = resolveCoachCapabilities('assistant_coach', { money: 'read' });
    const ids = visibleAskQuestions(caps, DIAMOND).map(q => q.id);
    assert.ok(ids.includes('family_dues'));
    assert.ok(ids.includes('never_paid'));
  });

  it('hides the lineup questions from an assistant without lineups', () => {
    const caps = resolveCoachCapabilities('assistant_coach', { lineups: false });
    const ids = visibleAskQuestions(caps, DIAMOND).map(q => q.id);
    assert.deepEqual(ids, ['practice_misses']);
  });

  it('hides the attendance question from an assistant without the attendance duty', () => {
    // A1 (2026-08-03): was `roster: 'off'`. Names are baseline; the chip and its route both key on
    // the attendance grant now, which is what the report is actually for.
    const caps = resolveCoachCapabilities('assistant_coach', { attendance: false });
    assert.ok(!visibleAskQuestions(caps, DIAMOND).map(q => q.id).includes('practice_misses'));
  });

  it('returns NOTHING when a coach may ask nothing — the bar then does not render', () => {
    const caps = resolveCoachCapabilities('assistant_coach', { lineups: false, attendance: false, money: 'off' });
    assert.deepEqual(visibleAskQuestions(caps, DIAMOND), []);
  });

  // ── Sport neutrality ──
  it('drops the arm-care question for a sport with no pitching role', () => {
    const ids = visibleAskQuestions(HEAD, { hasPitcherPosition: false, hasFieldPositions: true }).map(q => q.id);
    assert.ok(!ids.includes('arm_care'));
    assert.ok(ids.includes('position_recency'));
  });

  it('drops the position question for a sport with no fixed positions', () => {
    const ids = visibleAskQuestions(HEAD, { hasPitcherPosition: false, hasFieldPositions: false }).map(q => q.id);
    assert.ok(!ids.includes('position_recency'));
  });

  it('agrees with the route gate for every question and every capability shape', () => {
    const shapes: CoachCapabilities[] = [
      HEAD, ASSISTANT,
      resolveCoachCapabilities('assistant_coach', { money: 'read' }),
      resolveCoachCapabilities('assistant_coach', { money: 'write', attendance: false }),
      resolveCoachCapabilities('assistant_coach', { lineups: false }),
    ];
    for (const caps of shapes) {
      const visible = new Set(visibleAskQuestions(caps, DIAMOND).map(q => q.id));
      for (const q of ASK_QUESTIONS) {
        // The chip filter must be exactly `allows` plus the sport gates — never looser.
        if (visible.has(q.id)) assert.ok(q.allows(caps), `${q.id} shown to a coach ${q.id} forbids`);
      }
    }
  });
});

// ═══ WORDS ═══════════════════════════════════════════════════════════════════
describe('formatting helpers', () => {
  it('formats a day from its parts, never through the runtime zone', () => {
    assert.equal(formatDayWords('2026-07-12'), 'July 12');
    assert.equal(formatDayWords('2026-07-12', 'short'), 'Jul 12');
    assert.equal(formatDayWords('2026-01-01'), 'January 1');
  });
  it('passes anything that is not a calendar day straight through', () => {
    assert.equal(formatDayWords(''), '');
    assert.equal(formatDayWords('soon'), 'soon');
  });
  it('says gaps the way a coach would', () => {
    assert.equal(gapPhrase(0), 'today');
    assert.equal(gapPhrase(1), 'yesterday');
    assert.equal(gapPhrase(5), '5 days');
    assert.equal(gapPhrase(7), '1 week');
    assert.equal(gapPhrase(20), '2 weeks');
    assert.equal(gapPhrase(21), '3 weeks');
  });

  it('varies the preposition with the phrase — never "in yesterday"', () => {
    assert.equal(sincePhrase(0), 'today');
    assert.equal(sincePhrase(1), 'since yesterday');
    assert.equal(sincePhrase(5), 'in 5 days');
    assert.equal(sincePhrase(21), 'in 3 weeks');
  });

  it('shows cents only when there are cents, so a total never contradicts its parts', () => {
    assert.equal(money(240), '$240');
    assert.equal(money(79.5), '$79.50');
    assert.equal(money(1234.05), '$1,234.05');
    // The defect this pins: two parts of $79.50 must not render as $80 + $80 under a $159 total.
    assert.equal(money(79.5 + 79.5), '$159');
  });
});

// ═══ POSITION RECENCY ════════════════════════════════════════════════════════
describe('position recency answer', () => {
  const players = [{ id: 'maya', name: 'Maya' }, { id: 'jordan', name: 'Jordan' }, { id: 'priya', name: 'Priya' }];
  const games = [
    { eventId: 'g1', day: '2026-07-12', label: 'vs Falcons', byPlayer: [{ playerId: 'maya', positionInnings: { C: 5 } }] },
    { eventId: 'g2', day: '2026-07-19', label: 'vs Storm', byPlayer: [{ playerId: 'jordan', positionInnings: { C: 7 } }] },
    { eventId: 'g3', day: '2026-07-26', label: 'vs Comets', byPlayer: [{ playerId: 'priya', positionInnings: { C: 7 } }] },
  ];
  const recency = (today = '2026-08-02') => computePositionRecency({ today, games, players, position: 'C' });

  it('writes the approved sentence, in Sport Pack words', () => {
    const a = answer('position_recency', { position: 'C', positionLabel: 'catcher', positionRecency: recency() });
    assert.equal(
      a.sentence,
      "Maya hasn't played catcher in 3 weeks — the last time was July 12 vs Falcons. Priya and Jordan have covered it since.",
    );
    assert.equal(a.empty, false);
  });

  it('never uses a position code in prose', () => {
    const a = answer('position_recency', { position: 'C', positionLabel: 'catcher', positionRecency: recency() });
    assert.ok(!/\bC\b/.test(a.sentence), 'a raw position code leaked into the sentence');
  });

  it('lists receipts most recent first with short dates', () => {
    const a = answer('position_recency', { position: 'C', positionLabel: 'catcher', positionRecency: recency() });
    assert.equal(a.receipts[0].text, 'vs Comets — Priya at catcher, 7 innings');
    assert.equal(a.receipts[0].meta, 'Jul 26');
    assert.equal(a.receipts.length, 3);
  });

  it('says single coverage plainly rather than inventing a gap story', () => {
    const solo = computePositionRecency({
      today: '2026-08-02', players,
      games: [{ eventId: 'g1', day: '2026-07-26', label: 'vs Comets', byPlayer: [{ playerId: 'priya', positionInnings: { '1B': 7 } }] }],
      position: '1B',
    });
    const a = answer('position_recency', { position: '1B', positionLabel: 'first base', positionRecency: solo });
    assert.match(a.sentence, /^Only Priya has played first base this season/);
    assert.equal(a.empty, false);
  });

  it('does not say "hasn\'t played" when the longest gap is today', () => {
    const a = answer('position_recency', {
      position: 'C', positionLabel: 'catcher',
      positionRecency: computePositionRecency({
        today: '2026-07-26', players,
        games: [{ eventId: 'g3', day: '2026-07-26', label: 'vs Comets', byPlayer: [
          { playerId: 'priya', positionInnings: { C: 4 } }, { playerId: 'jordan', positionInnings: { C: 3 } }] }],
        position: 'C',
      }),
    });
    assert.ok(!a.sentence.includes("hasn't played"));
    assert.match(a.sentence, /played there today/);
  });

  it('is honestly empty for a position nobody has played', () => {
    const a = answer('position_recency', {
      position: '3B', positionLabel: 'third base',
      positionRecency: computePositionRecency({ today: '2026-08-02', players, games, position: '3B' }),
    });
    assert.equal(a.empty, true);
    assert.match(a.sentence, /Nobody has been written in at third base/);
    assert.equal(a.receipts[0].to, 'lineups');
  });
});

// ═══ FAMILY DUES ═════════════════════════════════════════════════════════════
describe('family dues answer', () => {
  const inst = (dueDate: string, amount: number, paidAt: string | null = null) => ({ dueDate, amount, paidAt });
  const rollup = (players: Parameters<typeof computeFamilyDues>[0]['players']) =>
    computeFamilyDues({ players, todayISO: '2026-08-02' });

  const TWO_OWING = rollup([
    { playerId: 'p1', playerName: 'Maya March', guardianKey: 'j@x.com', guardianLastName: 'March', outstanding: 150,
      installments: [inst('2026-06-25', 150, '2026-06-24'), inst('2026-07-25', 150), inst('2026-08-25', 0)] },
    { playerId: 'p2', playerName: 'Dev Okari', guardianKey: 'a@x.com', guardianLastName: 'Okari', outstanding: 90,
      installments: [inst('2026-06-01', 90, '2026-06-01'), inst('2026-07-01', 90, '2026-07-01'), inst('2026-08-01', 90)] },
    { playerId: 'p3', playerName: 'Priya Shah', guardianKey: 'p@x.com', guardianLastName: 'Shah', outstanding: 0,
      installments: [inst('2026-07-01', 200, '2026-07-01')] },
  ]);

  it('writes the approved sentence with correct verb agreement for a surname family', () => {
    const a = answer('family_dues', { family: TWO_OWING });
    assert.equal(
      a.sentence,
      '2 families still owe a combined $240: the Marches owe $150 (installment 2 of 3, due July 25) and the Okaris owe $90 (installment 3 of 3, due August 1).',
    );
  });

  it('switches to "owes" when the family is named by its players', () => {
    const a = answer('family_dues', {
      family: rollup([{ playerId: 'p1', playerName: '#7 Maya R.', guardianKey: 'j@x.com', guardianLastName: null,
        outstanding: 150, installments: [inst('2026-07-25', 150)] }]),
    });
    assert.match(a.sentence, /Maya's family owes \$150/);
    assert.match(a.sentence, /^1 family still owes/);
  });

  it('names two families and counts the rest', () => {
    const many = rollup(['a', 'b', 'c', 'd'].map((k, i) => ({
      playerId: k, playerName: `P${i}`, guardianKey: `${k}@x.com`, guardianLastName: `Sur${k}`,
      outstanding: 100 - i, installments: [inst('2026-07-25', 100 - i)],
    })));
    const a = answer('family_dues', { family: many });
    assert.match(a.sentence, /, and 2 other families\.$/);
  });

  it('marks an overdue installment as overdue in its receipt', () => {
    const a = answer('family_dues', { family: TWO_OWING });
    assert.equal(a.receipts[0].text, 'March family — installment 2 of 3, $150');
    assert.equal(a.receipts[0].meta, 'overdue Jul 25');
  });

  it('celebrates a fully-paid team without claiming families that were never billed', () => {
    const a = answer('family_dues', {
      family: rollup([{ playerId: 'p1', playerName: 'Maya', guardianKey: 'j@x.com', guardianLastName: 'March',
        outstanding: 0, installments: [inst('2026-07-01', 150, '2026-07-01')] }]),
    });
    assert.equal(a.empty, false);
    assert.equal(a.sentence, 'Every family with a dues plan is paid up — all 1 of them.');
  });

  it('is honestly empty when no dues have been set up', () => {
    const a = answer('family_dues', { family: rollup([]) });
    assert.equal(a.empty, true);
    assert.equal(a.receipts[0].to, 'money');
  });
});

// ═══ NEVER PAID ══════════════════════════════════════════════════════════════
describe('never paid answer', () => {
  it('counts and totals without naming anyone in the sentence', () => {
    const a = answer('never_paid', { neverPaid: { names: ['Maya R.', 'Dev O.'], outstanding: 450, billedCount: 12 } });
    assert.equal(a.sentence, "2 players haven't paid anything yet — $450 outstanding between them.");
    assert.deepEqual(a.receipts.map(r => r.text), ['Maya R.', 'Dev O.']);
  });
  it('gets singular grammar right for one player', () => {
    const a = answer('never_paid', { neverPaid: { names: ['Maya R.'], outstanding: 150, billedCount: 12 } });
    assert.equal(a.sentence, "1 player hasn't paid anything yet — $150 outstanding between them.");
  });
  it('says so when everyone has paid something', () => {
    const a = answer('never_paid', { neverPaid: { names: [], outstanding: 0, billedCount: 12 } });
    assert.equal(a.empty, false);
    assert.match(a.sentence, /Every player with a dues plan has paid something/);
  });
  it('is honestly empty when nobody was billed', () => {
    const a = answer('never_paid', { neverPaid: { names: [], outstanding: 0, billedCount: 0 } });
    assert.equal(a.empty, true);
  });
});

// ═══ PRACTICE MISSES ═════════════════════════════════════════════════════════
describe('practice misses answer', () => {
  const rec = (day: string, playerId: string, status: 'absent' | 'attending', label = 'Tuesday practice') =>
    ({ eventId: `ev-${day}`, day, label, playerId, status } as const);
  const PLAYERS = [{ id: 'dev', name: 'Dev' }, { id: 'maya', name: 'Maya' }];
  const SIX = computePracticeMisses({
    players: PLAYERS,
    records: [
      rec('2026-07-07', 'dev', 'absent'), rec('2026-07-07', 'maya', 'attending'),
      rec('2026-07-09', 'dev', 'attending', 'Thursday practice'), rec('2026-07-09', 'maya', 'absent', 'Thursday practice'),
      rec('2026-07-14', 'dev', 'absent'), rec('2026-07-14', 'maya', 'attending'),
      rec('2026-07-16', 'dev', 'attending', 'Thursday practice'), rec('2026-07-16', 'maya', 'attending', 'Thursday practice'),
      rec('2026-07-21', 'dev', 'absent'), rec('2026-07-21', 'maya', 'attending'),
      rec('2026-07-28', 'dev', 'absent'), rec('2026-07-28', 'maya', 'attending'),
    ],
  });

  it('writes the approved sentence including the weekday pattern', () => {
    const a = answer('practice_misses', { practices: SIX });
    assert.equal(
      a.sentence,
      'Dev has missed 4 of the last 6 practices — all Tuesdays. Everyone else has missed 1 or fewer in the same stretch.',
    );
  });

  it('lists the absences as receipts, most recent first', () => {
    const a = answer('practice_misses', { practices: SIX });
    assert.equal(a.receipts[0].text, 'Tuesday practice — Dev absent');
    assert.equal(a.receipts[0].meta, 'Jul 28');
  });

  it('refuses to call a thin sample a pattern', () => {
    const thin = computePracticeMisses({
      players: PLAYERS,
      records: [rec('2026-07-07', 'dev', 'absent'), rec('2026-07-14', 'maya', 'attending'),
                rec('2026-07-21', 'maya', 'attending'), rec('2026-07-28', 'maya', 'attending')],
    });
    const a = answer('practice_misses', { practices: thin });
    assert.match(a.sentence, /too few tracked so far to call it a pattern/);
  });

  it('celebrates full attendance', () => {
    const clean = computePracticeMisses({
      players: PLAYERS,
      records: [rec('2026-07-07', 'dev', 'attending'), rec('2026-07-14', 'dev', 'attending'),
                rec('2026-07-21', 'dev', 'attending'), rec('2026-07-28', 'dev', 'attending')],
    });
    const a = answer('practice_misses', { practices: clean });
    assert.match(a.sentence, /Nobody has missed a practice in the last 4/);
    assert.equal(a.empty, false);
  });

  it('is honestly empty before any attendance is taken', () => {
    const a = answer('practice_misses', { practices: computePracticeMisses({ players: PLAYERS, records: [] }) });
    assert.equal(a.empty, true);
    assert.equal(a.receipts[0].to, 'schedule');
  });
});

// ═══ PLAYING TIME ════════════════════════════════════════════════════════════
describe('playing time answer', () => {
  const fair = [
    { playerId: 'a', name: 'Tess', fieldInnings: 20, benchInnings: 14, games: 6 },
    { playerId: 'b', name: 'Maya', fieldInnings: 30, benchInnings: 4, games: 6 },
  ];
  it('names an outlier when one player has sat far more', () => {
    const a = answer('playing_time', { analytics: analytics({
      fairPlay: fair,
      benchBalance: [{ playerId: 'a', name: 'Tess', benchInnings: 14, backToBackGames: 2 },
                     { playerId: 'b', name: 'Maya', benchInnings: 4, backToBackGames: 0 }],
    }) });
    assert.match(a.sentence, /^Tess has sat the most — 14 innings on the bench, 10 more than anyone else\./);
    assert.match(a.sentence, /2 of those were back-to-back games/);
  });

  it('says playing time is close when the gap is small', () => {
    const a = answer('playing_time', { analytics: analytics({
      fairPlay: fair,
      benchBalance: [{ playerId: 'a', name: 'Tess', benchInnings: 6, backToBackGames: 0 },
                     { playerId: 'b', name: 'Maya', benchInnings: 5, backToBackGames: 0 }],
    }) });
    assert.match(a.sentence, /^Playing time is close/);
  });

  it('sorts receipts least field time first — the fairness order', () => {
    const a = answer('playing_time', { analytics: analytics({ fairPlay: fair, benchBalance: [
      { playerId: 'a', name: 'Tess', benchInnings: 14, backToBackGames: 0 }] }) });
    assert.equal(a.receipts[0].text, 'Tess — 20 on field, 14 on the bench');
    assert.equal(a.receipts[0].meta, '6 games');
  });

  it('refuses to judge fairness on too few lineups', () => {
    const a = answer('playing_time', { analytics: analytics({ gamesWithLineup: 2 }) });
    assert.equal(a.empty, true);
    assert.match(a.sentence, /not enough to say whether playing time is even/);
  });

  it('is honestly empty with no lineups at all', () => {
    const a = answer('playing_time', { analytics: analytics({ gamesWithLineup: 0 }) });
    assert.equal(a.empty, true);
    assert.equal(a.receipts[0].to, 'lineups');
  });
});

// ═══ ARM CARE ════════════════════════════════════════════════════════════════
describe('arm care answer', () => {
  it('leads with a cap the coach set being exceeded', () => {
    const a = answer('arm_care', { pitcherLabel: 'pitcher', analytics: analytics({ armCare: [
      { playerId: 'd', name: 'Dev', inningsPitched: 22, gamesPitched: 6, perGameCap: 4, overCapGames: 1 },
      { playerId: 'a', name: 'Ainsley', inningsPitched: 9, gamesPitched: 3, perGameCap: 4, overCapGames: 0 },
    ] }) });
    assert.match(a.sentence, /^Dev went over the per-game cap you set in 1 game/);
    assert.equal(a.empty, false);
  });

  it('never claims a season ceiling that this product does not have', () => {
    const a = answer('arm_care', { pitcherLabel: 'pitcher', analytics: analytics({ armCare: [
      { playerId: 'd', name: 'Dev', inningsPitched: 22, gamesPitched: 6, perGameCap: 4, overCapGames: 0 },
    ] }) });
    assert.match(a.sentence, /^Nobody has gone over the per-game cap you set\./);
    assert.ok(!/season (limit|cap|ceiling|maximum)/i.test(a.sentence));
  });

  it('attributes the cap to the coach, not to the product', () => {
    const a = answer('arm_care', { pitcherLabel: 'pitcher', analytics: analytics({ armCare: [
      { playerId: 'd', name: 'Dev', inningsPitched: 22, gamesPitched: 6, perGameCap: 4, overCapGames: 2 },
    ] }) });
    assert.match(a.sentence, /cap you set/);
  });

  it('is honestly empty when nobody has been given the ball', () => {
    const a = answer('arm_care', { pitcherLabel: 'pitcher', analytics: analytics({ armCare: [] }) });
    assert.equal(a.empty, true);
    assert.match(a.sentence, /No saved lineup has anyone at pitcher yet/);
  });
});
