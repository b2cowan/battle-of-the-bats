import { roleWithArticle } from './board-people';
import { PLAN_BILLING_TITLE } from './plan-billing-title';
import type { OrgRole } from './types';

/**
 * "NOT YOURS" — ONE SCREEN FOR A PAGE THAT ISN'T THE PERSON'S (⚖ Club Tier Stage 13a, Ask 6 = A, owner 2026-11-06;
 * drawing: the Stage 13 hub, tab 15). The ONE home of these words: `npm run check:spelling` and
 * tests/unit/club-stage13a-doors-guard.test.ts hold every other file in the club admin to them.
 *
 * The screen says three things, always in this order: what the page is, who opens it (by name), and a door back to
 * the person's own home. It replaced eight answers to the same situation: a silent return to the Overview (Families,
 * Accounting, Rep teams), "Access restricted … Ask the owner", "You don’t have access to this page" under the page's own
 * title, a page with no heading (PDF settings), "Nothing to show" (Schedules, Calendar) and three owner-only voices.
 *
 * ⚖ WHO GIVES ACCESS. Only the owner changes what a member can open (the member route refuses a capability change from
 * anyone else), so a page a person could be given says the OWNER, by name, and never "or an admin". A page that is the
 * owner's alone says so. A page the club's ROLES decide (Schedules: owner and admins build them) names the roles.
 *
 * Not this screen: a plan that does not carry the page (that card says "not on your plan" and stays), and an address that
 * does not exist (a real 404 stays a 404).
 */

/** Who opens a page, as the screen's second sentence says it. */
export type NotYoursWho =
  /** The owner can give this person access (a capability). */
  | 'grant'
  /** The owner's alone: no one else ever opens it (billing, org settings, the audit log). */
  | 'owner'
  /** The owner and the club's admins, by role (PDF settings, Schedules). */
  | 'ownerOrAdmin'
  /** The people who run the league's desk, by role (a season's email). */
  | 'leagueDesk'
  /** Anyone not limited to certain teams: no grant can change it for a limited member (Families, Stage 5a Ask 12). */
  | 'wholeClub';

export type NotYoursPage =
  | 'families' | 'familiesLimited' | 'accounting' | 'repTeams' | 'publicSite' | 'houseLeague' | 'seasonMoney' | 'seasonEmails'
  | 'pdfSettings' | 'settings' | 'billing' | 'auditLog' | 'members' | 'schedules' | 'calendar' | 'organization';

type PageWords = { title: string; what: string; who: NotYoursWho };

/** Each page: its name as the sidebar says it, one sentence of what it is, and who opens it. */
export const NOT_YOURS_PAGES: Record<NotYoursPage, PageWords> = {
  families: { title: 'Families', what: 'It’s the club’s household book: who owes, who is missing forms, who can’t be reached.', who: 'grant' },
  // A member limited to some teams: Families is never given to them (a family spans every team), so no one is named.
  familiesLimited: { title: 'Families', what: 'It’s the club’s household book: who owes, who is missing forms, who can’t be reached.', who: 'wholeClub' },
  accounting: { title: 'Accounting', what: 'It’s the club’s books: the ledger, the budget and the money sent to teams.', who: 'grant' },
  repTeams: { title: 'Rep teams', what: 'It’s where the club runs its rep teams: rosters, coaches and each team’s season.', who: 'grant' },
  publicSite: { title: 'Public site', what: 'It’s where the club builds the website families visit.', who: 'grant' },
  houseLeague: { title: 'House league', what: 'It’s where the club runs its house league: seasons, registrations, teams and games.', who: 'grant' },
  seasonMoney: { title: 'Season money', what: 'It’s the season’s fees: who has paid, who owes, and refunds.', who: 'grant' },
  seasonEmails: { title: 'Season email', what: 'It’s where the season’s families are emailed, and what was sent.', who: 'leagueDesk' },
  pdfSettings: { title: 'PDF settings', what: 'It sets the header, logo and footer on every PDF the club exports.', who: 'ownerOrAdmin' },
  settings: { title: 'Settings', what: 'It holds the club’s name, web address, contact email and logo.', who: 'owner' },
  billing: { title: PLAN_BILLING_TITLE, what: 'It holds the club’s plan, its subscription and how it’s paid.', who: 'owner' },
  auditLog: { title: 'Audit log', what: 'It records who changed what on the club’s board.', who: 'owner' },
  members: { title: 'Members', what: 'It’s the club’s board: who is on it and what each person opens.', who: 'grant' },
  schedules: { title: 'Schedules', what: 'It’s where the club hands out its field time to its programs.', who: 'ownerOrAdmin' },
  calendar: { title: 'Calendar', what: 'It shows the games, practices and events of the programs you open.', who: 'grant' },
  organization: { title: 'Organization', what: 'It holds the club’s board, its venues and its settings.', who: 'grant' },
};

export const NOT_YOURS_WORDS = {
  /** The heading: "Families isn’t one of your pages". */
  heading: (title: string) => `${title} isn’t one of your pages`,
  /** The door home: "Back to Accounting". */
  back: (homeLabel: string) => `Back to ${homeLabel}`,
  /** A tournament-only workspace's admin home, for a member who can open nothing there yet (it IS their home). */
  nothingOpenTitle: 'Nothing here is open to you yet',
  /** A locked Overview row (A3): the chip names who opens it. */
  askChip: (ownerName: string | null) => (ownerName ? `Ask ${ownerName}` : 'Ask the owner'),
  /** …and its accessible name: "Plan & billing, the owner’s". */
  lockedRowLabel: (label: string) => `${label}, the owner’s`,
  /** Accounting › Teams for someone who cannot open Rep teams (A6). */
  teamsEmptyNoRepTeams: 'No teams yet. A team appears here once the club adds it in Rep teams. Ask the owner or an admin to add it.',
  teamsEmpty: 'No teams yet. A team appears here once the club adds it in Rep teams.',
  /** The Overview's quiet "Tournaments: none yet" row, for someone who cannot start one (A5). */
  tournamentStarterShort: 'The owner or an admin starts one',
};

/**
 * The screen's second sentence (Ask 6: "who opens it, by name"). The owner is named; the role of the person reading is
 * said in words ("can give a treasurer access"). With no named owner: "the club’s owner".
 */
export function notYoursWhoSentence(who: NotYoursWho, ownerName: string | null, viewerRole: OrgRole | string | null): string {
  const owner = ownerName ? `${ownerName} (owner)` : 'The club’s owner';
  switch (who) {
    case 'grant':
      return `${owner} can give ${viewerRole ? roleWithArticle(viewerRole) : 'you'} access.`;
    case 'owner':
      return ownerName ? `Only ${ownerName}, the owner, opens it.` : 'Only the club’s owner opens it.';
    case 'ownerOrAdmin':
      return `${owner} and ${ownerName ? 'the club’s' : 'its'} admins open it.`;
    case 'wholeClub':
      return 'It opens only for people who aren’t limited to certain teams.';
    case 'leagueDesk':
      return `${owner}, ${ownerName ? 'the club’s' : 'its'} admins, league admins and league registrars open it.`;
  }
}
