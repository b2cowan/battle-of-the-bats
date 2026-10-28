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

/** f1 · f2 · f5: a published game's edit, and Changes to send. */
export const CHANGES_TO_SEND_WORDS = {
  title: 'Changes to send',
  /** The header's button; its count is the amber pill beside it. */
  button: 'Changes to send',
  /** "Orioles vs Twins · Thu, Jun 24: 6:00 p.m. → 7:30 p.m." (`→` as the club's Send the changes). */
  rowFromTo: (game: string, day: string, from: string, to: string) => `${game} · ${day}: ${from} → ${to}`,
  /** A new day: "Orioles vs Twins · Thu, Jun 24: now Thu, Jul 1, 6:00 p.m." */
  rowNow: (game: string, day: string, now: string) => `${game} · ${day}: now ${now}`,
  rowState: (game: string, day: string, state: string) => `${game} · ${day}: ${state}`,
  state: { cancelled: 'cancelled', postponed: 'postponed', added: 'added', back_on: 'back on' } as Record<string, string>,
  /** "Blue Jays and Red Sox families · 22 families" */
  who: (home: string, away: string, n: number) => `${home} and ${away} families · ${families(n)}`,
  byClub: (division: string) => `The club moved ${possessive(division)} game time.`,
  /** "The Kims have Ava on the Twins and Henry on the Rays. They get one email with both changes." */
  oneHousehold: (family: string, parts: readonly { child: string; team: string }[]) => {
    const list = parts.map(p => `${p.child} on the ${p.team}`);
    const joined = list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}` : list[0];
    return `The ${family} have ${joined}. They get one email with ${parts.length === 2 ? 'both' : 'all their'} changes.`;
  },
  undo: 'Undo',
  undoAria: (game: string) => `Undo the change to ${game}`,
  undone: (game: string) => `Undone. ${game} is back as families last heard.`,
  foot: (n: number, teams: number) =>
    `Reaches ${families(n)}, one email each. The ${possessive(pluralize(teams, 'team'))} coaches get a copy. Doesn’t count toward today’s ${CLUB_EMAIL_CAP}.`,
  notYet: 'Not yet',
  send: (n: number) => `Send ${pluralize(n, 'change')}`,
  sending: 'Sending…',
  /** A build word until Part 4 sends: what was written for families ("Reached 64 of 66 …" comes with the send). */
  sent: (n: number) => `Sent to ${families(n)}.`,
  played: 'This game has already been played, so it isn’t emailed.',
  empty: 'Nothing is waiting to send.',
  already: (by: string | null, at: string | null) =>
    `${by ?? 'Someone'} sent these${at ? ` at ${at}` : ''}${at?.endsWith('.') ? '' : '.'} Nothing more was sent.`,
  netNothing: 'Nothing was waiting, so nothing was sent.',
  /** Under the waiting count (f1). */
  listNote: 'Until you send, the public schedule and the coaches’ pages still show the old games.',
  /** The list's marker on a game whose change waits: "Moved · not sent". A place change is a move to families. */
  marker: (kind: string | null) => `${MARKER_WORD[kind ?? ''] ?? 'Changed'} · not sent`,
  /** 9d2b·B: a league admin places a game only on the division's game time. */
  outsideTime: (division: string) =>
    `That’s outside ${possessive(division)} game time. Pick one of its open times, or give it more in House league’s time.`,
  /** The window's stale press (the 9d-2a review): what it saw is not the game any more. */
  gameChanged: 'This game changed while its window was open. Close it and look again.',
  undoPlayed: 'This game has already been played, so its result stays.',
  /** Build words for a refusal the window never offers (9d2·9): reached only by a stale window or a hand-made call. */
  deletePublished: 'This schedule is published, so its games are cancelled, not deleted.',
  /** f5's change was saved, and its send was refused or failed: it waits with the rest. */
  sendNowFailed: 'Saved, but it didn’t send. It’s waiting in Changes to send.',
  /** A build word: deleting a team takes its games with it, and a published game is never just removed (9d2·9). */
  teamHasPublishedGames: (team: string) =>
    `${team} has games on the published schedule, so it can’t be deleted. Families have been told about them.`,
  failed: 'That didn’t send. Try again.',
} as const;

/** The list's word for a held kind ("Postponed" and "Back on" are build words in the settled pattern). */
const MARKER_WORD: Record<string, string> = {
  moved: 'Moved', place: 'Moved', given_date: 'Moved', cancelled: 'Cancelled', added: 'Added', postponed: 'Postponed',
  back_on: 'Back on',
};

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
