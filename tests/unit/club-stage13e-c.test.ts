import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { clearingWords, feeCell } from '../../lib/house-league-registrations.ts';
import { feeState, formatLeagueMoney, stillOwingCents } from '../../lib/league-money.ts';
import { clearingShareCents, type RegDebit } from '../../lib/league-debits.ts';
import { findMoney } from '../../lib/house-league-find.ts';
import { parseScope } from '../../lib/families-audience.ts';
import type { LeagueRegistration } from '../../lib/types.ts';

/**
 * Club Tier Stage 13e, Session C — the four rulings of 2026-11-17 (build prompt CLUB_TIER_STAGE13E_BUILD_PROMPT.md):
 * 13e-9 a partly cleared fee says what is owing first, one reading on three screens; 13e-10 "Email these families" works
 * past ~200 children (the list leaves the address; same audience, same refusals); 13e-11 and 13e-12 are door pins kept
 * beside the tests they moved (club-stage13d-money-handoff, club-stage13e-b B7).
 */
const TODAY = '2026-11-17';
const SEASON = { registrationFee: 150, owingAmberDays: 14 };
const reg = (over: Partial<LeagueRegistration> = {}): LeagueRegistration => ({
  id: 'r1', seasonId: 's', divisionId: 'd', playerFirstName: 'Ava', playerLastName: 'Kim', playerDateOfBirth: null, playerJerseyPref: null,
  playerPositionPref: null, playerNotes: null, guardianFirstName: 'Grace', guardianLastName: 'Kim', guardianEmail: 'g@x.ca', guardianPhone: null,
  status: 'active', waitlistPosition: null, teamId: null, registrationFeePaid: false, feeEntryId: null, adminNotes: null, source: 'public_form',
  waiverAcceptedAt: null, signupRef: null, signupPosition: null, feeAmount: 150, acceptedAt: '2026-10-21T15:00:00Z', endedAt: null,
  spotReleased: false, endMoney: null, endMoneyReason: null, withdrawRequestedAt: null, withdrawRequestNote: null,
  registeredAt: '2026-10-01T15:00:00Z', updatedAt: '2026-10-01T15:00:00Z', ...over,
} as LeagueRegistration);
const debit = (shareCents: number): RegDebit => ({
  state: 'clearing', onlinePaymentId: 'op', itemId: 'it', totalCents: shareCents, shareCents, feeShareCents: 0, familyPaysFee: false, last4: '6789',
  startedAt: '2026-11-14T15:00:00Z', returnedAt: null, reversedAt: null, reason: null, receiptNo: null, siblings: [], decision: null,
});

describe('C1 · 13e-9 A — a partly cleared fee says what is owing first', () => {
  it('one child, part clearing: the same owing amount on Money’s row, Registrations’ cell and Find a child', () => {
    const r = reg();
    const d = debit(10000);
    const fee = feeState(r, SEASON, [], TODAY);
    // Money's Still owing row: the ledger route's `stillOwingCents(fee, clearingCents)` (pinned below), shown as money.
    const moneyRow = formatLeagueMoney(stillOwingCents(fee, clearingShareCents(d)) / 100);
    assert.equal(moneyRow, '$50');
    const cell = feeCell(r, SEASON, [], TODAY, [], [], null, d);
    assert.equal(cell.chip?.text, '$50 owing · $100 clearing');
    assert.equal(findMoney(r, SEASON, [], TODAY, d), '$50 owing · $100 clearing');
    assert.ok(cell.chip?.text.startsWith(`${moneyRow} owing`), 'owing first, the number Money shows');
    assert.equal(cell.sub, 'Bank debit · $100 · started Nov 14', 'the second line is unchanged');
  });
  it('the whole fee clearing keeps today’s words (nothing owing to say)', () => {
    const r = reg();
    const d = debit(15000);
    assert.equal(feeCell(r, SEASON, [], TODAY, [], [], null, d).chip?.text, '$150 clearing');
    assert.equal(findMoney(r, SEASON, [], TODAY, d), '$150 clearing');
  });
  it('one wording: both screens build it from `clearingWords`, and the Fee cell no longer prints the share alone', () => {
    assert.equal(clearingWords(feeState(reg(), SEASON, [], TODAY), 10000), '$50 owing · $100 clearing');
    const regs = readCode('lib/house-league-registrations.ts');
    assert.match(regs, /chip = \{ text: clearingWords\(state, debit\.shareCents\)/);
    assert.match(readCode('lib/house-league-find.ts'), /return clearingWords\(fee, clearing\)/);
    assert.match(readCode('app/api/admin/house-league/seasons/[seasonId]/ledger/route.ts'),
      /const left = stillOwingCents\(fee, clearingCents\.get\(o\.regId\) \?\? 0\);/, 'Money’s row asks the one rule');
  });
  it('the child’s record window says the same: Still owing after what is clearing, then a Clearing line (walk prep)', () => {
    const win = readCode('components/admin/kit/club/league/registrations/RegistrationRecordWindow.tsx');
    assert.match(win, /const owingLeft = stillOwingCents\(fee, clearingCents\);/);
    assert.match(win, /owingLeft > 0 \? \[F\.owing, money\(owingLeft \/ 100\)\] as const : null,/);
    assert.match(win, /clearingShown > 0 \? \[F\.clearing, money\(clearingShown \/ 100\)\] as const : null,/);
    assert.doesNotMatch(win, /\[F\.owing, money\(fee\.owing\)\]/, 'never the fee before what is clearing');
    assert.match(readCode('components/admin/kit/club/league/registrations/RegistrationsScreen.tsx'), /clearingCents=\{clearingOf\(openReg\)\}/);
  });
});

describe('C2 · 13e-10 A — "Email these families" past ~200 children', () => {
  const ids = Array.from({ length: 600 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);

  it('a 600-id pick never rides in an address: the season’s read posts it, as Send does', () => {
    const win = readCode('components/admin/kit/club/families/EmailFamiliesWindow.tsx');
    assert.doesNotMatch(win, /registrationIds=/, 'no registration id list in the window’s address');
    assert.doesNotMatch(win, /divisionIds=|statuses=|&kind=season_/, 'no season pick in the address either');
    assert.match(win, /moneyFetch<SeasonEmailPreview>\(base, jsonInit\('POST', JSON\.parse\(seasonPick\)\)\)/);
    assert.match(win, /registrationIds: \[\.\.\.\(ticked \?\? \[\]\)\]\.sort\(\)/);
  });
  it('the body carries all 600, the same scope the address carried', () => {
    const fromBody = parseScope({ kind: 'season_families', seasonId: 's', registrationIds: ids });
    const fromQuery = parseScope({ kind: 'season_families', seasonId: 's', registrationIds: ids.join(',') });
    assert.deepEqual(fromBody, fromQuery);
    assert.equal(fromBody?.kind === 'season_families' && fromBody.registrationIds.length, 600);
  });
  it('the route reads the body exactly as it reads the query: same gate, same season scope, same refusal of a foreign id', () => {
    const route = readCode('app/api/admin/house-league/seasons/[seasonId]/emails/route.ts');
    assert.match(route, /if \(action === 'preview'\) return previewOf\(ctx!, season, body\);/);
    assert.match(route, /return previewOf\(ctx!, season, Object\.fromEntries\(url\.searchParams\)\);/, 'GET is the same read');
    // previewOf: the URL's season always wins (`seasonScope` spreads it last) and every id must be the season's (a 404).
    assert.match(route, /const scope = input\.kind \? seasonScope\(input, season\.id\) : null;/);
    assert.match(route, /if \(scope && !\(await scopeInSeason\(scope, season\.id\)\)\) return NextResponse\.json\(\{ error: 'Not found' \}, \{ status: 404 \}\);/);
    assert.match(route, /const scope = parseScope\(\{ \.\.\.input, seasonId \}\);/);
    // The email right is checked before the body is read; preview sends nothing and adds no audience kind.
    const post = route.slice(route.indexOf('export const POST'));
    assert.ok(post.indexOf("houseLeagueRefusal(ctx, 'email')") < post.indexOf("action === 'preview'"));
    assert.doesNotMatch(route, /season_owing|kind: 'owing'/, 'no server-side "owing" audience (13e-2 A)');
  });
});
