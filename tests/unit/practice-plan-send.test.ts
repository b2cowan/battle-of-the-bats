/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **WHO A PRACTICE PLAN REACHES, AND WHAT IT SAYS TO EACH OF THEM.**
 *
 * "Send to staff" (COACH_PRACTICE_WHO_RUNS_IT_PLAN.md §5.3, owner rulings A–K 2026-09-17) has one
 * pure rule for its three audiences, and the sheet's preview and the route's dispatch both read
 * it — so this file pins EACH audience's exact recipient set against a mixed staff fixture (head,
 * two assistants, a manager, a treasurer, a helper, an assistant whose access excludes the
 * schedule, an outside instructor with no account, and the sender), and the identity walk the
 * audience and the "You're on …" line stand on.
 *
 * The rules the fixture is built to exercise:
 *   1. **Never the sender; never someone who cannot open the plan.** Every audience.
 *   2. **"Named in this plan" is by IDENTITY** — a linked tag on any block or station — and it
 *      names the words that are nobody ("Adam — a name only, not sent"), legacy free text included.
 *   3. **"Coaches and helpers" reaches head, assistants and helpers** (ruling A: a helper runs a
 *      station; a practice plan is what a helper is for). Managers and treasurers wait for
 *      "Everyone on staff".
 *   4. **A legacy free-text staff list marks nothing as mine** (ruling E) — the name match this
 *      replaced is gone, and a fallback that worked for some teams would hide the missing link.
 *   5. **The message is personal**: "You're on Close control and Footwork ladder." for a named
 *      recipient, "Read it before 6:00 p.m." for one who is not; the house clock throughout.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  joinNames, myLabelsOnPlan, practiceDayLabel, practicePlanRecipients, practicePlanSentMessage,
  sanitizeAudience, type PracticeStaffPerson, type StaffTagIdentity,
} from '../../lib/practice-plan-send';
import { levelsForStaffTags } from '../../lib/rep-practice-plan';
import { practicePlanEmail } from '../../lib/practice-plan-email';
import type { PracticePlan } from '../../lib/types';

// ── The fixture: the staff, their words, and Tuesday's plan ──────────────────────────────────
const TAGS: StaffTagIdentity[] = [
  { id: 't-sam', name: 'Sam', userId: 'u-sam' },
  { id: 't-jen', name: 'Jen', userId: 'u-jen' },
  { id: 't-craig', name: 'Craig', userId: 'u-craig' },
  { id: 't-priya', name: 'Priya', userId: 'u-priya' },
  { id: 't-adam', name: 'Adam', userId: null },          // the outside instructor — a name only
  { id: 't-pd', name: 'PD coach', userId: null },
];

const person = (p: Partial<PracticeStaffPerson> & Pick<PracticeStaffPerson, 'userId' | 'name' | 'kind'>): PracticeStaffPerson => ({
  kindWord: p.kind === 'head' ? 'Head coach' : p.kind === 'assistant' ? 'Assistant coach' : p.kind === 'helper' ? 'Helper' : p.kind === 'manager' ? 'Team manager' : 'Team treasurer',
  canReadPlan: true,
  tagId: TAGS.find(t => t.userId === p.userId)?.id ?? null,
  ...p,
});

const PEOPLE: PracticeStaffPerson[] = [
  person({ userId: 'u-sam', name: 'Sam Whitfield', kind: 'head' }),
  person({ userId: 'u-jen', name: 'Jen Okafor', kind: 'assistant' }),
  person({ userId: 'u-craig', name: 'Craig Dubois', kind: 'assistant' }),
  person({ userId: 'u-omar', name: 'Omar Haddad', kind: 'assistant' }),           // not on the plan
  person({ userId: 'u-priya', name: 'Priya Raman', kind: 'helper' }),
  person({ userId: 'u-dana', name: 'Dana Lee', kind: 'manager' }),
  person({ userId: 'u-marcus', name: 'Marcus Hill', kind: 'treasurer' }),
  person({ userId: 'u-noschedule', name: 'Lee Park', kind: 'assistant', canReadPlan: false }),
];

const PLAN: PracticePlan = {
  version: 1,
  blocks: [
    { id: 'b-warm', title: 'Warm-up', duration: { minutes: 10 } },
    {
      id: 'b-circuit', title: 'Skills circuit', duration: { minutes: 45 },
      stations: [
        { id: 's-close', name: 'Close control', staffTagIds: ['t-jen', 't-sam'] },
        { id: 's-ladder', name: 'Footwork ladder', staffTagIds: ['t-jen'] },
        { id: 's-finish', name: 'Finishing', staffTagIds: ['t-craig'] },
        { id: 's-gates', name: 'Passing gates', staffTagIds: ['t-adam'] },
        { id: 's-1v1', name: '1v1 to goal', staffTagIds: ['t-priya'] },
        { id: 's-keeper', name: '', staff: ['Old Free Text'] },            // legacy, pre-266
      ],
    },
    { id: 'b-game', title: 'Small-sided game', duration: { restOfPractice: true }, staffTagIds: ['t-jen', 't-craig'] },
  ],
} as PracticePlan;

const names = (r: readonly PracticeStaffPerson[]) => r.map(p => p.name);
const ctx = { senderUserId: 'u-sam', plan: PLAN, staffTags: TAGS };

describe('practicePlanRecipients — the three audiences', () => {
  it('"Named in this plan" reaches exactly the linked people on any block or station — never the sender', () => {
    const { recipients, unlinkedNames } = practicePlanRecipients(PEOPLE, 'named', ctx);
    assert.deepEqual(names(recipients), ['Jen Okafor', 'Craig Dubois', 'Priya Raman']);
    // Sam is on Close control and is the sender; Omar is staff but not on the plan.
    assert.ok(!names(recipients).includes('Sam Whitfield'));
    assert.ok(!names(recipients).includes('Omar Haddad'));
  });

  it('"Named in this plan" names the words that are nobody — an unlinked tag and a legacy free-text name', () => {
    const { unlinkedNames } = practicePlanRecipients(PEOPLE, 'named', ctx);
    assert.deepEqual(unlinkedNames, ['Adam', 'Old Free Text']);
    // "PD coach" is unlinked but NOT on this plan, so it is not reported as "not sent".
    assert.ok(!unlinkedNames.includes('PD coach'));
  });

  it('"Coaches and helpers" reaches head, assistants and helpers — managers and treasurers wait for Everyone (ruling A)', () => {
    const { recipients, unlinkedNames } = practicePlanRecipients(PEOPLE, 'coaches', ctx);
    assert.deepEqual(names(recipients), ['Jen Okafor', 'Craig Dubois', 'Omar Haddad', 'Priya Raman']);
    assert.deepEqual(unlinkedNames, []);
  });

  it('says whether the SENDER is on the plan — the sheet’s "Only you are linked on this plan so far."', () => {
    assert.equal(practicePlanRecipients(PEOPLE, 'named', ctx).senderOnPlan, true);          // Sam is on Close control
    assert.equal(practicePlanRecipients(PEOPLE, 'named', { ...ctx, senderUserId: 'u-omar' }).senderOnPlan, false);
  });

  it('"Everyone on staff" reaches all five kinds — still never the sender', () => {
    const { recipients } = practicePlanRecipients(PEOPLE, 'staff', ctx);
    assert.deepEqual(names(recipients), ['Jen Okafor', 'Craig Dubois', 'Omar Haddad', 'Priya Raman', 'Dana Lee', 'Marcus Hill']);
  });

  it('someone whose access excludes the schedule is in NO audience — the link would refuse them', () => {
    for (const a of ['named', 'coaches', 'staff'] as const) {
      assert.ok(!names(practicePlanRecipients(PEOPLE, a, ctx).recipients).includes('Lee Park'), a);
    }
  });

  it('a plan with no blocks names nobody and reports no words', () => {
    const r = practicePlanRecipients(PEOPLE, 'named', { ...ctx, plan: null });
    assert.deepEqual(r, { recipients: [], unlinkedNames: [], senderOnPlan: false });
  });

  it('sanitizeAudience admits only the three and nothing else', () => {
    assert.equal(sanitizeAudience('named'), 'named');
    assert.equal(sanitizeAudience('coaches'), 'coaches');
    assert.equal(sanitizeAudience('staff'), 'staff');
    assert.equal(sanitizeAudience('everyone'), null);
    assert.equal(sanitizeAudience(undefined), null);
  });
});

describe('levelsForStaffTags — "mine", by identity', () => {
  it('marks a station by its tag and a block by its own staff; a station never marks its block', () => {
    const jen = levelsForStaffTags(PLAN, new Set(['t-jen']));
    assert.deepEqual(jen, { blockIds: ['b-game'], stationIds: ['s-close', 's-ladder'] });
  });

  it('a legacy free-text staff list marks NOTHING (ruling E — no name fallback)', () => {
    const anyone = levelsForStaffTags(PLAN, new Set(['t-sam', 't-jen', 't-craig', 't-priya', 't-adam', 't-pd']));
    assert.ok(!anyone.stationIds.includes('s-keeper'));
  });

  it('ONE station IS the block (D1): a name at both levels reads as one entry, never "Warm-up and Station 1" (review, 2026-09-18)', () => {
    const sole: PracticePlan = { version: 1, blocks: [
      { id: 'b-one', title: 'Warm-up', duration: { minutes: 10 }, staffTagIds: ['t-jen'], stations: [{ id: 's-only', name: 'Rondo', staffTagIds: ['t-jen'] }] },
      { id: 'b-two', title: 'Cool-down', duration: { minutes: 5 }, stations: [{ id: 's-cd', name: '', staffTagIds: ['t-jen'] }] },
    ] } as PracticePlan;
    assert.deepEqual(levelsForStaffTags(sole, new Set(['t-jen'])), { blockIds: ['b-one', 'b-two'], stationIds: [] });
    assert.deepEqual(myLabelsOnPlan(sole, new Set(['t-jen'])), ['Warm-up', 'Cool-down']);
  });

  it('nobody: no tags, no plan', () => {
    assert.deepEqual(levelsForStaffTags(PLAN, new Set()), { blockIds: [], stationIds: [] });
    assert.deepEqual(levelsForStaffTags(null, new Set(['t-jen'])), { blockIds: [], stationIds: [] });
  });
});

describe('the message — personal, in the house clock', () => {
  it('names the recipient’s blocks and stations in practice order', () => {
    assert.deepEqual(myLabelsOnPlan(PLAN, new Set(['t-jen'])), ['Close control', 'Footwork ladder', 'Small-sided game']);
    assert.deepEqual(myLabelsOnPlan(PLAN, new Set(['t-priya'])), ['1v1 to goal']);
    assert.deepEqual(myLabelsOnPlan(PLAN, new Set(['t-omar'])), []);
  });

  it('"You’re on … Arrive by … for …" when named; "Read it before …" when not', () => {
    const named = practicePlanSentMessage({ dayLabel: 'Tuesday', startLabel: '6:00 p.m.', arriveLabel: '5:45 p.m.', myLabels: ['Close control', 'Footwork ladder'] });
    assert.equal(named.title, 'Tuesday’s practice plan is ready');
    assert.equal(named.body, 'You’re on Close control and Footwork ladder. Arrive by 5:45 p.m. for 6:00 p.m.');
    const not = practicePlanSentMessage({ dayLabel: 'Tuesday', startLabel: '6:00 p.m.', arriveLabel: null, myLabels: [] });
    assert.equal(not.body, 'Read it before 6:00 p.m.');
  });

  it('joinNames reads as a sentence', () => {
    assert.equal(joinNames([]), '');
    assert.equal(joinNames(['A']), 'A');
    assert.equal(joinNames(['A', 'B']), 'A and B');
    assert.equal(joinNames(['A', 'B', 'C']), 'A, B and C');
  });

  it('the day word is the weekday for six days and a short date from the seventh — today’s own weekday again', () => {
    const fmt = { weekday: () => 'Tuesday', shortDate: () => 'Sep 29' };
    const now = Date.UTC(2026, 8, 17, 20, 0);            // Thu Sep 17, 4:00 p.m. ET
    const days = (n: number) => new Date(now + n * 86_400_000).toISOString();
    assert.equal(practiceDayLabel(days(5), now, fmt), 'Tuesday');       // five days out
    assert.equal(practiceDayLabel(days(5.9), now, fmt), 'Tuesday');     // the last unambiguous day
    assert.equal(practiceDayLabel(days(6.1), now, fmt), 'Sep 29');      // ⚠ the boundary: no longer "next Wednesday" but the date
    assert.equal(practiceDayLabel(days(7), now, fmt), 'Sep 29');        // a Thursday again — never "Thursday's" on a Thursday
    assert.equal(practiceDayLabel(days(12), now, fmt), 'Sep 29');
    assert.equal(practiceDayLabel(days(0.1), now, fmt), 'Tuesday');     // tonight (the weekday fmt decides the word)
    assert.equal(practiceDayLabel(days(-0.5), now, fmt), 'Tuesday');    // the morning after
  });
});

describe('the coach’s email — the outline with the reader’s rows marked, the coach named, the reason stated', () => {
  const input = {
    coachName: 'Sam Whitfield', teamName: 'Riverdale Ridge U13', dayLabel: 'Tuesday',
    whenLine: 'Tuesday, September 22 · 6:00 p.m.–7:30 p.m.', whereLine: 'Riverdale Fields 2', arriveLabel: '5:45 p.m.',
    myLabels: ['Close control', 'Footwork ladder'], planUrl: 'https://app.example/r/coaches/teams/t/practice/e',
    outline: [
      { time: '6:00 p.m.', title: 'Warm-up', staffLine: 'Whole team', mine: false, stations: [] },
      { time: '6:10 p.m.', title: 'Skills circuit', staffLine: '', mine: false, stations: [
        { name: 'Close control', staffLine: 'Jen · Sam', mine: true },
        { name: 'Finishing', staffLine: 'Craig', mine: false },
      ] },
    ],
  };
  const { subject, html } = practicePlanEmail(input);

  it('subject and opening carry the day, the team and the coach', () => {
    assert.equal(subject, 'Tuesday’s practice plan — Riverdale Ridge U13');
    assert.match(html, /Sam Whitfield sent you the plan for/);
    assert.match(html, /You’re on <strong>Close control and Footwork ladder<\/strong>/);
    assert.match(html, /Arrive by <strong>5:45 p\.m\.<\/strong>/);
  });

  it('the outline marks only the reader’s rows, and the button opens the plan', () => {
    assert.match(html, /Close control — Jen · Sam<span[^>]*> · you<\/span>/);
    assert.doesNotMatch(html, /Finishing — Craig<span/);
    assert.match(html, /href="https:\/\/app\.example\/r\/coaches\/teams\/t\/practice\/e"/);
  });

  it('the footer names the coach and says why it arrived — and there is no unsubscribe', () => {
    assert.match(html, /Sam Whitfield sent this to you directly as staff of Riverdale Ridge U13 — it isn’t affected by your notification settings\./);
    assert.doesNotMatch(html, /unsubscribe/i);
  });

  it('escapes what a coach typed', () => {
    const { html: h } = practicePlanEmail({ ...input, coachName: 'A <b>Coach</b>', whereLine: 'Field & Park' });
    assert.match(h, /A &lt;b&gt;Coach&lt;\/b&gt; sent you/);
    assert.match(h, /Field &amp; Park/);
  });
});
