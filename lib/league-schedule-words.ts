import { pluralize, possessive } from './utils';
import { CLUB_EMAIL_CAP } from './families-words';

/**
 * THE WORDS OF PUBLISH SCHEDULE AND CHANGES TO SEND (House League 9d-2b; settled by /marketing 2026-10-28,
 * HOUSE_LEAGUE_STAGE9D2_11B_COPY.md "Stage 9d-2b" — that file wins over a drawing). The count is FAMILIES (a household,
 * grouped by the guardian's email), never one per child. Pure: the screens, the routes and the tests read the same lines.
 */

const families = (n: number) => pluralize(n, 'family', 'families');

/** e1 · e2: the draft, and Publish schedule. */
export const SCHEDULE_PUBLISH_WORDS = {
  draft: (games: number) => `Draft · ${pluralize(games, 'game')} · families see nothing yet`,
  /** A reader sees the state alone. */
  draftShort: 'Draft',
  teamsFirst: (division: string) => `Publish ${possessive(division)} teams first, so every family knows its child’s team.`,
  button: 'Publish schedule',
  buttonPhone: 'Publish',
  publishedOn: (day: string) => `Published ${day}`,
  published: (day: string, n: number) => `Published ${day} · ${families(n)} told`,
  notSent: (n: number) => ` · ${pluralize(n, 'change')} not sent`,
  partial: (reached: number, n: number, missed: number) => `reached ${reached} of ${families(n)} · ${missed} didn’t send.`,
  seeThem: 'See them',
  title: (division: string) => `Publish ${possessive(division)} schedule?`,
  body: (games: number, teams: number) =>
    `${pluralize(games, 'game')} go on the public schedule. Each family gets one email with its children’s games, and the ${possessive(pluralize(teams, 'team'))} coaches see them on their team page. After this, changes wait for you to send them.`,
  foot: (n: number) => `Reaches ${families(n)}. An automatic notice: it doesn’t count toward today’s ${CLUB_EMAIL_CAP}.`,
  footPhone: (n: number, teams: number) => `${n} ${n === 1 ? 'family gets' : 'families get'} one email each. The ${pluralize(teams, 'coach', 'coaches')} see their games.`,
  keepDraft: 'Keep as a draft',
  notYet: 'Not yet',
  publish: 'Publish',
  publishing: 'Publishing…',
  done: (day: string, n: number) => `Published ${day} · ${families(n)} emailed.`,
  /** A clock time ends in its own period ("8:14 p.m."), so the sentence does not add a second one. */
  already: (by: string | null, division: string, at: string | null) =>
    `${by ?? 'Someone'} published ${possessive(division)} schedule${at ? ` at ${at}` : ''}${at?.endsWith('.') ? '' : '.'} Nothing more was sent.`,
  changed: (division: string) => `${division} changed while this window was open. Close it and look again.`,
  noGames: (division: string) => `${division} has no games to publish yet.`,
  finished: 'This season is finished. Reopen it to change it.',
  failed: 'That didn’t publish. Try again.',
} as const;

/** g2 · g3: what families and coaches read. */
export const SCHEDULE_PUBLIC_WORDS = {
  coming: (division: string) => `${possessive(division)} schedule is coming`,
  comingHint: 'Registered families get an email when it’s up.',
  comingTab: (division: string) => `${division} · coming`,
  moved: 'Moved',
  /** "Was Thu, Jun 17 · 6:00 p.m." — the date families heard before the move. */
  movedWas: (day: string, clock: string) => `Was ${day} · ${clock}`,
  coachUnpublished: (division: string) => `${possessive(division)} schedule isn’t published yet. Your games show here when it is.`,
  coachNoneAhead: 'No games from today on.',
} as const;
