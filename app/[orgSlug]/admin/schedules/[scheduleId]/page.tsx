'use client';
/**
 * A SCHEDULE'S PAGE (Club Tier Stage 11a, part B — hub K4MPu4ni53Ct7yrDcmWJd9 → Mockups → Stages 10 + 11, specimens 6
 * "A week of the winter dome", 7 "Adjust by hand", 8 "Summaries", 9 "Send", 10 "Changed since sent", 13 "A phone", 14
 * steps 3–5; plan §5.4–§5.6, §5.9; Asks 12–14, 19, 23, 24, 27).
 *
 *   the head    — ← Schedules; the schedule's name and its ONE state chip (Draft · In review · the amber Changed since
 *                 sent); under it, where and when it is and how many teams (or when it was sent, and by whom).
 *   the callout — In review: the replies (who said it looks good, who asked for what in their words, who hasn't
 *                 answered) and Finalize and send, the line's one lime. Changed since sent: the white callout with the
 *                 amber edge listing what moved and Send the changes — the teams keep what they were told until then (Ask
 *                 14). Either way the line's own lime steps aside.
 *   the line    — ONE toolbar line (C4): Grid · By team · By group · the week ("‹ Jan 4 – 10, 2027 ›"; a one-weekday
 *                 schedule's seven dates, Ask 27) · Facility · Team · the amber clash pill (only when there is one) ·
 *                 "Times in Eastern time." · Tools (Settings… first, Regenerate the unlocked slots…, Lock this week, Clear
 *                 this week…, Send log, Delete this draft… — a draft's only, the build's addition: a draft that can't be
 *                 thrown away is a dead end) · Export (Excel first; Calendar once sent) · Send, the lime, on a draft.
 *   the body    — the grid (`ScheduleGrid`) and Fair shares beside it (`FairShares`); By team; By group.
 *   moving      — a drop asks which weeks (`WhichWeeks`); every change ends in the 8-second notice with Undo, which puts
 *                 the slots back exactly (their teams, their lock, whether a hand moved them). A slot moved by hand
 *                 locks itself (Ask 19) — the server's rule, never the page's.
 *
 * ⚖ A PHONE READS (§5.9): the head, the callouts (Send the changes is a confirm — the send's own window), Week (one frame
 * a day, its slots as hairlined rows — C13) · By team, and the send log. New schedule, dragging, the Tools that change
 * the time, and Finalize are ABSENT there — a door that dead-ends is the bug.
 * ⚖ WHO: the club's owner or an admin (`resolveScheduler`); a bill's figures read only to those who hold the club's
 * Accounting — the route strips them for anyone else, and the bill's door is absent.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, ChevronRight, MoreHorizontal } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { jsonInit, moneyFetch, refusalText } from '@/lib/money-fetch';
import { formatStoredDate, formatShortWeekdayDate, tournamentToday } from '@/lib/timezone';
import { formatTime, joinWithAnd, pluralize } from '@/lib/utils';
import { timesInZoneSentence } from '@/lib/timezone';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import ExportMenu from '@/components/admin/ExportMenu';
import { CoachListToolbar } from '@/components/coaches/kit';
import { CoachToolbarMenu, CoachToolbarMenuItem } from '@/components/coaches/CoachToolbarMenu';
import MultiSelectDropdown from '@/components/coaches/MultiSelectDropdown';
import FilterGroup from '@/components/coaches/FilterGroup';
import { ScheduleDateNav, ViewSwitch } from '@/components/coaches/ScheduleCalendarViews';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { EmptyCard, LoadFailed, NoticePill, PageLoading, repKit, useDeferredLoad, useLatestRead } from '@/components/admin/kit/club/RepKit';
import ScheduleGrid, { type GridDrop } from '@/components/admin/kit/club/schedules/ScheduleGrid';
import FairShares from '@/components/admin/kit/club/schedules/FairShares';
import NewScheduleWindow from '@/components/admin/kit/club/schedules/NewScheduleWindow';
import BillWindow from '@/components/admin/kit/club/schedules/BillWindow';
import SendWindow from '@/components/admin/kit/club/schedules/SendWindow';
import { SendLogWindow, SlotWindow, SwapWindow, TeamSlotsWindow, WhichWeeks, type PendingMove, type SendLogRow } from '@/components/admin/kit/club/schedules/ScheduleWindows';
import { ScheduleStateChip, Swatch } from '@/components/admin/kit/club/schedules/ScheduleParts';
import sch from '@/components/admin/kit/club/schedules/Schedules.module.css';
import { exportScheduleFile } from '@/lib/export/club-schedule-export';
import { planMove, type WeeksScope } from '@/lib/club-schedule-engine';
import { SCHEDULE_REFUSALS as R, SCHEDULE_SCREEN_WORDS as W } from '@/lib/club-schedule-words';
import { facilityListWords, weekdayPlural } from '@/lib/permit-words';
import {
  NO_GROUP, engineSlotsOf, firstCursor, gridColumns, nightsWords, oneWeekdayOf, pct, perWeek, placeName, placeRows, scheduleDates,
  slotTime, stepGrid, teamColour, weekCounts, weeksOnScreen, type ScheduleView, type SlotView,
} from '@/lib/club-schedule-view';

interface PageRead extends ScheduleView {
  replies: { teamId: string; answer: 'looks_good' | 'ask_for_change'; words: string | null; at: string }[];
  sendLog: SendLogRow[];
  changes: { teams: { teamId: string; teamName: string; lines: string[] }[]; handedBack: { teamId: string; teamName: string; lines: string[] }[] };
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
  | { kind: 'delete' };

/** One slot as it was before a change — what Undo puts back exactly. */
interface Before { slotId: string; teamIds: string[]; locked: boolean; movedByHand: boolean }

const lowerFirst = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

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
  const [lens, setLens] = useState<'grid' | 'team' | 'group'>('grid');
  const [cursor, setCursor] = useState<string | null>(null);
  const [facilityFilter, setFacilityFilter] = useState<Set<string>>(() => new Set());
  const [teamFilter, setTeamFilter] = useState<Set<string>>(() => new Set());
  const [clashesOnly, setClashesOnly] = useState(false);
  const [win, setWin] = useState<Win | null>(null);
  const [pending, setPending] = useState<PendingMove | null>(null);
  const [notice, setNotice] = useState<{ id: number; text: string; undo?: Before[] } | null>(null);
  const [moved, setMoved] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState('');

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
    const { startsOn, endsOn } = r.data.schedule;
    setCursor(c => (c && c >= startsOn && c <= endsOn ? c : firstCursor(startsOn, endsOn, today)));
  }, [slug, scheduleId, q, beginRead, today]);
  useDeferredLoad(!orgLoading && !!slug, load);

  const noticeSeq = useRef(0);
  const say = (text: string, undo?: Before[]) => setNotice({ id: ++noticeSeq.current, text, undo });

  // ── Names, colours, places — looked up by id, once per read ──
  const teamById = useMemo(() => new Map((read?.teams ?? []).map(t => [t.id, t])), [read]);
  const slotByKey = useMemo(() => new Map((read?.slots ?? []).map(x => [x.key, x])), [read]);
  const nameOf = useCallback((id: string) => teamById.get(id)?.name ?? 'A team', [teamById]);
  const colourOf = useCallback((id: string) => teamColour(read?.teams ?? [], id), [read]);
  const groupOf = useCallback((id: string) => teamById.get(id)?.groupId ?? null, [teamById]);
  const placeOfSlot = useCallback((x: Pick<SlotView, 'venueId' | 'facilityId'>) => placeName(read?.places ?? [], x.venueId, x.facilityId), [read]);

  const oneWeekday = useMemo(() => (read ? oneWeekdayOf(read.slots) : null), [read]);
  const range = read && cursor ? { startsOn: read.schedule.startsOn, endsOn: read.schedule.endsOn, oneWeekday, cursor } : null;
  const cols = range ? gridColumns(range) : null;
  const allRows = useMemo(() => (read ? placeRows(read.places, read.slots) : []), [read]);
  const rows = facilityFilter.size ? allRows.filter(r => facilityFilter.has(r.key)) : allRows;
  const weekSet = new Set(cols?.days ?? []);
  const weekClashes = read ? read.slots.filter(x => weekSet.has(x.day) && x.clash).length : 0;

  // ── Writes: every hand edit, its Undo ──
  const slotOfKey = (key: string) => slotByKey.get(key) ?? null;
  const dim = useCallback((x: SlotView) => (clashesOnly && !x.clash) || (teamFilter.size > 0 && !x.teamIds.some(t => teamFilter.has(t))), [clashesOnly, teamFilter]);
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
      fromKey: m.from.key, toKey: m.to.key, teamId: m.teamId, scope, teamsAtOnce: read.schedule.settings.teamsAtOnce,
    });
    if (!plan.edits.length) { say(W.skipped(plan.skipped.length || 1, W.skippedWhy[plan.skipped[0]?.why ?? 'no_slot'])); return; }
    const moved = new Set(plan.moved);
    const toDays = read.slots.filter(x => moved.has(x.week) && x.weekday === m.to.weekday && x.startClock === m.to.startClock
      && x.venueId === m.to.venueId && x.facilityId === m.to.facilityId).map(x => x.day).sort();
    const swapWith = m.to.teamIds.length >= read.schedule.settings.teamsAtOnce ? m.to.teamIds[0] : null;
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
  const changeLines = [...v.changes.teams, ...v.changes.handedBack].flatMap(t => t.lines.map(l => W.changeTeamLine(t.teamName, lowerFirst(l))));
  const changedCallout = final && s.changedSinceSent && (
    <div className={sch.callout}>
      <div className={sch.calloutBody}>
        <b>{changeLines.length ? W.changesHead(changeLines.length, formatStoredDate(s.sent?.at ?? '', { withYear: false })) : W.changesNone}</b>
        {changeLines.length > 0 && <ul>{changeLines.map(l => <li key={l}>{l}</li>)}</ul>}
        {changeLines.length > 0 && <span className={sch.calloutTail}>{W.changesTail}</span>}
      </div>
      {v.changes.teams.length > 0 && (
        <button type="button" className="btn btn-lime" onClick={() => setWin({ kind: 'send', start: 'changes' })}>{W.sendChanges}</button>
      )}
    </div>
  );

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
  const zone = timesInZoneSentence();
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
  const teamOptions = teamsInSlots.map(t => ({ id: t.id, label: t.name }));

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
                    <td className={repKit.num}>{r?.got ?? 0}</td>
                    <td className={repKit.num}>{W.hours((r?.minutes ?? 0) / 60)}</td>
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
                    <span className={sch.prowTime}>{[W.rowSlots(r?.got ?? 0), W.rowPrime(r?.prime ?? 0), nightsWords(r?.nights ?? [])].join(' · ')}</span>
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
                <td className={repKit.num}>{W.hours(rs.reduce((n, r) => n + r.minutes / 60, 0))}</td>
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
  const phoneWeek = cols && (
    <>
      <div className={sch.phoneSeg}>{dateNav}</div>
      {cols.days.map(d => {
        const list = v.slots.filter(x => x.day === d).sort((a, b) => a.startsAt.localeCompare(b.startsAt) || placeOfSlot(a).localeCompare(placeOfSlot(b), 'en-CA', { numeric: true }));
        if (!list.length) return null;
        return (
          <section key={d} className={sch.pday} aria-label={formatShortWeekdayDate(d)}>
            <h3 className={sch.pdayHead}>{formatShortWeekdayDate(d)}</h3>
            {list.map(x => (
              <button key={x.key} type="button" className={`${sch.prow} ${sch.prowButton}`} onClick={() => setWin({ kind: 'slot', key: x.key })} data-slot-chip>
                {x.teamIds[0] ? <Swatch colour={colourOf(x.teamIds[0])} /> : <span className={sch.swatchEmpty} aria-hidden />}
                <span className={sch.prowMain}>
                  <span className={sch.prowTime}>{slotTime(x)} · {placeOfSlot(x)}</span>
                  <span className={`${sch.prowWho}${x.teamIds.length ? '' : ` ${sch.prowOpen}`}`}>{x.teamIds.length ? x.teamIds.map(nameOf).join(' · ') : W.openSlot}</span>
                </span>
              </button>
            ))}
          </section>
        );
      })}
    </>
  );

  const slotWin = win?.kind === 'slot' || win?.kind === 'swap' ? slotOfKey(win.key) : null;

  return (
    <div className={ck.pageWide}>
      {header}
      <p className={sch.meta}>{meta}</p>
      {failed && <LoadFailed title={failed.text} onRetry={() => void load()} />}
      {reviewCallout}
      {changedCallout}

      {isPhone ? (
        <>
          <div className={sch.lensLine}>
            <ViewSwitch views={[{ id: 'grid', label: W.phoneWeek }, { id: 'team', label: W.viewTeam }]} value={lens === 'group' ? 'team' : lens}
              onChange={next => setLens(next)} label="Read the schedule" />
            <span className={sch.spacer} />
            {tools}
          </div>
          {lens === 'grid' ? phoneWeek : phoneByTeam()}
        </>
      ) : (
        <>
          <CoachListToolbar actions={(
            <>
              <span className={sch.zone}>{zone}</span>
              {tools}
              {exportMenu}
              {draft && <button type="button" className="btn btn-lime" onClick={() => setWin({ kind: 'send', start: 'draft' })}>{W.send}</button>}
            </>
          )}>
            <ViewSwitch views={[{ id: 'grid', label: W.viewGrid }, { id: 'team', label: W.viewTeam }, { id: 'group', label: W.viewGroup }]} value={lens}
              onChange={setLens} label="Read the schedule" />
            {dateNav}
            {lens === 'grid' && (
              <FilterGroup>
                <MultiSelectDropdown restQuiet label={W.facilityPill} options={facilityOptions} selected={facilityFilter} onChange={setFacilityFilter} allLabel={W.everyFacility} />
                <MultiSelectDropdown restQuiet label={W.teamPill} options={teamOptions} selected={teamFilter} onChange={setTeamFilter} allLabel={W.everyTeam} />
              </FilterGroup>
            )}
            {lens === 'grid' && clashPill}
          </CoachListToolbar>
          <p className={repKit.srOnly} role="status" aria-live="polite">{refused}</p>
          {lens === 'grid' && cols ? (
            <div className={sch.body}>
              <ScheduleGrid
                view={v} days={cols.days} rows={rows} canDrag={canChange && !busy} dim={dim} moved={moved} today={today}
                nameOf={nameOf} colourOf={colourOf} groupOf={groupOf}
                onOpen={x => setWin({ kind: 'slot', key: x.key })}
                onDrop={onDrop}
                onRefused={reason => { setRefused(reason); say(reason); }}
              />
              <FairShares view={v} week={cols.days} weeks={weeksShown} scope={weekScope} nameOf={nameOf} colourOf={colourOf} placeOf={(a, b) => placeName(v.places, a, b)}
                onBill={v.canMoney && (v.bill || !final) ? () => setWin({ kind: 'bill' }) : undefined} />
            </div>
          ) : lens === 'team' ? byTeamTable : byGroupTable}
        </>
      )}

      {pending && (
        <WhichWeeks view={v} move={pending} nameOf={nameOf} placeOf={placeOfSlot} onPick={pickWeeks} onCancel={() => setPending(null)} />
      )}
      {win?.kind === 'slot' && slotWin && (
        <SlotWindow view={v} slot={slotWin} nameOf={nameOf} colourOf={colourOf} placeOf={placeOfSlot} busy={busy} canChange={canChange}
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

