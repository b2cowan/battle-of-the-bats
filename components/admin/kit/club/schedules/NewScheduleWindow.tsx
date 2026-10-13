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
import { AlertTriangle, Check, ChevronDown, Download, Pencil, Plus, Trash2, X } from 'lucide-react';
import KitDialog from '../KitDialog';
import ck from '../ClubKit.module.css';
import { ClubRow, ClubRowList, RecordAction, repKit } from '../RepKit';
import { PickField } from '../PermitWindows';
import { FormError, jsonInit, moneyFetch, refusalText } from '../money/MoneyKit';
import mk from '../money/Money.module.css';
import own from '../Permits.module.css';
import FormTable, { type FormTableGroup, type FormTableRow } from '@/components/shared/FormTable';
import { CheckChoice } from '@/components/admin/tournament/ScreenParts';
import { ViewSwitch } from '@/components/coaches/ScheduleCalendarViews';
import { spreadGroupFigure } from '@/lib/club-bill-split';
import { formatTimeRange, pluralize } from '@/lib/utils';
import { useAnchoredMenu, useDismissable } from '@/lib/overlay-hooks';
import { formatShortWeekdayDate, formatStoredDate, isCalendarDate } from '@/lib/timezone';
import { WEEKDAY_OPTIONS, facilityListWords, renewedName, weekdayPlural, weekdaysShort } from '@/lib/permit-words';
import { rulesOn, type ScheduleSettings } from '@/lib/club-schedule-settings';
import {
  EMPTY_SETTINGS, figureOf as figureIn, groupsIn, newKey, positive, ruleApplies, ruleIsWhole, settingsDraftOf, settingsOf as settingsFromDraft, teamsIn, wholeWeekly,
  type DayOffRule, type FieldsRule, type SettingsDraft, type ShareRule, type WindowRule,
} from '@/lib/club-schedule-form';
import { SCHEDULE_REFUSALS as R, SCHEDULE_SCREEN_WORDS as W, sharingSentence, sharingWho } from '@/lib/club-schedule-words';
import {
  NO_GROUP, PRIME_DAYS, closingNote, isStale, facilityNoun, footCount, nightsWords, placeKey, scheduleDates, summaryLine, teamColour, yearOn,
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
  /** Newest first; `venues` is said as the row says it ("Lions Park and Kinsmen Park"). */
  schedules: { id: string; name: string; startsOn: string; endsOn: string; venues: string }[];
}

// ── The draft the form holds ──────────────────────────────────────────────────────────────────────

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

/** The time, and the settings part (`SettingsDraft` — its conversions to and from the saved settings are one module's). */
interface Draft extends SettingsDraft {
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
}

const EMPTY: Draft = {
  name: '', permitId: '', copyFrom: '', venueId: '', facilityIds: [], startsOn: '', endsOn: '',
  rows: [{ key: 'row-0', weekdays: [], start: '', end: '' }], datesOff: [],
  ...EMPTY_SETTINGS,
};

type ListName = 'rows' | 'datesOff' | 'windows' | 'daysOff' | 'fieldsBy' | 'sharing';
type RowOf<K extends ListName> = Draft[K] extends readonly (infer R)[] ? R : never;

/** The caps are one rule (At most, a day or a week): its key when it opens in place. */
const CAPS = 'caps';

const SLOT_LENGTHS = [30, 45, 60, 75, 90, 105, 120, 150, 180, 240];
const CHANGEOVERS = [0, 5, 10, 15, 20, 30, 45, 60];
const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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
  /** The one rule opened in place (its key; `CAPS` for the caps), or none (Stage 11c Ask 6). */
  const [openRule, setOpenRule] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  useDismissable(adding, addRef, () => setAdding(false));
  const addMenuStyle = useAnchoredMenu(adding, addRef, addMenuRef, { minWidth: 300, narrowMinWidth: 220, align: 'start' });
  const [noSeasonOpen, setNoSeasonOpen] = useState(false);
  const [step, setStep] = useState<'settings' | 'drafts'>('settings');
  /** Past the opening screen — a copy picked, or Start blank. */
  const [started, setStarted] = useState(false);
  /** The opening screen (0): only when there is one to copy, never in Settings… */
  const choosing = !editing && !started && !!inputs?.schedules.length;
  /** The inputs are still on their way — the window can't yet say which level it opens on. */
  const opening = !editing && !inputs && !inputsFailed;
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
          ...EMPTY, ...settingsDraftOf(editing.schedule.settings, running),
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
      ...(d.permitId ? {} : {
        ...timeFromBlocks(v.time.blocks, inputs.places, yearOn),
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
  const groupKeyOf = (t: InputTeam) => t.groupId ?? NO_GROUP;
  const groupKeys = useMemo(() => (running.some(t => t.groupId) ? [...new Set(running.map(groupKeyOf))] : []), [running]);
  const membersOf = (key: string) => running.filter(t => groupKeyOf(t) === key);
  const groupLabel = (key: string) => (key === NO_GROUP ? W.notInGroup : running.find(t => t.groupId === key)?.groupName ?? W.notInGroup);

  const figureOf = (teamId: string): number | null => figureIn(draft, teamId);
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
  const settingsBody = useCallback((onlyWhole: boolean): ScheduleSettings =>
    settingsFromDraft(draft, inOrder.filter(t => !onlyWhole || figureIn(draft, t.id) != null).map(t => t.id)), [draft, inOrder]);

  const timeReady = isCalendarDate(draft.startsOn) && isCalendarDate(draft.endsOn) && draft.endsOn >= draft.startsOn
    && timeBody.blocks.length > 0 && timeBody.blocks.length === draft.rows.length && !!draft.venueId
    && (!venue?.facilities.length || draft.facilityIds.length > 0 || draft.rows.some(r => r.place));
  const permitId = draft.permitId || (editing?.schedule.startedFromPermitId ?? null);
  const fromScheduleId = draft.copyFrom || null;

  // ── The server's count (`previewOnly`), as the form changes ──
  const [summary, setSummary] = useState<GenerateSummary | null>(null);
  const [previewError, setPreviewError] = useState('');
  // Not while the opening screen is up: a permit's page pre-fills the time before anything is chosen (/review 2026-10-13).
  const previewBody = useMemo(() => (!choosing && timeReady && percentHundredths <= 10000
    ? { ...timeBody, settings: settingsBody(true), startedFromPermitId: permitId, scheduleId: editing?.schedule.id ?? null, previewOnly: true }
    : null), [choosing, timeReady, percentHundredths, timeBody, settingsBody, permitId, editing]);
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
    if (unfinishedRule) return W.ruleUnfinished;
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
    if (p) { setError(p); if (unfinishedRule) setRulesOpen(true); return; }
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

  // ── The opening screen (0) ──
  /** Opened from a permit's page: the permit already picked, named on the screen (/design D4). */
  const startPermit = inputs && draft.permitId ? inputs.permits.find(p => p.id === draft.permitId) ?? null : null;
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
  const capsWords = draft.maxPerDay && draft.maxPerWeek ? W.capBoth(Number(draft.maxPerDay), Number(draft.maxPerWeek))
    : draft.maxPerDay ? W.capDay(Number(draft.maxPerDay)) : draft.maxPerWeek ? W.capWeek(Number(draft.maxPerWeek)) : null;
  type RuleKind = keyof typeof W.ruleKinds;
  /** A rule the club added, as its row: its list's name (the caps are one rule), the rule, whether it is whole, its sentence. */
  type RuleRow = { key: string; words: string; whole: boolean; idle?: boolean } & (
    | { kind: 'fieldsBy'; row: FieldsRule } | { kind: 'sharing'; row: ShareRule } | { kind: 'windows'; row: WindowRule }
    | { kind: 'daysOff'; row: DayOffRule } | { kind: 'caps'; row: null });
  // The facility rules first, then sharing, the times, the days off and the caps — the dome's folded line, as drawn.
  const ruleRows: RuleRow[] = [
    ...draft.fieldsBy.map(row => ({ kind: 'fieldsBy' as const, row, key: row.key, whole: ruleIsWhole.fieldsBy(row), idle: !ruleApplies.fieldsBy(row, tickedSet), words: sentence.fieldsBy(row) })),
    ...draft.sharing.map(row => ({ kind: 'sharing' as const, row, key: row.key, whole: ruleIsWhole.sharing(row), idle: !ruleApplies.sharing(row, tickedSet), words: sentence.sharing(row) })),
    ...draft.windows.map(row => ({ kind: 'windows' as const, row, key: row.key, whole: ruleIsWhole.windows(row), idle: !ruleApplies.windows(row, tickedSet), words: ruleIsWhole.windows(row) ? sentence.windows(row) : '' })),
    ...draft.daysOff.map(row => ({ kind: 'daysOff' as const, row, key: row.key, whole: ruleIsWhole.daysOff(row), idle: !ruleApplies.daysOff(row, tickedSet), words: ruleIsWhole.daysOff(row) ? sentence.daysOff(row) : '' })),
    ...(capsWords || openRule === CAPS ? [{ kind: 'caps' as const, row: null, key: CAPS, whole: !!capsWords, words: capsWords ?? '' }] : []),
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
      <button type="button" className={ck.link} onClick={() => tickTo(running.map(t => t.id))}>{W.all}</button>
      <span aria-hidden>·</span>
      <button type="button" className={ck.link} onClick={() => tickTo([])}>{W.none}</button>
    </span>
  );
  const clockSelect = (id: string, label: string, value: string, onChange: (v: string) => void) => (
    <label className={ck.field} htmlFor={id}>
      <span className={ck.label}>{label}</span>
      <input id={id} type="time" step={300} className={ck.input} value={value} onChange={e => onChange(e.target.value)} />
    </label>
  );
  const whoSection = (
    <section className={sch.section} aria-labelledby="ns-who">
      <div className={sch.sectionHead}>
        <h3 id="ns-who" className={sch.sectionTitle}>{W.sectionWho}</h3>
      </div>
      {/* Split the time beside Each team's time: both say how the time is handed out (Stage 11c Ask 4). */}
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
              slots: practicesShown != null ? String(practicesShown) : '—',
            },
            phone: `${W.teamsCount(inOrder.length)}${practicesShown != null ? ` · ${pluralize(practicesShown, 'slot')}` : ''}`,
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
      {/* Prime time, whole (Stage 11c Ask 5): its hours, and how it is shared beside them where that applies. Each team's
          time answers whether a team keeps its prime-time slot or moves — no Keep / Rotate of its own. */}
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
    </section>
  );

  // ── Rules: only the rules the club added, each its sentence; a rule opens in place; one Add a rule ──
  const teamOptions = running.map(t => ({ id: t.id, label: t.name }));
  const allFacilities = places.filter(p => p.venueId === draft.venueId || draft.rows.some(r => r.place?.venueId === p.venueId))
    .flatMap(p => p.facilities.map(f => ({ id: f.id, label: f.name })));
  const whoOptions = [
    ...(inputs?.groups ?? []).filter(g => running.some(t => t.groupId === g.id)).map(g => ({ id: `g:${g.id}`, label: g.name })),
    ...running.map(t => ({ id: `t:${t.id}`, label: t.name })),
  ];
  const halfNames = shown?.half.length ? facilityNames(shown.half) : null;
  const addRule = (kind: RuleKind) => {
    setAdding(false);
    if (kind === 'caps') { setOpenRule(CAPS); return; }
    const key = newKey(kind);
    if (kind === 'windows') set({ windows: [...draft.windows, { key, teamIds: [], startAfter: '', finishBy: '' }] });
    if (kind === 'daysOff') set({ daysOff: [...draft.daysOff, { key, teamId: '', when: 'date', date: '', note: '' }] });
    if (kind === 'fieldsBy') set({ fieldsBy: [...draft.fieldsBy, { key, facilityIds: [], who: [] }] });
    if (kind === 'sharing') set({ sharing: [...draft.sharing, { key, who: [], atOnce: 2 }] });
    setOpenRule(key);
  };
  const removeRule = (r: RuleRow) => {
    if (r.kind === 'caps') set({ maxPerDay: '', maxPerWeek: '' });
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
              {running.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
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
              <input id={id('date')} type="date" className={ck.input} value={d.date} min={draft.startsOn || undefined} max={draft.endsOn || undefined}
                onChange={e => patchIn('daysOff', d.key, { date: e.target.value })} />
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
        <label className={ck.field} htmlFor={id('day')}>
          <span className={ck.label}>{W.maxDay}</span>
          <select id={id('day')} className={ck.select} value={draft.maxPerDay} onChange={e => set({ maxPerDay: e.target.value })}>
            <option value="">{W.noCap}</option>
            {[1, 2, 3, 4].map(n => <option key={n} value={String(n)}>{W.capWords(n)}</option>)}
          </select>
        </label>
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
                <span>{r.shared ? W.sharedCount(r.got, r.shared) : W.rowSlots(r.got)}</span>
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
  let body: ReactNode;
  if (inputsFailed) body = <p className={repKit.formError}>{W.inputsFailed}</p>;
  else if (!inputs) body = <LoadingState inline label={W.loadingInputs} />;
  else if (choosing) body = openingBody;
  else if (step === 'drafts' && gen) body = draftsBody;
  else body = <div className={sch.settings}>{timeSection}{whoSection}{rulesSection}</div>;

  // While the inputs load, no step line and no step bar: the window may open on the opening screen instead (/review).
  let identity: string | undefined = copiedFrom ? W.copiedFrom(copiedFrom) : W.step1;
  if (opening) identity = undefined;
  else if (choosing) identity = startPermit ? W.openingLeadPermit : W.openingLead;
  else if (step === 'drafts') identity = W.step2(draft.name.trim() || W.newTitle);

  return (
    <>
      <KitDialog
        kind="form"
        wide
        eyebrow={editing ? editing.schedule.name : undefined}
        title={editing ? W.settingsBack : W.newTitle}
        identity={identity}
        progress={choosing || opening ? undefined : { at: step === 'drafts' ? 2 : 1, of: 2 }}
        back={step === 'drafts' ? { label: W.settingsBack, onBack: () => setStep('settings') } : undefined}
        levelKey={choosing ? 'opening' : step}
        onClose={onCancel}
        busy={busy}
        footerStart={step === 'drafts' || choosing ? undefined : footSettingsNote}
        footer={choosing ? footOpening : opening ? <button type="button" className="btn btn-outline" onClick={onCancel}>{W.cancel}</button> : step === 'drafts' ? footDrafts : footSettings}
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
