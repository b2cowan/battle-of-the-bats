import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';
import {
  STAFF_PRESETS, canViewMoney, canViewSchedule, resolveCoachCapabilities, type CoachCapabilities,
} from '../../lib/coach-capabilities.ts';
import {
  bellGroups, carriesMoney, emailFor, emailForPerson, inSendAudience, teamBells, teamEmails, unreachableWhy, type TeamBell,
} from '../../lib/club-schedule-money-audience.ts';
import { billNotToldSentence, unreachableSentence, type EmailWords } from '../../lib/club-schedule-words.ts';
import type { SendKind } from '../../lib/club-schedule-send.ts';

/**
 * MONEY TERMS GO ONLY TO PEOPLE WHO CAN OPEN MONEY (owner ruling 2026-11-13; plan
 * docs/projects/active/LATE_BILL_MONEY_AUDIENCE_PLAN.md, "Tests"). Every person is built from the real capability presets —
 * never hand-written booleans — so a preset that changes its money grant changes these answers.
 *
 * The matrix: head coach, Assistant, Helper, Treasurer × late bill, Finalize, changes, review — who is emailed, which
 * email (money / plain / none), and who gets which bell.
 */

const CAPS: Record<string, CoachCapabilities> = {
  head: resolveCoachCapabilities('head_coach'),
  assistant: resolveCoachCapabilities('assistant_coach', STAFF_PRESETS.assistant),
  helper: resolveCoachCapabilities('assistant_coach', STAFF_PRESETS.helper),
  treasurer: resolveCoachCapabilities('assistant_coach', STAFF_PRESETS.treasurer),
  manager: resolveCoachCapabilities('assistant_coach', STAFF_PRESETS.manager),
  readOnlyMoney: resolveCoachCapabilities('assistant_coach', { ...STAFF_PRESETS.assistant, money: 'read' }),
};
type Who = keyof typeof CAPS;
const person = (who: Who) => ({ userId: `u-${who}`, name: `${who[0].toUpperCase()}${who.slice(1)} Coach`, money: canViewMoney(CAPS[who]) });

/** Who a send's people resolver keeps (`schedulePeople` calls the same rule): schedule access, and — for the late bill —
 *  Money too. */
const keeps = (kind: SendKind, who: Who) => inSendAudience(kind, CAPS[who]);

const BILL = { cents: 270000, installments: [
  { installmentNumber: 1, amount: 900, dueDate: '2027-01-01' },
  { installmentNumber: 2, amount: 900, dueDate: '2027-02-01' },
  { installmentNumber: 3, amount: 900, dueDate: '2027-03-01' },
] };
const LOST = { creditCents: 10800, payCents: 5400, moves: [{ dueDate: '2027-02-01', fromCents: 90000, toCents: 79200 }] };

function emails(kind: SendKind, people: ReturnType<typeof person>[]) {
  return teamEmails({
    kind, orgName: 'Riverside Ball', scheduleName: 'Winter Dome', teamName: '15U AAA', people,
    lines: kind === 'changes' ? ['Gains Sun, Jan 10, 7:00 p.m. · Lane 2'] : ['Sundays 7:00 p.m. – 8:00 p.m. · Lane 2'],
    venueName: 'The Dome', slotCount: 12, firstDay: '2027-01-03', lastDay: '2027-03-21', replyBy: kind === 'review' ? '2026-12-01' : null,
    bill: kind === 'changes' ? null : BILL,
    billedCents: kind === 'changes' ? 21600 : null, lost: kind === 'changes' ? LOST : null,
    link: '/riverside/coaches/teams/t1/schedule', moneyLink: '/riverside/coaches/teams/t1/money?section=club',
  });
}
function bells(kind: SendKind, staff: ReturnType<typeof person>[]): TeamBell[] {
  return teamBells({
    kind, orgName: 'Riverside Ball', scheduleName: 'Winter Dome', replyBy: kind === 'review' ? '2026-12-01' : null, staff,
    team: { teamName: '15U AAA', slots: 12, lines: ['x'], bill: kind === 'changes' ? null : BILL, billedCents: kind === 'changes' ? 21600 : null },
  });
}
const text = (w: EmailWords) => [w.subject, w.greeting, ...w.paragraphs, ...w.lists.flatMap(l => [l.title ?? '', ...l.items]), w.link?.label ?? '', w.outro ?? ''].join('\n');
const MONEY_WORDS = /\$|Club tab|correction|owed|owes|bill/i;
const bellText = (b: TeamBell) => `${b.title}\n${b.body}`;

describe('the presets: who can open Money (read counts)', () => {
  it('head coach, Treasurer and Manager hold Money; Assistant and Helper do not; all four see the schedule', () => {
    assert.equal(person('head').money, true);
    assert.equal(person('treasurer').money, true);
    assert.equal(person('manager').money, true);
    assert.equal(person('assistant').money, false);
    assert.equal(person('helper').money, false);
    for (const who of ['head', 'assistant', 'helper', 'treasurer'] as Who[]) assert.ok(canViewSchedule(CAPS[who]), who);
  });
  it('money `read` counts as access: a custom assistant with read gets the full email', () => {
    const p = person('readOnlyMoney');
    assert.equal(p.money, true);
    const e = emails('final', [person('head'), p, person('assistant')]);
    assert.equal(emailFor(e, p), e.sample);
    assert.match(text(emailFor(e, p)), /The bill is on your Money › Club tab/);
  });
});

describe('the matrix: preset × send, alongside a head coach (a mixed team)', () => {
  const KINDS: SendKind[] = ['bill', 'final', 'changes', 'review'];
  for (const kind of KINDS) {
    for (const who of ['head', 'treasurer', 'assistant', 'helper'] as Who[]) {
      it(`${who} · ${kind}`, () => {
        const team = (['head', who] as Who[]).filter((w, i, a) => a.indexOf(w) === i).filter(w => keeps(kind, w)).map(person);
        const me = team.find(p => p.userId === `u-${who}`);
        const e = emails(kind, team);
        const b = bells(kind, team);
        const mine = b.filter(x => x.userIds.includes(`u-${who}`));
        const money = canViewMoney(CAPS[who]);
        if (kind === 'bill' && !money) {
          // Late bill: no email, no bell.
          assert.equal(me, undefined, 'not emailed');
          assert.deepEqual(mine, [], 'no bell');
          return;
        }
        assert.ok(me, 'emailed');
        const got = emailFor(e, me);
        if (money) {
          assert.equal(got, e.sample, 'the money email');
          assert.match(text(got), kind === 'changes' ? /correction of \$216\.00/ : /\$2,700\.00/);
          if (kind === 'bill') assert.deepEqual(mine.map(x => x.eventType), ['club_bill_arrived']);
          if (kind === 'final') assert.deepEqual(mine.map(x => x.eventType), ['club_schedule_final', 'club_bill_arrived']);
          if (kind === 'changes') assert.deepEqual(mine.map(x => x.eventType), ['club_schedule_changes', 'club_bill_arrived']);
          if (kind === 'review') {
            assert.deepEqual(mine.map(x => x.eventType), ['club_schedule_review']);
            assert.match(mine[0].body, /and a \$2,700\.00 bill/);
          }
        } else {
          assert.equal(got, e.plainSample, 'the plain email');
          assert.notEqual(got, e.sample);
          assert.doesNotMatch(text(got), MONEY_WORDS);
          assert.ok(mine.length > 0, 'still gets the slots bell');
          for (const x of mine) {
            assert.notEqual(x.eventType, 'club_bill_arrived');
            assert.doesNotMatch(bellText(x), /\$|bill/i);
          }
          assert.deepEqual(mine.map(x => x.eventType), [kind === 'final' ? 'club_schedule_final' : kind === 'changes' ? 'club_schedule_changes' : 'club_schedule_review']);
        }
      });
    }
  }
  it('the money email does carry the money (so the plain one is a real difference)', () => {
    const fin = emails('final', [person('head'), person('assistant')]);
    assert.match(text(fin.sample), /Club tab/);
    assert.match(text(fin.sample), /bill/);
    const ch = emails('changes', [person('head'), person('assistant')]);
    assert.match(text(ch.sample), /correction/);
    assert.match(text(ch.sample), /owes/);
    const rv = emails('review', [person('head'), person('helper')]);
    assert.match(rv.sample.subject, /slots and bill/);
    assert.doesNotMatch(rv.plainSample!.subject, /bill/);
  });
  it('each email greets only the people it goes to', () => {
    const e = emails('final', [person('head'), person('assistant')]);
    assert.equal(e.sample.greeting, 'Hi Head,');
    assert.equal(e.plainSample!.greeting, 'Hi Assistant,');
  });
});

describe('a team with nobody who can open Money', () => {
  const team = (kind: SendKind) => (['assistant', 'helper'] as Who[]).filter(w => keeps(kind, w)).map(person);
  it('late bill: nobody is kept, so the team is unreachable (the engine says why)', () => {
    assert.deepEqual(team('bill'), []);
  });
  it('Finalize: the slots go, as the plain email, and the bill reaches nobody (`billNotTold`)', () => {
    const e = emails('final', team('final'));
    assert.equal(e.plainSample, null, 'not mixed: one email');
    assert.doesNotMatch(text(e.sample), MONEY_WORDS);
    assert.equal(e.billNotTold, true);
    assert.deepEqual(bells('final', team('final')).map(b => b.eventType), ['club_schedule_final']);
  });
  it('changes: the same', () => {
    const e = emails('changes', team('changes'));
    assert.doesNotMatch(text(e.sample), MONEY_WORDS);
    assert.equal(e.billNotTold, true);
  });
  it('review is not a bill being booked: the plain email, no warning', () => {
    const e = emails('review', team('review'));
    assert.doesNotMatch(text(e.sample), MONEY_WORDS);
    assert.equal(e.billNotTold, false);
  });
  it('a team whose send carries no money is never warned', () => {
    const e = teamEmails({
      kind: 'final', orgName: 'R', scheduleName: 'W', teamName: 'T', people: team('final'), lines: [], venueName: 'D', slotCount: 1,
      firstDay: '2027-01-03', lastDay: '2027-01-03', replyBy: null, bill: null, billedCents: null, lost: null, link: '/x', moneyLink: '/y',
    });
    assert.equal(e.billNotTold, false);
    assert.equal(e.carries, false);
  });
});

describe('emailFor never hands a money-off person the money email (every preset pair)', () => {
  const all: Who[] = ['head', 'assistant', 'helper', 'treasurer', 'manager', 'readOnlyMoney'];
  for (const kind of ['final', 'changes', 'review'] as SendKind[]) {
    it(kind, () => {
      for (const a of all) for (const b of all) {
        const team = [...new Set([a, b])].map(person);
        const e = emails(kind, team);
        for (const p of team) {
          const got = emailFor(e, p);
          if (!p.money) assert.doesNotMatch(text(got), MONEY_WORDS, `${kind} ${a}+${b} → ${p.userId}`);
          else assert.match(text(got), /\$/, `${kind} ${a}+${b} → ${p.userId}`);
        }
      }
    });
  }
});

describe('bellGroups', () => {
  for (const who of ['head', 'assistant', 'helper', 'treasurer'] as Who[]) {
    it(`${who}: in everyone; in money only when they can open Money and there is a bill`, () => {
      const staff = [person(who)];
      const withBill = bellGroups({ staff, hasBill: true });
      assert.deepEqual(withBill.everyone, [`u-${who}`]);
      assert.deepEqual(withBill.money, person(who).money ? [`u-${who}`] : []);
      assert.deepEqual(withBill.plain, person(who).money ? [] : [`u-${who}`]);
      const noBill = bellGroups({ staff, hasBill: false });
      assert.deepEqual(noBill.money, []);
      assert.deepEqual(noBill.plain, [`u-${who}`]);
    });
  }
  it('a review with no bill is one bell to everyone', () => {
    const team = [person('head'), person('assistant')];
    const b = teamBells({ kind: 'review', orgName: 'R', scheduleName: 'W', replyBy: null, staff: team, team: { teamName: 'T', slots: 3, lines: [], bill: null, billedCents: null } });
    assert.equal(b.length, 1);
    assert.deepEqual(b[0].userIds, ['u-head', 'u-assistant']);
  });
});

describe('Bill the corrections off (Q-D): the team is told no correction and no credit', () => {
  // The engine nulls the TEAM's `billedCents` and `lost` under the switch (guarded in club-scheduler-guard.test.ts, with
  // the step's own inputs left whole); here, what that does to what a Money holder is told.
  it('the email has no correction or credit line, and there is no correction bell', () => {
    const team = [person('head'), person('assistant')];
    const e = teamEmails({
      kind: 'changes', orgName: 'R', scheduleName: 'Winter Dome', teamName: '15U AAA', people: team, lines: ['Gains Sun, Jan 10'],
      venueName: '', slotCount: 0, firstDay: '2027-01-03', lastDay: '2027-01-03', replyBy: null, bill: null, billedCents: null, lost: null,
      link: '/x', moneyLink: '/y',
    });
    assert.equal(e.carries, false);
    assert.equal(e.plainSample, null, 'one email for everyone');
    assert.doesNotMatch(text(e.sample), MONEY_WORDS);
    const b = teamBells({ kind: 'changes', orgName: 'R', scheduleName: 'W', replyBy: null, staff: team, team: { teamName: 'T', slots: 0, lines: ['x'], bill: null, billedCents: null } });
    assert.deepEqual(b.map(x => x.eventType), ['club_schedule_changes']);
    assert.deepEqual(b[0].userIds, ['u-head', 'u-assistant']);
  });
});

describe('why a team can\'t be reached, and what the window says', () => {
  it('the sender first, then a waiting invitation, then an active head coach with no email, else no head coach', () => {
    assert.equal(unreachableWhy({ senderEligible: true, invitationWaiting: true, activeHeadCoaches: 1 }), 'only_you');
    assert.equal(unreachableWhy({ senderEligible: false, invitationWaiting: true, activeHeadCoaches: 1 }), 'invitation_unanswered');
    assert.equal(unreachableWhy({ senderEligible: false, invitationWaiting: false, activeHeadCoaches: 1 }), 'head_coach_no_email');
    assert.equal(unreachableWhy({ senderEligible: false, invitationWaiting: false, activeHeadCoaches: 0 }), 'no_head_coach');
  });
  it('a late bill\'s "only you" says Money access; every other send keeps schedule access', () => {
    assert.equal(unreachableSentence('14U AA', 'only_you', 4, 'bill'),
      '14U AA has nobody with Money access but you. Its bill goes on its Money › Club tab; nobody is emailed about it. Name or chase its coach from its Coaches page.');
    assert.match(unreachableSentence('14U AA', 'only_you', 4, 'final'), /has nobody with schedule access but you\./);
  });
  it('a head coach with no address on file is said as that, not "has no head coach"', () => {
    assert.match(unreachableSentence('14U AA', 'head_coach_no_email', 4, 'final'), /^14U AA has a head coach with no email address on file\. /);
  });
  it('a team whose only schedule people are an Assistant and a Helper: a late bill reaches nobody, and says why truly', () => {
    const kept = (['assistant', 'helper'] as Who[]).filter(w => keeps('bill', w));
    assert.deepEqual(kept, []);
    // No head coach on the team, no invitation, sender not on it.
    const why = unreachableWhy({ senderEligible: false, invitationWaiting: false, activeHeadCoaches: 0 });
    assert.match(unreachableSentence('14U AA', why, 0, 'bill'), /^14U AA has no head coach\. Its bill goes on its Money › Club tab; nobody is emailed about it\./);
  });
  it('the warning under a team whose bill reaches nobody', () => {
    assert.equal(billNotToldSentence('15U AAA'), '15U AAA’s bill goes on its Money › Club tab; nobody with Money access is emailed about it.');
    assert.equal(billNotToldSentence('15U AAA', true), '15U AAA’s credit goes on its Money › Club tab; nobody with Money access is emailed about it.');
  });
});

describe('carriesMoney uses the words\' own truthiness', () => {
  it('a zero correction or a lost time with no amount carries nothing', () => {
    assert.equal(carriesMoney({ bill: null, billedCents: 0, lost: null }), false);
    assert.equal(carriesMoney({ bill: null, billedCents: null, lost: { creditCents: 0, payCents: 0 } }), false);
    assert.equal(carriesMoney({ bill: null, billedCents: null, lost: { creditCents: 0, payCents: 1 } }), true);
    assert.equal(carriesMoney({ bill: BILL, billedCents: null, lost: null }), true);
  });
});

/**
 * ONLY THE HEAD COACH ANSWERS A REVIEW (owner 2026-11-14, Q-E). The review email and bell tell everyone with schedule access
 * about the proposal, but only the head coach has the card to answer on (the card route returns nothing for anyone else).
 * An Assistant or Helper reads the same email without the reply sentence and the "Review it" link, and their bell has no
 * "Reply by". Every other send, and the head coach's own review, are unchanged.
 */
describe('Q-E: the reply line belongs to the head coach', () => {
  const people = (['head', 'assistant', 'helper', 'readOnlyMoney'] as Who[]).map(w => ({ ...person(w), isHeadCoach: w === 'head' }));
  const team = emails('review', people);
  const mailFor = (who: Who, kind: SendKind = 'review') => emailForPerson(kind, '2026-12-01', team, { money: canViewMoney(CAPS[who]), isHeadCoach: who === 'head' });
  it('the head coach reads the reply sentence and the link, as before', () => {
    const w = mailFor('head');
    assert.ok((w.outro ?? '').endsWith('Reply by Tue, Dec 1: Looks good, or Ask for a change.'));
    assert.match(w.link?.label ?? '', /^Review it on/);
  });
  it('an Assistant, a Helper and a read-only Money Assistant read neither', () => {
    for (const who of ['assistant', 'helper', 'readOnlyMoney'] as Who[]) {
      const w = mailFor(who);
      assert.ok(!/Looks good|Ask for a change|Reply/.test(text(w)), who);
      assert.equal(w.link, null, who);
      assert.match(w.outro ?? '', /^Nothing is on your schedule/, who);
    }
  });
  it('nothing else about their email moves: the same slots, and the money rule still holds', () => {
    const head = mailFor('head'), helper = mailFor('helper');
    assert.deepEqual(helper.lists.map(l => l.items), emailFor(team, { money: false }).lists.map(l => l.items));
    assert.ok(!MONEY_WORDS.test(text(helper).replace('Nothing is on your schedule until the club finalizes it.', '')), 'no money word reaches a person without Money');
    assert.match(text(head), /Club tab/, 'the head coach still reads the bill');
  });
  it('only a review is touched', () => {
    for (const kind of ['final', 'changes'] as SendKind[]) {
      const t = emails(kind, people);
      const a = emailForPerson(kind, null, t, { money: false, isHeadCoach: false }), b = emailFor(t, { money: false });
      assert.deepEqual(a, b, kind);
    }
  });
  it('the bell: "Reply by" only for the head coach, in both the money and the plain group', () => {
    const staff = people;
    const review = bells('review', staff).filter(b => b.eventType === 'club_schedule_review');
    const replyTo = (who: Who) => review.find(b => b.userIds.includes(`u-${who}`))!;
    assert.ok(replyTo('head').body.includes('Reply by Tue, Dec 1.'));
    for (const who of ['assistant', 'helper', 'readOnlyMoney'] as Who[]) assert.ok(!/Reply/.test(replyTo(who).body), who);
    assert.ok(replyTo('readOnlyMoney').body.includes('$2,700.00 bill'), 'a Money holder who is not the head coach still reads the bill');
    assert.ok(!replyTo('helper').body.includes('$'), 'a person without Money reads no figure');
  });
  it('the send and the window both go through the one rule', () => {
    const send = fs.readFileSync('lib/club-schedule-send.ts', 'utf8');
    assert.ok(send.includes('emailForPerson(kind, preview.replyBy, t, p)'));
    assert.ok(fs.readFileSync('components/admin/kit/club/schedules/SendWindow.tsx', 'utf8').includes('withoutReviewReply('));
  });
});
