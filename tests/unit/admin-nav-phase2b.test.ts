/**
 * Navigation Phase 2 Part B (owner rulings E2, E3, E11, T1, T2, P1–P3, 2026-11-09 / 2026-11-10; plan
 * `docs/projects/active/ADMIN_NAV_EVALUATION_PLAN.md`): the strip names the page, the organization's tournament screens wear
 * the organization's sidebar, a Tournament plan's Settings & access is a place with tabs, and a club keeps its settings in
 * the club portal (one home per setting).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  clubPlaceAt, isTournamentEventShell, isTournamentOrgScreen, kitPortalDoors, litTournamentRow, tournamentOrgScreenName, tournamentSettingsTabs,
  type ClubPlaceAccess,
} from '../../lib/admin-kit-nav.ts';
import { deskTitleAt, deskTournamentGroups, kitTournamentGroups, YOUR_NOTIFICATIONS_ITEM } from '../../components/admin/kit/kit-tournament-groups.ts';
import { eventPhaseOf, eventSwitchLine } from '../../lib/admin-event-cell.ts';
import { NOTIFY_WORDS } from '../../lib/tournament-settings-words.ts';
import { readCode } from './_source-code.ts';

const B = '/o/admin';
const keysOf = (groups: { items: { key: string }[] }[]) => groups.flatMap(g => g.items.map(i => i.key));

describe('Part B · the event’s sidebar on a computer is the event’s pages only (E3, T1, T2)', () => {
  it('Settings & access and the Tournaments list leave; "Your notifications" is the last row, under Admin', () => {
    const desk = deskTournamentGroups(kitTournamentGroups({ status: 'active', role: 'owner', planId: 'tournament_plus' }));
    const keys = keysOf(desk);
    assert.ok(!keys.includes('settings') && !keys.includes('manage'));
    assert.equal(keys.at(-1), 'settings/notifications');
    assert.equal(desk.at(-1)?.key, 'admin');
    assert.equal(YOUR_NOTIFICATIONS_ITEM.label, NOTIFY_WORDS.title, 'one name for the row and its page');
    assert.equal(NOTIFY_WORDS.title, 'Your notifications');
  });
  it('⚖ Settings & access is one click from the event: a foot row above Plan & billing, only where the settings are tournament-side (owner 2026-11-11)', () => {
    const rail = readCode('components/admin/kit/AdminKitRail.tsx');
    assert.match(rail, /\{inEvent && settingsAccess && \(/, 'in the event’s shell, when the person holds a settings tab (null for a club)');
    const row = rail.indexOf('{inEvent && settingsAccess && (');
    assert.ok(row > rail.indexOf('<div className={styles.railFoot}>') && row < rail.indexOf('{billingLink && <Link'), 'it is the foot’s first row, above Plan & billing');
    assert.match(rail, /\(billingLink \|\| \(inEvent && settingsAccess\)\) && portalDoors\.length > 0/, 'the hairline before the doors follows it');
  });
  it('⚖ P2: a club’s phone More sheet has no Settings & access row (its settings live in the club portal); a Tournament plan keeps it', () => {
    assert.ok(!keysOf(kitTournamentGroups({ status: 'active', role: 'owner', planId: 'club' })).includes('settings'));
    assert.ok(keysOf(kitTournamentGroups({ status: 'active', role: 'owner', planId: 'tournament' })).includes('settings'));
    // ⚖ UPDATED IN THE OPEN (Settings in both workspaces, Session 3 — ruling 1R, 2026-11-20): a one-team workspace's row
    // goes. Its people and settings live in the Coaches Portal now, so the row had nothing behind it.
    for (const planId of ['team', 'tournament', 'club']) {
      assert.ok(!keysOf(kitTournamentGroups({ status: 'active', role: 'owner', planId, accountKind: 'team_workspace' })).includes('settings'), planId);
    }
    assert.ok(keysOf(kitTournamentGroups({ status: 'active', role: 'owner', planId: 'tournament_plus' })).includes('settings'));
  });
  it('the phone’s More sheet reaches the event’s mute page too — its only other door was the retired card page', () => {
    const phone = keysOf(kitTournamentGroups({ status: 'active', role: 'owner', planId: 'club' }));
    assert.equal(phone.at(-1), 'settings/notifications');
  });
});

describe('Part B · the strip names the lit row (E2)', () => {
  const keys = ['dashboard', 'registrations', 'settings/event', 'settings/notifications', 'venues'];
  it('the most specific row wins, at any depth', () => {
    assert.equal(litTournamentRow(`${B}/tournaments/settings/event`, B, keys, null), 'settings/event');
    assert.equal(litTournamentRow(`${B}/tournaments/settings/notifications`, B, keys, null), 'settings/notifications');
    assert.equal(litTournamentRow(`${B}/tournaments/registrations`, B, keys, null), 'registrations');
    assert.equal(litTournamentRow(`${B}/tournaments/summary`, B, keys, null), null, 'a page with no row keeps its paper title');
  });
  it('ONE answer for the strip and the page headers (`deskTitleAt`): the lit row’s words, the org’s list, or nothing', () => {
    const at = (path: string, planId = 'club') => deskTitleAt({ pathname: `${B}${path}`, base: B, status: 'active', role: 'owner', planId, billingLink: null });
    assert.equal(at('/tournaments/registrations'), 'Teams');
    assert.equal(at('/tournaments/settings/notifications/'), 'Your notifications', 'a trailing slash is the same page');
    assert.equal(at('/tournaments/manage'), 'Tournaments');
    assert.equal(at('/tournaments/settings/members', 'tournament'), null, 'Settings & access names itself, a place on both widths');
    assert.equal(at('/tournaments/preview/x'), null);
    assert.equal(at('/rep-teams'), null);
  });
  it('the organization’s screens the chrome names: the list and Plan & billing (the phone bar too since Phase 3, R3)', () => {
    assert.equal(tournamentOrgScreenName(`${B}/tournaments/manage`, B), 'Tournaments');
    assert.equal(tournamentOrgScreenName(`${B}/tournaments/archives`, B), 'Tournaments');
    assert.equal(tournamentOrgScreenName(`${B}/tournaments/settings/subscription`, B), 'Plan & billing');
    assert.equal(tournamentOrgScreenName(`${B}/tournaments/settings/members`, B), null, 'Members is a tab of a place');
  });
  it('Web address is an organization screen; the event’s Notifications and Event settings are the event’s', () => {
    assert.ok(isTournamentOrgScreen(`${B}/tournaments/settings/web-address`, B));
    assert.ok(!isTournamentOrgScreen(`${B}/tournaments/settings/notifications`, B));
    assert.ok(!isTournamentOrgScreen(`${B}/tournaments/settings/event`, B));
  });
  // ⚖ Navigation Phase 3 (E5, owner 2026-11-11) widened P3's "above 900px only" to both widths: the phone bar names the page
  // too. Updated deliberately; `admin-nav-phase3.test.ts` holds the one-rule guard.
  it('the paper title steps aside at both widths, and a header with no actions draws nothing (E5, E11)', () => {
    const css = readCode('components/admin/AdminPageHeader.module.css');
    assert.match(css, /\.header\[data-desk-named\] \.left \{ display: none; \}\s*\.header\[data-desk-named='empty'\] \{ display: none; \}/);
    assert.doesNotMatch(css, /@media[^{]*\{\s*\.header\[data-desk-named/, 'no breakpoint: one rule for both widths');
    const strip = readCode('components/admin/AdminTopStrip.tsx');
    // The facts are the strip's, after the page's name: the dates, then the phase chip.
    assert.ok(strip.indexOf('{deskTitle}') < strip.indexOf('{dates && <span className={own.dates}>{dates}</span>}'));
  });
});

describe('Part B · one set of words for an event’s state (E12 (2))', () => {
  it('the strip’s facts and the list’s line read one answer', () => {
    const ev = { status: 'active', startDate: '2026-11-01', endDate: '2026-11-03', firstGameStarted: true };
    const { label, dates } = eventPhaseOf(ev, '2026-11-02');
    assert.equal(label, 'Game day');
    assert.equal(eventSwitchLine(ev, '2026-11-02'), `${dates} · ${label}`);
    assert.match(readCode('components/admin/useAdminPlace.tsx'), /eventPhaseOf\(currentTournament\)/);
  });
});

describe('Part B · a Tournament plan’s Settings & access is a place with tabs (E3, P1)', () => {
  const all = { members: true, payouts: true, pdf: true };
  // ⚖ UPDATED IN THE OPEN (Settings in both workspaces Session 2, A1, owner 2026-11-20): the fourth tab holds the name too,
  // so it is "Name & address"; its address stays /web-address.
  it('Members · Payouts · PDF settings · Name & address, the person’s own only', () => {
    assert.deepEqual(tournamentSettingsTabs(B, all).map(t => t.label), ['Members', 'Payouts', 'PDF settings', 'Name & address']);
    assert.deepEqual(tournamentSettingsTabs(B, { members: false, payouts: false, pdf: true }).map(t => t.id), ['pdf', 'web-address']);
    assert.deepEqual(tournamentSettingsTabs(B, { members: false, payouts: false, pdf: false }), [], 'no tab of its own = no place');
  });
  const access = (tabs: ClubPlaceAccess['tournamentSettingsTabs']): ClubPlaceAccess => ({
    canUse: () => true, seasonAccess: null, orgTabs: null, runsRepTeams: false, hasPayouts: false, opensFamilies: false,
    tournamentSettingsTabs: tabs,
  });
  it('the place lights its tab; the audit log is a record page, "← Members"', () => {
    const tabs = tournamentSettingsTabs(B, all);
    const pdf = clubPlaceAt(`${B}/tournaments/settings/pdf`, B, access(tabs));
    assert.equal(pdf?.title, 'Settings & access');
    assert.equal(pdf?.activeId, 'pdf');
    const audit = clubPlaceAt(`${B}/tournaments/settings/members/audit`, B, access(tabs));
    assert.equal(audit?.title, 'Audit log');
    assert.deepEqual(audit?.back, { href: `${B}/tournaments/settings/members`, label: 'Members' });
  });
  it('a club (no tabs: its settings are the club portal’s) and the event’s own pages are no such place', () => {
    assert.equal(clubPlaceAt(`${B}/tournaments/settings/members`, B, access(null)), null);
    assert.equal(clubPlaceAt(`${B}/tournaments/settings/notifications`, B, access(tournamentSettingsTabs(B, all))), null);
    assert.equal(clubPlaceAt(`${B}/tournaments/settings/subscription`, B, access(tournamentSettingsTabs(B, all))), null, 'Plan & billing is the foot’s row');
  });
});

describe('Part B · a club’s organization screens (T1, P2)', () => {
  const doors = (inEvent: boolean) => kitPortalDoors({
    base: B, onTournaments: inEvent, tournamentOnly: false, isCanceled: false, tournamentsDoor: true, canUse: () => true,
    coachDoor: { show: false, href: '' },
  });
  it('⚖ the club’s Tournaments door leaves the club for an event’s Dashboard (owner 2026-11-10, amending T1), on a computer and a phone', () => {
    assert.equal(doors(false).find(d => d.key === 'tournaments')?.href, `${B}/tournaments`, '/tournaments lands on the chosen event');
    assert.deepEqual(doors(true).map(d => d.key), ['club'], 'inside the event’s shell the foot keeps its Club door');
  });
  it('⚖ the Tournaments LIST wears the event’s shell in a club that has an event; nothing else changes', () => {
    const shell = (path: string, tournamentOnly: boolean, hasEvent: boolean) => isTournamentEventShell(`${B}${path}`, B, { tournamentOnly, hasEvent });
    assert.ok(shell('/tournaments/manage', false, true), 'the list, in a club with an event');
    assert.ok(shell('/tournaments/archives', false, true), 'its old Past tournaments address');
    assert.ok(shell('/tournaments/dashboard', false, false), 'the event’s own pages, always');
    assert.ok(shell('/tournaments/manage', false, false), 'a club with no event yet wears the shell too: the door behaves the same before and after the first tournament (owner 2026-11-11)');
    assert.ok(!shell('/tournaments/manage', true, true), 'a tournament-only organization keeps its own short sidebar on the list');
    assert.ok(!shell('/tournaments/settings/subscription', false, true), 'Plan & billing stays the organization’s');
    assert.ok(!shell('/tournaments/settings/members', false, true), 'so does Members');
    // Owner 2026-11-11: in a tournament-only organization, Settings & access and Plan & billing keep the event's sidebar.
    for (const p of ['/tournaments/settings', '/tournaments/settings/members', '/tournaments/settings/payouts', '/tournaments/settings/pdf',
      '/tournaments/settings/web-address', '/tournaments/settings/subscription']) {
      assert.ok(shell(p, true, true), `${p} keeps the event's sidebar in a tournament-only organization`);
      assert.ok(!shell(p, true, false), `${p} with no event has no event to head the sidebar`);
    }
    assert.ok(!shell('/org/members', true, true), 'only the tournament addresses, never another page');
    // The facts stay the event's pages' own: the list still shows no dates and no chip, and the tab title no event name.
    assert.ok(isTournamentOrgScreen(`${B}/tournaments/manage`, B));
  });
  it('⚖ the strip and the sidebar read the one shell predicate', () => {
    assert.match(readCode('components/admin/AdminTopStrip.tsx'), /isTournamentEventShell\(pathname, base, \{ tournamentOnly, hasEvent: !!currentTournament \}\)/);
    assert.match(readCode('components/admin/kit/useAdminKitNav.ts'), /isTournamentEventShell\(pathname, base, \{ tournamentOnly, hasEvent: !!currentTournament \}\)/);
  });
  it('the foot door waits for the event list before it decides where to go', () => {
    assert.match(readCode('app/[orgSlug]/admin/tournaments/page.tsx'), /if \(loading \|\| eventsLoading \|\| !currentOrg\) return;/);
  });
  it('every organization-wide tournament address sends a club to its own page; nothing else', () => {
    const S = 'app/[orgSlug]/admin/tournaments/settings';
    const homes: [string, string][] = [
      [`${S}/page.tsx`, 'org'], [`${S}/members/page.tsx`, 'org/members'], [`${S}/members/audit/page.tsx`, 'org/members/audit'],
      [`${S}/pdf/page.tsx`, 'org/settings/pdf'], [`${S}/payouts/page.tsx`, 'org/settings'], [`${S}/web-address/page.tsx`, 'org/settings'],
    ];
    for (const [file, home] of homes) assert.match(readCode(file), new RegExp(`export default tournamentSideOnly\\(\\w+, '${home}'\\);`), file);
    assert.match(readCode(`${S}/subscription/layout.tsx`), /await openClubHome\(\(await params\)\.orgSlug, 'org\/billing'\);/);
    assert.match(readCode(`${S}/club-home.tsx`), /if \(!ctx \|\| orgSettingsOnTournamentSide\(ctx\.org\)\) return;/);
    // The address's search survives the move (a checkout's success flag, `?plan=`, `?keep_plan=1`), less the RSC marker.
    assert.match(readCode(`${S}/club-home.tsx`), /params\.delete\('_rsc'\)/);
    // The shared billing page is untouched: its own routing (a one-team workspace to the Coaches Portal's billing) stands.
    assert.equal(readCode(`${S}/subscription/page.tsx`).trim(), "export { default } from '../../../org/billing/page';");
  });
});
