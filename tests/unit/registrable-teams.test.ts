import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildRegistrableTeams, findRegistrableTeam, whoRegistersSentence, pickEntryHeadCoach, entryCoachRecord, CHOOSE_HEAD_COACH,
  alreadyRegisteredLine, alreadyRegisteredRefusal, isChoosableTeam, matchTeamEntries, differentTeamSentence,
  type FreeTeamMembership, type LivePortal, type PortalStaffMember, type TeamEntryInTournament, type TeamEntryLink, type TeamEntryRow,
} from '../../lib/registrable-teams';
import { portalTournamentRecordPath } from '../../lib/coaches-portal-routes';
import {
  STAFF_PRESETS, STAFF_KINDS, ASSISTANT_DEFAULTS, resolveCoachCapabilities, sanitizeAssistantGrants, grantsOf,
  applyOrgGrantPolicy, staffKindCopyFor, canOpenTournaments, canConfigureTeam,
} from '../../lib/coach-capabilities';
import { SENSITIVE_KEYS, delegationViolation } from '../../lib/coach-staff-delegation';
import { GRANT_LABELS } from '../../lib/coach-staff-labels';

/**
 * WHO MAY REGISTER WHICH TEAM (owner D1, 2026-10-13). A Premium coach registering from a WhatsApp
 * link was offered his portal under last season's free-team name and made a second team; none of his
 * five staff could have seen the team at all. These pin the one computation the form, the join page
 * and the server all read: the portal's CURRENT name, Premium first, the staff PERMISSION (never
 * membership of the free team underneath) deciding, a locked card naming who can, and the server
 * refusing exactly what the form greys out. Plan: COACH_REGISTER_EXISTING_TEAM_PLAN.md.
 */

const ME = 'me';
const free = (id: string, name: string, teamWorkspaceId: string | null = null): FreeTeamMembership => ({ id, name, teamWorkspaceId });
const head = (userId: string, name: string | null = null): PortalStaffMember => ({ membershipId: `ms-${userId}`, userId, name, coachRole: 'head_coach', capabilities: null, staffKind: null });
const manager = (userId: string, name: string | null = null): PortalStaffMember => ({ membershipId: `ms-${userId}`, userId, name, coachRole: 'assistant_coach', capabilities: { ...STAFF_PRESETS.manager }, staffKind: 'manager' });
const assistant = (userId: string, name: string | null = null, extra: Record<string, unknown> = {}): PortalStaffMember => ({ membershipId: `ms-${userId}`, userId, name, coachRole: 'assistant_coach', capabilities: { ...STAFF_PRESETS.assistant, ...extra }, staffKind: 'assistant' });
const portal = (over: Partial<LivePortal> & Pick<LivePortal, 'workspaceId' | 'twinId'>): LivePortal => ({
  repTeamId: `rep-${over.workspaceId}`, orgSlug: `org-${over.workspaceId}`, name: 'Milton Bats U13 Purple',
  standalone: true, staff: [], ...over,
});

describe('a Premium team is offered to its staff by permission', () => {
  it('offers the head coach their portal under its CURRENT name, first, already theirs to choose (F3)', () => {
    const [card] = buildRegistrableTeams({
      userId: ME,
      freeTeams: [free('twin', 'Milton Bats U13 White', 'ws')],
      portals: [portal({ workspaceId: 'ws', twinId: 'twin', staff: [head(ME, 'Brett Jackson')] })],
    });
    assert.equal(card.name, 'Milton Bats U13 Purple');
    assert.equal(card.basicCoachTeamId, 'twin', 'the entry still links to the twin the portal reads');
    assert.equal(card.isPortalTeam, true);
    assert.equal(card.locked, false);
    assert.equal(card.youAre, 'the head coach');
    assert.deepEqual(card.portal, { orgSlug: 'org-ws', repTeamId: 'rep-ws' });
  });

  it('offers a team manager the team with no change from the head coach (the preset holds the grant)', () => {
    const [card] = buildRegistrableTeams({
      userId: ME, freeTeams: [],
      portals: [portal({ workspaceId: 'ws', twinId: 'twin', staff: [head('h', 'Brett Jackson'), manager(ME)] })],
    });
    assert.equal(card.locked, false);
    assert.equal(card.youAre, 'the team manager');
    assert.equal(card.basicCoachTeamId, 'twin', 'offered WITHOUT being a member of the free team underneath');
  });

  it('locks the team for an assistant without the switch, naming who can register it, head coaches first', () => {
    const [card] = buildRegistrableTeams({
      userId: ME, freeTeams: [],
      portals: [portal({ workspaceId: 'ws', twinId: 'twin', staff: [manager('m', 'Alex Morgan'), assistant(ME, 'Sam Patel'), head('h', 'Brett Jackson')] })],
    });
    assert.equal(card.locked, true);
    assert.equal(card.youAre, 'an assistant coach');
    assert.deepEqual(card.registeredBy, [{ name: 'Brett Jackson', role: 'head coach' }, { name: 'Alex Morgan', role: 'team manager' }]);
    assert.equal(whoRegistersSentence(card),
      'Brett Jackson (head coach) or Alex Morgan (team manager) registers this team. Ask Brett if you need to do it yourself.');
  });

  it('unlocks it for an assistant the head coach gave the switch to', () => {
    const [card] = buildRegistrableTeams({
      userId: ME, freeTeams: [],
      portals: [portal({ workspaceId: 'ws', twinId: 'twin', staff: [head('h'), assistant(ME, null, { registerTournaments: true })] })],
    });
    assert.equal(card.locked, false);
  });

  it('gives a member of the twin who is NOT on the staff nothing: membership of the free team confers no right', () => {
    const teams = buildRegistrableTeams({
      userId: ME,
      freeTeams: [free('twin', 'Twin', 'ws'), free('mine', 'My free team')],
      portals: [portal({ workspaceId: 'ws', twinId: 'twin', staff: [head('someone-else')] })],
    });
    assert.deepEqual(teams.map(t => t.basicCoachTeamId), ['mine']);
  });

  it('shows the team once when this person is both on the staff and a member of the twin', () => {
    const teams = buildRegistrableTeams({
      userId: ME,
      freeTeams: [free('twin', 'Old name', 'ws')],
      portals: [portal({ workspaceId: 'ws', twinId: 'twin', staff: [head(ME)] })],
    });
    assert.equal(teams.length, 1);
    assert.equal(teams[0].name, 'Milton Bats U13 Purple');
  });

  it('skips a portal whose twin could not be resolved rather than offering a team nothing can link to', () => {
    assert.deepEqual(buildRegistrableTeams({
      userId: ME, freeTeams: [], portals: [portal({ workspaceId: 'ws', twinId: null, staff: [head(ME)] })],
    }), []);
  });

  it('lands a portal with no readable slug as a free team would (no Premium record link)', () => {
    const [card] = buildRegistrableTeams({
      userId: ME, freeTeams: [], portals: [portal({ workspaceId: 'ws', twinId: 'twin', orgSlug: null, staff: [head(ME)] })],
    });
    assert.equal(card.portal, null);
  });
});

describe('the order and the names on the cards (A4, kept)', () => {
  it('lists open Premium teams, then locked ones, then free teams, keeping each group’s own order', () => {
    const teams = buildRegistrableTeams({
      userId: ME,
      freeTeams: [free('a', 'Old free team'), free('c', 'Another free')],
      portals: [
        portal({ workspaceId: 'ws-l', twinId: 'l', name: 'Locked portal', staff: [head('h'), assistant(ME)] }),
        portal({ workspaceId: 'ws-b', twinId: 'b', name: 'Portal B', staff: [head(ME)] }),
        portal({ workspaceId: 'ws-d', twinId: 'd', name: 'Portal D', staff: [manager(ME)] }),
      ],
    });
    assert.deepEqual(teams.map(t => t.name), ['Portal B', 'Portal D', 'Locked portal', 'Old free team', 'Another free']);
  });

  it('renames only the portal’s own twin: a second free team with the same back-link stays an ordinary team', () => {
    const teams = buildRegistrableTeams({
      userId: ME,
      freeTeams: [free('stale', 'Old copy', 'ws'), free('twin', 'Twin', 'ws')],
      portals: [portal({ workspaceId: 'ws', twinId: 'twin', name: 'Portal', staff: [head(ME)] })],
    });
    assert.deepEqual(teams.map(t => [t.basicCoachTeamId, t.name, t.isPortalTeam]), [['twin', 'Portal', true], ['stale', 'Old copy', false]]);
  });

  it('leaves a canceled portal’s free team alone: own name, own place, no tag (a canceled portal is not live)', () => {
    const teams = buildRegistrableTeams({ userId: ME, freeTeams: [free('a', 'Free A'), free('b', 'Was Premium', 'ws-canceled')], portals: [] });
    assert.deepEqual(teams.map(t => [t.name, t.isPortalTeam, t.locked]), [['Free A', false, false], ['Was Premium', false, false]]);
  });

  it('keeps the twin’s own name when the portal’s name is missing or blank', () => {
    for (const name of [null, '   ']) {
      const [card] = buildRegistrableTeams({
        userId: ME,
        freeTeams: [free('twin', 'Twin name', 'ws')],
        portals: [portal({ workspaceId: 'ws', twinId: 'twin', name, staff: [head(ME)] })],
      });
      assert.equal(card.name, 'Twin name', String(name));
      assert.equal(card.isPortalTeam, true);
    }
  });

  it('does not change what it was given, and copes with nothing', () => {
    const freeTeams = [free('twin', 'Twin', 'ws')];
    buildRegistrableTeams({ userId: ME, freeTeams, portals: [portal({ workspaceId: 'ws', twinId: 'twin', staff: [head(ME)] })] });
    assert.equal(freeTeams[0].name, 'Twin');
    assert.deepEqual(buildRegistrableTeams({ userId: ME, freeTeams: [], portals: [] }), []);
  });
});

describe('a team that moved into its club is out of scope — offered exactly as before', () => {
  const club = (over: Partial<LivePortal> = {}) => portal({ workspaceId: 'ws', twinId: 'twin', name: 'Club team', standalone: false, ...over });

  it('offers its twin to the twin’s members under the portal’s name, unlocked, landing as before', () => {
    const [card] = buildRegistrableTeams({ userId: ME, freeTeams: [free('twin', 'Old', 'ws')], portals: [club()] });
    assert.deepEqual([card.name, card.isPortalTeam, card.locked, card.portal], ['Club team', true, false, null]);
  });

  it('with no twin recorded, the earliest back-linked team stands in (the one the portal adopts)', () => {
    const teams = buildRegistrableTeams({
      userId: ME, freeTeams: [free('first', 'First', 'ws'), free('second', 'Second', 'ws')], portals: [club({ twinId: null })],
    });
    assert.deepEqual(teams.map(t => [t.basicCoachTeamId, t.name, t.isPortalTeam]), [['first', 'Club team', true], ['second', 'Second', false]]);
  });

  it('never offers a club team through the staff permission', () => {
    assert.deepEqual(buildRegistrableTeams({ userId: ME, freeTeams: [], portals: [club({ staff: [head(ME)] })] }), []);
  });
});

describe('the server refuses exactly what the form greys out (D1, part 4)', () => {
  const teams = buildRegistrableTeams({
    userId: ME,
    freeTeams: [free('mine', 'My free team')],
    portals: [
      portal({ workspaceId: 'ws-open', twinId: 'open', staff: [head(ME)] }),
      portal({ workspaceId: 'ws-locked', twinId: 'locked', staff: [head('h'), assistant(ME)] }),
    ],
  });

  it('allows a free team and a Premium team the person may register', () => {
    assert.equal(findRegistrableTeam(teams, 'mine')?.basicCoachTeamId, 'mine');
    assert.equal(findRegistrableTeam(teams, 'open')?.basicCoachTeamId, 'open');
  });

  it('refuses a locked card, a team the person is not on, and no team at all', () => {
    assert.equal(findRegistrableTeam(teams, 'locked'), null);
    assert.equal(findRegistrableTeam(teams, 'someone-elses'), null);
    assert.equal(findRegistrableTeam(teams, null), null);
    assert.equal(findRegistrableTeam(teams, ''), null);
  });

  it('names the portal a Premium entry joins, and none for a free team; the record route is spelled once', () => {
    assert.deepEqual(findRegistrableTeam(teams, 'open')?.portal, { orgSlug: 'org-ws-open', repTeamId: 'rep-ws-open' });
    assert.equal(findRegistrableTeam(teams, 'mine')?.portal, null);
    assert.equal(portalTournamentRecordPath('org-ws-open', 'rep-ws-open', 'reg-1'), '/org-ws-open/coaches/teams/rep-ws-open/tournaments/reg-1');
  });

  it('the free record forwards a Premium entry exactly when the portal record will open (its own gate)', () => {
    const page = readFileSync(join(process.cwd(), 'app', 'coaches', 'tournaments', '[teamId]', 'page.tsx'), 'utf8');
    assert.match(page, /findRepTeamAccessForRegistration\(user\.id, teamId\)/);
    assert.match(page, /isTeamWorkspaceOrg\(/, 'standalone portals only — a club is out of scope');
    assert.ok(page.indexOf('if (portalHref) redirect(portalHref)') < page.indexOf('<CoachTournamentRecord'));
  });

  it('is asked BEFORE the entry is created, and by the link itself — never by free-team membership', () => {
    const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');
    const register = read('app', 'api', 'register', 'route.ts');
    const check = register.search(/if \(basicCoachTeamId && !chosenTeam\)/);
    assert.ok(check > 0 && register.search(/const chosenTeam = basicCoachTeamId \? findRegistrableTeam\(registrableTeams/) > 0,
      '/api/register asks the D1 question');
    const insert = register.search(/\.from\('teams'\)\s*\.insert\(/);
    assert.ok(insert > 0 && check < insert, 'and asks it before the entry exists');
    assert.match(register, /registrableTeams,\s*\}\);/, 'and hands the same answer to the link, so it is computed once');
    const link = read('lib', 'basic-coach-teams.ts').replace(/\r\n/g, '\n');
    const linkFn = link.slice(link.indexOf('export async function linkTournamentRegistrationToBasicCoachTeam'));
    const body = linkFn.slice(0, linkFn.indexOf('\n}\n'));
    assert.match(body, /const mayRegister = async \(teamId: string\) => findRegistrableTeam\(/);
    assert.match(body, /!\(await mayRegister\(basicCoachTeamId\)\)/);
    assert.doesNotMatch(body, /userOwnsBasicCoachTeam\(params\.userId, basicCoachTeamId\)/,
      'twin membership is not the question any more');
  });
});

describe('the head coach comes from the portal (Stage 1b, C1 + C2)', () => {
  const cardFor = (staff: PortalStaffMember[], freeTeams: FreeTeamMembership[] = []) =>
    buildRegistrableTeams({ userId: ME, freeTeams, portals: [portal({ workspaceId: 'ws', twinId: 'twin', staff })] })[0];

  it('an open card names its head coaches, longest-serving first, and says which one is you', () => {
    const card = cardFor([head('h', 'Brett Jackson'), head('j', 'Jordan Lee'), manager(ME, 'Alex Morgan')]);
    assert.deepEqual(card.headCoaches, [
      { id: 'ms-h', name: 'Brett Jackson', isYou: false },
      { id: 'ms-j', name: 'Jordan Lee', isYou: false },
    ], 'head coaches only — never the team manager, never an email');
    assert.deepEqual(cardFor([head(ME, 'Chris Hadley')]).headCoaches, [{ id: `ms-${ME}`, name: 'Chris Hadley', isYou: true }]);
  });

  it('carries a missing name as null, never an empty string', () => {
    assert.deepEqual(cardFor([head('h', '   '), manager(ME)]).headCoaches, [{ id: 'ms-h', name: null, isYou: false }]);
  });

  it('carries no head coach where the person registering stays the coach: a locked card, a free team, a club team', () => {
    assert.deepEqual(cardFor([head('h', 'Brett Jackson'), assistant(ME)]).headCoaches, [], 'locked');
    const [freeCard] = buildRegistrableTeams({ userId: ME, freeTeams: [free('a', 'Free A')], portals: [] });
    assert.deepEqual(freeCard.headCoaches, []);
    const [clubCard] = buildRegistrableTeams({
      userId: ME, freeTeams: [free('twin', 'Old', 'ws')],
      portals: [portal({ workspaceId: 'ws', twinId: 'twin', standalone: false, staff: [head('h', 'Brett Jackson')] })],
    });
    assert.deepEqual(clubCard.headCoaches, []);
  });

  it('one head coach is the coach whatever is picked; none means the person registering', () => {
    const brett = { id: 'ms-h', name: 'Brett Jackson', isYou: false };
    for (const picked of [null, undefined, '', 'ms-h', 'someone-else']) {
      assert.deepEqual(pickEntryHeadCoach([brett], picked), { ok: true, headCoach: brett }, String(picked));
    }
    assert.deepEqual(pickEntryHeadCoach([], 'ms-h'), { ok: true, headCoach: null });
  });

  it('two head coaches: the pick must be one of THIS team’s, or the registration is refused (C2)', () => {
    const both = [{ id: 'ms-h', name: 'Brett Jackson', isYou: false }, { id: 'ms-j', name: 'Jordan Lee', isYou: false }];
    assert.deepEqual(pickEntryHeadCoach(both, 'ms-j'), { ok: true, headCoach: both[1] });
    for (const picked of [null, undefined, '', 'ms-other-team']) {
      assert.deepEqual(pickEntryHeadCoach(both, picked), { ok: false, error: CHOOSE_HEAD_COACH }, String(picked));
    }
  });

  describe('what the entry records (entryCoachRecord)', () => {
    const brett = { id: 'ms-h', name: 'Brett Jackson', isYou: false };
    const me = { id: 'ms-me', name: 'Chris Hadley', isYou: true };
    const base = { registrantName: 'Alex Morgan', registrantEmail: 'alex@example.com' };

    it('a manager registers: the head coach is the coach and gets the organizer’s emails; the confirmation says so', () => {
      assert.deepEqual(entryCoachRecord({ ...base, headCoach: brett, identity: { name: 'Brett Jackson', email: 'brett@example.com' } }),
        { ok: true, coach: 'Brett Jackson', coachEmail: 'brett@example.com', headCoachElsewhere: true });
    });

    it('the head coach registers: their name, and the emails stay on the registration email', () => {
      assert.deepEqual(entryCoachRecord({ ...base, registrantName: 'Chris Hadley', registrantEmail: 'chris@example.com', headCoach: me, identity: { name: 'Chris Hadley', email: 'chris@example.com' } }),
        { ok: true, coach: 'Chris Hadley', coachEmail: null, headCoachElsewhere: false });
      assert.equal((entryCoachRecord({ ...base, headCoach: me, identity: { name: null, email: 'chris@example.com' } }) as { coach: string }).coach,
        'Alex Morgan', 'the portal has no name for you: your account’s');
    });

    it('no head coach (a free team, a club team): the person registering, as before; nobody named → NULL', () => {
      assert.deepEqual(entryCoachRecord({ ...base, headCoach: null, identity: null }),
        { ok: true, coach: 'Alex Morgan', coachEmail: null, headCoachElsewhere: false });
      assert.equal((entryCoachRecord({ ...base, registrantName: null, headCoach: null, identity: null }) as { coach: string | null }).coach, null);
    });

    it('a head coach with no name is recorded as no coach — never their email (the public Teams page prints it)', () => {
      assert.deepEqual(entryCoachRecord({ ...base, headCoach: brett, identity: { name: null, email: 'brett@example.com' } }),
        { ok: true, coach: null, coachEmail: 'brett@example.com', headCoachElsewhere: true });
    });

    it('refuses rather than send the organizer’s emails to the wrong person', () => {
      assert.deepEqual(entryCoachRecord({ ...base, headCoach: brett, identity: null }), { ok: false }, 'stepped down since the form loaded');
      assert.deepEqual(entryCoachRecord({ ...base, headCoach: brett, identity: { name: 'Brett Jackson', email: null } }), { ok: false }, 'account unreadable');
    });

    it('never writes a FieldLogicHQ staff address as the coach’s email', () => {
      assert.equal((entryCoachRecord({ ...base, headCoach: brett, identity: { name: 'Brett Jackson', email: 'brett@example.com' }, addressRefused: true }) as { coachEmail: string | null }).coachEmail, null);
    });
  });

  it('/api/register records the portal’s head coach, read again at Submit, and keeps the registrant’s email as the claim key', () => {
    const register = readFileSync(join(process.cwd(), 'app', 'api', 'register', 'route.ts'), 'utf8');
    const insert = register.search(/\.from\('teams'\)\s*\.insert\(/);
    const pick = register.search(/pickEntryHeadCoach\(chosenTeam\?\.headCoaches/);
    const reread = register.search(/getEntryHeadCoachIdentity\(pick\.headCoach\.id\)/);
    const record = register.search(/entryCoachRecord\(\{/);
    assert.ok(pick > 0 && reread > pick && record > reread && record < insert, 'picked from the D1 card, re-read, decided, all before the entry exists');
    assert.match(register, /coach: entryCoach,\s+coach_email: entryCoachEmail,\s+email,/);
    assert.doesNotMatch(register.slice(0, insert), /coach: coachName/, 'a name from the browser is never the Premium coach');
  });

  it('asks a typed name only of someone who is not signed in as the registration email (C3)', () => {
    const register = readFileSync(join(process.cwd(), 'app', 'api', 'register', 'route.ts'), 'utf8');
    assert.match(register, /if \(!teamName \|\| !email \|\| !divisionId \|\| !tournamentId\)/);
    assert.match(register, /if \(!registrantIsAccount && !coachName\)/);
  });

  it('every coach email greets through greetingName, so an empty coach reads "Hi Coach" (escaped)', () => {
    const email = readFileSync(join(process.cwd(), 'lib', 'email.ts'), 'utf8');
    assert.match(email, /export function greetingName\(name: string \| null \| undefined\): string \{\s+return escapeEmailHtml\(name\?\.trim\(\) \|\| 'Coach'\);/);
    assert.doesNotMatch(email, /Hi <strong>\$\{p\.coachName\}/);
    assert.doesNotMatch(email, /Hi <strong>\$\{escapeEmailHtml\(p\.coachName\)\}/);
    assert.doesNotMatch(email, /Hi <strong>\$\{p\.coachName \|\| 'Coach'\}/);
  });
});

describe('the sentence under a locked card', () => {
  it('names people by role alone when their name could not be read', () => {
    assert.equal(whoRegistersSentence({ registeredBy: [{ name: '', role: 'head coach' }] }),
      'Your head coach registers this team. Ask your head coach if you need to do it yourself.');
  });

  it('names a head coach by email in the list but never addresses them by it', () => {
    assert.equal(whoRegistersSentence({ registeredBy: [{ name: 'brett@example.com', role: 'head coach' }] }),
      'brett@example.com (head coach) registers this team. Ask your head coach if you need to do it yourself.');
  });

  it('lists three or more with commas, and copes with nobody', () => {
    assert.equal(whoRegistersSentence({ registeredBy: [{ name: 'A B', role: 'head coach' }, { name: 'C D', role: 'team manager' }, { name: 'E F', role: 'assistant coach' }] }),
      'A B (head coach), C D (team manager) or E F (assistant coach) registers this team. Ask A if you need to do it yourself.');
    assert.equal(whoRegistersSentence({ registeredBy: [] }), 'Only the head coach can register this team.');
  });
});

/**
 * WHAT A SEPARATE TEAM COSTS (F4; E3, owner H1–H3 2026-10-19). The form's "A different team" and the join
 * page's New Team — or its Continue when nothing can be chosen — make a free team the Premium portal never
 * shows; that tap made the original case. One sentence, from one home, read by both screens, so they can
 * never word it differently; on the join page it shows before any tap, so it sits outside the Existing
 * Team branch. Literal strings on purpose: a changed character fails here.
 */
describe('what a separate team costs: one sentence, both screens (E3)', () => {
  const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');
  const card = (name: string, locked = false) => ({ name, locked });

  it('names the one portal: “your” when it is theirs to register, “the” when it is locked for them', () => {
    assert.equal(differentTeamSentence([card('Milton Bats U13 Purple')]),
      'Makes a separate free team. It won’t show in your Milton Bats U13 Purple portal.');
    assert.equal(differentTeamSentence([card('Milton Bats U13 Purple', true)]),
      'Makes a separate free team. It won’t show in the Milton Bats U13 Purple portal.');
  });

  it('names none with two or more portals, and keeps the form’s own wording with none', () => {
    assert.equal(differentTeamSentence([card('UAT Standalone Team'), card('UAT Standalone Team (No Metrics)', true)]),
      'Makes a separate free team. It won’t show in any of your Coaches Portals.');
    assert.equal(differentTeamSentence([]), 'Makes a new free team, separate from the ones above.');
  });

  it('both screens read the one sentence, and neither holds its words', () => {
    for (const file of [['components', 'public', 'RegisterContent.tsx'], ['app', 'coaches', 'join', 'page.tsx']]) {
      const src = read(...file);
      const name = file.join('/');
      assert.match(src, /import \{[^}]*\bdifferentTeamSentence\b[^}]*\} from '@\/lib\/registrable-teams'/, `${name} imports the shared sentence`);
      assert.match(src, /differentTeamSentence\(portalTeams\)/, `${name} reads it for its portal teams`);
      assert.doesNotMatch(src, /Makes a separate free team|won’t show in (your|the|any of)/, `${name} must not hold the sentence's words`);
      assert.doesNotMatch(src, /function differentTeamSentence/, `${name} must not keep its own copy`);
    }
  });

  it('the join page shows it under the pair, outside the Existing Team branch, before any tap', () => {
    const src = read('app', 'coaches', 'join', 'page.tsx');
    const pairEnd = src.search(/New Team\s*<\/button>\s*<\/div>/);
    const line = src.indexOf('<strong>New Team</strong> — {differentTeamSentence(portalTeams)}');
    const branch = src.indexOf("{linkMode === 'existing' && (");
    assert.ok(pairEnd > 0 && line > pairEnd && branch > line, 'the pair, then the line, then the Existing Team list');
    assert.doesNotMatch(src.slice(pairEnd, line), /linkMode/, 'the line never waits on which button is chosen');
    assert.match(src.slice(pairEnd, line), /\{portalTeams\.length > 0 && \(/, 'shown whenever a Coaches Portal team exists');
  });

  it('with no pair, the join page shows it led by Continue, after the locked lines and above the button', () => {
    const src = read('app', 'coaches', 'join', 'page.tsx');
    const lockedLines = src.indexOf('alreadyRegisteredLine(team.name, team.alreadyIn!)');
    const line = src.indexOf('<strong>Continue</strong> — {differentTeamSentence(portalTeams)}');
    const button = src.indexOf("{loading ? 'Linking...' : 'Continue'}");
    assert.ok(lockedLines > 0 && line > lockedLines && button > line, 'the locked lines, then the line, then Continue');
    assert.match(src.slice(lockedLines, line), /\{basicCoachTeams\.length === 0 && portalTeams\.length > 0 && \(/,
      'only when nothing can be chosen and a Coaches Portal team exists');
  });

  it('the join page names no portal when its team list failed to load (no list, no guess)', () => {
    const src = read('app', 'coaches', 'join', 'page.tsx');
    // null = could not load, never "no teams" (F4): it yields no portal teams, so no line and no guessed name.
    assert.match(src, /const portalTeams = \(registrableTeams \?\? \[\]\)\.filter\(t => t\.isPortalTeam\);/);
  });
});

describe('the Register for tournaments grant (A6, A3)', () => {
  it('is always the head coach’s, off by default, and on only in the Team manager preset', () => {
    assert.equal(resolveCoachCapabilities('head_coach').registerTournaments, true);
    assert.equal(resolveCoachCapabilities('head_coach', { registerTournaments: false }).registerTournaments, true);
    assert.equal(ASSISTANT_DEFAULTS.registerTournaments, false);
    assert.equal(resolveCoachCapabilities('assistant_coach', { schedule: true }).registerTournaments, false, 'a bundle stored before the key existed reads OFF');
    for (const kind of STAFF_KINDS) assert.equal(STAFF_PRESETS[kind].registerTournaments, kind === 'manager', kind);
  });

  it('survives the sanitiser and the sheet’s full-bundle PATCH, and is named in one place', () => {
    assert.deepEqual(sanitizeAssistantGrants({ registerTournaments: true }), { registerTournaments: true });
    assert.deepEqual(sanitizeAssistantGrants({ registerTournaments: 'yes' }), {}, 'a non-boolean is dropped, not coerced');
    assert.equal(grantsOf(resolveCoachCapabilities('assistant_coach', { registerTournaments: true })).registerTournaments, true);
    assert.equal(GRANT_LABELS.registerTournaments, 'Register for tournaments');
  });

  it('is Sensitive — a delegate hands it out only while holding it — and sits right under Run tournaments', () => {
    const keys = [...SENSITIVE_KEYS];
    assert.equal(keys.indexOf('registerTournaments'), keys.indexOf('tournaments') + 1);
    const cur = grantsOf(resolveCoachCapabilities('assistant_coach', STAFF_PRESETS.assistant));
    const delegate = (g: Record<string, unknown>) => resolveCoachCapabilities('assistant_coach', { ...STAFF_PRESETS.manager, ...g });
    assert.equal(delegationViolation(delegate({}), cur, { ...cur, registerTournaments: true }), null);
    assert.deepEqual(delegationViolation(delegate({ registerTournaments: false }), cur, { ...cur, registerTournaments: true }),
      { key: 'registerTournaments', reason: 'above_ceiling' });
  });

  it('exists only in a standalone Premium workspace: a club bundle is written with it off', () => {
    assert.equal(applyOrgGrantPolicy({ ...STAFF_PRESETS.manager }, { isTeamWorkspace: false }).registerTournaments, false);
    assert.equal(applyOrgGrantPolicy({ registerTournaments: true }, { isTeamWorkspace: false }).registerTournaments, false);
    assert.equal(applyOrgGrantPolicy({ ...STAFF_PRESETS.manager }, { isTeamWorkspace: true }).registerTournaments, true);
  });

  it('is promised in the Team manager invite email in a workspace, and never in a club', () => {
    assert.match(staffKindCopyFor('manager', { isTeamWorkspace: true }).emailWhat, /entering it in other organizers’ tournaments/);
    assert.doesNotMatch(staffKindCopyFor('manager', { isTeamWorkspace: false }).emailWhat, /tournament/);
  });

  it('migration 329 backfills existing standalone managers only, never over a key already set', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase', 'migrations', '329_existing_managers_can_register_their_team.sql'), 'utf8');
    assert.match(sql, /m\.staff_kind = 'manager'/);
    assert.match(sql, /o\.account_kind = 'team_workspace' or o\.plan_id = 'team'/);
    assert.match(sql, /not \(coalesce\(m\.capabilities, '\{\}'::jsonb\) \? 'registerTournaments'\)/);
    assert.match(sql, /y\.status in \('draft', 'active'\)/, 'the live projection only — closed seasons are the record');
  });
});

describe('the Tournaments door follows Register for tournaments (owner option (a), 2026-10-15)', () => {
  const assistantWith = (g: Record<string, unknown>) => resolveCoachCapabilities('assistant_coach', g);

  it('opens for whoever may configure the team, and for whoever may enter it — and for nobody else', () => {
    assert.equal(canOpenTournaments(resolveCoachCapabilities('head_coach')), true);
    assert.equal(canOpenTournaments(assistantWith({ ...STAFF_PRESETS.assistant })), true, 'schedule editing, as before');
    assert.equal(canOpenTournaments(assistantWith({ ...STAFF_PRESETS.manager })), true);
    assert.equal(canOpenTournaments(assistantWith({ ...STAFF_PRESETS.treasurer })), false, 'no change for anyone until a head coach flips it');
    assert.equal(canOpenTournaments(assistantWith({ ...STAFF_PRESETS.treasurer, registerTournaments: true })), true);
    assert.equal(canOpenTournaments(assistantWith({ ...STAFF_PRESETS.helper, registerTournaments: true })), true);
  });

  it('never widens configuring the team: Settings’ groups stay on their own rule', () => {
    assert.equal(canConfigureTeam(assistantWith({ ...STAFF_PRESETS.treasurer, registerTournaments: true })), false);
  });

  it('every Tournaments door reads the one rule', () => {
    const read = (p: string) => readFileSync(join(process.cwd(), ...p.split('/')), 'utf8');
    const doors = [
      'lib/coach-nav-visibility.ts',
      'lib/coach-registration-access.ts',
      'app/[orgSlug]/coaches/teams/[teamId]/page.tsx',
      'app/[orgSlug]/coaches/teams/[teamId]/tournaments/page.tsx',
      'app/[orgSlug]/coaches/teams/[teamId]/tournaments/[registrationId]/page.tsx',
      'app/api/coaches/[orgSlug]/teams/[teamId]/tournament-history/route.ts',
      'app/api/coaches/[orgSlug]/teams/[teamId]/hosted-tournaments/route.ts',
    ];
    for (const door of doors) assert.match(read(door), /canOpenTournaments\(/, door);
    assert.match(read('lib/coach-nav-visibility.ts'), /case 'Tournaments':\s+return canOpenTournaments\(caps\)/);
  });
});

describe('one team, one entry (owner, 2026-10-16)', () => {
  // A head coach entered "No Metrics - Walk" in U12; five minutes later an assistant entered the same
  // team under its own name, in U12 again. The only rule compared names, so both got in.
  const row = (id: string, over: Partial<TeamEntryRow> = {}): TeamEntryRow => ({
    id, name: 'Milton Bats', status: 'pending', registered_at: '2026-10-16T16:26:00Z', division: 'U12', ...over,
  });
  const byTwin = (team: string, entry: TeamEntryRow): TeamEntryLink => ({ basicCoachTeamId: team, entry });
  const byRep = (team: string, entry: TeamEntryRow): TeamEntryLink => ({ repTeamId: team, entry });

  it('finds a team by its free team (the twin), and a portal by its rep team as well', () => {
    const found = matchTeamEntries(
      [{ basicCoachTeamId: 'twin-a' }, { basicCoachTeamId: 'twin-b', repTeamId: 'rep-b' }, { basicCoachTeamId: 'twin-c' }],
      [byTwin('twin-a', row('e1')), byRep('rep-b', row('e2', { division: 'U13', status: 'accepted' }))],
    );
    assert.deepEqual(found.get('twin-a'), { registrationId: 'e1', name: 'Milton Bats', division: 'U12', status: 'pending' });
    assert.deepEqual(found.get('twin-b'), { registrationId: 'e2', name: 'Milton Bats', division: 'U13', status: 'accepted' }, 'any division counts');
    assert.equal(found.has('twin-c'), false);
  });

  it('a rejected entry still counts — letting the team back in is the organizer’s (owner, 2026-10-16)', () => {
    const found = matchTeamEntries([{ basicCoachTeamId: 'twin-a' }], [byTwin('twin-a', row('e1', { status: 'rejected' }))]);
    assert.equal(found.get('twin-a')?.status, 'rejected');
    assert.equal(alreadyRegisteredLine('Milton Bats', found.get('twin-a')!), 'Already registered · U12 · Not Accepted');
  });

  it('a live entry is named before a rejected one, even a later one', () => {
    const found = matchTeamEntries([{ basicCoachTeamId: 'twin-a' }], [
      byTwin('twin-a', row('turned-away', { status: 'rejected' })),
      byTwin('twin-a', row('in', { status: 'accepted', registered_at: '2026-10-17T09:00:00Z' })),
    ]);
    assert.equal(found.get('twin-a')?.registrationId, 'in');
  });

  it('two entries already in (made before the rule) → the earlier one, the one the second copied', () => {
    const found = matchTeamEntries([{ basicCoachTeamId: 'twin-a' }], [
      byTwin('twin-a', row('late', { registered_at: '2026-10-16T16:31:00Z' })),
      byTwin('twin-a', row('early', { name: 'No Metrics - Walk' })),
    ]);
    assert.equal(found.get('twin-a')?.registrationId, 'early');
  });

  it('compares when entries were made as times, never as text', () => {
    const found = matchTeamEntries([{ basicCoachTeamId: 'twin-a' }], [
      byTwin('twin-a', row('later', { registered_at: '2026-10-16T16:26:46.5+00:00' })),
      byTwin('twin-a', row('sooner', { registered_at: '2026-10-16T16:26:46+00:00' })),
    ]);
    assert.equal(found.get('twin-a')?.registrationId, 'sooner');
  });

  it('every portal card carries its rep team — a club-owned twin, and a portal whose slug could not be read — and a free team none', () => {
    const [standalone] = buildRegistrableTeams({
      userId: ME, freeTeams: [], portals: [portal({ workspaceId: 'ws', twinId: 'twin', orgSlug: null, staff: [head(ME)] })],
    });
    assert.equal(standalone.portal, null);
    assert.equal(standalone.repTeamId, 'rep-ws', 'no slug, still the rep team');
    const [clubCard, freeCard] = buildRegistrableTeams({
      userId: ME, freeTeams: [free('twin', 'Old', 'ws'), free('a', 'Free A')],
      portals: [portal({ workspaceId: 'ws', twinId: 'twin', standalone: false, staff: [head('h', 'Brett Jackson')] })],
    });
    assert.equal(clubCard.repTeamId, 'rep-ws');
    assert.equal(clubCard.isPortalTeam, true);
    assert.equal(freeCard.repTeamId, null);
    assert.equal(freeCard.isPortalTeam, false);
  });

  it('never matches another team’s entry, or a rep link the card does not carry', () => {
    const found = matchTeamEntries([{ basicCoachTeamId: 'mine' }], [byTwin('theirs', row('e1')), byRep('rep-mine', row('e2'))]);
    assert.equal(found.size, 0, 'a card with no rep team is matched by its twin alone');
  });

  const entry = (over: Partial<TeamEntryInTournament> = {}): TeamEntryInTournament => ({
    registrationId: 'e1', name: 'Milton Bats', division: 'U12', status: 'pending', ...over,
  });

  it('the card says where the team already is, in the portal’s status words — and the other name when it has one', () => {
    assert.equal(alreadyRegisteredLine('Milton Bats', entry()), 'Already registered · U12 · Pending Review');
    assert.equal(alreadyRegisteredLine('milton  bats ', entry()), 'Already registered · U12 · Pending Review', 'same name, however spaced');
    assert.equal(
      alreadyRegisteredLine('UAT Standalone Team (No Metrics)', entry({ name: 'No Metrics - Walk' })),
      'Already registered as “No Metrics - Walk” · U12 · Pending Review',
    );
    assert.equal(alreadyRegisteredLine('Milton Bats', entry({ status: 'waitlist' })), 'Already registered · U12 · Waitlisted');
    assert.equal(alreadyRegisteredLine('Milton Bats', entry({ status: null })), 'Already registered · U12', 'no status, no word');
  });

  it('the server’s refusal says the same, and that nothing was registered', () => {
    assert.equal(
      alreadyRegisteredRefusal('UAT Standalone Team (No Metrics)', entry({ name: 'No Metrics - Walk' })),
      'UAT Standalone Team (No Metrics) is already registered in this tournament as “No Metrics - Walk” (U12 · Pending Review), so it has NOT been registered again.',
    );
    assert.equal(
      alreadyRegisteredRefusal('Milton Bats', entry({ division: '', status: null })),
      'Milton Bats is already registered in this tournament, so it has NOT been registered again.',
    );
  });

  it('a card is choosable only when it is neither locked nor already in', () => {
    assert.equal(isChoosableTeam({ locked: false }), true, 'not marked = not entered');
    assert.equal(isChoosableTeam({ locked: false, alreadyIn: entry() }), false);
    assert.equal(isChoosableTeam({ locked: true }), false);
  });

  it('the server asks it after D1 and before the entry exists; the form asks the one choosability rule', () => {
    const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');
    const register = read('app', 'api', 'register', 'route.ts');
    const d1 = register.search(/if \(basicCoachTeamId && !chosenTeam\)/);
    const rule = register.search(/findTeamEntriesInTournament\(/);
    const insert = register.search(/\.from\('teams'\)\s*\.insert\(/);
    assert.ok(d1 > 0 && rule > d1 && insert > rule, 'D1, then the same-team rule, then the insert');
    assert.doesNotMatch(read('components', 'public', 'RegisterContent.tsx'), /&& !t\.locked\)/,
      'every "may I pick this card" read goes through isChoosableTeam');
  });
});
