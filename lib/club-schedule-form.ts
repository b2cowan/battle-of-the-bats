/**
 * NEW SCHEDULE'S FORM, AS SETTINGS — the one conversion each way between what the window holds (strings, a row per
 * rule, an id per rule so a rule opens in place) and the settings the routes read (`readScheduleSettings`). Club Tier
 * Stage 11c (ratified 2026-10-12, hub → Stage 11c specimen 1): the window keeps it; the round trip (form → settings →
 * form) is a unit test (`tests/unit/club-schedule-engine.test.ts`), so nothing a club sets is lost on Settings….
 * Pure and client-safe.
 */
import { isCalendarDate } from './timezone';
import { SETTINGS_LIMITS, sharingCeiling, sharingInSeason, type ScheduleSettings, type TimeMode } from './club-schedule-settings';
import { PRIME_DAYS } from './club-schedule-view';

let nextKey = 0;
/** A row's own key — what opens one rule in place, and what a list re-renders by. */
export const newKey = (p: string) => `${p}-${++nextKey}`;

export interface WindowRule { key: string; teamIds: string[]; startAfter: string; finishBy: string }
export interface DayOffRule { key: string; teamId: string; when: string; date: string; note: string }
/** `who`: "g:<group id>" or "t:<team id>" — the facility rule's own picker (groups, then teams). */
export interface FieldsRule { key: string; facilityIds: string[]; who: string[] }
/** Sharing a facility (Stage 11c Ask 1): the same picker as a facility rule, and how many at once. */
export interface ShareRule { key: string; who: string[]; atOnce: number }

/** The settings part of the window's draft. */
export interface SettingsDraft {
  slotMinutes: number;
  changeoverMinutes: number;
  ticked: string[];
  method: ScheduleSettings['split']['method'];
  values: Record<string, string>;
  groupTyped: Record<string, string>;
  timeMode: TimeMode;
  primeShare: 'same' | 'even';
  primeDays: string;
  primeStart: string;
  primeEnd: string;
  windows: WindowRule[];
  daysOff: DayOffRule[];
  maxPerDay: string;
  maxPerWeek: string;
  fieldsBy: FieldsRule[];
  sharing: ShareRule[];
  avoidGameDays: boolean;
  avoidBookings: boolean;
  noBackToBack: boolean;
}

export const EMPTY_SETTINGS: SettingsDraft = {
  slotMinutes: 60, changeoverMinutes: 0, ticked: [], method: 'even', values: {}, groupTyped: {}, timeMode: 'same',
  primeShare: 'same', primeDays: 'none', primeStart: '18:00', primeEnd: '20:00',
  windows: [], daysOff: [], maxPerDay: '', maxPerWeek: '', fieldsBy: [], sharing: [], avoidGameDays: true, avoidBookings: true, noBackToBack: false,
};

/** A figure typed: a number above zero ("15%", " 2 "), or null. */
export const positive = (s: string | undefined): number | null => {
  const n = Number((s ?? '').replace(/[%\s]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};
/** A weekly figure: a whole number of slots a week, within the reader's limit. */
export const wholeWeekly = (s: string | undefined): number | null => {
  const n = positive(s);
  return n != null && Number.isInteger(n) && n <= SETTINGS_LIMITS.perWeek ? n : null;
};
/** A team's figure as the split reads it — a percent, slots a week, or 1 (Evenly); null while it isn't whole. */
export const figureOf = (d: Pick<SettingsDraft, 'method' | 'values'>, teamId: string): number | null =>
  d.method === 'percentage' ? positive(d.values[teamId]) : d.method === 'weekly' ? wholeWeekly(d.values[teamId]) : 1;

/** The groups-and-teams picker's values ("g:<group id>", "t:<team id>") — the one place the format is read or written. */
export const groupsIn = (who: readonly string[]) => who.filter(w => w.startsWith('g:')).map(w => w.slice(2));
export const teamsIn = (who: readonly string[]) => who.filter(w => w.startsWith('t:')).map(w => w.slice(2));
export const whoOf = (r: { groupIds: readonly string[]; teamIds: readonly string[] }) => [...r.groupIds.map(g => `g:${g}`), ...r.teamIds.map(t => `t:${t}`)];

/** Whether a rule the window holds is whole enough to send — one opened and left half-filled holds Generate. */
export const ruleIsWhole = {
  windows: (w: WindowRule) => w.teamIds.length > 0 && !!(w.startAfter || w.finishBy),
  daysOff: (d: DayOffRule) => !!d.teamId && (d.when === 'date' ? isCalendarDate(d.date) : true),
  fieldsBy: (f: FieldsRule) => f.facilityIds.length > 0 && f.who.length > 0,
  sharing: (s: ShareRule) => s.who.length > 0,
};

/** Whether a whole rule does anything for the teams ticked: it names one of them, or a group (which follows its teams). A
 *  rule naming only unticked teams is idle — kept in the window, never sent (the count and the folded line leave it out). */
export const ruleApplies = {
  windows: (w: WindowRule, ticked: ReadonlySet<string>) => w.teamIds.some(t => ticked.has(t)),
  daysOff: (d: DayOffRule, ticked: ReadonlySet<string>) => ticked.has(d.teamId),
  fieldsBy: (f: FieldsRule, ticked: ReadonlySet<string>) => groupsIn(f.who).length > 0 || teamsIn(f.who).some(t => ticked.has(t)),
  sharing: (r: ShareRule, ticked: ReadonlySet<string>) => groupsIn(r.who).length > 0 || teamsIn(r.who).some(t => ticked.has(t)),
};

/**
 * THE SETTINGS THE WINDOW SENDS. `teams`: the ticked teams to send, in the form's order (`previewOnly` asks with only
 * those whose figure is whole). A rule left half-filled isn't sent (the window says to finish it before Generate).
 */
export function settingsOf(d: SettingsDraft, teams: readonly string[]): ScheduleSettings {
  const prime = d.primeDays === 'none' ? null : {
    weekdays: PRIME_DAYS.find(p => p.id === d.primeDays)?.days ?? [1, 2, 3, 4, 5],
    start: d.primeStart, end: d.primeEnd, share: d.primeShare,
  };
  const cap = (s: string) => (s ? Number(s) : null);
  const sent = new Set(teams);
  const sharing = d.sharing.filter(r => ruleIsWhole.sharing(r) && ruleApplies.sharing(r, sent))
    .map(s => ({ teamIds: teamsIn(s.who), groupIds: groupsIn(s.who), atOnce: s.atOnce }));
  return {
    v: 2, slotMinutes: d.slotMinutes, changeoverMinutes: d.changeoverMinutes, teamsAtOnce: sharingCeiling(sharing), teamIds: [...teams],
    split: { method: d.method, values: d.method === 'even' ? {} : Object.fromEntries(teams.map(t => [t, figureOf(d, t) ?? 0])) },
    timeMode: d.timeMode,
    prime,
    rules: {
      windows: d.windows.filter(w => ruleIsWhole.windows(w) && w.teamIds.some(t => teams.includes(t)))
        .map(w => ({ teamIds: w.teamIds.filter(t => teams.includes(t)), startAfter: w.startAfter || null, startBy: null, finishBy: w.finishBy || null })),
      maxPerDay: cap(d.maxPerDay), maxPerWeek: cap(d.maxPerWeek),
      avoidGameDays: d.avoidGameDays, avoidBookings: d.avoidBookings, noBackToBack: d.noBackToBack,
      daysOff: d.daysOff.filter(x => ruleIsWhole.daysOff(x) && teams.includes(x.teamId))
        .map(x => ({ teamId: x.teamId, date: x.when === 'date' ? x.date : null, weekday: x.when === 'date' ? null : Number(x.when), note: x.note.trim() || null })),
      fieldsBy: d.fieldsBy.filter(ruleIsWhole.fieldsBy).map(f => ({
        facilityIds: f.facilityIds, groupIds: groupsIn(f.who), teamIds: teamsIn(f.who).filter(t => teams.includes(t)),
      })).filter(f => f.groupIds.length || f.teamIds.length),
      sharing,
    },
  };
}

/**
 * A SAVED SCHEDULE'S SETTINGS AS THE WINDOW HOLDS THEM (Settings…, and Copy a schedule a year on — `shift`). Only the
 * teams running a season now: a team whose season ended leaves the ticks, the figures and every rule — a sharing rule
 * too (`sharingInSeason`), since a stale team would have every count and Generate refused.
 */
export function settingsDraftOf(s: ScheduleSettings, running: ReadonlySet<string>, shift: (day: string) => string = d => d): SettingsDraft {
  const prime = s.prime;
  const primeDays = prime ? (PRIME_DAYS.find(p => p.days.join() === [...prime.weekdays].sort((a, b) => a - b).join())?.id ?? 'weeknights') : 'none';
  return {
    slotMinutes: s.slotMinutes, changeoverMinutes: s.changeoverMinutes, ticked: s.teamIds.filter(t => running.has(t)),
    method: s.split.method,
    values: Object.fromEntries(Object.entries(s.split.values).filter(([t]) => running.has(t)).map(([t, v]) => [t, String(v)])),
    groupTyped: {},
    timeMode: s.timeMode,
    primeShare: prime?.share ?? 'same', primeDays, primeStart: prime?.start ?? '18:00', primeEnd: prime?.end ?? '20:00',
    windows: s.rules.windows.map(w => ({ key: newKey('win'), teamIds: w.teamIds.filter(t => running.has(t)), startAfter: w.startAfter ?? '', finishBy: w.finishBy ?? '' }))
      .filter(w => w.teamIds.length),
    daysOff: s.rules.daysOff.filter(d => running.has(d.teamId)).map(d => ({ key: newKey('off'), teamId: d.teamId, when: d.weekday ? String(d.weekday) : 'date', date: d.date ? shift(d.date) : '', note: d.note ?? '' })),
    maxPerDay: s.rules.maxPerDay == null ? '' : String(s.rules.maxPerDay),
    maxPerWeek: s.rules.maxPerWeek == null ? '' : String(s.rules.maxPerWeek),
    fieldsBy: s.rules.fieldsBy.map(f => ({ key: newKey('fld'), facilityIds: [...f.facilityIds], who: whoOf({ groupIds: f.groupIds, teamIds: f.teamIds.filter(t => running.has(t)) }) })),
    sharing: sharingInSeason(s.rules.sharing, running).map(r => ({ key: newKey('shr'), who: whoOf(r), atOnce: r.atOnce })),
    avoidGameDays: s.rules.avoidGameDays, avoidBookings: s.rules.avoidBookings, noBackToBack: s.rules.noBackToBack,
  };
}
