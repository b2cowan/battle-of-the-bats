/**
 * CLUB COMMUNICATIONS STAGE 1, SESSION 2 — THE PLACE (legal checklist `docs/agents/legal/CLUB_COMMUNICATIONS_STAGE1.md` §2e:
 * T9, T10 (family half), T11, T12, T22 (the family window), T23). The engine's tests are `club-group-email-guard.test.ts`.
 *
 * The rules are pure (`lib/club-communications-place.ts`) and asked by every route through one gate file
 * (`lib/club-communications-auth.ts`); the routes are pinned to those gates by their source, as the repo's other route guards
 * do. The probe (`.probe/club-emails/`) proves the JSON on a seeded club.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import {
  colleagueFilter, commsFilterOf, familyDoor, familyFilter, familyReader, opensCommunications, seasonDoorOpen, type PlaceFacts,
} from '../../lib/club-communications-place.ts';
import { seatOf } from '../../lib/club-group-email-rules.ts';
import { WINDOW } from '../../lib/club-group-email-words.ts';
import { ROLE_DEFAULTS } from '../../lib/roles.ts';
import type { OrgRole } from '../../lib/types.ts';

/** A seat on a Club plan, role defaults only; `o` overrides a fact. */
function facts(role: OrgRole, o: Partial<Omit<PlaceFacts, 'seat'>> = {}): PlaceFacts {
  const has = (c: string) => role === 'owner' || ROLE_DEFAULTS[role].has(c as never);
  const f = {
    role, switchOn: has('module_communications'), teamLimited: false, tournamentOnly: false, planFamilies: true,
    runsLeague: has('module_house_league'), holdsBook: has('module_families'), ...o,
  };
  // The colleague seat from the same facts (a Club plan carries rep teams and house league).
  return { ...f, seat: seatOf({ role, switchOn: f.switchOn, teamLimited: f.teamLimited, tournamentOnly: f.tournamentOnly, planRep: true, planLeague: true, leagueModule: f.runsLeague }) };
}

describe('T9 · the seat table (legal §2c, drawing tab 4)', () => {
  const ROWS: [string, PlaceFacts, { door: 'club' | 'season' | null; place: boolean; season: boolean; reader: 'all' | 'league' | null }][] = [
    ['owner', facts('owner'), { door: 'club', place: true, season: true, reader: 'all' }],
    ['admin (no book)', facts('admin'), { door: 'club', place: true, season: true, reader: 'all' }],
    ['league admin', facts('league_admin'), { door: 'season', place: true, season: true, reader: 'league' }],
    ['registrar', facts('league_registrar'), { door: 'season', place: true, season: true, reader: 'league' }],
    // Session 3: no family choice, but the board is theirs to write to, so they have the place (one button, Email the board).
    ['treasurer', facts('treasurer'), { door: null, place: true, season: false, reader: null }],
    ['staff', facts('staff'), { door: null, place: false, season: false, reader: null }],
    ['volunteer', facts('official'), { door: null, place: false, season: false, reader: null }],
    ['coach', facts('coach'), { door: null, place: false, season: false, reader: null }],
    ['a member limited to some teams', facts('admin', { teamLimited: true }), { door: null, place: false, season: false, reader: null }],
    ['the switch off', facts('admin', { switchOn: false }), { door: null, place: false, season: false, reader: null }],
    ['a tournament-only plan', facts('owner', { tournamentOnly: true }), { door: null, place: false, season: false, reader: null }],
    // A plan without Families: the owner still emails a season from its own window.
    ['a plan without Families', facts('owner', { planFamilies: false }), { door: 'season', place: true, season: true, reader: 'all' }],
    // owner 2026-11-17, as ruled: a book holder who is not owner or admin loses the club-wide send.
    ['staff holding the book', facts('staff', { holdsBook: true, switchOn: true }), { door: null, place: false, season: false, reader: null }],
    ['a registrar holding the book', facts('league_registrar', { holdsBook: true }), { door: 'season', place: true, season: true, reader: 'league' }],
  ];
  for (const [who, f, want] of ROWS) {
    it(who, () => {
      assert.equal(familyDoor(f), want.door, 'which family window');
      assert.equal(opensCommunications(f), want.place, 'the place');
      assert.equal(seasonDoorOpen(f), want.season, 'a season’s own screens');
      assert.equal(familyReader(f)?.scope ?? null, want.reader, 'which family emails the list reads');
    });
  }
  it('the one-family rows are the book’s (ask 13): an admin without it reads none, the owner reads them', () => {
    assert.deepEqual(familyReader(facts('admin')), { scope: 'all', oneFamily: false });
    assert.deepEqual(familyReader(facts('owner')), { scope: 'all', oneFamily: true });
    assert.deepEqual(familyReader(facts('admin', { holdsBook: true })), { scope: 'all', oneFamily: true });
  });
  it('the switch is on by default for every board seat (asks 5, 16); never for staff, a volunteer or a coach', () => {
    for (const r of ['league_admin', 'league_registrar', 'treasurer', 'admin'] as OrgRole[]) assert.ok(ROLE_DEFAULTS[r].has('module_communications'), r);
    for (const r of ['staff', 'official', 'coach'] as OrgRole[]) assert.ok(!ROLE_DEFAULTS[r].has('module_communications'), r);
  });
  it('every route asks its gate on the server; the gates resolve an ACTIVE member (invited and suspended refused)', () => {
    const auth = readCode('lib/club-communications-auth.ts');
    assert.match(auth, /getAuthContextWithRole\(/, 'active members only: api-auth refuses invited and suspended');
    const club = readCode('app/api/admin/families/email/route.ts');
    assert.equal((club.match(/await requireClubFamilyEmail\(req\)/g) ?? []).length, 2, 'the club door: GET and POST');
    assert.doesNotMatch(club, /requireFamiliesAccess/, 'the Families book is not asked (direction ruling 4)');
    for (const f of ['app/api/admin/club-emails/log/route.ts', 'app/api/admin/club-emails/family/[sendId]/route.ts']) {
      assert.match(readCode(f), /await requireCommunications\(req\)/, f);
    }
    assert.match(readCode('app/[orgSlug]/admin/club-emails/layout.tsx'), /opensCommunications\(facts\)/, 'the page’s layout');
  });
});

describe('T10 · a group not offered, posted by hand (the family half)', () => {
  const club = readCode('app/api/admin/families/email/route.ts');
  it('"Families from a list" without the book is refused at preview and at send', () => {
    assert.match(club, /scope\.kind === 'list' && !gate\.facts\.holdsBook\) return NextResponse\.json\(\{ error: SAY\.notOffered/);
    assert.match(club, /body\.kind === 'list' && !facts\.holdsBook\) return NextResponse\.json\(\{ error: SAY\.notOffered/);
  });
  it('without the book the lists are never read for the preview, and a list email is not theirs to finish', () => {
    assert.match(club, /familyEmailPreview\(gate\.ctx, scope, \{ holdsBook: gate\.facts\.holdsBook \}\)/);
    assert.match(club, /resendMissedFamilies\(ctx, body\.sendId, \{ noLists: !facts\.holdsBook \}\)/);
    assert.match(readCode('lib/families-email.ts'), /loadFamilyAudience\(ctx\.org\.id, ctx\.org\.slug, \{ lists: opts\.holdsBook \}\)/);
  });
  it('a league seat and every other seat is refused the club door (it is the owner’s and admins’)', () => {
    for (const r of ['league_admin', 'league_registrar', 'treasurer', 'staff', 'official', 'coach'] as OrgRole[]) {
      assert.notEqual(familyDoor(facts(r)), 'club', r);
    }
  });
});

describe('T11 · the switch off: no group email from any screen; board mail still arrives', () => {
  const off = facts('league_admin', { switchOn: false });
  it('no club door, no season door, no place, no list; no colleague seat', () => {
    assert.equal(familyDoor(off), null);
    assert.equal(seasonDoorOpen(off), false);
    assert.equal(familyReader(off), null);
    const seat = seatOf({ role: 'league_admin', switchOn: false, teamLimited: false, tournamentOnly: false, planRep: true, planLeague: true, leagueModule: true });
    assert.equal(seat.any, false);
  });
  it('the season’s window refuses on the server (every action but an automatic notice’s), and its buttons are absent', () => {
    const route = readCode('app/api/admin/house-league/seasons/[seasonId]/emails/route.ts');
    assert.equal((route.match(/seasonEmailSwitch\(ctx!\)/g) ?? []).length, 2, 'GET and POST');
    assert.match(route, /if \(action !== 'resendNotice'\) \{\s*const off = seasonEmailSwitch\(ctx!\);/);
    assert.match(readCode('components/admin/kit/club/league/email/SeasonEmailsScreen.tsx'), /history\?\.hasFamilies && emailOpen \?/);
    assert.match(readCode('components/admin/kit/club/league/registrations/RegistrationsScreen.tsx'), /email: !!access\?\.email && emailOpen/);
    assert.match(readCode('app/[orgSlug]/admin/house-league/seasons/[seasonId]/money/page.tsx'), /!!access\?\.email && emailOpen/);
    assert.match(readCode('components/admin/kit/club/families/FamiliesBook.tsx'), /\{emailsLists && isFamilyListKey\(show\)/);
  });
  it('receiving board mail asks only the seat: the board audience never reads the switch', () => {
    assert.doesNotMatch(readCode('lib/club-group-email-board.ts'), /module_communications|canOpenModule/);
  });
});

describe('T12 · a wider family email shows a league seat its message and counts and NO names (ask 4)', () => {
  const log = readCode('lib/families-emails-log.ts');
  it('a league seat reads a season’s rows and Every family, never a rep team’s or a list’s', () => {
    assert.match(log, /reader\.scope === 'league' \? q\.or\('season_id\.not\.is\.null,audience_kind\.eq\.every'\) : q/);
    assert.match(log, /return reader\.scope === 'all' \|\| !!row\.season_id \|\| row\.audience_kind === 'every';/);
  });
  it('the names are never READ for that reader, and the record carries no named-lines key at all', () => {
    assert.match(log, /return reader\.scope === 'all' \|\| !!row\.season_id;/, 'names on a season row only');
    assert.match(log, /names \? supabaseAdmin\.from\('family_email_recipients'\)\.select\('family_name, status'\)/);
    assert.match(log, /: supabaseAdmin\.from\('family_email_recipients'\)\.select\('status'\)/);
    assert.match(log, /\.\.\.\(names \? \{\s*missedNamed:/, 'the keys are absent, not null');
  });
  it('a one-family row never falls back to an address (T17): a nameless family reads "A family"', () => {
    assert.doesNotMatch(log, /personDisplayName/);
    assert.match(log, /\|\| W\.nameless;/);
  });
});

describe('T22 · the family window’s lines (ask 11)', () => {
  it('the readers line sits under the message box, in the club’s window and a season’s', () => {
    const w = readCode('components/admin/kit/club/families/EmailFamiliesWindow.tsx');
    // `readCode` strips comments, so the line follows the message box's label directly.
    assert.match(w, /aria-required \/>\s*<\/label>\s*(?:\{\s*\}\s*)?<p className=\{ck\.hint\}>\{CW\.readers\}<\/p>/);
  });
  it('the readers line promises a registrar no names (C7)', () => {
    const [, second] = WINDOW.readers.split('. ');
    assert.match(WINDOW.readers, /owner and admins can read this in Communications and see who it reached\./);
    assert.ok(second && /League admins and registrars can read it too/.test(second), second);
    assert.doesNotMatch(second, /reached|names|who/i);
  });
});

describe('T23 · the old Families › Emails address forwards, above the Families layout', () => {
  it('a config redirect (it runs before any layout), to Communications, not permanent', () => {
    const cfg = readCode('next.config.ts');
    assert.match(cfg, /source: '\/:orgSlug\/admin\/families\/emails', has: ownHost, destination: '\/:orgSlug\/admin\/club-emails', permanent: false/);
  });
  it('no page is left under Families to be refused first, and Families keeps no Emails tab (ask 7)', () => {
    assert.throws(() => readCode('app/[orgSlug]/admin/families/emails/page.tsx'));
    assert.doesNotMatch(readCode('lib/admin-kit-nav.ts'), /id: 'emails', label: 'Emails'/);
  });
  it('the destination applies Communications’ own gate (the "not yours" screen, never a 404)', () => {
    const layout = readCode('app/[orgSlug]/admin/club-emails/layout.tsx');
    assert.match(layout, /<NotYoursScreen \{\.\.\.await notYoursScreenProps\(ctx, page\)\} \/>/);
  });
});

describe('Communications Filter — the ticks (owner 2026-11-20)', () => {
  const S1 = '11111111-1111-4111-8111-111111111111';
  const S2 = '22222222-2222-4222-8222-222222222222';
  const of = (q: string) => commsFilterOf(new URLSearchParams(q));

  it('reads the two tick lists from the address and drops anything else', () => {
    assert.deepEqual(of(''), { kinds: [], seasons: [] });
    assert.deepEqual(of('who=board,families,nobody').kinds, ['families', 'board']);
    assert.deepEqual(of(`season=${S1},not-a-uuid,${S1},${S2}`).seasons, [S1, S2]);
  });

  it('no ticks reads everything from both sources', () => {
    assert.equal(familyFilter(of('')), 'all');
    assert.equal(colleagueFilter(of('')), 'all');
  });

  it('within Sent to the ticks are OR', () => {
    assert.equal(familyFilter(of('who=families')), 'all');
    assert.equal(colleagueFilter(of('who=families')), null);
    assert.equal(familyFilter(of('who=coaches')), null);
    assert.equal(colleagueFilter(of('who=coaches')), 'coaches');
    assert.equal(colleagueFilter(of('who=board')), 'board');
    assert.equal(colleagueFilter(of('who=coaches,board')), 'all');
    assert.equal(familyFilter(of('who=families,board')), 'all');
    assert.equal(colleagueFilter(of('who=families,board')), 'board');
  });

  it('a season narrows the family emails and leaves no coach or board email (AND across groups)', () => {
    assert.deepEqual(familyFilter(of(`season=${S1},${S2}`)), { seasonIds: [S1, S2] });
    assert.equal(colleagueFilter(of(`season=${S1}`)), null);
    assert.equal(familyFilter(of(`who=coaches&season=${S1}`)), null);
    assert.equal(colleagueFilter(of(`who=coaches&season=${S1}`)), null);
  });
});
