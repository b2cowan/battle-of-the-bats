/**
 * league-game-generator.ts — GENERATE GAMES, the match-ups (House League Stage 9d-2a; rulings 9d2·3 + the owner's amendment,
 * plan HOUSE_LEAGUE_STAGE9_PLAN.md §0h; frames c1–c4, drawings TdXm5jmTEJ9qPvR3T5H9qU v4; words HOUSE_LEAGUE_STAGE9D2_11B_COPY.md
 * "Stage 9d-2a"). Client-safe, pure: the window plans as its choice changes, and the route plans AGAIN on the server from its
 * own read before it writes (it never trusts the client's games).
 *
 * ⚖ MATCH-UPS ONLY (9d2·3, amended): the input is the division's GAME TIME — the house-league slots a league admin gave it in
 * House league's time (`league_slot_uses` kind `games`, lib/league-time-server.ts). The generator never picks a day, a time
 * or a place the club did not allocate. It replaced a generator that took one start date, one clock and one field and put a
 * whole round on it — a second model of the club's time, which the club's schedule forbids.
 *
 * The plan:
 *   1. every team plays every other team once, or twice (the second time with home and away swapped) — the circle method,
 *      so with an odd number of teams one team sits out each round and no team sits out two rounds running;
 *   2. home and away balanced: through once, each pairing goes to the team with fewer home games so far (then the one that
 *      was away last), so every team's home count is within one of every other's; through twice, each pairing is played
 *      once at each end;
 *   3. ONE GAME PER SLOT, in the slots' order: a slot is one facility at one time (game length = the slot's, 9d2·3). The
 *      rounds fill the earliest slots, so time to spare is the season's end left open. Within a round, each slot takes the
 *      game whose teams have had that slot's TIME (weekday and clock) least, so a rarer time — Saturday mornings — is
 *      shared out evenly ("Every team gets 2 Saturday mornings");
 *   4. never a team twice in a day, and never in two slots that overlap. When the slots leave no other way, twice in a day
 *      is used and WARNED (the rule "twice in a day allowed" is no, 9d2·4); an overlap never is.
 * Blocks: fewer than two teams; more games than slots ("90 games need 90 slots"); games that will not fit.
 * Warns here: a team twice in a day, a team with byes two weeks running. The route adds the two the club's records answer:
 * outside the club's permit, and a booking at the place that the club's schedule does not hold.
 */
import { formatStoredDate, mondayOfDay } from './timezone.ts';
import { pluralize, possessive } from './utils.ts';
import { dayWords } from './calendar-recipe.ts';
import { weekdayOne } from './permit-words.ts';

/** One slot of a division's game time, its club day and clock already worked out in the club's zone. */
export interface GameTimeSlot {
  id: string;
  /** The club day (YYYY-MM-DD) and its weekday, 1 = Monday. */
  day: string;
  weekday: number;
  /** "18:00" on the club's clock. */
  start: string;
  end: string;
  /** The slot's instants (ISO): a game takes them whole. */
  startsAt: string;
  endsAt: string;
  /** The facility's name (the venue's when the slot is the venue itself), and its identity. */
  place: string;
  placeKey: string;
  venueId: string;
  facilityId: string | null;
}

export interface GameTeam { id: string; name: string }

/** Once or twice through (frame c2's dropdown). */
export type Through = 1 | 2;

/** One game the plan places: its slot, its teams, its round (1-based, across both times through). */
export interface PlannedGame {
  slotId: string;
  homeTeamId: string;
  awayTeamId: string;
  scheduledAt: string;
  endsAt: string;
  round: number;
}

export type PlanWarning =
  | { kind: 'twice_in_a_day'; teamId: string; day: string }
  | { kind: 'byes_back_to_back'; teamId: string; weeks: [string, string] };

export type PlanBlock =
  | { kind: 'teams' }
  /** More games than slots: nothing is placed. `lastDay` is the game time's last day ("has 65 by Aug 31"). */
  | { kind: 'short'; needed: number; have: number; lastDay: string | null }
  /** Enough slots, but the teams' days leave some games nowhere to go: `placed` of `needed` fit. */
  | { kind: 'crowded'; needed: number; placed: number };

/** The time a slot is (weekday and clock, any facility): what "Saturday mornings" shares out. */
export interface SlotTime { weekday: number; start: string }

export interface GamePlan {
  /** Empty when blocked. */
  games: PlannedGame[];
  block: PlanBlock | null;
  warnings: PlanWarning[];
  /** Games the choice makes, and the slots there are. */
  needed: number;
  slotCount: number;
  /** Games each team plays (every team plays the same number). */
  gamesEach: number;
  /** The fewest and most home games any team has. */
  home: { min: number; max: number };
  /** One team sits out each round (an odd number of teams). */
  byes: boolean;
  /** The placed games' first and last club days, and the weeks between them (inclusive). */
  firstDay: string | null;
  lastDay: string | null;
  weeks: number;
  /**
   * The rarest time the games use (the thing worth sharing out — "Saturday mornings"): its weekday and earliest clock and the
   * fewest and most of it any team gets, a time being a weekday and its part of the day. Null when the games use one only.
   */
  share: (SlotTime & { min: number; max: number }) | null;
}

const BYE = '__bye';
const byName = (a: string, b: string) => a.localeCompare(b, 'en-CA', { numeric: true });
const timeKey = (s: Pick<GameTimeSlot, 'weekday' | 'start'>) => `${s.weekday}|${s.start}`;

/** The circle method: rounds of [a, b] pairings, every team meeting every other once; a bye's pairing is left out. */
export function roundRobinRounds(teamIds: readonly string[]): [string, string][][] {
  if (teamIds.length < 2) return [];
  const teams = teamIds.length % 2 === 0 ? [...teamIds] : [...teamIds, BYE];
  const n = teams.length;
  const fixed = teams[0];
  const rotating = teams.slice(1);
  const rounds: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: [string, string][] = [];
    const opp = rotating[r % rotating.length];
    // The fixed team alternates ends round by round (it would otherwise be "home" all season).
    if (fixed !== BYE && opp !== BYE) pairs.push(r % 2 === 0 ? [fixed, opp] : [opp, fixed]);
    for (let i = 1; i < n / 2; i++) {
      const a = rotating[(r - i + rotating.length) % rotating.length];
      const b = rotating[(r + i) % rotating.length];
      if (a !== BYE && b !== BYE) pairs.push([a, b]);
    }
    rounds.push(pairs);
  }
  return rounds;
}

/**
 * Home and away for one time through, every team within one home game of every other (a greedy "fewer so far hosts" left
 * 9 teams at 3 to 5). The teams sit in a ring of an odd size m (the last team stands aside when the count is even): each
 * hosts the next (m − 1) / 2 round the ring, so each hosts exactly (m − 1) / 2. The team aside hosts every other ring team
 * from the first, so it and the ring's teams end on n / 2 − 1 or n / 2.
 */
function balanceEnds(rounds: [string, string][][], teamIds: readonly string[]): [string, string][][] {
  const index = new Map(teamIds.map((id, i) => [id, i]));
  const m = teamIds.length % 2 === 1 ? teamIds.length : teamIds.length - 1;
  const hosts = (a: number, b: number) => {
    if (a === m) return b % 2 === 0;
    if (b === m) return a % 2 === 1;
    return (b - a + m) % m <= (m - 1) / 2;
  };
  return rounds.map(pairs => pairs.map(([a, b]) => (hosts(index.get(a)!, index.get(b)!) ? [a, b] : [b, a]) as [string, string]));
}

/** A game as the two team checks read it: its teams and its club day. */
export interface DatedGame { homeTeamId: string; awayTeamId: string; day: string }

/** A team on twice in one day: once per team and day. (The generator and Schedule health ask the same question.) */
export function twiceInADay(teamIds: readonly string[], games: readonly DatedGame[]): Extract<PlanWarning, { kind: 'twice_in_a_day' }>[] {
  const count = new Map<string, number>();
  for (const g of games) for (const t of [g.homeTeamId, g.awayTeamId]) count.set(`${t}|${g.day}`, (count.get(`${t}|${g.day}`) ?? 0) + 1);
  const days = [...new Set(games.map(g => g.day))].sort();
  return teamIds.flatMap(t => days.filter(d => (count.get(`${t}|${d}`) ?? 0) > 1).map(day => ({ kind: 'twice_in_a_day' as const, teamId: t, day })));
}

/**
 * Byes two weeks running: a bye is a week with the division's games that a team has none of; two such weeks one after the
 * other (of the weeks with games) is said once per team, with the two weeks' Mondays.
 */
export function byesBackToBack(teamIds: readonly string[], games: readonly DatedGame[]): Extract<PlanWarning, { kind: 'byes_back_to_back' }>[] {
  const weeks = [...new Set(games.map(g => mondayOfDay(g.day)))].sort();
  const plays = new Set(games.flatMap(g => { const w = mondayOfDay(g.day); return [`${g.homeTeamId}|${w}`, `${g.awayTeamId}|${w}`]; }));
  const out: Extract<PlanWarning, { kind: 'byes_back_to_back' }>[] = [];
  for (const t of teamIds) {
    for (let i = 1; i < weeks.length; i++) {
      if (!plays.has(`${t}|${weeks[i - 1]}`) && !plays.has(`${t}|${weeks[i]}`)) {
        out.push({ kind: 'byes_back_to_back', teamId: t, weeks: [weeks[i - 1], weeks[i]] });
        break;
      }
    }
  }
  return out;
}

const minutesOf = (clock: string) => {
  const [h, m] = clock.split(':').map(Number);
  return h * 60 + (m || 0);
};
const overlaps = (a: GameTimeSlot, b: GameTimeSlot) => Date.parse(a.startsAt) < Date.parse(b.endsAt) && Date.parse(b.startsAt) < Date.parse(a.endsAt);

/** THE PLAN: a division's games over its game time (the header says how). */
export function planGames(p: { slots: readonly GameTimeSlot[]; teams: readonly GameTeam[]; through: Through }): GamePlan {
  const teams = [...p.teams].sort((a, b) => byName(a.name, b.name) || a.id.localeCompare(b.id));
  const slots = [...p.slots].sort((a, b) => a.startsAt.localeCompare(b.startsAt) || byName(a.place, b.place) || a.id.localeCompare(b.id));
  const once = balanceEnds(roundRobinRounds(teams.map(t => t.id)), teams.map(t => t.id));
  const rounds = p.through === 2 ? [...once, ...once.map(r => r.map(([h, a]) => [a, h] as [string, string]))] : once;
  const needed = rounds.reduce((n, r) => n + r.length, 0);
  const gamesEach = teams.length >= 2 ? (teams.length - 1) * p.through : 0;
  const empty: Omit<GamePlan, 'block'> = {
    games: [], warnings: [], needed, slotCount: slots.length, gamesEach, home: { min: 0, max: 0 },
    byes: teams.length % 2 === 1, firstDay: null, lastDay: null, weeks: 0, share: null,
  };
  if (teams.length < 2) return { ...empty, block: { kind: 'teams' } };
  if (needed > slots.length) {
    return { ...empty, block: { kind: 'short', needed, have: slots.length, lastDay: slots.length ? slots[slots.length - 1].day : null } };
  }

  const used = new Set<string>();
  const onDay = new Map<string, GameTimeSlot[]>(); // `${teamId}|${day}` → the team's slots that day
  const timeCount = new Map<string, number>(); // `${teamId}|${weekday}|${start}` → games at that time
  const games: PlannedGame[] = [];
  const warnings: PlanWarning[] = [];
  /** How many slots of each time the game time holds: the rarer a time, the earlier it is shared out in a round. */
  const slotsOfTime = new Map<string, number>();
  for (const s of slots) slotsOfTime.set(timeKey(s), (slotsOfTime.get(timeKey(s)) ?? 0) + 1);
  const shareOf = (pair: readonly string[], slot: GameTimeSlot) =>
    pair.reduce((n, t) => n + (timeCount.get(`${t}|${timeKey(slot)}`) ?? 0), 0);

  type Pick = { slot: GameTimeSlot; pair: [string, string] };
  /** A team's slots on a day: the ones placed already, and the round's picks so far. */
  const dayOf = (picks: readonly Pick[], teamId: string, day: string) => [
    ...(onDay.get(`${teamId}|${day}`) ?? []),
    ...picks.filter(p => p.slot.day === day && p.pair.includes(teamId)).map(p => p.slot),
  ];
  const free = (picks: readonly Pick[], teamId: string, slot: GameTimeSlot, twice: boolean) => {
    const mine = dayOf(picks, teamId, slot.day);
    return twice ? !mine.some(s => overlaps(s, slot)) : mine.length === 0;
  };
  const fitsIn = (picks: readonly Pick[], pair: [string, string], slot: GameTimeSlot, twice: boolean) =>
    free(picks, pair[0], slot, twice) && free(picks, pair[1], slot, twice);

  rounds.forEach((pairs, r) => {
    // 1. The round's slots: the earliest free ones, each with a game whose teams are free that day; then, only where the
    //    slots leave no other way, twice in a day (never two slots at once).
    const first: Pick[] = [];
    let left = [...pairs];
    let twiced = false;
    for (const twice of [false, true]) {
      for (const slot of slots) {
        if (!left.length) break;
        if (used.has(slot.id) || first.some(p => p.slot.id === slot.id)) continue;
        const pair = left.find(g => fitsIn(first, g, slot, twice));
        if (!pair) continue;
        first.push({ slot, pair });
        left = left.filter(g => g !== pair);
        if (twice) twiced = true;
      }
    }
    // 2. Share the round's times out: its rarest time first, each to the game whose teams have had it least. Kept only
    //    when every game still finds a slot that way (and never when step 1 needed twice in a day).
    let picks = first;
    if (!twiced) {
      const bySpread = [...first.map(p => p.slot)].sort((a, b) =>
        slotsOfTime.get(timeKey(a))! - slotsOfTime.get(timeKey(b))! || a.startsAt.localeCompare(b.startsAt));
      const shared: Pick[] = [];
      let rest = first.map(p => p.pair);
      for (const slot of bySpread) {
        const fits = rest.filter(g => fitsIn(shared, g, slot, false));
        if (!fits.length) break;
        const pair = fits.reduce((best, g) => (shareOf(g, slot) < shareOf(best, slot) ? g : best));
        shared.push({ slot, pair });
        rest = rest.filter(g => g !== pair);
      }
      if (shared.length === first.length) picks = shared;
    }
    for (const { slot, pair } of picks) {
      used.add(slot.id);
      for (const t of pair) {
        const k = `${t}|${slot.day}`;
        onDay.set(k, [...(onDay.get(k) ?? []), slot]);
        const tk = `${t}|${timeKey(slot)}`;
        timeCount.set(tk, (timeCount.get(tk) ?? 0) + 1);
      }
      games.push({ slotId: slot.id, homeTeamId: pair[0], awayTeamId: pair[1], scheduledAt: slot.startsAt, endsAt: slot.endsAt, round: r + 1 });
    }
  });
  if (games.length < needed) return { ...empty, block: { kind: 'crowded', needed, placed: games.length } };

  games.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.slotId.localeCompare(b.slotId));
  const slotOf = new Map(slots.map(s => [s.id, s]));
  const days = games.map(g => slotOf.get(g.slotId)!.day);
  const firstDay = days[0], lastDay = days[days.length - 1];
  const weeks = Math.round((Date.parse(`${mondayOfDay(lastDay)}T00:00:00Z`) - Date.parse(`${mondayOfDay(firstDay)}T00:00:00Z`)) / (7 * 86_400_000)) + 1;

  const homeCount = new Map(teams.map(t => [t.id, 0]));
  for (const g of games) homeCount.set(g.homeTeamId, homeCount.get(g.homeTeamId)! + 1);
  const homeCounts = [...homeCount.values()];

  const dated = games.map(g => ({ homeTeamId: g.homeTeamId, awayTeamId: g.awayTeamId, day: slotOf.get(g.slotId)!.day }));
  const teamIds = teams.map(t => t.id);
  warnings.push(...twiceInADay(teamIds, dated), ...byesBackToBack(teamIds, dated));

  const r = rarestTimeShare(games.map(g => ({ homeTeamId: g.homeTeamId, awayTeamId: g.awayTeamId, ...slotOf.get(g.slotId)! })), teamIds);
  const share: GamePlan['share'] = r && { weekday: r.time.weekday, start: r.time.start, min: Math.min(...r.counts), max: Math.max(...r.counts) };

  return {
    games, block: null, warnings, needed, slotCount: slots.length, gamesEach,
    home: { min: Math.min(...homeCounts), max: Math.max(...homeCounts) },
    byes: teams.length % 2 === 1, firstDay, lastDay, weeks, share,
  };
}

/**
 * The rarest time a set of games uses, counted as it is SAID — a weekday and its part of the day ("Saturday mornings"), so two
 * Sunday-morning clocks are one time and games that are all Sunday mornings share nothing out (step 5's probe) — and how many of
 * those games each of `teamIds` plays, in that order. null when the games use fewer than two times: there is nothing to share.
 */
export function rarestTimeShare(
  games: { homeTeamId: string; awayTeamId: string; weekday: number; start: string }[], teamIds: string[],
): { time: SlotTime; counts: number[] } | null {
  const said = (s: SlotTime) => `${s.weekday}|${partOfDay(s.start)}`;
  const used = new Map<string, SlotTime & { games: number }>();
  const perTeam = new Map<string, number>(); // `${teamId}|${said}` → games at that time
  for (const g of games) {
    const k = said(g);
    const was = used.get(k) ?? { weekday: g.weekday, start: g.start, games: 0 };
    was.games += 1;
    if (minutesOf(g.start) < minutesOf(was.start)) was.start = g.start;
    used.set(k, was);
    for (const t of [g.homeTeamId, g.awayTeamId]) perTeam.set(`${t}|${k}`, (perTeam.get(`${t}|${k}`) ?? 0) + 1);
  }
  if (used.size < 2) return null;
  const rarest = [...used.values()].sort((a, b) => a.games - b.games || a.weekday - b.weekday || minutesOf(a.start) - minutesOf(b.start))[0];
  return { time: { weekday: rarest.weekday, start: rarest.start }, counts: teamIds.map(t => perTeam.get(`${t}|${said(rarest)}`) ?? 0) };
}

// ── THE WINDOW AND THE ROUTE (9d-2a step 5, frames c1–c4, k3, k4) ────────────────────────────────────────────────────

/** The part of a day a clock starts in. */
export const partOfDay = (clock: string) => (minutesOf(clock) < 12 * 60 ? 'morning' : minutesOf(clock) < 17 * 60 ? 'afternoon' : 'evening');

/** The rarest time, said: "Saturday mornings" (one: "Saturday morning"). */
export const primeTimeWords = (t: SlotTime, n = 2) =>
  `${weekdayOne(t.weekday)} ${partOfDay(t.start)}${n === 1 ? '' : 's'}`;

/** A plan as the window reads it (its games stay on the server until the check). */
export type PlanSummary = Omit<GamePlan, 'games' | 'warnings'> & { placed: number };
export function summaryOf(p: GamePlan): PlanSummary {
  return {
    block: p.block, needed: p.needed, slotCount: p.slotCount, gamesEach: p.gamesEach, home: p.home, byes: p.byes,
    firstDay: p.firstDay, lastDay: p.lastDay, weeks: p.weeks, share: p.share, placed: p.games.length,
  };
}

/** Step 2's read (`step: 'plan'`): both choices, so the dropdown's counts and the hints are exact as it changes. */
export interface GeneratePlanReply {
  once: PlanSummary;
  twice: PlanSummary;
  /** Every game slot's length in minutes, or null when they differ (the foot then says "the length of its slot"). */
  slotMinutes: number | null;
}

/** One thing to look at (c3's warning state): the plan's own two, and the two the club's records answer. */
export type GenerateWarning =
  | PlanWarning
  /** `permitId`: the permit the line is about, for "See the permit" (step 7); null when it is about several. */
  | { kind: 'permit'; venue: string; line: string; permitId: string | null }
  | { kind: 'booking'; place: string; other: string }
  /** The club's records could not be read, so the check could not look: it says so rather than reading clean. */
  | { kind: 'unread'; what: 'permit' | 'schedule' };

/** A game as "See the games" lists it. */
export interface CheckedGame { homeTeamId: string; awayTeamId: string; scheduledAt: string; endsAt: string; place: string }

/** The check's answer (`step: 'check'`). Blocked: no games, no warnings. */
export interface GenerateCheckReply {
  plan: PlanSummary;
  games: CheckedGame[];
  warnings: GenerateWarning[];
  /** The planned games' Schedule health (lib/league-schedule-health.ts), or null when blocked. */
  health: number | null;
  /** What the check showed, as one short key (`planFingerprint`): Save sends it back and refuses when the plan it re-works is not that one. */
  fingerprint: string;
}

/**
 * A plan as one short key — each game's slot, teams and time, in order — so Save can tell whether the plan it re-works is the one
 * the check showed. The slots alone would miss a team renamed, added or removed (the pairings shift) or a slot moved under the
 * same id. Not a secret: a stale-screen guard, so a plain 32-bit hash is enough.
 */
export function planFingerprint(games: readonly Pick<PlannedGame, 'slotId' | 'homeTeamId' | 'awayTeamId' | 'scheduledAt' | 'endsAt'>[]): string {
  let h = 0x811c9dc5;
  for (const ch of games.map(g => `${g.slotId}|${g.homeTeamId}|${g.awayTeamId}|${g.scheduledAt}|${g.endsAt}`).join(';')) {
    h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  }
  return `${games.length}-${h.toString(16)}`;
}

/** Save's answer (`step: 'save'`): the count, and the permit's lines for the games outside it (the shipped after-save). */
export interface GenerateSaveReply { saved: number; permitLines: string[] }

/** The step-2 hint's sentences, each only when it applies (the copy file's "Step 2 hint"). */
export function matchupHints(teams: number, plan: PlanSummary): string[] {
  const out = [teams % 2 === 0 ? GENERATE_WORDS.noByes(teams) : GENERATE_WORDS.byes(teams)];
  if (plan.block) return out;
  out.push(GENERATE_WORDS.homeBalanced(plan.home.min, plan.home.max));
  if (plan.share && plan.share.max - plan.share.min <= 1) out.push(GENERATE_WORDS.shared(primeTimeWords(plan.share)));
  return out;
}

/** A warning, said. `team` names a team by id. */
export function warningWords(w: GenerateWarning, division: string, team: (id: string) => string): string {
  switch (w.kind) {
    case 'twice_in_a_day': return GENERATE_WORDS.warnTwice(team(w.teamId), dayWords(w.day));
    case 'byes_back_to_back':
      return GENERATE_WORDS.warnByes(team(w.teamId), formatStoredDate(w.weeks[0], { withYear: false }), formatStoredDate(w.weeks[1], { withYear: false }));
    case 'permit': return GENERATE_WORDS.warnPermit(division, w.venue);
    case 'booking': return GENERATE_WORDS.warnBooking(division, w.place, w.other);
    case 'unread': return w.what === 'permit' ? GENERATE_WORDS.warnPermitUnread : GENERATE_WORDS.warnScheduleUnread;
  }
}

/** "Jun 1 – Aug 7" (the year once, at the end, when `withYear`). */
export function spanWords(first: string, last: string, withYear = false): string {
  const b = formatStoredDate(last, { withYear });
  return first === last ? b : `${formatStoredDate(first, { withYear: false })} – ${b}`;
}

/**
 * Words. Settled: HOUSE_LEAGUE_STAGE9D2_11B_COPY.md "Generate games, step 1", "When there is nothing to give (k4)" and
 * "Stage 9d-2a" c. [build] marks a word the build chose where nothing was settled.
 */
export const GENERATE_WORDS = {
  eyebrow: (season: string, step: 1 | 2) => `${season} · step ${step} of 2`,
  checkedEyebrow: (season: string) => `${season} · checked`,
  titleTime: 'Generate games: when and where',
  titleMatchups: 'Generate games: match-ups',
  division: 'Division',
  teams: (n: number) => pluralize(n, 'team'),
  // Step 1 (c1)
  gameTime: (division: string) => `${possessive(division)} game time · from house league’s time`,
  gamesAWeek: (n: number) => `${pluralize(n, 'game')} a week`,
  /** [build] the drawn "65 game slots in all", after the source's dates. */
  slotsInAll: (dates: string, n: number) => `${dates} · ${pluralize(n, 'game slot')} in all.`,
  changeIt: 'Change it in House league’s time',
  eachGame: (minutes: number) => `Each game is ${minutes} minutes, the length of a slot.`,
  /** [build] slots of different lengths. */
  eachGameMixed: 'Each game is the length of its slot.',
  next: 'Next: match-ups',
  cancel: 'Cancel',
  back: 'Back',
  close: 'Close',
  // Step 1 with no game time (k3)
  noTime: (division: string) => `${division} has no game time yet. Give it some of house league’s time.`,
  notGiven: 'Not given yet',
  slots: (n: number) => pluralize(n, 'slot'),
  notOffered: 'Time already given to a division isn’t offered. Need only part of it, such as one facility? ',
  divideFirst: 'Divide it in House league’s time first',
  givenFoot: (division: string) => `Given to ${division} as its game time. The rest stays not given.`,
  giving: 'Giving…',
  // Nothing to give (k4); the club's own sentences are LEAGUE_TIME_WORDS'.
  noneLeftLeagueAdmin: 'House league has no time left to give. An owner or an admin gives house league its time, in Schedules.',
  takeBack: 'Take time back from another division',
  noneLeftClubHint: 'Give it more from one of the club’s permits, then come back here.',
  nothingSaved: 'Nothing is saved.',
  // Step 2 (c2)
  everyTeam: (division: string) => `${division} · every team plays every other team`,
  once: 'Once',
  twice: 'Twice',
  counts: (each: number, total: number) => `${pluralize(each, 'game')} each · ${pluralize(total, 'game')}`,
  noByes: (teams: number) => `${teams} teams: no byes.`,
  byes: (teams: number) => `${teams} teams: one team has a bye each week, never two weeks running.`,
  homeBalanced: (a: number, b: number) =>
    `Home and away are balanced for you: ${a === b ? pluralize(a, 'home game') : `${a} or ${pluralize(b, 'home game')}`} each.`,
  shared: (prime: string) => `${prime} are shared out evenly.`,
  stepFoot: (n: number, slots: number, span: string) => `${pluralize(n, 'game')} in ${pluralize(slots, 'slot')}, ${span}. Nothing is saved yet.`,
  /** [build] a choice that doesn't fit: no span (the check says why). */
  stepFootBlocked: 'Nothing is saved yet.',
  check: 'Check the games',
  checking: 'Checking…',
  checkFailed: 'The check didn’t finish. Your choices are kept.',
  tryAgain: 'Try again',
  // The check, passing (c3)
  ready: (n: number) => `Ready to save: ${pluralize(n, 'game')}`,
  span: (span: string, weeks: number) => `${span} · ${pluralize(weeks, 'week')}`,
  everyTeamPlays: (games: number, a: number, b: number) => `Every team plays ${pluralize(games, 'game')}, ${a === b ? a : `${a} or ${b}`} at home.`,
  everyTeamGets: (min: number, max: number, t: SlotTime) =>
    `Every team gets ${min === max ? min : `${min} or ${max}`} ${primeTimeWords(t, max)}.`,
  health: (score: number) => `Schedule health ${score}.`,
  seeGames: (n: number) => `See the ${pluralize(n, 'game')}`,
  /** 9d-2b: only a draft division generates (9d2·11), so a Save goes into the draft. */
  passFoot: (n: number, division: string) =>
    `Saving puts ${n === 1 ? 'this game' : `these ${n} games`} in ${possessive(division)} draft. Nobody sees them until you publish.`,
  save: (n: number) => `Save ${pluralize(n, 'game')}`,
  saving: 'Saving…',
  saved: (n: number) => `Saved ${pluralize(n, 'game')} as a draft. Publish when you’re ready.`,
  // The check, warning
  warnTitle: (n: number, k: number) => `${pluralize(n, 'game')}, with ${pluralize(k, 'thing')} to look at`,
  warnPermit: (division: string, venue: string) => `${possessive(division)} game time is outside the club’s permit for ${venue}.`,
  /** Ends once: the booking's clock already ends in "a.m." or "p.m.". */
  warnBooking: (division: string, place: string, other: string) =>
    `${possessive(division)} game time overlaps a booking at ${place}: ${other}${other.endsWith('.') ? '' : '.'}`,
  /** [marketing] drafts: the check could not read the club's records, so it says it did not look (never "passes"). */
  warnPermitUnread: 'We couldn’t check the club’s permit just now, so this game time may be outside it.',
  warnScheduleUnread: 'We couldn’t check the club’s schedule just now, so this game time may overlap another booking.',
  warnTwice: (team: string, day: string) => `${team} plays twice on ${day}.`,
  warnByes: (team: string, a: string, b: string) => `${team} has a bye two weeks running, ${a} and ${b}.`,
  elsePasses: 'Everything else passes',
  warnFoot: 'You can save now and sort it out later.',
  // The check, blocking
  blockTitle: (division: string) => `This doesn’t fit ${possessive(division)} time`,
  blockShort: (n: number, division: string, have: number, last: string | null) =>
    `${pluralize(n, 'game')} ${n === 1 ? 'needs' : 'need'} ${pluralize(n, 'slot')}. ${possessive(division)} game time has ${have}${last ? ` by ${last}` : ''}.`,
  /** [build] enough slots, but a team would be in two places at once. */
  blockCrowded: (placed: number, n: number) => `Only ${placed} of the ${n} games fit without a team playing two games at once.`,
  /** [build] fewer than two teams (a division like that isn't listed; this is a race). */
  blockTeams: (division: string) => `${division} needs at least 2 teams.`,
  blockHint: (division: string, twice: boolean) => `Give ${division} more time${twice ? ', or play every team once' : ''}.`,
  giveMoreTime: (division: string) => `Give ${division} more time`,
  // Refusals and the division list
  /** [build] Save found the game time changed since the check. */
  changed: (division: string) => `${possessive(division)} game time changed while you were looking. Check the games again.`,
  /** [build] the division got games since the window opened (another tab, another admin). */
  hasGames: (division: string) => `${division} has games now. Add more one at a time, with Add.`,
  noneLeft: 'Every division already has games. Add more one at a time, with Add.',
  failed: 'That didn’t save. Try again.',
} as const;
