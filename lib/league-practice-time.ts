/**
 * league-practice-time.ts — PRACTICE TIME, planned and said (Club Tier Stage 11b Part 4; frame h1, drawings
 * TdXm5jmTEJ9qPvR3T5H9qU tab "11b · club time"; words HOUSE_LEAGUE_STAGE9D2_11B_COPY.md "Practice time (h1)"). Client-safe,
 * pure: the window plans live as its two fields change, and the route plans AGAIN on the server from the same inputs (it
 * never trusts the client's rows) before `league_practices_hand_out` (migs 392–393) writes them.
 *
 * A division's practice time is the house-league slots a league admin gave it in House league's time (`league_slot_uses`
 * kind `practices`). The plan:
 *   1. cuts each slot into practices of one length from its start ("6:00–9:00" at 60 minutes → 6:00, 7:00, 8:00), each
 *      with room for `teamsAtOnce` teams on the slot's facility — a SEAT. A slot shorter than a practice stays open.
 *   2. gives every team the SAME number of practices a week where the time allows (a week's seats ÷ teams, rounded down);
 *      the rest of the seats stay open. Fewer seats than teams: every team goes round one ring of the week's seats, one
 *      step a week, so the teams take turns going without equally (never the same teams all season).
 *   3. keeps a team on the same PART every week (one weekday, one clock, one facility — lib/league-time.ts's unit); a team
 *      with two a week gets two days when it can, and never two parts that overlap.
 *   4. moves a part's teams through its practices one step a week, so the early and late times are shared ("Teams take
 *      turns at the early and late times, week by week"). A part with room to spare uses its earliest practices: the
 *      open one is the late one, every week.
 *   5. a week missing a slot (the club took a date back) gives a team it leaves short an open seat elsewhere that week,
 *      when one fits.
 *
 * ⚖ ITS OWN PLANNER, not the club engine's (lib/club-schedule-engine.ts). The engine cuts a schedule's blocks into slots
 * and shares them by percentage and prime time through a weekly min-cost flow; its turn-taking moves a team's facility
 * and start. Practice time starts from slots the club already cut, needs pieces INSIDE a slot, has one rule (the same
 * number for every team), and its turns are the early and late times within a team's own part. It borrows the week
 * (`mondayOfDay`) and nothing else.
 * ⚖ Only slots still to come are planned over (the route's read, lib/league-time-server.ts): the step rewrites every
 * practice the rows name, so a started slot is history and is never in a plan.
 */
import { formatStoredDate, mondayOfDay, utcToZonedInputs } from './timezone.ts';
import { pluralize, possessive } from './utils.ts';
import { weekdayOf } from './permit-time.ts';
import { SCHEDULE_COACH_WORDS, SCHEDULE_WORDS } from './club-schedule-words.ts';
import { SERIES_SCOPE_ROWS } from './coach-series-scope.ts';
import type { LeaguePractice } from './types.ts';

/** One slot of a division's practice time, its club day and clock already worked out in the club's zone. */
export interface PracticeTimeSlot {
  id: string;
  /** The club day (YYYY-MM-DD) and its weekday, 1 = Monday. */
  day: string;
  weekday: number;
  /** "18:00" on the club's clock. */
  start: string;
  end: string;
  /** The slot's start, an instant (ISO): a practice inside it is an offset from here. */
  startsAt: string;
  /** The facility's name (the venue's when the slot is the venue itself), and its identity. */
  place: string;
  placeKey: string;
  /** The venue's name, for the window's rows (the plan never reads it). */
  venue?: string;
}

export interface PracticeTimeTeam { id: string; name: string }
export interface PracticeSettings { practiceMinutes: number; teamsAtOnce: number }

/** One practice the plan hands out: its slot, team and instants (the step writes the SLOT's place). */
export interface PlannedPractice { slotId: string; teamId: string; scheduledAt: string; endsAt: string }

export interface PracticePlan {
  rows: PlannedPractice[];
  /** Every slot planned over — the step removes practices still to come on these that the rows no longer name. */
  slotIds: string[];
  /** A week's seats across the division's parts. */
  seatsAWeek: number;
  /** Practices a week for every team (0 when the time is short). */
  perTeam: number;
  /** What the lime counts: practices handed out in a week. */
  practicesAWeek: number;
  /** Seats a week that stay open. */
  openAWeek: number;
  /** The time is short: teams without a practice each week (they take turns). */
  goWithout: number;
  /** Some part's teams take turns at its early and late times. */
  turns: boolean;
  /** Parts shorter than one practice (they stay open). */
  tooShort: number;
}

/** What the route answers: the division, its practice time still to come, its teams, and the saved settings (or the
 *  defaults, `saved` false, before the first hand-out). */
export interface PracticeTimeRead {
  division: { id: string; name: string };
  slots: PracticeTimeSlot[];
  teams: PracticeTimeTeam[];
  settings: PracticeSettings;
  saved: boolean;
}

/**
 * A hand-out's body: the division, the two settings, and what the window SAW (its slots and teams). The server plans again
 * from its own read and refuses `changed` when that read isn't what the window planned over, so the practices written
 * are the ones the lime counted — never a plan the league admin didn't see.
 */
export interface HandOutBody { divisionId: string; settings: PracticeSettings; saw: { slotIds: string[]; teamIds: string[] } }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A Save names at most this many slots (lib/league-time.ts's MAX_GIVE). */
const MAX_SLOTS = 2000;

export function readHandOutBody(body: unknown): HandOutBody | null {
  const b = (body ?? {}) as Record<string, unknown>;
  const settings = readSettings(b.settings);
  const saw = (b.saw ?? {}) as Record<string, unknown>;
  const ids = (v: unknown) => (Array.isArray(v) && v.length <= MAX_SLOTS && v.every(x => typeof x === 'string' && UUID.test(x))
    ? (v as string[]).map(x => x.toLowerCase()) : null);
  const slotIds = ids(saw.slotIds), teamIds = ids(saw.teamIds);
  if (typeof b.divisionId !== 'string' || !UUID.test(b.divisionId) || !settings || !slotIds || !teamIds) return null;
  return { divisionId: b.divisionId.toLowerCase(), settings, saw: { slotIds, teamIds } };
}

/** The same ids, in any order. */
export const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && [...a].map(x => x.toLowerCase()).sort().join() === [...b].map(x => x.toLowerCase()).sort().join();

/** Each practice's lengths, and teams at once (the step's floors: 15–240 minutes, 1–4 teams). */
export const PRACTICE_MINUTES = [30, 45, 60, 75, 90, 120] as const;
export const TEAMS_AT_ONCE = [1, 2, 3, 4] as const;
export const DEFAULT_SETTINGS: PracticeSettings = { practiceMinutes: 60, teamsAtOnce: 1 };

/** Settings as a body or a stored row carries them; null when out of the step's range. */
export function readSettings(v: unknown): PracticeSettings | null {
  const r = (v ?? {}) as Record<string, unknown>;
  const practiceMinutes = Number(r.practiceMinutes), teamsAtOnce = Number(r.teamsAtOnce);
  if (!Number.isInteger(practiceMinutes) || practiceMinutes < 15 || practiceMinutes > 240) return null;
  if (!Number.isInteger(teamsAtOnce) || teamsAtOnce < 1 || teamsAtOnce > 4) return null;
  return { practiceMinutes, teamsAtOnce };
}

const MIN = 60_000;
const minutesOf = (clock: string) => {
  const [h, m] = clock.split(':').map(Number);
  return h * 60 + (m || 0);
};
const byName = (a: string, b: string) => a.localeCompare(b, 'en-CA', { numeric: true });

/** Weeks from a fixed Monday: the turns follow the calendar, so a second hand-out mid-season keeps the same rotation. */
const EPOCH = Date.parse('2000-01-03T00:00:00Z');
const weekIndex = (day: string) => Math.round((Date.parse(`${mondayOfDay(day)}T00:00:00Z`) - EPOCH) / (7 * 24 * 60 * MIN));
const mod = (n: number, m: number) => ((n % m) + m) % m;

interface Part {
  key: string;
  order: number;
  weekday: number;
  startMin: number;
  endMin: number;
  /** Practices that fit in one slot, and seats (practices × teams at once). */
  pieces: number;
  seats: number;
  /** Its slot in each week, by the week's Monday. */
  byWeek: Map<string, PracticeTimeSlot>;
}

const overlap = (a: Part, b: Part) => a.weekday === b.weekday && a.startMin < b.endMin && b.startMin < a.endMin;

/** The division's parts, Monday first, then by clock and facility. */
function partsOf(slots: readonly PracticeTimeSlot[], s: PracticeSettings): Part[] {
  const map = new Map<string, Part>();
  for (const slot of slots) {
    const key = `${slot.weekday}|${slot.start}|${slot.end}|${slot.placeKey}`;
    const startMin = minutesOf(slot.start), endMin = minutesOf(slot.end);
    const part = map.get(key) ?? {
      key, order: 0, weekday: slot.weekday, startMin, endMin,
      pieces: Math.max(0, Math.floor((endMin - startMin) / s.practiceMinutes)), seats: 0, byWeek: new Map(),
    };
    part.seats = part.pieces * s.teamsAtOnce;
    // One slot a week per part (a part is one weekday's clock on one facility); a duplicate keeps the first.
    const week = mondayOfDay(slot.day);
    if (!part.byWeek.has(week)) part.byWeek.set(week, slot);
    map.set(key, part);
  }
  const place = new Map(slots.map(x => [`${x.weekday}|${x.start}|${x.end}|${x.placeKey}`, x.place]));
  return [...map.values()]
    .sort((a, b) => a.weekday - b.weekday || a.startMin - b.startMin || byName(place.get(a.key) ?? '', place.get(b.key) ?? ''))
    .map((p, i) => ({ ...p, order: i }));
}

/**
 * Each team's parts for `k` practices a week: round by round, each team takes a part with a seat left that it isn't on
 * and that doesn't overlap its others — a new weekday first, then the part with the most seats left (so the open seats
 * spread), then the week's order. Null when some team can't get `k` (the caller tries one fewer).
 */
function membersFor(parts: readonly Part[], teams: readonly PracticeTimeTeam[], k: number): Map<string, string[]> | null {
  const left = new Map(parts.map(p => [p.key, p.seats]));
  const mine = new Map(teams.map(t => [t.id, [] as Part[]]));
  const members = new Map(parts.map(p => [p.key, [] as string[]]));
  for (let round = 0; round < k; round++) {
    for (const t of teams) {
      const have = mine.get(t.id)!;
      const options = parts.filter(p => left.get(p.key)! > 0 && !have.includes(p) && !have.some(h => overlap(h, p)));
      if (!options.length) return null;
      const newDay = (p: Part) => (have.some(h => h.weekday === p.weekday) ? 1 : 0);
      const pick = [...options].sort((a, b) => newDay(a) - newDay(b) || left.get(b.key)! - left.get(a.key)! || a.order - b.order)[0];
      have.push(pick);
      members.get(pick.key)!.push(t.id);
      left.set(pick.key, left.get(pick.key)! - 1);
    }
  }
  return members;
}

/** THE PLAN: a division's practices over its practice time (the header says how). */
export function planPractices(p: {
  slots: readonly PracticeTimeSlot[];
  teams: readonly PracticeTimeTeam[];
  settings: PracticeSettings;
}): PracticePlan {
  const { settings: s } = p;
  const teams = [...p.teams].sort((a, b) => byName(a.name, b.name) || a.id.localeCompare(b.id));
  const all = partsOf(p.slots, s);
  const tooShort = all.filter(x => x.pieces === 0).length;
  const parts = all.filter(x => x.seats > 0);
  const seatsAWeek = parts.reduce((n, x) => n + x.seats, 0);
  const slotIds = p.slots.map(x => x.id);
  const none: PracticePlan = {
    rows: [], slotIds, seatsAWeek, perTeam: 0, practicesAWeek: 0, openAWeek: seatsAWeek, goWithout: 0, turns: false, tooShort,
  };
  if (!teams.length || !seatsAWeek) return none;

  // The same number for every team, as many as the parts allow.
  let perTeam = Math.floor(seatsAWeek / teams.length);
  let members: Map<string, string[]> | null = null;
  while (perTeam > 0 && !(members = membersFor(parts, teams, perTeam))) perTeam -= 1;
  const short = perTeam === 0;
  const memberOf = members ?? new Map<string, string[]>();

  const rows: PlannedPractice[] = [];
  const weeks = [...new Set(parts.flatMap(x => [...x.byWeek.keys()]))].sort();
  for (const week of weeks) {
    const w = weekIndex(week);
    /** Seats taken this week, per slot; each team's practices this week. */
    const taken = new Map<string, Set<number>>();
    const thisWeek = new Map<string, PlannedPractice[]>();
    const place = (slot: PracticeTimeSlot, seat: number, teamId: string) => {
      const piece = Math.floor(seat / s.teamsAtOnce);
      const from = Date.parse(slot.startsAt) + piece * s.practiceMinutes * MIN;
      const row = { slotId: slot.id, teamId, scheduledAt: new Date(from).toISOString(), endsAt: new Date(from + s.practiceMinutes * MIN).toISOString() };
      rows.push(row);
      taken.set(slot.id, (taken.get(slot.id) ?? new Set()).add(seat));
      thisWeek.set(teamId, [...(thisWeek.get(teamId) ?? []), row]);
    };
    if (short) {
      // Short time: ONE ring of every team over the week's seats, one step a week — each team goes without as often as
      // any other, and moves through the parts' early and late times as it goes round (a part of its own would leave
      // the same few teams sharing the gaps all season).
      const seats = parts.flatMap(part => {
        const slot = part.byWeek.get(week);
        return slot ? Array.from({ length: part.seats }, (_, seat) => ({ slot, seat })) : [];
      });
      teams.forEach((t, i) => { const at = seats[mod(i + w, teams.length)]; if (at) place(at.slot, at.seat, t.id); });
      continue;
    }
    for (const part of parts) {
      const slot = part.byWeek.get(week);
      if (!slot) continue;
      const m = memberOf.get(part.key) ?? [];
      if (m.length) {
        // Room to spare uses the earliest seats; the teams move through them a practice time a week.
        const step = s.teamsAtOnce % m.length;
        m.forEach((teamId, i) => place(slot, mod(i + w * step, m.length), teamId));
      }
    }
    // A week missing a slot: a team left short takes an open seat that fits.
    {
      const order = teams.map((_, i) => teams[mod(i + w, teams.length)]);
      for (const t of order) {
        while ((thisWeek.get(t.id)?.length ?? 0) < perTeam) {
          const mineNow = thisWeek.get(t.id) ?? [];
          let placed = false;
          for (const part of parts) {
            const slot = part.byWeek.get(week);
            if (!slot || mineNow.some(r => r.slotId === slot.id)) continue;
            const used = taken.get(slot.id) ?? new Set<number>();
            for (let seat = 0; seat < part.seats && !placed; seat++) {
              if (used.has(seat)) continue;
              const from = Date.parse(slot.startsAt) + Math.floor(seat / s.teamsAtOnce) * s.practiceMinutes * MIN;
              const to = from + s.practiceMinutes * MIN;
              if (mineNow.some(r => Date.parse(r.scheduledAt) < to && from < Date.parse(r.endsAt))) continue;
              place(slot, seat, t.id);
              placed = true;
            }
            if (placed) break;
          }
          if (!placed) break;
        }
      }
    }
  }

  const practicesAWeek = short ? seatsAWeek : perTeam * teams.length;
  const turns = short || parts.some(x => Math.ceil((memberOf.get(x.key)?.length ?? 0) / s.teamsAtOnce) > 1);
  return {
    rows, slotIds, seatsAWeek, perTeam, practicesAWeek, openAWeek: seatsAWeek - practicesAWeek,
    goWithout: short ? teams.length - seatsAWeek : 0, turns, tooShort,
  };
}

/** Words. Settled: HOUSE_LEAGUE_STAGE9D2_11B_COPY.md "Practice time (h1)"; [marketing] marks the build's own drafts. */
export const PRACTICE_TIME_WORDS = {
  title: 'Practice time',
  eyebrow: (season: string, division: string) => `${season} · ${division}`,
  /** "U12's practice time" + the quiet " · from house league's time". */
  timeHead: (division: string) => `${possessive(division)} practice time`,
  timeFrom: ' · from house league’s time',
  giveMore: (division: string) => `+ Give ${division} more time`,
  handHead: 'Hand it to the teams',
  eachPractice: 'Each practice',
  teamsAtOnce: 'Teams at once',
  minutes: (n: number) => `${n} minutes`,
  perFacility: (n: number) => `${n} per facility`,
  everyTeam: (n: number) => `Every team gets ${pluralize(n, 'practice')} a week.`,
  open: (n: number) => (n === 1 ? '1 slot stays open.' : `${n} slots stay open.`),
  turns: 'Teams take turns at the early and late times, week by week.',
  /** [marketing] the time is short: who goes without, and that it goes round. */
  shortLead: (fit: number, teams: number) => `There’s room for ${fit} of ${teams} teams each week.`,
  shortTurns: (without: number) => `The other ${pluralize(without, 'team')} take${without === 1 ? 's' : ''} turns going without, week by week.`,
  /** [marketing] a practice longer than every slot; some slots shorter than a practice. */
  tooLong: (division: string) => `Each practice is longer than any of ${possessive(division)} practice time. Pick a shorter practice.`,
  tooShort: (n: number) => (n === 1 ? '1 part is shorter than a practice, so it stays open.' : `${n} parts are shorter than a practice, so they stay open.`),
  /** [marketing] a division with no teams to hand practices to. */
  noTeams: (division: string) => `${division} has no teams yet.`,
  foot: 'The practices show on the schedule and on each coach’s team page. Families aren’t emailed.',
  /** [marketing] the phone's short foot. */
  footPhone: 'Families aren’t emailed.',
  handOut: (n: number) => `Hand out ${pluralize(n, 'practice')} a week`,
  handOutPhone: 'Hand out',
  cancel: 'Cancel',
  close: 'Close',
  /** Settled in Part 3 (k3's sentence), and its door: the last words open House league's time on this piece. */
  empty: (division: string) => `${division} has no practice time yet.`,
  emptyDoor: 'Give it some of house league’s time.',
  loading: 'Loading practice time…',
  loadFailed: 'Practice time didn’t load. Try again.',
  saveFailed: 'The practices didn’t hand out. Try again.',
} as const;

// ── A PRACTICE'S WINDOW, READ FIRST (frame h2) ──────────────────────────────────────────────────────────────────

const WEEKDAY = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * "Every Wednesday to Aug 25" — h2's Repeats: the practices of its run that aren't cancelled. A club practice's run is the
 * team's practices from the same schedule on the same weekday and facility (a hand-out keeps a team's part, its clock
 * taking turns); a hand-booked one's is its series. Null when it stands alone.
 */
export function repeatsWords(practice: LeaguePractice, teamPractices: readonly LeaguePractice[]): string | null {
  if (!practice.scheduledAt) return null;
  const day = (p: LeaguePractice) => (p.scheduledAt ? utcToZonedInputs(p.scheduledAt).date : '');
  const weekday = weekdayOf(day(practice));
  const run = teamPractices.filter(p => p.status !== 'cancelled' && p.scheduledAt && (practice.clubScheduleSlotId
    ? p.clubScheduleSlotId && (p.fromSchedule ?? null) === (practice.fromSchedule ?? null)
      && p.orgVenueFacilityId === practice.orgVenueFacilityId && p.orgVenueId === practice.orgVenueId && weekdayOf(day(p)) === weekday
    : !!practice.recurrenceGroupId && p.recurrenceGroupId === practice.recurrenceGroupId));
  if (run.length < 2) return null;
  const last = run.map(day).sort().at(-1)!;
  return `Every ${WEEKDAY[weekday]} to ${formatStoredDate(last, { withYear: false })}`;
}

/** h2's words. The source line and the hint are the rep coach's own (one spelling: SCHEDULE_WORDS); [marketing] the rest. */
export const PRACTICE_WINDOW_WORDS = {
  eyebrow: (division: string) => `${division} · a practice`,
  title: (team: string) => `Practice · ${team}`,
  when: 'When',
  where: 'Where',
  repeats: 'Repeats',
  from: 'From',
  notes: 'Notes',
  /** "Maple Grove · summer 2027 · the club's schedule"; a slot the club has since removed names no schedule. */
  fromValue: (schedule: string | null | undefined) => (schedule ? `${schedule} ${SCHEDULE_COACH_WORDS.sourceTail}` : 'The club’s schedule'),
  /** The Practices view's card. */
  fromCard: (schedule: string | null | undefined) => (schedule ? `From ${schedule}` : 'From the club’s schedule'),
  onlyTheClub: SCHEDULE_WORDS.onlyTheClub,
  changeTime: (division: string) => `Change ${possessive(division)} practice time`,
  edit: 'Edit this practice',
  cancel: 'Cancel this practice',
  /** The pencil on a series asks first (the rep coach's rows, ruled 2026-10-09). */
  scopeTitle: 'Edit which practices?',
  scopeOne: SERIES_SCOPE_ROWS[0].label('practice'),
  scopeRest: SERIES_SCOPE_ROWS[1].label('practice'),
  scopeNext: 'Edit',
  close: 'Close',
  /** The edit form (today's practice form, opened to edit). */
  editTitle: (team: string) => `Edit practice — ${team}`,
  editRestHint: 'Each practice keeps its own date. The time, place and notes change for this one and the ones after it.',
  save: 'Save',
  saved: (n: number) => `${pluralize(n, 'practice')} changed.`,
  refusals: {
    cancelled: 'This practice is cancelled, so it can’t move.',
    badTime: 'Pick a date and a start time.',
  },
} as const;

/** [marketing] The route's refusals, one sentence each. */
export const PRACTICE_TIME_REFUSALS = {
  notFound: 'That season or division isn’t this club’s.',
  seasonClosed: 'This season is finished, so its practices can’t change.',
  badRequest: 'Pick a division, a practice length and how many teams share a facility.',
  badSettings: 'Pick a practice length between 15 minutes and 4 hours, and 1 to 4 teams at once.',
  nothing: 'There’s nothing to hand out: no practice fits this time.',
  changed: (division: string) => `${possessive(division)} practice time changed while you were looking. Here it is again.`,
  slotFull: 'A slot would hold more teams at once than you picked. Here it is again.',
  teamTwice: (team: string) => `${team} would be at two practices at once. Here it is again.`,
} as const;
