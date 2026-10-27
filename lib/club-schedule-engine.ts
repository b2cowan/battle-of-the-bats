/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE CLUB'S TIME, HANDED OUT — the scheduler's engine (Club Tier Stage 11a, part A; Asks 5, 12, 13, 18–22, 27 —
 * hub K4MPu4ni53Ct7yrDcmWJd9 → Stages 10 + 11, specimens 4–7 and 14). Pure and client-safe, as the tournament's engine
 * is: a route hands it its inputs and the save re-validates on the server; its unit tests are the drawings' numbers
 * (`tests/unit/club-schedule-engine.test.ts`).
 *
 * ⚠ ITS OWN ENGINE (P11-02, Ask 5). The tournament generator pairs two-sided games and its edge-slot rule penalises
 * slots before noon and from 5 p.m. (`lib/schedule-generator.ts`) — backwards for practices, where evening is prime
 * time. Nothing here imports it, and nothing there is changed.
 *
 * ONE-SIDED: a team asks for time, never for an opponent. Measured in slots, hours and PRIME TIME.
 *
 *   1. `cutSlots`     — the schedule's blocks over their dates, less the dates off, cut by slot length and changeover,
 *                       per facility (10a's one model of time: `blockDates`, `blockUnits`). A slot is one facility for
 *                       one length of time: one team, or the teams of ONE sharing rule (Stage 11c).
 *   2. `heldSlots`    — a slot a booking already on the books holds (a tryout day, another program) is left out and
 *                       named ("Leaves out the 2 slots 13U AAA's tryout day holds").
 *   3. `shareTargets` — each team's share of the time (Ask 18): Evenly · By percentage · A set number a week, a GROUP'S
 *                       figure first and then its teams', by largest remainder (60/40 of 352 → 211 · 141 →
 *                       53/53/53/52 · 36/35/35/35). Prime time shared the same way, or evenly by team.
 *   4. `generateDrafts` — week by week (the shares hold every week), a small min-cost flow per week places the teams
 *                       on the slots their rules allow: prime slots first, then the rest; Each team's time keeps each
 *                       team's facility and start, or moves them in turn (Stage 11c Ask 4); a swap pass evens out what
 *                       each team's slots are worth within a group (a half field is half a full one). Locked slots and
 *                       slots moved by hand are KEPT (Ask 19). Three drafts at a time, ranked, each with its measures.
 *
 * ⚖ SHARING A FACILITY (Stage 11c, ratified 2026-10-12 — Asks 1–3). A team in no sharing rule always has its slot to
 * itself. A rule's teams are PAIRED WHENEVER A PARTNER IS FREE: each week they are matched into partner groups of up to
 * the rule's number (the teams with the most still to place first, the youngest first on a tie — `matchPool`), and each
 * group is placed as ONE placer that needs one facility — never a half one (weight under 1: half of a half would be a
 * quarter). What a group can't take falls to its teams one by one (alone, the slot's room left for a partner). A SHARED
 * SLOT IS HALF A FACILITY wherever time is measured: Evenly and By percentage count it 1 ÷ its teams toward a share (the
 * "units"), and `teamResults`' hours and priced minutes split it — agreeing with the bill (`pricedMinutes`, unchanged).
 * A set number a week still counts PRACTICES (2 a week = 2 practices, each on half a facility).
 *
 * THE ONE REFUSAL is the schedule's own: a team twice at once (`teamTwice`). Everything else WARNS — a rule that stops a
 * share being met is reported (`warnings`), never silently broken.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { addCalendarDays, mondayOfDay, zonedWallClockToUtc } from './timezone';
import { blockDates, blockUnits, clock, weekdayOf, type DateOff, type TimeBlock, type VenueFacilities } from './permit-time';
import { shareCents } from './club-bill-split';
import { moveLanding, sharesAny, sharingPools, type PrimeTime, type ScheduleSettings, type SharingPool } from './club-schedule-settings';

const MIN = 60_000;

// ── 1. The slots ─────────────────────────────────────────────────────────────────────────────────

/** A schedule's time: its own blocks and dates off (`org_time_blocks.schedule_id`, `org_time_dates_off.schedule_id`). */
export interface ScheduleTime {
  startsOn: string;
  endsOn: string;
  blocks: readonly TimeBlock[];
  datesOff: readonly DateOff[];
}

/** One dated slot on one place. Its `key` is stable for the same place and start (the database's unique key). */
export interface Slot {
  key: string;
  venueId: string;
  /** Null = the venue itself (a venue with no facilities is one place). */
  facilityId: string | null;
  /** Which of the schedule's blocks it was cut from. */
  blockIndex: number;
  /** Its club day, `YYYY-MM-DD`. */
  day: string;
  /** 1 = Monday … 7 = Sunday. */
  weekday: number;
  /** The Monday of its week (the shares hold every week). */
  week: string;
  /** "HH:MM" on the club's clock. */
  startClock: string;
  endClock: string;
  startMs: number;
  endMs: number;
  /** Its place in a week — weekday, start, venue, facility — what "the same slot every week" means. */
  pos: string;
  prime: boolean;
  /** What an hour of it is worth against a full field (the permit's share: 1 = Full, 0.5 = Half). */
  weight: number;
}

export const slotKeyOf = (venueId: string, facilityId: string | null, startMs: number) => `${venueId}|${facilityId ?? ''}|${startMs}`;

const toMin = (t: string) => { const [h, m] = clock(t).split(':').map(Number); return h * 60 + m; };
const fromMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export function isPrimeSlot(prime: PrimeTime | null, weekday: number, startClock: string, endClock: string): boolean {
  return !!prime && prime.weekdays.includes(weekday) && startClock >= prime.start && endClock <= prime.end;
}

/**
 * THE TIME, CUT INTO SLOTS. Each block's days and hours over its dates (inside the schedule's), less the dates off, cut
 * from the block's start by slot length and changeover — a slot that would run past the block's end is never cut — on
 * each facility it covers. A place and start held twice (two blocks over one facility) is one slot.
 */
export function cutSlots(time: ScheduleTime, opts: {
  slotMinutes: number;
  changeoverMinutes: number;
  prime: PrimeTime | null;
  venueFacilities: VenueFacilities;
  /** The facility's price share (the permit's); 1 when there is no permit. */
  weightOf?: (facilityId: string | null) => number;
}): Slot[] {
  const asPermit = { id: 'schedule', startsOn: time.startsOn, endsOn: time.endsOn, blocks: time.blocks, datesOff: time.datesOff };
  const len = opts.slotMinutes, step = opts.slotMinutes + opts.changeoverMinutes;
  const order = new Map<string, number>();
  for (const list of opts.venueFacilities.values()) list.forEach((f, i) => order.set(f, i));
  const out = new Map<string, Slot>();
  time.blocks.forEach((block, blockIndex) => {
    const units = blockUnits(block, opts.venueFacilities);
    const s = toMin(block.startTime), e = toMin(block.endTime);
    const starts: number[] = [];
    for (let t = s; t + len <= e; t += step) starts.push(t);
    if (!starts.length) return;
    for (const day of blockDates(asPermit, block)) {
      const weekday = weekdayOf(day);
      const week = mondayOfDay(day);
      for (const t of starts) {
        const startClock = fromMin(t), endClock = fromMin(t + len);
        const startIso = zonedWallClockToUtc(day, startClock), endIso = zonedWallClockToUtc(day, endClock);
        if (!startIso || !endIso) continue;
        const startMs = Date.parse(startIso), endMs = Date.parse(endIso);
        for (const unit of units) {
          const key = slotKeyOf(block.venueId, unit, startMs);
          if (out.has(key)) continue;
          out.set(key, {
            key, venueId: block.venueId, facilityId: unit, blockIndex, day, weekday, week, startClock, endClock,
            startMs, endMs, pos: `${weekday}|${startClock}|${block.venueId}|${unit ?? ''}`,
            prime: isPrimeSlot(opts.prime, weekday, startClock, endClock),
            weight: opts.weightOf ? opts.weightOf(unit) : 1,
          });
        }
      }
    }
  });
  return [...out.values()].sort((a, b) => a.startMs - b.startMs || a.venueId.localeCompare(b.venueId)
    || (order.get(a.facilityId ?? '') ?? 0) - (order.get(b.facilityId ?? '') ?? 0));
}

// ── 2. What the books already hold ────────────────────────────────────────────────────────────────

/** A booking already on the books at one of the club's venues (the clash pool's `ClubBooking` fits). */
export interface PoolBooking {
  key: string;
  venueId: string | null;
  facilityId: string | null;
  startMs: number;
  endMs: number;
  ownerName: string;
  /** What it is (the clash rule's kind: practice · game · tryout · team_event), for "13U AAA's tryout day". */
  kind?: string | null;
}

/**
 * The slots a booking already holds: at the slot's venue, overlapping it, on its facility (or the venue itself). A
 * booking with no facility set holds nothing here — it is "busy then", the clash rule's softer finding, which the
 * calendar still marks; holding every field for it would hand out none of them.
 */
export function heldSlots(slots: readonly Slot[], bookings: readonly PoolBooking[]): Map<string, PoolBooking> {
  // Bucketed by venue and day, so a slot reads only its own day's bookings (a season's slots against every booking at
  // the club's venues would otherwise be millions of comparisons). The earliest booking in the list still wins.
  const dayOf = (ms: number) => Math.floor(ms / DAY_MS);
  const bucket = new Map<string, number[]>();
  bookings.forEach((b, i) => {
    if (!b.venueId) return;
    const last = dayOf(Math.max(b.startMs, b.endMs - 1));
    for (let d = dayOf(b.startMs), n = 0; d <= last && n < 400; d++, n++) {
      const k = `${b.venueId}|${d}`;
      const list = bucket.get(k);
      if (list) list.push(i); else bucket.set(k, [i]);
    }
  });
  const out = new Map<string, PoolBooking>();
  for (const s of slots) {
    let hit = -1;
    for (let d = dayOf(s.startMs), last = dayOf(Math.max(s.startMs, s.endMs - 1)); d <= last; d++) {
      for (const i of bucket.get(`${s.venueId}|${d}`) ?? []) {
        if (hit !== -1 && i >= hit) break;
        const b = bookings[i];
        if (b.startMs < s.endMs && s.startMs < b.endMs && (s.facilityId === null || (b.facilityId !== null && b.facilityId === s.facilityId))) { hit = i; break; }
      }
    }
    if (hit !== -1) out.set(s.key, bookings[hit]);
  }
  return out;
}

const DAY_MS = 86_400_000;

// ── 3. The shares (Ask 18) ─────────────────────────────────────────────────────────────────────────

export interface EngineTeam {
  id: string;
  name: string;
  /** The club's group (Rep Teams' groups); null = "Not in a group" — its own share. */
  groupId: string | null;
  /** The age in its name ("13U AAA" → 13), for "youngest earliest". Null when it has none. */
  age: number | null;
  /** A PROGRAM, not a team (Stage 11b: house league as a whole — lib/club-schedule-holders.ts): it holds many slots at
   *  once (its league admins divide them), so no team rule caps it — never twice at once, a day cap, back-to-back or a
   *  weekly cap. It shares a slot with nobody (no sharing rule names it). */
  many?: boolean;
}

/** "13U AAA" → 13; "U11 Girls" → 11. */
export function ageOf(name: string): number | null {
  const m = /(\d{1,2})\s*U\b/i.exec(name) ?? /\bU\s*(\d{1,2})\b/i.exec(name);
  return m ? Number(m[1]) : null;
}

const groupKey = (t: EngineTeam) => t.groupId ?? `team:${t.id}`;

/**
 * A total shared out by weights, A GROUP FIRST and then its teams (the drawing's numbers: 352 at 60 / 40 → 211 · 141,
 * then 53/53/53/52 · 36/35/35/35). Largest remainder, ties to the earlier row (Evenly's rule); `tieFewerFirst` breaks a
 * team-level tie toward the team that got less elsewhere (prime time to the team with fewer slots).
 */
export function apportionByGroup(
  total: number,
  teams: readonly EngineTeam[],
  weightOf: (t: EngineTeam) => number,
  opts: { flat?: boolean; tieFewerFirst?: ReadonlyMap<string, number> } = {},
): Map<string, number> {
  const out = new Map<string, number>(teams.map(t => [t.id, 0]));
  const live = teams.filter(t => weightOf(t) > 0);
  if (total <= 0 || !live.length) return out;
  const groups: { key: string; teams: EngineTeam[] }[] = [];
  for (const t of live) {
    const k = opts.flat ? `team:${t.id}` : groupKey(t);
    const g = groups.find(x => x.key === k);
    if (g) g.teams.push(t); else groups.push({ key: k, teams: [t] });
  }
  const groupShares = shareCents(total, groups.map(g => g.teams.reduce((s, t) => s + weightOf(t), 0)));
  groups.forEach((g, i) => {
    let members = g.teams;
    if (opts.tieFewerFirst) {
      const got = opts.tieFewerFirst;
      // A stable reorder: equal weights put the team with fewer elsewhere first, so a tie goes to it.
      members = [...members].sort((a, b) => (weightOf(a) === weightOf(b) ? (got.get(a.id) ?? 0) - (got.get(b.id) ?? 0) : 0));
    }
    const shares = shareCents(groupShares[i], members.map(weightOf));
    members.forEach((t, j) => out.set(t.id, shares[j]));
  });
  return out;
}

export interface ShareTargets {
  /**
   * Each team's share over the whole schedule. A set number a week counts PRACTICES; Evenly and By percentage count
   * UNITS — a slot to itself is 1, a shared slot 1 ÷ its teams (Stage 11c Ask 3) — so a team that shares every slot
   * holds twice the practices for the same share. Without sharing the two are the same number (`counts`).
   */
  slots: Map<string, number>;
  /** Each team's prime-time share, counted as `slots` is. */
  prime: Map<string, number>;
  /** What `slots` counts. */
  counts: 'practices' | 'units';
  /** Each team's practices those shares come to, sharing worked out (`matchPool`) — New schedule's Slots column. */
  practices: Map<string, number>;
  /** The slots the schedule can hand out (not held) — one facility for one length of time, however many share it. */
  capacity: number;
  /** The slots the shares fill, a shared slot counted once — "250 slots for 8 teams." */
  handedOut: number;
  primeCapacity: number;
  /** Weeks that hold any time. */
  weeks: number;
}

/** The order a sharing rule's teams are matched in on a tie: the youngest first ("because of their age"), then the form's. */
const tieOrder = (teams: readonly EngineTeam[]) => {
  const at = new Map(teams.map((t, i) => [t.id, i]));
  const byId = new Map(teams.map(t => [t.id, t]));
  return (a: string, b: string) => (byId.get(a)?.age ?? 99) - (byId.get(b)?.age ?? 99) || (at.get(a) ?? 0) - (at.get(b) ?? 0);
};

export interface PoolMatch {
  /** Each partner group (its teams, in the form's order) and how many slots it takes together. */
  groups: { teamIds: string[]; count: number }[];
  /** What each team takes alone — a partner wasn't free. */
  alone: Map<string, number>;
}

/**
 * PAIRED WHENEVER A PARTNER IS FREE (Stage 11c Ask 2): one sharing rule's teams, each with what it still needs, matched
 * into groups of up to `atOnce` — the teams with the most still to place first, the youngest first on a tie — until no
 * two need anything. `practices`: each group takes one practice off each of its teams (A set number a week); `units`:
 * a group of n takes 1 ÷ n off each (Evenly, By percentage — a shared slot counts half toward a share). A team left on
 * its own takes the rest alone. `cap` holds any team to a number of practices (At most, a week). Pure: the same needs
 * always make the same groups, so a week's partners are next week's partners.
 */
export function matchPool(need: ReadonlyMap<string, number>, atOnce: number, counts: 'practices' | 'units', order: (a: string, b: string) => number,
  cap: number | ((teamId: string) => number) = Infinity): PoolMatch {
  const EPS = 1e-9;
  const capOf = typeof cap === 'function' ? cap : () => cap;
  const left = new Map(need);
  const taken = new Map([...need.keys()].map(t => [t, 0]));
  const groups = new Map<string, { teamIds: string[]; count: number }>();
  for (let guard = 0; guard < 50_000; guard++) {
    const free = [...left.keys()].filter(t => left.get(t)! > EPS && taken.get(t)! < capOf(t))
      .sort((a, b) => { const d = left.get(b)! - left.get(a)!; return Math.abs(d) > EPS ? d : order(a, b); });
    if (free.length < 2) break;
    const group = free.slice(0, atOnce).sort(order);
    const each = counts === 'units' ? 1 / group.length : 1;
    for (const t of group) { left.set(t, left.get(t)! - each); taken.set(t, taken.get(t)! + 1); }
    const key = group.join('|');
    const g = groups.get(key) ?? groups.set(key, { teamIds: group, count: 0 }).get(key)!;
    g.count++;
  }
  const alone = new Map<string, number>();
  for (const [t, n] of left) {
    const rest = Math.min(Math.max(0, Math.floor(n + EPS)), capOf(t) - taken.get(t)!);
    if (rest > 0) alone.set(t, rest);
  }
  return { groups: [...groups.values()], alone };
}

export function shareTargets(teams: readonly EngineTeam[], settings: Pick<ScheduleSettings, 'split' | 'prime' | 'rules'>, seats: {
  capacity: number; primeCapacity: number; weeks: number;
}): ShareTargets {
  const { method, values } = settings.split;
  const valueOf = (t: EngineTeam) => (method === 'even' ? 1 : values[t.id] ?? 0);
  const counts = method === 'weekly' ? 'practices' : 'units';
  const sharing = sharingPools(settings.rules.sharing, teams);
  let slots: Map<string, number>;
  if (method === 'weekly') {
    const cap = settings.rules.maxPerWeek;
    slots = new Map(teams.map(t => [t.id, Math.min(valueOf(t), t.many ? Infinity : cap ?? Infinity) * seats.weeks]));
  } else {
    const percent = method === 'even' ? 100 : teams.reduce((s, t) => s + valueOf(t), 0);
    const total = Math.min(seats.capacity, Math.round(seats.capacity * Math.min(percent, 100) / 100));
    slots = apportionByGroup(total, teams, valueOf);
    // A weekly cap holds a share down (reported by `capWarnings`, never broken).
    if (settings.rules.maxPerWeek != null) {
      for (const t of teams) if (!t.many) slots.set(t.id, Math.min(slots.get(t.id)!, settings.rules.maxPerWeek * seats.weeks));
    }
  }
  // What the shares come to once sharing is worked out: each rule's teams matched (a set number a week matches one
  // week and repeats it — its figure is a week's), everyone else alone.
  const practices = new Map(teams.map(t => [t.id, slots.get(t.id)!]));
  let handedOut = 0;
  for (const t of teams) if (!sharesAny(sharing, t.id)) handedOut += slots.get(t.id)!;
  const order = tieOrder(teams);
  const weekly = method === 'weekly', times = weekly ? seats.weeks : 1;
  const teamById = new Map(teams.map(t => [t.id, t]));
  for (const pool of sharing.pools) {
    if (pool.teamIds.length < 2) continue;
    const need = new Map(pool.teamIds.map(t => [t, weekly ? Math.min(valueOf(teamById.get(t)!), settings.rules.maxPerWeek ?? Infinity) : slots.get(t)!]));
    const m = matchPool(need, pool.atOnce, counts, order);
    const each = new Map(m.alone);
    for (const g of m.groups) for (const t of g.teamIds) each.set(t, (each.get(t) ?? 0) + g.count);
    for (const t of pool.teamIds) practices.set(t, (each.get(t) ?? 0) * times);
    handedOut += (m.groups.reduce((n, g) => n + g.count, 0) + [...m.alone.values()].reduce((a, b) => a + b, 0)) * times;
  }
  let primeTotal = 0;
  if (settings.prime && seats.primeCapacity > 0) {
    const percent = method === 'percentage' ? Math.min(100, teams.reduce((s, t) => s + valueOf(t), 0)) : 100;
    primeTotal = Math.min(seats.primeCapacity, Math.round(seats.primeCapacity * percent / 100), handedOut);
  }
  const prime = settings.prime?.share === 'even'
    ? apportionByGroup(primeTotal, teams, () => 1, { flat: true, tieFewerFirst: slots })
    : apportionByGroup(primeTotal, teams, valueOf, { tieFewerFirst: slots });
  for (const t of teams) prime.set(t.id, Math.min(prime.get(t.id)!, slots.get(t.id)!));
  return { slots, prime, counts, practices, capacity: seats.capacity, handedOut, primeCapacity: seats.primeCapacity, weeks: seats.weeks };
}

// ── 4. The rules, as who may take which seat ─────────────────────────────────────────────────────

/** A team's own booking in the window — any place, its whole schedule (P11-04c): a game day is read from it too. */
export interface TeamBooking {
  startMs: number;
  endMs: number;
  /** A game (home, away on a typed place, a tournament) — "never on a team's game day". */
  isGame: boolean;
  /** The club days it covers (a multi-day tournament covers each). */
  days: readonly string[];
}

export interface EngineInput {
  slots: readonly Slot[];
  /** The ticked teams, in the form's order. */
  teams: readonly EngineTeam[];
  settings: ScheduleSettings;
  /** Slot key → the booking holding it (`heldSlots`), honoured when "never over a booking" is on. */
  held: ReadonlyMap<string, PoolBooking>;
  /** Team id → its own bookings in the window, other than this schedule's practices. */
  teamBookings: ReadonlyMap<string, readonly TeamBooking[]>;
  /** Slot key → the teams it keeps (locked, or moved by hand): a regenerate never moves them (Ask 19). */
  fixed: ReadonlyMap<string, readonly string[]>;
}

interface Rules {
  eligible(team: EngineTeam, slot: Slot): boolean;
  /** A facility kept for some teams (Facilities by group) that this team is one of. */
  keptFor(team: EngineTeam, slot: Slot): boolean;
}

function buildRules(input: EngineInput): Rules {
  const { settings, teamBookings } = input;
  const r = settings.rules;
  const offDate = new Map<string, Set<string>>(), offDay = new Map<string, Set<number>>();
  for (const d of r.daysOff) {
    if (d.date) (offDate.get(d.teamId) ?? offDate.set(d.teamId, new Set()).get(d.teamId)!).add(d.date);
    if (d.weekday) (offDay.get(d.teamId) ?? offDay.set(d.teamId, new Set()).get(d.teamId)!).add(d.weekday);
  }
  const gameDays = new Map<string, Set<string>>();
  if (r.avoidGameDays) {
    for (const [teamId, list] of teamBookings) {
      gameDays.set(teamId, new Set(list.filter(b => b.isGame).flatMap(b => b.days)));
    }
  }
  // A team's own bookings by club day (a slot never crosses midnight, and a booking lists every day it covers).
  const bookedOn = new Map<string, Map<string, TeamBooking[]>>();
  if (r.avoidBookings) {
    for (const [teamId, list] of teamBookings) {
      const byDay = new Map<string, TeamBooking[]>();
      for (const b of list) for (const d of b.days) (byDay.get(d) ?? byDay.set(d, []).get(d)!).push(b);
      bookedOn.set(teamId, byDay);
    }
  }
  const windowsOf = new Map<string, ScheduleSettings['rules']['windows'][number][]>();
  for (const w of r.windows) for (const t of w.teamIds) (windowsOf.get(t) ?? windowsOf.set(t, []).get(t)!).push(w);
  const fieldsFor = new Map<string, { groups: Set<string>; teams: Set<string> }>();
  for (const f of r.fieldsBy) {
    for (const fac of f.facilityIds) {
      const cur = fieldsFor.get(fac) ?? { groups: new Set<string>(), teams: new Set<string>() };
      f.groupIds.forEach(g => cur.groups.add(g));
      f.teamIds.forEach(t => cur.teams.add(t));
      fieldsFor.set(fac, cur);
    }
  }
  return {
    eligible(team, slot) {
      if (offDate.get(team.id)?.has(slot.day) || offDay.get(team.id)?.has(slot.weekday)) return false;
      if (gameDays.get(team.id)?.has(slot.day)) return false;
      if (bookedOn.get(team.id)?.get(slot.day)?.some(b => b.startMs < slot.endMs && slot.startMs < b.endMs)) return false;
      for (const w of windowsOf.get(team.id) ?? []) {
        if (w.startAfter && slot.startClock < w.startAfter) return false;
        if (w.startBy && slot.startClock > w.startBy) return false;
        if (w.finishBy && slot.endClock > w.finishBy) return false;
      }
      if (slot.facilityId) {
        const kept = fieldsFor.get(slot.facilityId);
        if (kept && !kept.teams.has(team.id) && !(team.groupId && kept.groups.has(team.groupId))) return false;
      }
      return true;
    },
    keptFor(team, slot) {
      const kept = slot.facilityId ? fieldsFor.get(slot.facilityId) : undefined;
      return !!kept && (kept.teams.has(team.id) || (!!team.groupId && kept.groups.has(team.groupId)));
    },
  };
}

// ── The flow: a small min-cost flow, one per week ────────────────────────────────────────────────

class MinCostFlow {
  private to: number[] = [];
  private cap: number[] = [];
  private cost: number[] = [];
  private next: number[] = [];
  private head: number[];
  private n: number;
  constructor(n: number) { this.n = n; this.head = new Array(n).fill(-1); }
  addEdge(u: number, v: number, cap: number, cost: number): number {
    const e = this.to.length;
    this.to.push(v, u); this.cap.push(cap, 0); this.cost.push(cost, -cost);
    this.next.push(this.head[u], this.head[v]);
    this.head[u] = e; this.head[v] = e + 1;
    return e;
  }
  flowOn(e: number): number { return this.cap[e + 1]; }
  /** Successive shortest paths (SPFA): the cheapest flow, as much as fits. */
  run(s: number, t: number): number {
    let flow = 0;
    const dist = new Array<number>(this.n), inQ = new Array<boolean>(this.n), prevE = new Array<number>(this.n);
    for (;;) {
      dist.fill(Infinity); inQ.fill(false); prevE.fill(-1);
      dist[s] = 0;
      const q: number[] = [s];
      inQ[s] = true;
      for (let qi = 0; qi < q.length; qi++) {
        const u = q[qi];
        inQ[u] = false;
        for (let e = this.head[u]; e !== -1; e = this.next[e]) {
          if (this.cap[e] <= 0) continue;
          const v = this.to[e], nd = dist[u] + this.cost[e];
          if (nd < dist[v]) {
            dist[v] = nd; prevE[v] = e;
            if (!inQ[v]) { inQ[v] = true; q.push(v); }
          }
        }
      }
      if (dist[t] === Infinity) return flow;
      let push = Infinity;
      for (let v = t; v !== s; v = this.to[prevE[v] ^ 1]) push = Math.min(push, this.cap[prevE[v]]);
      for (let v = t; v !== s; v = this.to[prevE[v] ^ 1]) { this.cap[prevE[v]] -= push; this.cap[prevE[v] ^ 1] += push; }
      flow += push;
    }
  }
}

/** A seeded random: the same draft round always makes the same drafts. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── 5. Drafts ─────────────────────────────────────────────────────────────────────────────────────

/**
 * The same each week: Best overall · Another mix · Youngest earliest. Moved around: Best overall · Another mix · A third
 * mix — three that all move (Stage 11c Ask 5). "Prime time rotated" retired in BOTH: Moved around rotates prime time
 * with every other slot, and a schedule the club chose to keep the same must not be offered a rotating draft.
 */
export type DraftStrategy = 'best' | 'youngest' | 'mix' | 'third';

export interface TeamResult {
  teamId: string;
  /** Its share, counted as the split counts (`ShareTargets.counts`: practices, or units). */
  target: number;
  /** Its practices. */
  got: number;
  primeTarget: number;
  prime: number;
  /** Toward its share: a slot to itself 1, a shared slot 1 ÷ its teams (Stage 11c Ask 3). */
  units: number;
  /** Its practices in a slot it shares. */
  shared: number;
  minutes: number;
  /** Σ minutes × the facility's price share ÷ the slot's teams — what the team's time is worth against a full field, the
   *  bill's own figure (`pricedMinutes`): a shared slot and a half field each count half. Fair shares' Hours. */
  pricedMinutes: number;
  /** Its early starts — the earlier half of the starts its day holds (Fair shares' Early, Stage 11c Ask 4). */
  early: number;
  /** How many facilities it used (Fair shares' Fields). */
  facilities: number;
  /** The weekdays it plays most weeks (its "nights"), Monday first. */
  nights: number[];
  short: number;
}

export type DraftMeasure =
  | { kind: 'shares'; allMet: boolean; sameCount: number | null; short: { teamId: string; short: number }[] }
  | { kind: 'sharing'; rules: { teamIds: string[]; groupIds: string[]; atOnce: number }[] }
  | { kind: 'prime'; min: number; max: number; rotated: boolean; lowTeamId: string | null }
  | { kind: 'nights'; same: boolean; ratio: number }
  | { kind: 'early'; min: number; max: number; of: number; even: boolean; lowTeamId: string | null }
  | { kind: 'facilities'; turned: boolean }
  | { kind: 'held'; count: number; owners: string[]; what: string | null }
  | { kind: 'youngest'; teamIds: string[]; latestStart: string }
  | { kind: 'open'; count: number };

/** A rule that stops a share being met (Ask 18: "a weekly cap of 3 holds Senior to about 41%") — said, never broken. */
export interface ShareWarning {
  kind: 'cap_holds_share';
  /** The group, or the team when it has none. */
  groupId: string | null;
  teamIds: string[];
  cap: number;
  /** What the cap lets the group take, as a percent of the time (41). */
  percent: number;
}

export interface Draft {
  strategy: DraftStrategy;
  round: number;
  score: number;
  /** Slot key → the teams it is given (an open slot has none; a held slot is never given). */
  assignments: Map<string, string[]>;
  teams: TeamResult[];
  measures: DraftMeasure[];
  warnings: ShareWarning[];
  /** `seats`: the slots it could hand out (not held); `handedOut`: the slots given to a team (a shared one once). */
  totals: { slots: number; seats: number; handedOut: number; open: number; held: number };
}

interface Seat { slot: Slot }

/** What one place in the flow is: a team on its own, or a partner group of one sharing rule placed as one (Stage 11c). */
interface Placer { id: string; teams: EngineTeam[]; quota: number; primeQuota: number }

/** What the drafts are measured and placed against: each week's slots, the targets, the sharing rules' teams. */
function prepare(input: EngineInput) {
  const { slots, settings } = input;
  const weeks: string[] = [];
  const seatsByWeek = new Map<string, Seat[]>();
  for (const s of slots) {
    // A held slot is left out — unless it is KEPT (locked or moved by hand): its teams are counted toward their shares.
    if (settings.rules.avoidBookings && input.held.has(s.key) && !input.fixed.has(s.key)) continue;
    if (!seatsByWeek.has(s.week)) { seatsByWeek.set(s.week, []); weeks.push(s.week); }
    seatsByWeek.get(s.week)!.push({ slot: s });
  }
  weeks.sort();
  const targets = shareTargets(input.teams, settings, seatCounts(slots, settings, input.held, input.fixed));
  return { weeks, seatsByWeek, targets, sharing: sharingPools(settings.rules.sharing, input.teams) };
}

/** The slots a schedule hands out — less those a booking holds when "never over a booking" is on (a KEPT slot stays: its
 *  teams have it) — its prime slots, and the weeks that hold any. A slot is one facility for one length of time however
 *  many teams share it (Stage 11c). The one count the drafts, Generate's summary and the page share. */
export function seatCounts(slots: readonly Slot[], settings: Pick<ScheduleSettings, 'rules'>, held: ReadonlyMap<string, PoolBooking>,
  kept: { has(key: string): boolean } = new Set<string>()): {
  capacity: number; primeCapacity: number; weeks: number;
} {
  const open = settings.rules.avoidBookings ? slots.filter(s => !held.has(s.key) || kept.has(s.key)) : slots;
  return {
    capacity: open.length,
    primeCapacity: open.filter(s => s.prime).length,
    weeks: new Set(open.map(s => s.week)).size,
  };
}

/** Largest remainder of `total` over positive deficits, each capped. */
function apportionDeficits(total: number, deficits: Map<string, number>, caps: Map<string, number>): Map<string, number> {
  const out = new Map<string, number>([...deficits.keys()].map(k => [k, 0]));
  const ids = [...deficits.keys()].filter(k => (deficits.get(k) ?? 0) > 0 && (caps.get(k) ?? 0) > 0);
  let left = total;
  // Whole parts first, then the remainders; any leftover goes to whoever still has room, most behind first.
  for (const k of ids) {
    const take = Math.min(Math.floor(deficits.get(k)!), caps.get(k)!, left);
    out.set(k, take); left -= take;
  }
  const order = ids.map(k => ({ k, rem: deficits.get(k)! - out.get(k)! })).sort((a, b) => b.rem - a.rem);
  for (const { k } of order) {
    if (left <= 0) break;
    if (out.get(k)! < caps.get(k)!) { out.set(k, out.get(k)! + 1); left--; }
  }
  return out;
}

const STRATEGIES_SAME: DraftStrategy[] = ['best', 'mix', 'youngest'];
const STRATEGIES_MOVED: DraftStrategy[] = ['best', 'mix', 'third'];

/**
 * THREE DRAFTS, RANKED. `round` 0 is the first three; "Three more drafts" asks round 1, 2, … (each its own seeds).
 */
export function generateDrafts(input: EngineInput, round = 0): Draft[] {
  const strategies = input.settings.timeMode === 'moved' ? STRATEGIES_MOVED : STRATEGIES_SAME;
  const shared = { rules: buildRules(input), prep: prepare(input) };
  const drafts = strategies.map((strategy, i) => makeDraft(input, strategy, round, 1 + round * 101 + i * 7919, shared));
  const order = (s: DraftStrategy) => strategies.indexOf(s);
  return drafts.sort((a, b) => b.score - a.score || order(a.strategy) - order(b.strategy));
}

/** A placer's usual week: how often it has had each place in a week, each weekday at a time, each weekday, each facility. */
interface Memory { pos: Map<string, number>; time: Map<string, number>; day: Map<number, number>; fac: Map<string, number> }
const newMemory = (): Memory => ({ pos: new Map(), time: new Map(), day: new Map(), fac: new Map() });
const facKey = (s: Pick<Slot, 'venueId' | 'facilityId'>) => `${s.venueId}|${s.facilityId ?? ''}`;
/** `k`: the slot's keys, worked out once (`keysOf`). */
function remember(m: Memory, s: Slot, weight: number, k: { time: string; fac: string }): void {
  m.pos.set(s.pos, (m.pos.get(s.pos) ?? 0) + weight);
  m.time.set(k.time, (m.time.get(k.time) ?? 0) + weight);
  m.day.set(s.weekday, (m.day.get(s.weekday) ?? 0) + weight);
  m.fac.set(k.fac, (m.fac.get(k.fac) ?? 0) + weight);
}

/** A second slot on a day a team already plays costs more than a new day: a team spreads over its nights unless the
 *  time leaves no other way (the dome's one Sunday). */
const SAME_DAY_COST = 60;
/** A facility kept for a group (Facilities by group) pulls that group's teams to it first — nobody else may use it, so
 *  using it first leaves the open facilities for everyone (the dome: 12U AA and 13U AAA on Fields 5 and 6, Stage 11c).
 *  Stronger than Moved around's pull away from last week's facility (at most 20 + 16), so a team moved around takes the
 *  kept facilities in turn — Field 5, then Field 6 — before it spills onto the open ones (specimen 3). */
const KEPT_FACILITY_PULL = 40;
const EPS = 1e-9;

/** One draft. Exported for the tests (a strategy at a known seed). */
export function makeDraft(input: EngineInput, strategy: DraftStrategy, round = 0, seed = 1,
  shared: { rules: Rules; prep: ReturnType<typeof prepare> } = { rules: buildRules(input), prep: prepare(input) }): Draft {
  const { slots, teams, settings, fixed } = input;
  const { rules, prep } = shared;
  const { weeks, seatsByWeek, targets, sharing } = prep;
  const random = rng(seed);
  const jitter = strategy === 'mix' || strategy === 'third' ? 24 : round === 0 ? 0 : 8;
  const teamById = new Map(teams.map(t => [t.id, t]));
  const assignments = new Map<string, string[]>();
  // What each team has toward its share so far, and of prime time — counted as the shares count (`worth`): a practice
  // each, or, under Evenly and By percentage, 1 ÷ the slot's teams. Without sharing the two are the same.
  const byUnits = targets.counts === 'units';
  const have = new Map(teams.map(t => [t.id, 0])), havePrime = new Map(teams.map(t => [t.id, 0]));
  const daysHeld = new Map(teams.map(t => [t.id, new Set<string>()]));
  const maxPerDay = settings.rules.maxPerDay ?? 99;
  const maxPerWeek = settings.rules.maxPerWeek ?? Infinity;
  const ages = teams.map(t => t.age).filter((a): a is number => a !== null);
  const minAge = Math.min(...ages), maxAge = Math.max(...ages);
  const agePct = (t: EngineTeam) => (t.age === null || maxAge === minAge ? 0.5 : (t.age - minAge) / (maxAge - minAge));
  const moved = settings.timeMode === 'moved';
  const order = tieOrder(teams);
  /** A placer's key: its teams in the matching's order (`matchPool` sorts a group the same way) — one team's is its id. */
  const placerKey = (ids: readonly string[]) => [...ids].sort(order).join('|');
  const pooled = (id: string) => sharesAny(sharing, id);
  // Each slot's keys, worked out once: the cost reads them for every placer on every attempt.
  const keysOf = new Map(slots.map(s => {
    const time = `${s.weekday}|${s.startClock}`, fac = facKey(s);
    return [s, { time, fac, lastTime: `t:${time}`, lastFac: `f:${fac}` }];
  }));
  // Each placer's usual week, and last week's starts and facilities (Moved around asks "not the same as last week").
  const memory = new Map<string, Memory>();
  const memOf = (id: string) => memory.get(id) ?? memory.set(id, newMemory()).get(id)!;
  let memoryWeeks = 0;
  let lastWeek = new Map<string, Set<string>>();
  const totalPrime = targets.primeCapacity;

  // Kept slots first (Ask 19), exactly as they stand: their teams count toward the shares in their week.
  for (const s of slots) {
    const keep = fixed.get(s.key);
    if (keep?.length) assignments.set(s.key, [...keep].filter(t => teamById.has(t)));
  }
  /** What a slot counts toward each of its teams' shares. */
  const worth = (s: Slot) => (byUnits ? 1 / Math.max(1, (assignments.get(s.key) ?? []).length) : 1);

  /** A week's slots split into what the kept slots hold, team by team, and what is free. */
  const splitSeats = (seats: readonly Seat[]) => {
    const kept = new Map<string, Seat[]>(teams.map(t => [t.id, []]));
    const free: Seat[] = [];
    for (const seat of seats) {
      // A kept slot is kept whole: its teams stay, and the room it leaves stays as it is (Ask 19).
      if (fixed.has(seat.slot.key)) for (const t of assignments.get(seat.slot.key) ?? []) kept.get(t)?.push(seat);
      else free.push(seat);
    }
    return { kept, free };
  };

  /**
   * This week's need, team by team — a set number a week, or each share's deficit so far (the shares hold every week) —
   * counted as the shares count, less what the week's kept slots already give it.
   */
  const needsFor = (seats: readonly Seat[], cumSeats: number, cumPrime: number, kept: Map<string, Seat[]>, have: Map<string, number>, havePrime: Map<string, number>) => {
    const need = new Map<string, number>(), primeNeed = new Map<string, number>();
    if (settings.split.method === 'weekly') {
      for (const t of teams) need.set(t.id, Math.min(settings.split.values[t.id] ?? 0, t.many ? Infinity : maxPerWeek));
    } else {
      const ideal = new Map(teams.map(t => [t.id, targets.slots.get(t.id)! * cumSeats / Math.max(1, targets.capacity)]));
      const deficits = new Map(teams.map(t => [t.id, ideal.get(t.id)! - have.get(t.id)!]));
      // Rounded UP: a team that shares may be owed half a facility (units), which a whole cap of 0 would never hand it.
      const caps = new Map(teams.map(t => [t.id, Math.min(Math.ceil(targets.slots.get(t.id)! - have.get(t.id)! - EPS), t.many ? Infinity : maxPerWeek)]));
      const toHand = Math.max(0, Math.min(seats.length,
        Math.round([...ideal.values()].reduce((a, b) => a + b, 0) - [...have.values()].reduce((a, b) => a + b, 0))));
      const share = apportionDeficits(toHand, deficits, caps);
      // Never more than it is still owed — a half, for a team that shares (whole numbers without sharing: the same).
      for (const t of teams) need.set(t.id, Math.max(0, Math.min(share.get(t.id)!, targets.slots.get(t.id)! - have.get(t.id)!)));
    }
    if (settings.prime) {
      const primeSeats = seats.filter(x => x.slot.prime).length;
      const ideal = new Map(teams.map(t => [t.id, targets.prime.get(t.id)! * cumPrime / Math.max(1, totalPrime)]));
      const deficits = new Map(teams.map(t => [t.id, ideal.get(t.id)! - havePrime.get(t.id)!]));
      const caps = new Map(teams.map(t => [t.id, Math.min(need.get(t.id)!, Math.floor(targets.prime.get(t.id)! - havePrime.get(t.id)! + EPS))]));
      const want = Math.round([...ideal.values()].reduce((a, b) => a + b, 0) - [...havePrime.values()].reduce((a, b) => a + b, 0));
      const share = apportionDeficits(Math.max(0, Math.min(primeSeats, want)), deficits, caps);
      for (const t of teams) primeNeed.set(t.id, share.get(t.id)!);
    }
    for (const t of teams) {
      const mine = kept.get(t.id) ?? [];
      need.set(t.id, Math.max(0, need.get(t.id)! - mine.reduce((n, x) => n + worth(x.slot), 0)));
      if (settings.prime) primeNeed.set(t.id, Math.max(0, primeNeed.get(t.id)! - mine.filter(x => x.slot.prime).reduce((n, x) => n + worth(x.slot), 0)));
    }
    return { need, primeNeed };
  };

  /**
   * THE WEEK'S PLACERS: a team in no sharing rule on its own; a rule's teams matched into partner groups (`matchPool` —
   * paired whenever a partner is free), each group one placer, and what a team still needs alone its own. In the form's
   * order, so a schedule with no sharing places its teams exactly as before.
   */
  const placersFor = (need: Map<string, number>, primeNeed: Map<string, number>, kept: Map<string, Seat[]>, free: readonly Seat[]): Placer[] => {
    const out: Placer[] = [];
    const done = new Set<string>();
    const primeLeft = new Map(primeNeed);
    const primeOf = (ids: readonly string[], count: number, each: number) => {
      if (!settings.prime) return 0;
      const n = Math.min(count, ...ids.map(id => Math.floor((primeLeft.get(id) ?? 0) / each + EPS)));
      for (const id of ids) primeLeft.set(id, (primeLeft.get(id) ?? 0) - n * each);
      return Math.max(0, n);
    };
    for (const t of teams) {
      if (done.has(t.id)) continue;
      if (!pooled(t.id)) {
        done.add(t.id);
        const quota = Math.max(0, Math.round(need.get(t.id)!));
        out.push({ id: t.id, teams: [t], quota, primeQuota: primeOf([t.id], quota, 1) });
        continue;
      }
      const pool = sharing.pools[sharing.poolOf.get(t.id)!];
      for (const id of pool.teamIds) done.add(id);
      const room = (id: string) => maxPerWeek - (kept.get(id)?.length ?? 0);
      const m = matchPool(new Map(pool.teamIds.map(id => [id, need.get(id)!])), pool.atOnce, targets.counts, order, room);
      // A group plays together only where every team of it may this week — a full facility at a start none of them is
      // off, kept out of, or already holding (a kept slot). The rest its teams play ALONE (Ask 2: "alone otherwise").
      const alone = new Map(m.alone);
      const missed = new Map<string, number>();
      for (const g of m.groups) {
        const members = g.teamIds.map(id => teamById.get(id)!);
        const starts = new Set(free.filter(x => x.slot.weight >= 1 && members.every(tm => rules.eligible(tm, x.slot)
          && !(kept.get(tm.id) ?? []).some(k => k.slot.startMs < x.slot.endMs && x.slot.startMs < k.slot.endMs))).map(x => x.slot.startMs));
        const count = Math.min(g.count, starts.size);
        if (count < g.count) for (const id of g.teamIds) missed.set(id, (missed.get(id) ?? 0) + (byUnits ? (g.count - count) / g.teamIds.length : g.count - count));
        if (count > 0) out.push({ id: placerKey(g.teamIds), teams: members, quota: count, primeQuota: primeOf(g.teamIds, count, byUnits ? 1 / g.teamIds.length : 1) });
      }
      for (const [id, n] of missed) alone.set(id, (alone.get(id) ?? 0) + Math.floor(n + EPS));
      for (const [id, n] of alone) if (n > 0) out.push({ id, teams: [teamById.get(id)!], quota: n, primeQuota: primeOf([id], n, 1) });
    }
    return out;
  };

  /**
   * ONE WEEK'S PLACEMENT: prime slots first (each placer's prime quota), then the rest (its quota). A small min-cost
   * flow — source → placer → placer-day → placer-start → slot → sink — so a placer is never twice at once at one start,
   * takes at most its day cap, and a SECOND slot on a day costs more than a new day. A team twice at once across two
   * starts or two placers (a sharing team in two partner groups), over its day cap, or on back-to-back days when that
   * rule is on, is found after and forbidden, and the week placed again.
   */
  const planWeek = (seats: readonly Seat[], kept: Map<string, Seat[]>, free: readonly Seat[], placers: readonly Placer[]): Map<Seat, Placer> => {
    const weekStarts = [...new Set(seats.map(x => x.slot.startClock))].sort();
    const timePct = (s: Slot) => (weekStarts.length < 2 ? 0.5 : weekStarts.indexOf(s.startClock) / (weekStarts.length - 1));
    const forbid = new Set<string>();
    // How often a placer has had a place, a time, a day, a facility — over the weeks remembered so far.
    const w = Math.max(1, memoryWeeks);
    const freq = <K>(map: Map<K, number>, k: K) => (map.get(k) ?? 0) / w;

    const costOf = (p: Placer, s: Slot): number => {
      let c = 100;
      const m = memOf(p.id), k = keysOf.get(s)!;
      const fDay = freq(m.day, s.weekday);
      if (!moved) {
        // The same each week: each team keeps its facility, its start and its days.
        c -= Math.round(Math.max(40 * freq(m.pos, s.pos), 25 * freq(m.time, k.time), 12 * fDay));
      } else {
        // Moved around (Stage 11c Ask 4): last week's start and facility cost more, and so does whatever it has had most —
        // early and late, facility to facility, in turn. The day keeps its pull: a team keeps its days.
        const last = lastWeek.get(p.id);
        c -= Math.round(12 * fDay);
        if (last?.has(k.lastTime)) c += 30;
        if (last?.has(k.lastFac)) c += 20;
        c += Math.round(20 * freq(m.time, k.time) + 16 * freq(m.fac, k.fac));
      }
      if (p.teams.every(t => rules.keptFor(t, s))) c -= KEPT_FACILITY_PULL;
      if (strategy === 'youngest') c += Math.round(40 * Math.abs(p.teams.reduce((n, t) => n + agePct(t), 0) / p.teams.length - timePct(s)));
      if (jitter) c += Math.floor(random() * jitter);
      return c;
    };

    const adjacentDay = (teamId: string, day: string, mine: readonly Seat[]): boolean => {
      const held = daysHeld.get(teamId)!;
      const prev = addCalendarDays(day, -1), next = addCalendarDays(day, 1);
      return held.has(prev) || held.has(next) || mine.some(m => m.slot.day === prev || m.slot.day === next);
    };

    const place = (): Map<Seat, Placer> => {
      const out = new Map<Seat, Placer>();
      const placed = new Map<Placer, number>();
      const taken = new Map<string, Seat[]>(teams.map(t => [t.id, [...(kept.get(t.id) ?? [])]]));
      const run = (pool: readonly Seat[], capOf: (p: Placer) => number, among: readonly Placer[] = placers) => {
        const capPlacers = among.filter(p => capOf(p) > 0);
        if (!capPlacers.length || !pool.length) return;
        let n = 2;
        const placerNode = new Map<string, number>();
        for (const p of capPlacers) placerNode.set(p.id, n++);
        const dayNode = new Map<string, number>(), startNode = new Map<string, number>();
        const seatNode = new Map<Seat, number>();
        for (const seat of pool) seatNode.set(seat, n++);
        const edges: { u: number; v: number; cap: number; cost: number }[] = [];
        for (const p of capPlacers) edges.push({ u: 0, v: placerNode.get(p.id)!, cap: capOf(p), cost: 0 });
        for (const seat of pool) edges.push({ u: seatNode.get(seat)!, v: 1, cap: 1, cost: 0 });
        const pending: { u: number; v: number; seat: Seat; placer: Placer; cost: number }[] = [];
        for (const p of capPlacers) {
          for (const seat of pool) {
            const s = seat.slot;
            if (forbid.size && (forbid.has(`${p.id}|${s.key}`) || forbid.has(`${p.id}|${s.day}`) || forbid.has(`${p.id}|t${s.startMs}`))) continue;
            // A half facility is never shared (Stage 11c — half of a half would be a quarter).
            if (p.teams.length > 1 && s.weight < 1) continue;
            if (!p.teams.every(t => rules.eligible(t, s))) continue;
            let dayCount = 0, ok = true;
            const many = p.teams.some(t => t.many);
            for (const t of p.teams) {
              if (t.many) continue;
              const mine = taken.get(t.id)!;
              if (mine.some(m => m.slot.startMs < s.endMs && s.startMs < m.slot.endMs)) { ok = false; break; }
              const dc = mine.filter(m => m.slot.day === s.day).length;
              if (dc >= maxPerDay || (settings.rules.noBackToBack && adjacentDay(t.id, s.day, mine))) { ok = false; break; }
              dayCount = Math.max(dayCount, dc);
            }
            if (!ok) continue;
            const dk = `${p.id}|${s.day}`;
            if (!dayNode.has(dk)) {
              dayNode.set(dk, n++);
              // The day's first slot is free; every further one costs SAME_DAY_COST (two parallel edges: a convex cost). A
              // program has no day cap: its league admins divide the day among teams.
              const room = many ? pool.length : maxPerDay - dayCount;
              if (dayCount === 0) {
                edges.push({ u: placerNode.get(p.id)!, v: dayNode.get(dk)!, cap: 1, cost: 0 });
                if (room > 1) edges.push({ u: placerNode.get(p.id)!, v: dayNode.get(dk)!, cap: room - 1, cost: SAME_DAY_COST });
              } else {
                edges.push({ u: placerNode.get(p.id)!, v: dayNode.get(dk)!, cap: room, cost: SAME_DAY_COST });
              }
            }
            const sk = `${p.id}|${s.startMs}`;
            if (!startNode.has(sk)) {
              startNode.set(sk, n++);
              edges.push({ u: dayNode.get(dk)!, v: startNode.get(sk)!, cap: many ? pool.length : 1, cost: 0 });
            }
            pending.push({ u: startNode.get(sk)!, v: seatNode.get(seat)!, seat, placer: p, cost: costOf(p, s) });
          }
        }
        const flow = new MinCostFlow(n);
        for (const e of edges) flow.addEdge(e.u, e.v, e.cap, e.cost);
        const seatEdge = pending.map(x => ({ e: flow.addEdge(x.u, x.v, 1, x.cost), seat: x.seat, placer: x.placer }));
        flow.run(0, 1);
        for (const se of seatEdge) {
          if (flow.flowOn(se.e) > 0) {
            out.set(se.seat, se.placer);
            placed.set(se.placer, (placed.get(se.placer) ?? 0) + 1);
            for (const t of se.placer.teams) taken.get(t.id)!.push(se.seat);
          }
        }
      };
      if (settings.prime) run(free.filter(x => x.slot.prime), p => Math.min(p.primeQuota, p.quota));
      const rest = free.filter(x => !out.has(x));
      run(rest, p => p.quota - (placed.get(p) ?? 0));
      // A PARTNER GROUP THAT COULDN'T TAKE ITS SLOTS — one of its teams is off that day, or a rule keeps it out — plays the
      // rest ALONE (Ask 2: paired whenever a partner is free, alone otherwise): a practice each under A set number a
      // week; under Evenly and By percentage what the missed shared slots were worth (1 ÷ the group each, whole slots —
      // a half carries to next week's share).
      const missed = new Map<string, number>();
      for (const p of placers) {
        const short = p.teams.length > 1 ? p.quota - (placed.get(p) ?? 0) : 0;
        if (short <= 0) continue;
        const each = byUnits ? short / p.teams.length : short;
        for (const t of p.teams) missed.set(t.id, (missed.get(t.id) ?? 0) + each);
      }
      const alone = [...missed].map(([id, n]) => ({ id, teams: [teamById.get(id)!], quota: Math.floor(n + EPS), primeQuota: 0 })).filter(p => p.quota > 0);
      if (alone.length) run(free.filter(x => !out.has(x)), p => p.quota - (placed.get(p) ?? 0), alone);
      return out;
    };

    /** A team twice at once (within a placer, or across two), over its day cap, or on back-to-back days — the first, as a
     *  forbid key on the placer that broke it. */
    const findViolation = (res: Map<Seat, Placer>): string | null => {
      const byTeam = new Map<string, { seat: Seat; p: Placer }[]>();
      for (const [seat, p] of res) for (const t of p.teams) if (!t.many) (byTeam.get(t.id) ?? byTeam.set(t.id, []).get(t.id)!).push({ seat, p });
      for (const [t, list] of byTeam) {
        const all: { seat: Seat; p: Placer | null }[] = [...(kept.get(t) ?? []).map(seat => ({ seat, p: null })), ...list];
        for (const a of list) {
          const s = a.seat.slot;
          const clash = all.find(b => b.seat !== a.seat && b.seat.slot.startMs < s.endMs && s.startMs < b.seat.slot.endMs);
          if (clash) return clash.p && clash.p !== a.p ? `${a.p.id}|t${s.startMs}` : `${a.p.id}|${s.key}`;
          if (all.filter(b => b.seat.slot.day === s.day).length > maxPerDay) return `${a.p.id}|${s.day}`;
          if (!settings.rules.noBackToBack) continue;
          const prev = addCalendarDays(s.day, -1), next = addCalendarDays(s.day, 1);
          if (all.some(b => b.seat !== a.seat && (b.seat.slot.day === next || b.seat.slot.day === prev))) return `${a.p.id}|${s.day}`;
        }
      }
      return null;
    };

    let result = new Map<Seat, Placer>();
    let violation: string | null = null;
    for (let attempt = 0; attempt < 12; attempt++) {
      result = place();
      violation = findViolation(result);
      if (!violation) break;
      forbid.add(violation);
    }
    return violation ? holdable(result, kept) : result;
  };

  /** The placements every team in them can hold, in order — never a team twice at once, over its day cap, or on
   *  back-to-back days: what a week keeps when its attempts run out with a placement still broken (several tied starts). */
  const holdable = (res: Map<Seat, Placer>, kept: Map<string, Seat[]>): Map<Seat, Placer> => {
    const out = new Map<Seat, Placer>();
    const held = new Map<string, Seat[]>([...kept].map(([t, list]) => [t, [...list]]));
    for (const [seat, p] of res) {
      const s = seat.slot;
      const fits = p.teams.every(t => {
        if (t.many) return true;
        const mine = held.get(t.id) ?? [];
        if (mine.some(m => m.slot.startMs < s.endMs && s.startMs < m.slot.endMs)) return false;
        if (mine.filter(m => m.slot.day === s.day).length >= maxPerDay) return false;
        const prev = addCalendarDays(s.day, -1), next = addCalendarDays(s.day, 1);
        return !(settings.rules.noBackToBack && (daysHeld.get(t.id)!.has(prev) || daysHeld.get(t.id)!.has(next) || mine.some(m => m.slot.day === prev || m.slot.day === next)));
      });
      if (!fits) continue;
      out.set(seat, p);
      for (const t of p.teams) (held.get(t.id) ?? held.set(t.id, []).get(t.id)!).push(seat);
    }
    return out;
  };

  /** Within a group, even out what each team's slots this week are worth: swap two slots at the same start. Teams that
   *  share are left as placed — a partner group's slot is the group's, and a half facility is never shared. */
  const balanceValue = (byTeam: Map<string, Seat[]>, among: readonly EngineTeam[]): void => {
    const worthOf = (list: Seat[]) => list.reduce((s, x) => s + x.slot.weight * (x.slot.endMs - x.slot.startMs) / MIN, 0);
    for (let pass = 0; pass < 6; pass++) {
      let swapped = false;
      for (const a of among) for (const b of among) {
        if (a.id === b.id || groupKey(a) !== groupKey(b)) continue;
        const la = byTeam.get(a.id)!, lb = byTeam.get(b.id)!;
        if (la.length !== lb.length || worthOf(la) <= worthOf(lb)) continue;
        const gap = worthOf(la) - worthOf(lb);
        outer: for (const sa of la) for (const sb of lb) {
          if (fixed.has(sa.slot.key) || fixed.has(sb.slot.key)) continue;
          if (sa.slot.startMs !== sb.slot.startMs || sa.slot.weight <= sb.slot.weight) continue;
          const move = (sa.slot.weight - sb.slot.weight) * (sa.slot.endMs - sa.slot.startMs) / MIN;
          if (Math.abs(gap - 2 * move) >= gap) continue;
          if (!rules.eligible(b, sa.slot) || !rules.eligible(a, sb.slot)) continue;
          la.splice(la.indexOf(sa), 1, sb);
          lb.splice(lb.indexOf(sb), 1, sa);
          swapped = true;
          break outer;
        }
      }
      if (!swapped) break;
    }
  };
  const alone = teams.filter(t => !pooled(t.id));

  /**
   * A WEEK PLACED, as one list of its slots and who has each: a team on its own (placed alone — the value swap evens
   * these first), a partner group, and the week's kept slots as they stand. `hv`/`hvPrime`: what each team has so far
   * (nothing, for the typical week's dry run).
   */
  const weekOf = (seats: readonly Seat[], cumSeats: number, cumPrime: number, hv = have, hvPrime = havePrime) => {
    const { kept, free } = splitSeats(seats);
    const { need, primeNeed } = needsFor(seats, cumSeats, cumPrime, kept, hv, hvPrime);
    const result = planWeek(seats, kept, free, placersFor(need, primeNeed, kept, free));
    const lists = new Map<string, Seat[]>(teams.map(t => [t.id, [...(kept.get(t.id) ?? [])]]));
    const out: { slot: Slot; teamIds: readonly string[]; placerId: string }[] = [];
    for (const [seat, p] of result) {
      if (p.teams.length === 1) lists.get(p.teams[0].id)!.push(seat);
      else out.push({ slot: seat.slot, teamIds: p.teams.map(t => t.id), placerId: p.id });
    }
    balanceValue(lists, alone);
    for (const [teamId, list] of lists) for (const seat of list) if (!fixed.has(seat.slot.key)) out.push({ slot: seat.slot, teamIds: [teamId], placerId: teamId });
    for (const seat of seats) {
      const on = fixed.has(seat.slot.key) ? assignments.get(seat.slot.key) : undefined;
      if (on?.length) out.push({ slot: seat.slot, teamIds: on, placerId: placerKey(on) });
    }
    return out;
  };

  // ── A TYPICAL WEEK FIRST (dry): the week with the most time. Its plan seeds each placer's usual week, so the first
  // week's oddities (a tryout day holding two slots) and a holiday Monday later never set a team's nights.
  if (weeks.length > 1) {
    const typical = [...weeks].sort((a, b) => seatsByWeek.get(b)!.length - seatsByWeek.get(a)!.length || a.localeCompare(b))[0];
    const seats = seatsByWeek.get(typical)!;
    const zero = new Map(teams.map(t => [t.id, 0]));
    for (const x of weekOf(seats, seats.length, seats.filter(y => y.slot.prime).length, zero, zero)) remember(memOf(x.placerId), x.slot, 2, keysOf.get(x.slot)!);
    memoryWeeks = 2;
  }

  let cumSeats = 0, cumPrime = 0;
  for (const week of weeks) {
    const seats = seatsByWeek.get(week)!;
    cumSeats += seats.length;
    cumPrime += seats.filter(x => x.slot.prime).length;
    // Commit the week: who has each slot (a kept one as it stands), what it counts toward their shares, each placer's
    // memory, and the starts and facilities it held this week (Moved around asks "not the same as last week").
    const nowHeld = new Map<string, Set<string>>();
    for (const { slot: s, teamIds, placerId } of weekOf(seats, cumSeats, cumPrime)) {
      if (!fixed.has(s.key)) assignments.set(s.key, [...teamIds]);
      for (const t of teamIds) {
        have.set(t, have.get(t)! + worth(s));
        if (s.prime) havePrime.set(t, havePrime.get(t)! + worth(s));
        daysHeld.get(t)!.add(s.day);
      }
      const k = keysOf.get(s)!;
      remember(memOf(placerId), s, 1, k);
      const held = nowHeld.get(placerId) ?? nowHeld.set(placerId, new Set()).get(placerId)!;
      held.add(k.lastTime); held.add(k.lastFac);
    }
    memoryWeeks += 1;
    lastWeek = nowHeld;
  }

  return measure(input, prep, rules, assignments, strategy, round);
}

// ── 6. What a draft says about itself ────────────────────────────────────────────────────────────

function measure(input: EngineInput, prep: ReturnType<typeof prepare>, rules: Rules, assignments: Map<string, string[]>, strategy: DraftStrategy, round: number): Draft {
  const { teams, slots, settings } = input;
  const { targets, sharing } = prep;
  const results = teamResults(slots, assignments, teams, targets);
  const shortList = results.filter(r => r.short > 0).map(r => ({ teamId: r.teamId, short: r.short }));
  const counts = [...new Set(results.map(r => r.got))];
  const measures: DraftMeasure[] = [{ kind: 'shares', allMet: !shortList.length, sameCount: counts.length === 1 ? counts[0] : null, short: shortList }];
  // The sharing rules a shared slot came from — "9U AA and 11U AA share a facility: half a facility each".
  const usedRules = new Set<number>();
  for (const s of slots) {
    const on = assignments.get(s.key) ?? [];
    const p = on.length > 1 ? sharing.poolOf.get(on[0]) : undefined;
    if (p !== undefined) usedRules.add(p);
  }
  if (usedRules.size) {
    measures.push({ kind: 'sharing', rules: [...usedRules].sort((a, b) => a - b).map(i => ({ ...settings.rules.sharing[i] })) });
  }
  let primeSpread = 0;
  if (settings.prime && results.length) {
    const primes = results.map(r => r.prime);
    const min = Math.min(...primes), max = Math.max(...primes);
    primeSpread = max - min;
    const low = results.find(r => r.prime === min && max - min > 1);
    measures.push({ kind: 'prime', min, max, rotated: settings.timeMode === 'moved', lowTeamId: low?.teamId ?? null });
  }
  const ratio = nightsRatio(slots, assignments, teams);
  measures.push({ kind: 'nights', same: ratio >= 0.85, ratio });
  let earlySpread = 0;
  if (settings.timeMode === 'moved') {
    // How evenly early and late fell: the early starts of the teams with the most usual count of practices ("12 or 13
    // early starts each" of the dome's 25), and every team within one of half of its own.
    const playing = results.filter(r => r.got >= 2);
    const tally = new Map<number, number>();
    for (const r of playing) tally.set(r.got, (tally.get(r.got) ?? 0) + 1);
    const of = [...tally].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 0;
    const theirs = playing.filter(r => r.got === of).map(r => r.early);
    const off = (r: TeamResult) => Math.abs(r.early - r.got / 2);
    const worst = [...playing].sort((a, b) => off(b) - off(a))[0];
    const even = !worst || off(worst) <= Math.max(1, worst.got * 0.1);
    earlySpread = playing.length ? playing.reduce((n, r) => n + Math.abs(2 * r.early / r.got - 1), 0) / playing.length : 0;
    measures.push({ kind: 'early', min: theirs.length ? Math.min(...theirs) : 0, max: theirs.length ? Math.max(...theirs) : 0, of, even, lowTeamId: even ? null : worst?.teamId ?? null });
    const teamById = new Map(teams.map(t => [t.id, t]));
    /** Whether the team's rules leave it a second facility to take in turn — stops at the second one found. */
    const movable = (teamId: string) => {
      const team = teamById.get(teamId);
      let first: string | null = null;
      for (const s of team ? slots : []) {
        if (!rules.eligible(team!, s)) continue;
        const k = facKey(s);
        if (first === null) first = k; else if (k !== first) return true;
      }
      return false;
    };
    measures.push({ kind: 'facilities', turned: playing.every(r => r.facilities >= 2 || !movable(r.teamId)) });
  }
  const heldKeys = settings.rules.avoidBookings ? slots.filter(s => input.held.has(s.key) && !input.fixed.has(s.key)) : [];
  if (heldKeys.length) {
    const holders = heldKeys.map(s => input.held.get(s.key)!);
    const kinds = [...new Set(holders.map(h => h.kind ?? null))];
    measures.push({ kind: 'held', count: heldKeys.length, owners: [...new Set(holders.map(h => h.ownerName))], what: kinds.length === 1 ? kinds[0] : null });
  }
  if (strategy === 'youngest') {
    const aged = teams.filter(t => t.age !== null).sort((a, b) => a.age! - b.age!);
    const young = aged.slice(0, Math.ceil(aged.length / 2));
    const latest = slots.filter(s => (assignments.get(s.key) ?? []).some(t => young.some(y => y.id === t)))
      .reduce((m, s) => (s.startClock > m ? s.startClock : m), '00:00');
    if (young.length) measures.push({ kind: 'youngest', teamIds: young.map(t => t.id), latestStart: latest });
  }
  const seats = prep.weeks.reduce((n, w) => n + prep.seatsByWeek.get(w)!.length, 0);
  const handedOut = [...assignments.values()].filter(l => l.length > 0).length;
  const open = Math.max(0, seats - handedOut);
  if (open > 0) measures.push({ kind: 'open', count: open });
  const sumTargets = results.reduce((n, r) => n + r.target, 0);
  const shortTotal = shortList.reduce((n, s) => n + s.short, 0);
  const score = Math.max(0, Math.min(100, Math.round(100
    - 40 * (shortTotal / Math.max(1, sumTargets))
    - 2 * Math.max(0, primeSpread - 1)
    - 8 * (1 - ratio)
    - 4 * valueImbalance(results.filter(r => !r.shared))
    - 10 * earlySpread)));
  return {
    strategy, round, score, assignments, teams: results, measures, warnings: capWarnings(input, targets),
    totals: { slots: slots.length, seats, handedOut, open, held: heldKeys.length },
  };
}

/** Each team's slots, prime time, units, hours, what its time is worth, its early starts and facilities, its nights —
 *  against its targets. Usable over any assignment (the page reads a saved schedule through it). */
export function teamResults(
  slots: readonly Slot[],
  assignments: ReadonlyMap<string, readonly string[]>,
  teams: readonly EngineTeam[],
  targets?: Pick<ShareTargets, 'slots' | 'prime' | 'counts'>,
): TeamResult[] {
  const out = new Map<string, TeamResult>(teams.map(t => [t.id, {
    teamId: t.id, target: targets?.slots.get(t.id) ?? 0, got: 0, primeTarget: targets?.prime.get(t.id) ?? 0, prime: 0,
    units: 0, shared: 0, minutes: 0, pricedMinutes: 0, early: 0, facilities: 0, nights: [], short: 0,
  }]));
  // Each day's starts, in clock order: a start in the earlier half of its day's is an early one.
  const startsOf = new Map<string, Set<string>>();
  for (const s of slots) (startsOf.get(s.day) ?? startsOf.set(s.day, new Set()).get(s.day)!).add(s.startClock);
  const earlyOf = new Map<string, Set<string>>();
  for (const [day, set] of startsOf) { const list = [...set].sort(); earlyOf.set(day, new Set(list.slice(0, Math.floor(list.length / 2)))); }
  const dayCount = new Map<string, Map<number, number>>(), weeksOf = new Map<string, Set<string>>(), facsOf = new Map<string, Set<string>>();
  for (const s of slots) {
    const on = assignments.get(s.key) ?? [];
    for (const t of on) {
      const r = out.get(t);
      if (!r) continue;
      const m = (s.endMs - s.startMs) / MIN;
      r.got++; r.minutes += m;
      r.units += 1 / on.length;
      if (on.length > 1) r.shared++;
      // The bill's own split (`pricedMinutes`): a shared slot's time is split among its teams.
      r.pricedMinutes += m * s.weight / on.length;
      if (s.prime) r.prime++;
      if (earlyOf.get(s.day)?.has(s.startClock)) r.early++;
      (facsOf.get(t) ?? facsOf.set(t, new Set()).get(t)!).add(facKey(s));
      const dc = dayCount.get(t) ?? new Map<number, number>();
      dc.set(s.weekday, (dc.get(s.weekday) ?? 0) + 1);
      dayCount.set(t, dc);
      weeksOf.set(t, (weeksOf.get(t) ?? new Set()).add(s.week));
    }
  }
  for (const r of out.values()) {
    r.short = targets?.counts === 'units' ? Math.max(0, Math.ceil(r.target - r.units - EPS)) : Math.max(0, r.target - r.got);
    r.facilities = facsOf.get(r.teamId)?.size ?? 0;
    const weeks = weeksOf.get(r.teamId)?.size ?? 0;
    // Its nights: the weekdays it has in at least half the weeks it plays.
    r.nights = [...(dayCount.get(r.teamId) ?? new Map<number, number>()).entries()]
      .filter(([, n]) => n * 2 >= weeks).map(([d]) => d).sort((a, b) => a - b);
  }
  return [...out.values()];
}

/** The share of team-weeks whose weekdays are that team's usual set — "the same nights every week". */
function nightsRatio(slots: readonly Slot[], assignments: ReadonlyMap<string, readonly string[]>, teams: readonly EngineTeam[]): number {
  const perTeamWeek = new Map<string, Map<string, Set<number>>>();
  for (const s of slots) for (const t of assignments.get(s.key) ?? []) {
    const weeks = perTeamWeek.get(t) ?? new Map<string, Set<number>>();
    weeks.set(s.week, (weeks.get(s.week) ?? new Set()).add(s.weekday));
    perTeamWeek.set(t, weeks);
  }
  let same = 0, all = 0;
  for (const t of teams) {
    const weeks = perTeamWeek.get(t.id);
    if (!weeks) continue;
    const tally = new Map<string, number>();
    for (const set of weeks.values()) { const k = [...set].sort().join(); tally.set(k, (tally.get(k) ?? 0) + 1); }
    same += Math.max(...tally.values());
    all += weeks.size;
  }
  return all ? same / all : 1;
}

/** How unevenly teams with the same count of slots were valued (0 = evenly), the worst group. */
function valueImbalance(results: readonly TeamResult[]): number {
  let worst = 0;
  const byCount = new Map<number, TeamResult[]>();
  for (const r of results) if (r.got) (byCount.get(r.got) ?? byCount.set(r.got, []).get(r.got)!).push(r);
  for (const list of byCount.values()) {
    if (list.length < 2) continue;
    const v = list.map(r => r.pricedMinutes / r.minutes);
    worst = Math.max(worst, Math.max(...v) - Math.min(...v));
  }
  return worst;
}

/** A weekly cap that holds a group (or an ungrouped team) under its share — reported, with what it lets it take. */
function capWarnings(input: EngineInput, targets: ShareTargets): ShareWarning[] {
  const cap = input.settings.rules.maxPerWeek;
  if (cap == null || input.settings.split.method === 'weekly') return [];
  const { method, values } = input.settings.split;
  const groups = new Map<string, EngineTeam[]>();
  for (const t of input.teams) { if (t.many) continue; const k = groupKey(t); (groups.get(k) ?? groups.set(k, []).get(k)!).push(t); }
  const out: ShareWarning[] = [];
  for (const list of groups.values()) {
    const wanted = list.reduce((n, t) => {
      const share = method === 'even' ? 1 / input.teams.length : (values[t.id] ?? 0) / 100;
      return n + Math.round(targets.capacity * share);
    }, 0);
    const allowed = list.length * cap * targets.weeks;
    if (allowed < wanted) {
      out.push({ kind: 'cap_holds_share', groupId: list[0].groupId, teamIds: list.map(t => t.id), cap, percent: Math.round(100 * allowed / Math.max(1, targets.capacity)) });
    }
  }
  return out;
}

// ── 7. The grid's helpers: which weeks a move reaches (Ask 13), the one refusal, fairness ──────────

export type WeeksScope = 'this' | 'later' | 'every';

export interface SlotEdit { slotKey: string; teamIds: string[] }
export interface PlannedMove { edits: SlotEdit[]; moved: string[]; skipped: { week: string; why: 'not_theirs' | 'no_slot' | 'full' | 'already_there' }[] }

/**
 * A TEAM DRAGGED FROM ONE SLOT TO ANOTHER, over the weeks the drop asks about (Ask 13: This week only · This & later
 * weeks · Every week). In each week in scope, the team's slot at the source's place in the week moves to the slot at
 * the target's place in the same week: into the target when it has room for the team (an open slot, or a partner of
 * its sharing rule with room — `slotHolds`, Stage 11c), or SWAPPED with the one team there. A week where it can't — the
 * team isn't in the source that week, the target has no slot (a date off), or the target is full — is skipped and
 * named. The server re-validates the result (`teamTwice`, and each slot's room).
 */
export function planMove(
  slots: readonly Slot[],
  assignments: ReadonlyMap<string, readonly string[]>,
  move: { fromKey: string; toKey: string; teamId: string; scope: WeeksScope; sharing: { pools: readonly SharingPool[]; poolOf: ReadonlyMap<string, number> } },
): PlannedMove {
  const from = slots.find(s => s.key === move.fromKey), to = slots.find(s => s.key === move.toKey);
  const out: PlannedMove = { edits: [], moved: [], skipped: [] };
  if (!from || !to) return out;
  const atPos = new Map(slots.map(s => [`${s.week}|${s.pos}`, s]));
  const weeks = [...new Set(slots.map(s => s.week))].sort()
    .filter(w => move.scope === 'every' || (move.scope === 'this' ? w === from.week : w >= from.week));
  const edits = new Map<string, string[]>();
  const teamsOf = (k: string) => edits.get(k) ?? [...(assignments.get(k) ?? [])];
  for (const w of weeks) {
    const src = atPos.get(`${w}|${from.pos}`), dst = atPos.get(`${w}|${to.pos}`);
    if (!src || !teamsOf(src.key).includes(move.teamId)) { out.skipped.push({ week: w, why: 'not_theirs' }); continue; }
    if (!dst) { out.skipped.push({ week: w, why: 'no_slot' }); continue; }
    const dstTeams = teamsOf(dst.key);
    // Already in the target that week (two teams at once): moving would put it in one slot twice.
    if (dstTeams.includes(move.teamId)) { out.skipped.push({ week: w, why: 'already_there' }); continue; }
    const srcTeams = teamsOf(src.key).filter(t => t !== move.teamId);
    const landing = moveLanding({ teamIds: teamsOf(src.key), weight: src.weight }, { teamIds: dstTeams, weight: dst.weight }, move.teamId, move.sharing);
    if (landing?.kind === 'into') {
      edits.set(src.key, srcTeams);
      edits.set(dst.key, [...dstTeams, move.teamId]);
    } else if (landing?.kind === 'swap') {
      edits.set(src.key, [...srcTeams, dstTeams[0]]);
      edits.set(dst.key, [move.teamId]);
    } else { out.skipped.push({ week: w, why: 'full' }); continue; }
    out.moved.push(w);
  }
  out.edits = [...edits].map(([slotKey, teamIds]) => ({ slotKey, teamIds }));
  return out;
}

/** THE SCHEDULE'S OWN RULE — the one refusal: a team in two overlapping slots. The first, or null. */
export function teamTwice(
  slots: readonly Pick<Slot, 'key' | 'startMs' | 'endMs'>[],
  assignments: ReadonlyMap<string, readonly string[]>,
): { teamId: string; a: string; b: string } | null {
  const byTeam = new Map<string, Pick<Slot, 'key' | 'startMs' | 'endMs'>[]>();
  for (const s of slots) for (const t of assignments.get(s.key) ?? []) (byTeam.get(t) ?? byTeam.set(t, []).get(t)!).push(s);
  for (const [teamId, list] of byTeam) {
    const sorted = [...list].sort((a, b) => a.startMs - b.startMs);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].startMs < sorted[i - 1].endMs) return { teamId, a: sorted[i - 1].key, b: sorted[i].key };
    }
  }
  return null;
}

/** Each team's week, by weekday, for "Keep each team's nights" — exported for the words (the email's pattern). */
export interface SlotPattern {
  weekday: number;
  startClock: string;
  endClock: string;
  venueId: string;
  facilityId: string | null;
  /** Its dates, in order. */
  days: string[];
}

/**
 * A team's slots AS A PATTERN (the email: "Sundays 8:00–9:30 a.m. · Field 2, Oct 4 – Mar 28, not Dec 27"): grouped by
 * weekday, time and place, each with its dates. The dates a pattern skips inside its run are the words' "not …".
 */
export function slotPatterns(slots: readonly Slot[], teamId: string, assignments: ReadonlyMap<string, readonly string[]>): SlotPattern[] {
  const map = new Map<string, SlotPattern>();
  for (const s of slots) {
    if (!(assignments.get(s.key) ?? []).includes(teamId)) continue;
    const k = s.pos;
    const p = map.get(k) ?? { weekday: s.weekday, startClock: s.startClock, endClock: s.endClock, venueId: s.venueId, facilityId: s.facilityId, days: [] };
    p.days.push(s.day);
    map.set(k, p);
  }
  return [...map.values()].sort((a, b) => a.weekday - b.weekday || a.startClock.localeCompare(b.startClock));
}

// ── 8. What changed since it was sent (Ask 14) ─────────────────────────────────────────────────────

/** A practice the club wrote, as it stands on a team's schedule (what the team was sent). */
export interface SentPractice { id: string; teamId: string; slotId: string; cancelled: boolean; startMs: number }
/** A slot as the comparison reads it: its stored id, its key and its week. */
export interface DiffSlot { id: string; key: string; week: string; startMs: number }

export interface SentDiff {
  /** A team's practice moved IN PLACE to another slot it now has in the same week (its arrival note and attendance go with it). */
  moves: { teamId: string; practiceId: string; toKey: string }[];
  /** A slot a team now has and no live practice for — written (`reinstate`: its cancelled practice comes back). */
  gains: { teamId: string; key: string; reinstate: boolean }[];
  /** A live practice whose slot the team no longer has (or whose slot is gone) — retired: cancelled when the coach worked
   *  on it, deleted when not (the database decides, in the step). */
  losses: { teamId: string; practiceId: string }[];
}

/**
 * THE DIFFERENCE between the slots as they stand and the practices the teams were sent. Wanted: each slot × its teams.
 * A team's lost practice and gained slot in the SAME WEEK are one move (paired in time order); a gained slot whose
 * cancelled practice exists for that team is a reinstatement, never paired (its own row comes back). Pure — the send
 * module turns it into the step's rows.
 */
export function diffAgainstSent(
  slots: readonly DiffSlot[],
  assignments: ReadonlyMap<string, readonly string[]>,
  practices: readonly SentPractice[],
  weekOfMs: (ms: number) => string,
): SentDiff {
  const byId = new Map(slots.map(s => [s.id, s]));
  const live = new Map<string, SentPractice>(), cancelled = new Set<string>();
  for (const p of practices) {
    const k = `${p.slotId}|${p.teamId}`;
    if (p.cancelled) cancelled.add(k); else live.set(k, p);
  }
  const losses = new Map<string, SentPractice[]>(), gains = new Map<string, DiffSlot[]>();
  for (const p of live.values()) {
    const slot = byId.get(p.slotId);
    if (!slot || !(assignments.get(slot.key) ?? []).includes(p.teamId)) (losses.get(p.teamId) ?? losses.set(p.teamId, []).get(p.teamId)!).push(p);
  }
  for (const s of slots) for (const t of assignments.get(s.key) ?? []) {
    if (!live.has(`${s.id}|${t}`)) (gains.get(t) ?? gains.set(t, []).get(t)!).push(s);
  }
  const out: SentDiff = { moves: [], gains: [], losses: [] };
  for (const t of new Set([...losses.keys(), ...gains.keys()])) {
    const lost = (losses.get(t) ?? []).sort((a, b) => a.startMs - b.startMs).map(p => ({ p, week: weekOfMs(p.startMs) }));
    for (const g of (gains.get(t) ?? []).sort((a, b) => a.startMs - b.startMs)) {
      const reinstate = cancelled.has(`${g.id}|${t}`);
      const pair = reinstate ? undefined : lost.find(l => l.week === g.week);
      if (pair) {
        lost.splice(lost.indexOf(pair), 1);
        out.moves.push({ teamId: t, practiceId: pair.p.id, toKey: g.key });
      } else out.gains.push({ teamId: t, key: g.key, reinstate });
    }
    for (const l of lost) out.losses.push({ teamId: t, practiceId: l.p.id });
  }
  return out;
}
