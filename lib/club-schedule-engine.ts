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
import { WHOLE, maskOf, maskProp, maskRank, maskSuffix, partFactor, partsOverlap, samePlace } from './field-parts';

const MIN = 60_000;

// ── 1. The slots ─────────────────────────────────────────────────────────────────────────────────

/** A schedule's block: a block of time, and the permit it came from (`org_time_blocks.from_permit_id`, mig 487) — null or
 *  absent for time typed by hand or copied. A slot cut from it is priced by that permit (a schedule on several permits).
 *  `parts` (Club schedules Stage 2, mig 541): for a field the row names in PARTS, which (`section_mask`, quarter units —
 *  lib/field-parts.ts); a field it doesn't list is named whole. `facilityIds` names each field once either way. */
export type ScheduleBlock = TimeBlock & { permitId?: string | null; parts?: Readonly<Record<string, readonly number[]>> | null };

/** A schedule's time: its own blocks and dates off (`org_time_blocks.schedule_id`, `org_time_dates_off.schedule_id`). */
export interface ScheduleTime {
  startsOn: string;
  endsOn: string;
  blocks: readonly ScheduleBlock[];
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
  /** What an hour of it is worth against a full field: its row's permit's share (1 = Full, 0.5 = Half) × how much of the
   *  field its part holds (`slotWeight` — the one place it is worked out). */
  weight: number;
  /** The permit its row came from (null: typed by hand, priced by the schedule's fallback price permit). */
  permitId?: string | null;
  /** The field's part it stands on (Club schedules Stage 2, `section_mask`, quarter units — lib/field-parts.ts). 0 or
   *  absent: the whole field. A part holds one team, never shared (its weight is under 1). */
  sectionMask?: number;
}

/** A facility's price SHARE — on the permit a row came from (`permitId`), else the schedule's price permit. Never a slot's
 *  weight by itself: a part's weight is `slotWeight`. */
export type WeightOf = (facilityId: string | null, permitId?: string | null) => number;

/**
 * THE ONE WEIGHT (Club schedules Stage 2, plan §5; round 1 Ask 3 A, round 2 Ask 3 A): the field's share on the row's permit
 * × how much of the field the part holds (a side or a half ½, a quarter ¼; a quarter of a "Half cost" field ⅛). Every
 * site that weighs a slot calls this — the cut, a stored slot rebuilt, a kept slot, the coach's card, the hand edit's
 * room — and none writes its own arithmetic (`tests/unit/club-schedule-several-permits-guard.test.ts`).
 */
export const slotWeight = (shareOf: WeightOf, facilityId: string | null, sectionMask: number | null | undefined, permitId: string | null | undefined): number =>
  shareOf(facilityId, permitId ?? null) * partFactor(sectionMask);

/** A slot's place and start: venue · facility · start, and its part when it stands on one. A whole field's key is the
 *  key it always had, so a schedule with no split field keys every slot exactly as before. */
export const slotKeyOf = (venueId: string, facilityId: string | null, startMs: number, sectionMask: number | null | undefined = WHOLE) =>
  `${venueId}|${facilityId ?? ''}|${startMs}${maskSuffix(sectionMask)}`;

/** A slot's place in a week — weekday, start, venue, facility, and its part — what "the same slot every week" means. */
export const slotPosOf = (weekday: number, startClock: string, venueId: string, facilityId: string | null, sectionMask: number | null | undefined = WHOLE) =>
  `${weekday}|${startClock}|${venueId}|${facilityId ?? ''}${maskSuffix(sectionMask)}`;

/** The cut's order, shared with the kept merge: by start, venue, the facility's place at its venue, then its part. */
export const slotOrder = (order: ReadonlyMap<string, number>) =>
  (a: Pick<Slot, 'startMs' | 'venueId' | 'facilityId' | 'sectionMask'>, b: Pick<Slot, 'startMs' | 'venueId' | 'facilityId' | 'sectionMask'>): number =>
    a.startMs - b.startMs || a.venueId.localeCompare(b.venueId)
    || (order.get(a.facilityId ?? '') ?? 0) - (order.get(b.facilityId ?? '') ?? 0) || maskRank(a.sectionMask) - maskRank(b.sectionMask);

/** How much of its field a slot holds (1 whole, ½ a side, ¼ a quarter): what it counts toward a share (round 1 Ask 2 A). */
export const slotSize = (s: Pick<Slot, 'sectionMask'>) => partFactor(s.sectionMask);

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
  /** The facility's price share on the block's permit (or the schedule's); 1 when there is no permit. */
  weightOf?: WeightOf;
}): Slot[] {
  const asPermit = { id: 'schedule', startsOn: time.startsOn, endsOn: time.endsOn, blocks: time.blocks, datesOff: time.datesOff };
  const len = opts.slotMinutes, step = opts.slotMinutes + opts.changeoverMinutes;
  const order = new Map<string, number>();
  for (const list of opts.venueFacilities.values()) list.forEach((f, i) => order.set(f, i));
  const out = new Map<string, Slot>();
  // The parts cut so far on each field (Stage 2): a part is never cut over ground another slot of the cut already holds
  // at an overlapping time — two rows holding one piece of ground are refused before the cut (`overlappingBlocks`), so
  // this only guards; the database's floor refuses it too, but a refusal there reads "changed" to the club, never a builder's
  // sentence. Whole fields keep the key's own rule (one slot per place and start), exactly as before.
  // Only a field some row names in parts is watched; every other place is cut exactly as before.
  const split = new Set(time.blocks.flatMap(b => Object.entries(b.parts ?? {}).filter(([, m]) => m?.length).map(([f]) => `${b.venueId}|${f}`)));
  // Keyed by field and day: two slots can only overlap on the same day, so each check reads one night's parts.
  const partsOn = new Map<string, { startMs: number; endMs: number; mask: number }[]>();
  const shareOf = opts.weightOf ?? (() => 1);
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
          // A field the row names in parts is cut once per part (round 2 Ask 2 A); otherwise whole, as it always was.
          const masks = unit ? block.parts?.[unit] : undefined;
          for (const raw of masks?.length ? masks : [WHOLE]) {
            const mask = maskOf(raw);
            const key = slotKeyOf(block.venueId, unit, startMs, mask);
            if (out.has(key)) continue;
            if (split.size && split.has(`${block.venueId}|${unit ?? ''}`)) {
              const ground = `${block.venueId}|${unit ?? ''}|${day}`;
              const cut = partsOn.get(ground) ?? partsOn.set(ground, []).get(ground)!;
              if (cut.some(x => x.startMs < endMs && startMs < x.endMs && partsOverlap(x.mask, mask))) continue;
              cut.push({ startMs, endMs, mask });
            }
            out.set(key, {
              key, venueId: block.venueId, facilityId: unit, blockIndex, day, weekday, week, startClock, endClock,
              startMs, endMs, pos: slotPosOf(weekday, startClock, block.venueId, unit, mask),
              prime: isPrimeSlot(opts.prime, weekday, startClock, endClock),
              weight: slotWeight(shareOf, unit, mask, block.permitId ?? null),
              ...(block.permitId ? { permitId: block.permitId } : {}),
              ...maskProp(mask),
            });
          }
        }
      }
    }
  });
  return [...out.values()].sort(slotOrder(order));
}

// ── 2. What the books already hold ────────────────────────────────────────────────────────────────

/** A booking already on the books at one of the club's venues (the clash pool's `ClubBooking` fits). */
export interface PoolBooking {
  key: string;
  venueId: string | null;
  facilityId: string | null;
  /** The part of its field it holds (Stage 2; 0 or absent: the whole field). */
  sectionMask?: number | null;
  startMs: number;
  endMs: number;
  ownerName: string;
  /** What it is (the clash rule's kind: practice · game · tryout · team_event), for "13U AAA's tryout day". */
  kind?: string | null;
  /** Another schedule's FINAL slot only (Session 2D): since when it has held the time. Absent on a booking. */
  heldSince?: number | null;
  /** A house-league game on one of the asking schedule's OWN slots (`heldSlots` says what it still holds). */
  ownGame?: boolean;
}

/** One slot's identity on the books: its place, part and start. */
const placeStart = (s: { venueId: string | null; facilityId: string | null; sectionMask?: number | null; startMs: number }) =>
  `${s.venueId}|${s.facilityId ?? ''}|${maskOf(s.sectionMask)}|${s.startMs}`;

/**
 * The slots a booking already holds: at the slot's venue, overlapping it, on its facility (or the venue itself). A
 * booking with no facility set holds nothing here — it is "busy then", the clash rule's softer finding, which the
 * calendar still marks; holding every field for it would hand out none of them.
 *
 * ⚖ THE SCHEDULE'S OWN GAMES (`ownGame`) never hold the slot they sit on, or a regenerate would drop it from house league.
 * Where that slot is still among `slots` (same place, part and start) the game stays where it is, so it holds any OTHER
 * slot it runs into (a slot cut shorter than its game). Where it isn't, the game moves or leaves with its time when the
 * changes are sent, and holds nothing.
 */
export function heldSlots(
  slots: readonly Slot[], bookings: readonly PoolBooking[],
  /** Since when the asking schedule has held a slot (null or absent: not yet, so every final schedule takes it). */
  mineSince?: (s: Slot) => number | null | undefined,
): Map<string, PoolBooking> {
  const bucket = byVenueDay(bookings);
  const out = new Map<string, PoolBooking>();
  const cutAt = new Set(slots.map(placeStart));
  for (const s of slots) {
    // The earliest booking in the list wins (engineContext lists the bookings before other schedules' slots, so a team's
    // practice on another schedule's slot is the name said).
    let hit = -1;
    const mine = mineSince?.(s);
    const here = placeStart(s);
    const stays = (b: PoolBooking) => !b.ownGame || (cutAt.has(placeStart(b)) && placeStart(b) !== here);
    const takes = (b: PoolBooking) => stays(b) && (b.heldSince === undefined || takesFrom({ state: 'final', heldSince: b.heldSince }, mine));
    for (const k of venueDays(s.venueId, s.startMs, s.endMs)) {
      for (const i of bucket.get(k) ?? []) {
        if (hit !== -1 && i >= hit) break;
        if (onSlot(s, bookings[i]) && takes(bookings[i])) { hit = i; break; }
      }
    }
    if (hit !== -1) out.set(s.key, bookings[hit]);
  }
  return out;
}

/**
 * Does another schedule's FINAL slot take a slot of the asking schedule (Session 2D)? Whichever is finalized first keeps
 * it, judged slot by slot: time the asker does not hold as a final schedule (New schedule, a draft, Add time's new part,
 * and time a final schedule is only now gaining) is taken by every final slot; time it already holds, only by one held
 * since before — a later one never takes it (that one shows the clash instead).
 */
export const takesFrom = (s: { state: string; heldSince: number | null }, mineSince: number | null | undefined): boolean =>
  s.state === 'final' && (mineSince == null || (s.heldSince != null && s.heldSince < mineSince));

/** Time another schedule's DRAFT holds (Stage 2, Session 2D): its place and time, and the draft's name. */
export interface DraftHold {
  venueId: string;
  facilityId: string | null;
  sectionMask?: number | null;
  startMs: number;
  endMs: number;
  by: string;
}

/**
 * The drafts on each slot: every other schedule's draft holding its ground at an overlapping time, by name. Booked
 * nowhere, so it never takes the slot (whichever schedule is finalized first keeps the time); the drafts step warns on
 * the slots a draft gives there. A side the draft holds leaves the other side unwarned.
 */
export function draftsOn(slots: readonly Slot[], drafts: readonly DraftHold[]): Map<string, string[]> {
  const bucket = byVenueDay(drafts);
  const out = new Map<string, string[]>();
  for (const s of slots) {
    const by = new Set<string>();
    for (const k of venueDays(s.venueId, s.startMs, s.endMs)) {
      for (const i of bucket.get(k) ?? []) if (onSlot(s, drafts[i])) by.add(drafts[i].by);
    }
    if (by.size) out.set(s.key, [...by].sort((a, b) => a.localeCompare(b)));
  }
  return out;
}

/** The bucket keys of the days a span at a venue touches (400 at most: a bad end never runs away). */
function venueDays(venueId: string, startMs: number, endMs: number): string[] {
  const dayOf = (ms: number) => Math.floor(ms / DAY_MS);
  const out: string[] = [];
  for (let d = dayOf(startMs), last = dayOf(Math.max(startMs, endMs - 1)); d <= last && out.length < 400; d++) out.push(`${venueId}|${d}`);
  return out;
}

/** Overlapping in time, on the slot's ground (or anywhere at a venue with no facilities). */
const onSlot = (s: Slot, b: { facilityId: string | null; sectionMask?: number | null; startMs: number; endMs: number }) =>
  b.startMs < s.endMs && s.startMs < b.endMs && (s.facilityId === null || samePlace(b, s));

/** Bucketed by venue and day, so a slot reads only its own day's bookings (a season's slots against every booking at the
 *  club's venues would otherwise be millions of comparisons). Each list keeps the input's order, as INDEXES (heldSlots'
 *  "earliest wins" reads them), and a day is a UTC day: a slot and a booking are bucketed by the same clock, which is all
 *  the lookup needs — so this is not `permit-time`'s club-day `bucketByDay`. */
function byVenueDay(list: readonly { venueId: string | null; startMs: number; endMs: number }[]): Map<string, number[]> {
  const bucket = new Map<string, number[]>();
  list.forEach((b, i) => {
    if (!b.venueId) return;
    for (const k of venueDays(b.venueId, b.startMs, b.endMs)) {
      const at = bucket.get(k);
      if (at) at.push(i); else bucket.set(k, [i]);
    }
  });
  return bucket;
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

export function shareTargets(teams: readonly EngineTeam[], settings: Pick<ScheduleSettings, 'split' | 'prime' | 'rules'>, counted: {
  capacity: number; primeCapacity: number; weeks: number;
  /** `seatCounts`' units (Stage 2: a part counts its size). Absent: the count. */
  units?: number; primeUnits?: number;
}, opts: {
  /** A team's slot size (`teamSlotSize`): its practices are its units ÷ it — a team kept on quarters holds four practices
   *  for each whole-field one (the Slots column). Absent: 1. */
  sizeOf?: (teamId: string) => number;
} = {}): ShareTargets {
  // Under Evenly and By percentage the shares divide the time in UNITS (a part its size); a set number a week counts
  // practices whatever their size.
  const seats = { capacity: counted.units ?? counted.capacity, primeCapacity: counted.primeUnits ?? counted.primeCapacity, weeks: counted.weeks };
  // With parts the shares are handed out in quarters (12.5% of 60 units is 7.5 each, never 8/8/7/7); without, whole slots.
  const grain = counted.units != null && Math.abs(counted.units - counted.capacity) > 1e-9 ? 4 : 1;
  const apportion = (total: number, ts: readonly EngineTeam[], w: (t: EngineTeam) => number, o?: Parameters<typeof apportionByGroup>[3]) =>
    grain === 1 ? apportionByGroup(total, ts, w, o) : new Map([...apportionByGroup(Math.round(total * grain), ts, w, o)].map(([k, v]) => [k, v / grain]));
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
    const total = Math.min(seats.capacity, Math.round(seats.capacity * grain * Math.min(percent, 100) / 100) / grain);
    slots = apportion(total, teams, valueOf);
    // A weekly cap holds a share down (reported by `capWarnings`, never broken).
    if (settings.rules.maxPerWeek != null) {
      for (const t of teams) if (!t.many) slots.set(t.id, Math.min(slots.get(t.id)!, settings.rules.maxPerWeek * seats.weeks));
    }
  }
  // What the shares come to once sharing is worked out: each rule's teams matched (a set number a week matches one
  // week and repeats it — its figure is a week's), everyone else alone.
  const sizeOf = (id: string) => (counts === 'units' ? opts.sizeOf?.(id) ?? 1 : 1);
  const practices = new Map(teams.map(t => [t.id, Math.round(slots.get(t.id)! / sizeOf(t.id))]));
  let handedOut = 0;
  for (const t of teams) if (!sharesAny(sharing, t.id)) handedOut += practices.get(t.id)!;
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
    primeTotal = Math.min(seats.primeCapacity, Math.round(seats.primeCapacity * grain * percent / 100) / grain, handedOut);
  }
  const prime = settings.prime?.share === 'even'
    ? apportion(primeTotal, teams, () => 1, { flat: true, tieFewerFirst: slots })
    : apportion(primeTotal, teams, valueOf, { tieFewerFirst: slots });
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
interface Placer { id: string; teams: EngineTeam[]; quota: number; primeQuota: number;
  /** A team on its own: the units it is owed this week (Stage 2: its slots may be parts, so its quota alone can't say). */
  units?: number }

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
  capacity: number; primeCapacity: number; weeks: number; units: number; primeUnits: number;
} {
  const open = settings.rules.avoidBookings ? slots.filter(s => !held.has(s.key) || kept.has(s.key)) : slots;
  const sum = (list: readonly Slot[]) => list.reduce((n, s) => n + slotSize(s), 0);
  const prime = open.filter(s => s.prime);
  return {
    capacity: open.length,
    primeCapacity: prime.length,
    weeks: new Set(open.map(s => s.week)).size,
    // What the shares divide (Stage 2): a slot counts its size — a side ½, a quarter ¼ (round 1 Ask 2 A, round 2 Ask 3 A).
    // Without a split field, the count itself.
    units: sum(open),
    primeUnits: sum(prime),
  };
}

/**
 * A TEAM'S SLOT SIZE (Stage 2): the biggest slot it may stand on — 1 when any whole field is open to it, ½ when
 * "Facilities for a group" keeps it on sides, ¼ on quarters. What turns its share (units) into practices for the Slots
 * column and a short team's "30 of 40 slots". Only the facility rule is read: days and hours change when, not how big.
 */
export function teamSlotSize(slots: readonly Slot[], team: Pick<EngineTeam, 'id' | 'groupId'>, rules: Pick<ScheduleSettings['rules'], 'fieldsBy'>): number {
  const kept = new Map<string, { groups: Set<string>; teams: Set<string> }>();
  for (const f of rules.fieldsBy) for (const fac of f.facilityIds) {
    const k = kept.get(fac) ?? { groups: new Set<string>(), teams: new Set<string>() };
    f.groupIds.forEach(g => k.groups.add(g)); f.teamIds.forEach(t => k.teams.add(t));
    kept.set(fac, k);
  }
  let best = 0;
  for (const s of slots) {
    const k = s.facilityId ? kept.get(s.facilityId) : undefined;
    if (k && !k.teams.has(team.id) && !(team.groupId && k.groups.has(team.groupId))) continue;
    best = Math.max(best, slotSize(s));
    if (best >= 1) return 1;
  }
  return best || 1;
}

/** `teamSlotSize` for every team, as `shareTargets`' `sizeOf`: 1 for all without a part in the time, each team read once. */
export function teamSlotSizes(slots: readonly Slot[], teams: readonly Pick<EngineTeam, 'id' | 'groupId'>[], rules: Pick<ScheduleSettings['rules'], 'fieldsBy'>): (teamId: string) => number {
  if (!slots.some(s => slotSize(s) < 1)) return () => 1;
  const byId = new Map(teams.map(t => [t.id, t]));
  const memo = new Map<string, number>();
  return id => {
    let n = memo.get(id);
    if (n == null) memo.set(id, n = teamSlotSize(slots, byId.get(id) ?? { id, groupId: null }, rules));
    return n;
  };
}

/**
 * A WATER-FILL of `total` over positive deficits: one slot at a time to whoever is most behind (its deficit less what it
 * has been handed so far), ties by list order, each up to its cap; a slot nobody has room for is not handed.
 *
 * ⚠ Never whole parts in list order (F-O2-5): that gave the first teams quota they could not place and the rest nothing.
 * Weighted shares keep their weights: a bigger share is a bigger deficit, so it is behind first.
 */
function apportionDeficits(total: number, deficits: Map<string, number>, caps: Map<string, number>): Map<string, number> {
  const out = new Map<string, number>([...deficits.keys()].map(k => [k, 0]));
  const ids = [...deficits.keys()].filter(k => (deficits.get(k) ?? 0) > 0 && (caps.get(k) ?? 0) > 0);
  for (let left = total; left > 0; left--) {
    let best: string | null = null, gap = -Infinity;
    for (const k of ids) {
      if (out.get(k)! >= caps.get(k)!) continue;
      const g = deficits.get(k)! - out.get(k)!;
      if (g > gap + EPS) { best = k; gap = g; }
    }
    if (best === null) break;
    out.set(best, out.get(best)! + 1);
  }
  return out;
}

/**
 * HOW MANY OF `slots` ONE TEAM COULD HOLD — at most `maxPerDay` a day, never two at once (the most slots on a day that
 * don't overlap), and with no back-to-back days the best set of days none next to another or to a day in `heldDays`. A
 * ceiling, never a plan: the drafts cap a team's weekly quota at it, so a slot a team can't use goes to one that can, and
 * the form says what a per-day limit leaves open (`slotsTeamsCanHold`). `usable`: the slots this team may have at all.
 */
function placeableCount(slots: readonly Slot[], usable: (s: Slot) => boolean, maxPerDay: number, noBackToBack: boolean,
  heldDays: ReadonlySet<string> = new Set()): number {
  const byDay = new Map<string, Slot[]>();
  for (const s of slots) if (usable(s)) (byDay.get(s.day) ?? byDay.set(s.day, []).get(s.day)!).push(s);
  const perDay = new Map<string, number>();
  for (const [day, list] of byDay) {
    // The most that don't overlap: earliest finish first.
    let n = 0, end = -Infinity;
    for (const s of [...list].sort((a, b) => a.endMs - b.endMs)) if (s.startMs >= end) { n++; end = s.endMs; }
    perDay.set(day, Math.min(maxPerDay, n));
  }
  if (!noBackToBack) return [...perDay.values()].reduce((a, b) => a + b, 0);
  // No back-to-back days: the best days of the week, none next to another (a day next to one already held is out).
  let take = 0, skip = 0, prev: string | null = null;
  for (const d of [...perDay.keys()].sort()) {
    if (heldDays.has(addCalendarDays(d, -1)) || heldDays.has(addCalendarDays(d, 1))) continue;
    const v = perDay.get(d)!;
    const best = Math.max(take, skip);
    take = (prev !== null && addCalendarDays(prev, 1) === d ? skip : best) + v;
    skip = best;
    prev = d;
  }
  return Math.max(take, skip);
}

/**
 * WHAT A PER-DAY LIMIT LEAVES OPEN (Stage 13 fix-now 3; owner ruling 2026-11-06: a blank schedule keeps "1 practice per
 * team, per day", and the form says what that leaves open beside the setting). The most slots the ticked teams could hold
 * at `maxPerDay` (null: no daily limit), week by week: each team at most that many a day, never two at once, on the slots
 * it may have (a small max flow — a slot to one team). The page compares the setting's figure with no limit's to know the
 * setting is what leaves them open. Null when a team has no limit at all (a program) or when teams share a facility (a
 * shared slot holds two teams, which this count does not model — the sentence is never said on a guess).
 */
export function slotsTeamsCanHold(input: EngineInput, limit: number | null): number | null {
  return teamsCanHold(input, limit)?.total ?? null;
}

/**
 * The same count, and what EACH team could hold at the limit on its own (Club Tier 13c Session C, C5 = A: the Slots column
 * reads "25 of 65") — the team's own ceiling the flow starts from (placeableCount, the week's cap), before the teams
 * compete for slots, so a team's figure can be more than its part of the total when teams want the same slots. One walk for
 * both, so the column and the setting's hint can never disagree about a team's ceiling. Null where the count is.
 */
export function teamsCanHold(input: EngineInput, limit: number | null): { total: number; each: Map<string, number> } | null {
  const { settings, teams, fixed } = input;
  if (teams.some(t => t.many) || sharingPools(settings.rules.sharing, teams).pools.length > 0) return null;
  const maxPerDay = limit ?? 99;
  const rules = buildRules(input);
  const { weeks, seatsByWeek } = prepare(input);
  let total = 0;
  const each = new Map(teams.map(t => [t.id, 0]));
  for (const week of weeks) {
    const slots = seatsByWeek.get(week)!.map(x => x.slot);
    const usable = (t: EngineTeam) => (s: Slot) => (fixed.has(s.key) ? (fixed.get(s.key) ?? []).includes(t.id) : rules.eligible(t, s));
    // source 0 → team (its week's ceiling) → team-day (the limit) → slot → sink 1.
    let n = 2;
    const slotNode = new Map(slots.map(s => [s.key, n++]));
    const edges: [number, number, number][] = slots.map(s => [slotNode.get(s.key)!, 1, 1]);
    for (const t of teams) {
      const mine = slots.filter(usable(t));
      const cap = placeableCount(mine, () => true, maxPerDay, settings.rules.noBackToBack);
      if (cap <= 0) continue;
      const ceiling = Math.min(cap, settings.rules.maxPerWeek ?? Infinity);
      each.set(t.id, each.get(t.id)! + ceiling);
      const teamNode = n++;
      edges.push([0, teamNode, ceiling]);
      const dayNode = new Map<string, number>();
      for (const s of mine) {
        if (!dayNode.has(s.day)) { dayNode.set(s.day, n++); edges.push([teamNode, dayNode.get(s.day)!, maxPerDay]); }
        edges.push([dayNode.get(s.day)!, slotNode.get(s.key)!, 1]);
      }
    }
    const flow = new MinCostFlow(n);
    for (const [u, v, cap] of edges) flow.addEdge(u, v, cap, 0);
    total += flow.run(0, 1);
  }
  return { total, each };
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
  /** What a slot counts toward each of its teams' shares: its size (a side ½, a quarter ¼ — Stage 2) ÷ its teams. */
  const worth = (s: Slot) => (byUnits ? slotSize(s) / Math.max(1, (assignments.get(s.key) ?? []).length) : 1);
  /** The time has a part (Stage 2). Without one every step below runs exactly as it did. */
  const anyParts = slots.some(s => slotSize(s) < 1);
  /** The grain the shares are handed out in each week: one slot, or a quarter of one when the time has parts. */
  const grain = anyParts ? 4 : 1;
  /** The biggest slot of `seats` a team may have (1 without parts): how many slots its units come to. */
  const biggest = (t: EngineTeam, seats: readonly Seat[]) => {
    if (!anyParts) return 1;
    let best = 0;
    for (const x of seats) if (best < slotSize(x.slot) && (fixed.has(x.slot.key) || rules.eligible(t, x.slot))) best = slotSize(x.slot);
    return best || 1;
  };
  /** The units a list of seats is (its count without parts). */
  const unitsIn = (seats: readonly Seat[]) => (anyParts ? seats.reduce((n, x) => n + slotSize(x.slot), 0) : seats.length);

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

  /** The most of this week's slots a team could hold: its own kept ones, and the free ones its rules let it have. */
  const canPlace = (t: EngineTeam, seats: readonly Seat[]) =>
    placeableCount(seats.map(x => x.slot), s => (fixed.has(s.key) ? (assignments.get(s.key) ?? []).includes(t.id) : rules.eligible(t, s)),
      maxPerDay, settings.rules.noBackToBack, daysHeld.get(t.id));

  /**
   * This week's need, team by team — a set number a week, or each share's deficit so far (the shares hold every week) —
   * counted as the shares count, less what the week's kept slots already give it.
   */
  const needsFor = (seats: readonly Seat[], cumSeats: number, cumPrime: number, kept: Map<string, Seat[]>, have: Map<string, number>, havePrime: Map<string, number>) => {
    const need = new Map<string, number>(), primeNeed = new Map<string, number>();
    /** What the week means to hand out, counted as the shares count — the last pass's budget (2026-11-24). */
    let toHand = 0;
    if (settings.split.method === 'weekly') {
      for (const t of teams) need.set(t.id, Math.min(settings.split.values[t.id] ?? 0, t.many ? Infinity : maxPerWeek));
    } else {
      const ideal = new Map(teams.map(t => [t.id, targets.slots.get(t.id)! * cumSeats / Math.max(1, targets.capacity)]));
      const deficits = new Map(teams.map(t => [t.id, ideal.get(t.id)! - have.get(t.id)!]));
      // Rounded UP: a team that shares may be owed half a facility (units), which a whole cap of 0 would never hand it.
      // And never more than it can place THIS week (fix-now 3), so a slot a team can't use goes to a team that can.
      // With parts (Stage 2) the week is shared out in quarters: a team on a quarter is owed a quarter at a time, and a
      // cap counted in practices holds it to that many slots of its size.
      const caps = new Map(teams.map(t => [t.id, Math.min(Math.ceil((targets.slots.get(t.id)! - have.get(t.id)!) * grain - EPS),
        t.many ? Infinity : Math.min(maxPerWeek, canPlace(t, seats)) * grain * biggest(t, seats))]));
      toHand = Math.max(0, Math.min(unitsIn(seats),
        Math.round(([...ideal.values()].reduce((a, b) => a + b, 0) - [...have.values()].reduce((a, b) => a + b, 0)) * grain) / grain));
      const handed = apportionDeficits(Math.round(toHand * grain), new Map([...deficits].map(([k, v]) => [k, v * grain])), caps);
      const share = new Map([...handed].map(([k, v]) => [k, v / grain]));
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
    return { need, primeNeed, toHand };
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
        // Its need is units; its quota is slots of the biggest size it may have this week (Stage 2 — 1 without parts), so
        // it never takes more than it is owed. Landing on smaller ones leaves it under, which `topUp` places. Under "A set
        // number a week" the need is PRACTICES whatever their size (`shareTargets`), so it is never divided. With parts
        // the quota rounds DOWN (/review 2026-11-26: 0.75 owed on sides is one side, never two); without, as it always did.
        const size = byUnits ? biggest(t, free) : 1;
        const quota = Math.max(0, anyParts && byUnits ? Math.floor(need.get(t.id)! / size + EPS) : Math.round(need.get(t.id)! / size));
        out.push({ id: t.id, teams: [t], quota, primeQuota: primeOf([t.id], quota, size), units: need.get(t.id)! });
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
  const planWeek = (seats: readonly Seat[], kept: Map<string, Seat[]>, free: readonly Seat[], placers: readonly Placer[], hv: ReadonlyMap<string, number>, cum: number, toHand: number): Map<Seat, Placer> => {
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
      if (anyParts && byUnits) topUp(out, taken, placed, run);
      lastPass(out, taken, placed, run);
      return out;
    };

    /**
     * A TEAM THAT LANDED ON SMALLER SLOTS THAN ITS QUOTA ASSUMED (Stage 2): its quota was slots of the biggest size it
     * could have, so a team placed on sides or quarters is still owed units. It takes the rest from what is left, in
     * slots of the biggest size still open to it, a few rounds at most (sizes are 1, ½ and ¼). Only with parts and only
     * under Evenly or By percentage; a schedule with no split field never reaches it.
     */
    const topUp = (out: Map<Seat, Placer>, taken: Map<string, Seat[]>, placed: Map<Placer, number>, run: (pool: readonly Seat[], capOf: (p: Placer) => number, among: readonly Placer[]) => void) => {
      for (let round = 0; round < 3; round++) {
        const got = new Map<string, number>();
        for (const [seat, p] of out) if (p.teams.length === 1) got.set(p.teams[0].id, (got.get(p.teams[0].id) ?? 0) + slotSize(seat.slot));
        const left = free.filter(x => !out.has(x));
        if (!left.length) return;
        const more: Placer[] = [];
        for (const p of placers) {
          if (p.teams.length !== 1 || p.units == null || p.teams[0].many) continue;
          const t = p.teams[0];
          const owed = p.units - (got.get(t.id) ?? 0);
          const size = biggest(t, left);
          // Never past its week's cap, which counts practices (/review 2026-11-26).
          const quota = Math.min(maxPerWeek - (taken.get(t.id)?.length ?? 0), Math.floor(owed / size + EPS));
          if (quota > 0) more.push({ id: t.id, teams: [t], quota, primeQuota: 0 });
        }
        if (!more.length) return;
        const before = out.size;
        run(left, p => p.quota - (placed.get(p) ?? 0), more);
        if (out.size === before) return;
      }
    };

    /**
     * THE LAST PASS (owner 2026-11-24): a seat the week MEANT to hand out that its quota could not place goes to a team still
     * under its season share that may have it — the furthest behind its pace first, one slot at a time, never past its share
     * or its week's cap.
     *
     * Why it exists: the quota (`needsFor`) caps each team by what IT can place, never by what its group can. Milton's
     * winter dome promised its Rep teams 10 of a Sunday's 12 seats when 4 sat on fields kept for Select — 2 Rep promises
     * went unkept and 2 Select-field seats stayed open while Select teams owed time were free (8 open, 8 short, a season).
     * ⚠ THE WEEK'S OWN BUDGET, never more (/review 2026-11-24): it hands out only what the week meant to (`toHand`) less
     * what the week holds. Shares under 100% leave seats open on purpose; filling every open seat front-loaded a 48% schedule
     * (weeks 1–6 full, 7–12 empty), and a per-team pace instead left Milton's gap open.
     *
     * Not under "A set number a week" (a team gets its number, no more), never a prime seat while prime time has its own
     * share to keep (`settings.prime`), never a team in a sharing rule (its share is half a facility; a whole slot alone
     * would spend it twice as fast and skip pairing). A program holder (`many`) is left to its own count.
     */
    const lastPass = (out: Map<Seat, Placer>, taken: Map<string, Seat[]>, placed: Map<Placer, number>, run: (pool: readonly Seat[], capOf: (p: Placer) => number, among: readonly Placer[]) => void) => {
      if (settings.split.method === 'weekly') return;
      const open = () => free.filter(x => !out.has(x) && !(settings.prime && x.slot.prime));
      const openNow = open();
      if (!openNow.length) return;
      // What each team holds this week so far, counted as its share counts.
      const week = new Map<string, number>();
      for (const [t, list] of kept) week.set(t, list.reduce((n, x) => n + worth(x.slot), 0));
      for (const [seat, p] of out) for (const t of p.teams) week.set(t.id, (week.get(t.id) ?? 0) + (byUnits ? slotSize(seat.slot) / p.teams.length : 1));
      let budget = Math.floor(toHand - [...week.values()].reduce((a, b) => a + b, 0) + EPS);
      if (budget <= 0) return;
      // Each team's room: its season share left, its week's cap; its place in line: how far behind its pace it is.
      const extra: { p: Placer; behind: number }[] = [];
      for (const t of teams) {
        if (t.many || pooled(t.id)) continue;
        const target = targets.slots.get(t.id) ?? 0;
        const has = (hv.get(t.id) ?? 0) + (week.get(t.id) ?? 0);
        // Slots of the biggest size still open to it (Stage 2; 1 without parts), never past what it is owed.
        const quota = Math.min(maxPerWeek - (taken.get(t.id)?.length ?? 0), Math.floor((target - has) / biggest(t, openNow) + EPS));
        if (quota > 0) extra.push({ p: { id: t.id, teams: [t], quota, primeQuota: 0 }, behind: target * cum / Math.max(1, targets.capacity) - has });
      }
      extra.sort((x, y) => y.behind - x.behind);
      // A slot a round, the furthest behind first, until the budget is spent or nobody can use what is left.
      const rounds = Math.max(0, ...extra.map(x => x.p.quota));
      for (let round = 1; round <= rounds; round++) {
        for (const { p } of extra) {
          if (budget <= 0) return;
          if ((placed.get(p) ?? 0) >= Math.min(p.quota, round)) continue;
          // With parts, only a seat the budget still covers (/review 2026-11-26: a whole field on a quarter's budget overspent).
          const all = open();
          if (!all.length) return;
          const seatsLeft = anyParts ? all.filter(x => slotSize(x.slot) <= budget + EPS) : all;
          if (!seatsLeft.length) continue;
          const before = placed.get(p) ?? 0;
          run(seatsLeft, q => Math.min(q.quota, round) - (placed.get(q) ?? 0), [p]);
          // What it took, counted as the shares count (a part its size): `run` places only from `seatsLeft`, all open before it.
          budget -= anyParts ? seatsLeft.reduce((n, x) => (out.get(x) === p ? n + slotSize(x.slot) : n), 0) : (placed.get(p) ?? 0) - before;
        }
      }
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
          // A part for a whole field (or a side for a quarter) would move a share, not just its value (Stage 2).
          if (slotSize(sa.slot) !== slotSize(sb.slot)) continue;
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
    const { need, primeNeed, toHand } = needsFor(seats, cumSeats, cumPrime, kept, hv, hvPrime);
    const result = planWeek(seats, kept, free, placersFor(need, primeNeed, kept, free), hv, cumSeats, toHand);
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
    for (const x of weekOf(seats, unitsIn(seats), unitsIn(seats.filter(y => y.slot.prime)), zero, zero)) remember(memOf(x.placerId), x.slot, 2, keysOf.get(x.slot)!);
    memoryWeeks = 2;
  }

  let cumSeats = 0, cumPrime = 0;
  for (const week of weeks) {
    const seats = seatsByWeek.get(week)!;
    cumSeats += unitsIn(seats);
    cumPrime += unitsIn(seats.filter(x => x.slot.prime));
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
  /** Σ the sizes of each team's slots (Stage 2): a team on quarters reads its shortfall in quarters, not units. */
  const sizes = new Map<string, number>();
  for (const s of slots) {
    const on = assignments.get(s.key) ?? [];
    for (const t of on) {
      const r = out.get(t);
      if (!r) continue;
      const m = (s.endMs - s.startMs) / MIN;
      r.got++; r.minutes += m;
      r.units += slotSize(s) / on.length;
      sizes.set(t, (sizes.get(t) ?? 0) + slotSize(s));
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
    // Under units, what it is short of in ITS OWN slots (Stage 2): a team on quarters 2.5 units short is 10 quarter
    // slots short ("30 of 40 slots", the drawing). A team on whole fields, shared or not, reads exactly as before.
    const rate = r.got ? (sizes.get(r.teamId) ?? r.got) / r.got : 1;
    r.short = targets?.counts === 'units' ? Math.max(0, Math.ceil((r.target - r.units) / rate - EPS)) : Math.max(0, r.target - r.got);
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
  /** Its field's part (Stage 2; absent: whole). */
  sectionMask?: number;
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
    const p = map.get(k) ?? { weekday: s.weekday, startClock: s.startClock, endClock: s.endClock, venueId: s.venueId, facilityId: s.facilityId, ...(s.sectionMask ? { sectionMask: s.sectionMask } : {}), days: [] };
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
