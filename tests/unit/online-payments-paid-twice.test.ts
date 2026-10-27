import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { functionBody, readCode } from './_source-code.ts';
import { LEAGUE_ONLINE_NOTICE_WORDS as LW, OVER_WORDS as O, PAY_OPEN_WORDS as P, howPaidWords, leagueUnrecordedWhy } from '../../lib/online-payment-words.ts';
import { paymentLine, type FeeSchedule, type TeamRecord } from '../../lib/tournament-teams.ts';
import { canRefundOnline } from '../../lib/online-payment-access.ts';

/**
 * Club Tier Stage 12d-1 Part 2 — a team never overpays silently (words CLUB_TIER_STAGE12D_COPY.md §2; plan §0 "12d-1 build
 * state"). Catch it: a team payment past what it owed books in full, is flagged and raises one item, and the refund door
 * opens set to the extra. Stop it: every hand-recording path closes an open pay page, and the three drawn screens warn.
 */
const LANDING = readCode('lib/online-payment-landing.ts');
const PAGES = readCode('lib/online-pay-pages.ts');
const MIG_390 = readCode('supabase/migrations/390_a_card_dispute_and_every_stripe_fee.sql');
const LAND_SQL = /FUNCTION public\.online_payment_land\([\s\S]*?\nEND \$\$;/.exec(MIG_390)?.[0] ?? '';

describe('over by part, over by all (ask 10, words §2.2)', () => {
  it('the landing measures what the team owed BEFORE this payment, under its lock, and books the whole payment', () => {
    assert.match(LAND_SQL, /PERFORM 1 FROM teams WHERE id = v_op\.team_id FOR UPDATE;[\s\S]*v_owed := greatest\(v_fee - v_paid, 0\);/);
    assert.match(LAND_SQL, /v_over := greatest\(v_op\.base_amount - v_owed, 0\);/);
    // Booked in full: the writer gets the whole base, never base − over.
    assert.match(LAND_SQL, /tournament_team_payment_record\(v_op\.team_id, v_op\.base_amount, v_day, v_label, NULL, NULL\)/);
    // Whole = the team already owed nothing; part = it owed less than the payment.
    assert.match(LAND_SQL, /over_amount = nullif\(v_over, 0\), over_whole = CASE WHEN v_over > 0 THEN v_owed = 0 END/);
  });

  it('part and all are different sentences; "paid twice" never names a team that simply owed less (D8)', () => {
    assert.equal(O.pillTwice('$400.00'), '$400.00 paid twice');
    assert.equal(O.pillMore('$200.00'), '$200.00 more than owed');
    assert.equal(O.titleTwice('Riverside Rockets 12U', '$400.00'), 'Riverside Rockets 12U paid $400.00 twice');
    assert.equal(O.titleMore('Riverside Rockets 12U', '$200.00'), 'Riverside Rockets 12U paid $200.00 more than it owed');
    assert.equal(O.bodyTwice('$412.00', '1041', 'Nov 3', false),
      'A card payment of $412.00 (receipt 1041) landed on Nov 3 after the team had already paid in full. The money is in the club’s Stripe balance. Refund it to the card.');
    assert.equal(O.bodyMore('$309.00', '1042', 'Nov 3', '$200.00', false),
      'A card payment of $309.00 (receipt 1042) landed on Nov 3, $200.00 more than the team owed. The money is in the club’s Stripe balance. Refund the extra $200.00 to the card.');
    assert.match(O.bodyTwice('$412.00', '1041', 'Nov 3', true), /^A bank debit of .* Refund it to the bank account\.$/);
    assert.equal(O.tagTwice, 'Paid after the team had already paid in full. Refund it from ⋯.');
    assert.equal(O.tagMore('$200.00'), 'Paid more than the team owed. Refund the extra $200.00 from ⋯.');
  });

  it('the refund window opens set: all of it with the fee for paid twice, part of it at the extra otherwise', () => {
    const win = readCode('app/[orgSlug]/admin/tournaments/registrations/components/OnlinePaymentWindows.tsx');
    assert.match(win, /const overAll = !anotherWay && !!over && over\.whole && untouched;/);
    assert.match(win, /useState<'all' \| 'part' \| null>\(anotherWay \|\| overAll \? 'all' : overPart \? 'part' : null\)/);
    assert.match(win, /useState\(over && !anotherWay \? \(over\.whole \? O\.prefillTwice : O\.prefillMore\) : ''\)/);
    assert.match(win, /overAll \? \(feeIncluded \? O\.feeWhy :/, 'the fee box is ticked with its why');
    assert.match(win, /\{!overAll && \(\s*<fieldset/, 'nobody is ending anything, so "who is ending this?" is not asked');
    assert.equal(O.allSub('by e-transfer'), 'Paid twice: the team had already paid by e-transfer');
    assert.equal(howPaidWords('online_card'), 'online');
    assert.equal(howPaidWords('cheque'), 'by cheque');
  });

  it('the summary swaps "over the fee" for the pill only when the extra came online; a hand overage keeps its words', () => {
    const fee = { totalFeeAmount: 400 } as FeeSchedule;
    const line = paymentLine({ status: 'accepted', totalPaid: 800 } as TeamRecord, fee, '2026-11-03');
    assert.equal(line?.over, true);
    assert.deepEqual(line?.rest, ['$400 over the fee']);
    const record = readCode('app/[orgSlug]/admin/tournaments/registrations/components/TeamRecord.tsx');
    assert.match(record, /\(line\.over && payOver \? \[\] : line\.rest\)/);
  });

  it('"Keep it" is a note with a reason, never a credit (§7 ruling 5)', () => {
    assert.equal(O.keepButton, 'Keep it');
    assert.equal(O.menuKeep, 'Keep it');
    assert.equal(O.keepBody('Riverside Rockets 12U', '$200.00'), 'Riverside Rockets 12U paid $200.00 more than it owed. The club keeps the money. Say why.');
    for (const w of [O.keepTitle('A', '$1.00'), O.keepBody('A', '$1.00'), O.keepDone('$1.00', 'A')]) assert.doesNotMatch(w, /credit/i);
    const keep = functionBody(LANDING, 'keepOverpayment');
    assert.match(keep, /over_kept_reason: p\.reason, over_kept_by: p\.actorId, over_kept_at:/);
    assert.doesNotMatch(keep, /rpc\('(tournament_team_payment|online_payment_refund)/, 'keeping moves no money');
    assert.match(keep, /kinds: \['online_payment_over'\]/);
  });
});

describe('a replayed landing raises the item once', () => {
  it('raised after every landing of a team payment, a replay included, read from the row', () => {
    const land = functionBody(LANDING, 'landCheckoutSession');
    assert.match(land, /if \(op\.flow === 'league_signup'\) await raiseLeagueUnrecorded\(op\);\s*else await raiseOverpaid\(op\.id\);/);
    assert.match(land, /await raiseOverpaid\(op\.id\);\s*if \(!\(landed as/);
    const raise = functionBody(LANDING, 'raiseOverpaid');
    assert.match(raise, /select\('id, org_id, flow, team_id, tournament_id, total_amount, receipt_no, paid_on, rail, over_amount, over_whole, description'\)/);
    assert.match(raise, /if \(left <= 0\) return;/, 'a settled extra is never raised again');
    assert.match(raise, /eventType: 'online_payment_over',\s*subjectKey: 'onlinePaymentId'/);
  });

  it('the database holds one open copy per person and payment, so a second raise is "already waiting"', () => {
    const idx = /CREATE UNIQUE INDEX notifications_one_open_online_payments_notice[\s\S]*?;/.exec(MIG_390)?.[0] ?? '';
    assert.match(idx, /metadata->>'onlinePaymentId'/);
    assert.match(idx, /'online_payment_over'\)/);
  });

  it('it clears itself when the extra is gone, with the settled lines of words §2.2', () => {
    const rules = readCode('lib/needs-attention.ts');
    assert.match(rules, /online_payment_over: onlinePaymentOver,/);
    const body = /const onlinePaymentOver: Resolver = async rows => \{[\s\S]*?\n\};/.exec(rules)?.[0] ?? '';
    assert.match(body, /if \(\(left\.get\(id\) \?\? 0\) > 0\) \{ out\.set\(r\.id, 'waiting'\); continue; \}/);
    assert.match(body, /W\.overKept/);
    assert.match(body, /W\.overRefunded/);
    assert.match(body, /W\.overEntryRaised/);
  });
});

describe('the race: the page completes before the desk closes it', () => {
  it('a page is marked expired only when Stripe says so; one that completed is left to the landing, which flags it', () => {
    const close = functionBody(PAGES, 'closeRows');
    assert.match(close, /await expireCheckout\(r\.stripe_account_id, r\.stripe_checkout_session_id\);\s*const session = await retrieveCheckout\(/);
    assert.match(close, /if \(session\.status !== 'expired'\) continue;\s*await expireCheckoutSession\(/);
    assert.doesNotMatch(PAGES, /landCheckoutSession/, 'the close never lands a payment itself');
    // The landing books a completed page in full and measures the extra under the team's lock, whatever the desk did.
    assert.match(LAND_SQL, /SELECT f\.total INTO v_fee FROM tournament_team_fee\(v_op\.team_id\) f;/);
  });

  it('closing never fails the hand payment that was already recorded', () => {
    for (const fn of ['closeTeamPayPages', 'closeChildPayPages']) assert.match(functionBody(PAGES, fn), /catch \(e\)[\s\S]*return 0;/);
    assert.match(close(), /catch \(e\)/);
    function close() { return functionBody(PAGES, 'closeRows'); }
  });

  it('every hand-recording path closes the open pages after its own write lands', () => {
    const paths: Array<[string, RegExp]> = [
      ['app/api/admin/tournaments/[tournamentId]/registrations/payments/route.ts', /recordTeamPayment\([\s\S]*closeTeamPayPages\(\[teamId\], 'Record a payment'\)/],
      ['app/api/admin/teams/route.ts', /closeTeamPayPages\(\[\.\.\.markedByPayment\], 'Mark paid'\)/],
      ['app/api/admin/check-in/route.ts', /payTeamDue\([\s\S]*?if \(paid\.outcome\.recorded\) await closeTeamPayPages\(\[teamId\], 'check-in'\)/],
      ['app/api/admin/tournaments/[tournamentId]/registrations/bulk/route.ts', /if \(paid\.outcome\.recorded\) await closeTeamPayPages\(\[team\.id\], 'the bulk Mark paid'\)/],
      ['app/api/admin/tournaments/[tournamentId]/registrations/import/commit/route.ts', /if \(!noFee\) await closeTeamPayPages\(\[teamId\], 'import'\)/],
      ['app/api/admin/tournaments/[tournamentId]/registrations/shared-payment/route.ts', /club_tournament_shared_payment[\s\S]*closeTeamPayPages\(/],
      ['app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts', /move\.kind === 'receive' \? await closeChildPayPages\(\[regId\], 'Mark received'\)/],
      ['lib/families-payment.ts', /writeLeagueMoney\([\s\S]*closeChildPayPages\(\[reg\.id\], 'the family record'\)/],
    ];
    for (const [file, shape] of paths) assert.match(readCode(file), shape, file);
  });

  it('the three drawn screens warn (a notice, never a block); their reads carry who, how much and when', () => {
    assert.match(readCode('app/api/admin/tournaments/[tournamentId]/registrations/payments/route.ts'), /openTeamPayPages\(teamId as string\)/);
    assert.match(readCode('app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts'), /const openPages = await openChildPayPages\(regId\);/);
    assert.match(readCode('app/[orgSlug]/admin/tournaments/registrations/components/TeamPayments.tsx'), /canRecord && openPages\.length > 0 &&/);
    assert.match(readCode('components/admin/kit/club/league/registrations/ReceiveWindow.tsx'), /open && open\.pages\.length > 0 &&/);
    // The clock's own "p.m." ends the sentence: never "p.m.." (the club's zone: 19:59 UTC on Nov 3 is 2:59 p.m.).
    assert.equal(P.notice('Dana Price', '$412.00', '2026-11-03T19:59:00Z', '2026-11-03', false),
      'Dana Price opened a pay page for $412.00 at 2:59 p.m. Recording this closes it, so the team can’t pay twice.');
    assert.equal(P.notice(null, '$412.00', '2026-11-02T19:59:00Z', '2026-11-03', true),
      'The family opened a pay page for $412.00 on Nov 2 at 2:59 p.m. Recording this closes it, so the family can’t pay twice.');
    assert.equal(P.noticeMany(2, null), '2 pay pages are open for this team. Recording this closes them, so the team can’t pay twice.');
    assert.equal(P.doneToast('$200.00', 'Riverside Rockets 12U', false), 'Recorded $200.00 for Riverside Rockets 12U. The open pay page is closed.');
    assert.equal(P.partNote('$100.00', false), 'The team’s pay link still works for the $100.00 still owing.');
  });
});

describe('house league unchanged (12b refuses a second payment at landing)', () => {
  it('the landing still refuses a fee already received, and only that reason gets the plain "paid twice" label', () => {
    assert.match(readCode('supabase/migrations/387_a_bank_debit_at_the_desk.sql'), /'already_received'::text/);
    assert.equal(LW.unrecordedTitleTwice('Henry Grant’s'), 'Henry Grant’s fee was paid twice');
    assert.equal(LW.unrecordedBodyTwice('Pat Grant', 'Nov 3', 'Henry Grant’s'),
      'Pat Grant paid by card on Nov 3, after Henry Grant’s fee was already marked received. The money is in the club’s Stripe balance. Refund it to the card.');
    assert.match(LW.unrecordedBodyTwice(null, null, 'Henry Grant’s', true), /^The family paid by bank debit, after .* Refund it to the bank account\.$/);
    const raise = functionBody(LANDING, 'raiseLeagueUnrecorded');
    assert.match(raise, /const twice = u\.land_error === 'already_received';/);
    assert.match(raise, /at: twice \? 'card' : 'fee'/, 'its first door is the refund to the card');
    // Every other reason keeps its words.
    assert.equal(leagueUnrecordedWhy('ended'), 'the registration had already ended');
    assert.match(raise, /LW\.unrecordedTitle\(child, op\.rail === 'bank_debit'\)/);
  });
});

describe('the treasurer is never offered a refund door', () => {
  it('only whoever runs tournaments refunds; the item goes to them and the owner', () => {
    assert.equal(canRefundOnline({ role: 'treasurer', capabilities: {} } as never, {} as never), false);
    assert.match(functionBody(LANDING, 'overPeople'), /canRefundOnline\(m, org\) \|\| canConnectPayouts\(m\)/);
  });

  it('the pill, the row tag, "Keep it" and the preset window all sit behind the refund right', () => {
    const list = readCode('app/[orgSlug]/admin/tournaments/registrations/components/TeamPayments.tsx');
    assert.match(list, /const overRow = online\?\.refunds \? received\.find/);
    assert.match(list, /\{online\?\.refunds && overOf\(p\) && \(\s*<span className=\{styles\.payTagSub\}>/);
    assert.match(list, /\{online\?\.refunds && overOf\(p\) && p\.online\.refund !== 'failed'/);
    assert.match(list, /if \(online\.refunds && row\?\.online && overOf\(row\)\) setRefunding/);
    const route = readCode('app/api/admin/tournaments/[tournamentId]/registrations/online-payments/route.ts');
    assert.ok(route.indexOf('if (!canRefundOnline(') < route.indexOf("body.action === 'keep_over'"), 'Keep it is behind the same gate as a refund');
  });
});
