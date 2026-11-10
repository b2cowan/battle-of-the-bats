/**
 * CLUB TIER STAGE 13b · SESSION B — the arrival (Ask 10 = A, ruled 2026-11-06; build 2026-11-07).
 *
 *   B1. The invite has NO default role: the field starts on "Choose a role", Send is off until one is chosen, and the line
 *       under it says what the role opens. The setup checklist's step 1 opens Members on the list (no window; owner 2026-11-08 — read the roles table first).
 *   B2. Every invite email says what the role opens — the accept page's sentence (`memberOpensSentence`), the one page the
 *       reader lands on next — plus one line on what FieldLogicHQ is; one role name, the screens' own; the club's name escaped.
 *   B3. Both arrival paths end on the role's home: the "added" email's link is built by the resolver sign-in and the accept
 *       page use, never a role table of its own; and that resolver sends a coach-only member to the Coaches Portal, as
 *       sign-in's own card does (owner, 2026-11-07).
 *   B4. Help opens on the reader's own first-day path; another role's path is never offered as theirs.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode, functionBody, between } from './_source-code.ts';
import { ROLE_LABEL, roleEmailLabel, memberOpensSentence } from '../../lib/member-access.ts';
import { VOLUNTEER_OPENS } from '../../lib/volunteer-words.ts';
import type { OrgRole } from '../../lib/types.ts';

const BOARD_ROLES: OrgRole[] = ['admin', 'treasurer', 'staff', 'league_admin', 'league_registrar'];

describe('B1. the invite has no default role', () => {
  const dialog = readCode('components/admin/kit/club/InviteMemberDialog.tsx');

  it('the role starts on the door’s own choice or nothing — never a silent Staff', () => {
    assert.match(dialog, /useState<OrgRole \| null>\(initialRole\)/);
    assert.doesNotMatch(dialog, /r\.role === 'staff'\) \? 'staff'/, 'the silent Staff fallback is back');
    assert.doesNotMatch(dialog, /roles\?\.\[0\]\?\.role/, 'a fallback to the first role in the list is back');
  });

  it('Send is off until a role is chosen, and the empty field says so', () => {
    assert.match(dialog, /disabled=\{sending \|\| !chosen\}/);
    assert.match(dialog, /placeholder=\{INVITE_ROLE_WORDS\.choose\}/);
    assert.match(dialog, /choose: 'Choose a role'/);
  });

  it('the line under the field is the picker’s own sentence, never framed as what the email says (/review)', () => {
    assert.match(dialog, /\{chosenRole\?\.opens && <p className=\{ck\.hint\}>\{chosenRole\.opens\}<\/p>\}/);
    assert.doesNotMatch(dialog, /Written to them/);
  });

  it('the checklist’s step 1 opens Members with NOTHING open — the owner reads the roles table first (2026-11-08)', () => {
    const checklist = readCode('lib/club-checklist.ts');
    assert.match(checklist, /key: 'board',[\s\S]*?href: `\$\{base\}\/org\/members`,/);
    assert.doesNotMatch(checklist, /invite=open/, 'the checklist pops the invite window again');
    const members = readCode('components/admin/kit/club/MembersKit.tsx');
    // Only the Staff kit's `volunteer` door opens the invite, and it presets the role.
    assert.doesNotMatch(members, /inviteParam !== 'open'/, 'the open-on-arrival door is back');
    assert.match(members, /!volunteer\) return;[\s\S]*?setInviteRole\('official'\);\s*setInviteOpen\(true\);/);
  });
});

describe('B2. every invite email says what the role opens', () => {
  // lib/email.ts imports through the `@/` alias, which the node runner does not resolve, so the templates are read as code.
  const email = readCode('lib/email.ts');
  // Sliced between neighbours: the templates' `${…}` braces defeat a brace-matching reader.
  const inviteFn = between(email, 'export function orgInviteHtml(', 'export function assistantCoachInviteHtml(');
  const addedFn = between(email, 'export function orgMemberAddedHtml(', 'export function memberSuspendedHtml(');
  const whatFn = between(email, 'function orgInviteWhatHtml(', 'export function orgInviteHtml(');

  it('both emails carry the role’s line and the product line, from one helper', () => {
    assert.match(inviteFn, /orgInviteWhatHtml\(\{ note: p\.note, opens: p\.opens, orgEscaped: org \}\)/);
    assert.match(addedFn, /orgInviteWhatHtml\(\{ note: p\.note, opens: [^}]*orgEscaped: org \}\)/);
    assert.match(whatFn, /const what = p\.note \?\? p\.opens;/,'a volunteer’s job note must stand in for the role’s line, never beside it');
    assert.match(whatFn, /escapeEmailHtml\(what\)/);
    assert.match(whatFn, /ORG_INVITE_EMAIL_WORDS\.about\(p\.orgEscaped\)/);
  });

  it('the "added" email says the role as held ("You’ll"), and every role’s sentence starts where that swap reaches', () => {
    assert.match(addedFn, /opens: p\.opens \? ORG_INVITE_EMAIL_WORDS\.alreadyHeld\(p\.opens\) : null/);
    assert.doesNotMatch(inviteFn, /alreadyHeld/, 'the invite’s reader has not accepted yet: it keeps “You’d”');
    assert.match(email, /alreadyHeld: \(sentence: string\) => sentence\.replace\(\/\^You'd \/, "You'll "\)/);
    for (const role of [...BOARD_ROLES, 'coach' as OrgRole]) assert.match(memberOpensSentence(role, null), /^You'd /, role);
    // A volunteer's job sentence too, in case it ever reaches the role's line (today their job note stands in for it).
    for (const sentence of Object.values(VOLUNTEER_OPENS)) assert.match(sentence, /^You'd /);
  });

  it('the admin’s email sentence says what the role opens, never what it withholds (the picker keeps its own trim)', () => {
    assert.doesNotMatch(memberOpensSentence('admin', null), /billing or settings/);
    for (const role of BOARD_ROLES) assert.ok(memberOpensSentence(role, null).length > 0, role);
  });

  it('every sender passes the accept page’s sentence: the invite, both of its emails, and the resend', () => {
    const route = readCode('app/api/admin/members/invite/route.ts');
    assert.match(route, /const opens = memberOpensSentence\(role, capabilities\);/);
    assert.match(route, /orgInviteHtml\(\{[^)]*\bopens\b/);
    assert.match(route, /orgMemberAddedHtml\(\{[^)]*\bopens\b/);
    assert.match(readCode('lib/invite-links.ts'), /orgInviteHtml\(\{[^)]*opens: memberOpensSentence\(role, memberRow\?\.capabilities\)/);
  });

  it('one name per role: the email says the screens’ name, in a sentence’s lower case', () => {
    for (const role of Object.keys(ROLE_LABEL) as OrgRole[]) {
      if (role === 'staff') continue; // "as a staff member": "as a staff" is not a sentence
      assert.equal(roleEmailLabel(role), ROLE_LABEL[role].toLowerCase(), role);
    }
  });

  it('neither email carries commercial content, so CASL’s consent rules stay out of reach (/legal 2026-11-07)', () => {
    // docs/agents/legal/CASL_MEMBER_INVITE_EMAILS.md: the new-account invite has no consent basis for an offer.
    for (const [name, fn] of [['invite', inviteFn], ['added', addedFn], ['what', whatFn]] as const) {
      assert.doesNotMatch(fn, /\/pricing|\/start\b|\/signup|PLAN_CONFIG|planLabel|formatPrice|Tournament Plus|free time|free season|upgrade/i, name);
    }
    const about = between(email, 'export const ORG_INVITE_EMAIL_WORDS', 'function orgInviteWhatHtml(');
    assert.doesNotMatch(about, /\$\s?\d|price|plan\b|free|try /i, 'the product line says what FieldLogicHQ is, never an offer');
  });

  it('the "added" email escapes the club’s name, as the invite email does', () => {
    assert.match(addedFn, /const org = escapeEmailHtml\(p\.orgName\);/);
    assert.doesNotMatch(addedFn, /\$\{p\.orgName\}/, 'the club name goes into the HTML raw');
  });
});

describe('B3. both arrival paths end on the role’s home', () => {
  it('the "added" email’s link comes from the resolver sign-in and the accept page use, not a role table', () => {
    const route = readCode('app/api/admin/members/invite/route.ts');
    assert.match(route, /const home = await destinationAfterAccept\(existingUser\.id, org\.slug\);/);
    assert.match(route, /const signInUrl = `\$\{appUrl\}\/auth\/login\?next=\$\{encodeURIComponent\(landing\)\}`;/);
    // The old per-role landing, every board role sent to the Overview, is gone.
    assert.doesNotMatch(route, /role === 'coach' \? `\/\$\{org\.slug\}\/coaches` : `\/\$\{org\.slug\}\/admin`/);
    // The link is built after the membership is written, so the resolver reads the role just given.
    assert.ok(route.indexOf('destinationAfterAccept(') > route.indexOf("'member_invited'"), 'the link is built before the row exists');
  });

  it('the accept paths ask the same resolver sign-in asks for a board row', () => {
    assert.match(readCode('lib/invite-acceptance.ts'), /return await getDestinationForMembership\(member, userId\);/);
    assert.match(readCode('lib/user-contexts.ts'), /membershipContext\.destination = await getDestinationForMembership\(member, user\.id\);/);
  });

  it('the resolver sends a coach-only club member to the Coaches Portal, as sign-in’s card for that row does', () => {
    const contexts = readCode('lib/user-contexts.ts');
    const resolver = functionBody(contexts, 'getDestinationForMembership');
    assert.match(resolver, /if \(role === 'coach' && !isTeamWorkspace\) return `\/\$\{slug\}\/coaches`;/);
    // It is asked before any branch that could answer with the club admin.
    assert.ok(resolver.indexOf("role === 'coach'") < resolver.indexOf('/admin'), 'a coach can reach an admin landing first');
    // Sign-in's own card for that row is the Coaches Portal (the rule the resolver now matches).
    const card = functionBody(contexts, 'buildMembershipContext');
    assert.match(card, /if \(member\.role === 'coach'\) \{[\s\S]*?destination: `\/\$\{slug\}\/coaches`/);
  });
});

describe('B4. Help opens on the reader’s own path', () => {
  const page = readCode('app/[orgSlug]/admin/help/page.tsx');
  const hub = readCode('components/help/HelpHubClient.tsx');

  it('each board role owns exactly one path', () => {
    for (const role of ['owner', 'admin', 'staff', 'league_admin', 'league_registrar', 'treasurer']) {
      const owners = page.match(new RegExp(`roles: \\[[^\\]]*'${role}'[^\\]]*\\]`, 'g')) ?? [];
      assert.equal(owners.length, 1, `${role} owns ${owners.length} paths`);
    }
  });

  it('only the owner and an admin are shown the other roles’ paths, and never as their own', () => {
    const split = functionBody(page, 'splitRolePaths');
    assert.match(split, /const isBoard = role === 'owner' \|\| role === 'admin';/);
    assert.match(split, /others: isBoard \? paths\.filter\(p => p !== own\) : \[\]/);
    assert.match(page, /ownRolePath=\{own\}/);
  });

  it('the reader’s own path is open by default, the others folded under it', () => {
    assert.match(hub, /<details className=\{styles\.helpHubNewHere\} open=\{!!ownRolePath\}>/);
    assert.match(hub, /const shown = ownRolePath \? \[ownRolePath\] : rolePaths;/);
    assert.match(hub, /const folded = ownRolePath \? rolePaths : \[\];/);
    assert.match(hub, /<details className=\{styles\.helpHubOtherPaths\}>/);
  });

  it('a role with no Org admin card reaches the guide’s role table from its own path', () => {
    assert.match(page, /href: `\$\{helpBase\}\/org#roles`/);
    // On every path whose role has no Org admin card: staff, treasurer, registrar, league admin.
    assert.equal((page.match(/^\s+roleGuideStep,$/gm) ?? []).length, 4);
  });

  it('the note under the guides no longer claims a role filter the hub does not have', () => {
    assert.doesNotMatch(page, /plan and role include/);
  });
});
