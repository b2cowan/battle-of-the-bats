import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filesUnder, functionBody, readCode, readSource } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLUB TIER STAGE 9b-1, PART 3 — A HOUSE-LEAGUE SPOT IS TAKEN ONCE (plan §2 contract; owner 2026-10-25 "a received
 * child holds a spot"). Every house-league path that places, accepts, waitlists or promotes a child goes through
 * lib/league-registration-place.ts, whose every call is one database function holding the season's lock (mig 362).
 * This guard fails the build when a route inserts a registration, flips its status or moves the waitlist any other way.
 * The race itself is proven against dev by scripts/house-league-signup-race.mjs.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const ROUTES = [
  ...filesUnder('app/api/admin/house-league', '.ts'),
  ...filesUnder('app/api/league', '.ts'),
];
const PLACE = readCode('lib/league-registration-place.ts');
const DB = readCode('lib/db.ts');
const MIG = readSource('supabase/migrations/362_a_house_league_spot_is_taken_once.sql').replace(/--.*$/gm, '');

describe('no house-league path places a child around the lock', () => {
  it('reads the routes it means to (the census is not reading an empty tree)', () => {
    assert.ok(ROUTES.some(f => f.endsWith('register/route.ts')));
    assert.ok(ROUTES.some(f => f.endsWith('registrations/[regId]/route.ts')));
  });

  for (const file of ROUTES) {
    it(file, () => {
      const code = readCode(file);
      const writes = [...code.matchAll(/from\('league_registrations'\)([\s\S]{0,160})/g)].map(m => m[1]);
      for (const w of writes) {
        assert.doesNotMatch(w, /^\s*\.insert\(/, 'a registration is inserted only by league_registration_place');
        assert.doesNotMatch(w, /^\s*\.update\(\{[^}]*\b(status|waitlist_position)\s*:/,
          'a registration’s status or waitlist place changes only through the locked functions');
      }
      assert.doesNotMatch(code, /\b(createRegistration|updateRegistrationStatus|promoteFromWaitlist|compactWaitlist)\(/);
    });
  }

  it('the old blind insert, status flip and promote helpers are gone from lib/db.ts', () => {
    assert.doesNotMatch(DB, /function (createRegistration|updateRegistrationStatus|promoteFromWaitlist|getWaitlistForDivision)\(/);
  });
});

describe('every door uses the locked functions', () => {
  it('the public form and the staff hand-add place through placeLeagueRegistration, with the recorded price', () => {
    for (const f of ['app/api/league/[orgSlug]/[seasonSlug]/register/route.ts', 'app/api/admin/house-league/seasons/[seasonId]/registrations/route.ts']) {
      const code = readCode(f);
      assert.match(code, /placeLeagueRegistration\(/, f);
      assert.match(code, /feeAmount:\s*leaguePrice\(/, `${f} records the price on the club’s day`);
    }
  });

  it('staff Approve / Waitlist move through moveLeagueRegistration; a full division is refused, never over-filled', () => {
    const code = readCode('app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts');
    assert.match(code, /moveLeagueRegistration\(/);
    assert.match(code, /is full\. Add to the waitlist instead\./);
  });

  it('ending, moving and re-dividing a child promote inside their own locked step, never as a second call', () => {
    const code = readCode('app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts');
    assert.match(code, /voidLeagueRegistrationFee\([^)]*'declined'[^)]*season\.autoPromoteWaitlist\)/);
    assert.match(code, /voidLeagueRegistrationFee\([^)]*'withdrawn'[^)]*season\.autoPromoteWaitlist\)/);
    assert.match(code, /moveLeagueRegistration\([^)]*season\.autoPromoteWaitlist\)/);
    assert.match(code, /changeLeagueDivision\([^)]*season\.autoPromoteWaitlist\)/);
    assert.doesNotMatch(code, /promoteLeagueWaitlist\(/, 'a separate promote call could leave a freed spot unfilled');
    assert.match(readCode('lib/league-fee-paid.ts'), /\.rpc\('league_registration_end'/);
  });

  it('a new division is a placement: the reassignment never writes division_id itself', () => {
    const code = readCode('app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts');
    assert.doesNotMatch(code, /division_id\s*[:=]/);
    assert.match(functionBody(PLACE, 'changeLeagueDivision'), /\.rpc\('league_registration_change_division'/);
  });

  it('emails follow a real change, decided under the lock', () => {
    const code = readCode('app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts');
    assert.match(code, /const changed = result\.moved\.changed;/);
  });

  it('the wrapper calls only the database functions', () => {
    assert.match(functionBody(PLACE, 'placeLeagueRegistration'), /\.rpc\('league_registration_place'/);
    assert.match(functionBody(PLACE, 'moveLeagueRegistration'), /\.rpc\('league_registration_move'/);
    assert.match(functionBody(PLACE, 'promoteLeagueWaitlist'), /\.rpc\('league_waitlist_promote'/);
  });
});

describe('the database functions hold the season lock and count received children', () => {
  for (const fn of ['league_registration_place', 'league_registration_move', 'league_registration_change_division',
    'league_registration_end', 'league_waitlist_promote']) {
    it(`${fn} takes the season row lock first`, () => {
      const body = MIG.slice(MIG.indexOf(`FUNCTION public.${fn}(`));
      const end = body.indexOf('END $$;');
      const lockAt = body.search(/FROM league_seasons[^;]*FOR NO KEY UPDATE/);
      const firstWrite = body.search(/\b(INSERT INTO|UPDATE) league_registrations|league_waitlist_promote_locked\(/);
      assert.ok(lockAt > 0 && lockAt < end && (firstWrite < 0 || lockAt < firstWrite), `${fn} locks the season before it writes`);
    });
  }
  it('the old ending (prod code before this release) runs the same locked step', () => {
    const body = MIG.slice(MIG.indexOf('FUNCTION public.club_league_fee_end('));
    assert.match(body.slice(0, body.indexOf('END $$;')), /league_registration_end\(/);
  });
  it('nobody jumps the line: a public sign-up joins a waitlist that exists, even when a spot is free', () => {
    assert.match(MIG, /WHEN NOT v_room OR v_line THEN 'waitlisted'/);
  });
  it('a spot is held by an accepted or a received child', () => {
    assert.match(MIG, /status IN \('active','pending_review'\)/);
  });
  it('no unique index on the waitlist place (closing a gap shifts several rows at once; the lock is the guarantee)', () => {
    assert.doesNotMatch(MIG, /UNIQUE[^;]*waitlist_position/i);
  });
});
