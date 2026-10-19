import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filesUnder, functionBody, readCode } from './_source-code.ts';
import { HANDOFF_NOTE_MAX, placement, planOpens, prePlace, type PaymentLine } from '../../lib/families-payment-plan.ts';
import { FAMILY_NOTE_MAX } from '../../lib/families-words.ts';
import { NEEDS_ATTENTION_KINDS, NOTIFICATION_CATEGORY } from '../../lib/notification-labels.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLUB TIER STAGE 5c — FAMILIES: RECORD A PAYMENT, THE HAND-OFF, NOTES (owner Asks 26–35, 2026-10-19; hub
 * K4MPu4ni53Ct7yrDcmWJd9 v121 → Stage 5c; build prompt docs/projects/active/CLUB_TIER_STAGE5C_BUILD_PROMPT.md).
 *   1. ONE HOUSE-LEAGUE-FEE WRITE (Part A): the Registrations tick and the family's Record a payment both call
 *      `setLeagueFeePaid`, and nothing else flips `registration_fee_paid` beside it.
 *   2. THE CLUB NEVER WRITES A TEAM'S BOOK (Ask 26, D1/D3): no admin route and no Families module imports the rep dues
 *      writers or writes `rep_dues_payments` / `rep_dues_credits`.
 *   3. THE COACH'S SAVE RESOLVES A HAND-OFF (Part B) and refuses one for another team, player, season or state; it claims
 *      before it writes and settles the claim either way.
 *   4. NEEDS ATTENTION clears for every recipient on Record it and on Not received.
 *   5. THE WINDOW'S PLACING RULE (pure), and the record shows Record a payment only when something is owed and a line
 *      can go.
 *   6. NOTES: one length, author edits, author or owner deletes, a deletion audits who and when only.
 * The merge carrying notes is proved on the database (`npm run check:families-record`, T11; `-- --before-338`).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const PAY = readCode('lib/families-payment.ts');

describe('1 · one house-league-fee write, two doors', () => {
  it('the Registrations route calls the one write and flips no fee itself', () => {
    const route = readCode('app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts');
    assert.match(route, /await setLeagueFeePaid\(ctx!, \{ season, reg \}, Boolean\(body\.feePaid\)\)/);
    assert.match(route, /if \(!canMarkLeagueFeePaid\(ctx!\)\) return forbidden\(\);/);
    assert.doesNotMatch(route, /registration_fee_paid:/, 'the route writes the fee itself again — a second copy of the one write');
  });
  it('the family payment route reaches the same write, and writes no fee itself', () => {
    assert.match(readCode('app/api/admin/families/[personId]/payment/route.ts'), /await recordFamilyPayment\(ctx, page, body\)/);
    assert.match(functionBody(PAY, 'recordFamilyPayment'), /await setLeagueFeePaid\(ctx, \{/);
    assert.doesNotMatch(PAY, /registration_fee_paid:/);
  });
  it('the one write holds the role, the module and the closed fiscal year', () => {
    const lib = readCode('lib/league-fee-paid.ts');
    assert.match(lib, /LEAGUE_FEE_ROLES = \['owner', 'league_admin', 'league_registrar'\]/);
    assert.match(lib, /canOpenModule\(ctx, ctx\.org, 'module_house_league'\)/);
    assert.match(lib, /refuseIfClosed\(setting, \[line\.entry_date\]/);
    assert.match(lib, /\.update\(\{ registration_fee_paid: paid/);
  });
});

describe('2 · the club never writes a team’s book (Ask 26)', () => {
  const adminFiles = filesUnder('app/api/admin', '.ts');
  const families = ['lib/families-payment.ts', 'lib/families-notes.ts', 'lib/families-export.ts', 'lib/families-read.ts'];
  for (const file of [...adminFiles, ...families]) {
    it(`${file} imports no rep dues writer and writes no dues row`, () => {
      const src = readCode(file);
      assert.doesNotMatch(src, /\b(recordRepDuesPayment|removeRepDuesPayment)\b/, `${file} reaches a team's dues writer`);
      assert.doesNotMatch(src, /from\('rep_dues_(payments|credits)'\)\s*\.(insert|update|upsert|delete)\(/, `${file} writes a team's dues rows`);
    });
  }
  it('there are admin routes to check (the glob found the tree)', () => assert.ok(adminFiles.length > 50));
  it('nothing in 5c reaches a family: the hand-off is colleague mail, never the family door', () => {
    assert.doesNotMatch(PAY, /sendFamilyEmail|family-email/);
    assert.match(functionBody(PAY, 'deliverHandoff'), /await sendEmail\(c\.email!/);
  });
});

describe('3 · the coach’s save resolves a hand-off, and refuses the wrong one', () => {
  const route = readCode('app/api/coaches/[orgSlug]/teams/[teamId]/players/[playerId]/dues-payments/route.ts');
  const POST = route.slice(route.indexOf('export const POST'));
  it('a hand-off id is claimed for this org, team, player and live season before the payment is written', () => {
    assert.match(POST, /claimHandoffForPayment\(\{ orgId: ctx!\.org\.id, teamId, playerId, programYearId: programYear\.id, handoffId, paymentId, userId: ctx!\.user\.id \}\)/);
    // The payment's id is chosen before the claim and given to the write, so a failed write is settled by that id alone.
    assert.match(POST, /const paymentId = handoffId \? randomUUID\(\) : undefined;/);
    assert.match(POST, /createdBy: ctx!\.user\.id,\n\s+paymentId,\n/);
    assert.ok(POST.indexOf('claimHandoffForPayment(') < POST.indexOf('recordRepDuesPayment('), 'the claim must come before the write');
    assert.match(POST, /if \(claim && !claim\.ok\) return NextResponse\.json/);
    assert.match(POST, /if \(claim\?\.ok\) await claim\.stamp\(result\.payment\.id\);/);
    assert.match(POST, /catch \(e\) \{\n\s+if \(claim\?\.ok\) await claim\.release\(\);/);
  });
  it('another team’s or player’s, another season’s, or an answered hand-off is refused; two coaches record it once', () => {
    const claim = functionBody(PAY, 'claimHandoffForPayment');
    assert.match(claim, /\.eq\('org_id', p\.orgId\)/);
    assert.match(claim, /h\.team_id !== p\.teamId \|\| h\.roster_player_id !== p\.playerId\) return \{ ok: false, status: 404/);
    assert.match(claim, /h\.program_year_id !== p\.programYearId\) return \{ ok: false, status: 409/);
    assert.match(claim, /h\.state !== 'sent'\) return \{ ok: false, status: 409/);
    // The claim is ONE conditional update: only a row still `sent` moves (shared with Not received).
    assert.match(claim, /if \(!\(await moveFromSent\(p\.handoffId, 'recorded', p\.userId, now\)\)\) return answered;/);
    assert.match(functionBody(PAY, 'moveFromSent'), /\.update\(\{ state: to, resolved_by: userId, resolved_at: at \}\)\s*\.eq\('id', handoffId\)\.eq\('state', 'sent'\)/);
  });
  it('a failed record that still wrote its payment keeps the hand-off recorded; only none written goes back to waiting', () => {
    const claim = functionBody(PAY, 'claimHandoffForPayment');
    const release = claim.slice(claim.indexOf('release: async'));
    assert.ok(release.indexOf("from('rep_dues_payments').select('id')") < release.indexOf("state: 'sent'"), 'read for a landed payment first');
    // Exactly the payment this save was given — never a guess by coach, player and time.
    assert.match(release, /from\('rep_dues_payments'\)\.select\('id'\)\.eq\('id', p\.paymentId\)\.maybeSingle\(\)/);
    assert.doesNotMatch(release, /created_at|created_by/);
    assert.match(release, /if \(landed\) \{ await stamp\(p\.paymentId\); return; \}/);
    assert.match(release, /\.eq\('state', 'recorded'\)\.is\('payment_id', null\)/);
    assert.match(readCode('lib/db.ts'), /\.\.\.\(opts\.paymentId \? \{ id: opts\.paymentId \} : \{\}\),/);
  });
  it('one hand-off per receipt (the stamp can never point two at one payment)', () => {
    assert.match(readCode('supabase/migrations/338_the_club_hands_a_payment_to_the_coach_and_keeps_notes.sql'),
      /CREATE UNIQUE INDEX IF NOT EXISTS family_payment_handoffs_payment_uniq ON public\.family_payment_handoffs \(payment_id\) WHERE payment_id IS NOT NULL;/);
  });
  it('two presses on one fee make one fee line (the flip is conditional)', () => {
    const lib = readCode('lib/league-fee-paid.ts');
    assert.match(lib, /\.eq\('id', reg\.id\)\.eq\('registration_fee_paid', !paid\)\.select\('id'\)/);
    assert.match(lib, /if \(flipped\?\.length && !reg\.feeEntryId && paid && season\.registrationFee\) \{/);
  });
  it('Record money carries the id only from a door that names it, and clears it with the form', () => {
    const panel = readCode('app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/panel.tsx');
    assert.match(panel, /\.\.\.\(convClaims\?\.handoffId \? \{ handoffId: convClaims\.handoffId \} : \{\}\)/);
    assert.match(functionBody(panel, 'resetForm'), /setConvClaims\(null\);/);
    assert.match(functionBody(panel, 'openConversationFrom'), /if \(intent\.claims\) setConvClaims\(intent\.claims\);/);
    assert.match(readCode('components/coaches/ClubHandoffDoor.tsx'), /claims: \{ handoffId: data\.id \}/);
  });
  it('Not received is a coach money write on the live season, and tells the person who sent it', () => {
    const coach = readCode('app/api/coaches/[orgSlug]/teams/[teamId]/club-handoffs/[handoffId]/route.ts');
    assert.match(coach, /await resolveLiveCoachTeamContext\(orgSlug, teamId\)/);
    assert.match(coach, /canWriteMoney\(resolved\.assignment\.capabilities\)/);
    const nr = functionBody(PAY, 'markHandoffNotReceived');
    assert.match(nr, /h\.team_id !== p\.teamId\) return \{ ok: false, status: 404/);
    assert.match(nr, /await moveFromSent\(p\.handoffId, 'not_received', p\.userId,/);
    assert.match(nr, /eventType: 'club_payment_not_received'/);
    assert.match(nr, /userIds: \[h\.sent_by\]/);
  });
});

describe('4 · Needs attention clears itself for every recipient', () => {
  it('the hand-off is a Needs-attention kind with its own rule; the answer back is news', () => {
    assert.ok((NEEDS_ATTENTION_KINDS as readonly string[]).includes('club_payment_handed_off'));
    assert.equal(NOTIFICATION_CATEGORY.club_payment_not_received, 'know');
    const lib = readCode('lib/needs-attention.ts');
    assert.match(lib, /club_payment_handed_off: paymentHandedOff,/);
    const rule = lib.slice(lib.indexOf('const paymentHandedOff'), lib.indexOf('/** THE RULEBOOK'));
    assert.match(rule, /if \(h\?\.state === 'sent' \|\| \(h && inFlight\(h\)\)\) out\.set\(r\.id, 'waiting'\);/);
    // A Record it in flight (claimed, its payment not stamped yet) still waits: a release must find the ask still there.
    assert.match(rule, /h\.state === 'recorded' && !h\.payment_id && !!h\.resolved_at && Date\.parse\(h\.resolved_at\) > Date\.now\(\) - 5 \* 60_000/);
  });
  it('Record it (the coach’s save) and Not received each clear every copy on the spot', () => {
    const clear = /await clearSettled\(\{ orgIds: \[p\.orgId\], kinds: \['club_payment_handed_off'\] \}\)/;
    assert.match(functionBody(PAY, 'claimHandoffForPayment'), clear);
    assert.match(functionBody(PAY, 'markHandoffNotReceived'), /await clearSettled\(\{ orgIds: \[p\.org\.id\], kinds: \['club_payment_handed_off'\] \}\)/);
  });
  it('the coach’s bell names the hand-off it waits on (the rule reads it), and links to Record it', () => {
    const d = functionBody(PAY, 'deliverHandoff');
    assert.match(d, /eventType: 'club_payment_handed_off'/);
    assert.match(d, /metadata: \{ handoffId: h\.id, teamId: h\.line\.teamId \}/);
    assert.match(d, /moneySectionHref\(base, 'dues', \{ handoff: h\.id \}\)/);
  });
});

const rep = (key: string, balance: number, over: Partial<Extract<PaymentLine, { kind: 'rep' }>> = {}): PaymentLine => ({
  kind: 'rep', key, childName: key, teamName: 'Falcons', year: 2026, balanceCents: balance, pendingCents: 0,
  rosterRowId: `r-${key}`, teamId: 't', programYearId: 'y', coaches: ['Pat Moreau'], reason: null, ...over,
});
const fee = (key: string, cents: number, reason: string | null = null): PaymentLine => ({
  kind: 'league', key, childName: key, where: 'Summer 2026 · U11', feeCents: cents, regId: `g-${key}`, seasonId: 's', reason,
});

describe('5 · the window places an amount, in the record’s order', () => {
  it('a fee takes the whole fee or nothing; a rep line up to its balance less what the coach already holds', () => {
    const lines = [fee('Milan', 15000), rep('Riley', 10000, { pendingCents: 2500 })];
    assert.deepEqual(prePlace(lines, 25000), { Milan: 15000, Riley: 7500 });
    assert.deepEqual(prePlace(lines, 10000), { Milan: 0, Riley: 7500 });
  });
  it('a line that cannot go takes nothing', () => {
    assert.deepEqual(prePlace([rep('Riley', 10000, { reason: 'No head coach' }), rep('Morgan', 5000)], 8000), { Morgan: 5000 });
  });
  it('Placed · Left to place: money left, and more placed than received, both stop the press', () => {
    assert.deepEqual(placement(25000, { a: 15000, b: 5000 }), { placedCents: 20000, leftCents: 5000, children: 2 });
    assert.equal(placement(10000, { a: 15000 }).leftCents, -5000);
  });
  it('the record shows Record a payment only when a line can go', () => {
    assert.equal(planOpens({ lines: [] }), false);
    assert.equal(planOpens({ lines: [rep('Riley', 10000, { reason: 'closed' })] }), false);
    assert.equal(planOpens({ lines: [fee('Milan', 15000, 'no permission'), rep('Riley', 10000)] }), true);
    const win = readCode('components/admin/kit/club/families/FamilyRecordWindow.tsx');
    assert.match(win, /const canPay = planOpens\(read\.payment\);/);
    assert.match(win, /\{canPay && \(/);
    // Only a child who OWES is a line: the plan reads balances above zero.
    assert.match(functionBody(PAY, 'paymentPlan'), /l\.money && l\.money\.balanceCents > 0\) \|\| \(l\.leagueReg && l\.league\?\.feeCents != null && l\.league\.balanceCents > 0\)/);
  });
  it('the server validates every line before it writes: a fee only whole, every cent placed, no date after today', () => {
    const r = functionBody(PAY, 'recordFamilyPayment');
    assert.ok(r.indexOf("refuse(400, 'left_to_place'") < r.indexOf('await setLeagueFeePaid('), 'validate before the first write');
    assert.match(r, /line\.kind === 'league' && c !== line\.feeCents\) return refuse\(409/);
    assert.match(r, /if \(line\.reason\) return refuse\(409, 'line_refused', line\.reason\)/);
    assert.match(r, /futureReceivedDateRefusal\(receivedDate, 'payment'\)/);
    assert.match(r, /note\.length > HANDOFF_NOTE_MAX/);
    assert.equal(HANDOFF_NOTE_MAX, 500);
  });
});

describe('6 · notes', () => {
  const lib = readCode('lib/families-notes.ts');
  it('one length, the same as the database’s', () => {
    const mig = readCode('supabase/migrations/338_the_club_hands_a_payment_to_the_coach_and_keeps_notes.sql');
    assert.match(mig, new RegExp(`char_length\\(btrim\\(body\\)\\) BETWEEN 1 AND ${FAMILY_NOTE_MAX}`));
  });
  it('the author edits; the author or the owner deletes; a deletion audits who and when, never the words', () => {
    const update = functionBody(lib, 'updateNote');
    assert.match(update, /\.eq\('id', noteId\)\.eq\('org_id', ctx\.org\.id\)\.eq\('person_id', personId\)\.eq\('created_by', ctx\.user\.id\)/);
    assert.match(update, /return note \? \{ ok: false, status: 403, error: W\.notYours \}/);
    assert.match(lib, /viewer\.role === 'owner' \|\| \(!!createdBy && createdBy === viewer\.user\.id\)/);
    const del = functionBody(lib, 'deleteNote');
    assert.match(del, /writeOrgAudit\(ctx\.org\.id, ctx\.user\.id, noteId, 'families_note_deleted', \{ personId, ownNote:/);
    assert.doesNotMatch(del.slice(del.indexOf('writeOrgAudit')), /body/);
  });
  it('every notes route sits behind the Families gate', () => {
    for (const f of ['app/api/admin/families/[personId]/notes/route.ts', 'app/api/admin/families/[personId]/notes/[noteId]/route.ts', 'app/api/admin/families/[personId]/payment/route.ts']) {
      assert.match(readCode(f), /await requireFamiliesAccess\(req\)/, f);
    }
  });
});
