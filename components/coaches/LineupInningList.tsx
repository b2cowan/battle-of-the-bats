'use client';
import { GripVertical } from 'lucide-react';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { playerDisplayName, isCallUp, CALL_UP_LABEL } from '@/lib/coach-roster-name';
import type { LineupPlayerRow } from '@/lib/lineup-grid';
import coach from '@/app/[orgSlug]/coaches/coaches.module.css';
import s from './LineupInningList.module.css';

/**
 * THE PHONE'S LINEUP — one inning at a time (phone re-evaluation stage 3 · D5, owner ruling
 * 2026-09-21: "I want to see the lineup and toggle inning by inning rather than scroll, pin the
 * player to the left, grab and drag to rearrange; smaller text before and after the current
 * inning's edits"). Rendered by `_LineupEditor` at ≤640 INSTEAD of the players × innings grid —
 * the desktop and the 641–768 band keep the grid, where all six innings fit without a scroll. At
 * 390 the grid was 680px of table in 356: two innings per screen, three swipes to the sixth, and
 * every hold on a number waiting 250ms to be told from a swipe. The game-day console is the
 * portal's proof that a phone reads an inning at a time — ‹ Inning 1 of 7 › over number · name ·
 * position rows — and this is the console's shape with a control in the position column and the
 * two neighbouring innings in small type beside it.
 *
 * What it is: a stepper row — ‹ · a pill "Inning 2 of 6 · 8/9" (the inning inspector's DOOR, the
 * grid heading's job; red with the clash sentence when the inning clashes) · › — that PINS under
 * the masthead as the list scrolls; a row of status dots beneath it (filled done · amber outline
 * open · red a clash · a ring on the inning on screen; decorative, never a tap target); then one
 * 58px row per player: the batting number as the D8 handle (hold lifts, tap opens the row sheet —
 * `coach.lineupBatHandle`, unchanged), the name, the PREVIOUS inning's position in 12px muted
 * type, THIS inning's position as a 44 × 64 pill with NO chevron (the owner's read: "remove the
 * chevrons like the calendar period selector"), the NEXT inning's in 12px. A first inning has no
 * left neighbour, a last inning no right. The pill opens `LineupPositionSheet`.
 *
 * ⚠ ONE INNING IS SHOWN BY THE VIEW, NEVER BY THE DATA. The rows, `inningPositions` and the save
 * are untouched; undo and redo span innings as they always have; the print pass reads rows, not
 * this view. The rows live inside the editor's own `DndContext` (the D8 sensors: a mouse lifts at
 * 6px, a finger after a 250ms hold) and the same `SortableContext` + vertical strategy the grid
 * uses — in a list that no longer scrolls sideways the vertical drag stops fighting a swipe.
 *
 * ⚠ THE STEPPER IS STICKY, so nothing between it and the document may `overflow: hidden` (stage 2's
 * lesson — the frame becomes the sticky container and the pin dies). The list wears no frame clip:
 * a lifted row's shadow and scale must paint past the list's edge, so the corners are rounded on
 * the first and last rows instead.
 *
 * ⚠ NO START COLUMN on a phone (9-player ball): the number already says starter or bench ("–"),
 * and a drag or Move across the cut promotes exactly as the grid's checkbox does (D-C12). The row
 * has 44 · name · 38 · 64 · 38 of room at 390 and nothing to give a fifth control.
 */
export type InningDotState = 'done' | 'open' | 'clash' | 'untouched';

export interface LineupInningListProps {
  rows: LineupPlayerRow[];
  /** The inning on screen (1-based, already clamped to `inningCount`). */
  inning: number;
  inningCount: number;
  periodLabel: string;
  orderLabel: string;
  /** "8/9" once the inning is started (`open` when a role is still open); null while untouched. */
  coverage: { filled: number; total: number; open: boolean } | null;
  /** The clash sentence when the inning has one ("2 share C"); null otherwise. */
  clash: string | null;
  /** One state per inning, in order — the dots. */
  dots: InningDotState[];
  onStep: (inning: number) => void;
  /** The pill: open the inning inspector on this inning. */
  onOpenInning: () => void;
  /** A tap on a number: the row-actions sheet (D8). */
  onRowActions: (playerId: string) => void;
  /** A tap on a position pill: the position sheet. */
  onPickPosition: (playerId: string) => void;
  cellIssueFor: (playerId: string, inning: number, value: string) => { isOpen: boolean; hasConflict: boolean; description?: string };
}

function InningRow({
  row, inning, inningCount, periodLabel, onRowActions, onPickPosition, cellIssueFor,
}: {
  row: LineupPlayerRow; inning: number; inningCount: number; periodLabel: string;
  onRowActions: (playerId: string) => void;
  onPickPosition: (playerId: string) => void;
  cellIssueFor: LineupInningListProps['cellIssueFor'];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.player.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const name = playerDisplayName(row.player);
  /* ⚠ The call-up mark is a visible part of this row's identity, so it belongs in the ACCESSIBLE
     name too. A previous pass on this screen shipped an aria-label that silently dropped the row's
     warning chips; a sighted coach could see "Call-up" and a screen-reader user could not. */
  const spoken = isCallUp(row.player) ? `${name}, ${CALL_UP_LABEL}` : name;
  const number = row.battingOrder;
  const value = row.inningPositions[String(inning)] ?? '';
  // The neighbours: null where the inning has none (the first has no left, the last no right), the
  // empty string where the neighbouring cell is open — drawn as a quiet dash.
  const prev = inning > 1 ? (row.inningPositions[String(inning - 1)] ?? '') : null;
  const next = inning < inningCount ? (row.inningPositions[String(inning + 1)] ?? '') : null;
  const issue = cellIssueFor(row.player.id, inning, value);
  const descriptionId = issue.description ? `lineup-pill-${row.player.id}-${inning}` : undefined;
  const neighbour = (pos: string | null, side: 'prev' | 'next') => (
    <span className={s.neighbour} data-side={side} data-blank={pos === '' || undefined} aria-hidden>
      {pos === null ? '' : pos || '—'}
    </span>
  );
  return (
    <li ref={setNodeRef} style={style} className={s.row} data-dragging={isDragging || undefined}>
      {/* The number is the handle (D8): hold to drag, tap for Move up · Move down · Remove. */}
      <button type="button" className={coach.lineupBatHandle} data-numbered={number ? 'true' : undefined}
        aria-label={`${spoken}, ${number ? `batting ${number}` : 'on the bench'}. Hold to move, tap for options.`}
        {...attributes} {...listeners} onClick={() => onRowActions(row.player.id)}>
        <GripVertical size={12} aria-hidden="true" />{number || '–'}
      </button>
      {/* mig 309 — a borrowed player is marked on the phone too. ⚠ The mark lives INSIDE the name
          cell rather than as a sixth sibling: this row's widths are handle 44 · name · 38 · 64 · 38,
          and another column would have pushed the position pill off a 360px screen. The name gives
          way to it rather than the other way round (see `.name` / `.nameText`). */}
      <span className={s.name}>
        <span className={s.nameText}>{name}</span>
        {isCallUp(row.player) && <span className={coach.lineupCallUpMark}>{CALL_UP_LABEL}</span>}
      </span>
      {neighbour(prev, 'prev')}
      {/* The blank cell reads "—" (owner, 2026-09-18); the amber outline carries the open state, the
          red one a clash — the grid's outlines, on the pill. No chevron. */}
      <button type="button" className={s.pill} aria-haspopup="dialog"
        aria-label={`${periodLabel} ${inning} position for ${spoken}`}
        aria-describedby={descriptionId}
        data-open={issue.isOpen || undefined} data-clash={issue.hasConflict || undefined} data-blank={!value || undefined}
        onClick={() => onPickPosition(row.player.id)}>
        {value || '—'}
      </button>
      {issue.description && <span id={descriptionId} className={coach.srOnly}>{issue.description}</span>}
      {neighbour(next, 'next')}
    </li>
  );
}

export default function LineupInningList({
  rows, inning, inningCount, periodLabel, orderLabel, coverage, clash, dots,
  onStep, onOpenInning, onRowActions, onPickPosition, cellIssueFor,
}: LineupInningListProps) {
  const periodLc = periodLabel.toLowerCase();
  const pillTitle = clash ? 'Two players share a position this inning' : coverage?.open ? `${coverage.total - coverage.filled} open` : undefined;
  return (
    <div className={s.wrap} data-lineup-inning-list>
      {/* The stepper and the dots pin together under the masthead as the list scrolls. */}
      <div className={s.pin} data-lineup-pin>
      <div className={s.stepper} data-lineup-stepper>
        <button type="button" className={coach.gdStepper} aria-label={`Previous ${periodLc}`} disabled={inning <= 1} onClick={() => onStep(inning - 1)}>‹</button>
        {/* The pill is the inning inspector's door — the grid heading's job (Phase 4, F12). It keeps
            the heading's `data-lineup-inning` anchor so "Review inning N" still has a scroll target. */}
        <button type="button" className={s.stepPill} data-lineup-inning={inning} data-state={clash ? 'bad' : coverage?.open ? 'open' : undefined}
          aria-haspopup="dialog" title={pillTitle}
          aria-label={`${periodLabel} ${inning} of ${inningCount} — who is at each position${pillTitle ? ` (${pillTitle})` : ''}`}
          onClick={onOpenInning}>
          <span className={s.stepWord}>{periodLabel} {inning} of {inningCount}</span>
          {clash ? <small className={s.stepFact}>· ⚠ {clash}</small> : coverage ? <small className={s.stepFact}>· {coverage.filled}/{coverage.total}</small> : null}
          <span className={s.stepChev} aria-hidden>›</span>
        </button>
        <button type="button" className={coach.gdStepper} aria-label={`Next ${periodLc}`} disabled={inning >= inningCount} onClick={() => onStep(inning + 1)}>›</button>
      </div>
      {/* A glance, not a control: which innings are done, open or clashing, and which is on screen. */}
      <div className={s.dots} aria-hidden data-lineup-dots>
        {dots.map((state, i) => <i key={i} data-state={state} data-current={i + 1 === inning || undefined} />)}
      </div>
      </div>
      <ul className={s.list} aria-label={`${orderLabel} · ${periodLc} ${inning}`}>
        <SortableContext items={rows.map(r => r.player.id)} strategy={verticalListSortingStrategy}>
          {rows.map(row => (
            <InningRow key={row.player.id} row={row} inning={inning} inningCount={inningCount} periodLabel={periodLabel}
              onRowActions={onRowActions} onPickPosition={onPickPosition} cellIssueFor={cellIssueFor} />
          ))}
        </SortableContext>
      </ul>
    </div>
  );
}
