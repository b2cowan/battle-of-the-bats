/**
 * ⚖ WHAT THE PAGE'S "?" OPENS, FROM THE ADDRESS (navigation Phase 6b, T1–T6, owner 2026-11-13; plan
 * `docs/projects/active/ADMIN_NAV_EVALUATION_PLAN.md`, the top-row record). In the tournament admin and the club the "?" sits in
 * the chrome — the top strip between the bell and the account button on a computer, the phone bar's last control — and the
 * page's own row no longer carries it. Which section it opens is answered HERE, once, for both, from what the address already
 * says: a tournament page by its path, a club place by its place and tab (`clubPlaceAt`, the same answer that names the place).
 *
 * WHY THE ADDRESS, NOT A PAGE HANDING ITS TOPIC UP (the Coaches Portal's way): the admin's chrome already knows the place and the
 * tab from the address on the server's first paint — the rule that keeps its bar from flashing the wrong name — so the "?" is
 * there on the first paint too, and the bell never slides when it arrives. One table covers the club's places and tabs (about
 * twenty of whose pages draw no header at all), and one test proves every section id in it exists (a wrong id fails SILENTLY:
 * the drawer skips it). A page hands a topic up only when the page's own state picks it — the dashboard's board, by the event's
 * stage (`usePublishPageHelp`, `components/help/PageHelpChannel.tsx`) — and that overrides the address's answer while it is mounted.
 *
 * ⚖ NO TOPIC, NO "?" (T3): a screen with no row here shows none. A place's tabs are all covered or none are (T5/T3 — never
 * half): `admin-page-help.test.ts` holds that for every place this file knows.
 *
 * ⚠ Pure: no React, no content import (the guides are big; this must not pull them into every admin page's bundle).
 */
import type { HelpRequest } from '@/components/help/help-drawer-context';
import type { HelpModuleKey } from '@/lib/help-content/registry';
import { isTournamentOrgScreen } from './admin-kit-nav';

/** A topic: the guide, the section(s) in order, the sub-topic to open on, and the page's name for the drawer's header. */
export type PageHelpTopic = { module: HelpModuleKey; sectionIds: readonly string[]; subtopicId?: string; label: string };

/** Topics in one guide: `inGuide('rep-teams')(['team-board'], 'Teams', 'a-sub-topic')`. */
const inGuide = (module: HelpModuleKey) => (sectionIds: readonly string[], label: string, subtopicId?: string): PageHelpTopic =>
  ({ module, sectionIds, label, ...(subtopicId ? { subtopicId } : {}) });
const t = inGuide('tournaments');
const rep = inGuide('rep-teams');
const hl = inGuide('house-league');
const acc = inGuide('accounting');
const fam = inGuide('families');
const org = inGuide('org');
const comms = inGuide('communications');

/** The dashboard's four boards (A56): the page knows which board it is and hands the matching one up. */
export const DASHBOARD_HELP = {
  draft: t(['recipe-open-tournament-registration'], 'Dashboard', 'launch-draft-board'),
  weeksBefore: t(['recipe-open-tournament-registration'], 'Dashboard', 'launch-weeks-before'),
  gameDay: t(['recipe-finalize-tournament-scores'], 'Dashboard', 'results-game-day-board'),
  finished: t(['recipe-closeout-tournament'], 'Dashboard', 'closeout-finished-board'),
} as const;


/**
 * The club's places and tabs, keyed `place/tab` (the place's key before any `:id`, then the lit tab's id), and the screens with
 * no tab row by their key alone (`calendar`, `child`, …). The club's Overview is `overview` (it is no place: `clubPlaceAt` null).
 * Each row was matched by reading the section against the screen (Phase 6b Part 2; the table with its verdicts is in the plan's
 * Phase 6b record). The seven partial matches got a short section of their own in the same pass.
 * ⚖ A RECORD OVER A TAB (a family over Families, a team's account over Teams) keeps its tab lit — the address's rule — and has
 * a `place/tab/record` row of its own where its guide has a section for exactly that; any other address under a tab that is
 * not the tab's own (a record with no row, a tab's second address) opens the tab's topic.
 */
export const CLUB_PLACE_HELP: Readonly<Record<string, PageHelpTopic>> = {
  overview: org(['club-overview'], 'Overview'),
  // ── Rep teams (six tabs) and its one record page ──
  'rep-teams/rt-teams': rep(['team-board', 'recipe-create-team-program-year'], 'Teams'),
  'rep-teams/rt-assistant-coaches': rep(['assistant-coaches-page', 'recipe-assign-coach-access'], 'Assistant coaches'),
  'rep-teams/rt-docs': rep(['recipe-publish-document-templates'], 'Document templates'),
  'rep-teams/rt-shared-library': rep(['shared-library'], 'Shared library'),
  'rep-teams/rt-past': rep(['team-urls-past'], 'Past seasons'),
  'rep-teams/rt-bring-in': rep(['recipe-bring-in-coach-team'], 'Bring in a coach’s team'),
  'rep-rename-slugs': rep(['team-urls-past'], 'Rename team URLs'),
  // ── A rep team (five tabs) and its two record pages ──
  'team/team': rep(['team-page', 'recipe-seasons'], 'Team page'),
  'team/roster': rep(['team-roster-read', 'recipe-accept-player-to-roster'], 'Roster'),
  // The section's own question answers this page ("What does a team's Schedule show me?").
  'team/schedule': rep(['franchise-model'], 'Schedule'),
  'team/tryouts': rep(['recipe-open-tryouts-review-applicants'], 'Tryouts', 'recipe-open-tryouts-steps'),
  'team/coaches': rep(['recipe-assign-coach-access'], 'Coaches'),
  'team-history': rep(['team-history', 'recipe-seasons'], 'History'),
  'team-year': rep(['team-history'], 'Season'),
  // ── A house-league season (seven tabs), its club-schedule record, and the Seasons list ──
  'season/overview': hl(['recipe-launch-season', 'lifecycle'], 'Overview'),
  'season/registrations': hl(['registrations'], 'Registrations'),
  'season/teams': hl(['recipe-build-teams'], 'Teams & draft', 'build-teams-board'),
  'season/schedule': hl(['recipe-generate-house-league-schedule'], 'Schedule', 'recipe-generate-house-league-schedule-t-page'),
  'season/standings': hl(['recipe-record-house-league-scores'], 'Standings', 'recipe-record-house-league-scores-t-ranked'),
  'season/money': hl(['ledger-notifications'], 'Money', 'money-page'),
  'season/notifications': hl(['ledger-notifications'], 'Email families', 'email-families'),
  'club-schedule': hl(['house-league-time'], 'Schedule', 'house-league-time-t-club-schedule'),
  'season-form': hl(['signup-form'], 'Sign-up form'),
  'hl-seasons': hl(['season-home'], 'Seasons'),
  // ── Accounting (nine tabs; Payment requests and Allocations only with Rep teams, Payouts only with payouts) ──
  'accounting/overview': acc(['ledgers'], 'Overview'),
  'accounting/budget': acc(['budget'], 'Budget'),
  'accounting/teams': acc(['teams-tab'], 'Teams'),
  // A team's account: a record over Teams (its address lights Teams).
  'accounting/teams/record': acc(['team-account'], 'Team account'),
  'accounting/ledger': acc(['entries', 'recipe-add-income-expense'], 'Ledger'),
  'accounting/bank': acc(['bank-tab'], 'Bank'),
  'accounting/allocations': acc(['allocations'], 'Allocations'),
  'accounting/payment-requests': acc(['payment-requests'], 'Payment requests'),
  'accounting/budget-vs-actual': acc(['budget-vs-actual'], 'Budget vs. Actual'),
  'accounting/payouts': acc(['payouts-tab'], 'Payouts'),
  // ── Families (two tabs) and a child's page ──
  'families/families': fam(['families-worklist'], 'Families'),
  // A family's record: over Families (its address lights Families).
  'families/families/record': fam(['families-family-page'], 'Family'),
  'families/duplicates': fam(['families-duplicates'], 'Duplicates'),
  child: fam(['families-child-page'], 'Child'),
  // ── Organization (the person's own tabs, six at most) ──
  'org/org/board': org(['the-board', 'roles'], 'The board'),
  'org/org/members': org(['inviting-and-managing-members-11', 'roles'], 'Members'),
  'org/org/audit': org(['notifications-audit'], 'Audit log', 'notifications-audit-t-audit-log'),
  'org/org/settings': org(['settings', 'two-step-sign-in'], 'Settings'),
  'org/org/venues': org(['venue-library'], 'Venue library'),
  'org/org/pdf': inGuide('exports')(['pdf-settings'], 'PDF settings'),
  // ── The screens with no tab row ──
  'permits/permits': org(['permits'], 'Permits'),
  // Communications (Club Communications Stage 1, N12): the place has its own guide since the Close.
  'club-emails/club-emails': comms(['comms-new-email', 'comms-list'], 'Communications'),
  // Sponsorships (Board Ready Stage 6, Part 1): four tabs, all covered. The Setup tab also holds its sponsorship form.
  'sponsorships/deals': org(['club-sponsorships'], 'Deals', 'club-sponsorships-t-start'),
  'sponsorships/packages': org(['club-sponsorships'], 'Packages', 'club-sponsorships-t-packages'),
  'sponsorships/sponsors': org(['club-sponsorships'], 'Sponsors', 'club-sponsorships-t-sponsors'),
  'sponsorships/setup': org(['club-sponsorships'], 'Setup', 'club-sponsorships-t-setup'),
  calendar: org(['club-calendar'], 'Calendar'),
  schedules: org(['club-schedules'], 'Schedules', 'club-schedules-t-list'),
  schedule: org(['club-schedules'], 'Schedule', 'club-schedules-t-page'),
  'public-site': org(['public-site-editor'], 'Public site'),
  billing: org(['club-plan-and-billing'], 'Plan & billing'),
  notifications: org(['notifications-audit'], 'Notifications', 'notifications-audit-t-notifications'),
};

/**
 * The tournament admin's pages, by their path under `/tournaments/`. The first thirteen are the topics the pages carried in their
 * own top row until Phase 6b (moved here unchanged); the five after them had none (Phase 6b, Part 1 step 3). Settings & access
 * reuses three club screens (Members, Audit log, PDF settings) and they open the CLUB's topics (T5: a club topic, not a stand-in).
 */
export const TOURNAMENT_PAGE_HELP: Readonly<Record<string, PageHelpTopic>> = {
  // The dashboard's address answer is the weeks-before board; the page replaces it with its own board's once it knows it.
  dashboard: DASHBOARD_HELP.weeksBefore,
  manage: t(['recipe-closeout-tournament'], 'Tournaments', 'closeout-two-lists'),
  archives: t(['recipe-closeout-tournament'], 'Tournaments', 'closeout-two-lists'),
  registrations: t(['registrations-and-teams', 'recipe-review-tournament-teams', 'assign-teams-to-pools'], 'Teams'),
  schedule: t(['recipe-build-tournament-schedule', 'schedule-playoffs'], 'Schedule'),
  results: t(['scores-and-results', 'recipe-finalize-tournament-scores'], 'Results'),
  divisions: t(['divisions-and-pools'], 'Divisions'),
  venues: t(['venues-contacts-rules'], 'Venues', 'venues-records'),
  rules: t(['venues-contacts-rules'], 'Rules', 'rules-records'),
  chat: t(['tournament-chat'], 'Chat'),
  branding: t(['public-site-preview'], 'Public site', 'public-site-cards'),
  summary: t(['recipe-closeout-tournament'], 'Summary', 'closeout-summary'),
  'settings/event': t(['settings-and-access'], 'Event settings', 'event-settings-cards'),
  'settings/web-address': t(['settings-and-access'], 'Name & address', 'settings-web-address'),
  // ── No topic until Phase 6b ──
  'check-in': t(['scores-and-results'], 'Check-in', 'scores-t-gate'),
  communication: t(['public-communication'], 'Communications'),
  'staff-kit': t(['scores-and-results'], 'Staff kit', 'scores-t-staff-kit'),
  'settings/notifications': t(['settings-and-access'], 'Your notifications', 'tournament-notifications'),
  'settings/payouts': t(['online-payments'], 'Payouts', 'online-payments-setup'),
  // ── The club's own screens, reused by Settings & access on the Tournament plans: the club's topic ──
  'settings/members': CLUB_PLACE_HELP['org/org/members'],
  'settings/members/audit': CLUB_PLACE_HELP['org/org/audit'],
  'settings/pdf': CLUB_PLACE_HELP['org/org/pdf'],
};

/** A topic as the drawer asks for it, with the full guide's door at the first section (the panel's foot, drawing n2). Every
 *  guide is at `/admin/help/<its module>`. */
export function helpRequestFor(topicAt: PageHelpTopic, base: string): HelpRequest {
  return {
    module: topicAt.module,
    sectionIds: [...topicAt.sectionIds],
    ...(topicAt.subtopicId ? { subtopicId: topicAt.subtopicId } : {}),
    label: topicAt.label,
    fullGuideHref: `${base}/help/${topicAt.module}#${topicAt.sectionIds[0]}`,
  };
}

/** What the topic is read from: `clubPlaceAt`'s answer — its key, its lit tab, and its tabs (to tell a tab from a record over it). */
export type HelpPlace = { key: string; activeId: string; tabs: readonly { id: string; href: string }[] };

/** The table key for a club place: `rep-teams/rt-teams`, `team/roster`, `season/money`, or a named screen's `calendar`. */
export function clubPlaceHelpKey(place: Pick<HelpPlace, 'key' | 'activeId'>): string {
  const kind = place.key.split(':')[0];
  return place.activeId ? `${kind}/${place.activeId}` : kind;
}

/**
 * The topic for where you are, or null (no "?"). `place` is `clubPlaceAt`'s answer for this address (null where the person is
 * refused, so a refusal never offers the page's help); `onOverview` is the club's Overview (no place of its own).
 */
export function adminPageTopicAt(
  pathname: string, base: string, place: HelpPlace | null, onOverview: boolean,
  tournament: { opens: boolean; hasEvent: boolean } = { opens: true, hasEvent: true },
): PageHelpTopic | null {
  const path = pathname.replace(/\/+$/, '');
  const tournaments = `${base}/tournaments/`;
  if (path.startsWith(tournaments)) {
    // Someone the tournament admin refuses sees the refusal, not its help (/review 2026-11-13); and the dashboard with no event
    // to show has no board to explain (it drew no "?" before the move either).
    // The organization's own screens there (the list, Settings & access) keep their own gates, not the tournament module's.
    if (!tournament.opens && !isTournamentOrgScreen(path, base)) return null;
    const rest = path.slice(tournaments.length);
    if (rest === 'dashboard' && !tournament.hasEvent) return null;
    // ⚠ Own keys only: an address is typed by a person, and `/tournaments/constructor` must not find an Object's inherited member.
    return own(TOURNAMENT_PAGE_HELP, rest);
  }
  if (!place) return onOverview ? CLUB_PLACE_HELP.overview : null;
  const key = clubPlaceHelpKey(place);
  const lit = place.tabs.find(tab => tab.id === place.activeId);
  const overTab = lit && lit.href.replace(/\/+$/, '') !== path;
  return (overTab ? own(CLUB_PLACE_HELP, `${key}/record`) : null) ?? own(CLUB_PLACE_HELP, key);
}

const own = (table: Readonly<Record<string, PageHelpTopic>>, key: string): PageHelpTopic | null =>
  Object.hasOwn(table, key) ? table[key] : null;
