/**
 * HAND-BACK DOLLARS GO ONLY TO PEOPLE WHO CAN OPEN MONEY (owner 2026-11-14, Q-A of `LATE_BILL_MONEY_AUDIENCE_PLAN.md`).
 * A staff member without Money still sees that a practice was handed back, that the club was asked and how it answered;
 * the figure is taken out on the server (`withoutClubMoney`), so it never reaches their browser, and the words read
 * without it. A person who CAN open Money reads exactly what they did before.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { HAND_BACK_WORDS as H, handedBackSentence } from '../../lib/club-hand-back-words.ts';
import { withoutClubMoney } from '../../lib/club-hand-back-money.ts';
import type { ClubSourceRead } from '../../lib/club-schedule-coach.ts';
import type { PracticeHandBack } from '../../lib/club-hand-back-reads.ts';

const handBack: PracticeHandBack = {
  id: 'hb1', kind: 'asked', scheduleId: 's1', scheduleName: 'Winter dome', on: '2026-10-16',
  days: ['2027-02-07', '2027-02-14'], slot: 'open', canTakeBack: false, askCents: 43_200,
  late: { id: 'l1', state: 'declined', askedOn: '2026-10-18', closedOn: '2026-10-20', cents: 43_200, count: 2, reason: null },
  settled: { on: '2026-10-19', creditedCents: 43_200, toPayCents: 100 },
};
const source: ClubSourceRead = {
  scheduleId: 's1', scheduleName: 'Winter dome', handedBackTeamId: 't1', handedBack: true, handBack,
  ask: { id: 'a1', askedAt: '2026-10-12T10:00:00Z', count: 4, first: '2027-03-07', last: '2027-03-28', cents: 43_200, late: false },
};

describe('the read: dollars leave the server only for a viewer who can open Money', () => {
  const shown = withoutClubMoney({ slot1: source }).slot1;
  it('every figure is taken out, and the facts stay', () => {
    assert.equal(shown.ask?.cents, null);
    assert.equal(shown.ask?.count, 4);
    assert.equal(shown.handBack?.late?.cents, null);
    assert.equal(shown.handBack?.late?.state, 'declined');
    assert.equal(shown.handBack?.settled?.creditedCents, null);
    assert.equal(shown.handBack?.settled?.toPayCents, null);
    assert.equal(shown.handBack?.settled?.on, '2026-10-19');
    assert.equal(shown.handBack?.askCents, 0, 'something to ask, figure withheld');
    assert.equal(shown.handedBack, true);
  });
  it('nothing to ask stays nothing to ask, and no ask or hand-back stays none', () => {
    const quiet = withoutClubMoney({ a: { ...source, handBack: { ...handBack, askCents: null, late: null, settled: null }, ask: null }, b: { ...source, ask: null, handBack: null } });
    assert.equal(quiet.a.handBack?.askCents, null);
    assert.equal(quiet.a.ask, null);
    assert.equal(quiet.b.handBack, null);
  });
  it('the events route applies it unless the viewer can open Money', () => {
    assert.ok(readCode('app/api/coaches/[orgSlug]/teams/[teamId]/events/route.ts').includes('clubSources: canViewMoney(capabilities) ? clubSources : withoutClubMoney(clubSources)'));
  });
});

describe('the words: the same sentences without the dollars', () => {
  const base = {
    kind: 'landed' as const, on: '2026-10-16', days: ['2027-02-07', '2027-02-14'], thisDay: '2027-02-07',
    slot: 'open' as const, canTakeBack: false, late: null, settled: null, askCents: 0, canMoney: false, teamName: '15U AA',
  };
  it('a waiting ask reads without "with $X back"', () => {
    assert.equal(H.askedLine({ askedOn: '2026-10-12', count: 4, first: '2027-03-07', last: '2027-03-28', cents: null }),
      'You asked the club on Oct 12 to hand back 4 practices, Mar 7 – Mar 28. It hasn’t answered yet; until it does, they’re yours.');
    assert.match(H.askedLine({ askedOn: '2026-10-12', count: 4, first: '2027-03-07', last: '2027-03-28', cents: 43_200 }), /, with \$432\.00 back\./);
  });
  it('a later ask reads "for money back"', () => {
    assert.equal(H.lateAskedLine({ askedOn: '2026-10-18', cents: null, count: 2, on: '2026-10-16' }),
      'You asked the club on Oct 18 for money back for the 2 practices you handed back on Oct 16. It hasn’t answered yet.');
  });
  it('a coach without Money is still told who can ask, without the figure', () => {
    assert.match(handedBackSentence(base), /15U AA’s money people can ask the club for the money back for these 2 practices\.$/);
    assert.ok(!handedBackSentence(base).includes('$'));
    assert.match(handedBackSentence({ ...base, askCents: 43_200 }), /for the \$432\.00 these 2 practices cost\.$/, 'a reader of Money who cannot write still sees the figure');
    assert.ok(!handedBackSentence({ ...base, askCents: null }).includes('money people'), 'nothing to ask, nothing said');
  });
  it('the club\'s answer is said without the figures', () => {
    const settledHidden = { on: '2026-10-19', creditedCents: null, toPayCents: null };
    assert.equal(handedBackSentence({ ...base, settled: settledHidden }),
      'You handed this practice back on Oct 16, with 1 other. The club accepted your ask for the money on Oct 19.');
    assert.equal(handedBackSentence({ ...base, kind: 'asked', settled: settledHidden }),
      'The club accepted your hand-back of this practice and 1 other on Oct 19.');
    const declined = handedBackSentence({ ...base, askCents: null, late: { state: 'declined', closedOn: '2026-10-20', cents: null, reason: null } });
    assert.match(declined, /The club declined your ask for money back on Oct 20\.$/);
    assert.ok(!declined.includes('$'));
  });
});
