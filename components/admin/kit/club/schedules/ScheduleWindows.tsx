'use client';
/**
 * THE SCHEDULE PAGE'S SMALL WINDOWS (Club Tier Stage 11a, part B — hub Stages 10 + 11, specimens 7, 8, 9):
 *
 *   WhichWeeks   — a drop's one question (Ask 13), HUNG AT THE DROP as a menu: This week only · This & later weeks ·
 *                  Every week, each naming the dates it reaches (the coach's repeating-event pencil's three rows,
 *                  2026-10-09). Escape or a click away springs the move back.
 *   SlotWindow   — a slot opens its own small window: when, where, the team and how it repeats, then the acts. A slot
 *                  has nothing to edit but its team, so there is no pencil: Change team is a dropdown. Lock, Swap with…
 *                  and Clear END THE BODY (the rare-door rule, 2026-10-09); each change ends in the Undo notice. A SHARED
 *                  slot (Stage 11c) says so beside its teams; Change team names them all and offers only its sharing
 *                  rule's teams while it has room (the slot's room, `slotHolds` — the rule the routes ask too).
 *   SwapWindow   — Swap with…: a slot this week; the question after it asks which weeks.
 *   SendLogWindow— Tools › Send log: every send, kept (one log shape for every club send — Ask 9).
 *   TeamSlotsWindow — By team's row opens that team's slots as a list.
 */
import { useMemo, useRef } from 'react';
import { ArrowLeftRight, Eraser, Lock, LockOpen } from 'lucide-react';
import KitDialog from '../KitDialog';
import ck from '../ClubKit.module.css';
import { ClubRow, ClubRowBand, ClubRowFrame, ClubRowList, RecordAction } from '../RepKit';
import { useDismissable } from '@/lib/overlay-hooks';
import { formatMonthYear, formatStoredDate, formatWeekRange, utcToZonedInputs } from '@/lib/timezone';
import { formatTime, joinWithAnd, pluralize } from '@/lib/utils';
import { slotHolds } from '@/lib/club-schedule-settings';
import { planMove, type WeeksScope } from '@/lib/club-schedule-engine';
import { SCHEDULE_SCREEN_WORDS as W, sendLogLine } from '@/lib/club-schedule-words';
import { dayHead, dropLanding, engineSlotsOf, heldWords, slotTime, type ScheduleView, type SharingRead, type SlotView } from '@/lib/club-schedule-view';
import { Swatch } from './ScheduleParts';
import sch from './Schedules.module.css';

const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** A move, before its weeks are chosen. `swap` names the team a drop onto a full slot trades with. */
export interface PendingMove { from: SlotView; to: SlotView; teamId: string; at: { left: number; top: number } }

/** What each scope reaches: the weeks it moves and the source dates they cover. */
export function scopeReach(view: ScheduleView, m: Pick<PendingMove, 'from' | 'to' | 'teamId'>, sharing: SharingRead) {
  const slots = engineSlotsOf(view.slots);
  const assignments = new Map(view.slots.map(s => [s.key, s.teamIds]));
  const byWeekPos = new Map(slots.map(s => [`${s.week}|${s.pos}`, s]));
  const fromPos = slots.find(s => s.key === m.from.key)!.pos;
  const reach = (scope: WeeksScope) => {
    const plan = planMove(slots, assignments, { fromKey: m.from.key, toKey: m.to.key, teamId: m.teamId, scope, sharing });
    const days = plan.moved.map(w => byWeekPos.get(`${w}|${fromPos}`)?.day).filter((d): d is string => !!d).sort();
    return { plan, days };
  };
  return { this: reach('this'), later: reach('later'), every: reach('every') };
}

export function WhichWeeks({ view, move, sharing, nameOf, placeOf, onPick, onCancel }: {
  view: ScheduleView;
  move: PendingMove;
  sharing: SharingRead;
  nameOf: (id: string) => string;
  placeOf: (s: SlotView) => string;
  onPick: (scope: WeeksScope) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDismissable(true, ref, onCancel);
  const reach = useMemo(() => scopeReach(view, move, sharing), [view, move, sharing]);
  const landing = dropLanding(move.from, move.to, move.teamId, sharing);
  const swapWith = landing?.kind === 'swap' ? landing.withTeam : null;
  const from = `${DAY_NAMES[move.from.weekday]} ${formatTime(move.from.startClock)}`;
  const to = `${DAY_NAMES[move.to.weekday]}, ${formatTime(move.to.startClock)} · ${placeOf(move.to)}`;
  const head = swapWith ? W.swapWeeks(nameOf(move.teamId), from, nameOf(swapWith)) : W.whichWeeks(nameOf(move.teamId), from, to);
  const span = (days: string[]) => (days.length > 1 ? W.weeksSpan(formatWeekRange(days[0], days[days.length - 1], false), days.length) : days[0] ? dayHead(days[0]) : '');
  const left = Math.min(move.at.left, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 320);
  const top = Math.min(move.at.top + 4, (typeof window !== 'undefined' ? window.innerHeight : 800) - 200);
  const item = (scope: WeeksScope, label: string, days: string[]) => (
    <button type="button" role="menuitem" className={sch.menuItem} disabled={!days.length} onClick={() => onPick(scope)}>
      {label}<small>{span(days) || W.skippedWhy.no_slot}</small>
    </button>
  );
  return (
    <div ref={ref} className={sch.weeksMenu} role="menu" aria-label={head} style={{ left: Math.max(8, left), top: Math.max(8, top) }}
      onKeyDown={e => { if (e.key === 'Escape') onCancel(); }}>
      <div className={sch.menuHead}>{head}</div>
      {item('this', W.thisWeek, reach.this.days)}
      {item('later', W.laterWeeks, reach.later.days)}
      {item('every', W.everyWeekScope, reach.every.days)}
    </div>
  );
}

export function SlotWindow({ view, slot, sharing, nameOf, colourOf, placeOf, busy, canChange, onChangeTeams, onLock, onSwap, onClear, onClose }: {
  view: ScheduleView;
  slot: SlotView;
  sharing: SharingRead;
  nameOf: (id: string) => string;
  colourOf: (id: string) => string;
  placeOf: (s: SlotView) => string;
  busy: boolean;
  /** A computer, and a schedule the reader may change. */
  canChange: boolean;
  onChangeTeams: (teamIds: string[]) => void;
  onLock: (locked: boolean) => void;
  onSwap: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const venue = view.places.find(p => p.venueId === slot.venueId)?.venueName ?? '';
  const where = [venue, slot.facilityId ? placeOf(slot) : ''].filter(Boolean).join(' · ');
  const running = view.teams.filter(t => t.season);
  const one = slot.teamIds[0] ?? null;
  // How it repeats: the team's slots at this place in the week.
  const repeats = (() => {
    if (!one) return null;
    const same = view.slots.filter(s => s.weekday === slot.weekday && s.startClock === slot.startClock && s.venueId === slot.venueId
      && s.facilityId === slot.facilityId && s.teamIds.includes(one)).map(s => s.day).sort();
    if (same.length < 2) return null;
    return W.slotRepeats(DAY_NAMES[slot.weekday], formatTime(slot.startClock), formatWeekRange(same[0], same[same.length - 1], false));
  })();
  const held = slot.heldBy && !slot.teamIds.length;
  // A slot's room (Stage 11c): a sharing rule's teams up to its number — Change team adds a partner while there is room.
  // Who may join the teams in it: whoever the slot's room holds beside them — a partner of their sharing rule.
  const partners = slot.teamIds.length ? running.filter(t => !slot.teamIds.includes(t.id) && slotHolds([...slot.teamIds, t.id], slot.weight, sharing)) : [];
  const shared = slot.teamIds.length > 1;
  return (
    <KitDialog kind="question" eyebrow={W.slotEyebrow(view.schedule.name)} title={`${dayHead(slot.day)} · ${slotTime(slot)}`} identity={where} onClose={onClose} busy={busy}>
      <dl className={sch.read2}>
        <dt>{shared ? `${W.slotTeams}, ${W.slotShared}` : W.slotTeam}</dt>
        <dd>
          {slot.teamIds.length ? (
            <span className={sch.slotTeamList}>
              {slot.teamIds.map(t => <span key={t} className={sch.withSwatch}><Swatch colour={colourOf(t)} />{nameOf(t)}</span>)}
            </span>
          ) : slot.handedBack?.teamId ? W.handedBackSlot(nameOf(slot.handedBack.teamId)) : W.openSlot}
          {repeats && <small>{repeats}</small>}
        </dd>
        {slot.heldBy && <><dt>{W.slotHeld}</dt><dd>{heldWords(slot.heldBy)}</dd></>}
        <dt>{W.slotPrime}</dt><dd>{slot.prime ? W.yes : W.no}</dd>
      </dl>
      {canChange && !held && (
        <label className={ck.field} htmlFor="slot-team">
          <span className={ck.label}>{W.changeTeam}</span>
          {shared ? (
            <select id="slot-team" className={ck.select} value="" disabled={busy}
              onChange={e => { const id = e.target.value; if (id) onChangeTeams(slot.teamIds.includes(id) ? slot.teamIds.filter(x => x !== id) : [...slot.teamIds, id]); }}>
              <option value="">{joinWithAnd(slot.teamIds.map(nameOf))}</option>
              {slot.teamIds.map(t => <option key={t} value={t}>{W.takeOff(nameOf(t))}</option>)}
              {partners.map(t => <option key={t.id} value={t.id}>{W.addTeam(t.name)}</option>)}
            </select>
          ) : (
            <select id="slot-team" className={ck.select} value={one ?? ''} disabled={busy}
              onChange={e => { const v = e.target.value; onChangeTeams(v.startsWith('+') ? [...slot.teamIds, v.slice(1)] : v ? [v] : []); }}>
              <option value="">{W.nobody}</option>
              {running.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              {partners.length > 0 && (
                <optgroup label={W.shareWith}>
                  {partners.map(t => <option key={t.id} value={`+${t.id}`}>{W.addTeam(t.name)}</option>)}
                </optgroup>
              )}
            </select>
          )}
        </label>
      )}
      {canChange && (
        <div className={sch.ends}>
          <RecordAction icon={slot.locked ? <LockOpen size={14} aria-hidden /> : <Lock size={14} aria-hidden />} onClick={() => onLock(!slot.locked)} disabled={busy}>
            {slot.locked ? W.unlockSlot : W.lockSlot}
          </RecordAction>
          {one && !shared && (
            <RecordAction icon={<ArrowLeftRight size={14} aria-hidden />} onClick={onSwap} disabled={busy}>{W.swapWith}</RecordAction>
          )}
          {slot.teamIds.length > 0 && <RecordAction icon={<Eraser size={14} aria-hidden />} onClick={onClear} disabled={busy}>{W.clearSlot}</RecordAction>}
        </div>
      )}
    </KitDialog>
  );
}

export function SwapWindow({ view, slot, nameOf, placeOf, onPick, onClose }: {
  view: ScheduleView;
  slot: SlotView;
  nameOf: (id: string) => string;
  placeOf: (s: SlotView) => string;
  onPick: (to: SlotView) => void;
  onClose: () => void;
}) {
  const others = view.slots.filter(s => s.week === slot.week && s.key !== slot.key && s.teamIds.length === 1 && !s.teamIds.includes(slot.teamIds[0]))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return (
    <KitDialog kind="question" title={W.swapTitle} eyebrow={W.slotEyebrow(view.schedule.name)} onClose={onClose}>
      <p className={ck.hint}>{W.swapHint}</p>
      <div className={sch.pickList}>
        {others.map(s => (
          <button key={s.key} type="button" className={sch.pickRow} onClick={() => onPick(s)}>
            <span><b>{nameOf(s.teamIds[0])}</b><small>{dayHead(s.day)} · {slotTime(s)} · {placeOf(s)}</small></span>
          </button>
        ))}
      </div>
    </KitDialog>
  );
}

export interface SendLogRow {
  id: string; kind: 'review' | 'final' | 'changes'; at: string; by: string | null; teamIds: string[]; people: number; failed: number;
}

export function SendLogWindow({ view, log, nameOf, onClose }: { view: ScheduleView; log: readonly SendLogRow[]; nameOf: (id: string) => string; onClose: () => void }) {
  const at = (iso: string) => `${formatStoredDate(iso)}, ${formatTime(utcToZonedInputs(iso).time)}`;
  return (
    <KitDialog kind="form" eyebrow={view.schedule.name} title={W.sendLogTitle} onClose={onClose}>
      {log.length === 0 ? <p className={ck.hint}>{W.sendLogEmpty}</p> : (
        <div className={sch.logRows} role="list">
          {log.map(r => (
            <div key={r.id} className={sch.logRow} role="listitem">
              <b>{sendLogLine({ kind: r.kind, teams: r.teamIds.length, people: r.people })}</b>
              <small>{W.sendLogSub(at(r.at), r.by, r.kind === 'final' ? '' : r.teamIds.map(nameOf).join(', '))}</small>
            </div>
          ))}
        </div>
      )}
    </KitDialog>
  );
}

export function TeamSlotsWindow({ view, teamId, nameOf, placeOf, onOpenSlot, onClose }: {
  view: ScheduleView;
  teamId: string;
  nameOf: (id: string) => string;
  placeOf: (s: SlotView) => string;
  onOpenSlot?: (s: SlotView) => void;
  onClose: () => void;
}) {
  const mine = view.slots.filter(s => s.teamIds.includes(teamId)).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const months = [...new Set(mine.map(s => s.day.slice(0, 7)))];
  return (
    <KitDialog kind="form" eyebrow={view.schedule.name} title={W.teamSlotsTitle(nameOf(teamId))} identity={pluralize(mine.length, 'slot')} onClose={onClose}>
      <ClubRowFrame>
        {months.map(m => (
          <ClubRowList key={m} inset label={formatMonthYear(`${m}-01`)}>
            <ClubRowBand>{formatMonthYear(`${m}-01`)}</ClubRowBand>
            {mine.filter(s => s.day.startsWith(m)).map(s => (
              onOpenSlot
                ? <ClubRow key={s.key} as="button" aria-haspopup="dialog" onClick={() => onOpenSlot(s)} lead={dayHead(s.day)} title={slotTime(s)} caption={placeOf(s)} chevron />
                : <ClubRow key={s.key} lead={dayHead(s.day)} title={slotTime(s)} caption={placeOf(s)} />
            ))}
          </ClubRowList>
        ))}
      </ClubRowFrame>
    </KitDialog>
  );
}
