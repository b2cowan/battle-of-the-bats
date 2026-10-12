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
 *  60% group gets 60% of prime time too) or evenly by team; and kept on each team's nights or rotated weekly. */
export interface PrimeTime {
  /** 1 = Monday … 7 = Sunday. */
  weekdays: number[];
  /** "HH:MM" on the club's clock: a slot is prime when it starts at or after `start` and ends by `end`. */
  start: string;
  end: string;
  share: 'same' | 'even';
  mode: 'keep' | 'rotate';
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
}

export interface ScheduleSettings {
  v: 1;
  slotMinutes: number;
  changeoverMinutes: number;
  /** Teams sharing one facility in one slot (1 by default). */
  teamsAtOnce: number;
  /** The ticked teams, in the form's order (groups as the club orders them, then "Not in a group"). */
  teamIds: string[];
  split: { method: SplitMethod; values: Record<string, number> };
  prime: PrimeTime | null;
  rules: ScheduleRules;
}

export const SETTINGS_LIMITS = {
  slotMinutes: { min: 15, max: 480 },
  changeoverMinutes: { min: 0, max: 120 },
  teamsAtOnce: { min: 1, max: 4 },
  teams: 60,
  perWeek: 21,
  windows: 20,
  daysOff: 200,
  fieldsBy: 20,
} as const;

export function defaultRules(): ScheduleRules {
  return { windows: [], maxPerDay: null, maxPerWeek: null, avoidGameDays: true, avoidBookings: true, noBackToBack: false, daysOff: [], fieldsBy: [] };
}

export function defaultSettings(): ScheduleSettings {
  return {
    v: 1, slotMinutes: 60, changeoverMinutes: 0, teamsAtOnce: 1, teamIds: [],
    split: { method: 'even', values: {} }, prime: null, rules: defaultRules(),
  };
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
 * THE ONE READER. Every field is checked and every refusal is a sentence (the form holds, the route refuses — one rule).
 * `known` narrows the team and facility ids to the club's own: a figure for a team that isn't ticked, or a facility
 * that isn't the schedule's, is refused rather than kept silently.
 */
export function readScheduleSettings(raw: unknown, known: { teamIds?: ReadonlySet<string>; facilityIds?: ReadonlySet<string>; groupIds?: ReadonlySet<string> } = {}): SettingsRead {
  if (!raw || typeof raw !== 'object') return no('bad_settings', 'The schedule’s settings are missing.');
  const r = raw as Record<string, unknown>;
  const L = SETTINGS_LIMITS;

  const slotMinutes = wholeIn(r.slotMinutes, L.slotMinutes.min, L.slotMinutes.max);
  if (slotMinutes === null) return no('bad_slot_length', 'A slot is between 15 minutes and 8 hours long.');
  const changeoverMinutes = wholeIn(r.changeoverMinutes ?? 0, L.changeoverMinutes.min, L.changeoverMinutes.max);
  if (changeoverMinutes === null) return no('bad_changeover', 'The changeover is between 0 and 120 minutes.');
  const teamsAtOnce = wholeIn(r.teamsAtOnce ?? 1, L.teamsAtOnce.min, L.teamsAtOnce.max);
  if (teamsAtOnce === null) return no('bad_teams_at_once', 'Between 1 and 4 teams can share a facility in one slot.');

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
    const mode = p.mode === 'rotate' ? 'rotate' : 'keep';
    prime = { weekdays: (days as number[]).sort((a, b) => a - b), start: p.start, end: p.end, share, mode };
  }

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

  return {
    ok: true,
    value: { v: 1, slotMinutes, changeoverMinutes, teamsAtOnce, teamIds, split: { method, values }, prime, rules },
  };
}

/** How many rules are on — the folded card's "Rules · 4 on", counted as the drawings count them: each start-time rule,
 *  each field rule and each cap is one; the teams' days off are one ("2 teams' days off"); prime time is its own row,
 *  not a rule. The lanes drawing: a finish-by, the days off, game days, bookings = 4. The dome's: fields by group,
 *  bookings = 2. */
export function rulesOn(rules: ScheduleRules): number {
  return rules.windows.length + rules.fieldsBy.length + (rules.daysOff.length ? 1 : 0)
    + (rules.maxPerDay != null ? 1 : 0) + (rules.maxPerWeek != null ? 1 : 0)
    + (rules.avoidGameDays ? 1 : 0) + (rules.avoidBookings ? 1 : 0) + (rules.noBackToBack ? 1 : 0);
}
