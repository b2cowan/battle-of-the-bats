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
 *   0 · THE OPENING SCREEN, only when the club has a schedule and never in Settings… (owner, 2026-10-13 — decision sheet
 *       https://claude.ai/artifact/1eReDtSsJLkLNAunzRredf, Asks 1–2 + /design D1–D5): Copy a schedule, or start blank. The
 *       club's schedules newest first (dates · venues), an "or", Cancel and the lime Start blank — New tournament's
 *       opening screen, plus the Cancel every create window keeps (2026-10-09). A copy is chosen BEFORE the form because it
 *       rewrites most of it: its teams, shares and rules a year on, and its time unless a permit gives the time. Opened
 *       from a permit's page the permit is already picked: "or start from the permit", and the copy keeps its time. The
 *       permit stays a FIELD (owner, 2026-10-12: the permit is a LINK the schedule keeps, the copy is a copy, and a club's
 *       second year wants both). Changing your mind is Cancel (Ask 2) — nothing is saved before Generate drafts, and the
 *       window's back is step 2's.
 *   ⚖ STAGE 11c (ratified 2026-10-12 — hub → Stage 11c, specimen 1; Asks 1, 4, 5, 6): THREE QUESTIONS, in order.
 *   1 · The time — only time: Name · Permit (No permit, or one — its venue, facilities, dates, hours and dates off in one
 *       pick) · Venue · Facilities · From · To · rows of Days · From · Until · Slot length · Changeover · Dates off; the
 *       summary the server counts ("25 Sundays · 6 fields · 12 slots a Sunday · 300 slots"). Teams at once LEFT it: who
 *       shares a facility is a rule about teams (Sharing a facility, below).
 *   2 · Who, and how much — Split the time BESIDE EACH TEAM'S TIME (The same each week · Moved around, a dropdown with its
 *       sentence under it, Ask 4); New allocation's FORM TABLE for time (Ask 18; `FormTable`, the shared part) — the
 *       teams under their club groups, a group's figure spreading over its ticked teams, the Slots column the SERVER's
 *       count of each team's practices (`previewOnly` — never re-decided here), the closing row and its note (why slots
 *       are left open when sharing frees them); "The shares hold every week" said once; the teams with no season running
 *       in one line (Ask 15); then PRIME TIME WHOLE (Ask 5) — its hours, and How it's shared beside them where it applies.
 *   3 · Rules, folded ("Rules · 5 on") — ONLY THE RULES THE CLUB ADDED, each AS ITS SENTENCE with a pencil (Ask 6): the
 *       pencil opens that one rule IN PLACE (its fields, ✓ in the pencil's spot, Remove this rule in ink at its end —
 *       nothing is saved until Generate drafts, the record standard at the size of one rule); one ADD A RULE menu,
 *       hanging over the window, for every kind (Start and finish times · A team's day off · Facilities for a group ·
 *       Sharing a facility · At most, a day or a week); the three safeguards stay ticks under ALWAYS.
 *   Step 2 — three ranked drafts; the chosen one read By team (is it fair?) or By day (every slot of every day, the
 *       review before keeping — Ask 19); Export (Excel, PDF) above it, the draft's name and "a draft" on the file; the
 *       statement; Save as a draft → the schedule's page. In Settings… the lime keeps the draft, and asks once.
 *
 * ⚠ A SHARE IS THE SERVER'S: the Slots column, the closing row and the foot's count come from the generate route's
 * `previewOnly` answer, debounced as the form changes. The client never re-decides a largest-remainder share.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Check, ChevronDown, ChevronRight, Download, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import KitDialog from '../KitDialog';
import ck from '../ClubKit.module.css';
import { ClubRow, ClubRowList, RecordAction, repKit } from '../RepKit';
import { PickField } from '../PermitWindows';
import { FormError, jsonInit, moneyFetch, refusalText } from '../money/MoneyKit';
import mk from '../money/Money.module.css';
import own from '../Permits.module.css';
import FormTable, { type FormTableGroup, type FormTableRow } from '@/components/shared/FormTable';
import { CheckChoice } from '@/components/admin/tournament/ScreenParts';
import { ViewSwitch } from '@/components/coaches/kit';
import { spreadGroupFigure } from '@/lib/club-bill-split';
import { formatTimeRange, joinWithAnd, pluralize, possessive } from '@/lib/utils';
import { useAnchoredMenu, useDismissable } from '@/lib/overlay-hooks';
import { addCalendarDays, formatShortWeekdayDate, formatStoredDate, isCalendarDate, tournamentToday } from '@/lib/timezone';
import { WEEKDAY_OPTIONS, facilityListWords, renewedName } from '@/lib/permit-words';
import { rulesOn, type ScheduleSettings } from '@/lib/club-schedule-settings';
import {
  EMPTY_SETTINGS, figureOf as figureIn, groupsIn, newKey, positive, ruleApplies, ruleIsWhole, settingsDraftOf, settingsOf as settingsFromDraft, teamsIn, wholeWeekly,
  type DayOffRule, type FieldsRule, type SettingsDraft, type ShareRule, type WindowRule,
} from '@/lib/club-schedule-form';
import { PART_WORDS, SCHEDULE_REFUSALS as R, SCHEDULE_SCREEN_WORDS as W, sharingSentence, sharingWho } from '@/lib/club-schedule-words';
import { GAP_WORDS as GAPS, scheduleGaps, teamSubject, teamsWords } from '@/lib/club-schedule-gaps';
import { bookedWords } from '@/lib/club-schedule-document';
import { familyUseOf, partFromFor, partLabelFor, type PartRead } from '@/lib/club-schedule-family';
import {
  NO_GROUP, PRIME_DAYS, closingNote, isStale, facilityNoun, footCount, nightsWords, placeKey, placeName, scheduleDates, summaryLine, teamColour, yearOn,
  type GenerateSummary, type ScheduleView,
} from '@/lib/club-schedule-view';
import { exportScheduleFile } from '@/lib/export/club-schedule-export';
import type { DraftMeasure, TeamResult } from '@/lib/club-schedule-engine';
import { HOUSE_LEAGUE, isProgramHolder } from '@/lib/club-schedule-holders';
import {
  datesOffChanged, dateOffVenues, fieldsLeftOff, mergeDatesOff, permitPlaces, permitRowDates, permitsSpan, rowsFromFound, settleOverlaps, type DateOffParks,
} from '@/lib/club-schedule-permit-rows';
import { hoursNumber } from '@/lib/club-draft-bill';
import type { DateOff, TimeBlock } from '@/lib/permit-time';
import { Statement, Swatch } from './ScheduleParts';
import sch from './Schedules.module.css';
import FindTheTime, { draftDaysSaid, findFiltersFrom, findRowKey, useFreeTime, type FindFilters } from './FindTheTime';
import LoadingState from '@/components/shared/LoadingState';
import DateInput from '@/components/shared/DateInput';
import TimeInput from '@/components/shared/TimeInput';

// ── The inputs New schedule reads (`GET /api/admin/schedules?new=1`) ─────────────────────────────

interface InputTeam { id: string; name: string; groupId: string | null; groupName: string | null; color: string | null; season: { id: string; name: string } | null; program?: string }
/** House league's group in the table (Stage 11b): its own heading, after the rep teams' groups. */
const PROGRAMS = '__programs__';
interface InputPlace { venueId: string; venueName: string; facilities: { id: string; name: string }[] }
/** A permit as the Permits tick list reads it: its time, and its issuer for the option's second line (never its money). */
interface InputPermit { id: string; name: string; issuer: string | null; startsOn: string; endsOn: string; blocks: TimeBlock[]; datesOff: DateOff[] }
export interface NewInputs {
  nothingToSchedule: boolean;
  canMoney: boolean;
  groups: { id: string; name: string }[];
  teams: InputTeam[];
  places: InputPlace[];
  permits: InputPermit[];
  /** Newest first; `venues` is said as the row says it ("Lions Park and Kinsmen Park"). */
  schedules: { id: string; name: string; startsOn: string; endsOn: string; venues: string }[];
}

// ── The draft the form holds ──────────────────────────────────────────────────────────────────────

/** A source's dates off as the form's rows — moved a year on when the source is last year's schedule. A saved date off's
 *  parks come with it, said (mig 488: none named = All venues). */
const offRows = (list: readonly { day: string; note: string | null; venueIds?: readonly string[] }[], shift: (day: string) => string = d => d): OffRow[] =>
  list.map(o => ({ key: newKey('off'), day: shift(o.day), note: o.note ?? '', ...(o.venueIds ? { venueIds: [...o.venueIds] } : {}) }));

interface HoursRow {
  key: string; weekdays: number[]; start: string; end: string;
  /** A permit's block on another venue or facilities than the form's (a town permit over several parks): kept as it was. */
  place?: { venueId: string; facilityIds: string[] };
  /** A block's own dates inside the schedule's (stored, not offered on the form): kept, or the slots would run past them. */
  dates?: { fromDate: string | null; untilDate: string | null };
  /** The permit the row came from (a schedule on several permits, mig 487) — what prices it; absent for a typed row. */
  permitId?: string | null;
  /** That permit's own dates: sent as the row's only while several permits are ticked, so each permit's time keeps to
   *  its own dates inside the widened From and To (one permit: the row follows the schedule's dates, as before). */
  permitDates?: { fromDate: string; untilDate: string };
  /** Found in Find the time (Session D): the days in it another schedule's draft holds, said on its card and warned on in
   *  the drafts step (P7b A). Never sent — the form's own note. */
  found?: { draftDays: { facilityId: string | null; day: string }[]; draftBy: string[] };
}
/** A date off; `permitId`: the permit it came with, so unticking that permit takes it away again. One row per permit and
 *  day: two permits off the same day are two rows, merged into one date off only when the time is sent (`mergeDatesOff`).
 *  `venueIds`: "Applies to", as chosen ([] = All venues); absent = its default — a permit's parks, or All venues. */
interface OffRow { key: string; day: string; note: string; permitId?: string; venueIds?: string[] }

/** The time, and the settings part (`SettingsDraft` — its conversions to and from the saved settings are one module's). */
interface Draft extends SettingsDraft {
  name: string;
  /** The permits ticked, in the order they were ticked (a schedule on several permits; the first ticked keeps evenings two
   *  permits share, and is the price permit until Session C). Empty for none. */
  permitIds: string[];
  /** From or To typed by hand: the permits never move a typed date (drawing tab 1, note 4). */
  datesTyped: { start: boolean; end: boolean };
  /** The schedule copied a year on — '' for none. Both can be set: last year's teams on this year's permit. */
  copyFrom: string;
  venueId: string;
  facilityIds: string[];
  startsOn: string;
  endsOn: string;
  rows: HoursRow[];
  datesOff: OffRow[];
}

const EMPTY: Draft = {
  name: '', permitIds: [], datesTyped: { start: false, end: false }, copyFrom: '', venueId: '', facilityIds: [], startsOn: '', endsOn: '',
  rows: [{ key: 'row-0', weekdays: [], start: '', end: '' }], datesOff: [],
  ...EMPTY_SETTINGS,
};

/** A dates-off merge where every row says its parks (Settings… and "Take … off"): no defaults to read. */
const NO_PARKS: DateOffParks = { parks: [], permitParks: () => [] };
type ListName = 'rows' | 'datesOff' | 'windows' | 'daysOff' | 'fieldsBy' | 'sharing';
type RowOf<K extends ListName> = Draft[K] extends readonly (infer R)[] ? R : never;

/** The optional weekly cap's key when it opens in place. The daily limit is a visible basic setting. */
const WEEK_CAP = 'week-cap';

const SLOT_LENGTHS = [30, 45, 60, 75, 90, 105, 120, 150, 180, 240];
const CHANGEOVERS = [0, 5, 10, 15, 20, 30, 45, 60];
const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const withCurrent = (list: number[], current: number) => (list.includes(current) ? list : [...list, current].sort((a, b) => a - b));

/** A block's facilities, listed (none listed = every facility at its venue, read now). */
const facilitiesOf = (b: TimeBlock, places: readonly InputPlace[]) =>
  (b.facilityIds.length ? [...b.facilityIds] : places.find(p => p.venueId === b.venueId)?.facilities.map(f => f.id) ?? []);

/** A row of hours with nothing in it yet. */
const emptyRow = (): HoursRow => ({ key: newKey('row'), weekdays: [], start: '', end: '' });

/** The time as the form holds it, from a set of blocks (a permit's, or a schedule's): the shared place on top, each
 *  block a row of hours — a block on another place keeps its own, and so does a block a permit gave (Settings…: it keeps
 *  its permit through a regenerate, mig 487). */
function timeFromBlocks(blocks: readonly (TimeBlock & { permitId?: string | null })[], places: readonly InputPlace[], shift: (day: string) => string = d => d): Pick<Draft, 'venueId' | 'facilityIds' | 'rows'> {
  const venueId = blocks[0]?.venueId ?? '';
  const venue = places.find(p => p.venueId === venueId);
  const every = (venue?.facilities ?? []).map(f => f.id);
  const facsOf = (b: TimeBlock) => facilitiesOf(b, places);
  const first = blocks[0] ? facsOf(blocks[0]) : every;
  const same = (b: TimeBlock) => b.venueId === venueId && facsOf(b).slice().sort().join() === first.slice().sort().join();
  return {
    venueId,
    facilityIds: first,
    rows: blocks.length
      ? blocks.map(b => ({
        key: newKey('row'), weekdays: [...b.weekdays], start: b.startTime.slice(0, 5), end: b.endTime.slice(0, 5),
        ...(same(b) && !b.permitId ? {} : { place: { venueId: b.venueId, facilityIds: facsOf(b) } }),
        ...(b.permitId ? { permitId: b.permitId } : {}),
        ...(b.fromDate || b.untilDate ? { dates: { fromDate: b.fromDate ? shift(b.fromDate) : null, untilDate: b.untilDate ? shift(b.untilDate) : null } } : {}),
      }))
      : [emptyRow()],
  };
}

/** A permit's time as the form's rows (a schedule on several permits): each row names its place and remembers the permit,
 *  with the permit's own dates beside it. */
function rowsOfPermit(p: InputPermit, places: readonly InputPlace[]): HoursRow[] {
  return p.blocks.map(b => ({
    key: newKey('row'), weekdays: [...b.weekdays], start: b.startTime.slice(0, 5), end: b.endTime.slice(0, 5),
    place: { venueId: b.venueId, facilityIds: facilitiesOf(b, places) }, permitId: p.id,
    permitDates: { fromDate: p.startsOn, untilDate: p.endsOn },
    ...(b.fromDate || b.untilDate ? { dates: { fromDate: b.fromDate, untilDate: b.untilDate } } : {}),
  }));
}
/** A permit's dates off as the form's rows, each remembering the permit. */
const offsOfPermit = (p: InputPermit): OffRow[] => offRows(p.datesOff).map(o => ({ ...o, permitId: p.id }));
/** The form started from one permit (its page's "Start a schedule from it"): its time, dates and dates off. */
function fromPermit(p: InputPermit, places: readonly InputPlace[]): Partial<Draft> {
  const rows = rowsOfPermit(p, places);
  return {
    permitIds: [p.id], startsOn: p.startsOn, endsOn: p.endsOn, venueId: rows[0]?.place?.venueId ?? '',
    rows: rows.length ? rows : [emptyRow()], datesOff: offsOfPermit(p),
  };
}
/** A row of hours the admin has filled in. */
const rowDone = (r: HoursRow) => r.weekdays.length > 0 && !!r.start && !!r.end && r.end > r.start;
/** Time that comes in FRESH replaces what the form holds: the first permit or find on a copy, or on a form with no time typed. */
const replacesTime = (d: Draft, rows: readonly HoursRow[]) => !d.permitIds.length && (!!d.copyFrom || !rows.some(rowDone));
/** The rows the admin typed, kept when more time comes in — each now names its place (the form's own venue, when it had none). */
const typedRowsKept = (d: Draft, rows: readonly HoursRow[]): HoursRow[] =>
  rows.filter(r => r.weekdays.length || r.start || r.end)
    .map(r => (r.place || !d.venueId ? r : { ...r, place: { venueId: d.venueId, facilityIds: [...d.facilityIds] } }));

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
  /** Kept: the version it made, whether a new name saved with it, and the page's notice when it is not "regenerated". */
  onKept: (version: number, renamed: boolean, said?: string) => void;
  /** The schedule changed under the window: the page re-reads it, so a retry sends the version it now holds. */
  onStale?: () => void;
  regenerate?: boolean;
  /** 13c Session C (C2): “Take {day} and {day} off” — the permit’s pulled dates, added to the schedule’s OWN Dates off for
   *  this regenerate. Saved only if the admin keeps a draft (the regenerate’s one write); nothing else changes. */
  addDatesOff?: readonly DateOff[];
  /** Tools › Add time… on a FINAL schedule (Phase 8, Session 2): New schedule's form, for a new PART of `view` — its own
   *  permits, dates, dates off, teams and shares. Nothing on `view` is edited or saved; the part is a schedule of its own. */
  addTime?: boolean;
  /** The schedule's added parts as its page read them: the time they already use, and the labels they hold. */
  parts?: readonly PartRead[];
  /** Settings… or Regenerate of an ADDED PART (Phase 8, Session 3 — after "which part?"): `view` is the part's own. Taking
   *  its only permit off removes the part (drawing tab 4): before its first send it simply goes; after, the usual credit. */
  part?: { label: string; parentName: string } | null;
  /** Opened from a door in "Open slots and short teams" (2026-11-24): the setting to show first. */
  focus?: 'perDay' | 'perWeek' | 'shares' | 'fieldRules' | 'rules';
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
  /** Add time (Phase 8, Session 2): the schedule the new PART is added to. The window is then New schedule's — nothing on
   *  this schedule is edited — so `editing` (Settings…, Regenerate) stays null. */
  const partOf = settingsOf?.addTime ? settingsOf.view : null;
  const editing = partOf ? null : settingsOf?.view ?? null;
  const [inputs, setInputs] = useState<NewInputs | null>(null);
  const [inputsFailed, setInputsFailed] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // A door from "Open slots and short teams" opens on its rule: the rules unfolded, the weekly cap opened in place.
  const [rulesOpen, setRulesOpen] = useState(() => ['perWeek', 'fieldRules', 'rules'].includes(settingsOf?.focus ?? ''));
  /** The one rule opened in place (its key; `WEEK_CAP` for the weekly cap), or none (Stage 11c Ask 6). */
  const [openRule, setOpenRule] = useState<string | null>(() => (settingsOf?.focus === 'perWeek' ? WEEK_CAP : null));
  const [adding, setAdding] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  useDismissable(adding, addRef, () => setAdding(false));
  const addMenuStyle = useAnchoredMenu(adding, addRef, addMenuRef, { minWidth: 300, narrowMinWidth: 220, align: 'start' });
  const [noSeasonOpen, setNoSeasonOpen] = useState(false);
  const [step, setStep] = useState<'settings' | 'drafts'>('settings');
  /** The permit just unticked: the hint says what came off with it (/ux 1). */
  const [cameOff, setCameOff] = useState<{ name: string; rows: number; offs: number } | null>(null);
  /** Find the time (Session D): open over the settings; its filters and ticks are kept while the window is, so Back keeps
   *  the form and opening it again keeps the filters (/ux 6). `foundIn`: found time just came in (the Permits hint says so). */
  const [finding, setFinding] = useState(false);
  const [findFilters, setFindFilters] = useState<FindFilters | null>(null);
  const [findTicked, setFindTicked] = useState<ReadonlySet<string>>(new Set());
  const [findPriced, setFindPriced] = useState<Record<string, string>>({});
  const [foundIn, setFoundIn] = useState(false);
  /** Past the opening screen — a copy picked, or Start blank. */
  const [started, setStarted] = useState(false);
  /** The opening screen (0): only when there is one to copy, never in Settings… */
  const choosing = !editing && !partOf && !started && !!inputs?.schedules.length;
  /** The inputs are still on their way — the window can't yet say which level it opens on. */
  const opening = !editing && !inputs && !inputsFailed;
  const set = useCallback((patch: Partial<Draft>) => setDraft(d => ({ ...d, ...patch })), []);
  /** Settings…: the form as it opened (its first seeded state), so "Take it off…" can say when other changes are left out. */
  const [opened, setOpened] = useState<string | null>(null);
  const permitById = useMemo(() => new Map((inputs?.permits ?? []).map(x => [x.id, x])), [inputs]);
  /** The parks a set of rows uses (a row with no place of its own is at the form's Venue), and each permit's own parks. */
  const parksCtx = useCallback((rows: readonly HoursRow[]): DateOffParks => ({
    parks: [...new Set(rows.filter(rowDone).map(r => r.place?.venueId ?? draft.venueId).filter(Boolean))],
    permitParks: id => [...new Set((permitById.get(id)?.blocks ?? []).map(b => b.venueId))],
  }), [permitById, draft.venueId]);

  // ── A door from "Open slots and short teams" (owner 2026-11-24): the form opens with that setting in view — the per-day
  //    select, the weekly cap opened in place, the rules unfolded (the state above starts so), or the shares. Once, after
  //    the inputs seed the form.
  const focusDone = useRef(false);
  const focus = settingsOf?.focus ?? null;
  useEffect(() => {
    if (!focus || !inputs || focusDone.current) return;
    focusDone.current = true;
    const id = focus === 'perDay' ? 'ns-max-per-day' : focus === 'perWeek' ? `ns-${WEEK_CAP}-week` : focus === 'shares' ? 'ns-split' : 'ns-rules';
    window.setTimeout(() => {
      const el = document.getElementById(id);
      el?.scrollIntoView({ block: 'center' });
      (el?.closest('button') ?? el)?.focus();
    }, 0);
  }, [focus, inputs]);

  // ── The inputs, and where the form starts ──
  useEffect(() => {
    let live = true;
    // org-slug-ok: `q` is the host page's "orgSlug=…" query
    moneyFetch<NewInputs>(`/api/admin/schedules?${q}&new=1`).then(r => {
      if (!live) return;
      if (!r.ok) { setInputsFailed(true); return; }
      setInputs(r.data);
      const running = new Set(r.data.teams.filter(t => t.season).map(t => t.id));
      if (partOf) {
        // A part starts as New schedule does, with NOBODY ticked (ruling 6) and the schedule's slot length and changeover;
        // every other choice is New schedule's, for this time only (drawing tab 3, note 5).
        setDraft({ ...EMPTY, ticked: [], slotMinutes: partOf.schedule.settings.slotMinutes, changeoverMinutes: partOf.schedule.settings.changeoverMinutes });
        return;
      }
      if (editing) {
        const seed: Draft = {
          ...EMPTY, ...settingsDraftOf(editing.schedule.settings, running),
          name: editing.schedule.name, startsOn: editing.schedule.startsOn, endsOn: editing.schedule.endsOn,
          // The permits behind its rows, ticked in the Permits picker (drawing tab 2; a draft or in review). Its dates are
          // its own: a permit ticked here only ever widens them (`togglePermits`).
          permitIds: [...new Set(editing.time.blocks.map(b => b.permitId).filter((x): x is string => !!x && r.data.permits.some(p => p.id === x)))],
          datesTyped: { start: true, end: true },
          ...timeFromBlocks(editing.time.blocks, r.data.places),
          // "Take … off" days join the schedule's own, one per day: a day already off keeps All venues, else the parks unite.
          datesOff: offRows(mergeDatesOff([
            ...editing.time.datesOff,
            ...(settingsOf?.addDatesOff ?? []),
          ], NO_PARKS).sort((a, b) => a.day.localeCompare(b.day))),
        };
        setDraft(seed);
        setOpened(JSON.stringify(seed));
        return;
      }
      // Every running team ticked; House league only when it is all the club has (Stage 11b: a club's rep teams are its
      // usual holders, and giving house league a share is a choice).
      const runningNow = r.data.teams.filter(t => t.season);
      const teamsNow = runningNow.filter(t => !isProgramHolder(t.id));
      const base: Draft = { ...EMPTY, ticked: (teamsNow.length ? teamsNow : runningNow).map(t => t.id) };
      const permit = startPermitId ? r.data.permits.find(p => p.id === startPermitId) : null;
      setDraft(permit ? { ...base, ...fromPermit(permit, r.data.places), name: permit.name } : base);
    }).catch(() => { if (live) setInputsFailed(true); });
    return () => { live = false; };
    // The inputs load once, as the window opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  /**
   * PERMITS — a tick list (a schedule on several permits; drawing tab 1). Each tick ADDS that permit's rows and dates off;
   * unticking takes only that permit's away — the admin's edits to them too, which the hint says (/ux 1). From and To
   * follow the permits unless typed. The first tick on a copy, or on a form with no time typed, REPLACES the time (N3 A:
   * this year's time is the permits'; the copy's teams, shares and rules stay). A typed row stays, its place now said.
   */
  function togglePermits(next: string[]) {
    if (!inputs) return;
    const byId = permitById;
    const removedNow = draft.permitIds.filter(id => !next.includes(id));
    const addedNow = next.filter(id => !draft.permitIds.includes(id));
    if (removedNow.length === 1 && !addedNow.length) {
      const id = removedNow[0];
      // Only the days that are not off exactly as before (/review F5): a day another ticked permit, or a typed row, keeps
      // off on the same parks did not come off.
      const offsOf = (rows: readonly HoursRow[], offs: readonly OffRow[]) => mergeDatesOff(offs.filter(o => isCalendarDate(o.day)), parksCtx(rows));
      const rowsLeft = draft.rows.filter(r => r.permitId !== id), offsLeft = draft.datesOff.filter(o => o.permitId !== id);
      const offs = datesOffChanged(draft.datesOff.filter(o => o.permitId === id).map(o => o.day), offsOf(draft.rows, draft.datesOff), offsOf(rowsLeft, offsLeft)).length;
      setCameOff({ name: byId.get(id)?.name ?? '', rows: draft.rows.filter(r => r.permitId === id).length, offs });
    } else setCameOff(null);
    setFoundIn(false);
    setDraft(d => {
      const ids = next.filter(id => byId.has(id));
      const added = ids.filter(id => !d.permitIds.includes(id));
      const removed = d.permitIds.filter(id => !ids.includes(id));
      let rows = d.rows, datesOff = d.datesOff;
      rows = rows.filter(r => !r.permitId || !removed.includes(r.permitId));
      datesOff = datesOff.filter(o => !o.permitId || !removed.includes(o.permitId));
      for (const id of added) {
        const p = byId.get(id)!;
        if (id === added[0] && replacesTime(d, rows)) { rows = rowsOfPermit(p, inputs.places); datesOff = offsOfPermit(p); continue; }
        rows = [...typedRowsKept(d, rows), ...rowsOfPermit(p, inputs.places)];
        // Each permit's own rows, a shared day too (P5 A): it is merged into one date off when the time is sent, so
        // unticking either takes only its parks off that day.
        datesOff = [...datesOff, ...offsOfPermit(p)];
      }
      // Unticking leaves no park behind on a row the admin picked by hand: a pick keeps only the parks the time still uses,
      // and on a one-park time it is "All venues" again (what a one-park schedule always sent). A pick that names none of
      // the parks left stays as typed — trimming it would widen it to All.
      if (removed.length) {
        const used = new Set(rows.filter(rowDone).map(r => r.place?.venueId ?? d.venueId).filter(Boolean));
        datesOff = datesOff.map(o => {
          if (!o.venueIds?.length) return o;
          const keep = o.venueIds.filter(v => used.has(v));
          if (!keep.length) return o;
          const kept = used.size > 1 ? keep : [];
          return kept.length === o.venueIds.length ? o : { ...o, venueIds: kept };
        });
      }
      if (!rows.length) rows = [emptyRow()];
      const span = permitsSpan(ids.map(id => byId.get(id)!));
      const first = ids.length ? byId.get(ids[0]) : undefined;
      // The shared Venue and its facilities move together: a permit at another venue never leaves a copy's facilities behind.
      const placed = rows.find(r => r.place)?.place;
      const moved = !!placed && placed.venueId !== d.venueId;
      let startsOn = span && !d.datesTyped.start ? span.startsOn : d.startsOn;
      let endsOn = span && !d.datesTyped.end ? span.endsOn : d.endsOn;
      // Settings…: a permit ticked widens the schedule's own dates to cover it, never narrows them.
      const widen = editing && added.length ? permitsSpan(added.map(id => byId.get(id)!)) : null;
      if (widen && isCalendarDate(startsOn) && widen.startsOn < startsOn) startsOn = widen.startsOn;
      if (widen && isCalendarDate(endsOn) && widen.endsOn > endsOn) endsOn = widen.endsOn;
      // A part: From starts where the family's use of a permit ends, and never before today (ruling 7, tab 3 note 3).
      const partDates = partOf && ids.length ? partSpan(ids) : null;
      if (partDates && !d.datesTyped.start) startsOn = partDates.startsOn;
      if (partDates && !d.datesTyped.end) endsOn = partDates.endsOn;
      return fieldsInTime({
        ...d, permitIds: ids, rows, datesOff, startsOn, endsOn,
        venueId: moved ? placed.venueId : d.venueId,
        facilityIds: moved ? [...placed.facilityIds] : d.facilityIds,
        name: d.name.trim() || !first ? d.name : first.name,
      }, inputs.places);
    });
  }

  /**
   * FIND THE TIME → the form (drawing tab 2, frame "picked"). The places ticked become ordinary rows, each remembering its
   * permit and keeping to the finder's dates cut to that permit; a place two permits hold is priced by the one chosen (P4
   * A, settled in the rows by `rowsFromFound`). A permit not yet ticked shows as ticked — a row came from it — without its
   * other time (ticking it again after an untick brings all of it; unticking takes the found rows away too). It brings its
   * dates off inside the found time, so the drafts keep the days the finder counted as off. Its draft-held days come in,
   * said on the card (P7b A). The first time on a copy, or on a form with no time typed, REPLACES the time, as the first
   * permit ticked does (N3 A). From and To widen to cover it unless typed.
   */
  function addFound() {
    if (!inputs || !freeRead.data) return;
    const picked = freeRead.data.rows.filter(r => findTicked.has(findRowKey(r)) && r.freeDays + r.draftDays > 0);
    const found = rowsFromFound(picked, r => findPriced[findRowKey(r)] ?? r.pricedBy);
    if (!found.length) return;
    const newRows: HoursRow[] = found.map(f => ({
      key: newKey('row'), weekdays: [...f.weekdays], start: f.startTime, end: f.endTime,
      place: { venueId: f.venueId, facilityIds: [...f.facilityIds] }, permitId: f.permitId,
      dates: { fromDate: f.fromDate, untilDate: f.untilDate },
      ...(f.draftDays.length ? { found: { draftDays: f.draftDays, draftBy: f.draftBy } } : {}),
    }));
    const spanOf = (rows: readonly { fromDate: string; untilDate: string }[]) =>
      permitsSpan(rows.map(f => ({ startsOn: f.fromDate, endsOn: f.untilDate })))!;
    const { startsOn: foundFrom, endsOn: hi } = spanOf(found);
    // A part never starts before today (the schedule it is added to has been sent).
    const lo = partOf && foundFrom < tournamentToday() ? tournamentToday() : foundFrom;
    setDraft(d => {
      const fresh = replacesTime(d, d.rows);
      const kept = fresh ? [] : typedRowsKept(d, d.rows);
      const added = [...new Set(found.map(f => f.permitId))].filter(id => !d.permitIds.includes(id));
      const offs = added.flatMap(id => {
        const p = permitById.get(id);
        const { startsOn: from, endsOn: until } = spanOf(found.filter(f => f.permitId === id));
        return p ? offsOfPermit(p).filter(o => o.day >= from && o.day <= until) : [];
      });
      const ids = [...d.permitIds, ...added];
      const first = permitById.get(ids[0]);
      const widen = !fresh && isCalendarDate(d.startsOn) && isCalendarDate(d.endsOn);
      const rows = [...kept, ...newRows];
      // The shared Venue and its facilities move with the time, as when a permit is ticked: a copy's old venue is not left behind.
      const placed = rows.find(r => r.place)?.place;
      const moved = !!placed && placed.venueId !== d.venueId;
      return fieldsInTime({
        ...d, permitIds: ids, rows, datesOff: [...(fresh ? [] : d.datesOff), ...offs],
        venueId: moved ? placed.venueId : d.venueId,
        facilityIds: moved ? [...placed.facilityIds] : d.facilityIds,
        // Settings… holds the schedule's own dates as typed, but found time only ever WIDENS them (as ticking a permit does):
        // time found outside them would be cut to nothing, unsaid.
        startsOn: d.datesTyped.start ? (editing && isCalendarDate(d.startsOn) && lo < d.startsOn ? lo : d.startsOn) : widen && d.startsOn < lo ? d.startsOn : lo,
        endsOn: d.datesTyped.end ? (editing && isCalendarDate(d.endsOn) && hi > d.endsOn ? hi : d.endsOn) : widen && d.endsOn > hi ? d.endsOn : hi,
        name: d.name.trim() || !first ? d.name : first.name,
      }, inputs.places);
    });
    setCameOff(null);
    setFoundIn(true);
    setFindTicked(new Set());
    setFinding(false);
  }
  /** Open the finder — on its kept filters, or today → three months on the first time. */
  function openFinder() {
    setFindFilters(f => f ?? findFiltersFrom(tournamentToday()));
    setError('');
    setFinding(true);
  }

  /** The latest Copy pick — a read that lands after a later pick is dropped, never applied over it. */
  const copyAsk = useRef(0);
  /** Copy a schedule (the opening screen's row): its teams, shares and rules a year on — and its time, unless a permit is
   *  already giving the time. The window stays on the list until the copy has landed; a refusal stays there too. The read
   *  never makes the window busy, so ✕, Cancel and Escape still leave if it hangs (/review 2026-10-13); a later row or
   *  Start blank supersedes it. */
  async function pickCopy(id: string) {
    if (!inputs) return;
    const mine = ++copyAsk.current;
    setError('');
    // org-slug-ok: `q` is the host page's "orgSlug=…" query
    const r = await moneyFetch<ScheduleView>(`/api/admin/schedules/${encodeURIComponent(id)}?${q}`).catch(() => null);
    if (mine !== copyAsk.current) return;
    if (!r?.ok) { setError(refusalText(r?.data, W.copyFailed)); return; }
    const running = new Set(inputs.teams.filter(t => t.season).map(t => t.id));
    const v = r.data;
    setDraft(d => fieldsInTime({
      ...d, ...settingsDraftOf(v.schedule.settings, running, yearOn),
      ...(d.permitIds.length ? {} : {
        // Last year's rows come as typed time ("No permit"): this year's permits replace them (N3 A).
        ...timeFromBlocks(v.time.blocks.map(b => ({ ...b, permitId: null })), inputs.places, yearOn),
        startsOn: yearOn(v.schedule.startsOn), endsOn: yearOn(v.schedule.endsOn),
        datesOff: offRows(v.time.datesOff, yearOn),
      }),
      copyFrom: id, name: d.name.trim() ? d.name : renewedName(v.schedule.name),
    }, inputs.places));
    setStarted(true);
  }

  // ── What the form says, worked out ──
  const places = useMemo(() => inputs?.places ?? [], [inputs]);
  const venue = places.find(p => p.venueId === draft.venueId) ?? null;
  const running = useMemo(() => (inputs?.teams ?? []).filter(t => t.season), [inputs]);
  const noSeason = useMemo(() => (inputs?.teams ?? []).filter(t => !t.season), [inputs]);
  const tickedSet = useMemo(() => new Set(draft.ticked), [draft.ticked]);
  const inOrder = useMemo(() => running.filter(t => tickedSet.has(t.id)), [running, tickedSet]);
  /** The rep teams alone: the only holders a rule can name (Stage 11b — no team rule reaches house league). */
  const runningTeams = useMemo(() => running.filter(t => !isProgramHolder(t.id)), [running]);
  /** All of it to house league (Stage 11b, k1): no drafts, no split, no prime time, no rules — the time goes as it stands. */
  const wholeHouseLeague = inOrder.length === 1 && isProgramHolder(inOrder[0].id);
  const houseLeagueShare = !wholeHouseLeague && inOrder.some(t => isProgramHolder(t.id));
  const groupKeyOf = (t: InputTeam) => (isProgramHolder(t.id) ? PROGRAMS : t.groupId ?? NO_GROUP);
  const groupKeys = useMemo(() => (running.some(t => t.groupId) ? [...new Set(running.map(groupKeyOf))] : []), [running]);
  const membersOf = (key: string) => running.filter(t => groupKeyOf(t) === key);
  const groupLabel = (key: string) => (key === PROGRAMS ? W.programs : key === NO_GROUP ? W.notInGroup : running.find(t => t.groupId === key)?.groupName ?? W.notInGroup);

  const figureOf = (teamId: string): number | null => figureIn(draft, teamId);
  const percentHundredths = draft.method === 'percentage'
    ? inOrder.reduce((s, t) => s + Math.round((positive(draft.values[t.id]) ?? 0) * 100), 0) : 10000;

  /** Add time: the family — the schedule and its parts — whose use of a permit the new part leaves out (ruling 7). */
  const family = useMemo(() => (partOf ? [partOf, ...(settingsOf?.parts ?? []).map(x => x.view)] : []), [partOf, settingsOf?.parts]);
  const familyUse = (permitId: string) => familyUseOf(family, permitId);
  /** The part's own dates from the permits ticked: each from where the family's use of it ends (or today), to its end. */
  function partSpan(ids: readonly string[]): { startsOn: string; endsOn: string } | null {
    const today = tournamentToday();
    const ps = ids.map(id => permitById.get(id)).filter((x): x is InputPermit => !!x);
    if (!ps.length) return null;
    return permitsSpan(ps.map(x => ({ startsOn: partFromFor(x, familyUse(x.id), today), endsOn: x.endsOn })));
  }
  /** The part's name, as the save will give it (the server's word is final: "Time added Nov 17", "… (2)"). */
  const partLabel = partOf ? partLabelFor(tournamentToday(), (settingsOf?.parts ?? []).map(x => x.label)) : '';
  /** The family's last day, as the page shows it (its dates widen to cover every part). */
  const familyEnds = family.reduce((m, v) => (v.schedule.endsOn > m ? v.schedule.endsOn : m), '');
  /** The permits behind the rows, in the order they were ticked (Settings…: in the rows' order). */
  const permitOrder = useMemo(() => [...new Set([...draft.permitIds, ...draft.rows.map(r => r.permitId).filter((x): x is string => !!x)])],
    [draft.permitIds, draft.rows]);
  /** The rows as blocks, each with its permit — and, with several permits, each permit's own dates and the evenings two
   *  of them share settled: the permit ticked first keeps them (`settleOverlaps`, P4 A), and the form says so. */
  const settled = useMemo(() => {
    const facilityIds = venue && venue.facilities.length ? draft.facilityIds : [];
    // A part: its rows always keep to their permit's own dates, inside the part's own From and To.
    const several = !!partOf || permitOrder.length > 1;
    const range = { startsOn: draft.startsOn, endsOn: draft.endsOn };
    /** A permit row's dates (Ask 6 A): its permit's, with several permits; with one, only once From or To reach past the
     *  permit. A saved row (Settings…) carries no permit dates of its own, so only that stop applies to it. */
    const datesOf = (r: HoursRow) => {
      if (r.permitDates) return permitRowDates(r, r.permitDates, several, range);
      const p = r.permitId ? permitById.get(r.permitId) : undefined;
      return permitRowDates(r, p ? { fromDate: p.startsOn, untilDate: p.endsOn } : null, false, range);
    };
    const blocks = draft.rows.filter(rowDone).map(r => ({
      venueId: r.place?.venueId ?? draft.venueId, facilityIds: r.place?.facilityIds ?? facilityIds,
      weekdays: r.weekdays, startTime: r.start, endTime: r.end,
      ...datesOf(r),
      permitId: r.permitId ?? null,
    }));
    return several ? settleOverlaps(blocks, permitOrder, range) : { blocks, overlaps: [] };
  }, [draft.rows, draft.venueId, draft.facilityIds, draft.startsOn, draft.endsOn, venue, permitOrder, partOf, permitById]);
  /** The places each permit holds, by venue (pick-fields, Stage 1): what a permit row's Facilities list offers, and what
   *  its card says is left off. */
  const permitHeld = useMemo(() => permitPlaces(inputs?.permits ?? [], new Map(places.map(p => [p.venueId, p.facilities.map(f => f.id)]))), [inputs, places]);
  /** The parks the time uses, and each permit's — what a date off's "Applies to" offers and defaults to (P5 A). */
  // A part's dates off are its own (tab 3, note 4): its parks are its own rows'.
  const offParks = useMemo(() => parksCtx(draft.rows), [parksCtx, draft.rows]);
  /** The schedule's time as the routes read it: the dates off one per day, each saying its parks (`mergeDatesOff`). */
  const timeBody = useMemo(() => ({
    startsOn: draft.startsOn, endsOn: draft.endsOn, blocks: settled.blocks,
    datesOff: mergeDatesOff(draft.datesOff.filter(o => isCalendarDate(o.day)), offParks),
  }), [draft.startsOn, draft.endsOn, draft.datesOff, settled, offParks]);
  /** Find the time's reading, while it is open. The form's own time rides along, so it is never offered again. */
  // A finished row with no venue yet is left out (the route refuses a row without one): it holds no place to take.
  const findBlocks = timeBody.blocks.filter(b => b.venueId);
  const findOwn = isCalendarDate(timeBody.startsOn) && isCalendarDate(timeBody.endsOn) && timeBody.endsOn >= timeBody.startsOn && findBlocks.length
    ? { ...timeBody, blocks: findBlocks } : null;
  // Add time asks as the schedule, so the whole family's slots are taken too (Session D's note; drawing tab 3).
  const freeRead = useFreeTime(q, finding ? findFilters : null, findOwn, partOf?.schedule.id ?? null);
  const rowsDone = draft.rows.filter(rowDone).length;
  const mixedPlaces = draft.rows.some(r => r.place);
  /** The rows sit in cards, each naming its place, once a permit gives the time or the places mix (N2 A: the read-only
   *  line of places goes); otherwise the Venue and Facilities fields, as before. */
  const cards = draft.rows.some(r => r.permitId) || mixedPlaces;

  /** The settings as the routes read them — `previewOnly` asks with only the teams whose figure is whole. */
  const settingsBody = useCallback((onlyWhole: boolean): ScheduleSettings =>
    settingsFromDraft(draft, inOrder.filter(t => !onlyWhole || figureIn(draft, t.id) != null).map(t => t.id)), [draft, inOrder]);

  const timeReady = isCalendarDate(draft.startsOn) && isCalendarDate(draft.endsOn) && draft.endsOn >= draft.startsOn
    && timeBody.blocks.length > 0 && rowsDone === draft.rows.length
    && (cards || (!!draft.venueId && (!venue?.facilities.length || draft.facilityIds.length > 0)));
  /** The price permit (the first ticked; until Session C, one permit's hour prices the bill) — Settings…: as saved. */
  const permitId = editing ? editing.schedule.startedFromPermitId
    : draft.permitIds.find(id => draft.rows.some(r => r.permitId === id)) ?? draft.permitIds[0] ?? null;
  const fromScheduleId = draft.copyFrom || null;

  // ── The server's count (`previewOnly`), as the form changes ──
  const [summary, setSummary] = useState<GenerateSummary | null>(null);
  const [previewError, setPreviewError] = useState('');
  // Not while the opening screen is up: a permit's page pre-fills the time before anything is chosen (/review 2026-10-13).
  const previewBody = useMemo(() => (!choosing && timeReady && percentHundredths <= 10000
    ? { ...timeBody, settings: settingsBody(true), startedFromPermitId: permitId, scheduleId: editing?.schedule.id ?? null, ...(partOf ? { partOf: partOf.schedule.id } : {}), previewOnly: true }
    : null), [choosing, timeReady, percentHundredths, timeBody, settingsBody, permitId, editing, partOf]);
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
  // Each team's figures from the preview, looked up once (13c: the share, and what the per-day limit lets it get).
  const targetById = useMemo(() => new Map((shown?.targets ?? []).map(x => [x.teamId, x])), [shown]);
  const targetOf = (teamId: string) => targetById.get(teamId)?.slots ?? null;
  const tickedWithFigure = inOrder.filter(t => figureOf(t.id) != null);

  /** Why Generate can't go yet, in words — or null. */
  const problem = (): string | null => {
    // A part has no name to type (ruling 1); it needs time first, and never starts before today.
    if (partOf && !draft.permitIds.length && !rowsDone) return W.addNeedTime;
    if (!partOf && !draft.name.trim()) return W.needName;
    if (!cards && !draft.venueId) return W.needVenue;
    if (!cards && venue?.facilities.length && !draft.facilityIds.length) return W.needFacility;
    if (!isCalendarDate(draft.startsOn) || !isCalendarDate(draft.endsOn) || draft.endsOn < draft.startsOn) return W.needDates;
    if (partOf && draft.startsOn < tournamentToday()) return PART_WORDS.fromBeforeToday(partOf.schedule.name);
    if (rowsDone !== draft.rows.length || !timeBody.blocks.length) return W.needHours;
    if (!inOrder.length) return W.needTeams;
    if (wholeHouseLeague) return null;
    if (draft.method !== 'even' && tickedWithFigure.length !== inOrder.length) return W.needFigures;
    if (percentHundredths > 10000) return W.over100(String((percentHundredths - 10000) / 100));
    if (unfinishedRule) return W.ruleUnfinished;
    return null;
  };

  // ── Step 2 ──
  const [gen, setGen] = useState<GenerateRead | null>(null);
  const [round, setRound] = useState(0);
  const [chosen, setChosen] = useState(0);
  const [lens, setLens] = useState<'team' | 'day'>('team');
  /** By day: what the club's other bookings already hold is out of the list until the box is ticked. */
  const [showBooked, setShowBooked] = useState(false);
  const [asking, setAsking] = useState(false);
  /** What the drafts on show were made from — what Save and Keep send with them. */
  const [madeFrom, setMadeFrom] = useState<{ time: typeof timeBody; settings: ScheduleSettings } | null>(null);

  async function generate(nextRound: number) {
    if (busy) return;
    const p = problem();
    if (p) { setError(p); if (unfinishedRule) setRulesOpen(true); return; }
    setBusy(true); setError('');
    try {
      const from = { time: timeBody, settings: settingsBody(false) };
      const body = { ...from.time, settings: from.settings, startedFromPermitId: permitId, scheduleId: editing?.schedule.id ?? null, round: nextRound, ...(partOf ? { partOf: partOf.schedule.id } : {}) };
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
        // A part: no name (its label is the date it was added) and its schedule — the save makes it a part (mig 494).
        ...(partOf ? { partOf: partOf.schedule.id } : { name: draft.name.trim() }), ...madeFrom.time, settings: madeFrom.settings, assignments: assignmentsOf(pick),
        startedFromPermitId: permitId, startedFromScheduleId: fromScheduleId,
      };
      // org-slug-ok: `q` is the host page's "orgSlug=…" query
      const r = await moneyFetch<{ id: string; version: number; label?: string }>(`/api/admin/schedules?${q}`, jsonInit('POST', body));
      if (!r.ok) { setError(refusalText(r.data, R.notSaved)); setBusy(false); return; }
      // A part lands on the page it was added from; nothing on that schedule changed, so its version is untouched.
      if (partOf) { settingsOf!.onKept(partOf.schedule.version, true, PART_WORDS.kept(r.data.label ?? partLabel)); return; }
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

  /** Settings…: "Take it off…" (P11 A) — the permit asked about, then its own save: nothing else on the schedule moves. */
  const [takingOff, setTakingOff] = useState<string | null>(null);
  const sent = editing?.schedule.state === 'final';
  /** What taking a permit off does, counted from the page's slots (each row's own permit; a shared slot is two practices). */
  const takeOffOf = (permitId: string) => {
    const today = tournamentToday();
    const mine = (editing?.slots ?? []).filter(x => x.rowPermitId === permitId);
    const future = mine.filter(x => !sent || x.day >= today);
    const byTeam = new Map<string, number>();
    for (const x of future) for (const t of x.teamIds) byTeam.set(t, (byTeam.get(t) ?? 0) + 1);
    return {
      today, slots: future.length, practices: [...byTeam.values()].reduce((a, b) => a + b, 0),
      teams: [...byTeam].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${teamName(t)} ${n}`),
      past: sent ? mine.filter(x => x.day < today).reduce((n, x) => n + x.teamIds.length, 0) : 0,
    };
  };
  /** Offered when something stays: another row, or (sent) the practices it already gave. */
  // (Asked while the cards render — above `teamName` — so it counts without naming a team.)
  const canTakeOff = (permitId: string) => {
    if (!editing) return false;
    // An added part's only permit may come off too: the part goes with it (Phase 8, Session 3).
    if (settingsOf?.part) return editing.time.blocks.some(b => b.permitId === permitId);
    if (editing.time.blocks.some(b => b.permitId !== permitId)) return true;
    const today = tournamentToday();
    return sent && editing.slots.some(x => x.rowPermitId === permitId && x.teamIds.length > 0 && x.day < today);
  };
  async function takeOff(permitId: string) {
    if (!editing || busy) return;
    setBusy(true); setError('');
    try {
      const url = `/api/admin/schedules/${encodeURIComponent(editing.schedule.id)}?${q}`;
      const r = await moneyFetch<{ version: number | null; removed?: boolean }>(url, jsonInit('PATCH', { action: 'take_permit_off', version: editing.schedule.version, permitId }));
      if (!r.ok) { if (isStale(r.data)) settingsOf?.onStale?.(); setTakingOff(null); setError(refusalText(r.data, R.notSaved)); setBusy(false); return; }
      // An unsent part whose only permit came off is gone (Phase 8): the page says so by its label.
      if (r.data.removed && settingsOf?.part) { settingsOf.onKept(editing.schedule.version, true, PART_WORDS.partTakenOff(settingsOf.part.label)); return; }
      settingsOf!.onKept(r.data.version ?? editing.schedule.version, true, W.permitTakenOff(permitById.get(permitId)?.name ?? '', settingsOf?.part?.label ?? editing.schedule.name));
    } catch {
      setTakingOff(null);
      setError(R.notSaved);
      setBusy(false);
    }
  }

  // ── Step 1's sections ──
  /** A row of one of the form's lists, changed or taken off — the lists' one update rule. */
  const patchIn = <K extends ListName>(list: K, key: string, patch: Partial<RowOf<K>>) =>
    set({ [list]: (draft[list] as { key: string }[]).map(x => (x.key === key ? { ...x, ...(patch as object) } : x)) } as Partial<Draft>);
  const dropFrom = (list: ListName, key: string) => set({ [list]: (draft[list] as { key: string }[]).filter(x => x.key !== key) } as Partial<Draft>);
  // A found row edited by hand is the admin's own: its finder note (days a draft holds) no longer says what it covers.
  const setRow = (key: string, patch: Partial<HoursRow>) => patchIn('rows', key, { ...patch, found: undefined });

  // ── The opening screen (0) ──
  /** Opened from a permit's page: the permit already picked, named on the screen (/design D4). */
  const startPermit = inputs && draft.permitIds.length ? inputs.permits.find(p => p.id === draft.permitIds[0]) ?? null : null;
  const copiedFrom = draft.copyFrom ? inputs?.schedules.find(s => s.id === draft.copyFrom)?.name ?? null : null;
  const openingBody = choosing && (
    <div className={sch.opening}>
      <p>{startPermit ? W.copyLeadPermit(startPermit.name) : W.copyLead}</p>
      <ClubRowList label={W.copySchedule}>
        {inputs.schedules.map(s => (
          <ClubRow key={s.id} as="button" chevron title={s.name}
            caption={[scheduleDates(s.startsOn, s.endsOn), s.venues].filter(Boolean).join(' · ')}
            onClick={() => void pickCopy(s.id)} />
        ))}
      </ClubRowList>
      <div className={sch.or}><span /><strong>{W.or}</strong><span /></div>
    </div>
  );

  // ── The time's pieces (a schedule on several permits: the rows in cards, the dates after them — drawing tab 1) ──
  /** "Applies to" (N4 A): the schedule's parks, "All venues" first; shown only when the time uses more than one park
   *  (drawing UX 7) — or while a date off still names one, so a named list is never hidden. */
  // A park a date off names that the rows no longer use stays an option, so the field never reads "All venues" over it —
  // and so does every park a row will SEND (a permit's date off defaults to that permit's own parks).
  const parkOptions = [...new Set([...offParks.parks, ...draft.datesOff.flatMap(o => dateOffVenues(o, offParks))])]
    .map(id => ({ id, label: placeName(places, id, null) }));
  const showApplies = offParks.parks.length > 1 || draft.datesOff.some(o => o.venueIds?.length);
  const permitOptions = (inputs?.permits ?? []).map(x => ({ id: x.id, label: x.name, detail: W.permitOption(x.issuer, scheduleDates(x.startsOn, x.endsOn)) }));
  const permitsHint = cameOff ? W.permitCameOff(cameOff.name, cameOff.rows, cameOff.offs)
    : foundIn && draft.permitIds.length ? W.foundHint
    : partOf ? PART_WORDS.permitsHint
    : editing ? PART_WORDS.settingsPermitsHint
    : draft.permitIds.length ? W.permitsHint : draft.copyFrom ? W.permitReplacesCopy : W.permitHint;
  /** Settings… on a draft or in review (drawing tab 2): the Permits picker and the Find the time door, as in New schedule. A
   *  final schedule's new time is Add time's (ruling 2), so its Settings… keeps no picker. */
  const showPicker = !editing || editing.schedule.state !== 'final';
  /** Settings…: unticking a permit already on the schedule is its card's "Take it off…" (tab 2, note 2) — the same question,
   *  the same save. A permit ticked in this window, or one whose time nothing else would replace, simply comes off the form. */
  const onPermits = (next: string[]) => {
    const gone = draft.permitIds.filter(id => !next.includes(id));
    if (editing && gone.length === 1 && next.length === draft.permitIds.length - 1
      && editing.time.blocks.some(b => b.permitId === gone[0]) && canTakeOff(gone[0])) { setTakingOff(gone[0]); return; }
    togglePermits(next);
  };
  /** Add time: a permit's card says the time the family already uses of it, which the part leaves out (ruling 7). */
  const usedLine = (permitId: string) => {
    const use = partOf ? familyUse(permitId) : null;
    if (!use || !partOf) return null;
    const uses = use.rows.map(r => `${joinWithAnd(r.weekdays.map(d => WEEKDAY_OPTIONS.find(o => o.id === String(d))?.label ?? ''))}, ${formatTimeRange(r.startTime, r.endTime)}`).join('; ');
    return PART_WORDS.permitUsed(partOf.schedule.name, uses, formatStoredDate(use.until, { withYear: false }));
  };
  /** Add time's From and To hints (tab 3, note 3). */
  const partFromHint = partOf ? (draft.permitIds.some(id => { const u = familyUse(id); return !!u && draft.startsOn === addCalendarDays(u.until, 1); })
    ? PART_WORDS.fromAfterUse(partOf.schedule.name) : PART_WORDS.fromToday(partOf.schedule.name)) : null;
  const remaining = draft.permitIds.length === 1 ? permitById.get(draft.permitIds[0]) : undefined;
  const partToHint = !partOf || !isCalendarDate(draft.endsOn) ? null
    : familyEnds && draft.endsOn > familyEnds ? PART_WORDS.toWidens(partOf.schedule.name, formatStoredDate(draft.endsOn, { withYear: false }))
      : remaining ? PART_WORDS.toPermit(remaining.name, scheduleDates(remaining.startsOn, remaining.endsOn)) : null;
  /** Under To, typed past the one permit's last day (Ask 6 A): its time stops there. It never meets "Widened…", which
   *  shows only while To is not typed. */
  const onePermit = !partOf && permitOrder.length === 1 ? permitById.get(permitOrder[0]) : undefined;
  const stopsHint = onePermit && isCalendarDate(draft.endsOn) && draft.endsOn > onePermit.endsOn
    ? W.toStopsAt(onePermit.name, formatShortWeekdayDate(onePermit.endsOn)) : null;
  /** Under From, typed before the one permit's first day: the same rule from the other end (/review 2026-11-25). */
  const startsHint = onePermit && isCalendarDate(draft.startsOn) && draft.startsOn < onePermit.startsOn
    ? W.fromStartsAt(onePermit.name, formatShortWeekdayDate(onePermit.startsOn)) : null;
  /** Under To: the dates the permits set ("Widened to cover both permits"), or where they went back to. */
  const datesHint = stopsHint ?? (draft.datesTyped.end ? null
    : draft.permitIds.length > 1 ? W.datesWidened(draft.permitIds.length)
      : cameOff && remaining ? W.datesBackTo(remaining.name) : null);
  /**
   * A row's Facilities list (pick-fields drawing, Asks 1–2 A): a permit row offers the fields its permit holds at the
   * row's venue, a typed row every field there. Nothing ticked means all of them (the shipped list's model), so the row
   * keeps listing its facilities as before and the list shows none ticked when it holds every one. A field the row names
   * that its permit no longer holds stays an option, so it can be unticked rather than refused unseen.
   */
  const rowPlaceOf = (r: HoursRow) => {
    const venueId = r.place?.venueId ?? draft.venueId;
    const v = places.find(x => x.venueId === venueId);
    const ids = r.place?.facilityIds ?? draft.facilityIds;
    // A permit read holds only its own fields here (none, at a venue it has no time at); a permit not read, every one.
    const byVenue = r.permitId ? permitHeld.get(r.permitId) : undefined;
    const units = byVenue ? byVenue.get(venueId) ?? [] : undefined;
    const every = (v?.facilities ?? []).filter(f => !units || units.includes(f.id));
    const options = (v?.facilities ?? []).filter(f => every.includes(f) || ids.includes(f.id)).map(f => ({ id: f.id, label: f.name }));
    const all = every.length > 0 && every.length === ids.length && every.every(f => ids.includes(f.id));
    return {
      venueId, venueName: v?.venueName ?? '', options, selected: all ? [] : ids.filter(id => options.some(o => o.id === id)),
      everyIds: every.map(f => f.id), everyWords: facilityListWords(every.map(f => f.name)),
    };
  };
  /** Ask 3 A: the fields a permit's card leaves off, said under its name — whole fields, never hours. */
  const leftLine = (permitId: string, rows: readonly HoursRow[]) => {
    const held = permitHeld.get(permitId);
    const left = fieldsLeftOff(held, rows.map(r => ({ venueId: r.place?.venueId ?? draft.venueId, facilityIds: r.place?.facilityIds ?? draft.facilityIds })));
    if (!left.length) return null;
    const words = partOf ? PART_WORDS.notOnAddedTime : W.notOnSchedule;
    return left.map(l => {
      const v = places.find(x => x.venueId === l.venueId);
      const names = l.facilityIds.map(id => v?.facilities.find(f => f.id === id)?.name ?? '').filter(Boolean);
      return names.length ? words(facilityListWords(names), names.length > 1, (held?.size ?? 0) > 1 ? v?.venueName ?? null : null) : '';
    }).filter(Boolean).join(' ') || null;
  };
  /** Ask 4 A: a permit card's own "Add hours" — a row on that permit, priced by it, after the card's last row: the fields
   *  the card's other rows don't use there (all of them when none is left), and the last row's days and hours. */
  const addPermitRow = (permitId: string, rows: readonly HoursRow[]) => {
    const last = rows[rows.length - 1];
    if (!last) return;
    const p = permitById.get(permitId);
    const venueId = last.place?.venueId ?? draft.venueId;
    const held = (permitHeld.get(permitId)?.get(venueId) ?? []).filter((u): u is string => !!u);
    const used = new Set(rows.filter(r => (r.place?.venueId ?? draft.venueId) === venueId).flatMap(r => r.place?.facilityIds ?? draft.facilityIds));
    const free = held.filter(f => !used.has(f));
    const row: HoursRow = {
      key: newKey('row'), weekdays: [...last.weekdays], start: last.start, end: last.end,
      place: { venueId, facilityIds: free.length ? free : held.length ? held : [...(last.place?.facilityIds ?? [])] }, permitId,
      ...(last.permitDates ? { permitDates: { ...last.permitDates } } : p ? { permitDates: { fromDate: p.startsOn, untilDate: p.endsOn } } : {}),
      ...(last.dates ? { dates: { ...last.dates } } : {}),
    };
    setDraft(d => {
      const at = d.rows.findIndex(r => r.key === last.key) + 1 || d.rows.length;
      return { ...d, rows: [...d.rows.slice(0, at), row, ...d.rows.slice(at)] };
    });
  };
  /** A found row's draft-held days, one line per facility (P7b A): "4 Thursdays on Diamond B are held by the draft …". */
  const foundDraftNotes = (r: HoursRow): string[] => {
    if (!r.found?.draftDays.length) return [];
    const v = places.find(x => x.venueId === r.place?.venueId);
    const byFacility = new Map<string | null, string[]>();
    for (const d of r.found.draftDays) byFacility.set(d.facilityId, [...(byFacility.get(d.facilityId) ?? []), d.day]);
    return [...byFacility].map(([fid, days]) => W.foundDraftNote(draftDaysSaid(days), days.length > 1,
      (fid ? v?.facilities.find(f => f.id === fid)?.name : v?.venueName) ?? '', r.found!.draftBy));
  };
  const cardGroups = cards ? [
    ...permitOrder.map(id => {
      const x = permitById.get(id);
      const rows = draft.rows.filter(r => r.permitId === id);
      return { key: id, title: x?.name ?? W.typedCard, sub: x ? W.permitCard(x.issuer, scheduleDates(x.startsOn, x.endsOn)) : null, rows, left: leftLine(id, rows) };
    }),
    { key: '__typed', title: copiedFrom ? W.copiedCard(copiedFrom) : W.typedCard, sub: null, rows: draft.rows.filter(r => !r.permitId), left: null as string | null },
  ].filter(g => g.rows.length) : [];
  const rowFields = (r: HoursRow, withPlace: boolean) => {
    const i = draft.rows.indexOf(r);
    const at = withPlace ? rowPlaceOf(r) : null;
    const notes = withPlace ? foundDraftNotes(r) : [];
    return (
      <div key={r.key} className={`${sch.dayRow}${withPlace ? ` ${sch.placeRow}` : ''}`}>
        {at && (at.options.length ? (
          <PickField id={`ns-fac-${i}`} label={W.facilities} labelAside={at.venueName} options={at.options} selected={at.selected}
            everyLabel={r.permitId ? W.everyFacilityOnPermit : W.everyFacility} everyValue={at.everyWords}
            onChange={ids => {
              const order = at.options.map(o => o.id);
              setRow(r.key, { place: { venueId: at.venueId, facilityIds: ids.length ? order.filter(id => ids.includes(id)) : at.everyIds.length ? at.everyIds : order } });
            }} />
        ) : (
          // A venue with no facilities listed: nothing to tick, so its name, as before.
          <span className={sch.rowPlace}>{at.venueName}</span>
        ))}
        <PickField id={`ns-days-${i}`} label={W.days} required options={WEEKDAY_OPTIONS} selected={r.weekdays.map(String)}
          onChange={ids => setRow(r.key, { weekdays: ids.map(Number).sort((a, b) => a - b) })} placeholder={W.chooseDays} />
        <label className={ck.field} htmlFor={`ns-rs-${i}`}>
          <span className={ck.label}>{W.from}<span className={repKit.req} aria-hidden>*</span></span>
          <TimeInput id={`ns-rs-${i}`} step={300} className={ck.input} value={r.start} onChange={v => setRow(r.key, { start: v })} />
        </label>
        <label className={ck.field} htmlFor={`ns-re-${i}`}>
          <span className={ck.label}>{W.until}<span className={repKit.req} aria-hidden>*</span></span>
          <TimeInput id={`ns-re-${i}`} step={300} className={ck.input} value={r.end} onChange={v => setRow(r.key, { end: v })} />
        </label>
        <button type="button" className={sch.remove} aria-label={W.removeHours(i + 1)} disabled={draft.rows.length === 1}
          onClick={() => dropFrom('rows', r.key)}>
          <X size={15} aria-hidden />
        </button>
        {/* Find the time's draft-held days (P7b A): a line under the row, so its fields stay level. */}
        {notes.length > 0 && <p className={sch.rowNotes}>{notes.map(n => <span key={n} className={sch.foundNote}>{n}</span>)}</p>}
      </div>
    );
  };
  // A row added here is typed time (no permit) at the last row's place, its hours copied (drawing note: "a row typed here").
  const lastRow = draft.rows[draft.rows.length - 1];
  const addHoursDoor = (
    <button type="button" className={sch.door} onClick={() => set({ rows: [...draft.rows, {
      key: newKey('row'), weekdays: [], start: lastRow?.start ?? '', end: lastRow?.end ?? '',
      ...(cards && lastRow ? { place: lastRow.place ? { venueId: lastRow.place.venueId, facilityIds: [...lastRow.place.facilityIds] } : { venueId: draft.venueId, facilityIds: [...draft.facilityIds] } } : {}),
    }] })}>
      {/* Ask 4 A: beside the cards' own doors, this one says it is time with no permit. */}
      <Plus size={14} aria-hidden />{cards && permitOrder.length ? W.addHoursNoPermit : W.addHours}
    </button>
  );
  const datesPair = (
    <div className={sch.pair}>
      <label className={ck.field} htmlFor="ns-start">
        <span className={ck.label}>{W.from}<span className={repKit.req} aria-hidden>*</span></span>
        <DateInput id="ns-start" className={ck.input} value={draft.startsOn} min={partOf ? tournamentToday() : undefined}
          onChange={v => set({ startsOn: v, datesTyped: { ...draft.datesTyped, start: true } })} />
        {(partFromHint ?? startsHint) && <span className={ck.hint}>{partFromHint ?? startsHint}</span>}
      </label>
      <label className={ck.field} htmlFor="ns-end">
        <span className={ck.label}>{W.to}<span className={repKit.req} aria-hidden>*</span></span>
        <DateInput id="ns-end" className={ck.input} value={draft.endsOn} min={draft.startsOn || undefined} rangeStart={draft.startsOn || undefined}
          onChange={v => set({ endsOn: v, datesTyped: { ...draft.datesTyped, end: true } })} />
        {(partOf ? partToHint : datesHint) && <span className={ck.hint}>{partOf ? partToHint : datesHint}</span>}
      </label>
    </div>
  );

  /** Two permits on one evening: the evenings stay on the permit that has them (P4 A; Add time's statement, tab 3). */
  const overlapStatements = settled.overlaps.map(o => {
    const days = o.days.map(d => formatShortWeekdayDate(d));
    const shown = days.length > 4 ? days.slice(0, 3) : days;
    return (
      <Statement key={`${o.permitId}|${o.keptBy}|${o.venueId}`}
        lead={W.overlapLead(W.overlapDays(shown, days.length - shown.length), days.length > 1, placeName(places, o.venueId, null), permitById.get(o.keptBy)?.name ?? '')}
        rest={W.overlapTail(o.startsOn ? formatShortWeekdayDate(o.startsOn) : null)} />
    );
  });
  const timeSection = (
    <section className={sch.section} aria-labelledby="ns-time">
      <h3 id="ns-time" className={sch.sectionTitle}>{W.sectionTime}</h3>
      <div className={sch.pair}>
        {partOf ? (
          // A part has no name to type: it is the date it was added (ruling 1; tab 3, note 2).
          <label className={ck.field} htmlFor="ns-name">
            <span className={ck.label}>{PART_WORDS.shownAs}</span>
            <input id="ns-name" className={ck.input} readOnly disabled value={partLabel} />
            <span className={ck.hint}>{PART_WORDS.shownAsHint(partOf.schedule.name)}</span>
          </label>
        ) : (
          <label className={ck.field} htmlFor="ns-name">
            <span className={ck.label}>{W.name}<span className={repKit.req} aria-hidden>*</span></span>
            <input id="ns-name" className={ck.input} value={draft.name} maxLength={120} placeholder={W.namePlaceholder} onChange={e => set({ name: e.target.value })} />
          </label>
        )}
        {showPicker && (
          <div>
            <PickField id="ns-permits" label={W.permits} options={permitOptions} selected={draft.permitIds} onChange={onPermits} placeholder={W.noPermitTyped} />
            <span className={ck.hint}>{permitsHint}</span>
            {/* N1 A: a door under the picker, never an entry in the tick list (a list of choices holding an action reads as one more permit). */}
            {permitOptions.length > 0 && (
              <button type="button" className={`${sch.door} ${sch.findDoor}`} onClick={openFinder}>
                <Search size={15} aria-hidden />{W.findDoor} ›
              </button>
            )}
          </div>
        )}
      </div>
      {overlapStatements}
      {cards ? (
        <>
          <div className={sch.permitCards}>
            {cardGroups.map(g => (
              <div key={g.key} className={sch.permitCard}>
                <p className={sch.permitCardHead}>
                  <strong>{g.title}</strong>{g.sub && <span>{g.sub}</span>}
                  {editing && g.key !== '__typed' && canTakeOff(g.key) && (
                    <button type="button" className={`${sch.door} ${sch.cardDoor}`} aria-label={W.takeOffLabel(g.title)} onClick={() => setTakingOff(g.key)}>{W.takeOffDoor}</button>
                  )}
                </p>
                {g.key !== '__typed' && usedLine(g.key) && <p className={ck.hint}>{usedLine(g.key)}</p>}
                {g.left && <p className={`${ck.hint} ${sch.cardLine}`}>{g.left}</p>}
                {g.rows.map(r => rowFields(r, true))}
                {g.key !== '__typed' && permitById.has(g.key) && (
                  <button type="button" className={`${sch.door} ${sch.rowDoor}`} aria-label={W.addHoursOn(g.title)} onClick={() => addPermitRow(g.key, g.rows)}>
                    <Plus size={14} aria-hidden />{W.addHours}
                  </button>
                )}
              </div>
            ))}
          </div>
          {addHoursDoor}
          {datesPair}
        </>
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
          {datesPair}
          {draft.rows.map(r => rowFields(r, false))}
          {addHoursDoor}
        </>
      )}
      <div className={sch.pair}>
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
      </div>
      <div className={ck.field}>
        <span className={ck.label}>{W.datesOff}</span>
        {partOf && <span className={ck.hint}>{PART_WORDS.datesOffOwn}</span>}
        {draft.datesOff.map((o, i) => (
          <div key={o.key} className={showApplies ? `${own.offRow} ${sch.offRowParks}` : own.offRow}>
            <label className={ck.field} htmlFor={`ns-off-${i}`}>
              <span className={repKit.srOnly}>{W.datesOff} {i + 1}</span>
              <DateInput id={`ns-off-${i}`} className={ck.input} value={o.day} min={draft.startsOn || undefined} max={draft.endsOn || undefined}
                onChange={v => patchIn('datesOff', o.key, { day: v })} />
            </label>
            <label className={ck.field} htmlFor={`ns-offn-${i}`}>
              <span className={repKit.srOnly}>{W.dateOffWhy}</span>
              <input id={`ns-offn-${i}`} className={ck.input} value={o.note} maxLength={120} placeholder={W.dateOffWhy}
                onChange={e => patchIn('datesOff', o.key, { note: e.target.value })} />
            </label>
            {showApplies && (
              <PickField id={`ns-offv-${i}`} label={W.dateOffAppliesTo} inlineLabel options={parkOptions} everyLabel={W.allVenues}
                selected={dateOffVenues(o, offParks)} onChange={next => patchIn('datesOff', o.key, { venueIds: next })} />
            )}
            <button type="button" className={sch.remove} aria-label={W.removeDateOff(o.day ? formatShortWeekdayDate(o.day) : String(i + 1))}
              onClick={() => dropFrom('datesOff', o.key)}>
              <X size={15} aria-hidden />
            </button>
            {o.permitId && permitById.has(o.permitId) && <span className={`${ck.hint} ${sch.offFrom}`}>{W.dateOffFrom(permitById.get(o.permitId)!.name)}</span>}
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
    `${possessive(t.name)} ${draft.method === 'percentage' ? 'share' : 'slots a week'}`, text => setTeamValue(t, text), unit));
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
  // ⚖ 13c Session C (C5 = A): while the per-day setting is what leaves slots open, Slots reads what each team can get at it
  // OF its share ("25 of 65", groups "75 of 193", the total "175 of 450") — the share stays in sight, so changing the
  // setting reads as getting it back. No daily limit, or one that limits nothing: the plain share, as before.
  const dayLimit = shown?.dayLimit ?? null;
  const canGetOf = (teamId: string) => targetById.get(teamId)?.canGet ?? null;
  const limitedWords = (got: number | null, share: number | null) => (share == null ? '—' : dayLimit && got != null ? W.ofSlots(got, share) : String(share));
  const rows: FormTableRow[] = running.map(t => {
    const isIn = tickedSet.has(t.id);
    const slots = isIn ? targetOf(t.id) : null;
    // House league's row says who divides it (k1), where a team's says its season.
    const season = isProgramHolder(t.id) ? (wholeHouseLeague ? W.houseLeagueWhole : W.houseLeagueShare) : t.season!.name;
    // Add time lists every running team, one the schedule doesn't have too (ruling 6; tab 3, note 5).
    const note = partOf && !isProgramHolder(t.id) && !partOf.schedule.settings.teamIds.includes(t.id)
      ? `${season} · ${PART_WORDS.teamNotOnParent(partOf.schedule.name)}` : season;
    return {
      key: t.id, name: t.name, group: groupKeys.length ? groupKeyOf(t) : undefined, nameNote: note,
      ticked: isIn, tickLabel: W.tick(t.name), onTick: next => tickTo(next ? [...draft.ticked, t.id] : draft.ticked.filter(x => x !== t.id)),
      cells: { figure: isIn && !wholeHouseLeague ? figureCell(t) : '', slots: isIn ? limitedWords(canGetOf(t.id), slots) : '' },
      phoneLine: note,
      phoneFigure: isIn ? (draft.method === 'even' ? limitedWords(canGetOf(t.id), slots) : figureCell(t)) : undefined,
    };
  });
  const groups: FormTableGroup[] = groupKeys.map(key => {
    const members = membersOf(key);
    const on = members.filter(t => tickedSet.has(t.id));
    const slots = on.length && shown ? on.reduce((s, t) => s + (targetOf(t.id) ?? 0), 0) : null;
    const got = on.length && dayLimit ? on.reduce((s, t) => s + (canGetOf(t.id) ?? targetOf(t.id) ?? 0), 0) : null;
    return {
      key, label: groupLabel(key), count: W.teamsCount(members.length),
      state: on.length === 0 ? 'none' : on.length === members.length ? 'all' : 'some',
      onTick: next => tickTo(next ? [...new Set([...draft.ticked, ...members.map(m => m.id)])] : draft.ticked.filter(x => !members.some(m => m.id === x))),
      tickLabel: W.tickGroup(groupLabel(key)),
      cells: { figure: groupFigureCell(key), slots: on.length ? limitedWords(got, slots) : '' },
      phoneFigure: groupFigureCell(key) || undefined,
    };
  });
  const weeklySum = draft.method === 'weekly' ? inOrder.reduce((s, t) => s + (wholeWeekly(draft.values[t.id]) ?? 0), 0) : 0;

  // ── Every rule as its sentence (Stage 11c Ask 6): the folded line, each rule's row, the closing row's reason ──
  const teamName = (id: string) => (inputs?.teams ?? []).find(t => t.id === id)?.name ?? '';
  const groupName = (id: string) => (inputs?.groups ?? []).find(g => g.id === id)?.name ?? '';
  const facilityNames = (ids: readonly string[]) => facilityListWords(places.flatMap(p => p.facilities).filter(x => ids.includes(x.id)).map(x => x.name));
  const whoWords = (who: readonly string[]) => [...groupsIn(who).map(groupName), ...teamsIn(who).map(teamName)].filter(Boolean).join(', ');
  const shareWho = (who: readonly string[]) => sharingWho({ teamIds: teamsIn(who), groupIds: groupsIn(who) }, teamName, groupName);
  const sentence = {
    windows: (w: WindowRule) => {
      const teams = w.teamIds.map(teamName).join(', ');
      return w.startAfter && w.finishBy ? W.startBetween(teams, formatTimeRange(w.startAfter, null), formatTimeRange(w.finishBy, null))
        : w.finishBy ? W.finishBy(teams, formatTimeRange(w.finishBy, null)) : W.startAfterWords(teams, formatTimeRange(w.startAfter, null));
    },
    daysOff: (d: DayOffRule) => (d.when === 'date' ? W.dayOffDate(teamName(d.teamId), formatShortWeekdayDate(d.date)) : W.dayOffWeekly(teamName(d.teamId), DAY_NAMES[Number(d.when)])),
    fieldsBy: (f: FieldsRule) => W.fieldsOnly(facilityNames(f.facilityIds), whoWords(f.who)),
    sharing: (r: ShareRule) => sharingSentence(shareWho(r.who), r.atOnce),
  };
  const weekCapWords = draft.maxPerWeek ? W.capWeek(Number(draft.maxPerWeek)) : null;
  type RuleKind = keyof typeof W.ruleKinds;
  /** An optional rule as its row: its name, whether it is whole, and its sentence. */
  type RuleRow = { key: string; words: string; whole: boolean; idle?: boolean } & (
    | { kind: 'fieldsBy'; row: FieldsRule } | { kind: 'sharing'; row: ShareRule } | { kind: 'windows'; row: WindowRule }
    | { kind: 'daysOff'; row: DayOffRule } | { kind: 'weekCap'; row: null });
  // The facility rules first, then sharing, the times, the days off and the optional weekly cap.
  const ruleRows: RuleRow[] = [
    ...draft.fieldsBy.map(row => ({ kind: 'fieldsBy' as const, row, key: row.key, whole: ruleIsWhole.fieldsBy(row), idle: !ruleApplies.fieldsBy(row, tickedSet), words: sentence.fieldsBy(row) })),
    ...draft.sharing.map(row => ({ kind: 'sharing' as const, row, key: row.key, whole: ruleIsWhole.sharing(row), idle: !ruleApplies.sharing(row, tickedSet), words: sentence.sharing(row) })),
    ...draft.windows.map(row => ({ kind: 'windows' as const, row, key: row.key, whole: ruleIsWhole.windows(row), idle: !ruleApplies.windows(row, tickedSet), words: ruleIsWhole.windows(row) ? sentence.windows(row) : '' })),
    ...draft.daysOff.map(row => ({ kind: 'daysOff' as const, row, key: row.key, whole: ruleIsWhole.daysOff(row), idle: !ruleApplies.daysOff(row, tickedSet), words: ruleIsWhole.daysOff(row) ? sentence.daysOff(row) : '' })),
    ...(weekCapWords || openRule === WEEK_CAP ? [{ kind: 'weekCap' as const, row: null, key: WEEK_CAP, whole: !!weekCapWords, words: weekCapWords ?? '' }] : []),
  ];
  // A rule opened and left half-filled isn't sent, and holds Generate until it is whole or removed.
  const unfinishedRule = ruleRows.some(r => !r.whole);
  const settingsNow = settingsBody(false);
  const onCount = rulesOn(settingsNow.rules);
  const foldedWords = [
    ...ruleRows.filter(r => r.whole && !r.idle).map(r => r.words),
    ...(draft.avoidGameDays ? [W.avoidGameDays] : []),
    ...(draft.avoidBookings ? [W.avoidBookings] : []),
    ...(draft.noBackToBack ? [W.noBackToBack] : []),
  ];
  // Why sharing leaves slots open (the closing row): "9U AA and 11U AA share a facility".
  const sharingWhy = settingsNow.rules.sharing.length
    ? settingsNow.rules.sharing.map(r => sharingSentence(sharingWho(r, teamName, groupName), null)).join('; ') : null;
  const note = shown ? closingNote({ summary: shown, method: draft.method, percentHundredths, sharing: sharingWhy }) : percentHundredths > 10000
    ? { words: `${(percentHundredths - 10000) / 100}% over`, over: true } : null;
  const practicesShown = shown ? shown.targets.reduce((n, t) => n + t.slots, 0) : null;
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
      <button type="button" className={ck.link} onClick={() => tickTo((runningTeams.length ? runningTeams : running).map(t => t.id))}>{W.all}</button>
      <span aria-hidden>·</span>
      <button type="button" className={ck.link} onClick={() => tickTo([])}>{W.none}</button>
    </span>
  );
  const clockSelect = (id: string, label: string, value: string, onChange: (v: string) => void) => (
    <label className={ck.field} htmlFor={id}>
      <span className={ck.label}>{label}</span>
      <TimeInput id={id} step={300} className={ck.input} value={value} onChange={v => onChange(v)} />
    </label>
  );
  const whoSection = (
    <section className={sch.section} aria-labelledby="ns-who">
      <div className={sch.sectionHead}>
        <h3 id="ns-who" className={sch.sectionTitle}>{W.sectionWho}</h3>
      </div>
      {/* Split the time beside Each team's time: both say how the time is handed out (Stage 11c Ask 4). All of it to house
          league has no split, no daily limit and no prime time: absent, not explained (Stage 11b, k1). */}
      {!wholeHouseLeague && (<>
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
        <label className={ck.field} htmlFor="ns-time-mode">
          <span className={ck.label}>{W.timeMode}</span>
          <select id="ns-time-mode" className={ck.select} value={draft.timeMode} onChange={e => set({ timeMode: e.target.value as Draft['timeMode'] })}
            aria-describedby="ns-time-mode-hint">
            <option value="same">{W.timeSame}</option>
            <option value="moved">{W.timeMoved}</option>
          </select>
          <span id="ns-time-mode-hint" className={ck.hint}>{draft.timeMode === 'moved' ? W.timeMovedHint : W.timeSameHint}</span>
        </label>
      </div>
      <div className={sch.dailyPracticeLimit}>
        <label className={ck.field} htmlFor="ns-max-per-day">
          <span className={ck.label}>{W.practicesPerDay}</span>
          <select id="ns-max-per-day" className={ck.select} value={draft.maxPerDay} onChange={e => set({ maxPerDay: e.target.value })}
            aria-describedby="ns-max-per-day-hint">
            {(draft.maxPerDay ? withCurrent([1, 2, 3, 4], Number(draft.maxPerDay)) : [1, 2, 3, 4])
              .map(n => <option key={n} value={String(n)}>{W.practicesPerDayChoice(n)}</option>)}
            <option value="">{W.practicesPerDayNoLimit}</option>
          </select>
          {/* Stage 13 fix-now 3 (owner 2026-11-06): the setting says what it leaves open, beside itself. */}
          <span id="ns-max-per-day-hint" className={ck.hint}>
            {shown?.dayLimit
              ? `${W.practicesPerDayWhy} ${W.practicesPerDayCanUse(shown.dayLimit.perDay, shown.targets.length, shown.dayLimit.canUse, shown.seats)}`
              : W.practicesPerDayHint}
          </span>
        </label>
      </div>
      </>)}
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
              slots: limitedWords(dayLimit?.canUse ?? null, practicesShown),
            },
            phone: `${W.teamsCount(inOrder.length)}${practicesShown != null ? ` · ${dayLimit ? `${W.ofSlots(dayLimit.canUse, practicesShown)} slots` : pluralize(practicesShown, 'slot')}` : ''}`,
            note: note?.words, noteBad: note?.over, noteRow: true,
          }}
        />
      )}
      {wholeHouseLeague && <p className={sch.quiet}>{W.houseLeagueWholeHint}</p>}
      {houseLeagueShare && <p className={sch.quiet}>{W.houseLeagueShareHint}</p>}
      {partOf && <p className={sch.quiet}>{PART_WORDS.teamsHint}</p>}
      {draft.method === 'percentage' && !wholeHouseLeague && <p className={sch.quiet}>{W.everyWeek}</p>}
      {noSeason.length > 0 && (
        <div className={mk.noSeason}>
          <button type="button" className={mk.noSeasonToggle} aria-expanded={noSeasonOpen} onClick={() => setNoSeasonOpen(o => !o)}>
            <ChevronDown size={15} aria-hidden className={noSeasonOpen ? mk.noSeasonOpen : undefined} />{W.noSeason(noSeason.length)}
          </button>
          {noSeasonOpen && <ul className={mk.noSeasonList}>{noSeason.map(t => <li key={t.id}><b>{t.name}</b></li>)}</ul>}
        </div>
      )}
      {/* Prime time, whole (Stage 11c Ask 5): its hours, and how it is shared beside them where that applies. Each team's
          time answers whether a team keeps its prime-time slot or moves — no Keep / Rotate of its own. */}
      {!wholeHouseLeague && (<>
      <div className={`${sch.pair} ${sch.primePair}`}>
        <label className={ck.field} htmlFor="ns-prime">
          <span className={ck.label}>{W.prime}</span>
          <select id="ns-prime" className={ck.select} value={draft.primeDays} onChange={e => set({ primeDays: e.target.value })} aria-describedby="ns-prime-hint">
            <option value="none">{W.primeNone}</option>
            {PRIME_DAYS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <span id="ns-prime-hint" className={ck.hint}>{W.primeHint}</span>
        </label>
        {draft.method === 'percentage' && draft.primeDays !== 'none' ? (
          <label className={ck.field} htmlFor="ns-pshare">
            <span className={ck.label}>{W.primeShare}</span>
            <select id="ns-pshare" className={ck.select} value={draft.primeShare} onChange={e => set({ primeShare: e.target.value as 'same' | 'even' })}
              aria-describedby="ns-pshare-hint">
              <option value="same">{W.primeSame}</option>
              <option value="even">{W.primeEven}</option>
            </select>
            <span id="ns-pshare-hint" className={ck.hint}>
              {draft.primeShare === 'even' ? W.primeEvenHint : groupPercent ? W.primeSameHint(groupPercent.group, groupPercent.percent) : W.primeSameHintPlain}
            </span>
          </label>
        ) : <span />}
      </div>
      {draft.primeDays !== 'none' && (
        <div className={sch.pair}>
          {clockSelect('ns-ps', W.from, draft.primeStart, v => set({ primeStart: v }))}
          {clockSelect('ns-pe', W.until, draft.primeEnd, v => set({ primeEnd: v }))}
        </div>
      )}
      </>)}
    </section>
  );

  // ── Rules: only the rules the club added, each its sentence; a rule opens in place; one Add a rule ──
  const teamOptions = runningTeams.map(t => ({ id: t.id, label: t.name }));
  const allFacilities = places.filter(p => p.venueId === draft.venueId || draft.rows.some(r => r.place?.venueId === p.venueId))
    .flatMap(p => p.facilities.map(f => ({ id: f.id, label: f.name })));
  const whoOptions = [
    ...(inputs?.groups ?? []).filter(g => running.some(t => t.groupId === g.id)).map(g => ({ id: `g:${g.id}`, label: g.name })),
    ...runningTeams.map(t => ({ id: `t:${t.id}`, label: t.name })),
  ];
  const halfNames = shown?.half.length ? facilityNames(shown.half) : null;
  const addRule = (kind: RuleKind) => {
    setAdding(false);
    if (kind === 'weekCap') { setOpenRule(WEEK_CAP); return; }
    const key = newKey(kind);
    if (kind === 'windows') set({ windows: [...draft.windows, { key, teamIds: [], startAfter: '', finishBy: '' }] });
    if (kind === 'daysOff') set({ daysOff: [...draft.daysOff, { key, teamId: '', when: 'date', date: '', note: '' }] });
    if (kind === 'fieldsBy') set({ fieldsBy: [...draft.fieldsBy, { key, facilityIds: [], who: [] }] });
    if (kind === 'sharing') set({ sharing: [...draft.sharing, { key, who: [], atOnce: 2 }] });
    setOpenRule(key);
  };
  const removeRule = (r: RuleRow) => {
    if (r.kind === 'weekCap') set({ maxPerWeek: '' });
    else dropFrom(r.kind, r.key);
    setOpenRule(null);
  };
  /** One rule's fields, opened where its sentence was. */
  const ruleFields = (r: RuleRow): ReactNode => {
    const id = (part: string) => `ns-${r.key}-${part}`;
    if (r.kind === 'windows') {
      const w = r.row;
      return (
        <div className={sch.ruleFields}>
          <PickField id={id('teams')} label={W.ruleTeams} required options={teamOptions} selected={w.teamIds} placeholder={W.chooseTeams}
            onChange={ids => patchIn('windows', w.key, { teamIds: ids })} />
          {clockSelect(id('after'), W.ruleStartAfter, w.startAfter, v => patchIn('windows', w.key, { startAfter: v }))}
          {clockSelect(id('by'), W.ruleFinishBy, w.finishBy, v => patchIn('windows', w.key, { finishBy: v }))}
        </div>
      );
    }
    if (r.kind === 'daysOff') {
      const d = r.row;
      return (
        <div className={sch.ruleFields}>
          <label className={ck.field} htmlFor={id('team')}>
            <span className={ck.label}>{W.ruleTeam}<span className={repKit.req} aria-hidden>*</span></span>
            <select id={id('team')} className={ck.select} value={d.teamId} onChange={e => patchIn('daysOff', d.key, { teamId: e.target.value })}>
              <option value="">{W.chooseTeam}</option>
              {runningTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <label className={ck.field} htmlFor={id('when')}>
            <span className={ck.label}>{W.ruleOff}</span>
            <select id={id('when')} className={ck.select} value={d.when} onChange={e => patchIn('daysOff', d.key, { when: e.target.value })}>
              <option value="date">{W.aDate}</option>
              {[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n} value={String(n)}>{W.every(DAY_NAMES[n])}</option>)}
            </select>
          </label>
          {d.when === 'date' && (
            <label className={ck.field} htmlFor={id('date')}>
              <span className={ck.label}>{W.aDate}<span className={repKit.req} aria-hidden>*</span></span>
              <DateInput id={id('date')} className={ck.input} value={d.date} min={draft.startsOn || undefined} max={draft.endsOn || undefined}
                onChange={v => patchIn('daysOff', d.key, { date: v })} />
            </label>
          )}
          <label className={ck.field} htmlFor={id('note')}>
            <span className={ck.label}>{W.ruleNote}</span>
            <input id={id('note')} className={ck.input} value={d.note} maxLength={120} onChange={e => patchIn('daysOff', d.key, { note: e.target.value })} />
          </label>
        </div>
      );
    }
    if (r.kind === 'fieldsBy') {
      const f = r.row;
      return (
        <div className={sch.ruleFields}>
          <PickField id={id('facilities')} label={W.fieldsFacilities} required options={allFacilities} selected={f.facilityIds} placeholder={W.chooseVenue}
            onChange={ids => patchIn('fieldsBy', f.key, { facilityIds: ids })} />
          <PickField id={id('who')} label={W.fieldsOnlyFor} required options={whoOptions} selected={f.who} placeholder={W.chooseWho}
            onChange={ids => patchIn('fieldsBy', f.key, { who: ids })} />
        </div>
      );
    }
    if (r.kind === 'sharing') {
      const sr = r.row;
      return (
        <>
          <div className={sch.ruleFields}>
            <PickField id={id('who')} label={W.ruleTeams} required options={whoOptions} selected={sr.who} placeholder={W.chooseTeams}
              onChange={ids => patchIn('sharing', sr.key, { who: ids })} />
            <label className={ck.field} htmlFor={id('at-once')}>
              <span className={ck.label}>{W.sharingAtOnce}</span>
              <select id={id('at-once')} className={ck.select} value={sr.atOnce} onChange={e => patchIn('sharing', sr.key, { atOnce: Number(e.target.value) })}>
                {[2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>
          <p className={sch.ruleHint}>{W.sharingHint}{halfNames ? ` ${W.sharingHalf(halfNames, (shown?.half.length ?? 0) > 1)}` : ''}</p>
        </>
      );
    }
    return (
      <div className={sch.ruleFields}>
        <label className={ck.field} htmlFor={id('week')}>
          <span className={ck.label}>{W.maxWeek}</span>
          <select id={id('week')} className={ck.select} value={draft.maxPerWeek} onChange={e => set({ maxPerWeek: e.target.value })}>
            <option value="">{W.noCap}</option>
            {Array.from({ length: 7 }, (_, i) => i + 1).map(n => <option key={n} value={String(n)}>{W.capWords(n)}</option>)}
          </select>
        </label>
      </div>
    );
  };
  /** A rule: its sentence and a pencil; opened, its fields where the sentence was, ✓ in the pencil's spot, and Remove
   *  this rule — ink, nothing is saved until Generate drafts (/design D2) — at its end (the rare door, 2026-10-09). */
  const ruleRow = (r: RuleRow) => {
    const title = W.ruleKinds[r.kind].title;
    if (openRule !== r.key) {
      const said = !r.whole ? `${title}: ${W.ruleUnfinished}` : r.idle ? `${r.words} · ${W.ruleIdle}` : r.words;
      return (
        <div key={r.key} className={sch.ruleLine}>
          <span className={!r.whole ? sch.ruleUnfinished : r.idle ? sch.ruleIdle : sch.ruleSentence}>{said}</span>
          <button type="button" className={sch.rulePencil} aria-label={W.editRule(said)} onClick={() => setOpenRule(r.key)}>
            <Pencil size={15} aria-hidden />
          </button>
        </div>
      );
    }
    return (
      <div key={r.key} className={sch.ruleOpen} role="group" aria-labelledby={`ns-${r.key}-title`}>
        <div className={sch.ruleLine}>
          <span id={`ns-${r.key}-title`} className={sch.ruleTitle}>{title}</span>
          <button type="button" className={sch.rulePencil} aria-label={W.ruleDone} onClick={() => setOpenRule(null)}>
            <Check size={16} aria-hidden />
          </button>
        </div>
        {ruleFields(r)}
        <div className={sch.ruleEnd}>
          <RecordAction icon={<Trash2 size={13} aria-hidden />} onClick={() => removeRule(r)}>{W.removeRule}</RecordAction>
        </div>
      </div>
    );
  };
  const rulesSection = (
    <section className={sch.section} aria-labelledby="ns-rules">
      <button type="button" className={sch.fold} aria-expanded={rulesOpen} onClick={() => setRulesOpen(o => !o)}>
        <span id="ns-rules" className={sch.sectionTitle}>{W.sectionRules}</span>
        <span className={sch.foldCount}>{W.rulesOn(onCount)}</span>
        <ChevronDown size={16} aria-hidden className={rulesOpen ? sch.foldOpen : undefined} />
      </button>
      {!rulesOpen ? (
        foldedWords.length > 0 && <p className={sch.quiet}>{foldedWords.join(' · ')}</p>
      ) : (
        <div className={sch.rules}>
          {ruleRows.length > 0 && <div className={sch.ruleList}>{ruleRows.map(ruleRow)}</div>}
          {/* One door for every kind; its menu hangs over the window (a field's list hangs over its window) — no
              heading that repeats the button (/design D6). */}
          <div className={sch.addRule} ref={addRef} data-escape-owner={adding ? '' : undefined}>
            <button type="button" className={sch.door} aria-haspopup="menu" aria-expanded={adding} onClick={() => setAdding(o => !o)}>
              <Plus size={14} aria-hidden />{W.addRule}
            </button>
            {adding && (
              <div ref={addMenuRef} className={sch.addMenu} style={addMenuStyle} role="menu" aria-label={W.addRule}>
                {(Object.keys(W.ruleKinds) as RuleKind[]).map(k => (
                  <button key={k} type="button" role="menuitem" className={sch.menuItem} onClick={() => addRule(k)}>
                    {W.ruleKinds[k].title}<small>{W.ruleKinds[k].line}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
          <h4 className={sch.alwaysHead}>{W.always}</h4>
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
    // Moved around (Stage 11c Ask 5): how evenly early and late fell, and whether facilities were taken in turn.
    if (m.kind === 'early') return m.even ? 'good' : 'amber';
    if (m.kind === 'facilities') return m.turned ? 'good' : 'amber';
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
  /** A slot the draft leaves alone because a booking already holds it (drawn only while "Avoid bookings" is on). */
  const isBookedSlot = (s: DraftSlot) => !!s.heldBy && settingsNow.rules.avoidBookings && !(pick?.assignments[s.key] ?? []).length;
  const bookedCount = gen ? gen.slots.filter(isBookedSlot).length : 0;
  /** By day's days: the booked slots out until asked for, and a day with nothing left drops its heading too. */
  const shownDays = dayGroups.map(g => ({ day: g.day, list: g.list.filter(s => showBooked || !isBookedSlot(s)) })).filter(g => g.list.length);
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
  // ⚖ 13c Session C (hub tab 13, Change 3): the drafts' "7 teams short", with why and a door back — only while the draft
  // picked is short AND the per-day setting is what leaves the slots open (the count the setting's own hint reads).
  const pickShort = pick?.measures.find(m => m.kind === 'shares');
  const shortWhy = pick && gen?.summary.dayLimit && pickShort?.kind === 'shares' && pickShort.short.length
    ? W.draftsShortWhy(pickShort.short.length, pick.totals.handedOut, pick.totals.seats, gen.summary.dayLimit.perDay,
      venue?.venueName ?? W.thisPlace, gen.summary.perWeek, oneWeekday, gen.summary.targets.length)
    : null;
  const backToTheSetting = () => {
    setStep('settings');
    window.setTimeout(() => document.getElementById('ns-max-per-day')?.focus(), 0);
  };
  // ⚖ The other reasons a draft leaves time open (owner 2026-11-24, SCHEDULE_GAPS_DRAWINGS.html tab 3): a practices-a-week
  // (or -a-day) rule holds teams under their share, or a field kept for a group that already has its share. The cause only —
  // the card under it says who is short — with the door to that setting. Every draft shares the cause, so it sits above them.
  const gapTeams = (inputs?.teams ?? []).map(t => ({ id: t.id, name: t.name, groupId: t.groupId, groupName: inputs?.groups.find(g => g.id === t.groupId)?.name ?? null }));
  const gapSettings = pick && gen && !shortWhy && inputs ? settingsBody(false) : null;
  const pickGaps = pick && gen && gapSettings ? scheduleGaps({
    slots: gen.slots.map(x => ({ ...x, teamIds: pick.assignments[x.key] ?? [], locked: x.kept, movedByHand: false })),
    results: pick.teams, teams: gapTeams, rules: gapSettings.rules, split: gapSettings.split,
  }) : null;
  const gapReason = pickGaps?.groups.find(g => g.kind === 'cap' || g.kind === 'kept') ?? null;
  const gapWhy = gapReason && pickGaps ? {
    text: `${GAPS.head(gapReason, t => teamsWords(t, gapTeams))}. ${GAPS.explain(gapReason, pickGaps, t => teamSubject(t, gapTeams), ids => ids.map(id => places.flatMap(p => p.facilities).find(f => f.id === id)?.name ?? ''))}`,
    door: gapReason.kind === 'kept' ? GAPS.doorFieldRules : gapReason.cap === 'day' ? GAPS.doorPerDay : GAPS.doorPerWeek,
    go: () => {
      setStep('settings');
      if (gapReason.kind === 'cap' && gapReason.cap === 'day') { window.setTimeout(() => document.getElementById('ns-max-per-day')?.focus(), 0); return; }
      setRulesOpen(true);
      if (gapReason.kind === 'cap') setOpenRule(WEEK_CAP);
      window.setTimeout(() => {
        const el = document.getElementById(gapReason.kind === 'cap' ? `ns-${WEEK_CAP}-week` : 'ns-rules');
        el?.scrollIntoView({ block: 'center' });
        (el?.closest('button') ?? el)?.focus();
      }, 0);
    },
  } : null;
  /** P7b A: found days another schedule's draft holds, by place and day — each draft warns on the slots it gives there,
   *  like a clash (a draft is booked nowhere else, so this is the drafts step's only word of it). */
  const foundHeld = new Map<string, readonly string[]>();
  for (const r of draft.rows) {
    if (!r.found || !r.place) continue;
    for (const x of r.found.draftDays) foundHeld.set(`${r.place.venueId}|${x.facilityId ?? ''}|${x.day}`, r.found.draftBy);
  }
  const foundWarning = (d: DraftRead): string | null => {
    if (!foundHeld.size || !gen) return null;
    const by = new Set<string>();
    let slots = 0;
    for (const s of gen.slots) {
      const who = foundHeld.get(`${s.venueId}|${s.facilityId ?? ''}|${s.day}`);
      if (!who || !(d.assignments[s.key] ?? []).length) continue;
      slots++;
      for (const w of who) by.add(w);
    }
    return slots ? W.foundDraftWarning(slots, [...by]) : null;
  };
  /** Add time's step 2 (drawing frame "Drafts for the new time"): what the new time gives each team, from the draft picked. */
  const addDrafts = (() => {
    if (!partOf || !gen || !pick) return null;
    const fresh = gen.slots.filter(x => !x.kept);
    const byTeam = new Map<string, { n: number; minutes: number; venues: Set<string> }>();
    for (const x of fresh) {
      for (const t of pick.assignments[x.key] ?? []) {
        const was = byTeam.get(t) ?? { n: 0, minutes: 0, venues: new Set<string>() };
        was.n++; was.minutes += (Date.parse(x.endsAt) - Date.parse(x.startsAt)) / 60_000; was.venues.add(x.venueId);
        byTeam.set(t, was);
      }
    }
    const days = fresh.filter(x => (pick.assignments[x.key] ?? []).length).map(x => x.day).sort();
    const permits = [...new Set(settled.blocks.map(b => b.permitId).filter((x): x is string => !!x))].map(id => permitById.get(id)?.name ?? '').filter(Boolean);
    return {
      byTeam, days, permits,
      practices: [...byTeam.values()].reduce((n, t) => n + t.n, 0),
      // Every practice already on the schedule and its parts: none of them moves.
      others: family.reduce((n, v) => n + v.slots.reduce((m, x) => m + x.teamIds.length, 0), 0),
    };
  })();
  const hoursOf = (minutes: number) => hoursNumber(minutes / 60);
  const addHead = addDrafts && (addDrafts.practices ? (
    <>
      <Statement lead={W.addDraftsLead(addDrafts.practices, scheduleDates(addDrafts.days[0], addDrafts.days[addDrafts.days.length - 1]))}
        rest={W.addDraftsRest(joinWithAnd(addDrafts.permits), addDrafts.others)} />
      <div className={repKit.tableFrame}>
        <table className={repKit.table} aria-label={W.addStep2}>
          <thead>
            <tr><th scope="col">{W.addColTeam}</th><th scope="col" className={repKit.num}>{W.addColNew}</th><th scope="col" className={repKit.num}>{W.addColHours}</th></tr>
          </thead>
          <tbody>
            {inOrder.filter(t => addDrafts.byTeam.has(t.id)).map(t => {
              const x = addDrafts.byTeam.get(t.id)!;
              return (
                <tr key={t.id}>
                  <td>{t.name}<span className={repKit.cellSub}>{[...x.venues].map(v => placeName(places, v, null)).join(', ')}</span></td>
                  <td className={repKit.num}>{x.n}</td>
                  <td className={repKit.num}>{hoursOf(x.minutes)}</td>
                </tr>
              );
            })}
            <tr>
              <td><b>{W.addTeamsTotal(addDrafts.byTeam.size)}</b></td>
              <td className={repKit.num}><b>{addDrafts.practices}</b></td>
              <td className={repKit.num}><b>{hoursOf([...addDrafts.byTeam.values()].reduce((n, t) => n + t.minutes, 0))}</b></td>
            </tr>
          </tbody>
        </table>
      </div>
      {inOrder.filter(t => !addDrafts.byTeam.has(t.id)).map(t => <p key={t.id} className={ck.hint}>{W.addNothingFor(t.name)}</p>)}
    </>
  ) : <Statement lead={W.addNothingNew(addDrafts.permits.length)} rest={W.addNothingNewRest} />);

  const draftsBody = gen && pick && (
    <div className={sch.drafts}>
      {addHead}
      {shortWhy && (
        <p className={`${ck.notice} ${ck.noticeWarn} ${sch.draftsSpan}`} role="status" data-drafts-short>
          <AlertTriangle size={14} aria-hidden />
          <span className={ck.noticeBody}>{shortWhy}{' '}
            <button type="button" className={sch.door} onClick={backToTheSetting}>{W.draftsShortDoor}<ChevronRight size={14} aria-hidden /></button>
          </span>
        </p>
      )}
      {gapWhy && (
        <p className={`${ck.notice} ${ck.noticeWarn} ${sch.draftsSpan}`} role="status" data-drafts-gap>
          <AlertTriangle size={14} aria-hidden />
          <span className={ck.noticeBody}>{gapWhy.text}{' '}
            <button type="button" className={sch.door} onClick={gapWhy.go}>{gapWhy.door}<ChevronRight size={14} aria-hidden /></button>
          </span>
        </p>
      )}
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
              {(() => { const w = foundWarning(d); return w && <li className={sch.amber}><AlertTriangle size={13} aria-hidden />{w}</li>; })()}
            </ul>
          </button>
        ))}
        <button type="button" className={sch.door} onClick={() => void generate(round + 1)} disabled={busy}>{W.threeMore}</button>
      </div>
      <div className={sch.chosen}>
        <div className={sch.lensLine}>
          <ViewSwitch views={[{ id: 'team', label: W.byTeam }, { id: 'day', label: W.byDay }]} value={lens} onChange={setLens} label="Read the draft" />
          <span className={sch.spacer} />
          {lens === 'day' && bookedCount > 0 && (
            <label className={sch.showBooked}>
              <input type="checkbox" checked={showBooked} onChange={e => setShowBooked(e.target.checked)} />
              {W.showBooked(bookedCount)}
            </label>
          )}
          {exportMenu}
        </div>
        {lens === 'team' ? (
          <div className={sch.lines} role="list" aria-label={W.byTeam}>
            {teamRows.map(({ t, r }) => (
              <div key={t.id} className={sch.teamLine} role="listitem">
                <span className={sch.teamLineName}><Swatch colour={colourOf(t.id)} /><b>{t.name}</b></span>
                {/* A short team reads what it has of its share, in amber — the draft card's short line points here. */}
                <span className={r.short > 0 ? sch.amber : undefined}>
                  {r.shared ? W.sharedCount(r.got, r.shared) : r.short > 0 ? W.rowSlotsOf(r.got, r.got + r.short) : W.rowSlots(r.got)}
                </span>
                <span>{W.rowPrime(r.prime)}</span>
                <span>{nightsWords(r.nights)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className={sch.dayList} aria-label={W.byDay}>
            {shownDays.length === 0 && bookedCount > 0 && <p className={sch.dayEmpty}>{W.onlyBooked}</p>}
            {shownDays.map(g => (
              <div key={g.day} role="list" aria-label={formatShortWeekdayDate(g.day)}>
                <div className={sch.dayBand}>{formatShortWeekdayDate(g.day)}</div>
                {g.list.map(s => {
                  const teams = pick.assignments[s.key] ?? [];
                  return (
                    <div key={s.key} className={sch.dline} role="listitem">
                      {teams[0] ? <Swatch colour={colourOf(teams[0])} /> : <span className={sch.swatchEmpty} aria-hidden />}
                      <span className={sch.dTime}>{formatTimeRange(s.startClock, s.endClock)}</span>
                      {teams.length ? <b>{teams.map(teamName).join(' · ')}</b>
                        : s.heldBy && settingsNow.rules.avoidBookings ? <span className={sch.dHeld}>{bookedWords(s.heldBy)}</span>
                          : <span className={sch.dOpen}>{W.openSlot}</span>}
                      <span className={sch.dPlace}>{placeOf(s)}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
        {!partOf && <Statement
          lead={editing ? W.keepLead : W.saveLead(draft.name.trim())}
          rest={editing ? (editing.schedule.state === 'final' ? W.regenSent : W.regenNotSent) : W.saveRest}
          bullets={W.statementBullets(pick.totals.handedOut, pick.totals.slots, pick.teams.filter(t => t.got > 0).length, pick.totals.open, pick.totals.held)}
        />}
      </div>
    </div>
  );

  // ── The window ──
  const lockedOnly = editing ? editing.slots.filter(s => s.locked && !s.movedByHand).length : 0;
  const movedByHand = editing ? editing.slots.filter(s => s.movedByHand).length : 0;
  // The count sits at the foot's left, never among the buttons (owner, 2026-10-12 — KitDialog's `footerStart`).
  // All of it to house league (k1): the foot says what house league gets, and the lime gives it — no drafts to choose from.
  const weeklyHours = (() => {
    let minutes = 0;
    const facilitiesUsed = new Set<string>();
    for (const r of draft.rows) {
      if (!r.start || !r.end || r.end <= r.start) continue;
      const v = places.find(p => p.venueId === (r.place?.venueId ?? draft.venueId));
      const ids = v?.facilities.length ? r.place?.facilityIds ?? draft.facilityIds : [v?.venueId ?? ''];
      ids.forEach(f => facilitiesUsed.add(f));
      const [sh, sm] = r.start.split(':').map(Number), [eh, em] = r.end.split(':').map(Number);
      minutes += r.weekdays.length * ids.length * ((eh * 60 + em) - (sh * 60 + sm));
    }
    return { hours: Math.round((minutes / 60) * 10) / 10, facilities: facilitiesUsed.size };
  })();
  const footSettingsNote = wholeHouseLeague
    ? (timeReady ? <span className={sch.footNote}>{W.houseLeagueFoot(weeklyHours.hours, weeklyHours.facilities, scheduleDates(draft.startsOn, draft.endsOn))}</span> : undefined)
    : shown ? <span className={sch.footNote}>{footCount(shown.handedOut, inOrder.length)}</span> : undefined;

  /** Give it to house league (k1): saved and sent in one step — its league admins can divide it right away. */
  async function giveWhole() {
    if (busy) return;
    const p = problem();
    if (p) { setError(p); return; }
    setBusy(true); setError('');
    try {
      const body = {
        // The time as it stands, to house league: no split, no prime time, no rules (they are absent from the form too).
        name: draft.name.trim(), ...timeBody,
        settings: settingsFromDraft({ ...draft, method: 'even', values: {}, groupTyped: {}, primeDays: 'none', windows: [], daysOff: [], fieldsBy: [], sharing: [], maxPerWeek: '' }, [HOUSE_LEAGUE]),
        startedFromPermitId: permitId, startedFromScheduleId: fromScheduleId, giveToHouseLeague: true,
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
  const footSettings = (
    <>
      <button type="button" className="btn btn-outline" onClick={onCancel} disabled={busy}>{W.cancel}</button>
      {wholeHouseLeague && !editing && !partOf
        ? <button type="button" className="btn btn-lime" onClick={() => void giveWhole()} disabled={busy || !inputs}>{busy ? W.saving : W.giveToHouseLeague}</button>
        : <button type="button" className="btn btn-lime" onClick={() => void generate(0)} disabled={busy || !inputs}>{busy ? W.generating : partOf ? W.addGenerate : W.generate}</button>}
    </>
  );
  // Add time keeps the part with no question (nothing on the schedule moves); with nothing new to keep, only Back (/ux 5).
  const footAdded = (
    <>
      <button type="button" className="btn btn-outline" onClick={() => { setStep('settings'); setError(''); }} disabled={busy}>{W.addBack}</button>
      {!!addDrafts?.practices && (
        <button type="button" className="btn btn-lime" disabled={busy || !pick} onClick={() => void save()}>{busy ? W.saving : W.keepDraft}</button>
      )}
    </>
  );
  const footDrafts = partOf ? footAdded : (
    <>
      <button type="button" className="btn btn-outline" onClick={() => { setStep('settings'); setError(''); }} disabled={busy}>{W.backToSettings}</button>
      <button type="button" className="btn btn-lime" disabled={busy || !pick}
        onClick={() => (editing ? setAsking(true) : void save())}>
        {busy && !editing ? W.saving : editing ? W.keepDraft : W.saveDraft}
      </button>
    </>
  );
  // The opening screen's foot: Cancel beside the lime, as every create window keeps (/design D1, 2026-10-09).
  const footOpening = (
    <>
      <button type="button" className="btn btn-outline" onClick={onCancel} disabled={busy}>{W.cancel}</button>
      {/* A copy still being read is dropped, never landed over the blank form. */}
      <button type="button" className="btn btn-lime" onClick={() => { copyAsk.current++; setError(''); setStarted(true); }} disabled={busy}>
        {startPermit ? W.startFromPermit : W.startBlank}
      </button>
    </>
  );
  /** Find the time, open over step 1 (never over the opening screen or the drafts). */
  const inFinder = finding && !!findFilters && !!inputs && !choosing && step === 'settings';
  /** The places ticked that the list still shows (a filter can narrow one away; it is not brought in). */
  // Only a row that can be picked counts: a tick left on a row a filter has since emptied adds nothing.
  const findPicked = freeRead.data?.rows.filter(r => findTicked.has(findRowKey(r)) && r.freeDays + r.draftDays > 0).length ?? 0;
  const footFind = (
    <>
      <button type="button" className="btn btn-outline" onClick={() => setFinding(false)}>{W.findBack}</button>
      <button type="button" className="btn btn-lime" disabled={!findPicked || freeRead.loading || !freeRead.current} onClick={addFound}>{W.findAdd(findPicked)}</button>
    </>
  );
  let body: ReactNode;
  if (inputsFailed) body = <p className={repKit.formError}>{W.inputsFailed}</p>;
  else if (!inputs) body = <LoadingState inline label={W.loadingInputs} />;
  else if (choosing) body = openingBody;
  else if (inFinder) {
    body = (
      <FindTheTime filters={findFilters!} onFilters={setFindFilters} read={freeRead} ticked={findTicked}
        onTick={(key, on) => setFindTicked(t => { const n = new Set(t); if (on) n.add(key); else n.delete(key); return n; })}
        pricedBy={findPriced} onPricedBy={(key, id) => setFindPriced(p => ({ ...p, [key]: id }))}
        places={places} permitById={permitById} orgSlug={orgSlug} />
    );
  } else if (step === 'drafts' && gen) body = partOf && !addDrafts?.practices ? <div className={sch.drafts}>{addHead}</div> : draftsBody;
  else body = (
    <div className={sch.settings}>
      {timeSection}{whoSection}{!wholeHouseLeague && rulesSection}
      {/* The promise, said where it is made (tab 3, note 6). */}
      {partOf && <Statement lead={PART_WORDS.promiseLead(partOf.schedule.name)} rest={PART_WORDS.promiseRest} />}
    </div>
  );

  // While the inputs load, no step line and no step bar: the window may open on the opening screen instead (/review).
  let identity: string | undefined = copiedFrom ? W.copiedFrom(copiedFrom) : W.step1;
  if (opening) identity = undefined;
  else if (choosing) identity = startPermit ? W.openingLeadPermit : W.openingLead;
  else if (inFinder) identity = W.findIdentity;
  else if (step === 'drafts') identity = partOf ? W.addStep2 : W.step2(draft.name.trim() || W.newTitle);
  else if (partOf) identity = W.addStep1;

  return (
    <>
      <KitDialog
        kind="form"
        size="xwide"
        eyebrow={editing ? editing.schedule.name : partOf ? partOf.schedule.name : undefined}
        title={inFinder ? W.findTitle : partOf ? W.addTitle : editing ? W.settingsBack : W.newTitle}
        identity={identity}
        progress={choosing || opening || inFinder ? undefined : { at: step === 'drafts' ? 2 : 1, of: 2 }}
        back={inFinder ? { label: partOf ? W.addTitle : W.newTitle, onBack: () => setFinding(false) } : step === 'drafts' ? { label: partOf ? W.addTitle : W.settingsBack, onBack: () => setStep('settings') } : undefined}
        levelKey={choosing ? 'opening' : inFinder ? 'finding' : step}
        onClose={onCancel}
        busy={busy}
        footerStart={inFinder ? <span className={sch.footNote}>{findPicked ? W.findFootSome : W.findFootNone}</span> : step === 'drafts' || choosing ? undefined : footSettingsNote}
        footer={choosing ? footOpening : opening ? <button type="button" className="btn btn-outline" onClick={onCancel}>{W.cancel}</button> : inFinder ? footFind : step === 'drafts' ? footDrafts : footSettings}
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
              <button type="button" className="btn btn-outline" onClick={() => setAsking(false)} disabled={busy}>{W.regenBack}</button>
              <button type="button" className="btn btn-lime" onClick={() => void keep()} disabled={busy}>{W.regenGo}</button>
            </>
          )}
        >
          <p>{sent ? W.regenLeadSent : W.regenLead} <b>{W.regenKept(lockedOnly, movedByHand)}</b></p>
          {sent && !!gen?.summary.past && <p>{W.regenPast(gen.summary.past)}</p>}
          {gen && gen.summary.notKept > 0 && <p>{W.notKept(gen.summary.notKept)}</p>}
          <p>{editing.schedule.state === 'final' ? W.regenSent : W.regenNotSent}</p>
        </KitDialog>
      )}
      {takingOff && editing && (() => {
        const t = takeOffOf(takingOff);
        const dirty = opened !== null && opened !== JSON.stringify(draft);
        // An added part's ONLY permit: the part comes off with it (Phase 8, drawing tab 4).
        const wholePart = settingsOf?.part && !editing.time.blocks.some(b => b.permitId !== takingOff) ? settingsOf.part : null;
        return (
          <KitDialog
            kind="question"
            title={wholePart ? PART_WORDS.takeOffPartTitle(wholePart.label) : W.takeOffTitle(permitById.get(takingOff)?.name ?? '')}
            onClose={() => setTakingOff(null)}
            busy={busy}
            footer={(
              <>
                <button type="button" className="btn btn-outline" onClick={() => setTakingOff(null)} disabled={busy}>{W.takeOffBack}</button>
                <button type="button" className="btn btn-lime" onClick={() => void takeOff(takingOff)} disabled={busy}>{W.takeOffGo}</button>
              </>
            )}
          >
            {sent ? (
              <>
                <p>{W.takeOffFuture(t.practices, formatShortWeekdayDate(t.today), joinWithAnd(t.teams))}</p>
                {t.past > 0 && <p>{W.takeOffPast(t.past)}</p>}
                <p>{W.takeOffSend}</p>
                {wholePart && t.past === 0 && <p>{PART_WORDS.takeOffPartLeaves(wholePart.label)}</p>}
              </>
            ) : wholePart ? <p>{PART_WORDS.takeOffPartDraft(t.practices)}</p> : <p>{W.takeOffDraft(t.slots)}</p>}
            {dirty && <p>{W.takeOffEdits}</p>}
          </KitDialog>
        );
      })()}
    </>
  );
}
