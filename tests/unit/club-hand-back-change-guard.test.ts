/**
 * CLUB TIER STAGE 11d PART C — A HAND-BACK THE COACH CAN CHANGE, held in place (Asks 10–14 ratified 2026-10-16; hub
 * K4MPu4ni53Ct7yrDcmWJd9 → Mockups → Stage 11d, the "C" links; plan `CLUB_PERMITS_AND_SCHEDULER_PLAN.md` §6d part C;
 * build prompt `CLUB_SCHEDULER_11D_C_BUILD_PROMPT.md`). Its own file, so part B's edits to the shared guards never meet
 * it in a hunk. What part C was built to do, and must not drift back from:
 *
 *   1. KEEP, NEVER DELETE (Ask 10): a hand-back cancels every practice it reaches; the club's own moves keep their rule.
 *   2. TAKE IT BACK (Ask 11): one step, the schedule locked first, four refusals per practice; never Changed since sent.
 *   3. ASK LATER (Ask 12): Accept settles the money and opens nothing; the daily sweep never touches a late ask (mig 331,
 *      the owner's call in the build session).
 *   4. A ROW THAT ISN'T HAPPENING (Ask 14): struck, with a filled QUIET pill beside its title — Handed back and Cancelled,
 *      the list row and the sheet's head — and never the warning amber.
 *   5. THE PHONE: a handed-back practice's end closes the body, with no pinned foot (D2).
 *   6. WHO: Take it back on the schedule's write capability; the late ask on the team's money write access; the money
 *      people's bell only for a coach who couldn't see the tick (Ask 13).
 *   7. THE WORDS, as drawn (C2's four states, C3, Hand back's two changed lines).
 * The database half (every refusal, each mutation killed) is `check:club-money-atomicity -- --mutate`'s T38.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cssRule, functionBody, readCode, readSource } from './_source-code.ts';
import { HAND_BACK_WORDS as H, handedBackSentence } from '../../lib/club-hand-back-words.ts';
import { SCHEDULE_WORDS } from '../../lib/club-schedule-words.ts';
import { canManageSchedule, canWriteMoney, resolveCoachCapabilities } from '../../lib/coach-capabilities.ts';

const M330 = 'supabase/migrations/330_a_hand_back_the_coach_can_change.sql';
const M331 = 'supabase/migrations/331_the_daily_sweep_leaves_a_late_ask.sql';
const SHEET = 'components/coaches/ScheduleEventSheet.tsx';
const VIEWS = 'components/coaches/ScheduleCalendarViews.tsx';
const PARTS = 'components/coaches/ClubSlotParts.tsx';
const CSS = 'app/[orgSlug]/coaches/coaches.module.css';

/** One SQL function's body, from `create or replace function public.{name}(` to its closing `$$;`. */
function sqlFn(file: string, name: string): string {
  const sql = readSource(file);
  const start = sql.indexOf(`create or replace function public.${name}(`);
  assert.ok(start >= 0, `${name} is in ${file}`);
  return sql.slice(start, sql.indexOf('$$;', sql.indexOf('as $$', start) + 5) + 3);
}

describe('1 · keep, never delete (Ask 10)', () => {
  it('the hand-back\'s shared step cancels every practice it reaches — never the retire that deletes an untouched one', () => {
    const events = sqlFn(M330, 'club_hand_back_events');
    assert.match(events, /update rep_team_events set status = 'cancelled', updated_at = now\(\) where id = v_event;/);
    assert.doesNotMatch(events, /club_practice_retire|delete from rep_team_events/);
  });
  it('the club\'s own moves keep their rule: Send the changes still retires (cancel worked-on, delete untouched)', () => {
    assert.match(sqlFn('supabase/migrations/328_a_hand_back_may_ask_for_money_back.sql', 'club_schedule_apply_changes'), /v_fate := club_practice_retire\(v_id\);/);
    assert.doesNotMatch(readSource(M330), /create or replace function public\.(club_practice_retire|club_schedule_apply_changes)\(/);
  });
});

describe('2 · take it back (Ask 11): one step, four refusals per practice, never Changed since sent', () => {
  const step = sqlFn(M330, 'club_hand_back_take_back');
  it('locks the schedule before it reads the hand-back again', () => {
    assert.ok(step.indexOf("from club_schedules where id = v_hb.schedule_id for update") < step.indexOf("from club_schedule_hand_backs where id = p_hand_back for update"));
  });
  it('only a hand-back without money comes back', () => {
    assert.match(step, /if v_hb\.state <> 'landed' then return jsonb_build_object\('ok', false, 'code', 'nothing'\); end if;/);
  });
  it('refuses a practice that started, whose Sunday is gone or another team\'s, that an ask waits on, or whose money was settled', () => {
    assert.match(step, /sl\.removed_at is null and sl\.starts_at > now\(\)\)/, 'not started, not removed');
    assert.match(step, /or exists \(select 1 from club_schedule_slot_teams st where st\.slot_id = v_slot\)/, 'still open, sent or not');
    assert.match(step, /from club_schedule_hand_back_slots w where w\.slot_id = v_slot and w\.waiting/, 'no ask waits on it');
    assert.match(step, /l\.late_for = p_hand_back and l\.state = 'accepted' and ls\.slot_id = v_slot/, 'no money settled for it');
  });
  it('restores the team, the slot and the practice as it was, and the record forgets it', () => {
    assert.match(step, /insert into club_schedule_slot_teams \(slot_id, team_id, org_id\) values \(v_slot, p_team, p_org\);/);
    assert.match(step, /set handed_back_at = null, handed_back_by = null, handed_back_team_id = null/);
    assert.match(step, /update rep_team_events set status = 'scheduled'/);
    assert.match(step, /update club_schedule_hand_back_slots set handed_back = false/);
    assert.doesNotMatch(step, /changed_since_sent/);
  });
  it('the builders are told; families are sent nothing', () => {
    const lib = readCode('lib/club-hand-back.ts');
    assert.match(functionBody(lib, 'takeBack'), /eventType: 'club_schedule_taken_back'/);
    assert.doesNotMatch(lib, /notifyFamilies|family-notify/);
  });
});

describe('3 · ask later (Ask 12): the money only, and the sweep leaves it alone', () => {
  it('Accept on a late ask never calls the opening step', () => {
    const accept = sqlFn(M330, 'club_hand_back_accept');
    const late = accept.slice(accept.indexOf('if v_hb.late_for is not null then\n    -- ⚖ A late ask opens nothing'));
    const branch = late.slice(0, late.indexOf('  else'));
    assert.ok(branch.length > 0, 'the late branch is where the money settles');
    assert.doesNotMatch(branch, /club_hand_back_events/);
    assert.match(branch, /update club_schedule_hand_back_slots hs set waiting = false,\s+handed_back = not exists \(select 1 from club_schedule_slot_teams st where st\.slot_id = hs\.slot_id and st\.team_id = v_hb\.team_id\)/);
  });
  it('a late ask counts every Sunday it asked about (never by date) — but the team\'s own again (the reads)', () => {
    assert.match(readCode('lib/club-hand-back-reads.ts'), /const counted = r\.late_for\s+\? \(r\.state === 'waiting' \? slots\.filter\(s => !s\.slot_id \|\| !holds\.has/);
  });
  it('the daily sweep never selects a late ask — mig 331, its own file (the owner\'s call, its own commit)', () => {
    assert.match(sqlFn(M331, 'club_hand_back_sweep'), /where h\.state = 'waiting' and h\.late_for is null order by h\.asked_at for update skip locked/);
    assert.doesNotMatch(readSource(M330), /create or replace function public\.club_hand_back_sweep\(/);
  });
  it('one late ask over a hand-back, none after the club answered one', () => {
    assert.match(sqlFn(M330, 'club_hand_back_ask_later'), /l\.late_for = p_hand_back and l\.state in \('waiting', 'accepted', 'declined'\)/);
  });
});

describe('4 · a row that isn\'t happening (Ask 14): struck, a filled quiet pill beside its title', () => {
  const views = readCode(VIEWS);
  it('the list row\'s title is the struck name and the pill, both words (Handed back, Cancelled), every event kind', () => {
    assert.match(readCode(PARTS), /export const notOnWord = \(handedBack: boolean \| undefined\) => \(handedBack \? C\.handedBack : STATE_WORDS\.cancelled\);/);
    assert.match(views, /const notOn = cancelled \? notOnWord\(clubSource\?\.handedBack\) : null;/);
    // /design D-1: only the title is struck, the pill right after it, then where it came from — unstruck.
    assert.match(views, /<span className=\{styles\.notOnName\}>\{event\.name\}[^\n]*<\/span>\s*<span className=\{styles\.eventChipCancelled\}>\{notOn\}<\/span>\s*\{clubSource && <span className=\{styles\.eventChipOpp\}>/);
    assert.match(views, /title=\{listTitle\}/);
    assert.match(views, /!listRow && <span className=\{styles\.eventChipCancelled\}>\{notOn\}<\/span>/, 'never a second copy at the row\'s end');
    assert.match(views, /cancelled \? notOnWord\(decor\.clubSourceOf\?\.\(e\)\?\.handedBack\) : null/, 'the desk Month cell\'s title says it too');
    assert.doesNotMatch(views, /className=\{cancelled \? styles\.rowListMuted/, 'the row is never faded (C1b)');
  });
  it('what waits keeps the row\'s end in amber: Money asked on a handed-back practice a late ask waits on', () => {
    assert.match(views, /\{clubSource\?\.ask\?\.late && cancelled && <MoneyAskedPill \/>\}/);
    assert.match(readCode(PARTS), /export function MoneyAskedPill\(\) \{\s*return <span className=\{`\$\{styles\.badge\} \$\{styles\.badgePending\}`\}>\{H\.moneyAskedPill\}<\/span>;/);
  });
  it('the sheet\'s head wears the same pill', () => {
    assert.match(readCode(SHEET), /<span className=\{styles\.eventChipCancelled\}>\s*\{notOnWord\(clubSource\?\.handedBack\)\}/);
  });
  it('the pill is quiet — soft ink on the fill, no border — never the warning amber', () => {
    const css = readSource(CSS);
    const pill = cssRule(css, '.eventChipCancelled');
    assert.match(pill, /color: var\(--text-secondary\);/);
    assert.match(pill, /background: var\(--home-fill, rgba\(255, 255, 255, 0\.09\)\);/);
    assert.match(pill, /border: 1px solid transparent;/);
    assert.doesNotMatch(pill, /--warning/);
    assert.match(cssRule(css, '.notOnName'), /text-decoration: line-through; color: var\(--text-tertiary\);/);
    // /design D-3: a calendar cell is struck the same way and never faded (the pill's ink stays over 4.5 : 1).
    assert.doesNotMatch(css, /\.calChipCancelled \{ opacity/);
    assert.match(css, /\.calChipCancelled \.calChipName \{ text-decoration: line-through; color: var\(--text-tertiary\); \}/);
  });
});

describe('5 · on a phone, a handed-back practice\'s end closes the body — no pinned foot (D2)', () => {
  const sheet = readCode(SHEET);
  it('its block is never the pinned foot', () => {
    const block = sheet.slice(sheet.indexOf('const handedBackBlock ='), sheet.indexOf('const actionsBlock ='));
    assert.match(block, /<div className=\{styles\.slideOverActions\}>/);
    assert.doesNotMatch(block, /slideOverFoot|modalFooter/);
    assert.match(sheet, /const actionsBlock = handedBackBlock \?\? \(canAddEvents \? \(/);
  });
  it('its doors stand one under the other on a phone (each a 44 px row through the sheet\'s actions)', () => {
    const own = readSource('components/coaches/ClubSlot.module.css');
    assert.match(own, /@media \(max-width: 640px\) \{\s*\.doors \{ flex-direction: column; gap: 0; \}/);
  });
});

describe('6 · who', () => {
  it('Take it back: the schedule\'s write capability; the late ask and its Withdraw: the team\'s money write access', () => {
    const take = readCode('app/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/take-back/route.ts');
    assert.equal(take.match(/denyUnless\(canManageSchedule\(r\.capabilities\)/g)?.length, 2, 'GET and POST');
    const money = readCode('app/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/money-back/route.ts');
    assert.match(functionBody(money, 'resolve'), /denyUnless\(canWriteMoney\(r\.capabilities\)/);
    assert.match(readCode('lib/club-practice-route.ts'), /refuseWithoutLiveSeat\(ctx\.org, ctx\.user\.id, teamId\)/);
  });
  it('the money people\'s bell only for a coach who couldn\'t see the tick, and only to money WRITE access', () => {
    const route = readCode('app/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/hand-back/route.ts');
    assert.match(route, /if \(!r\.canMoney\) \{\s*await tellMoneyOfUnasked\(/);
    assert.match(functionBody(readCode('lib/club-hand-back.ts'), 'tellMoneyOfUnasked'), /canWriteMoney\(resolveMembershipCapabilities\(m\)\)/);
  });

  // §319 W5 closed on the owner's word without a walk (2026-10-16): nothing else holds this split. A coach who may hand
  // back (the schedule's write capability) but can't use the team's money is never offered a door the server refuses.
  describe('a coach who can hand back but not use the team\'s money — no tick, no money door, and the route refuses', () => {
    const HAND_BACK = 'app/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/hand-back/route.ts';

    it('the walk\'s assistant (Schedule: Manage, Money: Off) may hand back and may not ask; Money: View may not ask either', () => {
      const off = resolveCoachCapabilities('assistant_coach', { schedule: true, scheduleManage: true, money: 'off' });
      assert.equal(canManageSchedule(off), true);
      assert.equal(canWriteMoney(off), false);
      assert.equal(canWriteMoney(resolveCoachCapabilities('assistant_coach', { schedule: true, scheduleManage: true, money: 'read' })), false);
      assert.equal(canWriteMoney(resolveCoachCapabilities('assistant_coach', { schedule: true, scheduleManage: true, money: 'write' })), true);
      assert.equal(canWriteMoney(resolveCoachCapabilities('head_coach')), true);
    });

    it('the question\'s tick comes only from the server, and the server sends it only to money WRITE access', () => {
      const route = readCode(HAND_BACK);
      assert.match(functionBody(route, 'resolve'), /canMoney: canWriteMoney\(r\.capabilities\)/);
      assert.match(route, /const money = r\.canMoney && !choices\.asked \? await askOffer\(/);
      assert.match(route, /return NextResponse\.json\(\{ \.\.\.choices, money \}\);/);
      const parts = readCode(PARTS);
      const question = parts.slice(parts.indexOf('export function HandBackQuestion('), parts.indexOf('export function WithdrawAskQuestion('));
      assert.match(question, /const money = choices\?\.money \?\? null;/);
      assert.match(question, /\{money && picked && picked\.cents > 0 && \(/, 'no figure from the server, no tick');
      // Without the tick the POST never asks: `asking` needs a figure the server only sends to a money writer.
      assert.match(question, /const asking = askMoney && !!picked && picked\.cents > 0;/);
      assert.match(question, /JSON\.stringify\(\{ scope, askMoney: asking \}\)/);
    });

    it('the route refuses an ask, and a Withdraw, from that coach before anything is written (403 no_money)', () => {
      const route = readCode(HAND_BACK);
      const refusal = "if (!r.canMoney) return NextResponse.json({ error: HAND_BACK_WORDS.refuse.noMoney, code: 'no_money' }, { status: 403 });";
      const post = route.slice(route.indexOf('export const POST'), route.indexOf('export const DELETE'));
      const ask = post.indexOf('if (body.askMoney === true) {');
      assert.ok(ask >= 0 && post.indexOf(refusal) > ask && post.indexOf(refusal) < post.indexOf('await askHandBack('), 'POST: refused before the ask is made');
      const del = route.slice(route.indexOf('export const DELETE'));
      assert.ok(del.indexOf(refusal) >= 0 && del.indexOf(refusal) < del.indexOf('await withdrawAsk('), 'DELETE: refused before the ask is withdrawn');
    });

    it('the practice\'s money doors follow the same access: Ask the club for $X back, and Withdraw the ask', () => {
      const sheet = readCode(SHEET);
      assert.match(sheet, /const canMoney = !!capabilities && canWriteMoney\(capabilities\);/);
      assert.match(sheet, /canSchedule=\{canAddEvents\} canMoney=\{canMoney\}/);
      assert.match(sheet, /onWithdraw=\{capabilities && canWriteMoney\(capabilities\) \? \(\) => setWithdrawingAsk\(true\) : undefined\}/);
      const end = functionBody(readCode(PARTS), 'HandedBackEnd');
      assert.match(end, /const askCents = canMoney && !late \? handBack\.askCents : null;/, 'Ask the club for $X back: money writers only');
      assert.match(end, /\{waiting \? \(canMoney && \(/, 'a late ask\'s Withdraw: money writers only');
    });
  });
});

describe('7 · the words, as drawn', () => {
  const base = {
    kind: 'landed' as const, on: '2026-10-16', days: ['2027-02-07', '2027-02-14', '2027-02-21', '2027-02-28'], thisDay: '2027-02-07',
    slot: 'open' as const, canTakeBack: true, late: null, settled: null, askCents: 43_200, canMoney: true, teamName: '15U AA',
  };
  it('C2: what happened, and until when it can come back', () => {
    assert.equal(handedBackSentence(base),
      'You handed this practice back on Oct 16, with 3 others (Feb 14 – Feb 28). Your families see it as cancelled. Until the club gives the time to another team, you can take it back.');
  });
  it('C2: the time went to another team', () => {
    assert.equal(handedBackSentence({ ...base, slot: 'taken', canTakeBack: false }),
      'You handed this practice back on Oct 16, with 3 others. The club has given this time to another team, so it can’t come back to you.');
  });
  it('C2: settled — the credit, and the paid wording (D5)', () => {
    assert.equal(handedBackSentence({ ...base, canTakeBack: false, settled: { on: '2026-10-19', creditedCents: 43_200, toPayCents: 0 } }),
      'You handed this practice back on Oct 16, with 3 others. The club took $432.00 off what 15U AA owes for them on Oct 19.');
    assert.equal(handedBackSentence({ ...base, canTakeBack: false, settled: { on: '2026-10-19', creditedCents: 0, toPayCents: 43_200 } }),
      'You handed this practice back on Oct 16, with 3 others. The club accepted: it owes 15U AA $432.00 for them.');
  });
  it('C2: an ask with its tick the club accepted — one sentence, its date once (/marketing 2026-10-16)', () => {
    assert.equal(handedBackSentence({ ...base, kind: 'asked', canTakeBack: false, settled: { on: '2026-10-14', creditedCents: 43_200, toPayCents: 0 } }),
      'The club accepted your hand-back of this practice and 3 others on Oct 14: it took $432.00 off what 15U AA owes for them.');
    assert.equal(H.quietGone(2, 7), '2 other Sundays already went to another team.');
    assert.equal(H.quietGone(1, null), '1 other practice already went to another team.');
  });
  it('C2: a coach without money access hears who can ask', () => {
    assert.equal(handedBackSentence({ ...base, canMoney: false }),
      'You handed this practice back on Oct 16, with 3 others (Feb 14 – Feb 28). Your families see it as cancelled. Until the club gives the time to another team, you can take it back. 15U AA’s money people can ask the club for the $432.00 these 4 practices cost.');
  });
  it('C2: a late ask waits', () => {
    assert.equal(H.moneyAskedPill, 'Money asked');
    assert.equal(H.lateAskedLine({ askedOn: '2026-10-18', cents: 43_200, count: 4, on: '2026-10-16' }),
      'You asked the club on Oct 18 for $432.00 back for the 4 practices you handed back on Oct 16. It hasn’t answered yet.');
  });
  it('C3: Take back which practices?, Ask the club for money back?, and Hand back\'s two changed lines', () => {
    assert.equal(H.takeBackQuestion, 'Take back which practices?');
    assert.equal(H.takeBackLead, 'They come back to your schedule and are back on for your families. The club’s schedulers are told.');
    assert.equal(H.takeBackLeft({ taken: ['2027-02-21'], removed: [], can: 2 }), 'Feb 21 went to another team, so 2 can come back.');
    assert.equal(H.takeBackKeep, 'Keep it handed back');
    assert.equal(H.lateQuestion, 'Ask the club for money back?');
    assert.equal(H.lateLead('2026-10-16', 4), 'You handed these practices back on Oct 16 without asking for money. Their time is already open; this asks only for the money.');
    assert.equal(H.lateAsksForHow({ count: 4, weekday: 7, eachCents: 10_800, teamName: '15U AA' }), '4 Sundays at $108.00 each, what the club billed 15U AA for them');
    assert.equal(SCHEDULE_WORDS.handBackWhat, 'The club can give the time to another team. Your families see it as cancelled. Until the club gives it away, you can take it back.');
  });
  it('C4: the club\'s Answer for a late ask, and the two bells', () => {
    assert.equal(H.answerTitleLate('15U AA', 4, 7), '15U AA asks for money back for 4 Sundays');
    assert.equal(H.timeOpen, 'Their time is already open.');
    assert.deepEqual(H.bellUnasked({ name: 'Riley Chen', count: 4, scheduleName: 'Winter dome · Sundays', first: '2027-02-07', cents: 43_200 }), {
      title: 'Riley Chen handed back 4 practices without asking for money',
      body: 'Winter dome · Sundays · from Sun, Feb 7. The club billed $432.00 for them: you can ask for it back from the practice.',
    });
  });
});

describe('8 · the high-risk review\'s fixes (2026-10-16)', () => {
  it('a late ask never asks for, or pays for, a Sunday the club has given back to the team — the step, the offer, the reads', () => {
    assert.match(sqlFn(M330, 'club_hand_back_ask_later'), /and not exists \(select 1 from club_schedule_slot_teams st where st\.slot_id = hs\.slot_id and st\.team_id = p_team\)/);
    const accept = sqlFn(M330, 'club_hand_back_accept');
    assert.match(accept, /and not exists \(select 1 from club_schedule_slot_teams st where st\.slot_id = hs\.slot_id and st\.team_id = v_hb\.team_id\);\n\s+if v_count = 0 then return jsonb_build_object\('ok', false, 'code', 'stale'\); end if;/);
    const reads = readCode('lib/club-hand-back-reads.ts');
    assert.match(reads, /rows\.filter\(r => !\(r\.club_schedule_slots\?\.club_schedule_slot_teams \?\? \[\]\)\.some\(t => t\.team_id === teamId\)\)/, 'the practice\'s figure and its count');
    assert.match(reads, /r\.state === 'waiting' \? slots\.filter\(s => !s\.slot_id \|\| !holds\.has/, 'the lists\' live figure');
    assert.match(functionBody(readCode('lib/club-hand-back.ts'), 'lateAskOffer'), /rows\.filter\(r => !\(r\.club_schedule_slots\?\.club_schedule_slot_teams \?\? \[\]\)\.some\(t => t\.team_id === p\.teamId\)\)/);
  });
  it('a late ask with nothing left to pay says so before Accept, in its own words', () => {
    const view = functionBody(readCode('lib/club-hand-back.ts'), 'answerView');
    assert.match(view, /summary\.lateFor && \(summary\.count === 0 \|\| cents <= 0\) \? \{ code: 'stale', text: W\.refuse\.lateStale \}/);
    assert.ok(H.refuse.lateStale.endsWith('Decline it, or let the coach withdraw it.'));
  });
  it('another coach was first: the two new windows say so and read the practice again (never a stale door)', () => {
    const parts = readCode(PARTS);
    assert.match(parts, /if \(r\.status === 409\) \{ onDone\(data\.error \?\? H\.refuse\.takeBackNothing\); return; \}/);
    assert.match(parts, /if \(r\.status === 409\) \{ onDone\(data\.error \?\? H\.refuse\.lateAsked\); return; \}/);
  });
  it('Take it back\'s rows never promise a practice the step refuses: the team holding that time elsewhere', () => {
    assert.match(functionBody(readCode('lib/club-hand-back.ts'), 'takeBackPlan'), /standing === 'open' && \(!kept\.has\(r\.slot_id!\) \|\| twice\(r\.club_schedule_slots!\)\) \? 'gone' : standing/);
  });
});
