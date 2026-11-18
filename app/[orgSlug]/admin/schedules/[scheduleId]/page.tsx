'use client';
/**
 * Club schedule detail. A compact attention queue precedes the whole-schedule Fair shares band.
 * Sent one-weekday schedules open on a read-only Overview of the current dates; Grid remains the
 * date and edit surface. By team, By group, and Fair shares are alternate desktop views.
 * Phones keep Day and By team. The route supplies the Accounting gate for money and Answer.
 * See docs/projects/active/CLUB_SCHEDULE_LANDING_UX_PLAN.md for the reviewed presentation.
 */

import { Fragment, useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, ChevronRight, MoreHorizontal, Undo2 } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { jsonInit, moneyFetch, refusalText } from '@/lib/money-fetch';
import { formatStoredDate, formatShortWeekdayDate, tournamentToday } from '@/lib/timezone';
import { formatTime, joinWithAnd, pluralize } from '@/lib/utils';
import { TabPageHeader } from '@/components/admin/kit/club/PlaceFrame';
import { useHandNamedPlace } from '@/components/admin/AdminBarPlace';
import ExportMenu from '@/components/admin/ExportMenu';
import { CoachListToolbar } from '@/components/coaches/kit';
import { CoachToolbarMenu, CoachToolbarMenuItem } from '@/components/coaches/CoachToolbarMenu';
import MultiSelectDropdown from '@/components/coaches/MultiSelectDropdown';
import SingleSelectDropdown from '@/components/coaches/SingleSelectDropdown';
import FilterGroup from '@/components/coaches/FilterGroup';
import { ScheduleDateNav } from '@/components/coaches/ScheduleCalendarViews';
import { ViewSwitch } from '@/components/coaches/kit';
import { ScopeNav } from '@/components/admin/kit/ScopeNav';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { EmptyCard, LoadFailed, NoticePill, PageLoading, RepChip, repKit, useDeferredLoad, useLatestRead } from '@/components/admin/kit/club/RepKit';
import ScheduleGrid, { type GridDrop } from '@/components/admin/kit/club/schedules/ScheduleGrid';
import ScheduleOverview from '@/components/admin/kit/club/schedules/ScheduleOverview';
import ScheduleAttention from '@/components/admin/kit/club/schedules/ScheduleAttention';
import { FairSharesBand, FairSharesLines, FairSharesTeams, fairShares } from '@/components/admin/kit/club/schedules/FairShares';
import NewScheduleWindow from '@/components/admin/kit/club/schedules/NewScheduleWindow';
import BillWindow from '@/components/admin/kit/club/schedules/BillWindow';
import SendWindow, { type SendKeep } from '@/components/admin/kit/club/schedules/SendWindow';
import AnswerWindow from '@/components/admin/kit/club/money/AnswerWindow';
import { SendLogWindow, SlotWindow, SwapWindow, TeamSlotsWindow, WhichWeeks, type PendingMove, type SendLogRow } from '@/components/admin/kit/club/schedules/ScheduleWindows';
import { ScheduleStateChip, Swatch } from '@/components/admin/kit/club/schedules/ScheduleParts';
import sch from '@/components/admin/kit/club/schedules/Schedules.module.css';
import { exportScheduleFile } from '@/lib/export/club-schedule-export';
import { planMove, type WeeksScope } from '@/lib/club-schedule-engine';
import { sharingPools } from '@/lib/club-schedule-settings';
import { matchesScheduleTeamFilter, scheduleOutsideWords } from '@/lib/club-schedule-overview';
import { PART_WORDS as P, SCHEDULE_REFUSALS as R, SCHEDULE_SCREEN_WORDS as W, labelGroup, mergeChangeTeams, type ChangeGroup } from '@/lib/club-schedule-words';
import { addTeamResults, familyShown, memberView, partChangeLines, type PartRead } from '@/lib/club-schedule-family';
import WhichPartWindow from '@/components/admin/kit/club/schedules/WhichPartWindow';
import { HAND_BACK_WORDS as H } from '@/lib/club-hand-back-words';
import { isProgramHolder } from '@/lib/club-schedule-holders';
import { fetchDoorNote } from '@/lib/needs-attention-door';
import { facilityListWords, weekdayPlural } from '@/lib/permit-words';
import { permitDoor, type ScheduleOutside } from '@/lib/permit-dates-off-view';
import { usePermitsLink } from '@/components/admin/kit/useAdminKitNav';
import type { DateOff } from '@/lib/permit-time';
import {
  NO_GROUP, askedSlots, dropLanding, engineSlotsOf, firstCursor, gridColumns, nightsWords, oneWeekdayOf, openingDay, pct, perWeek, placeName, placeRows, scheduleDates,
  slotDays, slotTime, stepGrid, teamColour, weekCounts, weeksOnScreen, type ScheduleView, type SlotView,
} from '@/lib/club-schedule-view';

interface PageRead extends ScheduleView {
  replies: { teamId: string; answer: 'looks_good' | 'ask_for_change'; words: string | null; at: string }[];
  sendLog: SendLogRow[];
  changes: { teams: { teamId: string; teamName: string; lines: string[]; groups: ChangeGroup[] }[] };
  /** Its added parts (Phase 8), oldest first — the page reads the family as one (`familyShown`). */
  parts?: PartRead[];
}

const NO_PARTS: PartRead[] = [];
/** The Part filter's id for the schedule itself (a part's is its id). */
const PARENT_PART = 'schedule';

type Win =
  | { kind: 'slot'; key: string }
  | { kind: 'swap'; key: string }
  /** `partId`: Settings… or Regenerate of an added part (Phase 8, Session 3 — after "which part?"). */
  | { kind: 'settings'; regenerate?: boolean; addDatesOff?: DateOff[]; addTime?: boolean; partId?: string }
  /** Regenerate / Settings… on a schedule with added parts asks which part first (drawing tab 4, ruling 4). */
  | { kind: 'which'; then: 'settings' | 'regenerate' }
  | { kind: 'fair' }
  /** `partId`: an added part's bill — from Send the changes' "Bill it…" (`back: 'send'`) or Needs attention's (a part sent
   *  without one). */
  | { kind: 'bill'; partId?: string; back?: 'send'; keep?: SendKeep }
  /** `keep`: what the window held when Bill it… was pressed (owner 2026-11-17, walk §538 call C1) — it comes back as it was. */
  | { kind: 'send'; start: 'draft' | 'final' | 'changes' | 'bill'; bill?: object; partId?: string; keep?: SendKeep }
  | { kind: 'log' }
  | { kind: 'team'; teamId: string }
  | { kind: 'clearWeek' }
  | { kind: 'delete' }
  | { kind: 'answer'; id: string };

// ⚖ 13c Session C (C4 = A): Fair shares left the View menu — the band's Bill tile opens it, as Fair shares and the bill.
type Lens = 'overview' | 'grid' | 'team' | 'group';

/** One slot as it was before a change — what Undo puts back exactly. */
interface Before { slotId: string; teamIds: string[]; locked: boolean; movedByHand: boolean }

export default function SchedulePage() {
  const { currentOrg, loading: orgLoading } = useOrg();
  const params = useParams<{ scheduleId: string }>();
  const scheduleId = params.scheduleId;
  const router = useRouter();
  const isPhone = useIsPhone();
  const slug = currentOrg?.slug ?? '';
  const q = `orgSlug=${encodeURIComponent(slug)}`;
  const today = tournamentToday();

  const [read, setRead] = useState<PageRead | null>(null);
  const [failed, setFailed] = useState<{ notFound: boolean; text: string } | null>(null);
  // ⚖ PHASE 8: a schedule and its added parts are read as ONE page. `read` is the schedule's own view — what Settings…,
  // Bill the teams and Send act on; `shown` is the family's, which every READ on the page uses (the grid, the overview, By
  // team, the band, the slot window). An edit goes to the part that owns its slot.
  const parts = read?.parts ?? NO_PARTS;
  const shown = useMemo(() => (read ? familyShown(read, read.parts ?? NO_PARTS) : null), [read]);
  usePageTitle(read?.schedule.name ?? W.title);
  // THE STATE PILL: every schedule wears its state in the header — Draft, In review, Final (and the amber Changed since sent
  // beside Final). Owner ruling 2026-11-14: a final schedule is no longer silent; the list wears the same pill.
  const stateChip = shown ? <ScheduleStateChip state={shown.schedule.state} changed={shown.schedule.changedSinceSent} /> : undefined;
  // ⚖ Admin header Phase 3 (A8, round 5): the header names the schedule ("← Schedules │ name", its chip); the address gave
  // "Schedule" and the way back at once, this hands over the name once the schedule has loaded.
  useHandNamedPlace(read ? { title: read.schedule.name, chip: stateChip } : null);
  const [lens, setLens] = useState<Lens>('grid');
  const initializedSchedule = useRef<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [phoneDay, setPhoneDay] = useState<string | null>(null);
  const [facilityFilter, setFacilityFilter] = useState<Set<string>>(() => new Set());
  const [groupFilter, setGroupFilter] = useState<Set<string>>(() => new Set());
  const [teamFilter, setTeamFilter] = useState<Set<string>>(() => new Set());
  const [partFilter, setPartFilter] = useState<Set<string>>(() => new Set());
  const [clashesOnly, setClashesOnly] = useState(false);
  const [openWin, setWin] = useState<Win | null>(null);
  // A window opened for an added part is closed once the part is gone on the next read (taken off, or sent away by another
  // admin) — never falls back to the schedule itself, where Settings would edit it and a bill would be made on it.
  const win = openWin && (openWin.kind === 'settings' || openWin.kind === 'bill' || openWin.kind === 'send')
    && openWin.partId && !parts.some(x => x.id === openWin.partId) ? null : openWin;
  const [pending, setPending] = useState<PendingMove | null>(null);
  const [notice, setNotice] = useState<{ id: number; text: string; undo?: Before[] } | null>(null);
  const [moved, setMoved] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState('');

  const noticeSeq = useRef(0);
  const say = (text: string, undo?: Before[]) => setNotice({ id: ++noticeSeq.current, text, undo });
  // THE BELL'S DOOR (Stage 11d part B, D5): `?answer=<ask id>` opens Answer over the page once it has read, for someone
  // who moves club money; an ask no longer waiting says so; anyone else lands on the page, where the callout is. Read
  // once, then dropped from the address, so a reload doesn't open it again.
  const search = useSearchParams();
  const door = useRef<string | null>(search.get('answer'));

  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    if (!slug || !scheduleId) return;
    const current = beginRead();
    // org-slug-ok: `q` is built from the org context's slug above
    const r = await moneyFetch<PageRead>(`/api/admin/schedules/${encodeURIComponent(scheduleId)}?${q}`).catch(() => null);
    if (!current()) return;
    if (!r?.ok) {
      setFailed({ notFound: r?.status === 404 || r?.status === 403, text: refusalText(r?.data, W.pageFailed) });
      return;
    }
    setFailed(null);
    // A part's address (a practice's "From …") reads the family's page: settle on the schedule's own address.
    if (r.data.schedule.id !== scheduleId) router.replace(`/${slug}/admin/schedules/${encodeURIComponent(r.data.schedule.id)}`, { scroll: false });
    setRead(r.data);
    if (initializedSchedule.current !== r.data.schedule.id) {
      initializedSchedule.current = r.data.schedule.id;
      setLens(r.data.schedule.state === 'final' && oneWeekdayOf(r.data.slots) != null && slotDays(r.data.slots).length > 1 ? 'overview' : 'grid');
    }
    // The page shows the family's dates (a part may run past the schedule's own end).
    const { startsOn, endsOn } = familyShown(r.data, r.data.parts ?? NO_PARTS).schedule;
    setCursor(c => (c && c >= startsOn && c <= endsOn ? c : firstCursor(startsOn, endsOn, today)));
    const asked = door.current;
    if (asked) {
      door.current = null;
      router.replace(`/${slug}/admin/schedules/${encodeURIComponent(scheduleId)}`, { scroll: false });
      // An ask no longer waiting says exactly what happened, from the record (Needs attention clears itself, A5 —
      // owner 2026-10-16); the old three-way sentence stays only for when that can't be read.
      if (!r.data.asks.some(a => a.id === asked)) {
        void fetchDoorNote({ handBackId: asked }).then(note => setNotice({ id: ++noticeSeq.current, text: note ?? H.doorStale }));
      } else if (r.data.canMoney) setWin({ kind: 'answer', id: asked });
    }
  }, [slug, scheduleId, q, beginRead, today, router]);
  useDeferredLoad(!orgLoading && !!slug, load);

  // ⚖ 13c Session C (C2): what the permit's dates off took of this schedule — its OWN read, after the page has read and
  // again whenever the schedule's version moves (a regenerate), so the page never waits on it; a failure only hides the row.
  // The answer is kept with the version it was read for, so another version's is never shown.
  const [outsideRead, setOutsideRead] = useState<{ version: number; outside: ScheduleOutside | null } | null>(null);
  const permitsLink = usePermitsLink();
  const outsideVersion = read?.fromPermits.length && permitsLink ? read.schedule.version : null;
  const outside = outsideVersion != null && outsideRead?.version === outsideVersion ? outsideRead.outside : null;
  const beginOutside = useLatestRead();
  const loadOutside = useCallback(async () => {
    if (outsideVersion == null) return;
    const current = beginOutside();
    // org-slug-ok: `q` is built from the org context's slug above
    const r = await moneyFetch<{ outside: ScheduleOutside | null; version: number }>(`/api/admin/schedules/${encodeURIComponent(scheduleId)}?${q}&outside=1`).catch(() => null);
    // Tagged with the version the SERVER read, so a change by someone else in between is never laid over this read.
    if (current()) setOutsideRead({ version: r?.ok ? r.data.version : outsideVersion, outside: r?.ok ? r.data.outside : null });
  }, [outsideVersion, scheduleId, q, beginOutside]);
  useDeferredLoad(outsideVersion != null, loadOutside);

  // ── Names, colours, places — looked up by id, once per read ──
  const teamById = useMemo(() => new Map((shown?.teams ?? []).map(t => [t.id, t])), [shown]);
  const slotByKey = useMemo(() => new Map((shown?.slots ?? []).map(x => [x.key, x])), [shown]);
  const nameOf = useCallback((id: string) => teamById.get(id)?.name ?? (isProgramHolder(id) ? W.heldByHouseLeague : 'A team'), [teamById]);
  const colourOf = useCallback((id: string) => teamColour(shown?.teams ?? [], id), [shown]);
  const groupOf = useCallback((id: string) => teamById.get(id)?.groupId ?? null, [teamById]);
  const placeOfSlot = useCallback((x: Pick<SlotView, 'venueId' | 'facilityId'>) => placeName(shown?.places ?? [], x.venueId, x.facilityId), [shown]);
  // The schedule's sharing rules read against its teams: a slot's room (Stage 11c) — the moves, the drop and the slot window.
  const sharing = useMemo(() => sharingPools(read?.schedule.settings.rules.sharing ?? [], shown?.teams ?? []), [read, shown]);
  // The Sundays a waiting ask counts, by slot id — ringed on the grid, marked on a phone's Day, named in the slot window.
  const asked = useMemo(() => askedSlots(shown?.asks ?? []), [shown]);
  const askedIds = useMemo(() => new Set(asked.keys()), [asked]);

  const oneWeekday = useMemo(() => (shown ? oneWeekdayOf(shown.slots) : null), [shown]);
  const range = shown && cursor ? { startsOn: shown.schedule.startsOn, endsOn: shown.schedule.endsOn, oneWeekday, cursor } : null;
  const cols = range ? gridColumns(range) : null;
  const allRows = useMemo(() => (shown ? placeRows(shown.places, shown.slots) : []), [shown]);
  const rows = facilityFilter.size ? allRows.filter(r => facilityFilter.has(r.key)) : allRows;
  const weekSet = new Set(cols?.days ?? []);
  const weekClashes = shown ? shown.slots.filter(x => weekSet.has(x.day) && x.clash).length : 0;
  // A phone's Day: the dates with slots; the day picked, or where it opens (today's, or the next with slots).
  const days = useMemo(() => (shown ? slotDays(shown.slots) : []), [shown]);
  const shownDay = phoneDay && days.includes(phoneDay) ? phoneDay : shown ? openingDay(days, shown.schedule.startsOn, shown.schedule.endsOn, today) : null;

  // ── Writes: every hand edit, its Undo ──
  const slotOfKey = (key: string) => slotByKey.get(key) ?? null;
  /** Each family member's share of a set of slots (Phase 8): its address and the version it read — the schedule's own, or
   *  its part's. A week's lock or clear reaches every part on screen; a move never crosses parts. */
  function byMember<T>(items: readonly T[], slotIdOf: (x: T) => string): { id: string; version: number; items: T[] }[] {
    const partOf = new Map((shown?.slots ?? []).map(x => [x.id, x.partId ?? null]));
    const out = new Map<string | null, T[]>();
    for (const x of items) { const k = partOf.get(slotIdOf(x)) ?? null; (out.get(k) ?? out.set(k, []).get(k)!).push(x); }
    return [...out].map(([partId, list]) => {
      const part = partId ? parts.find(x => x.id === partId) : null;
      return { id: part?.id ?? read!.schedule.id, version: part?.version ?? read!.schedule.version, items: list };
    });
  }
  async function edit(edits: { slotKey: string; teamIds?: string[]; locked?: boolean }[], text: string, opts: { mark?: boolean } = {}) {
    if (!read || busy || !edits.length) return;
    const before: Before[] = edits.map(e => slotOfKey(e.slotKey)).filter((x): x is SlotView => !!x).map(x => ({ slotId: x.id, teamIds: x.teamIds, locked: x.locked, movedByHand: x.movedByHand }));
    setBusy(true);
    try {
      for (const m of byMember(edits, e => slotOfKey(e.slotKey)!.id)) {
        const r = await moneyFetch<{ version: number }>(`/api/admin/schedules/${encodeURIComponent(m.id)}?${q}`, jsonInit('PATCH', {
          action: 'edit', version: m.version,
          edits: m.items.map(e => ({ slotId: slotOfKey(e.slotKey)!.id, ...(e.teamIds ? { teamIds: e.teamIds } : {}), ...(e.locked !== undefined ? { locked: e.locked } : {}) })),
        }));
        if (!r.ok) { say(refusalText(r.data, R.notSaved)); await load(); return; }
      }
      if (opts.mark !== false) setMoved(m => new Set([...m, ...edits.filter(e => e.teamIds).map(e => e.slotKey)]));
      await load();
      say(text, before);
    } catch {
      say(R.notSaved);
    } finally {
      setBusy(false);
    }
  }
  async function undo(before: Before[]) {
    if (!read || busy) return;
    setBusy(true);
    try {
      for (const m of byMember(before, b => b.slotId)) {
        const r = await moneyFetch<{ version: number }>(`/api/admin/schedules/${encodeURIComponent(m.id)}?${q}`, jsonInit('PATCH', {
          action: 'edit', undo: true, version: m.version, edits: m.items,
        }));
        if (!r.ok) { say(refusalText(r.data, R.notSaved)); await load(); return; }
      }
      const ids = new Set(before.map(b => b.slotId));
      const keys = new Set((shown?.slots ?? []).filter(x => ids.has(x.id)).map(x => x.key));
      setMoved(m => new Set([...m].filter(k => !keys.has(k))));
      await load();
      say(W.undone);
    } catch {
      say(R.notSaved);
    } finally {
      setBusy(false);
    }
  }

  // ── A drop, and the weeks it reaches ──
  function onDrop(d: GridDrop) {
    setRefused('');
    // A practice stays on its own part's bill (Phase 8): a team never moves into another part's practice.
    if ((d.from.partId ?? null) !== (d.to.partId ?? null)) { setRefused(P.moveAcrossParts); say(P.moveAcrossParts); return; }
    setPending({ from: d.from, to: d.to, teamId: d.teamId, at: d.at });
  }
  function pickWeeks(scope: WeeksScope) {
    if (!shown || !pending) return;
    const m = pending;
    setPending(null);
    // The weeks a move reaches are its own part's (Phase 8): the same night in another part is another bill.
    const mine = shown.slots.filter(x => (x.partId ?? null) === (m.from.partId ?? null));
    const plan = planMove(engineSlotsOf(mine), new Map(mine.map(x => [x.key, x.teamIds])), {
      fromKey: m.from.key, toKey: m.to.key, teamId: m.teamId, scope, sharing,
    });
    if (!plan.edits.length) { say(W.skipped(plan.skipped.length || 1, W.skippedWhy[plan.skipped[0]?.why ?? 'no_slot'])); return; }
    const moved = new Set(plan.moved);
    const toDays = mine.filter(x => moved.has(x.week) && x.weekday === m.to.weekday && x.startClock === m.to.startClock
      && x.venueId === m.to.venueId && x.facilityId === m.to.facilityId).map(x => x.day).sort();
    const landing = dropLanding(m.from, m.to, m.teamId, sharing);
    const swapWith = landing?.kind === 'swap' ? landing.withTeam : null;
    const where = `${formatShortWeekdayDate(m.to.day).split(',')[0]}, ${formatTime(m.to.startClock)} · ${placeOfSlot(m.to)}`;
    const span = toDays.length > 1 ? `${formatStoredDate(toDays[0], { withYear: false })} – ${formatStoredDate(toDays[toDays.length - 1], { withYear: false })}` : null;
    const why = plan.skipped.length ? ` ${W.skipped(plan.skipped.length, W.skippedWhy[plan.skipped[0].why])}` : '';
    void edit(plan.edits, `${swapWith ? W.swapped(nameOf(m.teamId), nameOf(swapWith)) : W.moved(nameOf(m.teamId), where, span)}${why}`);
  }

  // ── Tools ──
  const weekSlots = shown ? shown.slots.filter(x => weekSet.has(x.day)) : [];
  /** The week's handed-out slots no lock holds — what Lock this week and Clear this week reach, and the question counts. */
  const unlockedHeld = weekSlots.filter(x => x.teamIds.length && !x.locked);
  const weekScope = cols?.mode === 'dates' && oneWeekday ? W.scopeDates(oneWeekday) : W.scopeWeek;
  const lockWeek = () => {
    if (!unlockedHeld.length) { say(W.nothingToLock(weekScope)); return; }
    void edit(unlockedHeld.map(x => ({ slotKey: x.key, locked: true })), W.lockedWeek(unlockedHeld.length), { mark: false });
  };
  /** Every locked slot the week shows, held or open — what Unlock this week reaches. The Tools row offers it only once nothing is left to lock. */
  const lockedInWeek = weekSlots.filter(x => x.locked);
  const unlockMode = !unlockedHeld.length && lockedInWeek.length > 0;
  const unlockWeek = () => {
    void edit(lockedInWeek.map(x => ({ slotKey: x.key, locked: false })), W.unlockedWeek(lockedInWeek.length), { mark: false });
  };
  const clearWeek = () => {
    setWin(null);
    void edit(unlockedHeld.map(x => ({ slotKey: x.key, teamIds: [] })), W.cleared(unlockedHeld.length));
  };
  async function deleteDraft() {
    if (!read) return;
    setBusy(true);
    const r = await moneyFetch(`/api/admin/schedules/${encodeURIComponent(read.schedule.id)}?${q}`, jsonInit('DELETE', {})).catch(() => null);
    setBusy(false);
    if (!r?.ok) { setWin(null); say(refusalText(r?.data, R.notSaved)); return; }
    router.push(`/${slug}/admin/schedules`);
  }

  // The paper header shows only where the header keeps the club's name (someone the schedules refuse).
  const header = (
    <TabPageHeader
      backTo={{ href: `/${slug}/admin/schedules`, label: W.back }}
      title={read?.schedule.name ?? W.title}
      titleChips={stateChip}
      inlineActions
    />
  );
  if (orgLoading || (!read && !failed)) return <PageLoading header={header} label="Loading this schedule…" />;
  if (failed && !read) {
    return (
      <div className={ck.pageWide}>
        {header}
        {failed.notFound ? <EmptyCard title={W.title}>{failed.text}</EmptyCard> : <LoadFailed title={failed.text} onRetry={() => void load()} />}
      </div>
    );
  }
  // The schedule's own view (what its windows act on) and the family's (what the page reads) — Phase 8.
  const own = read!;
  const v = shown!;
  const s = v.schedule;
  const draft = s.state === 'draft';
  const review = s.state === 'in_review';
  const final = s.state === 'final';
  const canChange = !isPhone;

  // ── The head's facts ──
  // The first line is the schedule's OWN time (its places, its dates); each added part says its own on the line below.
  const placeWords = own.places.map(p => {
    const names = p.facilities.filter(f => own.slots.some(x => x.facilityId === f.id)).map(f => f.name);
    return names.length ? `${p.venueName} · ${names.length >= 3 ? facilityListWords(names) : names.join(', ')}` : p.venueName;
  }).join('; ');
  const ownWeekday = oneWeekdayOf(own.slots);
  const ownDates = scheduleDates(own.schedule.startsOn, own.schedule.endsOn);
  const dates = ownWeekday ? `${weekdayPlural(ownWeekday)}, ${ownDates}` : ownDates;
  const ownTeams = own.teams.filter(t => own.slots.some(x => x.teamIds.includes(t.id)));
  // The Part filter (Phase 8, drawing tab 4 note 3): it narrows the grid and By team, as Team does.
  const partOptions = parts.length ? [{ id: PARENT_PART, label: own.schedule.name }, ...parts.map(x => ({ id: x.id, label: x.label }))] : [];
  const selectedParts = new Set([...partFilter].filter(id => partOptions.some(o => o.id === id)));
  const inParts = (x: Pick<SlotView, 'partId'>) => !selectedParts.size || selectedParts.has(x.partId ?? PARENT_PART);
  const partSlots = selectedParts.size ? v.slots.filter(inParts) : v.slots;
  const teamsInSlots = v.teams.filter(t => partSlots.some(x => x.teamIds.includes(t.id)));
  const meta = final && s.sent ? W.metaSent(placeWords, dates, formatStoredDate(s.sent.at, { withYear: false }), s.sent.by)
    : review && s.sent ? W.metaReview(placeWords, dates, formatStoredDate(s.sent.at, { withYear: false }), s.sent.by)
    : W.meta(placeWords, dates, ownTeams.length);
  // ONE line under it for the added parts, never more (ruling 3): the oldest, and "and 2 more ›" opening the Part filter.
  const firstPart = parts[0] ?? null;
  const partLine = firstPart && (() => {
    const pv = firstPart.view;
    const partDays = slotDays(pv.slots);
    const when = partDays.length === 1 ? formatShortWeekdayDate(partDays[0]) : scheduleDates(firstPart.startsOn, firstPart.endsOn);
    const names = pv.teams.filter(t => pv.slots.some(x => x.teamIds.includes(t.id))).map(t => t.name);
    return P.metaRest(when, P.metaTeams(names), firstPart.sent ? formatStoredDate(firstPart.sent.at, { withYear: false }) : null);
  })();
  const openPartFilter = () => {
    setLens('grid');
    requestAnimationFrame(() => {
      const d = document.querySelector<HTMLDetailsElement>('[data-part-filter] details');
      if (d) { d.open = true; d.querySelector<HTMLElement>('summary')?.focus(); }
    });
  };

  // ── The callouts ──
  const replies = v.replies;
  const replied = new Set(replies.map(r => r.teamId));
  const notReplied = teamsInSlots.filter(t => !replied.has(t.id));
  const reviewCallout = review && (
    <div className={`${sch.callout} ${sch.calloutOlive}`}>
      <div className={sch.calloutBody}>
        <b>{W.inReviewHead(replied.size, teamsInSlots.length)}</b>
        <ul>
          {replies.some(r => r.answer === 'looks_good') && <li>{W.looksGoodCount(replies.filter(r => r.answer === 'looks_good').length)}</li>}
          {replies.filter(r => r.answer === 'ask_for_change').map(r => <li key={r.teamId}>{W.askedFor(nameOf(r.teamId), r.words ?? '')}</li>)}
          {notReplied.length > 0 && <li>{W.notReplied(joinWithAnd(notReplied.map(t => t.name)), notReplied.length > 1, s.replyBy ? formatShortWeekdayDate(s.replyBy) : null)}</li>}
        </ul>
      </div>
      {!isPhone && <button type="button" className="btn btn-lime" onClick={() => setWin({ kind: 'send', start: 'final' })}>{W.finalize}</button>}
    </div>
  );
  // The schedule's own changes, then each unsent part's new practices (Phase 8) — what Send the changes will send.
  const unsentParts = parts.filter(x => x.state !== 'final');
  // A sent part's own changes (Session 3: taken off, regenerated) wait too. ⚖ Said as groups, one entry per team, soonest
  // first (owner 2026-11-17, artifact YLos6rKun1mA612uRsChsG): a part's label once per group, as the send says it.
  const labelled = (label: string) => (t: { teamId: string; teamName: string; groups: ChangeGroup[] }) => ({ ...t, groups: t.groups.map(g => labelGroup(g, label)) });
  const sentPartChanges = parts.filter(x => x.state === 'final' && x.changedSinceSent).flatMap(x => x.changes.map(labelled(x.label)));
  const changeTeams = mergeChangeTeams([...own.changes.teams, ...unsentParts.flatMap(x => partChangeLines(x).map(labelled(x.label))), ...sentPartChanges]);
  // A part with no bill yet is said here, never in the bill tile (drawing tab 4, note 2).
  const partNotes = unsentParts.filter(x => !x.billed).map(x => P.notBilledYet(x.label));
  // A part SENT without a bill (tab 5, note 2): the shipped final-not-billed path — Bill the teams, then Review the bill.
  // Hidden from a reader without the club's Accounting (it has no door they can use) and from a part marked free (walk §538 call C2).
  /** A sent part with practices for a rep team on it: the only kind a bill is owed for. */
  const sentWithTeams = (x: (typeof parts)[number]) => x.state === 'final' && !x.billed && x.view.slots.some(sl => sl.teamIds.some(id => !isProgramHolder(id)));
  const unbilledSent = !own.canMoney ? [] : parts.filter(x => sentWithTeams(x) && !x.billDismissed)
    .map(x => ({ id: x.id, text: P.sentNotBilled(x.label) }));
  /** A part marked "It's free" can still be billed later: Tools › Bill {part}… (owner 2026-11-17, the review's undo — no extra line on the page). */
  const freeParts = !own.canMoney ? [] : parts.filter(x => sentWithTeams(x) && x.billDismissed);
  /** "It's free": the club sent this part without a bill on purpose, so its row goes (walk §538 call C2). */
  async function markPartFree(partId: string) {
    const part = parts.find(x => x.id === partId);
    if (!part || busy) return;
    setBusy(true);
    const r = await moneyFetch(`/api/admin/schedules/${encodeURIComponent(partId)}?${q}`, jsonInit('PATCH', { action: 'dismiss_unbilled', version: part.version })).catch(() => null);
    setBusy(false);
    if (!r?.ok) { say(refusalText(r?.data, R.notSaved)); void load(); return; }
    say(P.sentFreeSaid(part.label));
    void load();
  }
  /** The family member a window acts on: an added part's own view, or the schedule's. */
  const winPart = win?.kind === 'settings' || win?.kind === 'bill' ? parts.find(x => x.id === win.partId) ?? null : null;
  const winName = winPart ? winPart.label : s.name;
  const partWords = winPart ? { label: winPart.label, parentName: own.schedule.name } : null;
  /** Bill the teams opened from Send the changes' "Bill it…" goes back there; anywhere else it closes. */
  const billBacksToSend = win?.kind === 'bill' && win.back === 'send';
  const billBack = () => setWin(billBacksToSend ? { kind: 'send', start: 'changes', keep: win?.kind === 'bill' ? win.keep : undefined } : null);

  // ── The permit's pulled dates (13c Session C, C2 = A): the words are scheduleOutsideWords'; the page adds the one ask,
  // a computer's only (as Regenerate is). The days go into the schedule's OWN Dates off, in today's Regenerate; nothing is
  // written until the admin keeps a draft there. No sync from the permit (13c adds none).
  // A schedule on several permits (Session B): ONE ROW PER PERMIT, each counting only the practices at its parks, and its
  // "Take … off" closing only those parks (P5 A) — named once the schedule's time uses more than one park. The warnings'
  // first line still reads every permit's days together.
  const outsideWords = outside ? scheduleOutsideWords(outside, own, { draft, nameOf }) : null;
  const scheduleParks = [...new Set(v.time.blocks.map(b => b.venueId))];
  const outsideRows = outside ? outside.rows.map(row => {
    const parks = scheduleParks.length > 1 ? row.venueIds : [];
    const at = parks.length ? joinWithAnd(parks.map(id => placeName(v.places, id, null)).filter(Boolean)) : null;
    const words = scheduleOutsideWords({ ...outside, permitName: row.permitName, days: row.days, league: row.league, leagueDays: row.leagueDays }, own,
      { draft, nameOf, permitNamed: outside.rows.length > 1, at });
    return {
      ...words,
      action: canChange ? { label: W.takeDaysOff(words.days, at), onClick: () => setWin({ kind: 'settings', regenerate: true, addDatesOff: row.days.map(d => ({ day: d.day, note: d.note, venueIds: parks })) }) } : null,
    };
  }) : [];
  // "Different on a date": a pulled day names the parks of the permit(s) that pulled it, once the schedule uses more than one.
  const outsideDays = (outside?.days ?? []).map(d => {
    const ids = scheduleParks.length > 1 && outside
      ? [...new Set(outside.rows.filter(r => r.days.some(x => x.day === d.day)).flatMap(r => r.venueIds))] : [];
    return { ...d, at: ids.length ? joinWithAnd(ids.map(id => placeName(v.places, id, null)).filter(Boolean)) : null };
  });

  // ── Export ──
  const exportInput = () => ({
    q, orgSlug: slug, orgName: currentOrg?.name, name: s.name, draftLabel: null, state: s.state,
    sentWords: s.sent ? `${final ? 'Final' : 'In review'}, sent ${formatStoredDate(s.sent.at, { withYear: false })}${s.sent.by ? ` by ${s.sent.by}` : ''}` : null,
    startsOn: s.startsOn, endsOn: s.endsOn, places: v.places,
    teams: v.teams.map(t => ({ id: t.id, name: t.name, groupName: t.groupName })),
    slots: v.slots.map(x => ({ ...x, handedBackTeamId: x.handedBack?.teamId ?? null })),
    datesOff: v.time.datesOff, offParkNames: v.offParkNames, pricing: v.pricing,
    bill: v.bill ? v.bill.teams.map(t => ({ teamId: t.teamId, amount: t.cents / 100, installments: t.installments })) : null,
  });
  const runExport = async (kind: 'xlsx' | 'pdf' | 'ics') => {
    try { await exportScheduleFile(kind, exportInput()); } catch { say('The file couldn’t be made. Please try again.'); }
  };
  const exportMenu = (
    <ExportMenu
      formats={final ? ['xlsx', 'pdf', 'ics'] : ['xlsx', 'pdf']}
      holds={{ title: W.scheduleExportHolds(s.name, v.slots.length, draft) }}
      pdfLabel="PDF"
      pdfHint={W.pdfHint}
      onExportXLSX={() => runExport('xlsx')}
      onExportCSV={() => runExport('xlsx')}
      onExportPDF={() => runExport('pdf')}
      onExportICS={final ? () => runExport('ics') : undefined}
    />
  );

  // ── The line ──
  const dateNav = cols && range && (
    <ScheduleDateNav view="week" cursor={cursor!} onStep={dir => setCursor(stepGrid(range, dir))}
      range={{ long: cols.range, short: cols.rangeShort, canBack: cols.canBack, canForward: cols.canForward,
        prevLabel: cols.mode === 'dates' ? 'Earlier dates' : 'Previous week', nextLabel: cols.mode === 'dates' ? 'Later dates' : 'Next week' }} />
  );
  const tools = (
    <CoachToolbarMenu label={W.tools} icon={<MoreHorizontal size={isPhone ? 20 : 15} aria-hidden />} variant={isPhone ? 'glyph' : 'secondary'} drawerOnPhone drawerTitle={W.tools}>
      {/* S1 A: Add time beside Settings…, first in Tools — it only adds; Settings… changes what is there. Phase 8 ruling 2: on a
          FINAL schedule only — a draft or a schedule in review is simply edited (Settings… holds the Permits picker). */}
      {canChange && final && <CoachToolbarMenuItem label={W.toolAddTime} hint={W.toolAddTimeHint} onSelect={() => setWin({ kind: 'settings', addTime: true })} />}
      {canChange && freeParts.map(x => <CoachToolbarMenuItem key={x.id} label={P.toolBillFree(x.label)} hint={P.toolBillFreeHint} onSelect={() => setWin({ kind: 'bill', partId: x.id })} />)}
      {canChange && <CoachToolbarMenuItem label={W.toolSettings} hint={W.toolSettingsHint} onSelect={() => setWin(parts.length ? { kind: 'which', then: 'settings' } : { kind: 'settings' })} />}
      {canChange && <CoachToolbarMenuItem label={W.toolRegenerate} onSelect={() => setWin(parts.length ? { kind: 'which', then: 'regenerate' } : { kind: 'settings', regenerate: true })} />}
      {canChange && lens === 'grid' && <CoachToolbarMenuItem label={unlockMode ? W.toolUnlockWeek(weekScope) : W.toolLockWeek(weekScope)} onSelect={unlockMode ? unlockWeek : lockWeek} />}
      {canChange && lens === 'grid' && <CoachToolbarMenuItem label={W.toolClearWeek(weekScope)} onSelect={() => setWin({ kind: 'clearWeek' })} />}
      <CoachToolbarMenuItem label={W.toolSendLog} onSelect={() => setWin({ kind: 'log' })} />
      {canChange && !final && <CoachToolbarMenuItem label={W.toolDelete} onSelect={() => setWin({ kind: 'delete' })} />}
    </CoachToolbarMenu>
  );
  // The grid's own narrowing: By team carries only the Part filter (Phase 8).
  const clashPill = lens === 'grid' && (weekClashes > 0 || clashesOnly) && (
    <button type="button" className={sch.amberPill} aria-pressed={clashesOnly} onClick={() => setClashesOnly(on => !on)}>
      <AlertTriangle size={13} aria-hidden />{pluralize(weekClashes, 'clash', 'clashes')}
    </button>
  );
  const facilityOptions = allRows.map(r => ({ id: r.key, label: r.name }));

  // ── By team · By group (specimen 8) ──
  const weeks = new Set(v.slots.map(x => x.week)).size || 1;
  const hasPrime = !!v.schedule.settings.prime;
  // By team reads the parts the Part filter keeps (Phase 8): each part's own results, added up.
  const partResults = selectedParts.size
    ? addTeamResults([...(selectedParts.has(PARENT_PART) ? [own.fairness.teams] : []), ...parts.filter(x => selectedParts.has(x.id)).map(x => x.view.fairness.teams)])
    : v.fairness.teams;
  const resultById = new Map(partResults.map(r => [r.teamId, r]));
  const resultOf = (id: string) => resultById.get(id);
  const teamGroups = (() => {
    const out = new Map<string, { name: string; teams: typeof teamsInSlots }>();
    for (const t of teamsInSlots) {
      const key = t.groupId ?? NO_GROUP;
      (out.get(key) ?? out.set(key, { name: t.groupName ?? W.notInGroup, teams: [] }).get(key)!).teams.push(t);
    }
    return out;
  })();
  /** A band per group — unless every team is in no group. */
  const banded = teamGroups.size > 1 || !teamGroups.has(NO_GROUP);
  const groupOptions = banded ? [...teamGroups].map(([id, group]) => ({ id, label: group.name })) : [];
  const selectedGroups = new Set([...groupFilter].filter(id => teamGroups.has(id)));
  const teamOptions = teamsInSlots.filter(t => !selectedGroups.size || selectedGroups.has(t.groupId ?? NO_GROUP))
    .map(t => ({ id: t.id, label: t.name }));
  const availableTeams = new Set(teamOptions.map(t => t.id));
  const selectedTeams = new Set([...teamFilter].filter(id => availableTeams.has(id)));
  const changeGroups = (next: Set<string>) => {
    setGroupFilter(next);
    if (next.size) {
      const allowed = new Set(teamsInSlots.filter(t => next.has(t.groupId ?? NO_GROUP)).map(t => t.id));
      setTeamFilter(current => new Set([...current].filter(id => allowed.has(id))));
    }
  };
  const dim = (x: SlotView) => (clashesOnly && !x.clash) || !inParts(x)
    || !matchesScheduleTeamFilter(x.teamIds, selectedGroups, selectedTeams, id => groupOf(id) ?? NO_GROUP);
  const counts = weekCounts(v.slots, cols?.days ?? []);
  const weeksShown = cols ? weeksOnScreen(cols.mode, cols.days, v.slots) : 1;
  const weekCount = (id: string) => perWeek(counts.get(id) ?? 0, weeksShown);
  const byTeamTable = (
    <>
      <div className={`${repKit.tableFrame} ${repKit.deskOnly}`}>
        <table className={repKit.table} aria-label={W.viewTeam}>
          <thead>
            <tr>
              <th scope="col">{W.colTeam}</th>
              <th scope="col" className={repKit.num}>{W.colWeek}</th>
              <th scope="col" className={repKit.num}>{W.colSlots}</th>
              <th scope="col" className={repKit.num}>{W.colHours}</th>
              <th scope="col" className={repKit.num}>{W.colPrimeTime}</th>
              <th scope="col">{W.colNights}</th>
              <th scope="col" className={repKit.go}><span className={repKit.srOnly}>Open</span></th>
            </tr>
          </thead>
          <tbody>
            {[...teamGroups].flatMap(([key, g]) => [
              ...(banded ? [(
                <tr key={`b-${key}`} className={repKit.band}>
                  <td colSpan={7}>{W.bandGroup(g.name, g.teams.length, g.teams.reduce((n, t) => n + (resultOf(t.id)?.got ?? 0), 0))}</td>
                </tr>
              )] : []),
              ...g.teams.map(t => {
                const r = resultOf(t.id);
                return (
                  <tr key={t.id} className={repKit.rowOpens} onClick={() => setWin({ kind: 'team', teamId: t.id })}>
                    <td><span className={sch.nameCell}><Swatch colour={colourOf(t.id)} /><button type="button" className={`${repKit.nameButton} ${repKit.nameLink}`} onClick={e => { e.stopPropagation(); setWin({ kind: 'team', teamId: t.id }); }}>{t.name}</button></span></td>
                    <td className={repKit.num}>{weekCount(t.id)}</td>
                    <td className={repKit.num}>{r?.shared ? W.sharedCount(r.got, r.shared) : r?.got ?? 0}</td>
                    <td className={repKit.num}>{W.hours((r?.pricedMinutes ?? 0) / 60)}</td>
                    <td className={repKit.num}>{hasPrime ? <>{r?.prime ?? 0}<span className={repKit.cellSub}>{pct(r?.prime ?? 0, r?.got ?? 0)}</span></> : W.noTime}</td>
                    <td>{nightsWords(r?.nights ?? [])}</td>
                    <td className={repKit.go}><span className={repKit.goLink} aria-hidden><ChevronRight size={16} /></span></td>
                  </tr>
                );
              }),
            ])}
          </tbody>
        </table>
      </div>
      <div className={repKit.phoneOnly}>{phoneByTeam()}</div>
    </>
  );
  function phoneByTeam() {
    return (
      <div className={sch.pday}>
        {[...teamGroups].map(([key, g]) => (
          <div key={key}>
            {banded && <h3 className={sch.pdayHead}>{g.name}</h3>}
            {g.teams.map(t => {
              const r = resultOf(t.id);
              return (
                <button key={t.id} type="button" className={`${sch.prow} ${sch.prowButton}`} onClick={() => setWin({ kind: 'team', teamId: t.id })}>
                  <Swatch colour={colourOf(t.id)} />
                  <span className={sch.prowMain}>
                    <span className={sch.prowWho}>{t.name}</span>
                    <span className={sch.prowTime}>{[r?.shared ? W.sharedCount(r.got, r.shared) : W.rowSlots(r?.got ?? 0), W.rowPrime(r?.prime ?? 0), nightsWords(r?.nights ?? [])].join(' · ')}</span>
                  </span>
                  <ChevronRight size={16} aria-hidden />
                </button>
              );
            })}
          </div>
        ))}
      </div>
    );
  }
  const byGroupTable = (
    <div className={repKit.tableFrame}>
      <table className={repKit.table} aria-label={W.viewGroup}>
        <thead>
          <tr>
            <th scope="col">{W.colGroup}</th>
            <th scope="col" className={repKit.num}>{W.colTeams}</th>
            <th scope="col" className={repKit.num}>{W.colWeek}</th>
            <th scope="col" className={repKit.num}>{W.colSlots}</th>
            <th scope="col" className={repKit.num}>{W.colHours}</th>
            <th scope="col" className={repKit.num}>{W.colPrimeTime}</th>
          </tr>
        </thead>
        <tbody>
          {[...teamGroups].map(([key, g]) => {
            const rs = g.teams.map(t => resultOf(t.id)).filter((x): x is NonNullable<typeof x> => !!x);
            const got = rs.reduce((n, r) => n + r.got, 0);
            const prime = rs.reduce((n, r) => n + r.prime, 0);
            return (
              <tr key={key}>
                <td><b>{g.name}</b></td>
                <td className={repKit.num}>{g.teams.length}</td>
                <td className={repKit.num}>{perWeek(g.teams.reduce((n, t) => n + (counts.get(t.id) ?? 0), 0), weeksShown)}</td>
                <td className={repKit.num}>{got}</td>
                <td className={repKit.num}>{W.hours(rs.reduce((n, r) => n + r.pricedMinutes / 60, 0))}</td>
                <td className={repKit.num}>{hasPrime ? <>{prime}<span className={repKit.cellSub}>{pct(prime, got)}</span></> : W.noTime}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className={repKit.notes}>{`${pluralize(weeks, 'week')} · ${pluralize(v.fairness.totals.handedOut, 'slot')} handed out of ${v.fairness.totals.seats}.`}</p>
    </div>
  );

  // ── A phone's week: one frame a day, its slots as hairlined rows (C13) ──
  // A phone's Day (owner, 2026-10-12): one day, the arrows stepping only through the dates with slots; the label lists them.
  const dayAt = shownDay ? days.indexOf(shownDay) : -1;
  const phoneDayView = shownDay && (
    <>
      <ScopeNav placement="row" label={W.phoneDayLabel(shownDay, today)}
        caption={W.phoneDayCaption(v.slots.filter(x => x.day === shownDay).length, v.slots.filter(x => x.day === shownDay && !x.teamIds.length).length)}
        choices={days.map(d => ({ key: d, label: W.phoneDayLabel(d, today) }))} value={shownDay} onChoose={setPhoneDay}
        prev={dayAt > 0 ? days[dayAt - 1] : null} next={dayAt >= 0 && dayAt < days.length - 1 ? days[dayAt + 1] : null}
        prevLabel={W.previousDay} nextLabel={W.nextDay} menuTitle={W.chooseDay} />
      {[shownDay].map(d => {
        const list = v.slots.filter(x => x.day === d).sort((a, b) => a.startsAt.localeCompare(b.startsAt) || placeOfSlot(a).localeCompare(placeOfSlot(b), 'en-CA', { numeric: true }));
        if (!list.length) return null;
        // The day is named once, by the picker above; the frame holds its slots.
        return (
          <section key={d} className={sch.pday} aria-label={formatShortWeekdayDate(d)}>
            {list.map(x => (
              <button key={x.key} type="button" className={`${sch.prow} ${sch.prowButton}`} onClick={() => setWin({ kind: 'slot', key: x.key })} data-slot-chip>
                {x.teamIds[0] ? <Swatch colour={colourOf(x.teamIds[0])} /> : <span className={sch.swatchEmpty} aria-hidden />}
                <span className={sch.prowMain}>
                  <span className={sch.prowTime}>{slotTime(x)} · {placeOfSlot(x)}</span>
                  <span className={`${sch.prowWho}${x.teamIds.length ? '' : ` ${sch.prowOpen}`}`}>{x.teamIds.length ? x.teamIds.map(nameOf).join(' · ') : W.openSlot}</span>
                </span>
                {/* An asked Sunday (D1): the amber pill, Hand back's glyph and its words at the row's end — what waits on someone. */}
                {asked.has(x.id) && <RepChip tone="warn"><Undo2 size={12} aria-hidden />{H.pill}</RepChip>}
              </button>
            ))}
          </section>
        );
      })}
    </>
  );

  const slotWin = win?.kind === 'slot' || win?.kind === 'swap' ? slotOfKey(win.key) : null;
  const slotAsk = slotWin ? asked.get(slotWin.id) ?? null : null;

  // Fair shares' figures answer for the whole schedule; its team detail opens from the band's Bill tile (13c C4).
  const fair = cols ? fairShares({ view: v, week: cols.days, weeks: weeksShown, scope: weekScope, nameOf, placeOf: (a, b) => placeName(v.places, a, b) }) : null;
  // The band counts the family (Handed out, Short, Clashes); Fair shares and the bill — the window — is the schedule's own
  // bill, so it reads the schedule's own view (Phase 8: a part's bill is set in Send the changes).
  const fairOwn = !parts.length ? fair : cols ? fairShares({ view: own, week: cols.days, weeks: weeksShown, scope: weekScope, nameOf, placeOf: (a, b) => placeName(own.places, a, b) }) : null;
  const canOverview = final && oneWeekday != null && days.length > 1;
  const desktopViews: { id: Lens; label: string }[] = [
    ...(canOverview ? [{ id: 'overview' as const, label: W.viewOverview }] : []),
    { id: 'grid', label: W.viewGrid }, { id: 'team', label: W.viewTeam },
    { id: 'group', label: W.viewGroup },
  ];
  /** An Overview row opens the Grid on its day — its facility, or every facility for a pulled date (13c, rowKey null). */
  const openOverviewDate = (rowKey: string | null, day: string) => {
    setFacilityFilter(new Set(rowKey ? [rowKey] : []));
    setGroupFilter(new Set());
    setTeamFilter(new Set());
    setClashesOnly(false);
    setCursor(day);
    setLens('grid');
  };

  return (
    <div className={ck.pageWide}>
      {header}
      {/* ⚖ 13c Session C (C4 = A): the page is the path — each permit behind its rows is a door in the top line, in the order
          its time starts ("From the permits A › and B ›"; a schedule on several permits, tab 6). No path line. On a phone
          each door is its own 44 px row, so the joining words go. */}
      <p className={sch.meta}>
        {v.fromPermits.length > 0 && permitsLink && <>
          {v.fromPermits.length === 1 ? W.metaFrom : W.metaFromMany}{' '}
          {v.fromPermits.map((fp, i) => (
            <Fragment key={fp.id}>
              {!isPhone && i > 0 && (i === v.fromPermits.length - 1 ? ' and ' : ', ')}
              <Link href={permitDoor(permitsLink.href, [fp.id])} className={`${sch.door} ${sch.metaDoor}`} data-permit-door>{fp.name} ›</Link>
            </Fragment>
          ))}
          {' · '}
        </>}
        {meta}
      </p>
      {firstPart && (
        <p className={sch.meta} data-part-line>
          {parts.length > 1 ? (
            <button type="button" className={`${sch.door} ${sch.metaDoor}`} onClick={openPartFilter}>{P.metaMore(firstPart.label, parts.length - 1)} ›</button>
          ) : <>
            {firstPart.label}
            {firstPart.view.fromPermits.length > 0 && permitsLink && <>
              {' · '}{firstPart.view.fromPermits.length === 1 ? W.metaFrom : W.metaFromMany}{' '}
              {firstPart.view.fromPermits.map((fp, i) => (
                <Fragment key={fp.id}>
                  {!isPhone && i > 0 && (i === firstPart.view.fromPermits.length - 1 ? ' and ' : ', ')}
                  <Link href={permitDoor(permitsLink.href, [fp.id])} className={`${sch.door} ${sch.metaDoor}`} data-permit-door>{fp.name} ›</Link>
                </Fragment>
              ))}
            </>}
            {' · '}{partLine}
          </>}
        </p>
      )}
      {failed && <LoadFailed title={failed.text} onRetry={() => void load()} />}
      {reviewCallout}
      <ScheduleAttention asks={v.asks} slots={v.slots} places={v.places} canMoney={v.canMoney}
        changed={final && s.changedSinceSent} sentOn={formatStoredDate(s.sent?.at ?? '', { withYear: false })}
        changeTeams={changeTeams} partNotes={partNotes} outside={outsideRows} onAnswer={id => setWin({ kind: 'answer', id })}
        onSend={() => setWin({ kind: 'send', start: 'changes' })}
        unbilledParts={unbilledSent} onBillPart={own.canMoney && canChange ? id => setWin({ kind: 'bill', partId: id }) : undefined}
        onFreePart={own.canMoney && canChange ? id => void markPartFree(id) : undefined} />
      {!isPhone && fair && <FairSharesBand model={fair} onOpen={() => setWin({ kind: 'fair' })} />}

      {isPhone ? (
        <>
          <div className={`${sch.lensLine} ${sch.phoneLensLine}`}>
            <ViewSwitch views={[{ id: 'grid', label: W.phoneDay }, { id: 'team', label: W.viewTeam }]} value={lens === 'team' || lens === 'group' ? 'team' : 'grid'}
              onChange={next => setLens(next)} label="Read the schedule" />
            <span className={sch.spacer} />
            {tools}
          </div>
          {lens === 'team' || lens === 'group' ? phoneByTeam() : phoneDayView}
        </>
      ) : (
        <div className={lens === 'grid' ? sch.gridRunway : undefined}>
        <section className={sch.scheduleWorkspace} aria-labelledby="read-schedule-title">
          <div className={sch.scheduleWorkspaceHead}>
            <div><h2 id="read-schedule-title">Read the schedule</h2><p>{canOverview ? 'Start with the repeating pattern; open Grid for a date or an edit.' : 'Choose a view to inspect this schedule.'}</p></div>
          </div>
          {/* ⚖ Toolbar Rules, Rules 1–3 (Stage 3, 2026-10-19): which view and which week on the left, the narrowings (grid
              only) right of the gap, then Tools · Export · Send, the order this page has always kept (Rule 3). A line too
              narrow drops the right-hand group whole; the view never wraps. ⚖ THE VIEWS ARE THE OLIVE VIEW PILL (owner
              2026-10-19, on /design's review): four or five views, and the 6c rule gives four or more the pill, not a
              switch — the switch it replaces sat in the head above, and in the toolbar its equal pills ran ~530px. The
              phone keeps its two-view Day · Team switch. */}
          <CoachListToolbar
            actions={(
              <>
                {tools}
                {exportMenu}
                {draft && <button type="button" className="btn btn-lime" onClick={() => setWin({ kind: 'send', start: 'draft' })}>{W.send}</button>}
              </>
            )}
            filters={(lens === 'grid' || (lens === 'team' && partOptions.length > 0)) && (
              <>
                <FilterGroup>
                  {lens === 'grid' && <MultiSelectDropdown restQuiet label={W.facilityPill} options={facilityOptions} selected={facilityFilter} onChange={setFacilityFilter} allLabel={W.everyFacility} />}
                  {lens === 'grid' && groupOptions.length > 0 && <MultiSelectDropdown restQuiet label={W.groupPill} options={groupOptions} selected={selectedGroups} onChange={changeGroups} allLabel={W.everyGroup} />}
                  {lens === 'grid' && <MultiSelectDropdown restQuiet label={W.teamPill} options={teamOptions} selected={selectedTeams} onChange={setTeamFilter} allLabel={W.everyTeam} />}
                  {/* The Part filter (Phase 8): only on a schedule with time added; the meta line's "and 2 more ›" opens it. */}
                  {partOptions.length > 0 && (
                    <span data-part-filter>
                      <MultiSelectDropdown restQuiet label={P.partPill} options={partOptions} selected={selectedParts} onChange={setPartFilter} allLabel={P.everyPart} />
                    </span>
                  )}
                </FilterGroup>
                {clashPill}
              </>
            )}
          >
            <SingleSelectDropdown label="View" lead options={desktopViews} value={lens} onChange={next => setLens(next as Lens)} />
            {dateNav}
          </CoachListToolbar>
          <p className={repKit.srOnly} role="status" aria-live="polite">{refused}</p>
          {lens === 'overview' && cols && <>
            {fair && <FairSharesLines model={fair} lead={outsideWords?.lead} />}
            <ScheduleOverview rows={allRows} days={cols.days} slots={v.slots} askedIds={askedIds}
              nameOf={nameOf} onOpenGrid={openOverviewDate} outsideDays={outsideDays} />
          </>}
          {lens === 'grid' && cols ? (
            <>
              {fair && <FairSharesLines model={fair} lead={outsideWords?.lead} />}
              <ScheduleGrid
                view={v} days={cols.days} rows={rows} canDrag={canChange && !busy} dim={dim} moved={moved} asked={asked} today={today}
                nameOf={nameOf} colourOf={colourOf} groupOf={groupOf} sharing={sharing}
                onOpen={x => setWin({ kind: 'slot', key: x.key })}
                onDrop={onDrop}
                onRefused={reason => { setRefused(reason); say(reason); }}
              />
            </>
          ) : lens === 'team' ? byTeamTable : lens === 'group' ? byGroupTable : null}
        </section>
        </div>
      )}

      {pending && (
        <WhichWeeks view={memberView(own, parts, pending.from.partId)} move={pending} sharing={sharing} nameOf={nameOf} placeOf={placeOfSlot} onPick={pickWeeks} onCancel={() => setPending(null)} />
      )}
      {win?.kind === 'slot' && slotWin && (
        // A part's practice reads in its part's own view: Give it to lists only that part's teams (Phase 8, tab 4 note 4).
        <SlotWindow view={memberView(own, parts, slotWin.partId)} part={slotWin.partId ? parts.find(x => x.id === slotWin.partId)?.label ?? null : null} slot={slotWin} sharing={sharing} nameOf={nameOf} colourOf={colourOf} placeOf={placeOfSlot} busy={busy} canChange={canChange}
          ask={slotAsk}
          onAnswer={v.canMoney && slotAsk ? () => setWin({ kind: 'answer', id: slotAsk.id }) : undefined}
          onClose={() => setWin(null)}
          onChangeTeams={teamIds => { setWin(null); void edit([{ slotKey: slotWin.key, teamIds }], W.teamChanged(teamIds.length ? teamIds.map(nameOf).join(' · ') : null, `${formatShortWeekdayDate(slotWin.day)} · ${slotTime(slotWin)}`)); }}
          onLock={locked => { setWin(null); void edit([{ slotKey: slotWin.key, locked }], locked ? W.lockedWeek(1) : W.unlocked, { mark: false }); }}
          onSwap={() => setWin({ kind: 'swap', key: slotWin.key })}
          onClear={() => { setWin(null); void edit([{ slotKey: slotWin.key, teamIds: [] }], W.cleared(1)); }} />
      )}
      {win?.kind === 'swap' && slotWin && (
        <SwapWindow view={memberView(own, parts, slotWin.partId)} slot={slotWin} nameOf={nameOf} placeOf={placeOfSlot} onClose={() => setWin(null)}
          onPick={to => { setWin(null); setPending({ from: slotWin, to, teamId: slotWin.teamIds[0], at: { left: window.innerWidth / 2 - 150, top: window.innerHeight / 3 } }); }} />
      )}
      {/* Settings… or Regenerate of one added part (ruling 4): its own view, its own address; the window's eyebrow is the
          part's name ("Fall practices · Time added Nov 16"). A regenerate of one part never touches another. */}
      {win?.kind === 'settings' && (
        <NewScheduleWindow q={q} orgSlug={slug} orgName={currentOrg?.name} onCancel={() => setWin(null)}
          settingsOf={{
            view: winPart?.view ?? own, regenerate: win.regenerate, addDatesOff: win.addDatesOff, addTime: win.addTime, parts, onStale: () => void load(),
            part: partWords,
            onKept: (_version, renamed, said) => { setWin(null); setMoved(new Set()); say(said ?? (renamed ? W.regenerated(winName) : W.regeneratedNotRenamed(winName))); void load(); },
          }} />
      )}
      {win?.kind === 'which' && (
        <WhichPartWindow then={win.then} parentName={own.schedule.name} parentView={own} parts={parts}
          onClose={() => setWin(null)}
          onPick={partId => setWin({ kind: 'settings', regenerate: win.then === 'regenerate', partId: partId ?? undefined })} />
      )}
      {/* ⚖ 13c Session C (C4 = A): Fair shares and the bill, in a window — the team table and its bill door. A reader
          without the club's money reads Fair shares alone (the window is titled so), and nobody lost the view. */}
      {win?.kind === 'fair' && fairOwn && (
        <KitDialog kind="form" size="wide" eyebrow={s.name} title={v.canMoney ? W.fairBillTitle : W.fairTitle} onClose={() => setWin(null)}>
          {/* The bill's door is the money reader's: before Finalize the bill rides with the schedule, once it exists it reads, and a
              schedule finalized WITHOUT one can still be billed (Send the bill; the schedule stays final) — if any rep team holds
              time on it (a schedule given wholly to house league has nothing to bill). */}
          <FairSharesTeams model={fairOwn} nameOf={nameOf} colourOf={colourOf}
            onBill={own.canMoney && (!final || !!own.bill || own.slots.some(x => x.teamIds.some(id => teamById.has(id)))) ? () => setWin({ kind: 'bill' }) : undefined} />
        </KitDialog>
      )}
      {/* An added part's bill (Session 3, drawing tab 5): opened from Send the changes' "Bill it…", it goes back there. */}
      {win?.kind === 'bill' && (
        <BillWindow q={q} view={winPart?.view ?? own} addedPart={partWords} nameOf={nameOf}
          onClose={billBack} onStale={() => void load()}
          onSaved={text => { billBack(); if (!billBacksToSend) say(text); void load(); }}
          onReview={terms => setWin({ kind: 'send', start: 'bill', bill: terms, partId: winPart?.id })} />
      )}
      {win?.kind === 'send' && (
        <SendWindow q={q} view={memberView(own, parts, win.partId)} start={win.start} bill={win.bill} onClose={() => setWin(null)} onStale={() => void load()}
          onSent={text => { setWin(null); setMoved(new Set()); say(text); void load(); }}
          keep={win.keep} canMoney={own.canMoney}
          onBillPart={own.canMoney ? (partId, keep) => setWin({ kind: 'bill', partId, back: 'send', keep }) : undefined} />
      )}
      {win?.kind === 'log' && <SendLogWindow view={own} log={own.sendLog} nameOf={nameOf} onClose={() => setWin(null)} />}
      {/* The one Answer window (Stage 11d, Ask 4) — the same from every door: Payment requests, the bell, this page. */}
      {win?.kind === 'answer' && (
        <AnswerWindow q={q} handBackId={win.id} onClose={() => setWin(null)} onDone={text => { setWin(null); say(text); void load(); }} />
      )}
      {win?.kind === 'team' && (
        <TeamSlotsWindow view={v} teamId={win.teamId} nameOf={nameOf} placeOf={placeOfSlot} onClose={() => setWin(null)}
          onOpenSlot={x => setWin({ kind: 'slot', key: x.key })} />
      )}
      {win?.kind === 'clearWeek' && cols && (
        <KitDialog kind="question" title={W.clearWeekTitle(cols.range, cols.mode === 'dates')} onClose={() => setWin(null)} busy={busy}
          footer={(
            <>
              <button type="button" className="btn btn-outline" onClick={() => setWin(null)} disabled={busy}>{W.regenKeep}</button>
              <button type="button" className="btn btn-lime" onClick={clearWeek} disabled={busy}>{W.clearWeekGo(weekScope)}</button>
            </>
          )}>
          <p>{W.clearWeekBody(unlockedHeld.length, weekScope)}</p>
        </KitDialog>
      )}
      {win?.kind === 'delete' && (
        <KitDialog kind="question" title={W.deleteTitle(s.name)} onClose={() => setWin(null)} busy={busy}
          footer={(
            <>
              <button type="button" className="btn btn-outline" onClick={() => setWin(null)} disabled={busy}>{W.regenKeep}</button>
              <button type="button" className="btn btn-danger" onClick={() => void deleteDraft()} disabled={busy}>{W.deleteGo}</button>
            </>
          )}>
          <p>{W.deleteBody}</p>
          {review && <p>{W.deleteReview}</p>}
        </KitDialog>
      )}
      {notice && (
        <NoticePill key={notice.id} message={notice.text} onDone={() => setNotice(null)} news={!notice.undo}
          action={notice.undo ? { label: W.undo, onAction: () => void undo(notice.undo!) } : undefined} />
      )}
    </div>
  );
}

