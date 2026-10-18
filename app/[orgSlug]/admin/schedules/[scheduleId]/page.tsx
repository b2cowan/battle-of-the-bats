'use client';
/**
 * Club schedule detail. A compact attention queue precedes the whole-schedule Fair shares band.
 * Sent one-weekday schedules open on a read-only Overview of the current dates; Grid remains the
 * date and edit surface. By team, By group, and Fair shares are alternate desktop views.
 * Phones keep Day and By team. The route supplies the Accounting gate for money and Answer.
 * See docs/projects/active/CLUB_SCHEDULE_LANDING_UX_PLAN.md for the reviewed presentation.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, ChevronRight, MoreHorizontal, Undo2 } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { jsonInit, moneyFetch, refusalText } from '@/lib/money-fetch';
import { formatStoredDate, formatShortWeekdayDate, tournamentToday } from '@/lib/timezone';
import { formatTime, joinWithAnd, pluralize } from '@/lib/utils';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import ExportMenu from '@/components/admin/ExportMenu';
import { CoachListToolbar } from '@/components/coaches/kit';
import { CoachToolbarMenu, CoachToolbarMenuItem } from '@/components/coaches/CoachToolbarMenu';
import MultiSelectDropdown from '@/components/coaches/MultiSelectDropdown';
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
import SendWindow from '@/components/admin/kit/club/schedules/SendWindow';
import AnswerWindow from '@/components/admin/kit/club/money/AnswerWindow';
import { SendLogWindow, SlotWindow, SwapWindow, TeamSlotsWindow, WhichWeeks, type PendingMove, type SendLogRow } from '@/components/admin/kit/club/schedules/ScheduleWindows';
import { ScheduleStateChip, Swatch } from '@/components/admin/kit/club/schedules/ScheduleParts';
import sch from '@/components/admin/kit/club/schedules/Schedules.module.css';
import { exportScheduleFile } from '@/lib/export/club-schedule-export';
import { planMove, type WeeksScope } from '@/lib/club-schedule-engine';
import { sharingPools } from '@/lib/club-schedule-settings';
import { matchesScheduleTeamFilter } from '@/lib/club-schedule-overview';
import { SCHEDULE_REFUSALS as R, SCHEDULE_SCREEN_WORDS as W } from '@/lib/club-schedule-words';
import { HAND_BACK_WORDS as H } from '@/lib/club-hand-back-words';
import { fetchDoorNote } from '@/lib/needs-attention-door';
import { facilityListWords, weekdayPlural } from '@/lib/permit-words';
import {
  NO_GROUP, askedSlots, dropLanding, engineSlotsOf, firstCursor, gridColumns, nightsWords, oneWeekdayOf, openingDay, pct, perWeek, placeName, placeRows, scheduleDates,
  slotDays, slotTime, stepGrid, teamColour, weekCounts, weeksOnScreen, type ScheduleView, type SlotView,
} from '@/lib/club-schedule-view';

interface PageRead extends ScheduleView {
  replies: { teamId: string; answer: 'looks_good' | 'ask_for_change'; words: string | null; at: string }[];
  sendLog: SendLogRow[];
  changes: { teams: { teamId: string; teamName: string; lines: string[] }[] };
}

type Win =
  | { kind: 'slot'; key: string }
  | { kind: 'swap'; key: string }
  | { kind: 'settings'; regenerate?: boolean }
  | { kind: 'bill' }
  | { kind: 'send'; start: 'draft' | 'final' | 'changes' }
  | { kind: 'log' }
  | { kind: 'team'; teamId: string }
  | { kind: 'clearWeek' }
  | { kind: 'delete' }
  | { kind: 'answer'; id: string };

type Lens = 'overview' | 'grid' | 'team' | 'group' | 'fair';

/** One slot as it was before a change — what Undo puts back exactly. */
interface Before { slotId: string; teamIds: string[]; locked: boolean; movedByHand: boolean }

/** A change line after its team's name: "gains Sun, …", "no longer Sun, …" — a moved line starts with its day, which keeps
 *  its capital ("15U AAA · Sun, Dec 13, …"; it read "sun, Dec 13" — found building Stage 11d part B). */
const lowerFirst = (s: string) => (s && !/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);

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
  usePageTitle(read?.schedule.name ?? W.title);
  const [lens, setLens] = useState<Lens>('grid');
  const initializedSchedule = useRef<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [phoneDay, setPhoneDay] = useState<string | null>(null);
  const [facilityFilter, setFacilityFilter] = useState<Set<string>>(() => new Set());
  const [groupFilter, setGroupFilter] = useState<Set<string>>(() => new Set());
  const [teamFilter, setTeamFilter] = useState<Set<string>>(() => new Set());
  const [clashesOnly, setClashesOnly] = useState(false);
  const [win, setWin] = useState<Win | null>(null);
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
    setRead(r.data);
    if (initializedSchedule.current !== r.data.schedule.id) {
      initializedSchedule.current = r.data.schedule.id;
      setLens(r.data.schedule.state === 'final' && oneWeekdayOf(r.data.slots) != null && slotDays(r.data.slots).length > 1 ? 'overview' : 'grid');
    }
    const { startsOn, endsOn } = r.data.schedule;
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

  // ── Names, colours, places — looked up by id, once per read ──
  const teamById = useMemo(() => new Map((read?.teams ?? []).map(t => [t.id, t])), [read]);
  const slotByKey = useMemo(() => new Map((read?.slots ?? []).map(x => [x.key, x])), [read]);
  const nameOf = useCallback((id: string) => teamById.get(id)?.name ?? 'A team', [teamById]);
  const colourOf = useCallback((id: string) => teamColour(read?.teams ?? [], id), [read]);
  const groupOf = useCallback((id: string) => teamById.get(id)?.groupId ?? null, [teamById]);
  const placeOfSlot = useCallback((x: Pick<SlotView, 'venueId' | 'facilityId'>) => placeName(read?.places ?? [], x.venueId, x.facilityId), [read]);
  // The schedule's sharing rules read against its teams: a slot's room (Stage 11c) — the moves, the drop and the slot window.
  const sharing = useMemo(() => sharingPools(read?.schedule.settings.rules.sharing ?? [], read?.teams ?? []), [read]);
  // The Sundays a waiting ask counts, by slot id — ringed on the grid, marked on a phone's Day, named in the slot window.
  const asked = useMemo(() => askedSlots(read?.asks ?? []), [read]);
  const askedIds = useMemo(() => new Set(asked.keys()), [asked]);

  const oneWeekday = useMemo(() => (read ? oneWeekdayOf(read.slots) : null), [read]);
  const range = read && cursor ? { startsOn: read.schedule.startsOn, endsOn: read.schedule.endsOn, oneWeekday, cursor } : null;
  const cols = range ? gridColumns(range) : null;
  const allRows = useMemo(() => (read ? placeRows(read.places, read.slots) : []), [read]);
  const rows = facilityFilter.size ? allRows.filter(r => facilityFilter.has(r.key)) : allRows;
  const weekSet = new Set(cols?.days ?? []);
  const weekClashes = read ? read.slots.filter(x => weekSet.has(x.day) && x.clash).length : 0;
  // A phone's Day: the dates with slots; the day picked, or where it opens (today's, or the next with slots).
  const days = useMemo(() => (read ? slotDays(read.slots) : []), [read]);
  const shownDay = phoneDay && days.includes(phoneDay) ? phoneDay : read ? openingDay(days, read.schedule.startsOn, read.schedule.endsOn, today) : null;

  // ── Writes: every hand edit, its Undo ──
  const slotOfKey = (key: string) => slotByKey.get(key) ?? null;
  async function edit(edits: { slotKey: string; teamIds?: string[]; locked?: boolean }[], text: string, opts: { mark?: boolean } = {}) {
    if (!read || busy || !edits.length) return;
    const before: Before[] = edits.map(e => slotOfKey(e.slotKey)).filter((x): x is SlotView => !!x).map(x => ({ slotId: x.id, teamIds: x.teamIds, locked: x.locked, movedByHand: x.movedByHand }));
    setBusy(true);
    try {
      const r = await moneyFetch<{ version: number }>(`/api/admin/schedules/${encodeURIComponent(read.schedule.id)}?${q}`, jsonInit('PATCH', {
        action: 'edit', version: read.schedule.version,
        edits: edits.map(e => ({ slotId: slotOfKey(e.slotKey)!.id, ...(e.teamIds ? { teamIds: e.teamIds } : {}), ...(e.locked !== undefined ? { locked: e.locked } : {}) })),
      }));
      if (!r.ok) { say(refusalText(r.data, R.notSaved)); await load(); return; }
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
      const r = await moneyFetch<{ version: number }>(`/api/admin/schedules/${encodeURIComponent(read.schedule.id)}?${q}`, jsonInit('PATCH', {
        action: 'edit', undo: true, version: read.schedule.version, edits: before,
      }));
      if (!r.ok) { say(refusalText(r.data, R.notSaved)); await load(); return; }
      const ids = new Set(before.map(b => b.slotId));
      const keys = new Set(read.slots.filter(x => ids.has(x.id)).map(x => x.key));
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
    setPending({ from: d.from, to: d.to, teamId: d.teamId, at: d.at });
  }
  function pickWeeks(scope: WeeksScope) {
    if (!read || !pending) return;
    const m = pending;
    setPending(null);
    const plan = planMove(engineSlotsOf(read.slots), new Map(read.slots.map(x => [x.key, x.teamIds])), {
      fromKey: m.from.key, toKey: m.to.key, teamId: m.teamId, scope, sharing,
    });
    if (!plan.edits.length) { say(W.skipped(plan.skipped.length || 1, W.skippedWhy[plan.skipped[0]?.why ?? 'no_slot'])); return; }
    const moved = new Set(plan.moved);
    const toDays = read.slots.filter(x => moved.has(x.week) && x.weekday === m.to.weekday && x.startClock === m.to.startClock
      && x.venueId === m.to.venueId && x.facilityId === m.to.facilityId).map(x => x.day).sort();
    const landing = dropLanding(m.from, m.to, m.teamId, sharing);
    const swapWith = landing?.kind === 'swap' ? landing.withTeam : null;
    const where = `${formatShortWeekdayDate(m.to.day).split(',')[0]}, ${formatTime(m.to.startClock)} · ${placeOfSlot(m.to)}`;
    const span = toDays.length > 1 ? `${formatStoredDate(toDays[0], { withYear: false })} – ${formatStoredDate(toDays[toDays.length - 1], { withYear: false })}` : null;
    const why = plan.skipped.length ? ` ${W.skipped(plan.skipped.length, W.skippedWhy[plan.skipped[0].why])}` : '';
    void edit(plan.edits, `${swapWith ? W.swapped(nameOf(m.teamId), nameOf(swapWith)) : W.moved(nameOf(m.teamId), where, span)}${why}`);
  }

  // ── Tools ──
  const weekSlots = read ? read.slots.filter(x => weekSet.has(x.day)) : [];
  /** The week's handed-out slots no lock holds — what Lock this week and Clear this week reach, and the question counts. */
  const unlockedHeld = weekSlots.filter(x => x.teamIds.length && !x.locked);
  const weekScope = cols?.mode === 'dates' && oneWeekday ? W.scopeDates(oneWeekday) : W.scopeWeek;
  const lockWeek = () => {
    if (!unlockedHeld.length) { say(W.nothingToLock(weekScope)); return; }
    void edit(unlockedHeld.map(x => ({ slotKey: x.key, locked: true })), W.lockedWeek(unlockedHeld.length), { mark: false });
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

  const header = (
    <AdminPageHeader
      backTo={{ href: `/${slug}/admin/schedules`, label: W.back }}
      title={read?.schedule.name ?? W.title}
      titleChips={read ? <ScheduleStateChip state={read.schedule.state} changed={read.schedule.changedSinceSent} /> : undefined}
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
  const v = read!;
  const s = v.schedule;
  const draft = s.state === 'draft';
  const review = s.state === 'in_review';
  const final = s.state === 'final';
  const canChange = !isPhone;

  // ── The head's facts ──
  const placeWords = v.places.map(p => {
    const names = p.facilities.filter(f => v.slots.some(x => x.facilityId === f.id)).map(f => f.name);
    return names.length ? `${p.venueName} · ${names.length >= 3 ? facilityListWords(names) : names.join(', ')}` : p.venueName;
  }).join('; ');
  const dates = oneWeekday ? `${weekdayPlural(oneWeekday)}, ${scheduleDates(s.startsOn, s.endsOn)}` : scheduleDates(s.startsOn, s.endsOn);
  const teamsInSlots = v.teams.filter(t => v.slots.some(x => x.teamIds.includes(t.id)));
  const meta = final && s.sent ? W.metaSent(placeWords, dates, formatStoredDate(s.sent.at, { withYear: false }), s.sent.by)
    : review && s.sent ? W.metaReview(placeWords, dates, formatStoredDate(s.sent.at, { withYear: false }), s.sent.by)
    : W.meta(placeWords, dates, teamsInSlots.length);

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
  const changeLines = v.changes.teams.flatMap(t => t.lines.map(l => W.changeTeamLine(t.teamName, lowerFirst(l))));

  // ── Export ──
  const exportInput = () => ({
    q, orgSlug: slug, orgName: currentOrg?.name, name: s.name, draftLabel: null, state: s.state,
    sentWords: s.sent ? `${final ? 'Final' : 'In review'}, sent ${formatStoredDate(s.sent.at, { withYear: false })}${s.sent.by ? ` by ${s.sent.by}` : ''}` : null,
    startsOn: s.startsOn, endsOn: s.endsOn, places: v.places,
    teams: v.teams.map(t => ({ id: t.id, name: t.name, groupName: t.groupName })),
    slots: v.slots.map(x => ({ ...x, handedBackTeamId: x.handedBack?.teamId ?? null })),
    datesOff: v.time.datesOff, pricing: v.pricing,
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
      {canChange && <CoachToolbarMenuItem label={W.toolSettings} hint={W.toolSettingsHint} onSelect={() => setWin({ kind: 'settings' })} />}
      {canChange && <CoachToolbarMenuItem label={W.toolRegenerate} onSelect={() => setWin({ kind: 'settings', regenerate: true })} />}
      {canChange && lens === 'grid' && <CoachToolbarMenuItem label={W.toolLockWeek(weekScope)} onSelect={lockWeek} />}
      {canChange && lens === 'grid' && <CoachToolbarMenuItem label={W.toolClearWeek(weekScope)} onSelect={() => setWin({ kind: 'clearWeek' })} />}
      <CoachToolbarMenuItem label={W.toolSendLog} onSelect={() => setWin({ kind: 'log' })} />
      {canChange && !final && <CoachToolbarMenuItem label={W.toolDelete} onSelect={() => setWin({ kind: 'delete' })} />}
    </CoachToolbarMenu>
  );
  const clashPill = (weekClashes > 0 || clashesOnly) && (
    <button type="button" className={sch.amberPill} aria-pressed={clashesOnly} onClick={() => setClashesOnly(on => !on)}>
      <AlertTriangle size={13} aria-hidden />{pluralize(weekClashes, 'clash', 'clashes')}
    </button>
  );
  const facilityOptions = allRows.map(r => ({ id: r.key, label: r.name }));

  // ── By team · By group (specimen 8) ──
  const weeks = new Set(v.slots.map(x => x.week)).size || 1;
  const hasPrime = !!v.schedule.settings.prime;
  const resultById = new Map(v.fairness.teams.map(r => [r.teamId, r]));
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
  const dim = (x: SlotView) => (clashesOnly && !x.clash)
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

  // Fair shares' figures answer for the whole schedule; its team detail has a visible view beside Grid.
  const fair = cols ? fairShares({ view: v, week: cols.days, weeks: weeksShown, scope: weekScope, nameOf, placeOf: (a, b) => placeName(v.places, a, b) }) : null;
  const canOverview = final && oneWeekday != null && days.length > 1;
  const desktopViews: { id: Lens; label: string }[] = [
    ...(canOverview ? [{ id: 'overview' as const, label: W.viewOverview }] : []),
    { id: 'grid', label: W.viewGrid }, { id: 'team', label: W.viewTeam },
    { id: 'group', label: W.viewGroup }, { id: 'fair', label: W.viewFairShares },
  ];
  const openOverviewDate = (rowKey: string, day: string) => {
    setFacilityFilter(new Set([rowKey]));
    setGroupFilter(new Set());
    setTeamFilter(new Set());
    setClashesOnly(false);
    setCursor(day);
    setLens('grid');
  };

  return (
    <div className={ck.pageWide}>
      {header}
      <p className={sch.meta}>{meta}</p>
      {failed && <LoadFailed title={failed.text} onRetry={() => void load()} />}
      {reviewCallout}
      <ScheduleAttention asks={v.asks} slots={v.slots} places={v.places} canMoney={v.canMoney}
        changed={final && s.changedSinceSent} sentOn={formatStoredDate(s.sent?.at ?? '', { withYear: false })}
        changeLines={changeLines} onAnswer={id => setWin({ kind: 'answer', id })}
        onSend={() => setWin({ kind: 'send', start: 'changes' })} />
      {!isPhone && fair && <FairSharesBand model={fair} />}

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
        <section className={sch.scheduleWorkspace} aria-labelledby="read-schedule-title">
          <div className={sch.scheduleWorkspaceHead}>
            <div><h2 id="read-schedule-title">Read the schedule</h2><p>{canOverview ? 'Start with the repeating pattern; open Grid for a date or an edit.' : 'Choose a view to inspect this schedule.'}</p></div>
            <ViewSwitch views={desktopViews} value={lens} onChange={setLens} label="Read the schedule" />
          </div>
          <CoachListToolbar actions={(
            <>
              {tools}
              {exportMenu}
              {draft && <button type="button" className="btn btn-lime" onClick={() => setWin({ kind: 'send', start: 'draft' })}>{W.send}</button>}
            </>
          )}>
            {dateNav}
            {lens === 'grid' && (
              <FilterGroup>
                <MultiSelectDropdown restQuiet label={W.facilityPill} options={facilityOptions} selected={facilityFilter} onChange={setFacilityFilter} allLabel={W.everyFacility} />
                {groupOptions.length > 0 && <MultiSelectDropdown restQuiet label={W.groupPill} options={groupOptions} selected={selectedGroups} onChange={changeGroups} allLabel={W.everyGroup} />}
                <MultiSelectDropdown restQuiet label={W.teamPill} options={teamOptions} selected={selectedTeams} onChange={setTeamFilter} allLabel={W.everyTeam} />
              </FilterGroup>
            )}
            {lens === 'grid' && clashPill}
          </CoachListToolbar>
          <p className={repKit.srOnly} role="status" aria-live="polite">{refused}</p>
          {lens === 'overview' && cols && <>
            {fair && <FairSharesLines model={fair} />}
            <ScheduleOverview rows={allRows} days={cols.days} slots={v.slots} askedIds={askedIds}
              nameOf={nameOf} onOpenGrid={openOverviewDate} />
          </>}
          {lens === 'grid' && cols ? (
            <>
              {fair && <FairSharesLines model={fair} />}
              <ScheduleGrid
                view={v} days={cols.days} rows={rows} canDrag={canChange && !busy} dim={dim} moved={moved} asked={asked} today={today}
                nameOf={nameOf} colourOf={colourOf} groupOf={groupOf} sharing={sharing}
                onOpen={x => setWin({ kind: 'slot', key: x.key })}
                onDrop={onDrop}
                onRefused={reason => { setRefused(reason); say(reason); }}
              />
            </>
          ) : lens === 'team' ? byTeamTable : lens === 'group' ? byGroupTable : lens === 'fair' && fair ? (
            <FairSharesTeams model={fair} nameOf={nameOf} colourOf={colourOf}
              onBill={v.canMoney && (v.bill || !final) ? () => setWin({ kind: 'bill' }) : undefined} />
          ) : null}
        </section>
      )}

      {pending && (
        <WhichWeeks view={v} move={pending} sharing={sharing} nameOf={nameOf} placeOf={placeOfSlot} onPick={pickWeeks} onCancel={() => setPending(null)} />
      )}
      {win?.kind === 'slot' && slotWin && (
        <SlotWindow view={v} slot={slotWin} sharing={sharing} nameOf={nameOf} colourOf={colourOf} placeOf={placeOfSlot} busy={busy} canChange={canChange}
          ask={slotAsk}
          onAnswer={v.canMoney && slotAsk ? () => setWin({ kind: 'answer', id: slotAsk.id }) : undefined}
          onClose={() => setWin(null)}
          onChangeTeams={teamIds => { setWin(null); void edit([{ slotKey: slotWin.key, teamIds }], W.teamChanged(teamIds.length ? teamIds.map(nameOf).join(' · ') : null, `${formatShortWeekdayDate(slotWin.day)} · ${slotTime(slotWin)}`)); }}
          onLock={locked => { setWin(null); void edit([{ slotKey: slotWin.key, locked }], locked ? W.lockedWeek(1) : W.unlocked, { mark: false }); }}
          onSwap={() => setWin({ kind: 'swap', key: slotWin.key })}
          onClear={() => { setWin(null); void edit([{ slotKey: slotWin.key, teamIds: [] }], W.cleared(1)); }} />
      )}
      {win?.kind === 'swap' && slotWin && (
        <SwapWindow view={v} slot={slotWin} nameOf={nameOf} placeOf={placeOfSlot} onClose={() => setWin(null)}
          onPick={to => { setWin(null); setPending({ from: slotWin, to, teamId: slotWin.teamIds[0], at: { left: window.innerWidth / 2 - 150, top: window.innerHeight / 3 } }); }} />
      )}
      {win?.kind === 'settings' && (
        <NewScheduleWindow q={q} orgSlug={slug} orgName={currentOrg?.name} onCancel={() => setWin(null)}
          settingsOf={{
            view: v, regenerate: win.regenerate, onStale: () => void load(),
            onKept: (_version, renamed) => { setWin(null); setMoved(new Set()); say(renamed ? W.regenerated(s.name) : W.regeneratedNotRenamed(s.name)); void load(); },
          }} />
      )}
      {win?.kind === 'bill' && (
        <BillWindow q={q} view={v} nameOf={nameOf} onClose={() => setWin(null)} onStale={() => void load()} onSaved={text => { setWin(null); say(text); void load(); }} />
      )}
      {win?.kind === 'send' && (
        <SendWindow q={q} view={v} start={win.start} onClose={() => setWin(null)} onStale={() => void load()} onSent={text => { setWin(null); setMoved(new Set()); say(text); void load(); }} />
      )}
      {win?.kind === 'log' && <SendLogWindow view={v} log={v.sendLog} nameOf={nameOf} onClose={() => setWin(null)} />}
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

