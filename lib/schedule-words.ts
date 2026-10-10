/**
 * THE SCHEDULE'S SAVE WORDS — one home (Tournament admin redesign, Stage 3 defects pass A45, 2026-10-09).
 *
 * The defects pass changed what three things DO, and their old sentences became false:
 *   - the generator's save no longer "permanently clears" a division — it replaces only games still to play and
 *     keeps everything else (F70), in one step that either all happens or none of it does (P1);
 *   - a save the server refuses now says so instead of snapping the game back in silence (F71);
 *   - the Publish window's game-day reminder sentence shows only when the reminder will really be scheduled (F73).
 * The words are `/marketing`'s (2026-10-09); the placement is the pass's. Plain strings and small functions only —
 * no React — so the games route, the screens and a unit test read the same sentence.
 *
 * ⚠ A generator save tells NO ONE (it records no schedule change). Nothing here may say or imply teams are told.
 */

import { pluralize as count } from './utils.ts';
import { GAME_DAY_LIST, GAME_STATE_WORD } from './game-day-words.ts';
import { TEAMS_WORDS } from './registration-words.ts';
import { formatShortWeekdayDate } from './timezone.ts';
import { fanSlotLabel } from './playoff-bracket.ts';
import type { ScheduleStage, ScheduleState, ScheduleView } from './schedule-day.ts';

/** A division's (or a team's) possessive: "U13's", but "U11 Girls'" — a name ending in s takes the apostrophe alone. */
export const possessive = (name: string) => (/s$/i.test(name.trim()) ? `${name}'` : `${name}'s`);

// ── THE DAY (Stage 3 build, Part 2 — S1, A33, A44; /marketing 2026-10-09) ────────────────────────────────────────

/** The two paid tools and the free one, by name (A34 as amended 2026-10-09: a door names the tool it opens). */
export const SCHEDULE_TOOL_NAMES = {
  roundRobin: 'Round-robin generator',
  playoffs: 'Playoff generator',
  rainDelay: 'Rain delay',
  publish: 'Publish…',
  unpublish: 'Unpublish a division…',
  buildBracket: 'Build bracket',
  editBracket: 'Edit bracket',
  clearBracket: 'Clear bracket',
} as const;

export const SCHEDULE_DAY_WORDS = {
  title: 'Schedule',
  view: 'View',
  views: {
    day: { label: 'Day', hint: 'One day, every game' },
    all: { label: 'All games', hint: 'Every day, by day' },
    timeline: { label: 'Timeline', hint: (fieldPlural: string) => `${fieldPlural} across the day` },
    bracket: { label: 'Bracket', hint: "One division's playoffs" },
  } satisfies Record<ScheduleView, { label: string; hint: string | ((p: string) => string) }>,
  /** Teams' own words, so the two toolbars spell the Filter one way. */
  filter: TEAMS_WORDS.filter,
  filtersOn: TEAMS_WORDS.filtersOn,
  resetFilters: TEAMS_WORDS.resetFilters,
  search: 'Search teams',
  tools: TEAMS_WORDS.tools,
  groups: { division: 'Division', stage: 'Stage', status: TEAMS_WORDS.filterStatus },
  stages: { pool: 'Round robin', playoff: 'Playoffs' } satisfies Record<ScheduleStage, string>,
  states: {
    needsScore: GAME_STATE_WORD.needsScore,
    pendingReview: GAME_STATE_WORD.pendingReview,
    playingNow: GAME_DAY_LIST.playingNow,
    scheduled: GAME_DAY_LIST.scheduled,
    final: GAME_STATE_WORD.final,
    forfeit: GAME_STATE_WORD.forfeit,
    cancelled: 'Cancelled',
  } satisfies Record<ScheduleState, string>,
  previousDay: 'Previous day',
  nextDay: 'Next day',
  chooseDay: 'Choose a day',
  previousDivision: 'Previous division',
  nextDivision: 'Next division',
  chooseDivision: 'Choose a division',
  noDate: 'No date yet',
  /** "Today · Fri, Oct 9" — the day row's label; any other day is just its date. */
  dayLabel: (day: string, today: string) => (day === today ? `Today · ${formatShortWeekdayDate(day)}` : formatShortWeekdayDate(day)),
  /** "4 games · U11 and U13" / "12 games · 3 divisions" / "1 game · U11" / "No games". */
  dayCaption: (games: number, divisionNames: readonly string[]) => {
    if (games === 0) return 'No games';
    const which = divisionNames.length === 0 ? ''
      : divisionNames.length === 1 ? divisionNames[0]
        : divisionNames.length === 2 ? `${divisionNames[0]} and ${divisionNames[1]}`
          : `${divisionNames.length} divisions`;
    return [count(games, 'game', 'games'), which].filter(Boolean).join(' · ');
  },
  /** A band's count in All games. */
  bandCount: (games: number) => count(games, 'game', 'games'),
  noGamesOnDay: (day: string) => `No games on ${formatShortWeekdayDate(day)}.`,
  noGamesMatch: 'No games match the filter.',
  clearFilter: 'Clear the filter',
  /** The health row's division scope, after Stage 1's caption ("Healthy · no issues · both divisions"). */
  healthScope: (divisions: number) => (divisions <= 1 ? '' : divisions === 2 ? 'both divisions' : 'every division'),
  /** A Tools row the plan doesn't include: the tool's name, then the plan's (A44 — never a bare padlock). */
  lockedPlan: 'Tournament Plus',
  addGame: 'Add game',
  /** The Bracket view's heading ("U11 playoffs"). */
  bracketTitle: (division: string) => `${division} playoffs`,
  adjustRules: 'Adjust the rules',
  /** An event with no games yet: how to make them, by format and plan (/marketing 2026-10-09). */
  noGamesYet: {
    playoffsOnly: 'This tournament is playoffs only. Build the bracket by hand, or use the playoff generator to seed and schedule it.',
    playoffsOnlyLocked: 'This tournament is playoffs only. Build the bracket by hand. The playoff generator, which seeds and schedules it for you, is on Tournament Plus.',
    noPlayoffs: 'Add your games by hand — a day of scrimmages is a handful of rows — or use the round-robin generator to build them from your teams.',
    noPlayoffsLocked: 'Add your games by hand — a day of scrimmages is a handful of rows. The round-robin generator can build them from your teams on Tournament Plus.',
    both: 'Add games by hand, or use the round-robin generator to build them from your teams. For the playoffs, use the playoff generator or build the bracket by hand.',
    bothLocked: 'Add games by hand, or build the playoff bracket by hand. The round-robin and playoff generators are on Tournament Plus.',
  },
  /** Unpublish, from Tools (/marketing 2026-10-09). */
  unpublishTitle: (division: string) => `Unpublish ${division}?`,
  unpublishBody: (division: string) => `${possessive(division)} games come off the public schedule. Registration stays closed; reopen it yourself if you want new sign-ups.`,
  unpublishConfirm: (division: string) => `Unpublish ${division}`,
  unpublishAllTitle: (n: number) => `Unpublish all ${n} divisions?`,
  unpublishAllBody: 'Their games come off the public schedule; you can publish them again at any time. Registration stays closed; reopen it yourself if you want new sign-ups.',
  unpublishAllConfirm: (n: number) => `Unpublish all ${n}`,
  unpublishWindowTitle: 'Unpublish a division',
  toolHints: {
    roundRobin: 'Builds the round robin from your teams',
    playoffs: 'Seeds and schedules the playoffs',
    rainDelay: "Move or cancel a day's games at once",
    publish: "Put a division's games on the public site",
    unpublish: "Take a division's games off the public site",
  },
} as const;

// ── THE ROUND-ROBIN GENERATOR (Stage 3 build, Part 5 — S3, A34, A40; /marketing 2026-10-09) ──────────────────────

/** What a draft's save does to its division, counted (the generator's one statement, and its replace question). */
export interface DraftStatementCounts {
  division: string;
  /** The draft's new games. */
  added: number;
  /** The division's round-robin games still to play (scheduled, not kept) the save replaces. */
  replaced: number;
  /** Round-robin games already played or waiting on a score: they stay, with their scores. */
  played: number;
  /** Games still to play the organizer marked Keep: they stay where they are. */
  kept: number;
  /** Everything else the save leaves alone (its playoff games, a cancelled game). */
  other: number;
  /** The division's schedule is on the public site and in the app. */
  published: boolean;
}

/**
 * The statement under the chosen draft — what saving does, before anything is saved (S3): "Saving adds 12 games to
 * U11. U11 has none yet, so nothing is replaced. …" or "Saving changes U13's games." with what it adds, replaces and
 * keeps.
 */
export function draftStatement(c: DraftStatementCounts): { lead: string; rest: string; bullets: string[] } {
  const games = (n: number) => count(n, 'game', 'games');
  if (c.added === 0 && c.replaced === 0) return { lead: 'There is nothing to save.', rest: '', bullets: [] };
  if (c.replaced === 0 && c.played === 0 && c.kept === 0 && c.other === 0) {
    return {
      lead: `Saving adds ${games(c.added)} to ${c.division}.`,
      rest: ` ${c.division} has none yet, so nothing is replaced. ${c.published
        ? 'They show on the public site and in the app as soon as you save.'
        : `They aren't published yet: teams and families see them once you publish ${c.division}.`}`,
      bullets: [],
    };
  }
  const bullets: string[] = [];
  if (c.added > 0) bullets.push(`Adds ${games(c.added)} from this draft`);
  if (c.replaced > 0) bullets.push(`${c.added > 0 ? 'Replaces' : 'Removes'} ${count(c.replaced, 'game still to play', 'games still to play')}`);
  const played = c.played > 0 ? `${count(c.played, 'played game and its score', 'played games and their scores')}` : '';
  const kept = c.kept > 0 ? `${count(c.kept, 'game you marked Keep', 'games you marked Keep')}` : '';
  if (played || kept) bullets.push(`Keeps ${[played, kept].filter(Boolean).join(', and ')}`);
  if (c.other > 0) bullets.push(`Leaves its ${count(c.other, 'other game', 'other games')} as ${c.other === 1 ? 'it is' : 'they are'}`);
  return { lead: `Saving changes ${possessive(c.division)} games.`, rest: '', bullets };
}

export const GENERATOR_WORDS = {
  title: 'Round-robin generator',
  caption: {
    settings: (tournament: string) => `${tournament} · step 1 of 2 · settings`,
    drafts: (tournament: string, division: string) => `${tournament} · step 2 of 2 · drafts for ${division}`,
  },
  sections: { pairs: 'What it pairs', when: 'When', where: 'Where', rules: 'Rules' },
  fields: {
    division: 'Division',
    gamesPerTeam: 'Games per team',
    gamesPerSlot: 'Games per slot',
    gamesPerTeamHint: 'Round-robin rounds to generate, not a guaranteed game count. With an odd number of teams, one gets a bye each round and plays one fewer game.',
    pair: 'Pair',
    pairTeams: 'The accepted teams',
    pairSlots: 'Slots now, the teams later',
    pairSlotsHint: (division: string, pooled: boolean) => (pooled
      ? 'Builds the games with placeholder names ("Pool A Team 1") so you can lay out the schedule before teams are final. Assign real teams to the slots; the public schedule shows real names once you publish.'
      : `Builds the games with placeholder names ("${division} Team 1") without pools. Assign real teams; the public schedule shows real names once you publish.`),
    slots: (pool: string) => `${pool} slots`,
    day: 'Day',
    from: 'From',
    until: 'Until',
    addDay: 'Add a day',
    removeDay: (day: string) => `Remove ${day}`,
    chooseDay: 'Choose a day',
    gameLength: 'Game length',
    gameLengthHint: 'Saved on every game it makes',
    turnover: 'Turnover',
    turnoverHint: (noun: string) => `Between games on one ${noun.toLowerCase()}`,
    minutes: (n: number) => `${n} min`,
    aimFor: 'Aim for',
    moreRules: 'More rules',
    fewerRules: 'Fewer rules',
    rulesSummary: (perDay: number, rest: number) => `Most ${perDay} games a day · ${rest} min rest`,
    maxPerDay: 'Most games a day, per team',
    minRest: 'Rest between a team\'s games',
    effort: 'How many drafts it tries',
    effortChoices: { 12: 'Fewer, faster', 24: 'Balanced', 40: 'The most' } as Record<number, string>,
    avoidBackToBack: 'Avoid back-to-back games',
    fewerMoves: 'Keep teams on one field',
    balanceEarlyLate: 'Spread early and late games',
    allFields: 'All',
    noFields: 'None',
    temporary: 'Use temporary facilities',
    temporaryHint: 'Generate now and place the games on real fields later.',
    temporaryCount: 'Facilities',
  },
  /** The presets' names in the Aim for dropdown (ids are the engine's). */
  presets: { balanced: 'Balanced', rest: 'Rest-friendly', compact: 'Compact', facility: 'Fewest field moves', early: 'Younger teams earlier', custom: 'Your own rules' } as Record<string, string>,
  /** The other divisions' kept games, drawn as taken (F69 made the drafts leave them free). */
  taken: (opts: { divisions: string[]; games: number; fields: string[]; days: string[]; times: string[] }) => {
    const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
    const verb = opts.games === 1 ? 'holds' : 'hold';
    const where = `${list(opts.fields)} on ${list(opts.days)}`;
    const first = opts.divisions.length === 1
      ? `${possessive(opts.divisions[0])} ${count(opts.games, 'game', 'games')} ${verb} ${where}${opts.times.length && opts.times.length <= 4 ? ` at ${list(opts.times)}` : ''}`
      : `Other divisions' ${count(opts.games, 'game', 'games')} ${verb} ${where}`;
    // A clock ending "p.m." already ends the sentence: one period, never two.
    return `${first}${first.endsWith('.') ? '' : '.'} The drafts leave those times free.`;
  },
  noGamesYet: (division: string) => `${division} has no games yet.`,
  hasGames: (division: string, n: number) => `${division} has ${count(n, 'game', 'games')}.`,
  generate: 'Generate drafts',
  threeMore: 'Three more drafts',
  backToSettings: 'Back to settings',
  settings: 'Settings',
  save: 'Save this schedule',
  saveReplace: (n: number) => `Save and replace ${count(n, 'game', 'games')}`,
  seeGames: (n: number) => `See its ${count(n, 'game', 'games')}`,
  hideGames: 'Hide its games',
  draftsLabel: 'Drafts',
  /** A draft card: its rank's name, then what decides between them. */
  cards: {
    best: 'Best overall', moves: 'Fewest field moves', rest: 'Best rest', backToBacks: 'Fewest back-to-backs',
    lightDays: 'Lightest days', health: 'Highest health', other: (n: number) => `Draft ${n}`, current: 'Current schedule',
  },
  measures: {
    noClashes: (others: string) => `No clashes with ${others}`,
    loadAndMoves: (backToBacks: number, moves: number) => `${count(backToBacks, 'back-to-back', 'back-to-backs')} · ${count(moves, 'field move', 'field moves')}`,
    shortestRest: (rest: string) => `Shortest rest ${rest}`,
    clubOne: (where: string) => `1 game on a club booking: ${where}`,
    clubMany: (n: number) => `${n} games on a club booking`,
    clubClear: 'Clear of club bookings',
  },
  others: (names: string[]) => (names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} and ${names[1]}` : `${names.length} other divisions`),
  /** The replace asks once (the lime names the replace; this is its question). */
  replace: {
    title: (n: number) => `Replace ${count(n, 'game', 'games')} still to play?`,
    published: (division: string) => `${division} is published. Where two teams still meet, their followers are told the new time, and a game this draft drops is told as cancelled. A new pairing appears on the schedule without an alert.`,
    unpublished: (division: string) => `${division} isn't published, so nobody is told.`,
    back: 'Back',
    go: (n: number) => `Replace ${count(n, 'game', 'games')}`,
  },
  slotDraftNote: (pooled: boolean) => (pooled
    ? 'These are placeholder games. Assign real teams to the slots; the public schedule shows real names once you publish.'
    : 'These placeholder games need no pools. Save them now, then assign real teams by hand or generate again from the teams.'),
  errors: {
    chooseDays: 'Choose a day for every row of When.',
    twoTeams: 'It needs at least 2 accepted teams to pair.',
    noMatchups: 'There is nothing to pair. Check the pools.',
    noSlotMatchups: 'There is nothing to pair. Give each pool at least 2 slots.',
    notEnoughSlots: (need: number, have: number, noun: string) => `There is room for ${count(have, 'game', 'games')} and the draft needs ${need}. Add a day, widen the hours, choose more ${noun.toLowerCase()}s, or shorten the game length.`,
    noDraft: 'No draft fits without two games for one team at once. Add a day or a field.',
  },
} as const;

/** The one-step save's replies (the games route; shown in the generator's error band, the draft still on screen). */
export const DRAFT_SAVE_FAILED = {
  /** A game the draft replaces was scored, kept or removed since the draft was made. Nothing was written. */
  scheduleChanged: 'A game in this draft has changed since it was made. Nothing was saved. Generate the draft again.',
  /** Anything else. The save is one transaction, so nothing was written. */
  other: 'Something went wrong. Nothing was saved and the schedule is as it was. Try again.',
} as const;

/** Titles of the schedule page's message window when the server refuses a write (F71). */
export const SCHEDULE_REFUSAL_TITLE = {
  saveGame: 'Could not save game',
  cancelGame: 'Could not cancel game',
  reinstateGame: 'Could not reinstate game',
  keepGame: 'Could not keep game',
  releaseGame: 'Could not release game',
  unpublish: 'Could not unpublish schedule',
  unpublishAll: 'Could not unpublish schedules',
} as const;

export const SCHEDULE_REFUSAL = {
  /** A game write refused with no usable reason, or a server error. */
  gameFallback: 'The game was not changed. Try again.',
  /** A division write (unpublish, close registration) refused with no usable reason, or a server error. */
  divisionFallback: 'Nothing was changed. Try again.',
  /** "Unpublish all" sends one request per division, so it can partly succeed — then "Nothing was changed" is
   *  false. The window lists the divisions still published above this. */
  partialFallback: 'Try again.',
  /** The server's bare permission refusal ("Forbidden"): this person's role cannot change the schedule. */
  noPermission: 'Your role cannot change the schedule. Ask an organizer who can.',
} as const;

/**
 * What a refused write says: the server's own reason when it has one, otherwise our words. A server error's text is
 * never shown (it can be a raw database message), and the bare tokens `Forbidden` / `Unauthorized` are not reasons.
 */
export function refusalReason(
  status: number,
  error: unknown,
  fallback: string = SCHEDULE_REFUSAL.gameFallback,
): string {
  const text = typeof error === 'string' ? error.trim() : '';
  if (status === 403 && (!text || text === 'Forbidden')) return SCHEDULE_REFUSAL.noPermission;
  if (status >= 500 || !text || text === 'Unauthorized' || text === 'Forbidden') return fallback;
  return text;
}

/** Read a refused reply's reason (the body may not be JSON). */
export async function readRefusal(res: Response, fallback?: string): Promise<string> {
  const body = await res.json().catch(() => ({})) as { error?: unknown };
  return refusalReason(res.status, body?.error, fallback);
}

/**
 * The Publish window's reminder sentence (F73) — shown ONLY when `willScheduleGameDayReminder` says the publish
 * will schedule it (lib/schedule-publish-rules.ts, the route's own conditions).
 */
export const GAME_DAY_REMINDER_SENTENCE =
  'Each accepted team with a contact email also gets a game-day reminder the evening before its first game. If that time has already passed when you publish, that team gets none.';

// ── THE GAME WINDOW (Stage 3 build, Part 3 — S2, A35, A36; /marketing 2026-10-09) ───────────────────────────────

export const GAME_WINDOW_WORDS = {
  noun: 'game',
  /** The window's place in what the view shows: '3 of 12', and at a desk '3 of 12 · Today · Fri, Oct 9'. */
  position: (i: number, n: number) => `${i} of ${n}`,
  positionWide: (position: string, scope: string) => (scope ? `${position} · ${scope}` : position),
  editGame: 'Edit game',
  addGame: 'Add game',
  cancel: 'Cancel',
  sections: {
    whenWhere: 'When and where', score: 'Score', bracket: 'In the bracket', roundRobin: 'In the round robin',
    whoSees: 'Who sees it', game: 'The game',
  },
  facts: { when: 'When', length: 'Length', where: 'Where', pool: 'Pool' },
  fields: {
    division: 'Division', stage: 'Stage', day: 'Day', start: 'Start', length: 'Length', away: 'Away', home: 'Home',
    awaySlot: 'Away slot', homeSlot: 'Home slot', notes: 'Notes', notesPlaceholder: 'Optional', choose: 'Choose…',
    seeds: 'Seeds', winners: 'Winner of…', losers: 'Loser of…', teams: 'Teams',
  },
  noDate: 'No date yet',
  noPlace: 'No place yet',
  minutes: (n: number) => `${n} min`,
  /** The Length box's placeholder: what the game plays for when its own box is empty (A39's chain, said once). */
  inheritedLength: (by: 'division' | 'event', divisionName: string, n: number) =>
    by === 'division' ? `${possessive(divisionName)} ${n} min` : `The event's ${n} min`,
  score: {
    startsAt: (time: string) => `Starts at ${time}`,
    startedAt: (time: string) => `Started at ${time}`,
    notPlayed: 'Not played yet',
    notScored: 'Not scored yet',
  },
  doors: { enter: 'Enter the score', review: 'Review the score', edit: 'Edit the score', bracket: 'Edit the bracket' },
  undecided: 'Not decided yet',
  keep: 'Keep this game if you generate the round robin again',
  keepCaption: 'A new draft leaves a kept game where it is.',
  whoSees: {
    publishedAlerts: (division: string) => `${division} is published. Moving this game alerts both teams' followers, and a team linked to a Coaches Portal sees it on its own schedule.`,
    publishedNoAlerts: (division: string) => `${division} is published: a change shows on the public site and in the app straight away. Phone alerts to followers are on Tournament Plus, so on this plan nobody gets a notification.`,
    unpublished: (division: string) => `${division} isn't published, so only your staff can see this game. Nobody is told when it moves.`,
    /** A played game is never announced (`lib/schedule-change-classify.ts` drops it). */
    played: (division: string) => `${division} is published: this game and its result show on the public site and in the app. Changing a played game tells nobody.`,
    /** A cancelled game's move is not announced; putting it back on is (the route records a reinstatement). */
    cancelledAlerts: (division: string) => `${division} is published. Reinstating this game alerts both teams' followers.`,
  },
  editingNote: {
    alerts: (division: string) => `${division} is published. Change when or where, and ✓ asks before it tells both teams.`,
    noAlerts: (division: string) => `${division} is published. Change when or where, and ✓ asks before the public schedule changes.`,
  },
  cancelGame: 'Cancel game',
  reinstateGame: 'Reinstate game',
  deleteGame: 'Delete game',
  /** The quiet line under Venue: where a tournament venue came from (specimen 7). */
  venueSource: { library: "From the club's Venue library", tournament: 'Added in this tournament' },
  venueGroup: "This tournament's venues",
  /** The tournament's own refusal, red under the field (A37): "{Diamond 2} already has {the U11 final}, 4:00–5:15 p.m." */
  refusal: (field: string, other: string, range: string, noun: string) => ({
    // A range ending "p.m." already ends the sentence: one period, never two.
    lead: `${field} already has ${other}, ${range}${range.endsWith('.') ? '' : '.'}`,
    rest: ` Two games in this tournament can't share a ${noun}: change the time or the ${noun}.`,
  }),
  /** Two games whose TYPED places match: it saves, in the busy ink — a typed place isn't checked (A37). */
  typedOverlap: (field: string, other: string, range: string) => ({
    lead: `${field} also has ${other}, ${range}${range.endsWith('.') ? '' : '.'}`,
    rest: ' Both places are typed, so this isn’t refused: pick the venue to be sure.',
  }),
  /** A gap shorter than the event's buffer: it saves, in the busy ink. */
  buffer: (field: string, other: string, until: string, gap: number) => ({
    lead: `${field} has ${other} until ${until}`,
    rest: ` — less than the ${gap}-minute gap between games. You can still save.`,
  }),
  /** A playoff game named in another game's line ("the U11 final"). */
  playoffGame: (division: string, round: string) => `the ${division} ${round.toLowerCase()}`,
  vs: (away: string, home: string) => `${away} vs ${home}`,
  /** The save word while the red line under the field holds a value. */
  held: {
    refused: (noun: string) => `Not saved: that ${noun} is taken then`,
  },
  /** The published-game question (A36) — at ✓ in the window, before a drop or the phone's Move. */
  move: {
    title: 'Move a published game?',
    farBody: (away: string, home: string) => `Followers of ${away} and ${home} get one alert once you've made no changes for 10 minutes, and a team linked to a Coaches Portal sees the move on its own schedule. Undo it before then and nobody is told.`,
    nearBody: (away: string, home: string) => `This game starts within 6 hours, so followers of ${away} and ${home} are alerted in the next few minutes. If you undo it first, nobody is told; if the alert has gone, they're told it's back where it was.`,
    noAlertsBody: 'The new time shows on the public site and in the app straight away, and a team linked to a Coaches Portal sees it on its own schedule. Phone alerts are on Tournament Plus, so nobody gets a notification.',
    stay: "Don't move",
    go: 'Move it',
  },
} as const;

// ── MOVING A GAME (Stage 3 build, Part 4 — S4, A36; /marketing 2026-10-09) ────────────────────────────────────

export const MOVE_WORDS = {
  /** After every move, with Undo: "Moved to 5:30 p.m. · Diamond 3" — the day too when it changed. */
  moved: (when: string, where: string) => `Moved to ${[when, where].filter(Boolean).join(' · ')}`,
  /** After Undo (no action): "Put back at 5:00 p.m. · Diamond 4"; another day, "Put back on Sat, Oct 10, 5:00 p.m. …". */
  putBack: (when: string, where: string, otherDay: boolean) => `Put back ${otherDay ? 'on' : 'at'} ${[when, where].filter(Boolean).join(' · ')}`,
  cancelled: 'Game cancelled',
  backOn: 'Game back on',
  undo: 'Undo',
  /** The timeline's red band under a refused drop: "Diamond 2 has the U11 final until 5:15 p.m. — can't drop here". */
  dropRefused: (field: string, other: string, until: string) => `${field} has ${other} until ${until} — can't drop here`,
  /** The phone's move sheet: its lime names who it tells (a published game on a plan with alerts). */
  move: 'Move',
  moveTells: 'Move · tells both teams',
  sheetCaption: (division: string, stage: string, when: string, where: string) =>
    [division, stage, when ? `now ${when}` : '', where].filter(Boolean).join(' · '),
  nextFree: (time: string) => `Use the next free time, ${time}`,
} as const;

/** A bracket slot's words in the admin — the ONE slot wording (owner 2026-07-17: "Semifinal 1 winner"), with a seed
 *  read as "Seed 1" (the stored "Seed #1" is the standings' key and never changes). */
export function slotWords(placeholder: string | null | undefined): string {
  const p = (placeholder ?? '').trim();
  if (!p) return '';
  const seed = /^Seed #(\d+)$/.exec(p);
  return seed ? `Seed ${seed[1]}` : fanSlotLabel(p);
}
