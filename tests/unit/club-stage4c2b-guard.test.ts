import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode, filesUnder } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * Club Tier Stage 4c-2 Part B — THE COACH'S SIDE, WIRED (drawings ruled 2026-10-22). Source scans, because the rules are
 * about WHERE a thing may appear:
 *   1. The head coach's tryout address reaches the public on ONE surface: the team's own tryout page, while open or not
 *      open yet. Never the footer, the club's Tryouts page, the team page, the sign-up form, the season-numbered pages,
 *      a share card, JSON-LD or a link preview (Ask 3).
 *   2. Coaches on the team page: name and role only, only coaches who switched their own name on — never an email, a
 *      phone or a player.
 *   3. The address is written only by a head coach (by role, not the tryouts grant) and by the club's reset.
 *   4. Every coach can open Settings, and the door + name switch are served to every coach.
 * The rules themselves: club-stage4c2b.test.ts.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const ORG = 'app/[orgSlug]';
const TRYOUT_PAGE = `${ORG}/teams/[teamSlug]/tryouts/page.tsx`;
const TEAM_PAGE = `${ORG}/teams/[teamSlug]/page.tsx`;
const READER = 'lib/coach-tryout-contact.ts';

/** Every source file that may name the coach's address store or its public reader — and nothing else. */
const ALLOWED = new Set([
  READER,
  'lib/coach-tryout-contact-clear.ts',                                  // the clear on removal and demotion (a leaf)
  'lib/coach-membership.ts',                                            // calls that clear
  TRYOUT_PAGE,                                                          // the ONE public surface
  'app/api/coaches/[orgSlug]/teams/[teamId]/tryout-contact/route.ts',   // the head coach's row
  'app/api/admin/rep-teams/teams/[teamId]/tryout-contact/route.ts',     // the club's line and reset
]);

const SOURCES = [...filesUnder('app', '.ts'), ...filesUnder('app', '.tsx'), ...filesUnder('lib', '.ts'), ...filesUnder('components', '.tsx')];

describe('1 · the coach\'s tryout address has one public surface', () => {
  it('only the allowed files name its store or its reader', () => {
    const offenders = SOURCES.filter(f => !ALLOWED.has(f)).filter(f => {
      const code = readCode(f);
      return /rep_team_tryout_contacts|coach-tryout-contact|getPublicTryoutContact/.test(code);
    });
    assert.deepEqual(offenders, [], 'the coach\'s address reached a surface it must never reach');
  });
  it('the table is read and written by its module and the clear alone', () => {
    const offenders = SOURCES.filter(f => f !== READER && f !== 'lib/coach-tryout-contact-clear.ts' && /rep_team_tryout_contacts/.test(readCode(f)));
    assert.deepEqual(offenders, []);
  });
  it('the tryout page reads it only while open or not open yet, and hands it to the view alone', () => {
    const code = readCode(TRYOUT_PAGE);
    assert.match(code, /getPublicTryoutContact\(org\.id, team\.id\)/);
    assert.match(code, /const coachContact = tryoutStateShowsCoachContact\(standing\.state\) \? contact : null;/);
    assert.match(code, /coachContact=\{coachContact\}/);
  });
  it('no other page passes a coach contact to the tryout view (season-numbered pages, sign-up, previews)', () => {
    const offenders = SOURCES.filter(f => f !== TRYOUT_PAGE && /coachContact=/.test(readCode(f)));
    assert.deepEqual(offenders, []);
  });
  it('the view shows it only in the two states, and the club\'s footer line is untouched', () => {
    const view = readCode('components/rep-teams/TryoutLandingView.tsx');
    assert.match(view, /coachContact && tryoutStateShowsCoachContact\(state\)/);
    assert.doesNotMatch(readCode('components/public/ClubContactLine.tsx'), /coach/i);
    assert.doesNotMatch(readCode('components/public/ClubFooter.tsx'), /coach/i);
  });
  it('the metadata, share cards and JSON-LD never read it', () => {
    for (const f of [
      `${ORG}/teams/[teamSlug]/tryouts/tryout-metadata.ts`,
      `${ORG}/teams/[teamSlug]/tryouts/opengraph-image.tsx`,
      `${ORG}/teams/[teamSlug]/opengraph-image.tsx`,
      `${ORG}/opengraph-image.tsx`,
      'lib/club-share.ts',
    ]) {
      assert.doesNotMatch(readCode(f), /coach/i, `${f} must not reach a coach`);
    }
  });
});

describe('2 · Coaches on the team page: name and role only, never a player', () => {
  const lib = readCode('lib/club-team-coaches.ts');
  it('reads only coaches who switched their name on, on an active seat', () => {
    assert.match(lib, /listPublicNameMemberships\(orgId, teamId\)/);
    const membership = readCode('lib/coach-membership.ts');
    const fn = membership.slice(membership.indexOf('export async function listPublicNameMemberships'));
    assert.match(fn.slice(0, 500), /\.eq\('status', 'active'\)\s*\.eq\('show_name_public', true\)/);
  });
  it('returns no contact, and never falls back to an address for a name', () => {
    assert.doesNotMatch(lib, /\.email\b|phone/i);
    assert.match(lib, /publicPersonName\(/);
  });
  it('the section renders a name and a role and nothing else of the coach', () => {
    const page = readCode(TEAM_PAGE);
    const block = page.slice(page.indexOf("part === 'coaches'"), page.indexOf('return null;', page.indexOf("part === 'coaches'")));
    assert.ok(block.length > 0, 'the Coaches block exists');
    assert.match(block, /\{c\.name\}/);
    assert.match(block, /\{c\.role\}/);
    assert.doesNotMatch(block, /c\.email|phone|player|roster|athlete/i);
  });
  it('names show only while the team has a live season (owner ruling 2026-10-22)', () => {
    assert.match(readCode(TEAM_PAGE), /!team\.isArchived && liveSeasonOf\(programYears\) \? getPublicTeamCoaches\(org\.id, team\.id\)/);
  });
  it('no player is ever read for the team page', () => {
    assert.doesNotMatch(readCode(TEAM_PAGE), /rep_team_players|getRepTeamRoster|roster/i);
  });
});

describe('3 · who writes the address', () => {
  it('the coach route writes only for a head coach by role — not the tryouts grant', () => {
    const code = readCode('app/api/coaches/[orgSlug]/teams/[teamId]/tryout-contact/route.ts');
    assert.match(code, /isHead: membership\?\.coachRole === 'head_coach'/);
    for (const verb of ['PUT', 'DELETE']) {
      const body = code.slice(code.indexOf(`export const ${verb}`));
      assert.match(body.slice(0, 600), /if \(!r\.isHead/, `${verb} refuses anyone but a head coach`);
    }
    assert.match(code, /checkTryoutContactEmail\(body\.email, r\.ctx\.user\.email\)/);
  });
  it('the club\'s reset is the rep-teams write gate', () => {
    const code = readCode('app/api/admin/rep-teams/teams/[teamId]/tryout-contact/route.ts');
    const del = code.slice(code.indexOf('export const DELETE'));
    assert.match(del, /resolveClubTeam\(req, teamId, \{ write: true \}\)/);
  });
});

describe('4 · every coach reaches their own name switch', () => {
  it('Settings is open to every coach', () => {
    assert.match(readCode('lib/coach-nav-visibility.ts'), /case 'Settings':\s*return true;/);
  });
  it('the team route serves the door and the caller\'s own switch to every member, and writes only their own', () => {
    const code = readCode('app/api/coaches/[orgSlug]/teams/[teamId]/route.ts');
    assert.match(code, /showMyName: membership\.showNamePublic/);
    assert.match(code, /setOwnShowNamePublic\(membership\.id, teamId, body\.showMyName\)/);
  });
});
