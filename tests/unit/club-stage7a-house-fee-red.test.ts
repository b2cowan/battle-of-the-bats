import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { functionBody, readCode } from './_source-code.ts';

const DB = readCode('lib/db.ts');
const FEE = readCode('lib/league-fee-paid.ts');
const REGISTRATIONS = readCode('app/api/admin/house-league/seasons/[seasonId]/registrations/route.ts');
const REGISTRATION = readCode('app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts');

describe('Stage 7a · the existing house league fee defects, red before the shared write', () => {
  it('1 · fee writes are awaited and insert/link errors cannot be silently accepted', () => {
    assert.doesNotMatch(REGISTRATIONS, /void createLeagueRegistrationFeeEntry\(/);
    assert.doesNotMatch(REGISTRATION, /void createLeagueRegistrationFeeEntry\(/);
    assert.doesNotMatch(DB, /function createLeagueRegistrationFeeEntry\(/,
      'the two-step legacy fee writer must leave when the atomic write takes over');
  });

  it('2 · approval and manual add no longer write receivables before money arrives', () => {
    assert.doesNotMatch(REGISTRATIONS, /createLeagueRegistrationFeeEntry\(/);
    assert.doesNotMatch(REGISTRATION, /createLeagueRegistrationFeeEntry\(/);
    assert.doesNotMatch(REGISTRATIONS, /'pending', ctx!\.user\.id/);
  });

  it('3 · a self registration or waitlist promotion can be paid through the same write', () => {
    const write = functionBody(FEE, 'writeLeagueMoney');
    assert.match(write, /\.rpc\('club_league_money'/);
    assert.doesNotMatch(write, /reg\.status|autoGenerateFees/);
    assert.match(write, /p_registration: target\.regId/);
  });

  it('4 · declining or withdrawing settles any money before returning success (9b-2: asked, never voided)', () => {
    const terminal = REGISTRATION.slice(REGISTRATION.indexOf("if (newStatus === 'declined' || newStatus === 'withdrawn')"));
    assert.match(terminal, /await endLeagueRegistration\(/);
    assert.match(terminal, /if \('refusal' in ended\) return moneyRefusal\(/);
    assert.doesNotMatch(REGISTRATION, /voidLeagueRegistrationFee/);
  });

  it('5 · a void fee is never changed back to posted or pending (the write only adds lines)', () => {
    const write = functionBody(FEE, 'writeLeagueMoney');
    assert.doesNotMatch(write, /\.update\(|\.insert\(/);
    assert.doesNotMatch(FEE, /status: 'posted'|status: 'pending'/);
  });

  it('6 · the first house league book is created with a race safe database step', () => {
    const open = functionBody(DB, 'getOrCreateLeagueSeasonLedger');
    assert.match(open, /\.rpc\('club_league_season_ledger'/);
    assert.doesNotMatch(open, /return mapLedger\(data!\)/);
  });
});
