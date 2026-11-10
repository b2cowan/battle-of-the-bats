/**
 * Navigation Phase 2 Part B (owner rulings E2, E3, E11, T1, T2, P1–P3, 2026-11-09 / 2026-11-10; plan
 * `docs/projects/active/ADMIN_NAV_EVALUATION_PLAN.md`): the strip names the page, the organization's tournament screens wear
 * the organization's sidebar, a Tournament plan's Settings & access is a place with tabs, and a club keeps its settings in
 * the club portal (one home per setting).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  clubPlaceAt, isTournamentOrgScreen, kitPortalDoors, litTournamentRow, tournamentOrgScreenName, tournamentSettingsTabs,
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
    const desk = deskTournamentGroups(kitTournamentGroups({ status: 'active', isSandbox: false, role: 'owner', planId: 'tournament_plus' }));
    const keys = keysOf(desk);
    assert.ok(!keys.includes('settings') && !keys.includes('manage'));
    assert.equal(keys.at(-1), 'settings/notifications');
    assert.equal(desk.at(-1)?.key, 'admin');
    assert.equal(YOUR_NOTIFICATIONS_ITEM.label, NOTIFY_WORDS.title, 'one name for the row and its page');
    assert.equal(NOTIFY_WORDS.title, 'Your notifications');
  });
  it('the demo sandbox has no mute page to show, so its Admin label goes with it', () => {
    const desk = deskTournamentGroups(kitTournamentGroups({ status: 'active', isSandbox: true, role: 'owner', planId: 'tournament_plus' }));
    assert.ok(!keysOf(desk).includes('settings/notifications'));
    assert.ok(!desk.some(g => g.key === 'admin'));
  });
  it('⚖ P2: a club’s phone More sheet has no Settings & access row (its settings live in the club portal); a Tournament plan keeps it', () => {
    assert.ok(!keysOf(kitTournamentGroups({ status: 'active', isSandbox: false, role: 'owner', planId: 'club' })).includes('settings'));
    assert.ok(keysOf(kitTournamentGroups({ status: 'active', isSandbox: false, role: 'owner', planId: 'tournament' })).includes('settings'));
    // A one-team workspace keeps the phone's row: its staff page has no other door on a phone (the row's door opens it).
    assert.ok(keysOf(kitTournamentGroups({ status: 'active', isSandbox: false, role: 'owner', planId: 'tournament', accountKind: 'team_workspace' })).includes('settings'));
  });
  it('the phone’s More sheet reaches the event’s mute page too — its only other door was the retired card page', () => {
    const phone = keysOf(kitTournamentGroups({ status: 'active', isSandbox: false, role: 'owner', planId: 'club' }));
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
    const at = (path: string, planId = 'club') => deskTitleAt({ pathname: `${B}${path}`, base: B, status: 'active', isSandbox: false, role: 'owner', planId, billingLink: null });
    assert.equal(at('/tournaments/registrations'), 'Teams');
    assert.equal(at('/tournaments/settings/notifications/'), 'Your notifications', 'a trailing slash is the same page');
    assert.equal(at('/tournaments/manage'), 'Tournaments');
    assert.equal(at('/tournaments/settings/members', 'tournament'), null, 'Settings & access names itself, a place on both widths');
    assert.equal(at('/tournaments/preview/x'), null);
    assert.equal(at('/rep-teams'), null);
  });
  it('the organization’s screens the strip names on a computer: the list and Plan & billing (P3: the phone keeps the organization)', () => {
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
  it('the paper title steps aside above 900px only, and a header with no actions draws nothing there (P3, E11)', () => {
    const css = readCode('components/admin/AdminPageHeader.module.css');
    assert.match(css, /@media \(min-width: 901px\) \{\s*\.header\[data-desk-named\] \.left \{ display: none; \}\s*\.header\[data-desk-named='empty'\] \{ display: none; \}/);
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
  it('Members · Payouts · PDF settings · Web address, the person’s own only', () => {
    assert.deepEqual(tournamentSettingsTabs(B, all).map(t => t.label), ['Members', 'Payouts', 'PDF settings', 'Web address']);
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
  const doors = (inEvent: boolean, desk: boolean) => kitPortalDoors({
    base: B, onTournaments: inEvent, tournamentOnly: false, isCanceled: false, tournamentsDoor: true, canUse: () => true,
    coachDoor: { show: false, href: '' }, desk,
  });
  it('on a computer the club’s Tournaments door opens the list (and lights there); the phone’s keeps opening the event', () => {
    assert.equal(doors(false, true).find(d => d.key === 'tournaments')?.href, `${B}/tournaments/manage`);
    assert.equal(doors(false, false).find(d => d.key === 'tournaments')?.href, `${B}/tournaments`);
    assert.deepEqual(doors(true, true).map(d => d.key), ['club'], 'inside an event the foot keeps its Club door');
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
