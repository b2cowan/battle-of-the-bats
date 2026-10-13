'use client';
/**
 * NEW SCHEDULE — and Tools › Settings…, the same window (Club Tier Stage 11a, part B; hub K4MPu4ni53Ct7yrDcmWJd9 →
 * Mockups → Stages 10 + 11, specimens 4 "New schedule, step 1", 5 "Step 2 · drafts", 14 step 3 "Sundays in 90-minute
 * slots"; plan §5.4; Asks 5, 12, 15, 18–22, 27).
 *
 * ⚖ THE TOURNAMENT GENERATOR'S FRAME, WORN AS A LOOK (P11-02, Ask 5): the kit's wide form window, "Step 1 of 2 · settings",
 * titled section cards in one scroll, Day · From · Until rows, facility chips with All · None, a foot that counts what it
 * will make, Cancel beside the lime Generate drafts; step 2's ranked cards, "Three more drafts", the chosen draft read
 * below, ONE statement of what saving does, Back to settings and the lime that saves. All of it the scheduler's own code
 * (`Schedules.module.css`) — never `app/[orgSlug]/admin/tournaments/schedule/**`, whose lift into one shared frame is the
 * tournament redesign's shared ask.
 *
 *   0 · Copy a schedule, above the cards and only when the club has one — its teams, shares and rules a year on, and its
 *       time unless a permit gives the time (owner, 2026-10-12: two fields, not one "Start from" — the permit is a LINK
 *       the schedule keeps, the copy is a copy, and a club's second year wants both).
 *   1 · The time — Name · Permit (No permit, or one — its venue, facilities, dates, hours and dates off in one pick) ·
 *       Venue · Facilities · From · To · rows of Days · From · Until · Slot length ·
 *       Changeover · Teams at once · Dates off; the summary the server counts ("12 weeks · 2 lanes · 30 slots a week · 354
 *       slots"; a one-weekday schedule "25 Sundays · 6 fields · 12 slots a Sunday · 300 slots").
 *   2 · Who, and how much — New allocation's FORM TABLE for time (Ask 18; `FormTable`, the shared part): Split the time
 *       (Evenly · By percentage · A set number a week), the teams under their club groups, a group's figure spreading
 *       over its ticked teams, any team retypable, the Slots column the SERVER's count of each share (`previewOnly` —
 *       never re-decided here), the closing row and its note; Prime time shared the same way or evenly (Ask 18 (a));
 *       "The shares hold every week" said once (Ask 18 (b)); the teams with no season running in one line (Ask 15).
 *   3 · Rules, folded ("Rules · 4 on") — start times by age group, teams' days off (Ask 20), caps, prime time, fields by
 *       group (Ask 22), never on a game day, never over a booking already on the books, no back-to-back days.
 *   Step 2 — three ranked drafts; the chosen one read By team (is it fair?) or By day (every slot of every day, the
 *       review before keeping — Ask 19); Export (Excel, PDF) above it, the draft's name and "a draft" on the file; the
 *       statement; Save as a draft → the schedule's page. In Settings… the lime keeps the draft, and asks once.
 *
 * ⚠ A SHARE IS THE SERVER'S: the Slots column, the closing row and the foot's count come from the generate route's
 * `previewOnly` answer, debounced as the form changes. The client never re-decides a largest-remainder share.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Check, ChevronDown, Download, Plus, X } from 'lucide-react';
import KitDialog from '../KitDialog';
import ck from '../ClubKit.module.css';
import { repKit } from '../RepKit';
import { PickField } from '../PermitWindows';
import { FormError, jsonInit, moneyFetch, refusalText } from '../money/MoneyKit';
import mk from '../money/Money.module.css';
import own from '../Permits.module.css';
import FormTable, { type FormTableGroup, type FormTableRow } from '@/components/shared/FormTable';
import { CheckChoice } from '@/components/admin/tournament/ScreenParts';
import { ViewSwitch } from '@/components/coaches/ScheduleCalendarViews';
import { spreadGroupFigure } from '@/lib/club-bill-split';
import { formatTimeRange, pluralize } from '@/lib/utils';
import { formatShortWeekdayDate, formatStoredDate, isCalendarDate } from '@/lib/timezone';
import { WEEKDAY_OPTIONS, facilityListWords, renewedName, weekdayPlural, weekdaysShort } from '@/lib/permit-words';
import { rulesOn, SETTINGS_LIMITS, type ScheduleSettings } from '@/lib/club-schedule-settings';
import { SCHEDULE_REFUSALS as R, SCHEDULE_SCREEN_WORDS as W } from '@/lib/club-schedule-words';
import {
  NO_GROUP, PRIME_DAYS, closingNote, isStale, facilityNoun, footCount, nightsWords, placeKey, summaryLine, teamColour, yearOn,
  type GenerateSummary, type ScheduleView,
} from '@/lib/club-schedule-view';
import { exportScheduleFile } from '@/lib/export/club-schedule-export';
import type { DraftMeasure, TeamResult } from '@/lib/club-schedule-engine';
import type { DateOff, TimeBlock } from '@/lib/permit-time';
import { Statement, Swatch } from './ScheduleParts';
import sch from './Schedules.module.css';
import LoadingState from '@/components/shared/LoadingState';

// ── The inputs New schedule reads (`GET /api/admin/schedules?new=1`) ─────────────────────────────

interface InputTeam { id: string; name: string; groupId: string | null; groupName: string | null; color: string | null; season: { id: string; name: string } | null }
interface InputPlace { venueId: string; venueName: string; facilities: { id: string; name: string }[] }
interface InputPermit { id: string; name: string; startsOn: string; endsOn: string; blocks: TimeBlock[]; datesOff: DateOff[] }
export interface NewInputs {
  nothingToSchedule: boolean;
  canMoney: boolean;
  groups: { id: string; name: string }[];
  teams: InputTeam[];
  places: InputPlace[];
  permits: InputPermit[];
  schedules: { id: string; name: string; startsOn: string; endsOn: string }[];
}

// ── The draft the form holds ──────────────────────────────────────────────────────────────────────

let nextKey = 0;
const newKey = (p: string) => `${p}-${++nextKey}`;

/** A source's dates off as the form's rows — moved a year on when the source is last year's schedule. */
const offRows = (list: readonly { day: string; note: string | null }[], shift: (day: string) => string = d => d) =>
  list.map(o => ({ key: newKey('off'), day: shift(o.day), note: o.note ?? '' }));

interface HoursRow {
  key: string; weekdays: number[]; start: string; end: string;
  /** A permit's block on another venue or facilities than the form's (a town permit over several parks): kept as it was. */
  place?: { venueId: string; facilityIds: string[] };
  /** A block's own dates inside the schedule's (stored, not offered on the form): kept, or the slots would run past them. */
  dates?: { fromDate: string | null; untilDate: string | null };
}
interface OffRow { key: string; day: string; note: string }
interface WindowRule { key: string; teamIds: string[]; startAfter: string; finishBy: string }
interface DayOffRule { key: string; teamId: string; when: string; date: string; note: string }
interface FieldsRule { key: string; facilityIds: string[]; who: string[] }

interface Draft {
  name: string;
  /** The permit the schedule is linked to (its page lists the schedule; Bill reads its price) — '' for none. */
  permitId: string;
  /** The schedule copied a year on — '' for none. Both can be set: last year's teams on this year's permit. */
  copyFrom: string;
  venueId: string;
  facilityIds: string[];
  startsOn: string;
  endsOn: string;
  rows: HoursRow[];
  datesOff: OffRow[];
  slotMinutes: number;
  changeoverMinutes: number;
  teamsAtOnce: number;
  ticked: string[];
  method: ScheduleSettings['split']['method'];
  values: Record<string, string>;
  groupTyped: Record<string, string>;
  primeShare: 'same' | 'even';
  primeDays: string;
  primeStart: string;
  primeEnd: string;
  primeMode: 'keep' | 'rotate';
  windows: WindowRule[];
  daysOff: DayOffRule[];
  maxPerDay: string;
  maxPerWeek: string;
  fieldsBy: FieldsRule[];
  avoidGameDays: boolean;
  avoidBookings: boolean;
  noBackToBack: boolean;
}

const EMPTY: Draft = {
  name: '', permitId: '', copyFrom: '', venueId: '', facilityIds: [], startsOn: '', endsOn: '',
  rows: [{ key: 'row-0', weekdays: [], start: '', end: '' }], datesOff: [],
  slotMinutes: 60, changeoverMinutes: 0, teamsAtOnce: 1, ticked: [], method: 'even', values: {}, groupTyped: {},
  primeShare: 'same', primeDays: 'none', primeStart: '18:00', primeEnd: '20:00', primeMode: 'keep',
  windows: [], daysOff: [], maxPerDay: '', maxPerWeek: '', fieldsBy: [], avoidGameDays: true, avoidBookings: true, noBackToBack: false,
};

type ListName = 'rows' | 'datesOff' | 'windows' | 'daysOff' | 'fieldsBy';
type RowOf<K extends ListName> = Draft[K] extends readonly (infer R)[] ? R : never;

const SLOT_LENGTHS = [30, 45, 60, 75, 90, 105, 120, 150, 180, 240];
const CHANGEOVERS = [0, 5, 10, 15, 20, 30, 45, 60];
const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const positive = (s: string | undefined): number | null => {
  const n = Number((s ?? '').replace(/[%\s]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const wholeWeekly = (s: string | undefined): number | null => {
  const n = positive(s);
  return n != null && Number.isInteger(n) && n <= SETTINGS_LIMITS.perWeek ? n : null;
};
const withCurrent = (list: number[], current: number) => (list.includes(current) ? list : [...list, current].sort((a, b) => a - b));

/** The time as the form holds it, from a set of blocks (a permit's, or a schedule's): the shared place on top, each
 *  block a row of hours — a block on another place keeps its own. */
function timeFromBlocks(blocks: readonly TimeBlock[], places: readonly InputPlace[], shift: (day: string) => string = d => d): Pick<Draft, 'venueId' | 'facilityIds' | 'rows'> {
  const venueId = blocks[0]?.venueId ?? '';
  const venue = places.find(p => p.venueId === venueId);
  const every = (venue?.facilities ?? []).map(f => f.id);
  const facsOf = (b: TimeBlock) => (b.facilityIds.length ? [...b.facilityIds] : places.find(p => p.venueId === b.venueId)?.facilities.map(f => f.id) ?? []);
  const first = blocks[0] ? facsOf(blocks[0]) : every;
  const same = (b: TimeBlock) => b.venueId === venueId && facsOf(b).slice().sort().join() === first.slice().sort().join();
  return {
    venueId,
    facilityIds: first,
    rows: blocks.length
      ? blocks.map(b => ({
        key: newKey('row'), weekdays: [...b.weekdays], start: b.startTime.slice(0, 5), end: b.endTime.slice(0, 5),
        ...(same(b) ? {} : { place: { venueId: b.venueId, facilityIds: facsOf(b) } }),
        ...(b.fromDate || b.untilDate ? { dates: { fromDate: b.fromDate ? shift(b.fromDate) : null, untilDate: b.untilDate ? shift(b.untilDate) : null } } : {}),
      }))
      : [{ key: newKey('row'), weekdays: [], start: '', end: '' }],
  };
}

/** A "Facilities by group" rule keeps only the facilities the time now holds — the server refuses a rule naming another
 *  venue's (last year's schedule copied onto this year's permit somewhere else, or the Venue changed by hand). The rule
 *  itself stays, its "only for" kept, so the club picks this venue's facilities for it; until then it isn't sent. */
function fieldsInTime<D extends Pick<Draft, 'venueId' | 'rows' | 'fieldsBy'>>(d: D, places: readonly InputPlace[]): D {
  if (!d.venueId) return d;
  const venues = new Set(d.rows.map(r => r.place?.venueId ?? d.venueId));
  const held = new Set(places.filter(p => venues.has(p.venueId)).flatMap(p => p.facilities.map(f => f.id)));
  if (d.fieldsBy.every(f => f.facilityIds.every(id => held.has(id)))) return d;
  return { ...d, fieldsBy: d.fieldsBy.map(f => ({ ...f, facilityIds: f.facilityIds.filter(id => held.has(id)) })) };
}

/** A saved schedule's settings as the form holds them (Settings…, and "last year's schedule"). */
function draftFromSettings(s: ScheduleSettings, running: ReadonlySet<string>, shift: (day: string) => string = d => d): Partial<Draft> {
  const ticked = s.teamIds.filter(t => running.has(t));
  const prime = s.prime;
  const primeDays = prime ? (PRIME_DAYS.find(p => p.days.join() === [...prime.weekdays].sort((a, b) => a - b).join())?.id ?? 'weeknights') : 'none';
  return {
    slotMinutes: s.slotMinutes, changeoverMinutes: s.changeoverMinutes, teamsAtOnce: s.teamsAtOnce, ticked,
    method: s.split.method,
    values: Object.fromEntries(Object.entries(s.split.values).filter(([t]) => running.has(t)).map(([t, v]) => [t, String(v)])),
    groupTyped: {},
    primeShare: prime?.share ?? 'same', primeDays, primeStart: prime?.start ?? '18:00', primeEnd: prime?.end ?? '20:00', primeMode: prime?.mode ?? 'keep',
    windows: s.rules.windows.map(w => ({ key: newKey('win'), teamIds: w.teamIds.filter(t => running.has(t)), startAfter: w.startAfter ?? '', finishBy: w.finishBy ?? '' })),
    daysOff: s.rules.daysOff.filter(d => running.has(d.teamId)).map(d => ({ key: newKey('off'), teamId: d.teamId, when: d.weekday ? String(d.weekday) : 'date', date: d.date ? shift(d.date) : '', note: d.note ?? '' })),
    maxPerDay: s.rules.maxPerDay == null ? '' : String(s.rules.maxPerDay),
    maxPerWeek: s.rules.maxPerWeek == null ? '' : String(s.rules.maxPerWeek),
    fieldsBy: s.rules.fieldsBy.map(f => ({ key: newKey('fld'), facilityIds: [...f.facilityIds], who: [...f.groupIds.map(g => `g:${g}`), ...f.teamIds.map(t => `t:${t}`)] })),
    avoidGameDays: s.rules.avoidGameDays, avoidBookings: s.rules.avoidBookings, noBackToBack: s.rules.noBackToBack,
  };
}

// ── Step 2's read (`POST /api/admin/schedules/generate`) ─────────────────────────────────────────

interface DraftSlot {
  key: string; venueId: string; facilityId: string | null; startsAt: string; endsAt: string; day: string; weekday: number; week: string;
  startClock: string; endClock: string; prime: boolean; weight: number; heldBy: { ownerName: string; kind: string | null } | null; kept: boolean;
}
interface DraftRead {
  strategy: string; label: string; round: number; score: number; lines: string[]; measures: DraftMeasure[];
  warnings: { line: string }[];
  totals: { slots: number; seats: number; handedOut: number; open: number; held: number };
  teams: TeamResult[];
  assignments: Record<string, string[]>;
}
interface GenerateRead { summary: GenerateSummary; slots: DraftSlot[]; drafts: DraftRead[] }

/** In Settings…: the schedule the window re-sets, as its page read it. */
export interface SettingsOf {
  view: ScheduleView;
  /** Kept: the version it made, and whether a new name saved with it. */
  onKept: (version: number, renamed: boolean) => void;
  /** The schedule changed under the window: the page re-reads it, so a retry sends the version it now holds. */
  onStale?: () => void;
  regenerate?: boolean;
}

export default function NewScheduleWindow({ q, orgSlug, orgName, startPermitId = null, settingsOf, onCancel, onSaved }: {
  q: string;
  orgSlug: string;
  /** The club's name — whose paper an export is. */
  orgName?: string;
  /** The permit window's "Hand out this time in a schedule ›": started from that permit. */
  startPermitId?: string | null;
  /** Tools › Settings… (and "Regenerate the unlocked slots…", `regenerate`): the schedule, every value as saved. */
  settingsOf?: SettingsOf;
  onCancel: () => void;
  /** New schedule kept as a draft: its id. */
  onSaved?: (id: string) => void;
}) {
  const editing = settingsOf?.view ?? null;
  const [inputs, setInputs] = useState<NewInputs | null>(null);
  const [inputsFailed, setInputsFailed] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [noSeasonOpen, setNoSeasonOpen] = useState(false);
  const [step, setStep] = useState<'settings' | 'drafts'>('settings');
  const set = useCallback((patch: Partial<Draft>) => setDraft(d => ({ ...d, ...patch })), []);

  // ── The inputs, and where the form starts ──
  useEffect(() => {
    let live = true;
    // org-slug-ok: `q` is the host page's "orgSlug=…" query
    moneyFetch<NewInputs>(`/api/admin/schedules?${q}&new=1`).then(r => {
      if (!live) return;
      if (!r.ok) { setInputsFailed(true); return; }
      setInputs(r.data);
      const running = new Set(r.data.teams.filter(t => t.season).map(t => t.id));
      if (editing) {
        setDraft({
          ...EMPTY, ...draftFromSettings(editing.schedule.settings, running),
          name: editing.schedule.name, startsOn: editing.schedule.startsOn, endsOn: editing.schedule.endsOn,
          ...timeFromBlocks(editing.time.blocks, r.data.places),
          datesOff: offRows(editing.time.datesOff),
        });
        return;
      }
      const base: Draft = { ...EMPTY, ticked: r.data.teams.filter(t => t.season).map(t => t.id) };
      const permit = startPermitId ? r.data.permits.find(p => p.id === startPermitId) : null;
      setDraft(permit ? { ...base, ...fromPermit(permit, r.data.places), name: permit.name } : base);
    }).catch(() => { if (live) setInputsFailed(true); });
    return () => { live = false; };
    // The inputs load once, as the window opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function fromPermit(p: InputPermit, places: readonly InputPlace[]): Partial<Draft> {
    return {
      permitId: p.id, startsOn: p.startsOn, endsOn: p.endsOn, ...timeFromBlocks(p.blocks, places),
      datesOff: offRows(p.datesOff),
    };
  }

  /** Permit: its time in one pick, and the link the schedule keeps. No permit drops the link and leaves the form as it is. */
  function pickPermit(id: string) {
    if (!inputs) return;
    const p = id ? inputs.permits.find(x => x.id === id) : null;
    if (!p) { set({ permitId: '' }); return; }
    setDraft(d => fieldsInTime({ ...d, ...fromPermit(p, inputs.places), name: d.name.trim() ? d.name : p.name }, inputs.places));
  }

  /** The latest Copy pick — a read that lands after a later pick (or Don't copy) is dropped, never applied over it. */
  const copyAsk = useRef(0);
  /** Copy a schedule: its teams, shares and rules a year on — and its time, unless a permit is already giving the time. */
  async function pickCopy(id: string) {
    if (!inputs) return;
    const mine = ++copyAsk.current;
    if (!id) { set({ copyFrom: '' }); return; }
    // org-slug-ok: `q` is the host page's "orgSlug=…" query
    const r = await moneyFetch<ScheduleView>(`/api/admin/schedules/${encodeURIComponent(id)}?${q}`).catch(() => null);
    if (mine !== copyAsk.current) return;
    if (!r?.ok) { setError(refusalText(r?.data, 'That schedule couldn’t be read. Try again.')); return; }
    const running = new Set(inputs.teams.filter(t => t.season).map(t => t.id));
    const v = r.data;
    setDraft(d => fieldsInTime({
      ...d, ...draftFromSettings(v.schedule.settings, running, yearOn),
      ...(d.permitId ? {} : {
        ...timeFromBlocks(v.time.blocks, inputs.places, yearOn),
        startsOn: yearOn(v.schedule.startsOn), endsOn: yearOn(v.schedule.endsOn),
        datesOff: offRows(v.time.datesOff, yearOn),
      }),
      copyFrom: id, name: d.name.trim() ? d.name : renewedName(v.schedule.name),
    }, inputs.places));
  }

  // ── What the form says, worked out ──
  const places = useMemo(() => inputs?.places ?? [], [inputs]);
  const venue = places.find(p => p.venueId === draft.venueId) ?? null;
  const running = useMemo(() => (inputs?.teams ?? []).filter(t => t.season), [inputs]);
  const noSeason = useMemo(() => (inputs?.teams ?? []).filter(t => !t.season), [inputs]);
  const tickedSet = useMemo(() => new Set(draft.ticked), [draft.ticked]);
  const inOrder = useMemo(() => running.filter(t => tickedSet.has(t.id)), [running, tickedSet]);
  const groupKeyOf = (t: InputTeam) => t.groupId ?? NO_GROUP;
  const groupKeys = useMemo(() => (running.some(t => t.groupId) ? [...new Set(running.map(groupKeyOf))] : []), [running]);
  const membersOf = (key: string) => running.filter(t => groupKeyOf(t) === key);
  const groupLabel = (key: string) => (key === NO_GROUP ? W.notInGroup : running.find(t => t.groupId === key)?.groupName ?? W.notInGroup);

  const figureOf = (teamId: string): number | null =>
    draft.method === 'percentage' ? positive(draft.values[teamId]) : draft.method === 'weekly' ? wholeWeekly(draft.values[teamId]) : 1;
  const percentHundredths = draft.method === 'percentage'
    ? inOrder.reduce((s, t) => s + Math.round((positive(draft.values[t.id]) ?? 0) * 100), 0) : 10000;

  /** The schedule's time as the routes read it. */
  const timeBody = useMemo(() => {
    const facilityIds = venue && venue.facilities.length ? draft.facilityIds : [];
    return {
      startsOn: draft.startsOn, endsOn: draft.endsOn,
      blocks: draft.rows
        .filter(r => r.weekdays.length && r.start && r.end && r.end > r.start)
        .map(r => ({
          venueId: r.place?.venueId ?? draft.venueId, facilityIds: r.place?.facilityIds ?? facilityIds,
          weekdays: r.weekdays, startTime: r.start, endTime: r.end, fromDate: r.dates?.fromDate ?? null, untilDate: r.dates?.untilDate ?? null,
        })),
      datesOff: draft.datesOff.filter(o => isCalendarDate(o.day)).map(o => ({ day: o.day, note: o.note.trim() || null })),
    };
  }, [draft.startsOn, draft.endsOn, draft.rows, draft.datesOff, draft.venueId, draft.facilityIds, venue]);

  /** The settings as the routes read them — `previewOnly` asks with only the teams whose figure is whole. */
  const settingsBody = useCallback((onlyWhole: boolean): ScheduleSettings => {
    const teams = inOrder.filter(t => !onlyWhole || figureOf(t.id) != null).map(t => t.id);
    const prime = draft.primeDays === 'none' ? null : {
      weekdays: PRIME_DAYS.find(p => p.id === draft.primeDays)?.days ?? [1, 2, 3, 4, 5],
      start: draft.primeStart, end: draft.primeEnd, share: draft.primeShare, mode: draft.primeMode,
    };
    const cap = (s: string) => (s ? Number(s) : null);
    return {
      v: 1, slotMinutes: draft.slotMinutes, changeoverMinutes: draft.changeoverMinutes, teamsAtOnce: draft.teamsAtOnce, teamIds: teams,
      split: { method: draft.method, values: draft.method === 'even' ? {} : Object.fromEntries(teams.map(t => [t, figureOf(t) ?? 0])) },
      prime,
      rules: {
        windows: draft.windows.filter(w => w.teamIds.some(t => teams.includes(t)) && (w.startAfter || w.finishBy))
          .map(w => ({ teamIds: w.teamIds.filter(t => teams.includes(t)), startAfter: w.startAfter || null, startBy: null, finishBy: w.finishBy || null })),
        maxPerDay: cap(draft.maxPerDay), maxPerWeek: cap(draft.maxPerWeek),
        avoidGameDays: draft.avoidGameDays, avoidBookings: draft.avoidBookings, noBackToBack: draft.noBackToBack,
        daysOff: draft.daysOff.filter(d => teams.includes(d.teamId) && (d.when === 'date' ? isCalendarDate(d.date) : true))
          .map(d => ({ teamId: d.teamId, date: d.when === 'date' ? d.date : null, weekday: d.when === 'date' ? null : Number(d.when), note: d.note.trim() || null })),
        fieldsBy: draft.fieldsBy.filter(f => f.facilityIds.length && f.who.length).map(f => ({
          facilityIds: f.facilityIds,
          groupIds: f.who.filter(w => w.startsWith('g:')).map(w => w.slice(2)),
          teamIds: f.who.filter(w => w.startsWith('t:')).map(w => w.slice(2)).filter(t => teams.includes(t)),
        })).filter(f => f.groupIds.length || f.teamIds.length),
      },
    };
    // figureOf reads the draft, which is listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, inOrder]);

  const timeReady = isCalendarDate(draft.startsOn) && isCalendarDate(draft.endsOn) && draft.endsOn >= draft.startsOn
    && timeBody.blocks.length > 0 && timeBody.blocks.length === draft.rows.length && !!draft.venueId
    && (!venue?.facilities.length || draft.facilityIds.length > 0 || draft.rows.some(r => r.place));
  const permitId = draft.permitId || (editing?.schedule.startedFromPermitId ?? null);
  const fromScheduleId = draft.copyFrom || null;

  // ── The server's count (`previewOnly`), as the form changes ──
  const [summary, setSummary] = useState<GenerateSummary | null>(null);
  const [previewError, setPreviewError] = useState('');
  const previewBody = useMemo(() => (timeReady && percentHundredths <= 10000
    ? { ...timeBody, settings: settingsBody(true), startedFromPermitId: permitId, scheduleId: editing?.schedule.id ?? null, previewOnly: true }
    : null), [timeReady, percentHundredths, timeBody, settingsBody, permitId, editing]);
  const previewKey = previewBody ? JSON.stringify(previewBody) : '';
  const latest = useRef(0);
  useEffect(() => {
    if (!previewKey) { latest.current++; return; }
    const mine = ++latest.current;
    const ask = new AbortController();
    const t = window.setTimeout(async () => {
      // org-slug-ok: `q` is the host page's "orgSlug=…" query
      const r = await moneyFetch<{ summary: GenerateSummary }>(`/api/admin/schedules/generate?${q}`, { ...jsonInit('POST', JSON.parse(previewKey)), signal: ask.signal }).catch(() => null);
      if (mine !== latest.current) return;
      if (!r?.ok) { setSummary(null); setPreviewError(refusalText(r?.data, W.previewFailed)); return; }
      setPreviewError('');
      setSummary(r.data.summary);
    }, 350);
    return () => { window.clearTimeout(t); ask.abort(); };
  }, [previewKey, q]);
  const shown = previewKey ? summary : null;

  const allNames = (venue?.facilities ?? []).filter(f => draft.facilityIds.includes(f.id)).map(f => f.name);
  const oneWeekday = draft.rows.length && draft.rows.every(r => r.weekdays.length === 1 && r.weekdays[0] === draft.rows[0].weekdays[0])
    ? draft.rows[0].weekdays[0] : null;
  const noun = facilityNoun(allNames.length ? allNames : [venue?.venueName ?? ''], shown?.facilities ?? 0);
  const targetOf = (teamId: string) => shown?.targets.find(x => x.teamId === teamId)?.slots ?? null;
  const tickedWithFigure = inOrder.filter(t => figureOf(t.id) != null);

  /** Why Generate can't go yet, in words — or null. */
  const problem = (): string | null => {
    if (!draft.name.trim()) return W.needName;
    if (!draft.venueId) return W.needVenue;
    if (venue?.facilities.length && !draft.facilityIds.length && !draft.rows.some(r => r.place)) return W.needFacility;
    if (!isCalendarDate(draft.startsOn) || !isCalendarDate(draft.endsOn) || draft.endsOn < draft.startsOn) return W.needDates;
    if (timeBody.blocks.length !== draft.rows.length || !timeBody.blocks.length) return W.needHours;
    if (!inOrder.length) return W.needTeams;
    if (draft.method !== 'even' && tickedWithFigure.length !== inOrder.length) return W.needFigures;
    if (percentHundredths > 10000) return W.over100(String((percentHundredths - 10000) / 100));
    return null;
  };

  // ── Step 2 ──
  const [gen, setGen] = useState<GenerateRead | null>(null);
  const [round, setRound] = useState(0);
  const [chosen, setChosen] = useState(0);
  const [lens, setLens] = useState<'team' | 'day'>('team');
  const [asking, setAsking] = useState(false);
  /** What the drafts on show were made from — what Save and Keep send with them. */
  const [madeFrom, setMadeFrom] = useState<{ time: typeof timeBody; settings: ScheduleSettings } | null>(null);

  async function generate(nextRound: number) {
    if (busy) return;
    const p = problem();
    if (p) { setError(p); return; }
    setBusy(true); setError('');
    try {
      const from = { time: timeBody, settings: settingsBody(false) };
      const body = { ...from.time, settings: from.settings, startedFromPermitId: permitId, scheduleId: editing?.schedule.id ?? null, round: nextRound };
      // org-slug-ok: `q` is the host page's "orgSlug=…" query
      const r = await moneyFetch<GenerateRead>(`/api/admin/schedules/generate?${q}`, jsonInit('POST', body));
      if (!r.ok) { setError(refusalText(r.data, R.notSaved)); return; }
      setGen(r.data); setMadeFrom(from); setRound(nextRound); setChosen(0); setStep('drafts');
    } catch {
      setError(R.notSaved);
    } finally {
      setBusy(false);
    }
  }
  // "Regenerate the unlocked slots…": straight to the drafts with the settings as saved.
  const autoRan = useRef(false);
  useEffect(() => {
    if (!settingsOf?.regenerate || autoRan.current || !inputs || !draft.name) return;
    autoRan.current = true;
    void generate(0);
    // Once, as the inputs land.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs, draft.name]);

  const pick = gen?.drafts[chosen] ?? null;
  const assignmentsOf = (d: DraftRead) => Object.entries(d.assignments).map(([slotKey, teamIds]) => ({ slotKey, teamIds }));

  async function save() {
    if (!pick || !madeFrom || busy) return;
    setBusy(true); setError('');
    try {
      const body = {
        name: draft.name.trim(), ...madeFrom.time, settings: madeFrom.settings, assignments: assignmentsOf(pick),
        startedFromPermitId: permitId, startedFromScheduleId: fromScheduleId,
      };
      // org-slug-ok: `q` is the host page's "orgSlug=…" query
      const r = await moneyFetch<{ id: string }>(`/api/admin/schedules?${q}`, jsonInit('POST', body));
      if (!r.ok) { setError(refusalText(r.data, R.notSaved)); setBusy(false); return; }
      onSaved?.(r.data.id);
    } catch {
      setError(R.notSaved);
      setBusy(false);
    }
  }

  /** Settings…: keep the draft — the regenerate, after the one question. A new name is a rename on the version it made. */
  async function keep() {
    if (!pick || !editing || !madeFrom || busy) return;
    setBusy(true); setError('');
    try {
      const url = `/api/admin/schedules/${encodeURIComponent(editing.schedule.id)}?${q}`;
      const r = await moneyFetch<{ version: number }>(url, jsonInit('PATCH', {
        action: 'regenerate', version: editing.schedule.version, ...madeFrom.time, settings: madeFrom.settings, assignments: assignmentsOf(pick),
      }));
      if (!r.ok) { if (isStale(r.data)) settingsOf?.onStale?.(); setAsking(false); setError(refusalText(r.data, R.notSaved)); setBusy(false); return; }
      let version = r.data.version;
      let renamed = true;
      if (draft.name.trim() !== editing.schedule.name) {
        // The regenerate has landed: a rename that fails now is said with it, never reported as "not saved".
        const n = await moneyFetch<{ version: number }>(url, jsonInit('PATCH', { action: 'rename', version, name: draft.name.trim() })).catch(() => null);
        if (n?.ok) version = n.data.version;
        else renamed = false;
      }
      settingsOf!.onKept(version, renamed);
    } catch {
      setAsking(false);
      setError(R.notSaved);
      setBusy(false);
    }
  }

  // ── Step 1's sections ──
  /** A row of one of the form's lists, changed or taken off — the lists' one update rule. */
  const patchIn = <K extends ListName>(list: K, key: string, patch: Partial<RowOf<K>>) =>
    set({ [list]: (draft[list] as { key: string }[]).map(x => (x.key === key ? { ...x, ...(patch as object) } : x)) } as Partial<Draft>);
  const dropFrom = (list: ListName, key: string) => set({ [list]: (draft[list] as { key: string }[]).filter(x => x.key !== key) } as Partial<Draft>);
  const setRow = (key: string, patch: Partial<HoursRow>) => patchIn('rows', key, patch);
  const mixedPlaces = draft.rows.some(r => r.place);
  const permit = draft.permitId ? inputs?.permits.find(p => p.id === draft.permitId) : null;
  const filledWords = permit && venue ? [
    venue.venueName,
    allNames.length ? facilityListWords(allNames) : '',
    `${formatStoredDate(draft.startsOn, { withYear: false })} – ${formatStoredDate(draft.endsOn, { withYear: false })}`,
    ...draft.rows.map(r => `${r.weekdays.length === 1 ? weekdayPlural(r.weekdays[0]) : weekdaysShort(r.weekdays)} ${formatTimeRange(r.start, r.end)}`),
    ...(draft.datesOff.length ? [`${draft.datesOff.map(o => formatStoredDate(o.day, { withYear: false })).join(', ')} off`] : []),
  ].filter(Boolean).join(', ') : null;

  // Above the cards, and only when there is one to copy: it fills more than the time.
  const copyField = !editing && !!inputs?.schedules.length && (
    <div className={sch.copy}>
      <label className={ck.field} htmlFor="ns-copy">
        <span className={ck.label}>{W.copySchedule}</span>
        <select id="ns-copy" className={ck.select} value={draft.copyFrom} onChange={e => void pickCopy(e.target.value)} aria-describedby="ns-copy-hint">
          <option value="">{W.dontCopy}</option>
          {inputs.schedules.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <span id="ns-copy-hint" className={ck.hint}>{draft.permitId ? W.copyHintPermit : W.copyHint}</span>
      </label>
    </div>
  );

  const timeSection = (
    <section className={sch.section} aria-labelledby="ns-time">
      <h3 id="ns-time" className={sch.sectionTitle}>{W.sectionTime}</h3>
      <div className={sch.pair}>
        <label className={ck.field} htmlFor="ns-name">
          <span className={ck.label}>{W.name}<span className={repKit.req} aria-hidden>*</span></span>
          <input id="ns-name" className={ck.input} value={draft.name} maxLength={120} placeholder={W.namePlaceholder} onChange={e => set({ name: e.target.value })} />
        </label>
        {!editing && (
          <label className={ck.field} htmlFor="ns-permit">
            <span className={ck.label}>{W.permit}</span>
            <select id="ns-permit" className={ck.select} value={draft.permitId} onChange={e => pickPermit(e.target.value)} aria-describedby="ns-permit-hint">
              <option value="">{W.noPermit}</option>
              {(inputs?.permits ?? []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <span id="ns-permit-hint" className={ck.hint}>{filledWords ? W.filledIn(filledWords) : W.permitHint}</span>
          </label>
        )}
      </div>
      {mixedPlaces ? (
        <p className={sch.read}>{draft.rows.map(r => {
          const v = places.find(p => p.venueId === (r.place?.venueId ?? draft.venueId));
          const names = (v?.facilities ?? []).filter(f => (r.place?.facilityIds ?? draft.facilityIds).includes(f.id)).map(f => f.name);
          return `${v?.venueName ?? ''}${names.length ? ` · ${facilityListWords(names)}` : ''}`;
        }).filter((x, i, a) => a.indexOf(x) === i).join('; ')}</p>
      ) : (
        <>
          <label className={ck.field} htmlFor="ns-venue">
            <span className={ck.label}>{W.venue}<span className={repKit.req} aria-hidden>*</span></span>
            <select id="ns-venue" className={ck.select} value={draft.venueId}
              onChange={e => { const venueId = e.target.value; setDraft(d => fieldsInTime({ ...d, venueId, facilityIds: places.find(p => p.venueId === venueId)?.facilities.map(f => f.id) ?? [] }, places)); }}>
              <option value="">{W.chooseVenue}</option>
              {places.map(p => <option key={p.venueId} value={p.venueId}>{p.venueName}</option>)}
            </select>
          </label>
          {venue && venue.facilities.length > 0 && (
            <div className={ck.field}>
              <span className={sch.labelLine}>
                <span className={ck.label}>{W.facilities}</span>
                <span className={sch.headDoors}>
                  <button type="button" className={sch.door} onClick={() => set({ facilityIds: venue.facilities.map(f => f.id) })}>{W.all}</button>
                  <span aria-hidden>·</span>
                  <button type="button" className={sch.door} onClick={() => set({ facilityIds: [] })}>{W.none}</button>
                </span>
              </span>
              <div className={sch.chips}>
                {venue.facilities.map(f => {
                  const on = draft.facilityIds.includes(f.id);
                  return (
                    <button key={f.id} type="button" className={sch.chip} aria-pressed={on}
                      onClick={() => set({ facilityIds: on ? draft.facilityIds.filter(x => x !== f.id) : [...draft.facilityIds, f.id] })}>
                      {on && <Check size={13} aria-hidden />}{f.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
      <div className={sch.pair}>
        <label className={ck.field} htmlFor="ns-start">
          <span className={ck.label}>{W.from}<span className={repKit.req} aria-hidden>*</span></span>
          <input id="ns-start" type="date" className={ck.input} value={draft.startsOn} onChange={e => set({ startsOn: e.target.value })} />
        </label>
        <label className={ck.field} htmlFor="ns-end">
          <span className={ck.label}>{W.to}<span className={repKit.req} aria-hidden>*</span></span>
          <input id="ns-end" type="date" className={ck.input} value={draft.endsOn} min={draft.startsOn || undefined} onChange={e => set({ endsOn: e.target.value })} />
        </label>
      </div>
      {draft.rows.map((r, i) => (
        <div key={r.key} className={sch.dayRow}>
          <PickField id={`ns-days-${i}`} label={W.days} required options={WEEKDAY_OPTIONS} selected={r.weekdays.map(String)}
            onChange={ids => setRow(r.key, { weekdays: ids.map(Number).sort((a, b) => a - b) })} placeholder={W.chooseDays} />
          <label className={ck.field} htmlFor={`ns-rs-${i}`}>
            <span className={ck.label}>{W.from}<span className={repKit.req} aria-hidden>*</span></span>
            <input id={`ns-rs-${i}`} type="time" step={300} className={ck.input} value={r.start} onChange={e => setRow(r.key, { start: e.target.value })} />
          </label>
          <label className={ck.field} htmlFor={`ns-re-${i}`}>
            <span className={ck.label}>{W.until}<span className={repKit.req} aria-hidden>*</span></span>
            <input id={`ns-re-${i}`} type="time" step={300} className={ck.input} value={r.end} onChange={e => setRow(r.key, { end: e.target.value })} />
          </label>
          <button type="button" className={sch.remove} aria-label={W.removeHours(i + 1)} disabled={draft.rows.length === 1}
            onClick={() => dropFrom('rows', r.key)}>
            <X size={15} aria-hidden />
          </button>
        </div>
      ))}
      <button type="button" className={sch.door} onClick={() => set({ rows: [...draft.rows, { key: newKey('row'), weekdays: [], start: draft.rows[draft.rows.length - 1]?.start ?? '', end: draft.rows[draft.rows.length - 1]?.end ?? '' }] })}>
        <Plus size={14} aria-hidden />{W.addHours}
      </button>
      <div className={sch.triple}>
        <label className={ck.field} htmlFor="ns-len">
          <span className={ck.label}>{W.slotLength}</span>
          <select id="ns-len" className={ck.select} value={draft.slotMinutes} onChange={e => set({ slotMinutes: Number(e.target.value) })} aria-describedby="ns-len-hint">
            {withCurrent(SLOT_LENGTHS, draft.slotMinutes).map(n => <option key={n} value={n}>{W.minutes(n)}</option>)}
          </select>
          <span id="ns-len-hint" className={ck.hint}>{W.slotLengthHint}</span>
        </label>
        <label className={ck.field} htmlFor="ns-chg">
          <span className={ck.label}>{W.changeover}</span>
          <select id="ns-chg" className={ck.select} value={draft.changeoverMinutes} onChange={e => set({ changeoverMinutes: Number(e.target.value) })} aria-describedby="ns-chg-hint">
            {withCurrent(CHANGEOVERS, draft.changeoverMinutes).map(n => <option key={n} value={n}>{n ? W.minutes(n) : W.changeoverNone}</option>)}
          </select>
          <span id="ns-chg-hint" className={ck.hint}>{W.changeoverHint}</span>
        </label>
        <label className={ck.field} htmlFor="ns-atonce">
          <span className={ck.label}>{W.teamsAtOnce}</span>
          <select id="ns-atonce" className={ck.select} value={draft.teamsAtOnce} onChange={e => set({ teamsAtOnce: Number(e.target.value) })} aria-describedby="ns-atonce-hint">
            {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <span id="ns-atonce-hint" className={ck.hint}>{W.teamsAtOnceHint}</span>
        </label>
      </div>
      <div className={ck.field}>
        <span className={ck.label}>{W.datesOff}</span>
        {draft.datesOff.map((o, i) => (
          <div key={o.key} className={own.offRow}>
            <label className={ck.field} htmlFor={`ns-off-${i}`}>
              <span className={repKit.srOnly}>{W.datesOff} {i + 1}</span>
              <input id={`ns-off-${i}`} type="date" className={ck.input} value={o.day} min={draft.startsOn || undefined} max={draft.endsOn || undefined}
                onChange={e => patchIn('datesOff', o.key, { day: e.target.value })} />
            </label>
            <label className={ck.field} htmlFor={`ns-offn-${i}`}>
              <span className={repKit.srOnly}>{W.dateOffWhy}</span>
              <input id={`ns-offn-${i}`} className={ck.input} value={o.note} maxLength={120} placeholder={W.dateOffWhy}
                onChange={e => patchIn('datesOff', o.key, { note: e.target.value })} />
            </label>
            <button type="button" className={sch.remove} aria-label={W.removeDateOff(o.day ? formatShortWeekdayDate(o.day) : String(i + 1))}
              onClick={() => dropFrom('datesOff', o.key)}>
              <X size={15} aria-hidden />
            </button>
          </div>
        ))}
        <button type="button" className={sch.door} onClick={() => set({ datesOff: [...draft.datesOff, { key: newKey('off'), day: '', note: '' }] })}>
          <Plus size={14} aria-hidden />{W.addDateOff}
        </button>
      </div>
      {shown && <p className={sch.sum}>{summaryLine(shown, oneWeekday, noun)}</p>}
      {previewError && timeReady && <p className={sch.sumBad}>{previewError}</p>}
    </section>
  );

  // ── Who, and how much: the form table, for time ──
  const unit = draft.method === 'percentage' ? '%' : null;
  const setTeamValue = (t: InputTeam, text: string) => {
    const key = groupKeyOf(t);
    setDraft(d => {
      const groupTyped = { ...d.groupTyped };
      delete groupTyped[key];
      return { ...d, values: { ...d.values, [t.id]: text }, groupTyped };
    });
  };
  const spread = (key: string, typed: string, tickedNow: ReadonlySet<string>, method: Draft['method'], values: Record<string, string>) => {
    const members = membersOf(key).filter(t => tickedNow.has(t.id));
    const parts = method === 'percentage' ? spreadGroupFigure(typed, members.length, 'percentage')
      : wholeWeekly(typed) != null ? members.map(() => String(wholeWeekly(typed))) : null;
    const next = { ...values };
    members.forEach((t, i) => { next[t.id] = parts ? parts[i] : ''; });
    return next;
  };
  const setGroupFigure = (key: string, text: string) => setDraft(d => ({
    ...d, groupTyped: { ...d.groupTyped, [key]: text }, values: spread(key, text, new Set(d.ticked), d.method, d.values),
  }));
  const tickTo = (next: string[]) => setDraft(d => {
    let values = d.values;
    for (const [key, typed] of Object.entries(d.groupTyped)) values = spread(key, typed, new Set(next), d.method, values);
    return { ...d, ticked: running.filter(t => next.includes(t.id)).map(t => t.id), values };
  });
  const figureInput = (value: string, label: string, onChange: (text: string) => void, unitWord: string | null) => (
    <span className={mk.shareCell}>
      <input className={`${ck.input} ${mk.shareInput} ${sch.figureInput}`} inputMode={draft.method === 'percentage' ? 'decimal' : 'numeric'}
        value={value} aria-label={label} placeholder="0" onChange={e => onChange(e.target.value)} />
      {unitWord && <span className={mk.shareUnit}>{unitWord}</span>}
    </span>
  );
  /** A group's percent: its ticked teams' shares, added to the hundredth. */
  const percentOf = (on: readonly InputTeam[]) => Math.round(on.reduce((n, t) => n + (figureOf(t.id) ?? 0) * 100, 0)) / 100;
  const figureCell = (t: InputTeam) => (draft.method === 'even' ? '' : figureInput(draft.values[t.id] ?? '',
    `${t.name}’s ${draft.method === 'percentage' ? 'share' : 'slots a week'}`, text => setTeamValue(t, text), unit));
  const groupFigureCell = (key: string) => {
    const on = membersOf(key).filter(t => tickedSet.has(t.id));
    if (!on.length || draft.method === 'even') return '';
    const typed = draft.groupTyped[key];
    const sum = draft.method === 'percentage' && on.every(t => figureOf(t.id) != null) ? percentOf(on) : null;
    // A weekly group shows its figure "each" while every team has the same one; a percentage its sum once retyped.
    const same = draft.method === 'weekly' && on.every(t => draft.values[t.id] === draft.values[on[0].id]) ? draft.values[on[0].id] ?? '' : '';
    const shown2 = typed ?? (draft.method === 'percentage' ? (sum == null ? '' : String(sum)) : same);
    return figureInput(shown2, W.groupFigure(groupLabel(key), draft.method === 'percentage' ? 'share' : 'slots a week, each'),
      text => setGroupFigure(key, text), unit ?? W.each);
  };
  const slotsWords = (n: number | null) => (n == null ? '—' : String(n));
  const rows: FormTableRow[] = running.map(t => {
    const isIn = tickedSet.has(t.id);
    const slots = isIn ? targetOf(t.id) : null;
    return {
      key: t.id, name: t.name, group: groupKeys.length ? groupKeyOf(t) : undefined, nameNote: t.season!.name,
      ticked: isIn, tickLabel: W.tick(t.name), onTick: next => tickTo(next ? [...draft.ticked, t.id] : draft.ticked.filter(x => x !== t.id)),
      cells: { figure: isIn ? figureCell(t) : '', slots: isIn ? slotsWords(slots) : '' },
      phoneLine: t.season!.name,
      phoneFigure: isIn ? (draft.method === 'even' ? slotsWords(slots) : figureCell(t)) : undefined,
    };
  });
  const groups: FormTableGroup[] = groupKeys.map(key => {
    const members = membersOf(key);
    const on = members.filter(t => tickedSet.has(t.id));
    const slots = on.length && shown ? on.reduce((s, t) => s + (targetOf(t.id) ?? 0), 0) : null;
    return {
      key, label: groupLabel(key), count: W.teamsCount(members.length),
      state: on.length === 0 ? 'none' : on.length === members.length ? 'all' : 'some',
      onTick: next => tickTo(next ? [...new Set([...draft.ticked, ...members.map(m => m.id)])] : draft.ticked.filter(x => !members.some(m => m.id === x))),
      tickLabel: W.tickGroup(groupLabel(key)),
      cells: { figure: groupFigureCell(key), slots: on.length ? slotsWords(slots) : '' },
      phoneFigure: groupFigureCell(key) || undefined,
    };
  });
  const weeklySum = draft.method === 'weekly' ? inOrder.reduce((s, t) => s + (wholeWeekly(draft.values[t.id]) ?? 0), 0) : 0;
  const note = shown ? closingNote({ summary: shown, method: draft.method, percentHundredths }) : percentHundredths > 10000
    ? { words: `${(percentHundredths - 10000) / 100}% over`, over: true } : null;
  const groupPercent = (() => {
    // "Senior gets 60% of the prime-time slots too" — the first group's own share, when the split is by group.
    if (draft.method !== 'percentage' || !groupKeys.length) return null;
    const key = groupKeys.find(k => membersOf(k).some(t => tickedSet.has(t.id)));
    if (!key) return null;
    const sum = percentOf(membersOf(key).filter(t => tickedSet.has(t.id)));
    return sum ? { group: groupLabel(key), percent: String(sum) } : null;
  })();
  const allNone = (
    <span className={mk.allNone}>
      <button type="button" className={ck.link} onClick={() => tickTo(running.map(t => t.id))}>{W.all}</button>
      <span aria-hidden>·</span>
      <button type="button" className={ck.link} onClick={() => tickTo([])}>{W.none}</button>
    </span>
  );
  const whoSection = (
    <section className={sch.section} aria-labelledby="ns-who">
      <div className={sch.sectionHead}>
        <h3 id="ns-who" className={sch.sectionTitle}>{W.sectionWho}</h3>
      </div>
      <div className={sch.pair}>
        <label className={ck.field} htmlFor="ns-split">
          <span className={ck.label}>{W.split}</span>
          <select id="ns-split" className={ck.select} value={draft.method}
            onChange={e => set({ method: e.target.value as Draft['method'], groupTyped: {}, values: {} })}>
            <option value="even">{W.splitEven}</option>
            <option value="percentage">{W.splitPercent}</option>
            <option value="weekly">{W.splitWeekly}</option>
          </select>
        </label>
        {draft.method === 'percentage' && draft.primeDays !== 'none' && (
          <label className={ck.field} htmlFor="ns-pshare">
            <span className={ck.label}>{W.primeShare}</span>
            <select id="ns-pshare" className={ck.select} value={draft.primeShare} onChange={e => set({ primeShare: e.target.value as 'same' | 'even' })}>
              <option value="same">{W.primeSame}</option>
              <option value="even">{W.primeEven}</option>
            </select>
            <span className={ck.hint}>
              {draft.primeShare === 'even' ? W.primeEvenHint : groupPercent ? W.primeSameHint(groupPercent.group, groupPercent.percent) : W.primeSameHintPlain}
            </span>
          </label>
        )}
      </div>
      {!inputs ? <LoadingState inline label={W.loadingInputs} /> : running.length === 0 ? <p className={ck.hint}>{R.nothingToSchedule}</p> : (
        <FormTable
          ariaLabel={W.sectionWho}
          leadLabel={<>{W.colTeam}{allNone}</>}
          columns={[
            ...(draft.method === 'even' ? [] : [{ key: 'figure', label: draft.method === 'percentage' ? W.colShare : W.colWeek, numeric: true, width: '30%' }]),
            { key: 'slots', label: W.colSlots, numeric: true, width: '16%' },
          ]}
          rows={rows}
          groups={groups}
          closing={{
            label: W.teamsCount(inOrder.length),
            cells: {
              figure: draft.method === 'percentage' ? `${percentHundredths / 100}%` : draft.method === 'weekly' ? W.aWeek(weeklySum) : '',
              slots: shown ? String(shown.handedOut) : '—',
            },
            phone: `${W.teamsCount(inOrder.length)}${shown ? ` · ${pluralize(shown.handedOut, 'slot')}` : ''}`,
            note: note?.words, noteBad: note?.over, noteRow: true,
          }}
        />
      )}
      {draft.method === 'percentage' && <p className={sch.quiet}>{W.everyWeek}</p>}
      {noSeason.length > 0 && (
        <div className={mk.noSeason}>
          <button type="button" className={mk.noSeasonToggle} aria-expanded={noSeasonOpen} onClick={() => setNoSeasonOpen(o => !o)}>
            <ChevronDown size={15} aria-hidden className={noSeasonOpen ? mk.noSeasonOpen : undefined} />{W.noSeason(noSeason.length)}
          </button>
          {noSeasonOpen && <ul className={mk.noSeasonList}>{noSeason.map(t => <li key={t.id}><b>{t.name}</b></li>)}</ul>}
        </div>
      )}
    </section>
  );

  // ── Rules, folded ──
  const teamName = (id: string) => (inputs?.teams ?? []).find(t => t.id === id)?.name ?? '';
  const settingsNow = settingsBody(false);
  const onCount = rulesOn(settingsNow.rules);
  const ruleWords = [
    ...settingsNow.rules.windows.map(w => (w.finishBy ? W.finishBy(w.teamIds.map(teamName).join(', '), formatTimeRange(w.finishBy, null))
      : W.startAfterWords(w.teamIds.map(teamName).join(', '), formatTimeRange(w.startAfter ?? '', null)))),
    ...settingsNow.rules.fieldsBy.map(f => W.fieldsOnly(
      facilityListWords(places.flatMap(p => p.facilities).filter(x => f.facilityIds.includes(x.id)).map(x => x.name)),
      [...f.groupIds.map(g => (inputs?.groups ?? []).find(x => x.id === g)?.name ?? ''), ...f.teamIds.map(teamName)].filter(Boolean).join(', '))),
    ...(settingsNow.rules.daysOff.length ? [W.daysOffCount(new Set(settingsNow.rules.daysOff.map(d => d.teamId)).size)] : []),
    ...(settingsNow.rules.maxPerDay ? [W.capDay(settingsNow.rules.maxPerDay)] : []),
    ...(settingsNow.rules.maxPerWeek ? [W.capWeek(settingsNow.rules.maxPerWeek)] : []),
    ...(settingsNow.rules.avoidGameDays ? [W.avoidGameDays] : []),
    ...(settingsNow.rules.avoidBookings ? [W.avoidBookings] : []),
    ...(settingsNow.rules.noBackToBack ? [W.noBackToBack] : []),
  ];
  const teamOptions = running.map(t => ({ id: t.id, label: t.name }));
  const allFacilities = places.filter(p => p.venueId === draft.venueId || draft.rows.some(r => r.place?.venueId === p.venueId))
    .flatMap(p => p.facilities.map(f => ({ id: f.id, label: f.name })));
  const whoOptions = [
    ...(inputs?.groups ?? []).filter(g => running.some(t => t.groupId === g.id)).map(g => ({ id: `g:${g.id}`, label: g.name })),
    ...running.map(t => ({ id: `t:${t.id}`, label: t.name })),
  ];
  const clockSelect = (id: string, label: string, value: string, onChange: (v: string) => void) => (
    <label className={ck.field} htmlFor={id}>
      <span className={ck.label}>{label}</span>
      <input id={id} type="time" step={300} className={ck.input} value={value} onChange={e => onChange(e.target.value)} />
    </label>
  );
  const rulesSection = (
    <section className={sch.section} aria-labelledby="ns-rules">
      <button type="button" className={sch.fold} aria-expanded={rulesOpen} onClick={() => setRulesOpen(o => !o)}>
        <span id="ns-rules" className={sch.sectionTitle}>{W.sectionRules}</span>
        <span className={sch.foldCount}>{W.rulesOn(onCount)}</span>
        <ChevronDown size={16} aria-hidden className={rulesOpen ? sch.foldOpen : undefined} />
      </button>
      {!rulesOpen ? (
        ruleWords.length > 0 && <p className={sch.quiet}>{ruleWords.join(' · ')}</p>
      ) : (
        <div className={sch.rules}>
          <h4 className={sch.ruleHead}>{W.ruleWindows}</h4>
          {draft.windows.map((w, i) => (
            <div key={w.key} className={sch.ruleRow}>
              <div className={sch.ruleFields}>
                <PickField id={`ns-w-${i}`} label={W.ruleTeams} options={teamOptions} selected={w.teamIds} placeholder={W.chooseTeams}
                  onChange={ids => patchIn('windows', w.key, { teamIds: ids })} />
                {clockSelect(`ns-wa-${i}`, W.ruleStartAfter, w.startAfter, v => patchIn('windows', w.key, { startAfter: v }))}
                {clockSelect(`ns-wf-${i}`, W.ruleFinishBy, w.finishBy, v => patchIn('windows', w.key, { finishBy: v }))}
              </div>
              <button type="button" className={sch.remove} aria-label={W.removeRule} onClick={() => dropFrom('windows', w.key)}><X size={15} aria-hidden /></button>
            </div>
          ))}
          <button type="button" className={sch.door} onClick={() => set({ windows: [...draft.windows, { key: newKey('win'), teamIds: [], startAfter: '', finishBy: '' }] })}>
            <Plus size={14} aria-hidden />{W.addWindow}
          </button>

          <h4 className={sch.ruleHead}>{W.ruleDaysOff}</h4>
          {draft.daysOff.map((d, i) => (
            <div key={d.key} className={sch.ruleRow}>
              <div className={sch.ruleFields}>
                <label className={ck.field} htmlFor={`ns-dt-${i}`}>
                  <span className={ck.label}>{W.ruleTeam}</span>
                  <select id={`ns-dt-${i}`} className={ck.select} value={d.teamId} onChange={e => patchIn('daysOff', d.key, { teamId: e.target.value })}>
                    <option value="">{W.chooseTeam}</option>
                    {running.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </label>
                <label className={ck.field} htmlFor={`ns-dw-${i}`}>
                  <span className={ck.label}>{W.ruleOff}</span>
                  <select id={`ns-dw-${i}`} className={ck.select} value={d.when} onChange={e => patchIn('daysOff', d.key, { when: e.target.value })}>
                    <option value="date">{W.aDate}</option>
                    {[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n} value={String(n)}>{W.every(DAY_NAMES[n])}</option>)}
                  </select>
                </label>
                {d.when === 'date' ? (
                  <label className={ck.field} htmlFor={`ns-dd-${i}`}>
                    <span className={ck.label}>{W.aDate}</span>
                    <input id={`ns-dd-${i}`} type="date" className={ck.input} value={d.date} min={draft.startsOn || undefined} max={draft.endsOn || undefined}
                      onChange={e => patchIn('daysOff', d.key, { date: e.target.value })} />
                  </label>
                ) : <span />}
                <label className={ck.field} htmlFor={`ns-dn-${i}`}>
                  <span className={ck.label}>{W.ruleNote}</span>
                  <input id={`ns-dn-${i}`} className={ck.input} value={d.note} maxLength={120} onChange={e => patchIn('daysOff', d.key, { note: e.target.value })} />
                </label>
              </div>
              <button type="button" className={sch.remove} aria-label={W.removeRule} onClick={() => dropFrom('daysOff', d.key)}><X size={15} aria-hidden /></button>
            </div>
          ))}
          <button type="button" className={sch.door} onClick={() => set({ daysOff: [...draft.daysOff, { key: newKey('off'), teamId: '', when: 'date', date: '', note: '' }] })}>
            <Plus size={14} aria-hidden />{W.addDayOff}
          </button>

          <div className={sch.pair}>
            <label className={ck.field} htmlFor="ns-maxday">
              <span className={ck.label}>{W.maxDay}</span>
              <select id="ns-maxday" className={ck.select} value={draft.maxPerDay} onChange={e => set({ maxPerDay: e.target.value })}>
                <option value="">{W.noCap}</option>
                {[1, 2, 3, 4].map(n => <option key={n} value={String(n)}>{W.capWords(n)}</option>)}
              </select>
            </label>
            <label className={ck.field} htmlFor="ns-maxweek">
              <span className={ck.label}>{W.maxWeek}</span>
              <select id="ns-maxweek" className={ck.select} value={draft.maxPerWeek} onChange={e => set({ maxPerWeek: e.target.value })}>
                <option value="">{W.noCap}</option>
                {Array.from({ length: 7 }, (_, i) => i + 1).map(n => <option key={n} value={String(n)}>{W.capWords(n)}</option>)}
              </select>
            </label>
          </div>
          <div className={sch.pair}>
            <label className={ck.field} htmlFor="ns-prime">
              <span className={ck.label}>{W.prime}</span>
              <select id="ns-prime" className={ck.select} value={draft.primeDays} onChange={e => set({ primeDays: e.target.value })} aria-describedby="ns-prime-hint">
                <option value="none">{W.primeNone}</option>
                {PRIME_DAYS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
              <span id="ns-prime-hint" className={ck.hint}>{W.primeHint}</span>
            </label>
            {draft.primeDays !== 'none' ? (
              <label className={ck.field} htmlFor="ns-pmode">
                <span className={ck.label}>{W.primeMode}</span>
                <select id="ns-pmode" className={ck.select} value={draft.primeMode} onChange={e => set({ primeMode: e.target.value as 'keep' | 'rotate' })}>
                  <option value="keep">{W.primeKeep}</option>
                  <option value="rotate">{W.primeRotate}</option>
                </select>
              </label>
            ) : <span />}
          </div>
          {draft.primeDays !== 'none' && (
            <div className={sch.pair}>
              {clockSelect('ns-ps', W.from, draft.primeStart, v => set({ primeStart: v }))}
              {clockSelect('ns-pe', W.until, draft.primeEnd, v => set({ primeEnd: v }))}
            </div>
          )}

          <h4 className={sch.ruleHead}>{W.fieldsBy}</h4>
          {draft.fieldsBy.map((f, i) => (
            <div key={f.key} className={sch.ruleRow}>
              <div className={sch.ruleFields}>
                <PickField id={`ns-ff-${i}`} label={W.fieldsFacilities} options={allFacilities} selected={f.facilityIds} placeholder={W.chooseVenue}
                  onChange={ids => patchIn('fieldsBy', f.key, { facilityIds: ids })} />
                <PickField id={`ns-fw-${i}`} label={W.fieldsOnlyFor} options={whoOptions} selected={f.who} placeholder={W.chooseWho}
                  onChange={ids => patchIn('fieldsBy', f.key, { who: ids })} />
              </div>
              <button type="button" className={sch.remove} aria-label={W.removeRule} onClick={() => dropFrom('fieldsBy', f.key)}><X size={15} aria-hidden /></button>
            </div>
          ))}
          <button type="button" className={sch.door} onClick={() => set({ fieldsBy: [...draft.fieldsBy, { key: newKey('fld'), facilityIds: [], who: [] }] })}>
            <Plus size={14} aria-hidden />{W.addFieldsBy}
          </button>

          <div className={sch.checks}>
            <CheckChoice checked={draft.avoidGameDays} onChange={v => set({ avoidGameDays: v })} title={W.avoidGameDays} caption={W.avoidGameDaysSub} />
            <CheckChoice checked={draft.avoidBookings} onChange={v => set({ avoidBookings: v })} title={W.avoidBookings} caption={W.avoidBookingsSub} />
            <CheckChoice checked={draft.noBackToBack} onChange={v => set({ noBackToBack: v })} title={W.noBackToBack} />
          </div>
        </div>
      )}
    </section>
  );

  // ── Step 2: the drafts ──
  const teamsInOrder = inputs?.teams ?? [];
  const colourOf = (id: string) => teamColour(teamsInOrder, id);
  const placeOf = useMemo(() => {
    const out = new Map<string, string>();
    for (const p of places) {
      out.set(placeKey(p.venueId, null), p.venueName);
      for (const fac of p.facilities) out.set(placeKey(p.venueId, fac.id), fac.name);
    }
    return (x: Pick<DraftSlot, 'venueId' | 'facilityId'>) => out.get(placeKey(x.venueId, x.facilityId)) ?? '';
  }, [places]);
  const measureClass = (m: DraftMeasure | undefined): 'good' | 'amber' | 'plain' => {
    if (!m) return 'plain';
    if (m.kind === 'shares') return m.short.length ? 'amber' : 'plain';
    if (m.kind === 'prime') return m.lowTeamId && m.max - m.min > 1 ? 'amber' : 'good';
    if (m.kind === 'nights' || m.kind === 'youngest') return 'good';
    return 'plain';
  };
  const dayGroups = useMemo(() => {
    if (!gen) return [];
    const byDay = new Map<string, DraftSlot[]>();
    for (const s of gen.slots) (byDay.get(s.day) ?? byDay.set(s.day, []).get(s.day)!).push(s);
    return [...byDay].sort(([a], [b]) => a.localeCompare(b)).map(([day, list]) => ({
      day, list: list.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || placeOf(a).localeCompare(placeOf(b), 'en-CA', { numeric: true })),
    }));
  }, [gen, placeOf]);
  const exportDraft = async (kind: 'xlsx' | 'pdf') => {
    if (!gen || !pick) return;
    try {
      await exportScheduleFile(kind, {
        q, orgSlug, orgName, name: draft.name.trim() || W.newTitle, draftLabel: pick.label, startsOn: draft.startsOn, endsOn: draft.endsOn,
        places, teams: (inputs?.teams ?? []).map(t => ({ id: t.id, name: t.name, groupName: t.groupName })),
        slots: gen.slots.map(s => ({ ...s, teamIds: pick.assignments[s.key] ?? [], handedBackTeamId: null })),
        datesOff: timeBody.datesOff, pricing: null, bill: null,
      });
    } catch {
      setError('The file couldn’t be made. Please try again.');
    }
  };
  const [exportOpen, setExportOpen] = useState(false);
  const exportMenu = (
    <div className={sch.menuWrap}>
      <button type="button" className="btn btn-outline" aria-haspopup="menu" aria-expanded={exportOpen} onClick={() => setExportOpen(o => !o)}>
        <Download size={15} aria-hidden />Export
      </button>
      {exportOpen && pick && gen && (
        <div className={sch.menu} role="menu">
          <div className={sch.menuHead}>{W.draftExportHolds(pick.label, gen.summary.slots)}</div>
          <button type="button" role="menuitem" className={sch.menuItem} onClick={() => { setExportOpen(false); void exportDraft('xlsx'); }}>Excel (.xlsx)</button>
          <button type="button" role="menuitem" className={sch.menuItem} onClick={() => { setExportOpen(false); void exportDraft('pdf'); }}>
            PDF<small>{W.pdfHint}</small>
          </button>
        </div>
      )}
    </div>
  );
  const teamRows = pick ? running.filter(t => pick.teams.some(r => r.teamId === t.id)).map(t => ({ t, r: pick.teams.find(x => x.teamId === t.id)! })) : [];
  const draftsBody = gen && pick && (
    <div className={sch.drafts}>
      <div className={sch.cards} role="group" aria-label="Drafts">
        {gen.drafts.map((d, i) => (
          <button key={`${d.strategy}-${d.round}`} type="button" className={sch.card} aria-pressed={chosen === i} onClick={() => setChosen(i)}>
            <span className={sch.cardHead}><b>{d.label}</b><span className={sch.score}>{d.score}<small>/100</small></span></span>
            <ul className={sch.measures}>
              {d.lines.map((line, li) => {
                const c = measureClass(d.measures[li]);
                return (
                  <li key={li} className={c === 'amber' ? sch.amber : undefined}>
                    {c === 'good' && <Check size={13} aria-hidden className={sch.good} />}
                    {c === 'amber' && <AlertTriangle size={13} aria-hidden />}
                    {line}
                  </li>
                );
              })}
              {d.warnings.map(w => <li key={w.line} className={sch.amber}><AlertTriangle size={13} aria-hidden />{w.line}</li>)}
            </ul>
          </button>
        ))}
        <button type="button" className={sch.door} onClick={() => void generate(round + 1)} disabled={busy}>{W.threeMore}</button>
      </div>
      <div className={sch.chosen}>
        <div className={sch.lensLine}>
          <ViewSwitch views={[{ id: 'team', label: W.byTeam }, { id: 'day', label: W.byDay }]} value={lens} onChange={setLens} label="Read the draft" />
          <span className={sch.spacer} />
          {exportMenu}
        </div>
        {lens === 'team' ? (
          <div className={sch.lines} role="list" aria-label={W.byTeam}>
            {teamRows.map(({ t, r }) => (
              <div key={t.id} className={sch.teamLine} role="listitem">
                <span className={sch.teamLineName}><Swatch colour={colourOf(t.id)} /><b>{t.name}</b></span>
                <span>{W.rowSlots(r.got)}</span>
                <span>{W.rowPrime(r.prime)}</span>
                <span>{nightsWords(r.nights)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className={sch.dayList} aria-label={W.byDay}>
            {dayGroups.map(g => (
              <div key={g.day} role="list" aria-label={formatShortWeekdayDate(g.day)}>
                <div className={sch.dayBand}>{formatShortWeekdayDate(g.day)}</div>
                {g.list.map(s => {
                  const teams = pick.assignments[s.key] ?? [];
                  return (
                    <div key={s.key} className={sch.dline} role="listitem">
                      {teams[0] ? <Swatch colour={colourOf(teams[0])} /> : <span className={sch.swatchEmpty} aria-hidden />}
                      <span className={sch.dTime}>{formatTimeRange(s.startClock, s.endClock)}</span>
                      {teams.length ? <b>{teams.map(teamName).join(' · ')}</b>
                        : s.heldBy && settingsNow.rules.avoidBookings ? <span className={sch.dHeld}>{`${s.heldBy.kind === 'tryout' ? 'Tryout day' : 'Booked'} · ${s.heldBy.ownerName}`}</span>
                          : <span className={sch.dOpen}>{W.openSlot}</span>}
                      <span className={sch.dPlace}>{placeOf(s)}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
        <Statement
          lead={editing ? W.keepLead : W.saveLead(draft.name.trim())}
          rest={editing ? (editing.schedule.state === 'final' ? W.regenSent : W.regenNotSent) : W.saveRest}
          bullets={W.statementBullets(pick.totals.handedOut, pick.totals.slots, pick.teams.filter(t => t.got > 0).length, pick.totals.open, pick.totals.held)}
        />
      </div>
    </div>
  );

  // ── The window ──
  const lockedOnly = editing ? editing.slots.filter(s => s.locked && !s.movedByHand).length : 0;
  const movedByHand = editing ? editing.slots.filter(s => s.movedByHand).length : 0;
  // The count sits at the foot's left, never among the buttons (owner, 2026-10-12 — KitDialog's `footerStart`).
  const footSettingsNote = shown ? <span className={sch.footNote}>{footCount(shown.handedOut, inOrder.length)}</span> : undefined;
  const footSettings = (
    <>
      <button type="button" className="btn btn-outline" onClick={onCancel} disabled={busy}>{W.cancel}</button>
      <button type="button" className="btn btn-lime" onClick={() => void generate(0)} disabled={busy || !inputs}>{busy ? W.generating : W.generate}</button>
    </>
  );
  const footDrafts = (
    <>
      <button type="button" className="btn btn-outline" onClick={() => { setStep('settings'); setError(''); }} disabled={busy}>{W.backToSettings}</button>
      <button type="button" className="btn btn-lime" disabled={busy || !pick}
        onClick={() => (editing ? setAsking(true) : void save())}>
        {busy && !editing ? W.saving : editing ? W.keepDraft : W.saveDraft}
      </button>
    </>
  );
  let body: ReactNode;
  if (inputsFailed) body = <p className={repKit.formError}>{W.inputsFailed}</p>;
  else if (!inputs) body = <LoadingState inline label={W.loadingInputs} />;
  else if (step === 'drafts' && gen) body = draftsBody;
  else body = <div className={sch.settings}>{copyField}{timeSection}{whoSection}{rulesSection}</div>;

  return (
    <>
      <KitDialog
        kind="form"
        wide
        eyebrow={editing ? editing.schedule.name : undefined}
        title={editing ? W.settingsBack : W.newTitle}
        identity={step === 'drafts' ? W.step2(draft.name.trim() || W.newTitle) : W.step1}
        progress={{ at: step === 'drafts' ? 2 : 1, of: 2 }}
        back={step === 'drafts' ? { label: W.settingsBack, onBack: () => setStep('settings') } : undefined}
        levelKey={step}
        onClose={onCancel}
        busy={busy}
        footerStart={step === 'drafts' ? undefined : footSettingsNote}
        footer={step === 'drafts' ? footDrafts : footSettings}
      >
        <FormError>{error}</FormError>
        {body}
      </KitDialog>
      {asking && editing && pick && (
        <KitDialog
          kind="question"
          title={W.regenTitle(editing.schedule.name)}
          onClose={() => setAsking(false)}
          busy={busy}
          footer={(
            <>
              <button type="button" className="btn btn-outline" onClick={() => setAsking(false)} disabled={busy}>{W.regenKeep}</button>
              <button type="button" className="btn btn-lime" onClick={() => void keep()} disabled={busy}>{W.regenGo}</button>
            </>
          )}
        >
          <p>{W.regenLead} <b>{W.regenKept(lockedOnly, movedByHand)}</b></p>
          {gen && gen.summary.notKept > 0 && <p>{W.notKept(gen.summary.notKept)}</p>}
          <p>{editing.schedule.state === 'final' ? W.regenSent : W.regenNotSent}</p>
        </KitDialog>
      )}
    </>
  );
}
