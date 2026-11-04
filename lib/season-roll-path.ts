/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT IS THE TEAM DOING NEXT SEASON? — the season window's question, its rules and its words
 * (Club Tier Stage 14a; drawn and ruled 2026-11-04, Asks 1–3, all A; the two paths ruled 2026-10-22).
 *
 * *Start next season* used to do both things at once: it always carried the active roster AND always
 * moved the birth years one year later — right for neither the coach who keeps their kids nor the club
 * slot that takes a new cohort. The window now asks, with NOTHING chosen when it opens:
 *
 *   (a) `moving_up` — "The same players, moving up an age group". The players come (a tick list:
 *       active ticked, inactive unticked at the bottom, call-ups never listed); the birth years STAY;
 *       the division moves up in an editable box only when it starts with an age (11U → 12U, U11 → U12).
 *       ⚠ The team's NAME is never changed for them — it is part of the team's public web address.
 *   (b) `new_group` — "A new group of players, same age group". No players by default (one box brings
 *       last season's active players anyway); the birth years move one year later, as every roll did.
 *
 * ⚠ BOTH PORTALS SAY THESE WORDS — the standalone coach's window and the club's copy of it. Nothing here
 * formats a birth-year line by hand: `bornMeta` in `lib/born-years.ts` is the one rule.
 * ⚠ PURE AND CLIENT-SAFE: the rollover module imports `server-only`, so anything decided there is
 * untestable (the lesson `lib/season-carry.ts` records). Pinned by `tests/unit/season-roll-path.test.ts`.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { bornMeta, rollBornYears, type BornYears, type Cutoff } from './born-years';
import { joinWithAnd, pluralize } from './utils';

export type SeasonRollPath = 'moving_up' | 'new_group';

/**
 * ⏳ THE PAST-PLAYER PICKER IS STAGE 14 SESSION 3. The ruled words point a coach at it ("Bring Jonah back
 * from Roster any time"); until it exists those clauses would promise a door that is not there, so each one
 * reads this switch and the window says only what is true today. S3 flips it to `true` in the same change
 * that ships the picker — and nothing else should need to change.
 */
export const PAST_PLAYER_PICKER_BUILT = false;

/** A division is at most 30 characters (the coach's Team settings refuse more; the window refuses the same). */
export const DIVISION_MAX = 30;

function isRollPath(v: unknown): v is SeasonRollPath {
  return v === 'moving_up' || v === 'new_group';
}

/** What the seasons preflight answers for the window — the facts; every word is this module's. One type for the
 *  server's `seasonWindowFacts` and both windows, so the three cannot drift. */
export interface SeasonWindowFacts {
  players: RollPlayer[];
  division: string | null;
  born: BornYears;
  cutoff: Cutoff;
}

// ── The age group moves up ─────────────────────────────────────────────────────────────────────

/**
 * The division one age group up, or null when it does not START with an age (Ask 3). An age is one or two
 * digits: "11U AAA" → "12U AAA", "U11" → "U12", "U-11 Girls" → "U-12 Girls", "11 and under" → "12 and under".
 * "Mosquito", "AAA", "2015 Birth Year", a bare "11" and an empty box all answer null — the window then shows
 * the old division for the person to retype, rather than guess.
 */
export function nextAgeDivision(division: string | null | undefined): string | null {
  const d = (division ?? '').trim();
  if (!d) return null;
  const up = (n: string) => String(Number(n) + 1);
  let m = /^(U-?)(\d{1,2})(?!\d)/i.exec(d);
  if (m) return `${m[1]}${up(m[2])}${d.slice(m[0].length)}`;
  m = /^(\d{1,2})(U)(?![a-z0-9])/i.exec(d);
  if (m) return `${up(m[1])}${m[2]}${d.slice(m[0].length)}`;
  m = /^(\d{1,2})(?=\s+(?:and|&)\s+under\b)/i.exec(d);
  if (m) return `${up(m[1])}${d.slice(m[0].length)}`;
  return null;
}

/** What the Division box opens with on path (a): the age group up, else the division as it is. */
export function divisionForMovingUp(division: string | null | undefined): string {
  return nextAgeDivision(division) ?? (division ?? '').trim();
}

/** Under the Division box. */
export function divisionHint(division: string | null | undefined): string {
  const from = (division ?? '').trim();
  return nextAgeDivision(from)
    ? `Moved up from ${from}. Change it if your league names it differently.`
    : 'Change it if the team’s division has a new name next season.';
}

// ── The season, named ──────────────────────────────────────────────────────────────────────────

/**
 * "the 2026 Season", "the Fall 2026 season". A season's name is the club's own data — "2026 Season" already
 * says season, so the word is added only when the name does not end with it. This is the fix for the window's
 * first line, which read "This closes the 2026 Season season."
 */
export function theSeason(name: string): string {
  const n = String(name ?? '').trim();
  return /\bseason$/i.test(n) ? `the ${n}` : `the ${n} season`;
}

/** The coach window's first line — the consequence, before anything else (season-close plan §3.2). */
export function closesLine(seasonName: string): string {
  return `This closes ${theSeason(seasonName)}.`;
}

// ── The question ───────────────────────────────────────────────────────────────────────────────

export const ROLL_QUESTION = 'What is the team doing next season?';
export const ROLL_CHOICE_TITLE: Record<SeasonRollPath, string> = {
  moving_up: 'The same players, moving up an age group',
  new_group: 'A new group of players, same age group',
};
/** The foot, until a path is picked — the main button waits, the way Add Player waits for a first name. */
export const ROLL_CHOOSE_FIRST = 'Choose what the team is doing.';

/** A birth-year pair as words without the "Born" ("2015–2016", "Sep 1, 2015 – Aug 31, 2016"), or null. */
function yearsWords(years: BornYears, c: Cutoff): string | null {
  return bornMeta(years, c)?.replace(/^born /, '') ?? null;
}

/**
 * Each choice's line under its title. The coach's window names the division only (its birth-years box says
 * the rest); the CLUB's names the birth years too, because the club sets them (drawing, the club's frame).
 */
export function rollChoiceLine(path: SeasonRollPath, p: {
  portal: 'coach' | 'club'; division: string | null; born: BornYears; cutoff: Cutoff;
}): string {
  const div = (p.division ?? '').trim();
  const next = nextAgeDivision(div);
  const parts: string[] = [];
  if (path === 'moving_up') {
    if (next) parts.push(`${div} becomes ${next}.`);
    if (p.portal === 'coach') parts.push('Your players come with you.');
    else {
      const now = yearsWords(p.born, p.cutoff);
      parts.push(now ? `Birth years stay ${now}.` : 'The players come with the team.');
    }
  } else {
    if (div) parts.push(`Stays ${div}.`);
    if (p.portal === 'coach') parts.push('Last season’s players don’t come with the team.');
    else {
      const moved = yearsWords(rollBornYears(p.born), p.cutoff);
      parts.push(moved ? `Birth years move to ${moved}.` : 'Last season’s players don’t come with the team.');
    }
  }
  return parts.join(' ');
}

/** The new season's birth years on each path: (a) they stay, (b) one year later. `carried` marks a roll that
 *  MOVED them — the club's Team details note reads it ("Moved one year later when the 2028 season started…"). */
export function bornYearsForPath(path: SeasonRollPath, years: BornYears): { years: BornYears; carried: boolean } {
  if (path === 'moving_up') return { years, carried: false };
  const rolled = rollBornYears(years);
  return { years: rolled, carried: rolled.from != null || rolled.to != null };
}

/** Path (b)'s box: "Born 2016–2017" and "(was 2015–2016)" — null when the team has no birth years. */
export function bornMovedLine(years: BornYears, c: Cutoff): { now: string; was: string } | null {
  const was = yearsWords(years, c);
  const now = yearsWords(rollBornYears(years), c);
  if (!was || !now) return null;
  return { now: `Born ${now}`, was: `(was ${was})` };
}

export function bornBoxLabel(newSeasonName: string): string {
  return `Birth years for ${theSeason(newSeasonName)}`;
}

// ── Who comes ──────────────────────────────────────────────────────────────────────────────────

/** One of last season's players, as the window lists them. */
export interface RollPlayer {
  id: string;
  name: string;
  number: string | null;
  status: 'active' | 'inactive';
}

/** The list the window shows: call-ups left out (they play for another team), active first, inactive at the bottom. */
export function rollPlayerChoices<T extends { status: string }>(players: readonly T[]): T[] {
  const kept = players.filter(p => p.status === 'active' || p.status === 'inactive');
  return [...kept.filter(p => p.status === 'active'), ...kept.filter(p => p.status === 'inactive')];
}

/** Ticked when the list first shows: the active players. */
export function defaultTicked(players: readonly RollPlayer[]): string[] {
  return players.filter(p => p.status === 'active').map(p => p.id);
}

export const ROLL_LIST_LABEL = 'Players coming with the team';
export function comingCount(ticked: number, of: number): string {
  return `${ticked} of ${of} coming`;
}
export const ROLL_LIST_HINT =
  'Active players are ticked; inactive players sit at the bottom, unticked. Call-ups aren’t listed: they play for another team.';
export const ROLL_LIST_EMPTY = 'Nobody was on last season’s roster.';

export const BRING_ANYWAY_LABEL = 'Bring last season’s players anyway';
export function bringAnywayNote(pickerBuilt = PAST_PLAYER_PICKER_BUILT): string {
  return pickerBuilt
    ? 'Leave this off for a new group. You can bring anyone back from the Roster later.'
    : 'Leave this off for a new group.';
}

/**
 * Which of last season's entries come — the server's check of the window's ticks. Every id must be a player
 * of the season being closed, and never a call-up (they play for another team; the roll never made them this
 * team's). An unknown id refuses the whole roll BEFORE anything is written, rather than quietly dropping a
 * child the person ticked.
 */
export function pickCarriedPlayers<T extends { id: string; status: string; childId?: string | null }>(
  players: readonly T[], ids: readonly string[],
): { ok: true; carried: T[]; stayed: T[] } | { ok: false } {
  const wanted = new Set(ids);
  const byId = new Map(players.map(p => [p.id, p]));
  for (const id of wanted) {
    const p = byId.get(id);
    if (!p || p.status === 'callup') return { ok: false };
  }
  const listed = rollPlayerChoices(players);
  /* ⚠ ONE ENTRY PER CHILD on the new season (Club Tier Stage 14 S2 — the plan's build gate: "a roll never invents a
     duplicate for a child already on the new season"). Each carried entry brings its own child (the roll sets it), so two
     ticked entries of ONE child would put that child on the new roster twice. The list's own order decides which comes
     (active before inactive); the other is neither carried nor "stayed" — the child is coming. */
  const coming = new Set<string>();
  const carried: T[] = [];
  for (const p of listed) {
    if (!wanted.has(p.id) || (p.childId && coming.has(p.childId))) continue;
    if (p.childId) coming.add(p.childId);
    carried.push(p);
  }
  return { ok: true, carried, stayed: listed.filter(p => !wanted.has(p.id) && !(p.childId && coming.has(p.childId))) };
}

// ── The request ────────────────────────────────────────────────────────────────────────────────

export const ROLL_FACTS_FAILED = 'Last season’s players could not be read. Close this and try again.';
export const ROLL_FACTS_READING = 'Reading last season’s players…';

/** Why the Start button waits (null = it need not): nothing chosen, the facts failed, or the facts are still loading. */
export function rollWaitReason(path: SeasonRollPath | null, facts: SeasonWindowFacts | null, failed: boolean): string | null {
  if (!path) return ROLL_CHOOSE_FIRST;
  if (failed) return ROLL_FACTS_FAILED;
  return facts ? null : ROLL_FACTS_READING;
}

/** The roll's three request fields, as both windows send them. The division counts on path (a) only, and only for
 *  a team that has one; path (b) brings nobody unless the box is ticked. */
export function rollRequestFields(p: {
  path: SeasonRollPath; ticked: readonly string[]; bringAnyway: boolean; facts: SeasonWindowFacts; division: string;
}): { path: SeasonRollPath; carryPlayerIds: string[]; division?: string | null } {
  const moving = p.path === 'moving_up';
  return {
    path: p.path,
    carryPlayerIds: moving ? [...p.ticked] : p.bringAnyway ? defaultTicked(p.facts.players) : [],
    ...(moving && p.facts.division?.trim() ? { division: p.division.trim() || null } : {}),
  };
}

export const ROLL_PATH_REQUIRED =
  'Choose what the team is doing next season: the same players moving up an age group, or a new group of players.';
export const ROLL_PLAYERS_STALE =
  'The roster changed while this window was open. Close it and start again — nothing was changed.';

/** The roll's three new fields, read from a request body. Both season routes call this, so they refuse in one voice. */
export function parseRollChoice(body: Record<string, unknown> | null | undefined):
  | { ok: true; path: SeasonRollPath; carryPlayerIds: string[]; division: string | null | undefined }
  | { ok: false; error: string } {
  const b = body ?? {};
  if (!isRollPath(b.path)) return { ok: false, error: ROLL_PATH_REQUIRED };
  const raw = b.carryPlayerIds;
  if (!Array.isArray(raw) || raw.length > 500 || raw.some(v => typeof v !== 'string' || !v)) {
    return { ok: false, error: 'Choose which players come with the team.' };
  }
  // Absent = leave the team's division alone; null or an empty box = no division.
  let division: string | null | undefined;
  if (b.division === null) division = null;
  else if (b.division !== undefined) {
    if (typeof b.division !== 'string') return { ok: false, error: 'The division must be words.' };
    const d = b.division.trim();
    if (d.length > DIVISION_MAX) return { ok: false, error: `Keep the division to ${DIVISION_MAX} characters.` };
    division = d || null;
  }
  return { ok: true, path: b.path, carryPlayerIds: [...new Set(raw as string[])], division };
}

// ── What the window's bullets say ──────────────────────────────────────────────────────────────

/** Replaces the bullet that promised a per-player goals offer (removed 2026-09-16; the roll's own comment). */
export const DEVELOPMENT_HISTORY_BULLET = {
  title: 'Development history',
  rest: ' reads straight through for every player who comes with the team.',
} as const;

/** "Jonah Ruiz", "Jonah Ruiz and Ana Li", "Jonah Ruiz, Ana Li, Sam Park and 4 others". */
function namesOf(names: readonly string[]): string {
  if (names.length <= 3) return joinWithAnd(names);
  return `${names.slice(0, 3).join(', ')} and ${pluralize(names.length - 3, 'other')}`;
}

/**
 * The success view's roster bullet — the only line of it that changes (drawing, "after path (a)/(b)").
 * Names who stayed and where to bring them back; never a pronoun guessed from a name.
 */
export function rosterOutcomeLine(p: {
  path: SeasonRollPath;
  copied: number;
  /** The division the team plays in now — named on path (a) only. */
  division: string | null;
  /** Last season's players who did not come (call-ups never counted). */
  stayed: readonly { firstName: string; name: string }[];
  fromSeasonName: string;
  pickerBuilt?: boolean;
}): string {
  const picker = p.pickerBuilt ?? PAST_PLAYER_PICKER_BUILT;
  if (p.copied === 0) {
    return picker
      ? 'The roster is empty. Add players, open tryouts, or bring back a past player from Roster.'
      : 'The roster is empty. Add players or open tryouts.';
  }
  const as = p.path === 'moving_up' && p.division ? ` as ${p.division}` : '';
  let line = `${pluralize(p.copied, 'player')} came with the team${as}.`;
  if (p.stayed.length > 0) {
    line += ` ${namesOf(p.stayed.map(s => s.name))} stayed on ${theSeason(p.fromSeasonName)}.`;
    if (picker) {
      line += p.stayed.length === 1
        ? ` Bring ${p.stayed[0].firstName} back from Roster any time.`
        : ' Bring any of them back from Roster any time.';
    }
  }
  return line;
}
