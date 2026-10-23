import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import {
  NOTIFICATION_CATEGORY, NOTIFICATION_EVENT_DESCRIPTIONS, NOTIFICATION_EVENT_LABELS, PUSH_DEFAULT_ON_EVENTS,
} from '../../lib/notification-labels.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * Coach names: the club decides who is listed (mig 352; drawings ruled 2026-10-23) — THE WIRING. Source scans, because the
 * rules are about WHERE a thing happens: one rule, called by every consumer; the club's choice never writes a coach's own
 * switch; the owner alone changes it; the setting has no second door. The rule and the words: coach-names-policy.test.ts.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const ROUTE = 'app/api/admin/org/coach-names/route.ts';
const COACH_TEAM_ROUTE = 'app/api/coaches/[orgSlug]/teams/[teamId]/route.ts';

describe('the setting has ONE door: its own owner-only route, behind the rep-teams capability and entitlement', () => {
  const route = readCode(ROUTE);

  it('both verbs gate on the rep-teams capability and entitlement; only the PATCH is the owner\'s', () => {
    assert.match(route, /hasCapability\(ctx\.role, ctx\.capabilities, 'module_rep_teams'\)/);
    assert.match(route, /hasModuleEntitlement\(ctx\.org, 'module_rep_teams'\)/);
    const patch = route.slice(route.indexOf('export const PATCH'));
    assert.match(patch.slice(0, 700), /ctx!\.role !== 'owner'\) return forbidden\(\)/);
    const get = route.slice(route.indexOf('export const GET'), route.indexOf('export const PATCH'));
    assert.doesNotMatch(get, /role !== 'owner'/, 'an admin may read the counts');
  });

  it('a value off the four choices is refused before any write', () => {
    assert.match(route, /parseCoachNamesPolicy\(body\?\.policy\)/);
    assert.match(route, /Pick one of the four choices\./);
    assert.ok(route.indexOf('Pick one of the four choices.') < route.indexOf(".update({ coach_names_policy: next })"));
  });

  it('it writes the club\'s column and nothing else: no coach\'s own switch', () => {
    assert.match(route, /\.update\(\{ coach_names_policy: next \}\)/);
    assert.doesNotMatch(route, /show_name_public|setOwnShowNamePublic/);
  });

  it('it is not a door through org-settings, and not under the coaches routes (the look-back year guard scans that folder)', () => {
    assert.doesNotMatch(readCode('app/api/admin/org-settings/route.ts'), /coachNamesPolicy|coach_names_policy/);
    assert.ok(ROUTE.startsWith('app/api/admin/org/'));
  });

  it('a newly listed coach is told once, best-effort, and never the owner who chose it', () => {
    assert.match(route, /listingChange\(before, next, await loadListingSeats\(ctx!\.org\.id\)\)/);
    assert.match(route, /tellCoachesNewlyListed\(/);
    const notify = readCode('lib/coach-names-notify.ts');
    assert.match(notify, /eventType: 'club_coach_listed'/);
    assert.match(notify, /if \(userId === p\.actorUserId\) continue;/);
    assert.match(notify, /catch \(e\)/);
    assert.match(notify, /userIds: \[userId\]/, 'one notice per person');
  });
});

describe('every consumer calls the ONE rule (lib/coach-names-policy.ts) — no second copy of the table', () => {
  it('the Coaches shelf: "No coach names" reads nothing; the switch-on read is kept for "Coaches choose"; the others filter through the rule', () => {
    const lib = readCode('lib/club-team-coaches.ts');
    assert.match(lib, /if \(policy === 'none'\) return \[\];/);
    assert.match(lib, /policy === 'coaches_choose'\s*\?\s*await listPublicNameMemberships\(orgId, teamId\)/);
    assert.match(lib, /listActiveMemberships\(orgId, teamId\)\)\.filter\(m => seatNameListing\(policy, m\)\.listed\)/);
    assert.match(lib, /publicPersonName\(/, 'a coach with no name on file is still left out');
    assert.doesNotMatch(lib, /\.email\b|phone/i);
  });

  it('the shelf\'s active-seats read is org- and team-scoped and active only', () => {
    const m = readCode('lib/coach-membership.ts');
    const fn = m.slice(m.indexOf('export async function listActiveMemberships'));
    assert.match(fn.slice(0, 500), /\.eq\('org_id', orgId\)\s*\.eq\('team_id', teamId\)\s*\.eq\('status', 'active'\)/);
  });

  it('the team page and the tryout page hand the club\'s choice to their readers', () => {
    assert.match(readCode('app/[orgSlug]/teams/[teamSlug]/page.tsx'), /getPublicTeamCoaches\(org\.id, team\.id, org\.coachNamesPolicy\)/);
    assert.match(readCode('app/[orgSlug]/teams/[teamSlug]/tryouts/page.tsx'), /getPublicTryoutContact\(org\.id, team\.id, org\.coachNamesPolicy\)/);
  });

  it('the tryout line\'s name goes through the rule, still never the account address, and only for a live head coach', () => {
    const lib = readCode('lib/coach-tryout-contact.ts');
    const pub = lib.slice(lib.indexOf('export async function getPublicTryoutContact'), lib.indexOf('export async function setTryoutContact'));
    assert.match(pub, /seatNameListing\(policy, live\.setter\)\.listed/);
    assert.doesNotMatch(pub, /resolveCoachUserIdentities|\.email \?\?/);
    assert.match(lib, /liveTryoutContactEmail\(/, 'the setter must still be an active head coach (unchanged)');
  });

  it('the coach\'s own row: the server computes the three facts, and the stored switch is still the coach\'s own', () => {
    const route = readCode(COACH_TEAM_ROUTE);
    assert.match(route, /const listing = seatNameListing\(policy, membership\);/);
    assert.match(route, /showMyName: membership\.showNamePublic,/);
    assert.match(route, /namesPolicy: policy,/);
    assert.match(route, /ownSwitchApplies: listing\.ownSwitchApplies,/);
    assert.match(route, /listedByClub: !listing\.ownSwitchApplies && listing\.listed,/);
    // The switch's PATCH is unchanged: it sets the caller's own saved choice whatever the club chose.
    assert.match(route, /setOwnShowNamePublic\(membership\.id, teamId, body\.showMyName\)/);
    assert.doesNotMatch(route.slice(route.indexOf('setOwnShowNamePublic(membership.id')), /coachNamesPolicy/);
  });

  it('nothing else spells the rule: only the policy file names the policy values in code', () => {
    for (const f of ['lib/club-team-coaches.ts', 'lib/coach-tryout-contact.ts', COACH_TEAM_ROUTE]) {
      assert.doesNotMatch(readCode(f), /heads_and_assistants_always|'heads_always'/, f);
    }
  });
});

describe('the org carries the choice everywhere an org is mapped, failing closed to "Coaches choose"', () => {
  for (const f of ['lib/db.ts', 'lib/server-organizations.ts', 'lib/api-auth.ts']) {
    it(`${f} maps coach_names_policy through the sanitizer`, () => {
      assert.match(readCode(f), /coachNamesPolicy: sanitizeCoachNamesPolicy\(\w+\.coach_names_policy\)/);
    });
  }
  it('the Organization type carries it', () => {
    assert.match(readCode('lib/types.ts'), /coachNamesPolicy\?: import\('\.\/coach-names-policy'\)\.CoachNamesPolicy;/);
  });
});

describe('the notice: a "know" bell, registered everywhere a lifecycle bell is, and never a Needs attention kind', () => {
  it('is labelled, described, categorised "know", push-default-on, and given a preferences row', () => {
    assert.ok(NOTIFICATION_EVENT_LABELS.club_coach_listed);
    assert.ok(NOTIFICATION_EVENT_DESCRIPTIONS.club_coach_listed);
    assert.equal(NOTIFICATION_CATEGORY.club_coach_listed, 'know');
    assert.ok(PUSH_DEFAULT_ON_EVENTS.has('club_coach_listed'));
    assert.match(readCode('lib/notification-view.ts'), /club_coach_listed:/);
    assert.match(readCode('app/(consumer)/account/notifications/AccountNotificationsClient.tsx'), /'club_season_changed', 'club_coach_listed'/);
  });
});

describe('the club\'s row on Public site: the owner\'s radios, absent without Rep teams, the admin reads', () => {
  const page = readCode('app/[orgSlug]/admin/public-site/page.tsx');
  const panel = readCode('app/[orgSlug]/admin/public-site/CoachNamesPanel.tsx');

  it('is the sixth row, between Contacts and documents and Visibility, shown only with the rep-teams entitlement', () => {
    assert.match(page, /const showCoachNames = hasModuleEntitlement\(currentOrg, 'module_rep_teams'\);/);
    const lists = page.indexOf('<BuilderRow id="lists"');
    const coaches = page.indexOf('<BuilderRow id="coaches"');
    const visibility = page.indexOf('<BuilderRow id="visibility"');
    assert.ok(lists > 0 && lists < coaches && coaches < visibility);
  });

  it('only an "always" choice asks first, from the real counts; the list stays on the old choice until "List them"', () => {
    assert.match(panel, /if \(next !== 'heads_always' && next !== 'heads_and_assistants_always'\) return void save\(next\);/);
    assert.match(panel, /checked: shown === c\.value/);
    assert.match(panel, /onClose=\{\(\) => setAsking\(null\)\}/);
    assert.match(panel, /kind="question"/);
    assert.doesNotMatch(panel, /disabled=\{!isOwner\}/, 'absent beats disabled: an admin gets facts, never a greyed radio');
  });

  it('the words come from the one words file, and "listed" is the only spelling of the idea', () => {
    assert.match(panel, /from '@\/lib\/coach-names-words'/);
    const words = readCode('lib/coach-names-words.ts');
    assert.doesNotMatch(words, /\b(?:shown publicly|visible)\b/i);
  });
});
