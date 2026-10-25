/**
 * NEEDS ATTENTION CLEARS ITSELF (owner ruling 2026-10-16, Owner QA §322 "Found before W2"; plan
 * docs/projects/active/NEEDS_ATTENTION_CLEARS_ITSELF_PLAN.md, hub Cv4TBP7XMMXnG4ZWVHB6J9).
 *
 * The rulings this file holds:
 *   1. a Needs-attention notification clears itself for everyone once its record stops waiting — ALL kinds: the
 *      rulebook is total over them, and the common settle steps clear on the spot;
 *   2. the four retired kinds are not Needs attention any more;
 *   3. the three notices that reached people who can't act now name who can (owners · Rep Teams · check-in);
 *   A1–A6 the hint's words, the settled line, the onward button on a settled one, the doors' exact outcome.
 * Pure modules are imported; server modules are read as source.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { functionBody, readCode } from './_source-code.ts';
import { NEEDS_ATTENTION_KINDS, NOTIFICATION_CATEGORY } from '../../lib/notification-labels.ts';
import { DOOR_WORDS, NEEDS_ATTENTION_HINT, SETTLED_WORDS as W } from '../../lib/needs-attention-words.ts';
import { doorNote } from '../../lib/needs-attention-door.ts';
import { notificationDestination } from '../../lib/notification-view.ts';
import { registrationAmountDue, registrationFee } from '../../lib/registration-amount-due.ts';

const LIB = readCode('lib/needs-attention.ts');

describe('1 · the rulebook is total over the Needs-attention kinds', () => {
  it('names exactly the fifteen kinds that wait on someone', () => {
    assert.deepEqual([...NEEDS_ATTENTION_KINDS].sort(), [
      'assistant_coach_approval_requested', 'card_refund_failed', 'club_hand_back_asked', 'club_hand_back_unasked', 'club_payment_handed_off',
      'club_schedule_review', 'online_payment_not_recorded', 'payment_failed', 'payouts_need_attention', 'team_coach_payment_reminder',
      'team_money_sent', 'team_move_requested', 'team_no_show', 'team_request_filed', 'team_request_holding_payout',
    ]);
  });

  it('has one entry per kind, and no other', () => {
    const body = /NEEDS_ATTENTION_END: Record<NeedsAttentionKind, Resolver> = \{([\s\S]*?)\n\};/.exec(LIB)?.[1];
    assert.ok(body, 'the rulebook object is gone');
    const keys = [...body.matchAll(/^\s*([a-z_]+):/gm)].map(m => m[1]).sort();
    assert.deepEqual(keys, [...NEEDS_ATTENTION_KINDS].sort());
  });

  it('runs before the bell is counted or listed, and every list carries the settled lines', () => {
    const route = functionBody(readCode('app/api/notifications/route.ts').replace('export const GET = withObservability(async', 'function GET('), 'GET');
    const pass = route.indexOf('await clearSettledForReader(user.id, bell)');
    assert.ok(pass > 0, 'the reader’s pass is gone');
    assert.ok(pass < route.indexOf(".select('id', { count: 'exact', head: true })"), 'the pass must run before the count');
    // Only a cleared row can be settled (the pass just cleared every settled one), so only those are read.
    assert.match(route, /settledLines\(\(rows as NoticeRow\[\]\)\.filter\(r => r\.cleared_at\), user\.id\)/);
  });

  it('never clears on doubt, and both passes swallow their failures', () => {
    assert.match(LIB, /const isSettled = \(v: Verdict \| undefined\): v is Settled => !!v && v !== 'waiting'/);
    assert.match(functionBody(LIB, 'clearSettledForReader'), /catch \(e\)/);
    assert.match(functionBody(LIB, 'clearSettled'), /catch \(e\)/);
    // A cleared row is read too: a settled notification is neither waiting nor news.
    assert.match(functionBody(LIB, 'clearIds'), /update\(\{ read_at: now \}\)[\s\S]*\.is\('read_at', null\)/);
  });

  // The common settle steps clear on the spot (every copy, for everyone); the reader's pass catches the rest.
  const SPOTS: [string, string, string, RegExp][] = [
    ['lib/club-hand-back.ts', 'acceptAsk', 'accept', /kinds: \['club_hand_back_asked'/],
    ['lib/club-hand-back.ts', 'declineAsk', 'decline', /kinds: \['club_hand_back_asked'/],
    ['lib/club-hand-back.ts', 'withdrawAsk', 'withdraw', /kinds: \['club_hand_back_asked'/],
    ['lib/club-hand-back.ts', 'askLater', 'a late ask', /kinds: \['club_hand_back_unasked'\]/],
    ['lib/club-hand-back.ts', 'takeBack', 'take it back', /kinds: \['club_hand_back_unasked'\]/],
    ['lib/club-money-moves.ts', 'clubReceiveInstallment', 'confirm received', /kinds: \['team_money_sent'\]/],
    ['lib/club-money-moves.ts', 'coachTakeBackInstallment', 'the coach takes "sent" back', /kinds: \['team_money_sent'\]/],
    ['lib/club-money-moves.ts', 'clubApproveRequest', 'approve', /kinds: \['team_request_filed', 'team_request_holding_payout'\]/],
    ['lib/club-money-moves.ts', 'clubDeclineRequest', 'decline', /kinds: \['team_request_filed', 'team_request_holding_payout'\]/],
    ['lib/team-ownership-transfer.ts', 'approveTeamMove', 'a move accepted', /orgIds: \[link\.linked_org_id, workspace\.workspace_org_id\], kinds: \['team_move_requested'\]/],
    ['lib/team-ownership-transfer.ts', 'declineTeamMove', 'a move declined', /kinds: \['team_move_requested'\]/],
    ['lib/team-ownership-transfer.ts', 'withdrawTeamMove', 'a move withdrawn', /kinds: \['team_move_requested'\]/],
    ['lib/assistant-invites.ts', 'approveAssistantInvite', 'an invite approved', /kinds: \['assistant_coach_approval_requested'\]/],
    ['lib/assistant-invites.ts', 'revokeAssistantInvite', 'an invite declined or cancelled', /kinds: \['assistant_coach_approval_requested'\]/],
    ['lib/assistant-invites.ts', 'createAssistantInvite', 'an invite replaced', /kinds: \['assistant_coach_approval_requested'\]/],
    ['lib/club-schedule-coach.ts', 'replyToReview', 'a team answers a review', /kinds: \['club_schedule_review'\]/],
  ];
  for (const [file, fn, what, kinds] of SPOTS) {
    it(`${what} clears on the spot (${fn})`, () => {
      const body = functionBody(readCode(file), fn);
      assert.match(body, /await clearSettled\(\{/, `${fn} must await the clear (a promise left running can be dropped)`);
      assert.match(body, kinds);
    });
  }

  it('check-in, a withdrawn coach request, a deleted schedule, Finalize and a recovered payment clear on the spot', () => {
    const checkIn = readCode('app/api/admin/check-in/route.ts');
    assert.equal(checkIn.match(/await clearSettled\(\{ orgIds: \[ctx\.org\.id\], kinds: \['team_no_show'\] \}\)/g)?.length, 2, 'check in and undo');
    assert.match(readCode('app/api/coaches/[orgSlug]/teams/[teamId]/payment-requests/[id]/route.ts'), /kinds: \['team_request_filed', 'team_request_holding_payout'\]/);
    assert.match(readCode('app/api/admin/schedules/[scheduleId]/route.ts'), /kinds: \['club_schedule_review'\]/);
    assert.match(functionBody(readCode('lib/club-schedule-send.ts'), 'sendSchedule'), /kinds: \['club_schedule_review'\]/);
    assert.equal(readCode('app/api/billing/webhook/route.ts').match(/kinds: \['payment_failed'\]/g)?.length, 2, 'payment succeeded and subscription updated');
  });
});

describe('the /review fixes (2026-10-16)', () => {
  it('the two Needs-attention indexes cover exactly the Needs-attention kinds (a new kind needs a new migration)', () => {
    // The NEWEST definition: mig 332 made them, mig 338 re-made them with Families' hand-off (Club Tier Stage 5c), and
    // mig 358 with online payments' three (Club Tier Stage 12a).
    const sql = readCode('supabase/migrations/358_a_club_takes_payments_online.sql');
    const lists = [...sql.matchAll(/on public\.notifications \([a-z_]+, event_type\)\s+where cleared_at is null\s+and event_type in \(([^)]*)\)/g)].map(m => m[1]);
    assert.equal(lists.length, 2);
    for (const list of lists) {
      assert.deepEqual([...list.matchAll(/'([a-z_]+)'/g)].map(m => m[1]).sort(), [...NEEDS_ATTENTION_KINDS].sort());
    }
  });

  it('a failed payment settles only on good standing or a cancelled plan — never on unpaid or incomplete', () => {
    const body = functionBody(LIB.replace('const paymentFailed: Resolver = async rows =>', 'function paymentFailed(rows) '), 'paymentFailed');
    assert.match(body, /if \(status === 'active' \|\| status === 'trialing'\) out\.set\(r\.id, said\(W\.billingGood\)\)/);
    assert.match(body, /else out\.set\(r\.id, 'waiting'\)/);
    assert.match(readCode('app/api/billing/webhook/route.ts'), /if \(\['active', 'trialing', 'canceled'\]\.includes\(sub\.status\)\) await clearSettled/);
  });

  it('every read pages (a capped response must never read as "taken back")', () => {
    assert.match(LIB, /async function rowsIn<T>[\s\S]*?\.order\('id'\)\.range\(from, from \+ PAGE - 1\)[\s\S]*?if \(page\.length < PAGE\) break;/);
  });

  it('a clear writes read first, then Done', () => {
    const body = functionBody(LIB, 'clearIds');
    assert.ok(body.indexOf('read_at: now') < body.indexOf('cleared_at: now'));
  });

  it('a reader’s pass pauses between runs; a former member reads nothing live', () => {
    assert.match(functionBody(LIB, 'clearSettledForReader'), /if \(\(lastPass\.get\(key\) \?\? 0\) > now - PASS_GAP_MS\) return;/);
    assert.match(functionBody(LIB, 'settledLines'), /isTeamCoachEvent\(r\.event_type\) \|\| active\.has\(r\.org_id\)/);
    assert.match(functionBody(LIB, 'doorOutcome'), /memberOrgs\(readerId, \[row\.org_id\]\)/);
  });
});

describe('2 · the four retired kinds are not Needs attention', () => {
  for (const kind of ['score_disputed', 'coach_access_requested', 'roster_change_requested', 'tryout_offer_response'] as const) {
    it(kind, () => assert.equal(NOTIFICATION_CATEGORY[kind], 'know'));
  }
  it('mig 332 cleared any still pinned', () => {
    const sql = readCode('supabase/migrations/332_needs_attention_clears_itself.sql');
    assert.match(sql, /event_type in \('score_disputed', 'coach_access_requested', 'roster_change_requested', 'tryout_offer_response'\)/);
  });
});

describe('3 · the three notices name who can act', () => {
  it('a failed card payment goes to the owners, and never as an empty list', () => {
    const hook = readCode('app/api/billing/webhook/route.ts');
    assert.match(hook, /const owners = await orgOwnerUserIds\(currentOrg\.id\)/);
    assert.match(hook, /if \(owners\.length\) \{\s*notify\(\{[\s\S]*?eventType: 'payment_failed'[\s\S]*?userIds: owners,/);
  });
  it('an assistant waiting for approval goes to Rep Teams holders for the team’s group', () => {
    const body = functionBody(readCode('lib/assistant-invites.ts'), 'notifyAdminOfPendingInvite');
    assert.match(body, /clubModuleUserIds\(p\.org, groupId, 'module_rep_teams'\)/);
    assert.match(body, /if \(!userIds\.length\) return;/);
    assert.match(body, /userIds,\n/);
  });
  it('a no-show goes to whoever runs check-in, and records its team', () => {
    const checkIn = readCode('app/api/admin/check-in/route.ts');
    assert.match(checkIn, /checkInUserIds\(ctx\.org\.id, tournamentId\)/);
    assert.match(checkIn, /if \(runners\.length\) \{[\s\S]*?userIds: runners,\s*metadata: \{ teamId, tournamentId \},/);
  });
  it('a named list keeps each person’s real role (the owners’ failed-payment email default)', () => {
    assert.match(readCode('lib/notify.ts'), /role: roleOf\.get\(userId\) \?\? 'member'/);
  });
});

describe('A1–A6 · what a reader sees', () => {
  it('A1 · the hint beside the count', () => {
    assert.equal(NEEDS_ATTENTION_HINT, 'clears when it’s handled');
    for (const file of ['components/notifications/NotificationDrawer.tsx', 'components/notifications/NotificationFeedBody.tsx']) {
      assert.match(readCode(file), /<span className=\{styles\.sectionHint\}>\{NEEDS_ATTENTION_HINT\}<\/span>/, file);
    }
  });

  it('A2 · the settled line: "You" when it was you, a name when the record keeps one, else the bare outcome', () => {
    assert.equal(W.accepted(null, true), 'You accepted it');
    assert.equal(W.accepted('Morgan Ellis', false), 'Accepted by Morgan Ellis');
    assert.equal(W.accepted(null, false), 'Accepted');
    assert.equal(W.creditedThen(21600, '15U AAA'), '$216.00 came off what 15U AAA owes.');
    assert.equal(W.paidBackThen(10800, '15U AA'), 'The club pays 15U AA back $108.00.');
    assert.equal(W.reasonThen('test', true), 'Your reason: “test”.');
    const message = readCode('components/notifications/NotificationMessage.tsx');
    assert.match(message, /<b>\{settled\.outcome\}<\/b>/);
    assert.match(message, /notificationStamp\(settled\.at\)/, 'the stamp’s own spelling');
  });

  it('A3 · the onward button: the record’s place, nothing when it is gone, never this page; no Done', () => {
    const message = readCode('components/notifications/NotificationMessage.tsx');
    assert.match(message, /const onward = settled && settled\.link !== undefined \? settled\.link : own;/);
    assert.match(message, /const link = settled && onward && isThisPage\(onward\) \? null : onward;/);
    assert.match(message, /&& !lead\.clearedAt && !settled;/);
    // An answered ask lives on as its request; a withdrawn or closed one has nothing to open.
    const ask = functionBody(LIB.replace('const handBackAsked: Resolver = async rows =>', 'function handBackAsked(rows) '), 'handBackAsked');
    assert.match(ask, /clubMoneyLinks\.requests\(slug, requestId\)/);
    assert.match(ask, /state === 'withdrawn'[\s\S]*?link: null/);
    // D4 (2026-10-05): a schedule link names its page — a waiting ask's was a bare "Open".
    assert.equal(notificationDestination('/club/admin/schedules/abc?answer=x', 'admin'), 'Open the ask');
    assert.equal(notificationDestination('/club/admin/schedules/abc', 'admin'), 'Open the schedule');
  });

  it('A5 · a door says the exact outcome, in prose', () => {
    const note = doorNote({ kind: 'ask', verb: 'accepted', team: '15U AAA', at: '2026-10-16T21:10:00.000Z', who: 'Morgan Ellis', you: false });
    assert.match(note ?? '', /^Morgan Ellis accepted 15U AAA’s ask on [A-Z][a-z]{2}, [A-Z][a-z]{2} \d{1,2} at \d{1,2}:\d{2} [ap]\.m\.\.$/);
    assert.match(doorNote({ kind: 'ask', verb: 'declined', team: '13U AAA', at: null, who: null, you: true }) ?? '', /^You declined 13U AAA’s ask\.$/);
    assert.equal(doorNote({ kind: 'requestWithdrawn', who: null, you: false }), DOOR_WORDS.requestWithdrawn);
    assert.equal(doorNote(null), null);
    const page = readCode('app/[orgSlug]/admin/accounting/payment-requests/page.tsx');
    assert.match(page, /if \(note\) setNotice\(\{ tone: 'good', text: note \}\)/, 'Payment requests speaks only when the record states an outcome');
    assert.match(readCode('app/[orgSlug]/admin/schedules/[scheduleId]/page.tsx'), /fetchDoorNote\(\{ handBackId: asked \}\)/);
  });

  it('a builder’s quiet copy (sent without the figure) never shows the money once settled', () => {
    const ask = functionBody(LIB.replace('const handBackAsked: Resolver = async rows =>', 'function handBackAsked(rows) '), 'handBackAsked');
    assert.equal(ask.match(/then: mover \?/g)?.length, 2, 'accepted and declined both gate their money line on the reader moving money');
  });

  it('the doors read only through the reader’s own notification', () => {
    const door = functionBody(LIB, 'doorOutcome');
    assert.match(door, /\.from\('notifications'\)\.select\(SELECT\)\.eq\('user_id', readerId\)/);
    assert.match(readCode('app/api/notifications/outcome/route.ts'), /if \(!outcome\.found\) return NextResponse\.json\(\{ error: 'Not found\.' \}, \{ status: 404 \}\)/);
  });
});

describe('a free coach’s reminder clears once the fee is paid in full', () => {
  const tournament = { fee_schedule_mode: 'tournament', deposit_amount: 100, deposit_due_date: '2026-05-01', total_fee_amount: 450, total_fee_due_date: '2026-06-01' };
  const fee = (paid: { deposit_paid: number; total_paid: number }) =>
    registrationAmountDue({ division_id: 'd', ...paid }, registrationFee({ division_id: 'd', ...paid }, tournament, new Map()));
  it('the deposit first', () => assert.deepEqual(fee({ deposit_paid: 0, total_paid: 0 }), { amount: 100, dueDate: '2026-05-01' }));
  it('part-payment keeps it', () => assert.deepEqual(fee({ deposit_paid: 100, total_paid: 300 }), { amount: 150, dueDate: '2026-06-01' }));
  it('paid in full settles it', () => assert.equal(fee({ deposit_paid: 100, total_paid: 450 }), null));
  it('an event that stops tracking payments settles it ("Not tracked here": nothing is owed on the platform)', () => {
    assert.match(LIB, /if \(!tournamentTracksPayments\(tournament\.settings\)\) \{ out\.set\(r\.id, said\(W\.notTracked\)\); continue; \}/);
  });
});
