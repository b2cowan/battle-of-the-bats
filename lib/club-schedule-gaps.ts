/**
 * OPEN SLOTS AND SHORT TEAMS (owner rulings 2026-11-24, docs/projects/active/SCHEDULE_GAPS_PLAN.md).
 *
 * ⚖ A team's share is the LIMIT. Time nobody is owed stays open, and the screen says why it is open and what would change
 * it. This module reads a schedule as it stands (its slots, each team's result against its share, its rules) and answers:
 * who is short for the season (has · share), which slots are open, who could take each one, and — when nobody can — why,
 * grouped by reason. Pure: the schedule page and the New schedule drafts step both call it.
 *
 * The reasons, in the order a slot is tested:
 *   free   — a team still short, free then, allowed there, can take it ("Give it to ▾").
 *   spare  — nobody is short: the shares hand out less than the time (under 100%).
 *   cap    — every short team has already reached the most a practices-a-day or -a-week rule allows over the dates with
 *            time ("one practice a week holds the Rep teams back": 60% is 11 slots, 10 Sundays allow 10).
 *   kept   — the short teams that could still play are kept off this field by a field rule.
 *   plays  — the short teams that could still play already play that day or week.
 *   other  — anything else (a day off, a time window): said per slot, never silence.
 * A short team with no open slot to take ("full") is said too: every slot is handed out.
 *
 * Client-side, it cannot see a team's game days or another booking of the team's own; the generator honours those, so a
 * "Give it to" the rules allow may still land on a game day — the coordinator's call, as a hand move is today.
 */
import { formatShortWeekdayDate, formatStoredDate } from './timezone';
import { formatTime, joinWithAnd, pluralize } from './utils';
import { weekdayOne, weekdayPlural } from './permit-words';
import type { ScheduleSettings } from './club-schedule-settings';

export interface GapSlot {
  key: string;
  day: string;
  week: string;
  weekday: number;
  startClock: string;
  endClock: string;
  venueId: string;
  facilityId: string | null;
  teamIds: readonly string[];
  heldBy: unknown | null;
  locked: boolean;
  movedByHand: boolean;
  /** A slot a team handed back: never offered back to that team (/review 2026-11-24). */
  handedBack?: { teamId: string | null } | null;
  /** A slot of an ADDED PART (Phase 8): only that part's teams may have it, so no "Give it to" from here. */
  partId?: string | null;
}
export interface GapTeam { id: string; name: string; groupId: string | null; groupName?: string | null }
/** A team's result: `got` counts slots; under a sharing rule `units` counts its part of each (a shared slot is a half). */
export interface GapResult { teamId: string; got: number; short: number; units?: number }

export interface GapsInput {
  slots: readonly GapSlot[];
  results: readonly GapResult[];
  teams: readonly GapTeam[];
  rules: Pick<ScheduleSettings['rules'], 'maxPerDay' | 'maxPerWeek' | 'fieldsBy' | 'avoidBookings' | 'daysOff' | 'windows'>;
  split: ScheduleSettings['split'];
}

/** A short team: what it has of its share ("10 of 11"; "4½ of 7" for a team that shares), the gap in whole slots, and
 *  the slots it holds (what a practices-a-day or -a-week rule counts). */
export interface ShortTeam { teamId: string; has: number; share: number; gap: number; slots: number }

export type OpenWhy = 'free' | 'spare' | 'cap' | 'kept' | 'plays' | 'other';
export interface OpenSlot { slot: GapSlot; why: OpenWhy; takers: string[] }

export type GapGroup =
  | { kind: 'free'; slots: OpenSlot[] }
  | { kind: 'spare'; slots: OpenSlot[] }
  | { kind: 'cap'; cap: 'day' | 'week'; perCap: number; most: number; units: number; teams: ShortTeam[]; slots: OpenSlot[] }
  | { kind: 'kept'; keptFor: string[]; facilityIds: string[]; teams: ShortTeam[]; slots: OpenSlot[]; /** No short team (held back or not) may play there. */ allowedMet: boolean }
  | { kind: 'plays'; cap: 'day' | 'week'; teams: ShortTeam[]; slots: OpenSlot[] }
  | { kind: 'other'; teams: ShortTeam[]; slots: OpenSlot[] }
  | { kind: 'full'; teams: ShortTeam[] };

export interface Gaps {
  short: ShortTeam[];
  open: OpenSlot[];
  groups: GapGroup[];
  /** One weekday only (a Sundays dome): the line says "Sundays", the cap reason says "these 10 Sundays". */
  weekday: number | null;
}

const overlaps = (a: GapSlot, b: GapSlot) => a.day === b.day && a.startClock < b.endClock && b.startClock < a.endClock;

export function scheduleGaps(input: GapsInput): Gaps {
  const { rules } = input;
  // The time the schedule can hand out: a slot a booking holds is left out unless kept (locked or moved by hand) — the
  // seat count's own rule (`seatCounts`).
  const usable = rules.avoidBookings ? input.slots.filter(s => !s.heldBy || s.locked || s.movedByHand) : [...input.slots];
  const teamById = new Map(input.teams.map(t => [t.id, t]));
  // Has · share as the share counts: a team that shares holds half a facility a slot, so its figure is its units
  // ("4½ of 7"), never its slot count (/review 2026-11-24: "10 of 12" for 5 units of 7). The gap is the short count,
  // rounded up to whole slots as the season's Short tile counts it.
  const short: ShortTeam[] = input.results.filter(r => r.short > 0 && teamById.has(r.teamId))
    .map(r => {
      const has = r.units != null && Math.abs(r.units - r.got) > 1e-9 ? r.units : r.got;
      return { teamId: r.teamId, has, share: Number.isInteger(has) ? has + r.short : Math.ceil(has + r.short - 0.5), gap: r.short, slots: r.got };
    })
    .sort((a, b) => b.gap - a.gap);
  const openSlots = usable.filter(s => !s.teamIds.length).sort((a, b) => a.day.localeCompare(b.day) || a.startClock.localeCompare(b.startClock));
  const weekdays = new Set(usable.map(s => s.weekday));
  const weekday = weekdays.size === 1 ? [...weekdays][0] : null;

  // The most a practices-a-day or -a-week rule allows a team over the dates that hold time.
  const days = new Set(usable.map(s => s.day)).size;
  const weeks = new Set(usable.map(s => s.week)).size;
  const byDay = rules.maxPerDay != null ? rules.maxPerDay * days : Infinity;
  const byWeek = rules.maxPerWeek != null ? rules.maxPerWeek * weeks : Infinity;
  const most = Math.min(byDay, byWeek);
  const cap: 'day' | 'week' = byDay <= byWeek ? 'day' : 'week';
  // Held back by the rule: it already holds the most slots the rule allows (slots, as the rule counts them).
  const capped = new Set(short.filter(t => t.slots >= most).map(t => t.teamId));

  // Each team's time as it stands, to test a day's and a week's cap and a clash.
  const mine = new Map<string, GapSlot[]>();
  for (const s of usable) for (const id of s.teamIds) (mine.get(id) ?? mine.set(id, []).get(id)!).push(s);
  const keptFor = (s: GapSlot) => rules.fieldsBy.filter(f => s.facilityId && f.facilityIds.includes(s.facilityId));
  const keptOff = (t: GapTeam, s: GapSlot) => {
    const kept = keptFor(s);
    return kept.length > 0 && !kept.some(f => f.teamIds.includes(t.id) || (!!t.groupId && f.groupIds.includes(t.groupId)));
  };
  const offThen = (t: GapTeam, s: GapSlot) =>
    rules.daysOff.some(d => d.teamId === t.id && (d.date === s.day || (d.date == null && d.weekday === s.weekday)))
    || rules.windows.some(w => w.teamIds.includes(t.id) && ((w.startAfter && s.startClock < w.startAfter) || (w.startBy && s.startClock > w.startBy) || (w.finishBy && s.endClock > w.finishBy)));
  const playsThen = (t: GapTeam, s: GapSlot) => {
    const list = mine.get(t.id) ?? [];
    if (list.some(x => overlaps(x, s))) return 'day' as const;
    if (rules.maxPerDay != null && list.filter(x => x.day === s.day).length >= rules.maxPerDay) return 'day' as const;
    if (rules.maxPerWeek != null && list.filter(x => x.week === s.week).length >= rules.maxPerWeek) return 'week' as const;
    return null;
  };

  const open: OpenSlot[] = openSlots.map(slot => {
    if (!short.length) return { slot, why: 'spare' as const, takers: [] };
    const live = short.filter(t => !capped.has(t.teamId)).map(t => teamById.get(t.teamId)!);
    const takers = live.filter(t => t.id !== slot.handedBack?.teamId && !keptOff(t, slot) && !offThen(t, slot) && !playsThen(t, slot)).map(t => t.id);
    if (takers.length) return { slot, why: 'free' as const, takers };
    if (!live.length) return { slot, why: 'cap' as const, takers: [] };
    if (live.every(t => keptOff(t, slot))) return { slot, why: 'kept' as const, takers: [] };
    if (live.every(t => playsThen(t, slot))) return { slot, why: 'plays' as const, takers: [] };
    return { slot, why: 'other' as const, takers: [] };
  });

  const of = (why: OpenWhy) => open.filter(o => o.why === why);
  const groups: GapGroup[] = [];
  if (of('free').length) groups.push({ kind: 'free', slots: of('free') });
  if (capped.size) {
    groups.push({ kind: 'cap', cap, perCap: cap === 'day' ? rules.maxPerDay! : rules.maxPerWeek!, most, units: cap === 'day' ? days : weeks,
      teams: short.filter(t => capped.has(t.teamId)), slots: of('cap') });
  }
  const liveShort = short.filter(t => !capped.has(t.teamId));
  if (of('kept').length) {
    const kept = new Map<string, string>();
    const facs = new Set<string>();
    for (const o of of('kept')) {
      if (o.slot.facilityId) facs.add(o.slot.facilityId);
      for (const f of keptFor(o.slot)) {
        for (const g of f.groupIds) kept.set(`g:${g}`, input.teams.find(t => t.groupId === g)?.groupName ?? 'a group');
        for (const id of f.teamIds) kept.set(`t:${id}`, teamById.get(id)?.name ?? 'a team');
      }
    }
    // "Every team allowed there has its share" is said only when it is true: no short team at all, held back or not, may
    // play on those fields (/review 2026-11-24).
    const allowedMet = !short.some(t => of('kept').some(o => !keptOff(teamById.get(t.teamId)!, o.slot)));
    groups.push({ kind: 'kept', keptFor: [...kept.values()], facilityIds: [...facs], teams: liveShort, slots: of('kept'), allowedMet });
  }
  if (of('plays').length) {
    const anyWeek = of('plays').some(o => liveShort.some(t => playsThen(teamById.get(t.teamId)!, o.slot) === 'week'));
    groups.push({ kind: 'plays', cap: anyWeek ? 'week' : 'day', teams: liveShort, slots: of('plays') });
  }
  if (of('other').length) groups.push({ kind: 'other', teams: liveShort, slots: of('other') });
  if (of('spare').length) groups.push({ kind: 'spare', slots: of('spare') });
  // Short with nothing open to take, and no rule that explains it: every slot is handed out.
  if (liveShort.length && !openSlots.length) groups.push({ kind: 'full', teams: liveShort });
  return { short, open, groups, weekday };
}

// ── The words ───────────────────────────────────────────────────────────────────────────────────

/** "Sun, Mar 7" or "Mar 7". */
const dayWords = (day: string) => formatShortWeekdayDate(day);
/** A team's figure: whole, or with a half ("4½") for a team that shares. */
export const figure = (n: number) => (Number.isInteger(n) ? String(n) : `${Math.floor(n)}½`);
const placesWords = (names: readonly string[]) => {
  const uniq = [...new Set(names.filter(Boolean))];
  // "Fields 5 and 6" from "Field 5", "Field 6" ("Boxes 1 and 2"); else joined as they are.
  const m = uniq.map(n => /^(.*\D)\s*(\d+)$/.exec(n));
  if (uniq.length > 1 && m.every(x => x && x[1].trim() === m[0]![1].trim())) {
    const noun = m[0]![1].trim();
    return `${noun}${/(s|x|z|ch|sh)$/i.test(noun) ? 'es' : 's'} ${joinWithAnd(m.map(x => x![2]))}`;
  }
  return joinWithAnd(uniq);
};

/** [marketing] Every sentence of the page line and the window (owner rulings 2026-11-24; drawing SCHEDULE_GAPS_DRAWINGS.html). */
export const GAP_WORDS = {
  windowTitle: 'Open slots and short teams',
  /** "Jan 3 – Mar 7 · 180 slots to hand out". */
  identity: (dates: string, seats: number) => `${dates} · ${pluralize(seats, 'slot')} to hand out`,
  seeWhy: 'See why',
  shortTitle: 'Short for the season',
  openTitle: 'Open slots',
  colTeam: 'Team',
  colHas: 'Has',
  colShare: 'Share',
  colWhy: 'Why',
  colWhen: 'When',
  colWhere: 'Where',
  colWho: 'Who could take it',
  giveIt: 'Give it to',
  gave: (team: string, when: string) => `${team} has ${when}.`,
  showAll: (n: number) => `Show all ${n}`,
  showFewer: 'Show fewer',
  doorPerDay: 'Change practices a day',
  doorPerWeek: 'Change practices a week',
  doorShares: 'Change the shares',
  doorFieldRules: 'Change the field rules',
  doorRules: 'Change the rules',
  canTake: (day: string) => `Free ${formatStoredDate(day, { withYear: false })}`,

  /** THE PAGE LINE: the same sentence on every set of dates; only "where" follows the screen. Null when nothing is short or
   *  open. `onScreen`: the dates the grid shows; `scope` "on these Sundays" / "this week". */
  pageLine(g: Gaps, onScreen: readonly string[], scope: string): string | null {
    const shortN = g.short.length, openN = g.open.length;
    if (!shortN && !openN) return null;
    const gaps = g.short.map(t => t.gap);
    const same = gaps.every(n => n === gaps[0]);
    const total = gaps.reduce((a, b) => a + b, 0);
    const shortPart = !shortN ? ''
      : shortN === 1 ? `1 team is ${pluralize(gaps[0], 'slot')} short of its share`
        : same ? `${shortN} teams are ${pluralize(gaps[0], 'slot')} short of their share`
          : `${shortN} teams are short of their share, ${pluralize(total, 'slot')} in all`;
    if (!openN) return `${shortPart}, and no slot is open.`;
    const days = [...new Set(g.open.map(o => o.slot.day))];
    const here = new Set(onScreen);
    const seen = g.open.filter(o => here.has(o.slot.day)).length;
    const opens = openN === 1 ? '1 slot is open' : `${openN} slots are open`;
    const unit = g.weekday ? weekdayPlural(g.weekday) : 'days';
    const where = days.length === 1 ? `${openN === 1 ? 'on' : 'all on'} ${dayWords(days[0])}`
      : `on ${days.length} ${unit}, ${seen === 0 ? 'none' : seen === openN ? 'all' : seen} of them ${scope}`;
    return shortN ? `${shortPart}, and ${opens}, ${where}.` : `${opens}, ${where}.`;
  },

  /** A group's heading, its explanation, in the window and (cause only) above the drafts. */
  head(gr: GapGroup, nameOfGroup: (teams: readonly ShortTeam[]) => string): string {
    const n = 'slots' in gr ? gr.slots.length : 0;
    const slots = n === 1 ? '1 slot is open' : `${n} slots are open`;
    switch (gr.kind) {
      case 'free': return n === 1 ? '1 slot is open that a short team can take' : `${n} slots are open that short teams can take`;
      case 'spare': return `${slots}, and every team has its share`;
      case 'cap': {
        const rule = gr.cap === 'day' ? `${pluralize(gr.perCap, 'practice')} a day` : `${pluralize(gr.perCap, 'practice')} a week`;
        return n ? `${slots} because ${rule} holds ${nameOfGroup(gr.teams)} back` : `The rule of ${rule} holds ${nameOfGroup(gr.teams)} back`;
      }
      case 'kept': return `${slots} on fields kept for ${joinWithAnd(gr.keptFor)}`;
      case 'plays': return `${slots} on ${gr.cap === 'week' ? 'weeks' : 'days'} the short teams already play`;
      case 'other': return n === 1 ? '1 slot is open that no short team can take' : `${n} slots are open that no short team can take`;
      case 'full': return gr.teams.length === 1 ? '1 team is short and no slot is open' : `${gr.teams.length} teams are short and no slot is open`;
    }
  },
  /** `oneOf`: "A Rep team" (`teamSubject`) — the subject of the cap's sentence. */
  explain(gr: GapGroup, g: Gaps, oneOf: (teams: readonly ShortTeam[]) => string, placeNames: (facilityIds: readonly string[]) => string[]): string {
    switch (gr.kind) {
      case 'free': return 'A team that is short, free then and allowed there can have it.';
      case 'spare': return 'The shares hand out less than the time there is, so nobody is owed it.';
      case 'cap': {
        // "on these 10 Sundays" / "on this Sunday" / "on these 6 weeks" — the dates that hold time.
        const unit = g.weekday ? (gr.units === 1 ? weekdayOne(g.weekday) : weekdayPlural(g.weekday)) : (gr.cap === 'day' ? (gr.units === 1 ? 'day' : 'days') : (gr.units === 1 ? 'week' : 'weeks'));
        const span = gr.units === 1 ? `this ${unit}` : `these ${gr.units} ${unit}`;
        const shares = [...new Set(gr.teams.map(t => t.share))];
        const share = shares.length === 1 ? `its share is ${figure(shares[0])}` : 'each one’s share is more than that';
        return `${oneOf(gr.teams)} can have at most ${pluralize(gr.most, 'slot')} on ${span}, and ${share}.`;
      }
      case 'kept': {
        const names = placeNames(gr.facilityIds).filter(Boolean);
        const places = names.length ? placesWords(names) : 'These fields';
        const still = gr.teams.length === 1 ? 'The team still short isn’t allowed on them.' : 'The teams still short aren’t allowed on them.';
        const met = gr.allowedMet ? ', and every team allowed there has its share' : '';
        return `${places} ${gr.facilityIds.length === 1 ? 'is' : 'are'} kept for ${joinWithAnd(gr.keptFor)}${met}. ${still}`;
      }
      case 'plays': return gr.cap === 'week'
        ? 'Each team still short already has its practices those weeks.'
        : 'Each team still short already plays those days.';
      case 'other': return 'Each team still short is kept off the field, already plays then, or has a day off or a time rule then.';
      case 'full': return 'Every slot is handed out.';
    }
  },
  /** Who could take an open slot, or why nobody can. */
  who(o: OpenSlot, names: (ids: readonly string[]) => string): string {
    switch (o.why) {
      case 'free': return names(o.takers);
      case 'spare': return 'Nobody: every team has its share';
      case 'cap': return 'Nobody: the teams still short can’t play more';
      case 'kept': return 'Nobody: the field is kept for teams that aren’t short';
      case 'plays': return 'Nobody: every team still short already plays then';
      case 'other': return 'Nobody short can play then';
    }
  },
  /** A day's open slots in one row: "Sun, Mar 7 · 8:00 a.m., 9:00 a.m. and 10:00 a.m.". */
  when: (day: string, clocks: readonly string[]) => `${dayWords(day)} · ${joinWithAnd([...new Set(clocks)].sort().map(formatTime))}`,
  where: placesWords,
};

/** The cap sentence's subject: "A Rep team" when every team is of one group, else "A team" (one team: its name). */
export function teamSubject(teams: readonly ShortTeam[], all: readonly GapTeam[]): string {
  const byId = new Map(all.map(t => [t.id, t]));
  if (teams.length === 1) return byId.get(teams[0].teamId)?.name ?? 'A team';
  const groups = new Set(teams.map(t => byId.get(t.teamId)?.groupName ?? null));
  const [g] = [...groups];
  return groups.size === 1 && g ? `A ${g} team` : 'A team';
}

/** "the Rep teams" when every team is of one group, else "these 8 teams" (1: its name). */
export function teamsWords(teams: readonly ShortTeam[], all: readonly GapTeam[]): string {
  const byId = new Map(all.map(t => [t.id, t]));
  if (teams.length === 1) return byId.get(teams[0].teamId)?.name ?? 'a team';
  const groups = new Set(teams.map(t => byId.get(t.teamId)?.groupName ?? null));
  const [g] = [...groups];
  return groups.size === 1 && g ? `the ${g} teams` : `these ${teams.length} teams`;
}
