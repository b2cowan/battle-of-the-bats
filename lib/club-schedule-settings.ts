/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A CLUB SCHEDULE'S SETTINGS — their shape, their defaults and the one reader that checks them (Club Tier Stage 11a,
 * part A; Asks 18, 20, 22 and the rules drawn on New schedule's step 1 — hub K4MPu4ni53Ct7yrDcmWJd9 → Stages 10 + 11,
 * specimens 4 and 14 step 3).
 *
 * Stored whole in `club_schedules.settings` (mig 326), VERSIONED (`v`), so a regenerate reads exactly what the schedule
 * was made with and a later version can read an older one. The TIME itself is not here: it is the schedule's own blocks
 * (`org_time_blocks.schedule_id`, the one model of the club's time) and its dates off.
 *
 * Pure and client-safe: the routes read every body through `readScheduleSettings` (a refusal in words, never a 500), and
 * part B's form builds the same shape. The engine (`lib/club-schedule-engine.ts`) reads only what this module returns.
 *
 * ⚖ VERSION 2 (Stage 11c, ratified 2026-10-12 — hub → Stage 11c, Asks 1, 4, 5): SHARING A FACILITY is a rule about teams
 * (`rules.sharing`: teams or groups, 2–4 at once) — "Teams at once", one number for every slot, left the form; EACH TEAM'S
 * TIME (`timeMode`: the same each week · moved around) answers prime time's old keep-or-rotate too. Every shape saved
 * before still reads with its meaning: a v1 `teamsAtOnce` above 1 with no sharing rules reads as ONE rule naming every
 * ticked team at that number, and a v1 `prime.mode: 'rotate'` reads as Moved around.
 * ⚠ `teamsAtOnce` STAYS IN THE STORED SHAPE, worked out, never asked: mig 326's floor caps a slot's teams at
 * `settings->>'teamsAtOnce'` on every save and hand edit (`slot_full`), so it is written as the largest number any sharing
 * rule allows (1 with none) — the database's ceiling. Each slot's own room is `slotRoom` (the rule's number, one for a
 * team in no rule, one on a half facility), asked by the routes before the floor.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { isUuid } from './utils';
import { isCalendarDate } from './timezone';

/**
 * How the time is shared (Ask 18 — New allocation's Split, for time):
 *   even        — Evenly: every ticked team the same, all the time handed out;
 *   percentage  — By percentage: each team's figure a percent of the time (a group's figure spreads over its teams on
 *                 the form — `spreadGroupFigure`); under 100% leaves slots open, over 100% is refused;
 *   weekly      — A set number a week: each team's figure is slots a week.
 */
export type SplitMethod = 'even' | 'percentage' | 'weekly';

/** Which hours count as prime time, and how they are shared (Ask 18 (a)): the same way as the slots (the default — a
 *  60% group gets 60% of prime time too) or evenly by team. Whether a team keeps its prime-time slot or moves is Each
 *  team's time (`timeMode`, Stage 11c Ask 5) — v1's `mode` is read into it, never written. */
export interface PrimeTime {
  /** 1 = Monday … 7 = Sunday. */
  weekdays: number[];
  /** "HH:MM" on the club's clock: a slot is prime when it starts at or after `start` and ends by `end`. */
  start: string;
  end: string;
  share: 'same' | 'even';
}

/** Each team's time (Stage 11c Ask 4): `same` — each team keeps its facility and start week to week (the default, and
 *  every schedule before 11c); `moved` — early and late starts and the facilities taken in turn, within each team's
 *  rules. Either way a team keeps its days. */
export type TimeMode = 'same' | 'moved';

/** Sharing a facility (Stage 11c Ask 1): these teams — named, or a group's (a group's rule follows the group) — may share
 *  a facility, up to `atOnce` in one slot, and only with each other. Every team in no rule keeps a facility to itself. */
export interface SharingRule {
  teamIds: string[];
  groupIds: string[];
  /** 2–4. */
  atOnce: number;
}

/** Earliest and latest start by age group ("9U AA and 11U AA finish by 8:00 p.m."). Null = any time. */
export interface StartWindow {
  teamIds: string[];
  startAfter: string | null;
  startBy: string | null;
  finishBy: string | null;
}

/** A team's day off (Ask 20): a date ("13U AAA · Sat, Feb 6 · away at a tournament") or every week ("11U AA · Every
 *  Tuesday"). Exactly one of `date` and `weekday`. The club-wide dates off live in The time, never here. */
export interface TeamDayOff {
  teamId: string;
  date: string | null;
  weekday: number | null;
  note: string | null;
}

/** Fields by group (Ask 22): these facilities only for these groups or teams ("Fields 5–6 · only for Junior"). */
export interface FieldsBy {
  facilityIds: string[];
  groupIds: string[];
  teamIds: string[];
}

export interface ScheduleRules {
  windows: StartWindow[];
  /** At most N slots a team a day / a week. Null = no cap. */
  maxPerDay: number | null;
  maxPerWeek: number | null;
  /** Never on a team's game day — read from each team's WHOLE schedule, away games on typed places included (P11-04c). */
  avoidGameDays: boolean;
  /** Never over a booking already on the books — the clash pool, and each team's own bookings. */
  avoidBookings: boolean;
  noBackToBack: boolean;
  daysOff: TeamDayOff[];
  fieldsBy: FieldsBy[];
  /** Sharing a facility (Stage 11c). A team is in one rule at most. */
  sharing: SharingRule[];
}

export interface ScheduleSettings {
  v: 2;
  slotMinutes: number;
  changeoverMinutes: number;
  /** THE DATABASE'S CEILING, never asked: the largest `atOnce` of any sharing rule, 1 with none — what mig 326's floor
   *  caps a slot at (`slot_full`). Worked out on every read (`sharingCeiling`); a slot's own room is `slotRoom`. */
  teamsAtOnce: number;
  /** The ticked teams, in the form's order (groups as the club orders them, then "Not in a group"). */
  teamIds: string[];
  split: { method: SplitMethod; values: Record<string, number> };
  /** Each team's time (Stage 11c Ask 4). */
  timeMode: TimeMode;
  prime: PrimeTime | null;
  rules: ScheduleRules;
}

export const SETTINGS_LIMITS = {
  slotMinutes: { min: 15, max: 480 },
  changeoverMinutes: { min: 0, max: 120 },
  /** A v1 schedule's Teams at once, read into a sharing rule. */
  teamsAtOnce: { min: 1, max: 4 },
  atOnce: { min: 2, max: 4 },
  teams: 60,
  perWeek: 21,
  windows: 20,
  daysOff: 200,
  fieldsBy: 20,
  sharing: 20,
} as const;

export function defaultRules(): ScheduleRules {
  return { windows: [], maxPerDay: null, maxPerWeek: null, avoidGameDays: true, avoidBookings: true, noBackToBack: false, daysOff: [], fieldsBy: [], sharing: [] };
}

export function defaultSettings(): ScheduleSettings {
  return {
    v: 2, slotMinutes: 60, changeoverMinutes: 0, teamsAtOnce: 1, teamIds: [],
    split: { method: 'even', values: {} }, timeMode: 'same', prime: null, rules: defaultRules(),
  };
}

/** The database's ceiling (mig 326's `slot_full`): the largest number a sharing rule lets share one slot, 1 with none. */
export const sharingCeiling = (sharing: readonly SharingRule[]) => Math.max(1, ...sharing.map(s => s.atOnce));

// ── Sharing a facility, read against the teams (Stage 11c Asks 1, 2, 6 — the one rule the engine, the routes, the grid
// and the slot window all ask) ──────────────────────────────────────────────────────────────────────

export interface SharingPool {
  atOnce: number;
  /** The rule's teams among those given — named, or in a group it names — in the order given. */
  teamIds: string[];
}

/**
 * EACH SHARING RULE'S TEAMS among `teams` (a group's rule follows the group: a team added to Junior shares too). A team
 * two rules name stays in the first — the reader refuses that on every save, so only a hand-made shape reaches here.
 */
export function sharingPools(sharing: readonly SharingRule[], teams: readonly { id: string; groupId: string | null }[]): { pools: SharingPool[]; poolOf: Map<string, number> } {
  const poolOf = new Map<string, number>();
  const pools = sharing.map((rule, i) => {
    const teamIds = teams.filter(t => !poolOf.has(t.id) && (rule.teamIds.includes(t.id) || (!!t.groupId && rule.groupIds.includes(t.groupId)))).map(t => t.id);
    for (const t of teamIds) poolOf.set(t, i);
    return { atOnce: rule.atOnce, teamIds };
  });
  return { pools, poolOf };
}

/** Whether a team shares at all: it is in a rule that names at least one other of the teams given (a rule of one shares
 *  with nobody). */
export function sharesAny(pools: { pools: readonly SharingPool[]; poolOf: ReadonlyMap<string, number> }, teamId: string): boolean {
  const p = pools.poolOf.get(teamId);
  return p !== undefined && pools.pools[p].teamIds.length > 1;
}

/**
 * A SLOT'S ROOM with these teams in it (Ask 1, and the Not-drawn screen's half facility): every team in it in ONE sharing
 * rule → that rule's number; anybody else → one (a team in no rule keeps a facility to itself); a half facility (weight
 * under 1) → one, never shared (half of a half would be a quarter). An empty slot has room for one of anybody.
 */
export function slotRoom(teamIds: readonly string[], weight: number, pools: { pools: readonly SharingPool[]; poolOf: ReadonlyMap<string, number> }): number {
  if (!teamIds.length || weight < 1) return 1;
  const p = pools.poolOf.get(teamIds[0]);
  if (p === undefined || teamIds.some(t => pools.poolOf.get(t) !== p)) return 1;
  return pools.pools[p].atOnce;
}

/**
 * A SAVED OR COPIED SHARING RULE, made to fit the teams running a season now (Settings…, Copy a schedule): a team whose
 * season ended leaves it, and a rule left naming nobody goes — a stale team would have every count and Generate refused
 * (the lesson of the copied facility rule, 2026-10-12). A group stays: it follows whoever is in it now.
 */
export function sharingInSeason(sharing: readonly SharingRule[], running: ReadonlySet<string>): SharingRule[] {
  return sharing.map(s => ({ ...s, teamIds: s.teamIds.filter(t => running.has(t)) })).filter(s => s.teamIds.length + s.groupIds.length > 0);
}

/** Whether a slot may hold these teams together (`slotRoom` asked of the slot as it would be). */
export const slotHolds = (teamIds: readonly string[], weight: number, pools: Parameters<typeof slotRoom>[2]) =>
  teamIds.length <= slotRoom(teamIds, weight, pools);

/**
 * WHERE A TEAM MOVED FROM ONE SLOT TO ANOTHER LANDS — the one rule the grid's drop, the which-weeks menu, the page and
 * the engine's `planMove` (each week) all ask: INTO the target when it has room for the team (open, or a partner of its
 * sharing rule with room), else a SWAP with the one team there when the source can take that team back; null when
 * neither.
 */
export function moveLanding(from: { teamIds: readonly string[]; weight: number }, to: { teamIds: readonly string[]; weight: number }, teamId: string,
  pools: Parameters<typeof slotRoom>[2]): { kind: 'into' } | { kind: 'swap'; withTeam: string } | null {
  if (slotHolds([...to.teamIds, teamId], to.weight, pools)) return { kind: 'into' };
  if (to.teamIds.length === 1 && slotHolds([...from.teamIds.filter(t => t !== teamId), to.teamIds[0]], from.weight, pools)) return { kind: 'swap', withTeam: to.teamIds[0] };
  return null;
}

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const isClock = (v: unknown): v is string => typeof v === 'string' && CLOCK.test(v);

export type SettingsRefusal = { ok: false; code: string; error: string };
export type SettingsRead = { ok: true; value: ScheduleSettings } | SettingsRefusal;

const no = (code: string, error: string): SettingsRefusal => ({ ok: false, code, error });

const wholeIn = (v: unknown, min: number, max: number): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

const ids = (v: unknown): string[] | null =>
  Array.isArray(v) && v.every(isUuid) ? [...new Set(v as string[])] : null;

const weekday = (v: unknown): number | null => wholeIn(v, 1, 7);

const clockOrNull = (v: unknown): string | null | undefined =>
  v === null || v === undefined || v === '' ? null : isClock(v) ? v : undefined;

/**
 * A SHAPE SAVED BEFORE STAGE 11c, made the current one before it is read — the reader checks one shape. A Teams at once
 * above 1 with no sharing rules shared every slot among every team: it becomes ONE rule naming every ticked team at that
 * number. A prime time rotated weekly becomes Each team's time · Moved around (Ask 5). A current shape passes untouched.
 */
function upgradeV1(r: Record<string, unknown>): Record<string, unknown> | SettingsRefusal {
  const rules = (r.rules ?? {}) as Record<string, unknown>;
  if (Array.isArray(rules.sharing)) return r;
  const atOnce = wholeIn(r.teamsAtOnce ?? 1, SETTINGS_LIMITS.teamsAtOnce.min, SETTINGS_LIMITS.teamsAtOnce.max);
  if (atOnce === null) return no('bad_teams_at_once', 'Between 1 and 4 teams can share a facility in one slot.');
  const teamIds = Array.isArray(r.teamIds) ? r.teamIds : [];
  const rotated = (r.prime as { mode?: unknown } | null | undefined)?.mode === 'rotate';
  return {
    ...r,
    timeMode: r.timeMode ?? (rotated ? 'moved' : 'same'),
    rules: { ...rules, sharing: atOnce > 1 && teamIds.length ? [{ teamIds, groupIds: [], atOnce }] : [] },
  };
}

/**
 * THE ONE READER. Every field is checked and every refusal is a sentence (the form holds, the route refuses — one rule).
 * `known` narrows the team and facility ids to the club's own: a figure for a team that isn't ticked, or a facility
 * that isn't the schedule's, is refused rather than kept silently. `known.groupOf` (each running team's group) lets a
 * sharing rule be checked through its groups — "a team in two sharing rules", "no ticked team" — as the routes read it;
 * a stored schedule is read without it (`loadSchedule`), so a rule whose team's season since ended still reads.
 */
export function readScheduleSettings(raw: unknown, known: {
  teamIds?: ReadonlySet<string>; facilityIds?: ReadonlySet<string>; groupIds?: ReadonlySet<string>; groupOf?: ReadonlyMap<string, string | null>;
} = {}): SettingsRead {
  if (!raw || typeof raw !== 'object') return no('bad_settings', 'The schedule’s settings are missing.');
  const up = upgradeV1(raw as Record<string, unknown>);
  if (up.ok === false) return up as SettingsRefusal;
  const r = up as Record<string, unknown>;
  const L = SETTINGS_LIMITS;

  const slotMinutes = wholeIn(r.slotMinutes, L.slotMinutes.min, L.slotMinutes.max);
  if (slotMinutes === null) return no('bad_slot_length', 'A slot is between 15 minutes and 8 hours long.');
  const changeoverMinutes = wholeIn(r.changeoverMinutes ?? 0, L.changeoverMinutes.min, L.changeoverMinutes.max);
  if (changeoverMinutes === null) return no('bad_changeover', 'The changeover is between 0 and 120 minutes.');

  const teamIds = ids(r.teamIds ?? []);
  if (!teamIds) return no('bad_teams', 'Pick the teams again.');
  if (teamIds.length > L.teams) return no('too_many_teams', `A schedule hands time to at most ${L.teams} teams.`);
  if (known.teamIds && teamIds.some(t => !known.teamIds!.has(t))) {
    return no('team_not_running', 'A team picked isn’t one of the club’s teams with a season running. Pick the teams again.');
  }
  const ticked = new Set(teamIds);

  // ── The split (Ask 18) ──
  const split = (r.split ?? {}) as Record<string, unknown>;
  const method = split.method as SplitMethod;
  if (!['even', 'percentage', 'weekly'].includes(method)) return no('bad_split', 'Choose how the time is split.');
  const values: Record<string, number> = {};
  if (method !== 'even') {
    const rawValues = (split.values ?? {}) as Record<string, unknown>;
    for (const t of teamIds) {
      const n = Number(rawValues[t]);
      if (method === 'percentage') {
        if (!Number.isFinite(n) || n <= 0 || n > 100) return no('bad_share', 'Each team needs a percentage above zero.');
        values[t] = Math.round(n * 100) / 100;
      } else {
        if (!Number.isInteger(n) || n < 1 || n > L.perWeek) return no('bad_share', `Each team needs between 1 and ${L.perWeek} slots a week.`);
        values[t] = n;
      }
    }
    if (Object.keys(rawValues).some(k => !ticked.has(k))) return no('bad_share', 'A figure names a team that isn’t ticked.');
    if (method === 'percentage') {
      // In hundredths, so 33.33 × 3 reads as 99.99, not over.
      const hundredths = teamIds.reduce((s, t) => s + Math.round(values[t] * 100), 0);
      if (hundredths > 10000) {
        return no('over_100', `The shares add up to ${hundredths / 100}%. Take ${((hundredths - 10000) / 100).toFixed(2).replace(/\.00$/, '')}% off a group or a team.`);
      }
    }
  }

  // ── Prime time (Ask 18 (a)) ──
  let prime: PrimeTime | null = null;
  if (r.prime) {
    const p = r.prime as Record<string, unknown>;
    const days = Array.isArray(p.weekdays) ? [...new Set((p.weekdays as unknown[]).map(weekday))] : [];
    if (!days.length || days.some(d => d === null)) return no('bad_prime', 'Prime time needs its days.');
    if (!isClock(p.start) || !isClock(p.end) || p.end <= p.start) return no('bad_prime', 'Prime time needs a start and a later end.');
    const share = p.share === 'even' ? 'even' : 'same';
    prime = { weekdays: (days as number[]).sort((a, b) => a - b), start: p.start, end: p.end, share };
  }

  // ── Each team's time (Stage 11c Ask 4) ──
  if (r.timeMode !== undefined && r.timeMode !== 'same' && r.timeMode !== 'moved') return no('bad_time_mode', 'Choose how each team’s time falls.');
  const timeMode: TimeMode = r.timeMode === 'moved' ? 'moved' : 'same';

  // ── The rules ──
  const rr = (r.rules ?? {}) as Record<string, unknown>;
  const rules = defaultRules();
  if (Array.isArray(rr.windows)) {
    if (rr.windows.length > L.windows) return no('bad_rule', 'Too many start-time rules.');
    for (const w of rr.windows as Record<string, unknown>[]) {
      const wTeams = ids(w?.teamIds);
      const startAfter = clockOrNull(w?.startAfter), startBy = clockOrNull(w?.startBy), finishBy = clockOrNull(w?.finishBy);
      if (!wTeams || !wTeams.length) return no('bad_rule', 'A start-time rule needs its teams.');
      if (startAfter === undefined || startBy === undefined || finishBy === undefined) return no('bad_rule', 'A start-time rule’s times aren’t times.');
      if (!startAfter && !startBy && !finishBy) return no('bad_rule', 'A start-time rule needs a time.');
      if (startAfter && startBy && startBy < startAfter) return no('bad_rule', 'A rule’s latest start is before its earliest.');
      if (wTeams.some(t => !ticked.has(t))) return no('bad_rule', 'A start-time rule names a team that isn’t ticked.');
      rules.windows.push({ teamIds: wTeams, startAfter, startBy, finishBy });
    }
  }
  const cap = (v: unknown, max: number): number | null | undefined =>
    v === null || v === undefined || v === '' ? null : wholeIn(v, 1, max) ?? undefined;
  const maxPerDay = cap(rr.maxPerDay, 12), maxPerWeek = cap(rr.maxPerWeek, L.perWeek);
  if (maxPerDay === undefined) return no('bad_rule', 'At most a day is a number of slots.');
  if (maxPerWeek === undefined) return no('bad_rule', 'At most a week is a number of slots.');
  rules.maxPerDay = maxPerDay;
  rules.maxPerWeek = maxPerWeek;
  rules.avoidGameDays = rr.avoidGameDays !== false;
  rules.avoidBookings = rr.avoidBookings !== false;
  rules.noBackToBack = rr.noBackToBack === true;
  if (Array.isArray(rr.daysOff)) {
    if (rr.daysOff.length > L.daysOff) return no('bad_rule', 'Too many days off.');
    for (const d of rr.daysOff as Record<string, unknown>[]) {
      if (!isUuid(d?.teamId) || !ticked.has(d.teamId)) return no('bad_rule', 'A day off names a team that isn’t ticked.');
      const date = d?.date ? (isCalendarDate(d.date as string) ? d.date as string : undefined) : null;
      const wd = d?.weekday == null ? null : weekday(d.weekday);
      if (date === undefined || (date === null) === (wd === null)) return no('bad_rule', 'A day off is a date, or a day every week.');
      const note = typeof d?.note === 'string' ? d.note.trim().slice(0, 120) || null : null;
      rules.daysOff.push({ teamId: d.teamId as string, date, weekday: wd, note });
    }
  }
  if (Array.isArray(rr.fieldsBy)) {
    if (rr.fieldsBy.length > L.fieldsBy) return no('bad_rule', 'Too many field rules.');
    for (const f of rr.fieldsBy as Record<string, unknown>[]) {
      const facilityIds = ids(f?.facilityIds), groupIds = ids(f?.groupIds ?? []), fTeams = ids(f?.teamIds ?? []);
      if (!facilityIds?.length || !groupIds || !fTeams || !(groupIds.length + fTeams.length)) {
        return no('bad_rule', 'A field rule needs its facilities and who they are for.');
      }
      if (known.facilityIds && facilityIds.some(x => !known.facilityIds!.has(x))) return no('bad_rule', 'A field rule names a facility that isn’t in the schedule’s time.');
      if (known.groupIds && groupIds.some(x => !known.groupIds!.has(x))) return no('bad_rule', 'A field rule names a group that isn’t the club’s.');
      rules.fieldsBy.push({ facilityIds, groupIds, teamIds: fTeams });
    }
  }

  // ── Sharing a facility (Stage 11c Ask 1) ──
  {
    const list = (Array.isArray(rr.sharing) ? rr.sharing : []) as Record<string, unknown>[];
    if (list.length > L.sharing) return no('bad_rule', 'Too many sharing rules.');
    // Each running team's rule, through its groups when they are known — "a team in two sharing rules" is refused.
    const ruleOf = new Map<string, number>();
    for (const [i, s] of list.entries()) {
      const sTeams = ids(s?.teamIds ?? []), sGroups = ids(s?.groupIds ?? []);
      if (!sTeams || !sGroups || !(sTeams.length + sGroups.length)) return no('bad_rule', 'A sharing rule needs its teams.');
      const atOnce = wholeIn(s?.atOnce, L.atOnce.min, L.atOnce.max);
      if (atOnce === null) return no('bad_rule', 'A sharing rule shares a facility between 2 and 4 teams at once.');
      if (known.teamIds && sTeams.some(t => !known.teamIds!.has(t))) return no('bad_rule', 'A sharing rule names a team with no season running. Take it out of the rule.');
      if (known.groupIds && sGroups.some(g => !known.groupIds!.has(g))) return no('bad_rule', 'A sharing rule names a group that isn’t the club’s.');
      const members = known.groupOf
        ? [...known.groupOf].filter(([t, g]) => sTeams.includes(t) || (!!g && sGroups.includes(g))).map(([t]) => t)
        : sTeams;
      for (const t of new Set(members)) {
        if (ruleOf.has(t) && ruleOf.get(t) !== i) return no('bad_rule', 'A team is in two sharing rules. Take it out of one.');
        ruleOf.set(t, i);
      }
      if (rules.sharing.some(x => x.groupIds.some(g => sGroups.includes(g)))) return no('bad_rule', 'A team is in two sharing rules. Take it out of one.');
      // No ticked team in it (named, or in a group it names when the groups are known): it would share nothing.
      const anyTicked = members.some(t => ticked.has(t)) || (!known.groupOf && sGroups.length > 0);
      if (!anyTicked) return no('bad_rule', 'A sharing rule names no ticked team. Tick one of its teams, or remove the rule.');
      rules.sharing.push({ teamIds: sTeams, groupIds: sGroups, atOnce });
    }
  }

  return {
    ok: true,
    value: {
      v: 2, slotMinutes, changeoverMinutes, teamsAtOnce: sharingCeiling(rules.sharing), teamIds, split: { method, values },
      timeMode, prime, rules,
    },
  };
}

/** How many optional rules are on — each start-time rule, team's day off, facility rule, sharing rule and weekly cap
 *  counts once, as does each safeguard under Always. The daily practice limit sits visibly in Who, and how much.
 *  Prime time is not a rule (it sits
 *  in Who, and how much). The dome's: Field 5 · Field 6 only for Junior, 9U AA and 11U AA share a facility, 13U AAA off
 *  Sun, Dec 20, game days, bookings = 5. */
export function rulesOn(rules: ScheduleRules): number {
  return rules.windows.length + rules.fieldsBy.length + rules.daysOff.length + rules.sharing.length
    + (rules.maxPerWeek != null ? 1 : 0)
    + (rules.avoidGameDays ? 1 : 0) + (rules.avoidBookings ? 1 : 0) + (rules.noBackToBack ? 1 : 0);
}
