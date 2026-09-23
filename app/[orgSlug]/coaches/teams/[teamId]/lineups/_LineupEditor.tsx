'use client';
// The ONE editable lineup surface, shared by the game lineup builder (/lineups/[eventId]) and the
// standalone template builder (/lineups/templates/[templateId]). Controlled via props: the parent
// owns rows/mode/innings + persistence (game autosave vs explicit template save) and its own extras
// (attendance/mismatch/undo/PDF/notes for a game; name/save for a template). Everything about the
// editing itself — format/innings, auto-fill, Reshuffle, the grid, the playing-time view, add/remove
// — lives here so it's written once and both surfaces stay in lock-step.
import { useState, useRef, useEffect } from 'react';
import { useDismissable } from '@/lib/overlay-hooks';
import { useBackStep } from '@/components/coaches/useBackStep';
import LineupSheetScrim from '@/components/coaches/LineupSheetScrim';
import LineupDrawerHead from '@/components/coaches/LineupDrawerHead';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { useIsPhoneNav } from '@/lib/hooks/useIsPhoneNav';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import { X, ChevronUp, ChevronDown, ChevronRight, GripVertical, Shuffle, Eraser, UserPlus } from 'lucide-react';
import {
  DndContext, closestCenter, MouseSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import SublinedChoice, { type SublinedOption } from '@/components/coaches/SublinedChoice';
import LineupInningInspector, { InningHeadingDoor } from '@/components/coaches/LineupInningInspector';
import LineupCheck, { LineupStateMark, type LineupCheckInning, type LineupMarkState } from '@/components/coaches/LineupCheck';
import LineupInningList, { type InningDotState } from '@/components/coaches/LineupInningList';
import LineupPositionSheet from '@/components/coaches/LineupPositionSheet';
import { analyzeLineup, deriveLineupBadge, canMarkLineupReady, inningsNeedingDecision } from '@/lib/lineup-analysis';
import { generateBestLineup, describePlacementReason, type PositionPolicy, type FillMode, type GenerationRationale } from '@/lib/lineup-generator';
import { playerPositionPrefs } from '@/lib/lineup-profile';
import { resolveLineupCaps, normalizeRulesOverride } from '@/lib/lineup-caps';
import { playerDisplayName, isCallUp, CALL_UP_LABEL } from '@/lib/coach-roster-name';
import {
  LINEUP_POSITIONS, POSITION_ORDER, heatStyle, renumberBattingOrder,
  type LineupPlayerRow,
} from '@/lib/lineup-grid';
import type { getSportPack } from '@/lib/sports';
import type { RepLineupMode, RepRosterPlayer, LineupSettings } from '@/lib/types';
import styles from '../../../coaches.module.css';

type SportPack = ReturnType<typeof getSportPack>;
/** The auto-fill panel's id — the phone's Setup row names it in `aria-controls` (stage 3 · D1). */
const SETUP_PANEL_ID = 'lineup-setup-panel';
/** The phone panel's ONE folded section (D12 · B) — Innings to fill and Game rules together. */
const SETUP_MORE_ID = 'lineup-setup-more';
type GameRules = { maxPos: string; pitcher: string; minPlay: string };

/* Each sub-line says what the mode does with the depth chart's ratings (owner, 2026-09-12): the old
   "preferred spots, rotate" implied Balanced read the Best RANK, and it never has — it rotates evenly
   among anyone rated Best. Split into name/sub (SublinedChoice) rather than one run-on option string —
   a native `<select>` truncated it mid-word at this panel's width. */
const AUTO_POLICY_OPTIONS: ReadonlyArray<SublinedOption<PositionPolicy>> = [
  { value: 'competitive', name: 'Competitive', sub: 'Best spots first, in your rank order' },
  { value: 'balanced', name: 'Balanced', sub: 'Anyone rated Best, rotated evenly' },
  { value: 'development', name: 'Development', sub: 'Everyone rotates; only Never is honoured' },
];

const A_SQUAD_OPTIONS: ReadonlyArray<SublinedOption<'balanced_sits' | 'prioritized'>> = [
  { value: 'balanced_sits', name: 'Play key spots', sub: 'Bench rotates evenly' },
  { value: 'prioritized', name: 'Stay on field', sub: 'Others cover the bench' },
];

/** "2, 4, 5, 6, 7" → "2, 4–7". Collapses a sorted-ascending inning list into compact ranges so a
 *  run of many identical open-role innings (e.g. no pitcher under cap for the rest of the game)
 *  reads as one span instead of a wall of one-per-inning repeats. */
function formatInningRanges(innings: number[]): string {
  const parts: string[] = [];
  let start = innings[0], prev = innings[0];
  for (let i = 1; i <= innings.length; i++) {
    const n = innings[i];
    if (n === prev + 1) { prev = n; continue; }
    parts.push(start === prev ? `${start}` : `${start}–${prev}`);
    start = n; prev = n;
  }
  return parts.join(', ');
}

// One drag-sortable lineup row. Batting order = drag position (auto-numbered), so duplicate slot
// numbers are impossible.
function SortableLineupRow({
  row, battingNumber, mode, inningCount, onStarterToggle, onPositionChange, onRemove, onRowActions, orderLabel, cellIssueFor,
}: {
  row: LineupPlayerRow; battingNumber: string; mode: RepLineupMode; inningCount: number;
  onStarterToggle: (playerId: string, checked: boolean) => void;
  onPositionChange: (playerId: string, inning: number, value: string) => void;
  onRemove: (playerId: string) => void;
  onRowActions: (playerId: string) => void;
  orderLabel: string;
  cellIssueFor: (playerId: string, inning: number, value: string) => { isOpen: boolean; hasConflict: boolean; description?: string };
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.player.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  const name = playerDisplayName(row.player);
  return (
    <tr ref={setNodeRef} style={style}>
      <td>
        {/* Two renderings of one cell, switched by CSS at the grid's touch width (768). Wide: the
            grip beside the number, as it has always been. Touch: the NUMBER is the handle (D8) —
            one 44px control in the pinned column that carries every row job: hold to drag, tap
            for the row-actions sheet (move up / down, remove). Both wear the sortable listeners;
            only the one on screen can be reached. */}
        <div className={styles.lineupBatCell}>
          <button type="button" aria-label={`Drag to reorder ${name} in the ${orderLabel.toLowerCase()}`}
            className={styles.lineupGrip} {...attributes} {...listeners}
            style={{ background: 'none', border: 'none', padding: 2, lineHeight: 0, cursor: 'grab', color: 'var(--home-dim, rgba(255,255,255,0.35))', touchAction: 'none' }}>
            <GripVertical size={14} />
          </button>
          <span className={styles.lineupBatNumber} style={{ color: battingNumber ? 'var(--white-90)' : 'var(--home-dim, rgba(255,255,255,0.3))' }}>{battingNumber || '–'}</span>
          <button type="button" className={styles.lineupBatHandle} data-numbered={battingNumber ? 'true' : undefined}
            aria-label={`${name}, ${battingNumber ? `batting ${battingNumber}` : 'on the bench'}. Hold to move, tap for options.`}
            {...attributes} {...listeners} onClick={() => onRowActions(row.player.id)}>
            <GripVertical size={12} aria-hidden="true" />{battingNumber || '–'}
          </button>
        </div>
      </td>
      {mode === 'nine_player' && (
        <td className={styles.lineupColStart}>
          <input type="checkbox" checked={row.starter} onChange={e => onStarterToggle(row.player.id, e.target.checked)} aria-label={`Starter for ${playerDisplayName(row.player)}`} />
        </td>
      )}
      <td className={styles.lineupPlayerCell} style={{ display: 'table-cell', verticalAlign: 'middle' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <span className={styles.lineupPlayerName}>{name}</span>
          {/* mig 309 — the mark travels with the row, on every surface a call-up appears. */}
          {isCallUp(row.player) && <span className={styles.lineupCallUpMark}>{CALL_UP_LABEL}</span>}
          <button type="button" className={styles.lineupRemoveBtn} aria-label={`Remove ${name} from the lineup`} title="Remove" onClick={() => onRemove(row.player.id)}><X size={13} /></button>
        </div>
      </td>
      {Array.from({ length: inningCount }, (_, i) => {
        const inning = i + 1;
        const value = row.inningPositions[String(inning)] ?? '';
        const issue = cellIssueFor(row.player.id, inning, value);
        const descriptionId = issue.description ? `lineup-cell-${row.player.id}-${inning}` : undefined;
        return (
          <td key={inning}>
            <select
              className={`${styles.lineupPositionSelect}${issue.isOpen ? ` ${styles.lineupPositionOpen}` : ''}${issue.hasConflict ? ` ${styles.lineupPositionConflict}` : ''}`}
              value={value}
              data-lineup-inning={inning}
              onChange={e => onPositionChange(row.player.id, inning, e.target.value)}
              aria-label={`Inning ${inning} position for ${name}`}
              aria-invalid={issue.hasConflict || undefined}
              aria-describedby={descriptionId}
              title={issue.description}
            >
              {/* The blank cell reads "—" (owner, 2026-09-18): the word "Open" truncated to "Opei" in
                  the narrow select and read like a position code, which is the opposite of what a
                  blank should do. The amber outline carries the state; "Open" stays the word wherever
                  the cell has room for it (the inning inspector, the coverage checks, this description). */}
              {LINEUP_POSITIONS.map(position => <option key={position || 'blank'} value={position}>{position || '—'}</option>)}
            </select>
            {issue.description && <span id={descriptionId} className={styles.srOnly}>{issue.description}</span>}
          </td>
        );
      })}
    </tr>
  );
}

export interface LineupEditorProps {
  roster: RepRosterPlayer[];
  rows: LineupPlayerRow[];
  onRowsChange: (updater: (rows: LineupPlayerRow[]) => LineupPlayerRow[]) => void;
  lineupMode: RepLineupMode;
  onLineupModeChange: (mode: RepLineupMode) => void;
  inningCount: number;
  onInningCountChange: (n: number) => void;
  sportPack: SportPack;
  seasonCaps?: LineupSettings | null;
  /** Per-game caps override (game only). When both are provided, the auto-fill menu shows Game rules. */
  gameRules?: GameRules;
  onGameRulesChange?: (g: GameRules) => void;
  /** Auto-fill mode pre-pick (game pre-selects from the event type; template = balanced). */
  defaultPolicy?: PositionPolicy;
  addLabel: string;
  notInHeading: string;
  /** Called before any row/mode/innings mutation — parents use it for undo snapshot + dirty flag. */
  onBeforeMutate?: () => void;
  /** Transient feedback (auto-fill / reshuffle result). */
  onNotice?: (msg: string) => void;
  /** Slot for surface-specific controls (e.g. the game builder's Templates popover). */
  controlsExtra?: React.ReactNode;
  /** A message to show above the grid (parent-owned, e.g. template-load result). */
  notice?: string;
  /**
   * The Schedule's attendance against this lineup (game builder only): who is marked in but not
   * placed, who is placed but marked Out, and the parent's one-tap fixes. Listed in the Lineup
   * check behind the status strip — the strip names them, nothing changes until a button is tapped.
   */
  attendance?: {
    comingNotInLineup: RepRosterPlayer[];
    outButInLineup: RepRosterPlayer[];
    onAddComing: () => void;
    onRemoveOut: () => void;
  };
  /**
   * The lineup's notes field, rendered BETWEEN the order and the availability panel (owner,
   * 2026-09-22: *"that is what prints with the lineup so it would be good to see them together,
   * kind of as they would print"*).
   *
   * ⚠ A SLOT, not a prop the editor owns. The notes are the page's state — they ride the same save
   * as the lineup and the template editor has none — so the editor decides only WHERE they sit. The
   * placement is the point: on paper the notes print directly under the grid, and they used to live
   * below everything on screen, so the screen and the printout disagreed about what belonged with
   * what.
   */
  notesSlot?: React.ReactNode;
  /**
   * Call-ups on THIS game (mig 309) — game builder only; the template editor passes nothing, since
   * a template is a shape for the season and a borrowed player is not part of one.
   *
   * ⚠ `players` are the call-ups already linked to this game — **never the saved pool.** However
   * many a team has, a fresh game hands in `[]` and the builder offers none of them. The pool lives
   * behind `onCallUp`, which opens the sheet (owner ruling R3, 2026-09-22).
   */
  callUps?: {
    players: RepRosterPlayer[];
    /** Opens the "Call up a player" sheet. */
    onCallUp: () => void;
    onCloseSheet: () => void;
    sheetOpen: boolean;
    /**
     * The sheet's contents, owned by the PAGE. The editor supplies the frame and the trigger and
     * knows nothing about the pool, the fetch or the form — the same split as `controlsExtra`.
     */
    sheet: React.ReactNode;
    /** Takes a call-up off this game entirely — not just out of the batting order. */
    onRemoveCallUp: (playerId: string) => void;
  };
  /**
   * The persisted Draft/Ready handoff (mig 304, Phase 2 D1) — game lineups only. Undefined for the
   * template editor, which has no "ready for game day" concept; the readiness strip then falls
   * back to its old coverage-only wording ("Coverage complete") instead of offering to mark ready.
   */
  readyState?: {
    status: 'draft' | 'ready';
    /** Already formatted in the org's zone — this component doesn't own timezone concerns. */
    readyAtLabel: string | null;
    onMarkReady: () => void;
    marking: boolean;
    error?: string;
    /** D11d: game time has arrived — an edit is the game now, not a reopened plan, so the strip
     *  stops promising that an edit returns the lineup to Draft. The page owns the clock. */
    gameStarted?: boolean;
  };
}

export default function LineupEditor(props: LineupEditorProps) {
  const {
    roster, rows, onRowsChange, lineupMode, onLineupModeChange, inningCount, onInningCountChange,
    sportPack, seasonCaps, gameRules, onGameRulesChange, defaultPolicy = 'balanced',
    addLabel, notInHeading, onBeforeMutate, onNotice, controlsExtra, notice, readyState, attendance,
    callUps, notesSlot,
  } = props;
  const confirm = useConfirm();
  // THE PHONE'S FORMS (phone re-evaluation stage 3, owner ruling 2026-09-21) differ from the desktop's
  // in STRUCTURE — the Setup row and its panel (D1), the tool row the page hands in (D2), the inning
  // list in the grid's place (D5) — so the DOM decides, not the stylesheet. `useIsPhone` reads the
  // breakpoint synchronously and both pages mount this editor after their load, so a phone never
  // paints the grid first. Desktop and the 641–768 band: nothing here changes.
  const isPhone = useIsPhone();

  const [autoFillOpen, setAutoFillOpen] = useState(false);
  const [autoPolicy, setAutoPolicy] = useState<PositionPolicy>(defaultPolicy);
  const [autoFillMode, setAutoFillMode] = useState<FillMode>('empty');
  const [aSquadEmphasis, setASquadEmphasis] = useState<'balanced_sits' | 'prioritized'>('balanced_sits');
  const [noBackToBackSits, setNoBackToBackSits] = useState(true);
  const [gameRulesOpen, setGameRulesOpen] = useState(false);
  // Auto-fill rationale (Phase 3, D6/D7) — a running commentary on the LAST generate, never
  // persisted and never reconciled against the saved lineup. cellReasons self-invalidates (each
  // entry carries the position it was written for; render only trusts it while the live cell still
  // matches), so a manual edit silently retires its own reason. pitcherCappedInnings has no such
  // check (a blank cell carries no value to compare), so runGenerate below re-derives it for
  // whatever range it just wrote instead of only ever adding to it.
  const [rationale, setRationale] = useState<GenerationRationale>({ cellReasons: new Map(), pitcherCappedInnings: new Set() });
  // Which innings auto-fill/reshuffle should WRITE (default = all). `fillTo === null` tracks the last
  // inning. Innings outside the range keep what's there and are still counted toward the rules.
  const [fillFrom, setFillFrom] = useState(1);
  const [fillTo, setFillTo] = useState<number | null>(null);
  const rangeFrom = Math.min(Math.max(1, fillFrom), inningCount);
  const rangeTo = Math.min(fillTo ?? inningCount, inningCount);
  // Two views of ONE lineup (D8): build it, read it. Opens on the grid.
  const [view, setView] = useState<'lineup' | 'summary'>('lineup');
  // The row-actions sheet (D8, touch widths only — the handle that opens it is hidden wider):
  // which player's row it is open for. Move up / down keep it open so a two-slot move is two
  // taps, not two round trips; Remove and Cancel close it.
  const [rowActionsFor, setRowActionsFor] = useState<string | null>(null);
  const rowSheetRef = useRef<HTMLDivElement>(null);
  useDismissable(rowActionsFor !== null, rowSheetRef, () => setRowActionsFor(null));
  /* ⚠ BACK CLOSES THE DRAWER, IT DOES NOT LEAVE THE PAGE (owner, 2026-09-22 — “when I hit
     back it brings me to the lineup list and not the lineup I am editing”). These panels predate
     §219 and never registered a level, which was survivable while they were small popovers and is
     not now they are full-width modal drawers: a coach who opens one and reaches for the back
     gesture loses the lineup. One step each, so Back — the gesture or the button — goes up ONE
     level to the page behind, and the drawer's own exits consume it. */
  useBackStep(rowActionsFor !== null, () => setRowActionsFor(null));
  useEffect(() => {
    if (rowActionsFor !== null) rowSheetRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
  }, [rowActionsFor]);
  // ONE lens over the lineup, two views (owner, 2026-09-18): the Lineup check — everything still
  // waiting on the coach, behind the status strip — and the inning inspector (Phase 4, F12), the
  // inning-first lens over the grid. An inning opened FROM the check remembers it, so the lens
  // carries a way back; opened from an inning heading, the X is the way out. null = closed.
  type Lens = { view: 'check' } | { view: 'inning'; inning: number; fromCheck: boolean };
  const [lens, setLens] = useState<Lens | null>(null);
  // ONE INNING AT A TIME on a phone (D5): the inning the list shows. The VIEW, never the data —
  // `inningPositions` is untouched by it and undo/redo span innings as they always have. Opens on
  // 1; "Review inning N" (the check) and the inspector's own prev/next keep it in step; it stays put
  // while the panel, the inspector or the position sheet open over it. Clamped at read so a shrunk
  // inning count can never leave the list on an inning that no longer exists.
  const [phoneInning, setPhoneInning] = useState(1);
  const inningOnScreen = Math.min(Math.max(1, phoneInning), Math.max(1, inningCount));
  // The position sheet (D5): whose pill is open, for the inning on screen. null = closed.
  const [positionFor, setPositionFor] = useState<string | null>(null);
  // The Setup row (D1): focus returns to it when its panel closes by a key or a Generate.
  const setupRowRef = useRef<HTMLButtonElement>(null);
  const autoFillLabel = { competitive: 'Competitive', balanced: 'Balanced', development: 'Development' }[autoPolicy];
  // Keep the auto-fill policy in sync when the parent changes its pre-pick (e.g. a game loads).
  const policyInitRef = useRef(false);
  useEffect(() => {
    if (!policyInitRef.current) { policyInitRef.current = true; setAutoPolicy(defaultPolicy); }
  }, [defaultPolicy]);

  const autoFillRef = useRef<HTMLDivElement>(null);
  // A tap outside closes the panel and leaves focus where the tap put it; Escape closes it and, on
  // a phone, seats focus back on the Setup row it opened from (the keyboard is still driving).
  useDismissable(autoFillOpen, autoFillRef, () => setAutoFillOpen(false), () => closePanelToRow());
  useBackStep(autoFillOpen, () => closePanelToRow());

  /**
   * ⚠⚠ COVERING THE NAV IS NOT THE SAME AS TAKING IT AWAY (/simplify altitude pass, 2026-09-23).
   *
   * The 2026-09-23 ruling — a FORM covers the bottom nav, a MENU sits on top of it — was first
   * built as geometry alone: `bottom: 0` and a z-index above the bar. That defends the THUMB and
   * nothing else. The bar's tabs stayed in the tab order and in the accessibility tree underneath
   * the drawer, so the very defect the ruling names — *a coach leaves the builder mid-edit by
   * hitting Schedule* — was still reachable by Tab + Enter, or by a screen reader, on a surface
   * that had just been declared modal.
   *
   * The portal already solved this generally in July and the builder's drawers never enrolled:
   * `useOverlayOpen` (lib/coaches-overlay.tsx) drives BOTH halves — `CoachesBottomNav` hides
   * itself (`visibility: hidden`, no layout shift, so the tabs leave the tree AND the tab order)
   * and the provider locks body scroll behind the topmost overlay. It is a COUNTER, so the three
   * drawers here compose with each other and with any confirm opened from inside one.
   *
   * ⚠ GATED ON THE NAV BREAKPOINT, and that is a behaviour decision rather than a styling one, so
   * JS is the right place for it. Above 900 the bar is `display: none` and already out of both
   * trees — there is no hole to close — while Templates and the call-up sheet are still ordinary
   * anchored POPOVERS up there, which must not lock the page behind them. Setup is a centered
   * modal at that width but is deliberately left as it was: its own backdrop already covers the
   * page, and changing desktop scroll behaviour is not what this ruling asked for.
   *
   * ⚠ The geometry does NOT come out. A hidden bar leaves a ~72px blank strip where it was, so
   * the drawer still has to sit at the screen's foot and the scrim still has to reach it.
   */
  const isPhoneNav = useIsPhoneNav();
  useOverlayOpen(autoFillOpen && isPhoneNav);
  useOverlayOpen(!!callUps?.sheetOpen && isPhoneNav);

  /**
   * ⚠⚠ THE CALL-UP DRAWER REGISTERS THE SAME TWO, AND SHIPPED WITHOUT THEM.
   *
   * It was the ONE overlay in this builder where Escape did nothing, Tab walked out into the lineup
   * behind it, and the Android back gesture left the page entirely — losing the lineup a coach was
   * editing, which is the exact defect the §219 back-step ruling was written for (owner, 2026-09-22:
   * *"when I hit back it brings me to the lineup list and not the lineup I am editing"*). Every
   * sibling panel — Setup, the row-actions sheet, Templates, Print — registers both; this one hand-
   * rolled a `focus()` call instead and inherited none of it. Found by `/simplify`'s reuse pass.
   */
  const callUpRef = useRef<HTMLDivElement>(null);
  useDismissable(!!callUps?.sheetOpen, callUpRef, () => callUps?.onCloseSheet());
  useBackStep(!!callUps?.sheetOpen, () => callUps?.onCloseSheet());

  // Two input worlds, two activation rules (D8). A mouse lifts a row after 6px of travel, as it
  // always has. A finger lifts it after a HOLD (250ms without drifting) — that is what lets the
  // handle live inside the sideways-scrolling grid: hold and swipe are told apart by time, not by
  // direction, so the drag no longer has to be moved out to a list of its own. A quick tap never
  // meets the constraint, so it falls through to the handle's onClick (the row-actions sheet); a
  // drag that did activate swallows the click that follows it (dnd-kit stops it in capture).
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const analysis = analyzeLineup(
    rows.map(r => ({ playerId: r.player.id, inningPositions: r.inningPositions })),
    inningCount, sportPack.fieldPositions,
  );
  // ⚰ `setupFolded` — the Setup row's frozen-at-open lime tone (D1) — was DELETED on 2026-09-22.
  //    The row has one tone now, so there is nothing left to freeze; what a new lineup gets instead
  //    is an Auto-fill PILL, read live from `analysis.hasAssignments` at the row itself. The full
  //    reasoning is on the Setup row's own comment block below. Do not reintroduce a lime row.
  const fairPlayByPlayer = new Map(analysis.fairPlay.map(f => [f.playerId, f]));
  const summaryPositions = POSITION_ORDER.filter(pos => analysis.fairPlay.some(f => (f.positionCounts[pos] ?? 0) > 0));
  const benchVals = analysis.fairPlay.map(f => f.benched);
  const benchMin = benchVals.length ? Math.min(...benchVals) : 0;
  const benchMax = benchVals.length ? Math.max(...benchVals) : 0;
  // Only flag unfilled field positions for innings the coach has actually STARTED filling — a wholly
  // blank inning (or a wholly blank grid) is intentional, not an error, so it shouldn't nag.
  const assignedInnings = new Set<number>();
  for (const r of rows) for (const [k, v] of Object.entries(r.inningPositions)) if (v) assignedInnings.add(Number(k));
  // Keep untouched innings quiet; once an inning has work in it, its missing roles are an explicit
  // draft check rather than a speculative explanation about eligibility.
  const openRoleInnings = analysis.missingFieldPositions.filter(u => assignedInnings.has(u.inning));
  const openRolesByInning = new Map(openRoleInnings.map(issue => [issue.inning, issue.positions]));
  const period = sportPack.periodLabel;
  const periodLc = period.toLowerCase();
  // ── What the lineup still needs, inning by inning — the rows of the Lineup check. A started
  // inning earns a row for a proven clash, an open role or an undecided player; the innings nobody
  // has started are ONE row (they are not six problems, they are one fact: not started yet). The
  // one cause a row may name is the generator's proven one (D7: no eligible pitcher under the cap);
  // every other open role stays a neutral fact, per F01, and the lens explains it role by role.
  const checkInnings: LineupCheckInning[] = [];
  const untouchedInnings: number[] = [];
  for (let inning = 1; inning <= inningCount; inning++) {
    if (!assignedInnings.has(inning)) {
      if (analysis.hasAssignments) untouchedInnings.push(inning);
      continue;
    }
    const clashes = analysis.conflicts.filter(c => c.inning === inning).map(c => c.position);
    const open = openRolesByInning.get(inning) ?? [];
    const undecided = analysis.inningFill[inning - 1]?.unassigned ?? 0;
    if (clashes.length === 0 && open.length === 0 && undecided === 0) continue;
    const parts: string[] = [];
    if (clashes.length) parts.push(`Two players at ${clashes.join(' and ')}`);
    if (open.length) {
      const capped = !!sportPack.pitcherPosition && open.includes(sportPack.pitcherPosition) && rationale.pitcherCappedInnings.has(inning);
      parts.push(`${open.join(', ')} open${capped ? ' · no eligible pitcher under the innings cap' : ''}`);
    }
    if (undecided) parts.push(`${undecided} player${undecided === 1 ? '' : 's'} undecided`);
    checkInnings.push({ inning, state: clashes.length ? 'bad' : 'warn', caption: parts.join(' · ') });
  }
  const untouched = untouchedInnings.length
    ? { label: untouchedInnings.length === 1 ? `${period} ${untouchedInnings[0]}` : `${period}s ${formatInningRanges(untouchedInnings)}`, first: untouchedInnings[0] }
    : null;
  // The one shared fact across the open-role innings, said once ("P open in all 6") — the reason
  // six identical cards used to stack above the grid.
  const patternNote = (() => {
    if (openRoleInnings.length < 2) return null;
    const shared = openRoleInnings[0].positions.filter(p => openRoleInnings.every(i => i.positions.includes(p)));
    return shared.length ? `${shared.join(', ')} open in all ${openRoleInnings.length}` : null;
  })();
  const unevenBench = analysis.benchSpread && analysis.benchSpread.max - analysis.benchSpread.min > 1 ? analysis.benchSpread : null;
  const comingNames = attendance?.comingNotInLineup.map(playerDisplayName) ?? [];
  const outNames = attendance?.outButInLineup.map(playerDisplayName) ?? [];
  const hasAttendanceIssue = comingNames.length > 0 || outNames.length > 0;
  // The strip is a DOOR whenever the check has a row to show — the fair-play note included
  // (`/review`, 2026-09-19: excluding it as "a reading, not a decision" left a covered lineup
  // with a lopsided bench reading ✓ and no way to open the check that listed it; the old page
  // showed that line unconditionally).
  const checkHasRows = checkInnings.length > 0 || untouched != null || hasAttendanceIssue || unevenBench != null;
  // The last row cleared from inside the check (the Out player removed, the last role assigned
  // through the lens and back) closes it: the coach lands on the strip, which now reads ✓. The
  // shell's `open` is derived so an empty check never paints; the effect retires the stale lens
  // state so a later edit that reopens a row does not reopen the check uninvited — and seats
  // focus on the strip, because the button that opened the check is a plain <div> by then and
  // the floor's restore has nothing to land on.
  const checkIsEmpty = !checkHasRows;
  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!checkIsEmpty || lens?.view !== 'check') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- retiring a lens the data has closed
    setLens(null);
    stripRef.current?.focus({ preventScroll: true });
  }, [checkIsEmpty, lens]);
  const conflictsByCell = new Set(analysis.conflicts.map(conflict => `${conflict.inning}:${conflict.position}`));
  const effectiveCaps = resolveLineupCaps(
    seasonCaps ?? null,
    gameRules ? normalizeRulesOverride({
      maxInningsPerPosition: gameRules.maxPos,
      pitcherMaxInnings: gameRules.pitcher,
      minInningsPerPlayer: gameRules.minPlay,
    }) : null,
  );
  const cellIssueFor = (playerId: string, inning: number, value: string) => {
    const hasConflict = !!value && conflictsByCell.has(`${inning}:${value}`);
    const isOpen = !value && assignedInnings.has(inning);
    // Auto-fill rationale (D6): only offered for a filled, issue-free cell, and only while the
    // stored reason's position still matches what's actually in the cell — a manual override
    // simply stops matching and the reason disappears with no extra bookkeeping.
    const stored = rationale.cellReasons.get(playerId)?.[String(inning)];
    const reasonText = !hasConflict && !isOpen && stored?.position === value ? describePlacementReason(stored.reason) : undefined;
    return {
      isOpen,
      hasConflict,
      description: hasConflict
        ? `Position clash: more than one player is assigned ${value} in inning ${inning}.`
        : isOpen ? `Open decision in inning ${inning}.` : reasonText,
    };
  };
  // Two vocabularies over the SAME eligibility signal (analysis.readiness): the template editor has
  // no persisted ready concept, so it keeps the old coverage-only wording; a game lineup shows the
  // real Draft/Ready badge (readyState present) and offers "Mark ready" whenever nothing is WRONG
  // (D11: a clash blocks, an empty grid has nothing to mark; open work never blocks — it rides on
  // the button and on the Ready strip's sentence instead).
  const badge = readyState ? deriveLineupBadge(analysis, readyState.status) : analysis.readiness;
  // The innings still needing a decision — the shared count the hub chip also carries, so the
  // button here and "Ready · 3 open" on the games list never disagree.
  const openInnings = inningsNeedingDecision(analysis);
  const openInningsLabel = openInnings.length
    ? `${openInnings.length === 1 ? period : `${period}s`} ${formatInningRanges(openInnings)} open — fill ${openInnings.length === 1 ? 'it' : 'them'} on game day`
    : null;
  // ── The strip's one sentence: what is waiting, named — the check's rows in prose. Each inning
  // is counted ONCE, under its row's leading fact (a clash outranks its open roles), so an inning
  // with both never reads as two innings (`/review`, 2026-09-19). Split in two so the Ready strip
  // can say the inning facts in one compact span and still name the rest (a mismatch, an uneven
  // bench) beside it. ──
  const { inningWaiting, otherWaiting } = (() => {
    const inningWaiting: string[] = [];
    const otherWaiting: string[] = [];
    const where = (lead: string, innings: number[]) => innings.length === 1 ? `${lead} in ${periodLc} ${innings[0]}` : `${lead} in ${innings.length} ${periodLc}s`;
    const clashRows = checkInnings.filter(r => r.state === 'bad').map(r => r.inning);
    const openRows = checkInnings.filter(r => r.state === 'warn' && openRolesByInning.has(r.inning)).map(r => r.inning);
    const undecidedRows = checkInnings.filter(r => r.state === 'warn' && !openRolesByInning.has(r.inning)).map(r => r.inning);
    if (clashRows.length) inningWaiting.push(where(clashRows.length === 1 ? 'Position clash' : 'Position clashes', clashRows));
    if (openRows.length) inningWaiting.push(where('Open roles', openRows));
    if (undecidedRows.length) inningWaiting.push(where('Players undecided', undecidedRows));
    if (untouched) inningWaiting.push(`${untouched.label} not started`);
    if (unevenBench) otherWaiting.push(`Uneven bench time — players sit between ${unevenBench.min} and ${unevenBench.max} ${periodLc}s`);
    if (outNames.length) otherWaiting.push(outNames.length === 1 ? `${outNames[0]} is marked Out but still in the lineup` : `${outNames.length} players marked Out are still in the lineup`);
    if (comingNames.length) otherWaiting.push(comingNames.length === 1 ? `${comingNames[0]} is marked in but not in the lineup` : `${comingNames.length} players marked in aren’t in the lineup`);
    return { inningWaiting, otherWaiting };
  })();
  const waiting = [...inningWaiting, ...otherWaiting].join(' · ');
  const withWaiting = (lead: string) => waiting ? `${lead} · ${waiting}` : lead;
  // THE READY PROMISE MOVES BEHIND THE ROW ON A PHONE (owner, 2026-09-22). "An edit before game
  // time returns this to Draft" is a sentence about something the coach has NOT done, printed under
  // something they have — on a 390px row it turns a 52px line into a four-line paragraph. It moves
  // into the Lineup check's subtitle instead.
  // ⚠ ONLY WHEN THERE IS A CHECK TO MOVE IT INTO. A Ready lineup with nothing waiting has no check
  // door (`checkHasRows`), so dropping the sentence there would delete it rather than relocate it —
  // and that row is two words long anyway, which is not the case this ruling is about. Both this
  // flag and `checkSubtitle` below read the SAME condition, so the sentence is in exactly one place.
  const draftPromiseMovedToCheck = isPhone && checkHasRows && !!readyState && !readyState.gameStarted && badge === 'ready';
  const strip: { label: string; detail: string } = readyState ? {
    not_started: { label: 'Not started', detail: withWaiting('Choose positions or Auto-fill to begin') },
    draft: {
      label: 'Draft',
      detail: analysis.readiness === 'ready'
        ? withWaiting('Every role is covered — mark it ready when you’re confident in it')
        : waiting || 'Some player decisions are still open',
    },
    needs_review: { label: 'Needs review', detail: waiting },
    // Ready with open spots (D11): the coach's word, then the innings they mean to fill at the
    // field as one span, then anything else waiting. The edit-returns-to-Draft promise is only
    // made while it is true — before game time.
    ready: {
      label: 'Ready',
      detail: [
        readyState.readyAtLabel ? `Marked ready · ${readyState.readyAtLabel}` : 'Marked ready',
        openInningsLabel,
        ...otherWaiting,
      ].filter(Boolean).join(' · ') + (readyState.gameStarted || draftPromiseMovedToCheck ? '' : '. An edit before game time returns this to Draft'),
    },
  }[badge] : {
    not_started: { label: 'Not started', detail: 'Choose positions or Auto-fill to begin' },
    draft: { label: 'Draft', detail: waiting || 'Some player decisions are still open' },
    needs_review: { label: 'Needs review', detail: waiting },
    // withWaiting here too: a covered template can still carry an uneven bench, and the mark
    // beside the word warns about it — the sentence must name what the mark is warning about.
    ready: { label: 'Coverage complete', detail: withWaiting('Every player has a decision and each required role is covered') },
  }[analysis.readiness];
  // The status symbol (owner, 2026-09-18): a cross on a proven clash, a warning while anything
  // waits, a check once every role is covered — none until there is work to read. On a lineup the
  // coach has MARKED ready the check is their word (D11c, owner 2026-09-20): it answers "am I done
  // here?", and the open innings are named in the sentence beside it, never hidden by the mark.
  const stripMark: { state: LineupMarkState; label: string } | null = badge === 'needs_review'
    ? { state: 'bad', label: 'Position clash' }
    : readyState && badge === 'ready' ? { state: 'ok', label: 'Marked ready' }
      : checkHasRows ? { state: 'warn', label: 'Needs a decision' }
        : analysis.readiness === 'ready' ? { state: 'ok', label: 'Every role covered' }
          : null;
  const inningsWaiting = checkInnings.length + untouchedInnings.length;
  const mismatches = outNames.length + comingNames.length;
  const checkSubtitle = [
    inningsWaiting > 0 ? `${inningsWaiting} ${periodLc}${inningsWaiting === 1 ? ' needs' : 's need'} a decision` : null,
    mismatches > 0 ? `${mismatches} attendance mismatch${mismatches === 1 ? '' : 'es'}` : null,
    // The sentence the phone's Ready row handed over — see `draftPromiseMovedToCheck` above.
    draftPromiseMovedToCheck ? 'An edit before game time returns this to Draft' : null,
  ].filter(Boolean).join(' · ');
  const pitcherCapFor = (row: LineupPlayerRow) => {
    const playerCap = row.player.lineupProfile?.pitcher?.maxInnings ?? null;
    const teamCap = effectiveCaps.pitcherInningsCap;
    if (playerCap == null) return teamCap;
    if (teamCap == null) return playerCap;
    return Math.min(playerCap, teamCap);
  };
  const hasPlayerAttention = analysis.fairPlay.some(f => f.consecutiveBench || f.unassigned > 0);

  // A row of the check opens the inspector ON that inning (the review is the lens) and still
  // scrolls the grid to it underneath, so closing the lens leaves the coach at the right column.
  function focusInning(inning: number) {
    setView('lineup');
    // The phone's list steps to the inning first (D5), so closing the lens lands on its rows.
    setPhoneInning(inning);
    setLens({ view: 'inning', inning, fromCheck: true });
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-lineup-inning="${inning}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    });
  }

  function onFieldGauge(fp?: { onField: number; benched: number; consecutiveBench: boolean }) {
    const onF = fp?.onField ?? 0;
    const pct = inningCount ? Math.round((onF / inningCount) * 100) : 0;
    return (
      <span className={styles.lineupGauge}>
        <span className={styles.lineupGaugeTrack}><span className={styles.lineupGaugeFill} data-warn={fp?.consecutiveBench ? 'true' : undefined} style={{ width: `${pct}%` }} /></span>
        <span className={styles.lineupGaugeCap}>{onF}/{inningCount} · sits {fp?.benched ?? 0}</span>
      </span>
    );
  }

  // ── Mutations (all go through onBeforeMutate → onRowsChange; dedup inside the updater) ──
  function mutate(updater: (rows: LineupPlayerRow[]) => LineupPlayerRow[]) {
    onBeforeMutate?.();
    onRowsChange(updater);
  }
  /**
   * D-C12 — dragging across the cut line in 9-player ball PROMOTES the player.
   *
   * Batting numbers are only handed out to rows flagged `starter`, so before this a drag from the
   * bench to the top of the order did nothing visible at all: the player got no number and the
   * one batting first stayed first. A gesture that silently no-ops is exactly the "worse than not
   * using it" failure this chunk exists to remove — so a move into the batting section sets the
   * flag, and the ninth starter is displaced to the top of the bench rather than quietly dropped.
   */
  function applySectionMove(
    list: LineupPlayerRow[], playerId: string, intoStarters: boolean,
  ): LineupPlayerRow[] {
    if (lineupMode !== 'nine_player') return list;
    const moved = list.find(r => r.player.id === playerId);
    if (!moved || moved.starter === intoStarters) return list;

    let next = list.map(r => (r.player.id === playerId ? { ...r, starter: intoStarters } : r));
    if (intoStarters) {
      const starters = next.filter(r => r.starter);
      if (starters.length > 9) {
        // The last starter in the NEW order steps down — never the one just promoted. Searching
        // from the end for the first row that ISN'T them matters: dropping a player at the very
        // bottom of the batting section would otherwise leave ten starters, and the tenth would
        // render as a starter with no number.
        const demoted = [...starters].reverse().find(r => r.player.id !== playerId);
        if (demoted) {
          next = next.map(r => (r.player.id === demoted.player.id ? { ...r, starter: false } : r));
        }
      }
    }
    return next;
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    mutate(list => {
      const oldIndex = list.findIndex(r => r.player.id === active.id);
      const newIndex = list.findIndex(r => r.player.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return list;
      // Where it LANDED decides whether it is in the order or on the bench.
      const target = list[newIndex];
      const moved = arrayMove(list, oldIndex, newIndex);
      return renumberBattingOrder(applySectionMove(moved, String(active.id), target.starter), lineupMode);
    });
  }
  /**
   * Nudge one player by a single place — the row-actions sheet's Move up / Move down, and the
   * non-drag path on a phone. Keyed on the PLAYER, not a display index. Crossing into or out of
   * the starters by nudge promotes/demotes exactly as dragging does (D-C12), so the two paths can
   * never disagree.
   */
  function moveRowByPlayer(playerId: string, dir: -1 | 1) {
    mutate(list => {
      const from = list.findIndex(r => r.player.id === playerId);
      const to = from + dir;
      if (from < 0 || to < 0 || to >= list.length) return list;
      const target = list[to];
      const moved = arrayMove(list, from, to);
      return renumberBattingOrder(applySectionMove(moved, playerId, target.starter), lineupMode);
    });
  }
  function removePlayer(playerId: string) {
    mutate(list => renumberBattingOrder(list.filter(r => r.player.id !== playerId), lineupMode));
  }
  function addPlayer(playerId: string) {
    mutate(list => {
      if (list.some(r => r.player.id === playerId)) return list;
      /* ⚠ The roster AND this game's call-ups (mig 309). The Call-ups group's own Add button routes
         here, and a roster-only lookup would have made it a button that silently did nothing. */
      const player = roster.find(p => p.id === playerId)
        ?? (callUps?.players ?? []).find(p => p.id === playerId);
      if (!player) return list;
      return renumberBattingOrder([...list, { player, battingOrder: '', starter: lineupMode === 'everyone_bats', inningPositions: {}, notes: '' }], lineupMode);
    });
  }
  function toggleStarter(playerId: string, checked: boolean) {
    mutate(list => renumberBattingOrder(list.map(r => r.player.id === playerId ? { ...r, starter: checked } : r), lineupMode));
  }
  function setPosition(playerId: string, inning: number, position: string) {
    mutate(list => list.map(r => r.player.id === playerId ? { ...r, inningPositions: { ...r.inningPositions, [String(inning)]: position } } : r));
  }
  /** Every cell the inspector changes in one gesture (a swap touches two) as ONE undo step. */
  function applyInningChanges(inning: number, changes: { playerId: string; position: string }[]) {
    const byPlayer = new Map(changes.map(c => [c.playerId, c.position]));
    mutate(list => list.map(r => {
      const position = byPlayer.get(r.player.id);
      return position === undefined ? r : { ...r, inningPositions: { ...r.inningPositions, [String(inning)]: position } };
    }));
  }
  function changeMode(mode: RepLineupMode) {
    onBeforeMutate?.();
    onLineupModeChange(mode);
    onRowsChange(list => renumberBattingOrder(list.map((r, i) => mode === 'everyone_bats' ? { ...r, starter: true } : { ...r, starter: i < 9 }), mode));
  }
  function changeInnings(n: number) {
    onBeforeMutate?.();
    onInningCountChange(n);
    // Keep the auto-fill inning range within the new count (else a shrunk-then-grown count could
    // silently restore a stale upper bound).
    if (fillTo !== null && fillTo > n) setFillTo(n);
    if (fillFrom > n) setFillFrom(n);
  }

  // ── Auto-fill / Reshuffle (shared generate) ──
  function runGenerate(fillMode: FillMode) {
    const override = gameRules ? normalizeRulesOverride({
      maxInningsPerPosition: gameRules.maxPos, pitcherMaxInnings: gameRules.pitcher, minInningsPerPlayer: gameRules.minPlay,
    }) : null;
    const fielders = lineupMode === 'nine_player' ? rows.filter(r => r.starter) : rows;
    const benchOnly = lineupMode === 'nine_player' ? rows.filter(r => !r.starter) : [];
    const { assignment: generated, rationale: genRationale } = generateBestLineup({
      players: fielders.map(r => {
        const prefs = playerPositionPrefs(r.player, sportPack.pitcherPosition);
        return {
          playerId: r.player.id, preferred: prefs.preferred, never: prefs.never,
          pitcher: r.player.lineupProfile?.pitcher ?? null, aSquad: r.player.lineupProfile?.aSquad ?? false,
          inningPositions: r.inningPositions,
        };
      }),
      inningCount, policy: autoPolicy, fillMode, fieldPositions: sportPack.fieldPositions, pitcherPosition: sportPack.pitcherPosition,
      ...resolveLineupCaps(seasonCaps ?? null, override),
      aSquadEmphasis, noBackToBackSits,
      fillFrom: rangeFrom, fillTo: rangeTo,
    });
    mutate(list => list.map(r => {
      if (lineupMode === 'nine_player' && benchOnly.some(b => b.player.id === r.player.id)) {
        // Bench players sit only within the fill range; cells outside the range are left as-is.
        const next = { ...r.inningPositions };
        for (let inn = rangeFrom; inn <= rangeTo; inn++) {
          if (fillMode === 'regenerate' || !next[String(inn)]) next[String(inn)] = 'Bench';
        }
        return { ...r, inningPositions: next };
      }
      return { ...r, inningPositions: generated.get(r.player.id) ?? r.inningPositions };
    }));
    setRationale(prev => {
      const cellReasons = new Map(prev.cellReasons);
      for (const [playerId, byInning] of genRationale.cellReasons) {
        cellReasons.set(playerId, { ...(cellReasons.get(playerId) ?? {}), ...byInning });
      }
      // pitcherCappedInnings has no per-cell value to self-check against, so re-derive it for the
      // range this run actually wrote rather than only ever adding to it (else a fixed cap that
      // lets a later run fill the mound would leave a stale "capped" flag behind).
      const pitcherCappedInnings = new Set(
        [...prev.pitcherCappedInnings].filter(inn => inn < rangeFrom || inn > rangeTo),
      );
      for (const inn of genRationale.pitcherCappedInnings) pitcherCappedInnings.add(inn);
      return { cellReasons, pitcherCappedInnings };
    });
    onNotice?.('');
  }

  // Re-entrancy guard: a rapid double-tap of Generate/Reshuffle must not stack two confirm dialogs
  // or run two generate passes from one perceived click.
  const genBusyRef = useRef(false);
  async function handleAutoFill() {
    if (genBusyRef.current) return;
    genBusyRef.current = true;
    try {
      if (autoFillMode === 'regenerate' && rows.some(r => Object.values(r.inningPositions).some(Boolean))) {
        if (!(await confirm({ title: 'Regenerate lineup?', message: 'This replaces the positions currently in the grid. Continue?', confirmText: 'Regenerate', cancelText: 'Keep current', tone: 'warning' }))) return;
      }
      runGenerate(autoFillMode);
      closePanelToRow();
    } finally {
      genBusyRef.current = false;
    }
  }
  /** True when it ran — the phone's panel closes on a reshuffle it made, never on a kept one. */
  async function handleReshuffle(): Promise<boolean> {
    if (genBusyRef.current || rows.length === 0) return false;
    genBusyRef.current = true;
    try {
      if (rows.some(r => Object.values(r.inningPositions).some(Boolean))) {
        if (!(await confirm({ title: 'Reshuffle the lineup?', message: 'This replaces the positions currently in the grid with a fresh arrangement with even bench rotation, using your current auto-fill settings. Continue?', confirmText: 'Reshuffle', cancelText: 'Keep current', tone: 'warning' }))) return false;
      }
      runGenerate('regenerate');
      return true;
    } finally {
      genBusyRef.current = false;
    }
  }

  /** The panel closes and focus goes back to the Setup row that opened it (D1) — desktop shares
   *  this trigger with the phone now, so the return-focus is no longer phone-only. */
  function closePanelToRow() {
    setAutoFillOpen(false);
    setupRowRef.current?.focus({ preventScroll: true });
  }

  async function handleClear() {
    if (rows.some(r => Object.values(r.inningPositions).some(Boolean))) {
      if (!(await confirm({ title: 'Clear all positions?', message: 'This empties every inning for every player. You can undo it right after.', confirmText: 'Clear', cancelText: 'Keep', tone: 'warning' }))) return;
    }
    mutate(list => list.map(r => ({ ...r, inningPositions: {} })));
    onNotice?.('');
  }

  const notInLineup = roster.filter(p => !rows.some(r => r.player.id === p.id));
  /**
   * Call-ups on this game who are not in the order. Normally EMPTY — you call someone up in order
   * to use them, so the sheet puts them straight into the lineup. This group appears when a coach
   * takes one back out of the order but keeps them on the game, which is the one state where "on
   * this game but not batting" is a real thing rather than a loose end.
   */
  const callUpsNotInLineup = (callUps?.players ?? []).filter(p => !rows.some(r => r.player.id === p.id));
  // A removed or re-fetched row simply stops matching and the sheet closes itself.
  const sheetIndex = rowActionsFor === null ? -1 : rows.findIndex(r => r.player.id === rowActionsFor);
  const sheetRow = sheetIndex >= 0 ? rows[sheetIndex] : null;

  // Format and Innings — per-game configuration (D3), ONE JSX in two homes: the desktop's Setup
  // group beside Auto-fill, and the top of the phone's panel (D1).
  const setupFields = (
    <div className={styles.lineupSetupFields}>
      <label className={styles.lineupControlLabel}>
        <span>Format</span>
        <select className={styles.select} aria-label="Lineup format" value={lineupMode} onChange={e => changeMode(e.target.value as RepLineupMode)}>
          <option value="everyone_bats">Everyone bats</option>
          <option value="nine_player">9 player ball</option>
        </select>
      </label>
      <label className={styles.lineupControlLabel}>
        <span>Innings</span>
        <select className={styles.select} aria-label="Lineup innings" value={inningCount} onChange={e => changeInnings(Number(e.target.value))}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
    </div>
  );
  // Reshuffle — now ONE skin everywhere: a quiet row under Generate, inside the Setup & Auto-fill
  // drawer both breakpoints share. It closes the drawer on a reshuffle it made, never on a kept
  // one (`handleReshuffle` says whether it ran).
  const reshuffleProps = {
    type: 'button' as const,
    disabled: rows.length === 0,
    onClick: async () => { if (await handleReshuffle()) closePanelToRow(); },
    title: 'Fresh arrangement with even bench rotation, using your current auto-fill settings',
  };
  /* CLEAR IS A TOOL, AND TOOLS LIVE IN THE TOOL ROW (owner, 2026-09-22). It used to be a bare text
     link under the grid — on a phone that left it stranded in its own 44px band between the hint and
     the notes, the only control on the screen with nothing beside it. It is the same kind of thing as
     Undo, Redo, Print and Templates (it acts on the grid; the page creates nothing), so it is the same
     square, last in their row, and it greys out when there is nothing to erase the way Undo greys out
     when there is nothing to take back. The confirm and the undo step behind it are unchanged — this
     moved the control, not what it does. */
  const clearButton = (
    <button type="button" className={styles.footerIconBtn} aria-label="Clear positions" title="Clear positions"
      disabled={!analysis.hasAssignments} onClick={handleClear}>
      <Eraser size={18} />
    </button>
  );
  // The phone's stepper and dots (D5) read the same analysis the grid's inning headings do.
  const phoneDots: InningDotState[] = Array.from({ length: inningCount }, (_, i) => {
    const n = i + 1;
    return analysis.conflictInnings.has(n) ? 'clash' : openRolesByInning.has(n) ? 'open' : assignedInnings.has(n) ? 'done' : 'untouched';
  });
  const phoneOpenRoles = openRolesByInning.get(inningOnScreen);
  const phoneCoverage = assignedInnings.has(inningOnScreen)
    ? { filled: sportPack.fieldPositions.length - (phoneOpenRoles?.length ?? 0), total: sportPack.fieldPositions.length, open: !!phoneOpenRoles }
    : null;
  const phoneClash = analysis.conflictInnings.has(inningOnScreen)
    ? (() => {
        // One clash reads itself ("2 share C"); more than one is a count — the pill has 254px.
        const clashes = analysis.conflicts.filter(c => c.inning === inningOnScreen);
        return clashes.length === 1 ? `${clashes[0].count} share ${clashes[0].position}` : `${clashes.length} clashes`;
      })()
    : null;
  // A removed or re-fetched row simply stops matching and the position sheet closes itself.
  const positionRow = positionFor === null ? null : (rows.find(r => r.player.id === positionFor) ?? null);

  // The two per-game overrides, written ONCE and placed by width (D12 · B): on a phone they sit
  // together behind one 44px disclosure; on the desktop Innings to fill stays a visible row and
  // Game rules keeps its own inline disclosure, exactly as before.
  const inningsToFillField = (
    <label className={styles.lineupControlLabel}>
      <span>Innings to fill</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <select className={styles.select} aria-label="First inning to fill" value={rangeFrom}
          onChange={e => { const v = Number(e.target.value); setFillFrom(v); if (fillTo !== null && v > rangeTo) setFillTo(v); }}>
          {Array.from({ length: inningCount }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span style={{ color: 'var(--home-dim, rgba(255,255,255,0.5))', fontSize: 12 }}>to</span>
        <select className={styles.select} aria-label="Last inning to fill" value={rangeTo}
          onChange={e => setFillTo(Number(e.target.value))}>
          {Array.from({ length: inningCount }, (_, i) => i + 1).filter(n => n >= rangeFrom).map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </span>
    </label>
  );
  // ⚠ STILL GATED ON `gameRulesOpen`. Before this JSX was hoisted out of the panel to be written
  // once, the gate was the `{gameRulesOpen && ...}` around it; hoisting quietly moved the gate to
  // the CALL SITES and left the fields rebuilding on every render of the editor — including while
  // the drawer is shut, since nothing resets the fold on close. Cheap either way, but a hoist that
  // drops a guard is the kind of thing that stops being cheap in a bigger component.
  const gameRulesFields = gameRulesOpen && gameRules && onGameRulesChange ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {([
        { key: 'maxPos', label: 'Max innings / position', def: seasonCaps?.maxInningsPerPosition ?? null, min: 1 },
        { key: 'pitcher', label: 'Max innings pitched', def: seasonCaps?.pitcherMaxInningsDefault ?? null, min: 1 },
        { key: 'minPlay', label: 'Min innings / player', def: seasonCaps?.minInningsPerPlayer ?? null, min: 1 },
      ] as const).map(f => (
        <label key={f.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--home-ink-soft, rgba(255,255,255,0.7))' }}>
          <span>{f.label}</span>
          <input type="number" min={f.min} max={12} className={styles.input} style={{ width: 128 }}
            placeholder={f.def != null ? `Season default (${f.def})` : 'Off'}
            value={gameRules[f.key]}
            onChange={e => onGameRulesChange({ ...gameRules, [f.key]: e.target.value })} />
        </label>
      ))}
      <p className={styles.lineupAutoNote} style={{ margin: 0 }}>Overrides just this game. Blank = your season default.</p>
    </div>
  ) : null;

  /* THE AUTO-FILL PANEL — the SETUP panel (D1, now shared by both breakpoints): Format and Innings
     labelled side by side at its top, Mode, the Competitive extras, Fill, Innings to fill, Game
     rules, the note, Generate, and Reshuffle under Generate. A popover on the desktop, fixed above
     the bar at ≤640 with its own scroll (`lineupAutoMenu`). Written once, mounted by the one Setup
     & Auto-fill trigger every width renders. */
  const autoFillPanel = (
    <div id={SETUP_PANEL_ID} className={`${styles.lineupAutoMenu} ${styles.lineupSetupDrawer} ${styles.lineupDrawerOverNav}`} role="dialog" aria-label="Lineup setup">
      {/* ⚰ "Close is a DESKTOP-only affordance" STOPPED BEING RIGHT ON 2026-09-23, when this
          drawer started covering the bottom nav. The old reasoning — "the phone drawer already has
          the scrim, Escape, and Generate/Reshuffle to leave by" — rested on a bar that was still
          tappable underneath; it is not any more. `desktopClose` because this panel is a centered
          MODAL at ≥901 (Templates, sharing this head, is still a popover there and asks for none);
          the ≤900 × is width-only and the stylesheet decides it. */}
      <LineupDrawerHead title="Lineup setup" onClose={closePanelToRow} desktopClose />
      {setupFields}
      <span className={`${styles.lineupSetupLabel} ${styles.lineupPanelSection}`}>Auto-fill</span>
      <label className={styles.lineupControlLabel}>
        <span>Mode</span>
        <SublinedChoice
          id="lineup-auto-mode"
          label="Mode"
          variant="toolbar"
          options={AUTO_POLICY_OPTIONS}
          value={autoPolicy}
          onChange={setAutoPolicy}
        />
      </label>
      {autoPolicy === 'competitive' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8, borderTop: '1px solid var(--home-line, rgba(255,255,255,0.08))' }}>
          <label className={styles.lineupControlLabel}>
            <span>A-squad</span>
            <SublinedChoice
              id="lineup-asquad-emphasis"
              label="A-squad"
              variant="toolbar"
              options={A_SQUAD_OPTIONS}
              value={aSquadEmphasis}
              onChange={setASquadEmphasis}
            />
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--home-ink-soft, rgba(255,255,255,0.7))', cursor: 'pointer' }}>
            <input type="checkbox" checked={noBackToBackSits} onChange={e => setNoBackToBackSits(e.target.checked)} />
            <span>Nobody sits two innings in a row</span>
          </label>
        </div>
      )}
      <label className={styles.lineupControlLabel}>
        <span>Fill</span>
        <select className={styles.select} value={autoFillMode} onChange={e => setAutoFillMode(e.target.value as FillMode)}>
          <option value="empty">Fill empty spots only</option>
          <option value="regenerate">Regenerate all</option>
        </select>
      </label>
      {isPhone ? (
        /* ONE disclosure for the two per-game overrides (D12 · B). Both default to something the
           coach almost never changes — the whole game, and the season's own caps — so on a phone
           they were ~140px of a surface that did not fit. Folded, they are one 44px row, which
           also retires the bare 16px "Game rules ▾" the layout sweep had on its known-debt list. */
        <>
          <button type="button" className={`${styles.lineupSheetRow} ${styles.lineupSheetMore}`} aria-expanded={gameRulesOpen} aria-controls={SETUP_MORE_ID}
            onClick={() => setGameRulesOpen(v => !v)}>
            {gameRules && onGameRulesChange ? 'Innings to fill · Game rules' : 'Innings to fill'} {gameRulesOpen ? '▴' : '▾'}
          </button>
          {gameRulesOpen && (
            <div id={SETUP_MORE_ID} className={styles.lineupSheetMoreBody}>
              {inningsToFillField}
              {gameRulesFields}
            </div>
          )}
        </>
      ) : (
        <>
          {inningsToFillField}
          {gameRules && onGameRulesChange && (
            <div>
              <button type="button" onClick={() => setGameRulesOpen(v => !v)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, color: 'var(--home-ink-soft, rgba(255,255,255,0.6))' }}>
                Game rules {gameRulesOpen ? '▴' : '▾'}
              </button>
              {gameRulesOpen && <div style={{ marginTop: 6 }}>{gameRulesFields}</div>}
            </div>
          )}
        </>
      )}
      <p className={styles.lineupAutoNote}>Auto-fill spreads bench time evenly across the roster — a starting point, tweak after.</p>
      {/* THE ACTIONS NEVER SCROLL AWAY (D12 · B, revised on the owner's read 2026-09-22 — "looks
          like it is still behind the nav"). Below ~640px of viewport the settings no longer fit,
          and what was being clipped at the drawer's foot was Reshuffle — the actions, which is the
          one thing a surface must never lose. Trimming further only moves the failure to a shorter
          phone; pinning the foot ends it at every height. The settings above scroll under this. */}
      <div className={styles.lineupSheetFoot}>
        <button type="button" className={styles.btnSecondary} onClick={handleAutoFill}>Generate lineup</button>
        {/* Reshuffle as a QUIET row under Generate, never a second full-width button competing with
            the one action this surface exists for. It keeps the 44px floor. */}
        <button {...reshuffleProps} className={`${styles.lineupSheetRow} ${styles.lineupSheetQuiet}`}>
          <Shuffle size={14} aria-hidden="true" /> Reshuffle
        </button>
      </div>
    </div>
  );

  /* The strip's FACE — the mark, the state word and the sentence. One definition for both the door
     and the doorless readings below, which carried it twice.
     ⚠ `lineupReadinessText` is a LAYOUT-ONLY wrapper and it must stay invisible to the desktop row:
     its CSS is `display: contents` above 640, so the state and the sentence remain direct children
     of the flex row exactly as they were, and only the phone block makes it a real column (title
     over caption). Wrapping them in the markup is what lets the phone stack them without reaching
     for :nth-child — the mark comes from another CSS module and cannot be named from here. */
  const stripFace = (<>
    {stripMark && <LineupStateMark state={stripMark.state} label={stripMark.label} />}
    <span className={styles.lineupReadinessText}>
      <span className={styles.lineupReadinessState}>{strip.label}</span>
      <span className={styles.lineupReadinessDetail}>{strip.detail}.</span>
    </span>
  </>);

  return (
    <div className={styles.lineupSection}>
      {/* Two views of one lineup (D8, owner 2026-09-18): build it on Lineup — order, positions,
          who is in — and read it on Playing time. Chunk C had split this into three because a
          phone could not drag inside the sideways-scrolling grid and reordering needed a list of
          its own; the grid's number is that handle now (hold to drag, tap for row actions), so the
          third view had nothing left to do. A segmented control, not a tab bar: these are two
          views of ONE thing, the portal's word for which is `segChoice` (Roster's List ⇄ Depth
          chart, Home/Away). */}
      <div className={`${styles.segChoice} ${styles.lineupViews}`} role="tablist" aria-label="Lineup views">
        <button type="button" role="tab" aria-selected={view === 'lineup'} className={`${styles.segBtn} ${view === 'lineup' ? styles.segBtnActive : ''}`} onClick={() => setView('lineup')}>Lineup</button>
        <button type="button" role="tab" aria-selected={view === 'summary'} className={`${styles.segBtn} ${view === 'summary' ? styles.segBtnActive : ''}`} disabled={rows.length === 0} onClick={() => setView('summary')}>Playing time</button>
      </div>

      {view === 'lineup' && (<>
        {/* THE STATUS STRIP — the one thing between the views and Setup (owner, 2026-09-18: "7
            rows above the lineup on the main page is not a good user experience"). The state,
            its mark, one sentence naming what is waiting — and, while anything is, the whole strip
            is the DOOR into the Lineup check. The attendance strip and the per-inning cards that
            used to stack here are that check's rows now. */}
        <div ref={stripRef} tabIndex={-1} className={styles.lineupReadiness} data-state={badge}>
          {checkHasRows ? (
            <button type="button" className={styles.lineupReadinessDoor} onClick={() => setLens({ view: 'check' })} aria-haspopup="dialog">
              {stripFace}
              <span className={styles.lineupReadinessGo}>
                <span className={styles.lineupReadinessGoWord}>Review</span>
                <ChevronRight size={15} aria-hidden />
              </span>
            </button>
          ) : (
            <div className={styles.lineupReadinessDoor}>{stripFace}</div>
          )}
          {/* Mark ready sits BESIDE the door, never inside it, and is offered whenever nothing is
              WRONG (D11): open innings never block — an attendance mismatch warns, it never blocks.
              A clash or an empty grid hides it.
              ⚠ THE COUNT ON THE BUTTON IS A DESKTOP FACT (owner, 2026-09-22). D11 put it there so a
              coach could not press Mark ready without reading what is still open — and on the
              desktop strip that reason is load-bearing, because the button sits an inch from the
              sentence. On a phone the two TOUCH: the sentence is the caption directly left of this
              pill, so adjacency serves D11's reason and the count would simply print the same fact
              twice, 40px apart. Phone gets the pill's short label; the caption carries the number. */}
          {readyState && canMarkLineupReady(analysis) && readyState.status === 'draft' && (
            <button type="button" className={`${styles.btnPrimary} ${styles.lineupReadinessMark}`} disabled={readyState.marking} onClick={readyState.onMarkReady}>
              {isPhone
                ? (readyState.marking ? 'Marking…' : 'Mark ready')
                : readyState.marking
                  ? 'Marking ready…'
                  : openInnings.length
                    ? `Mark ready · ${openInnings.length} ${periodLc}${openInnings.length === 1 ? '' : 's'} open`
                    : 'Mark lineup ready'}
            </button>
          )}
          {readyState?.error && <p className={styles.errorText}>{readyState.error}</p>}
        </div>
        <div className={styles.lineupControls}>
          {/* THE SETUP ROW (stage 3 · D1, owner ruling 2026-09-21 — B, the panel; unified across
             both breakpoints 2026-09-23 — the desktop toolbar used to spell out Format, Innings,
             Auto-fill and Reshuffle as four separate controls, which buried the one control this
             screen actually exists for. One 52px row reads its state — the lineup's shape as the
             title, the auto-fill setting as the caption — and opens the builder's own panel (the
             surface Auto-fill, Templates, Print and the D8 row sheet already use) holding
             Format · Innings, today's auto-fill choices, Generate and Reshuffle. The grid never
             moves. A template changes the title, never the caption — nothing stores which
             template a lineup came from.

             ⚠⚰ THE LIME ROW IS GONE (owner, 2026-09-22: "why are we highlighting this dropdown in
             green? that seems inconsistent from elsewhere in the app"). It was right: lime in this
             portal is a BUTTON or a CHIP — every primary action, the game-day Live chip, an "on"
             toggle — and this was the only surface in the portal filled lime edge to edge with a
             title, a caption and a chevron inside it. It read as an enormous button and it fought
             the Mark ready pill 8px above it. Worse, the tone was frozen at open (a `setupFolded`
             lazy useState, now deleted) so it never went quiet: generate a lineup and the row
             stayed lime for the rest of the session, shouting about a job already done.

             WHAT REPLACES IT — one rule, shared with the status row above: A LIME PILL IS THE ONE
             THING YOU CAN DO RIGHT NOW; NO PILL MEANS THERE IS NOTHING TO DO HERE. So while the
             game has no lineup the row carries an Auto-fill pill, which is both the row's LABEL
             (nothing on the closed row said it generates a lineup — "Auto-fill · Balanced" reads
             as a setting being reported) and a one-tap generate. Once a lineup exists the pill is
             gone and the row is only the door.

             ⚠ The pill is a SIBLING of the row, never nested inside it — `lineupSetupRowWrap`
             carries the border and the 52px floor, the row button is transparent inside it. Same
             shape as `lineupReadiness` + its door, which is the point: two rows, one recipe.
             ⚠ `hasAssignments` is read LIVE here, unlike the tone it replaces. That is safe
             because the pill disappears in response to the coach's own tap on it, and coming back
             after Clear is correct — there is no lineup again, so Auto-fill is the next move. */}
          <div className={styles.lineupAutoWrap} ref={autoFillRef}>
            {/* The eyebrow (owner, 2026-09-23: "can we label this button so users know its for
                setting parameters and automating selections?"): on the desktop/tablet row the
                trigger only ever showed its CURRENT values, which reads as a status line rather
                than a control — this names what it's FOR before it's opened. Phone-hidden: the
                row already carries a border, a chevron and the 44px floor a tap target needs,
                the same "obviously interactive" cues the status strip's door uses above it, so a
                label would only repeat what the shape already says on a screen with less room to
                say it. */}
            <span className={`${styles.lineupSetupLabel} ${styles.lineupSetupTriggerLabel}`}>Setup</span>
            <div className={styles.lineupSetupRowWrap}>
              <button ref={setupRowRef} type="button" className={styles.lineupSetupRow} aria-expanded={autoFillOpen} aria-controls={SETUP_PANEL_ID}
                onClick={() => setAutoFillOpen(v => !v)}>
                <span className={styles.lineupSetupRowText}>
                  <strong>{lineupMode === 'nine_player' ? '9 player ball' : 'Everyone bats'} · {inningCount} {sportPack.periodLabelPlural.toLowerCase()}</strong>
                  <small>Auto-fill · {autoFillLabel}</small>
                </span>
                <ChevronDown size={18} aria-hidden className={styles.lineupSetupRowChev} />
              </button>
              {!analysis.hasAssignments && (
                <button type="button" className={`${styles.btnPrimary} ${styles.lineupSetupGo}`} disabled={rows.length === 0}
                  onClick={handleAutoFill}>Auto-fill</button>
              )}
            </div>
            {autoFillOpen && (<>
              {/* The scrim (D12): a tap anywhere off the drawer closes it, and the page behind dims so the
                   surface reads as owning the screen. Renders only where the bottom nav does — the class is
                   display:none above 900, so no width branch is needed here. */}
              {/* `overNav` — this drawer is a FORM (owner ruling 2026-09-23), so it covers the
                  bottom nav and the scrim dims the bar with it. See `.lineupDrawerOverNav`. */}
              <LineupSheetScrim onClose={closePanelToRow} overNav />
              {/* The true DESKTOP's own dim (owner, 2026-09-23: "should we open a modal for this
                  given its size?"). Above, at 641–900, the scrim just above already covers this —
                  the panel is already the same fixed, bar-anchored drawer a phone gets. Only ≥901
                  lacked one: an anchored popover with no idea where the viewport ends, which is
                  exactly what ran off the bottom of a shorter window. Reuses this app's own
                  confirm-dialog backdrop (`.modal-overlay` in globals.css) rather than teaching
                  the phone/tablet scrim a desktop mode the other three panels sharing it don't
                  need — a SIBLING overlay, not a widened one. */}
              <div className={styles.lineupSetupModalOverlay} aria-hidden="true" onClick={closePanelToRow} />
              {autoFillPanel}
            </>)}
          </div>
          {/* The host's tools (Undo · Redo · Print · Templates), the editor's own Clear, and Call-up
              are ONE row of squares, pushed to the row's right edge in the desktop/tablet layout
              (owner, 2026-09-23) so the left reads as "what you're building" and the right as
              "history and output" — the same row on a phone just wraps beneath instead.
              ⚠ Call-up joined this row 2026-09-23, second: sitting alone between Setup and the tool
              squares it was a third, in-between height in the row (taller than a square, shorter
              than Setup's two-line trigger) — a visual "why is this one a different size" the owner
              flagged from a live screenshot. As a peer of Undo/Redo it just reads as one more tool. */}
          <div className={styles.lineupToolRow}>
            {callUps && (
              <div className={styles.lineupCallUpWrap} ref={callUpRef}>
                <button
                  type="button"
                  className={styles.lineupCallUpBtn}
                  aria-haspopup="dialog"
                  aria-expanded={callUps.sheetOpen}
                  /* House rule 3: the words go on a phone and the aria-label carries them — same
                     recipe as the roster's "+ Add Player" (`headerBtnLabel`), so this reads as one
                     more icon square beside Undo/Redo there, not a lone survivor of a banner. */
                  aria-label="Call up a player"
                  onClick={callUps.onCallUp}
                >
                  {/* UserPlus, not a bare Plus (owner, 2026-09-23): among five other tool icons a
                      plain "+" reads as "add a row," which "Not in the lineup" already does below.
                      A person-with-a-plus names the actual action — bringing someone from OUTSIDE
                      the roster in — without needing the label a phone hides. */}
                  <UserPlus size={16} aria-hidden />
                  <span className={styles.headerBtnLabel}>Call up a player</span>
                </button>
                {callUps.sheetOpen && (<>
                  {/* A FORM (a first name, a last name, a number, a phone), so it covers the nav
                      — the 2026-09-23 ruling at `.lineupDrawerOverNav`. Its own × is the way out. */}
                  <LineupSheetScrim onClose={callUps.onCloseSheet} overNav />
                  <div className={`${styles.lineupAutoMenu} ${styles.lineupDrawerOverNav}`} role="dialog" aria-label="Call up a player">
                    {callUps.sheet}
                  </div>
                </>)}
              </div>
            )}
            {controlsExtra}{clearButton}
          </div>
        </div>

        {notice && <p className={styles.lineupNotice}>{notice}</p>}

        {rows.length === 0 ? (
          <div className={styles.attendanceEmpty}>
            {roster.length === 0 ? 'Add active players to the roster first.' : `No players in the lineup yet — add players from the ${notInHeading.toLowerCase()} below.`}
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            {isPhone ? (<>
              {/* ONE INNING AT A TIME (stage 3 · D5): the grid's rows as a list for the inning on
                  screen — the same SortableContext, the same D8 sensors, the same setPosition. */}
              <LineupInningList
                rows={rows} inning={inningOnScreen} inningCount={inningCount}
                periodLabel={period} orderLabel={sportPack.orderLabel}
                coverage={phoneCoverage} clash={phoneClash} dots={phoneDots}
                onStep={setPhoneInning}
                onOpenInning={() => setLens({ view: 'inning', inning: inningOnScreen, fromCheck: false })}
                onRowActions={setRowActionsFor}
                onPickPosition={setPositionFor}
                cellIssueFor={cellIssueFor}
              />
              {/* ⚰ The phone's "Hold a number to move a player · ‹ › for the innings" hint was
                  REMOVED on 2026-09-22 (owner: "we don't need this message"). Both halves of it had
                  become self-evident on this screen: the stepper above the list is a labelled
                  "Inning 1 of 6" with two arrows, and every row's number carries a visible grip.
                  It cost a line of the page's most contested space to narrate controls that are
                  already legible. The desktop grid keeps its own hint, which says something the
                  phone's does not — that the grid scrolls sideways. */}
            </>) : (<>
            <p className={styles.lineupScrollHint}>Hold a number to move a player · swipe across innings →</p>
            <div className={styles.lineupTableWrap}>
              {/* The pinned lead columns' widths live entirely in CSS (see `.lineupTable` in
                  coaches.module.css). This only names the MODE, because the Start column exists
                  in nine-player ball and not otherwise. Previously the player column's sticky
                  offset was passed in here as a hard-coded rem value computed from the Bat
                  column's width — so narrowing that column left the player cell parked at the old
                  offset, overlapping two innings. One owner for the widths, no arithmetic here. */}
              <table className={styles.lineupTable} data-mode={lineupMode}>
                <thead>
                  <tr>
                    <th>Bat</th>
                    {lineupMode === 'nine_player' && <th className={styles.lineupColStart}>Start</th>}
                    <th className={styles.lineupColPlayer}>Player</th>
                    {Array.from({ length: inningCount }, (_, i) => {
                      const inning = i + 1;
                      const clash = analysis.conflictInnings.has(inning);
                      const openRoles = openRolesByInning.get(inning);
                      const filled = sportPack.fieldPositions.length - (openRoles?.length ?? 0);
                      const headTitle = clash ? 'Two players share a position this inning' : openRoles ? `${openRoles.join(', ')} open` : undefined;
                      // The heading is the DOOR into the inning inspector (Phase 4, F12); the <th>
                      // keeps its anchor and ink so the coverage checks' scroll target is unchanged.
                      return (
                        <th key={inning} className={styles.lineupColInning} data-lineup-inning={inning} style={clash ? { color: 'var(--danger)' } : undefined}>
                          <InningHeadingDoor
                            inning={inning} periodLabel={sportPack.periodLabel} clash={clash} title={headTitle}
                            onOpen={() => setLens({ view: 'inning', inning, fromCheck: false })}
                            coverage={assignedInnings.has(inning) && <small className={openRoles ? styles.lineupCoverageOpen : styles.lineupCoverageComplete}>{filled}/{sportPack.fieldPositions.length}</small>}
                          />
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  <SortableContext items={rows.map(r => r.player.id)} strategy={verticalListSortingStrategy}>
                    {rows.map(row => (
                      <SortableLineupRow key={row.player.id} row={row} battingNumber={row.battingOrder} mode={lineupMode} inningCount={inningCount}
                        onStarterToggle={toggleStarter} onPositionChange={setPosition} onRemove={removePlayer} onRowActions={setRowActionsFor}
                        orderLabel={sportPack.orderLabel} cellIssueFor={cellIssueFor} />
                    ))}
                  </SortableContext>
                </tbody>
              </table>
            </div>
            </>)}
          </DndContext>
        )}

        {/* The row-actions sheet (D8): opened by a TAP on a row's number at touch widths. It wears
            the toolbar popovers' phone recipe (`lineupAutoMenu` — a panel anchored above the nav),
            so it is the same surface Auto-fill, Templates and Print already open there. Move up /
            Move down are the non-drag path — the ↑ ↓ the order view used to carry, one tap away
            instead of one tab away — so nobody is stranded if press-and-hold feels wrong on a
            given phone. */}
        {sheetRow && (
          /* ⚠⚠ THE SCRIM MUST LIVE INSIDE THE ELEMENT `useDismissable` WATCHES (/review, 2026-09-22).
             It was a SIBLING of the ref'd sheet here, where the builder's other three drawers put it
             INSIDE their ref'd wrapper — and that asymmetry was a real, reproducible defect on the
             one input this feature exists for. Outside the boundary, a tap on the scrim reads as
             "outside": `useDismissable`'s document-level POINTERDOWN fires first and unmounts the
             sheet, and the CLICK that follows lands on whatever the dismissal just revealed at that
             screen position. Reproduced under touch emulation: dismissing this menu pressed
             **Mark ready** underneath it and marked the lineup ready. A mouse never showed it.
             Inside the boundary, `useDismissable` treats the tap as inside and never fires; the
             scrim's own onClick is the single close path. ⚠ This wrapper is not decoration — if it
             is ever flattened, the defect comes back silently. */
          <div ref={rowSheetRef}>
          <LineupSheetScrim onClose={() => setRowActionsFor(null)} />
          <div className={`${styles.lineupAutoMenu} ${styles.lineupRowSheet}`} role="dialog" aria-label={`Options for ${playerDisplayName(sheetRow.player)}`}>
            <p className={styles.lineupRowSheetHead}>
              <strong>{playerDisplayName(sheetRow.player)}</strong>
              <span>{sheetRow.battingOrder ? `${sportPack.orderLabel} · ${sheetRow.battingOrder} of ${rows.filter(r => r.starter).length}` : 'Bench'}</span>
            </p>
            <button type="button" className={styles.lineupRowSheetItem} disabled={sheetIndex === 0} onClick={() => moveRowByPlayer(sheetRow.player.id, -1)}><ChevronUp size={18} aria-hidden="true" /> Move up</button>
            <button type="button" className={styles.lineupRowSheetItem} disabled={sheetIndex === rows.length - 1} onClick={() => moveRowByPlayer(sheetRow.player.id, 1)}><ChevronDown size={18} aria-hidden="true" /> Move down</button>
            <button type="button" className={`${styles.lineupRowSheetItem} ${styles.lineupRowSheetDanger}`} onClick={() => { removePlayer(sheetRow.player.id); setRowActionsFor(null); }}><X size={18} aria-hidden="true" /> Remove from lineup</button>
            <button type="button" className={styles.lineupRowSheetCancel} onClick={() => setRowActionsFor(null)}>Cancel</button>
          </div>
          </div>
        )}

        {/* The position sheet (D5): a tap on a row's position pill on a phone. The pick is the same
            `setPosition` cell edit the grid's select makes — one undo step — and closes the sheet;
            the floor returns focus to the pill. A Never pick is allowed and named, never confirmed. */}
        {isPhone && positionRow && (
          <LineupPositionSheet
            row={positionRow} inning={inningOnScreen} inningCount={inningCount} periodLabel={period}
            sportPack={sportPack} pitcherCap={pitcherCapFor(positionRow)}
            onPick={code => { setPosition(positionRow.player.id, inningOnScreen, code); setPositionFor(null); }}
            onClose={() => setPositionFor(null)}
          />
        )}

        <LineupCheck
          open={lens?.view === 'check' && !checkIsEmpty}
          onClose={() => setLens(null)}
          state={stripMark?.state ?? 'warn'}
          stateLabel={stripMark?.label}
          subtitle={checkSubtitle}
          periodLabel={period}
          attendance={attendance && { coming: comingNames, out: outNames, onAddComing: attendance.onAddComing, onRemoveOut: attendance.onRemoveOut }}
          innings={checkInnings}
          untouched={untouched}
          patternNote={patternNote}
          benchSpread={unevenBench}
          onOpenInning={focusInning}
          onOpenPlayingTime={() => { setLens(null); setView('summary'); }}
        />
        <LineupInningInspector
          inning={rows.length && lens?.view === 'inning' ? lens.inning : null}
          inningCount={inningCount}
          onClose={() => setLens(null)}
          onBack={lens?.view === 'inning' && lens.fromCheck ? () => setLens(checkIsEmpty ? null : { view: 'check' }) : undefined}
          onNavigate={inning => { setPhoneInning(inning); setLens(l => ({ view: 'inning', inning, fromCheck: l?.view === 'inning' && l.fromCheck })); }}
          rows={rows}
          sportPack={sportPack}
          pitcherCapFor={pitcherCapFor}
          onApply={applyInningChanges}
        />

        {/* The notes, directly under the order — the shape they print in (owner, 2026-09-22). They
            sat below everything on screen while printing immediately under the grid, so the screen
            and the paper disagreed about what belonged with what. */}
        {notesSlot}

        {/* ── Who is available ──────────────────────────────────────────────────────────────────
            ⚠ **ONE PANEL, NOT TWO** (owner, 2026-09-22: *"I don't like the way these are aligned
            under the main lineup table, lots of empty space"*). Call-ups first shipped in a second
            dashed box of their own, which stacked two mostly-empty panels under the grid and made
            the builder's foot look like an afterthought. The two belong together — both answer
            "who can I still put in?" — so they share one frame, and each group keeps its own
            heading and count so a coach never has to work out whether a name is one of their own.

            The *Call up a player* door itself moved into the toolbar (2026-09-23) — it no longer
            needs this panel to stay mounted just to stay reachable, so this now renders only when
            there is actually a roster or call-up name to show. */}
        {(notInLineup.length > 0 || callUpsNotInLineup.length > 0) && (
          <div className={styles.lineupNotPlaying}>
            {/* ⚠⚠ **THE PILL IS THE ACTION — there is no "Add to lineup" button any more** (owner
                ruling 2026-09-22, choosing this over widening the rows to fill the screen).
                That button was repeated on every entry and said the same thing every time, while
                the heading directly above it had already said these players are not in the lineup
                and adding them is the only thing the list can do. So the button was the furniture
                and the name was the content: folding the two together roughly halves each entry and
                fits two or three names on a phone line instead of one. The pattern is the money
                hub's item pills (`+ Registration revenue ×`), which is where the owner took it
                from — deliberately NOT a shared component yet, because two call sites with
                different actions do not earn one and the budget group would have to be refactored
                into it to be worth anything. */}
            {/* ⚠ ONE `.map` over BOTH groups. They were written out twice — same heading, same list,
                same pill, same `+` — differing only in two class names, a suffix on the accessible
                name, and one trailing ×. ~20 lines of copy to add a single button is how two
                headings drift apart visually; a shape per group is how they cannot. */}
            {[
              { key: 'roster', heading: notInHeading, items: notInLineup, callUp: false },
              { key: 'borrowed', heading: 'Call-ups', items: callUps ? callUpsNotInLineup : [], callUp: true },
            ].filter(g => g.items.length > 0).map(group => (
              <div key={group.key}>
                <p className={`${styles.lineupNotPlayingHead}${group.callUp ? ` ${styles.lineupCallUpHead}` : ''}`}>
                  {group.heading} · {group.items.length}
                </p>
                <div className={styles.lineupNotPlayingList}>
                  {group.items.map(p => (
                    <span key={p.id} className={`${styles.lineupNotPlayingRow}${group.callUp ? ` ${styles.lineupCallUpRow}` : ''}`}>
                      <button
                        type="button"
                        className={styles.lineupAddPill}
                        onClick={() => addPlayer(p.id)}
                        aria-label={`${addLabel}: ${playerDisplayName(p)}${group.callUp ? ` (${CALL_UP_LABEL})` : ''}`}
                      >
                        {/* The verb lives in the accessible name — a screen reader hears "Add to
                            lineup: #11 Kai Test", never a bare plus sign. */}
                        <span className={styles.lineupAddPillPlus} aria-hidden>+</span>
                        <span className={styles.lineupNotPlayingName}>{playerDisplayName(p)}</span>
                      </button>
                      {/* ⚠ The heavier of the two, and it keeps a full tap target rather than being
                          a glyph at the pill's edge: this does not merely leave them out of the
                          batting order, it takes them off the GAME and clears the lineup row they
                          hold. It stays on the pill because that is where a coach looks for it. */}
                      {group.callUp && callUps && (
                        <button
                          type="button"
                          className={styles.lineupCallUpDrop}
                          onClick={() => callUps.onRemoveCallUp(p.id)}
                          aria-label={`Take ${playerDisplayName(p)} off this game`}
                          title="Take off this game"
                        >&times;</button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </>)}

      {view === 'summary' && rows.length > 0 && (
        <div className={styles.lineupSummary}>
          <div className={styles.lineupSummaryBody}>
            <div className={styles.lineupFairness}>
              Bench: {benchMin === benchMax ? `${benchMin}` : `${benchMin}–${benchMax}`} {benchMax === 1 ? 'inning' : 'innings'} each
              <span className={`${styles.lineupFairPill} ${benchMax - benchMin > 1 ? styles.lineupFairPillWarn : ''}`}>{benchMax - benchMin > 1 ? 'Leans on a few' : 'Evenly spread'}</span>
            </div>
            <div className={styles.lineupSummaryDesktop}>
              <div className={styles.lineupSummaryWrap}>
                <table className={styles.lineupSummaryTable}>
                  <thead><tr><th>Player</th><th>Field</th><th>Bench</th>{sportPack.pitcherPosition && <th>Pitching</th>}{summaryPositions.filter(pos => pos !== sportPack.pitcherPosition).map(pos => <th key={pos}>{pos}</th>)}{hasPlayerAttention && <th>Attention</th>}</tr></thead>
                  <tbody>
                    {rows.map(row => {
                      const fp = fairPlayByPlayer.get(row.player.id);
                      const pitching = sportPack.pitcherPosition ? (fp?.positionCounts[sportPack.pitcherPosition] ?? 0) : 0;
                      const pitcherCap = pitcherCapFor(row);
                      const attention = [
                        fp?.consecutiveBench ? 'Consecutive bench' : '',
                        fp?.unassigned ? `${fp.unassigned} open` : '',
                      ].filter(Boolean).join(' · ');
                      return (
                        <tr key={row.player.id}>
                          <td className={styles.lineupSummaryName}>{playerDisplayName(row.player)}</td>
                          <td className={styles.lineupCountCell}>{fp?.onField ?? 0}/{inningCount}</td>
                          <td className={styles.lineupCountCell}>{fp?.benched ?? 0}</td>
                          {/* ⚠ THREE STATES, AND ONLY ONE OF THEM IS A DASH (owner ruling 2026-09-22). A pitcher
                              with no cap reads `0/∞`, NEVER `0/—`: the bare `—` already means "not on the
                              pitching chart" one row up, and one glyph cannot carry both. The non-pitcher dash
                              is `.lineupZero` — it stands for "nothing here", so it takes the quiet tier like
                              every other such mark in this table, rather than the cell's full-strength ink.
                              ⚠ `∞` alone is read out as "infinity", which tells a screen-reader user nothing
                              about arm care — so the glyph is hidden and the cell carries the words the REST of
                              the portal already uses ("2 of 4 used" / "no cap" — the lineup check, the position
                              sheet and the player profile all say it that way).
                              ⚠ `aria-label` on the <td> was tried first and is WRONG here: a table cell's name
                              is not what a screen reader reads when a coach arrows through the grid — it reads
                              the CONTENT — so the gloss would have been silently dropped by the readers most
                              likely to meet it. `.srOnly` inside the cell is this repo's proven idiom for it
                              (the money panel's "— not planned", the Sessions and Metrics table headings).
                              ⚠⚠ `.lineupPitchingCell` carries `position: relative` FOR this span and must keep
                              it: `.srOnly` is absolutely positioned, and with no positioned ancestor its
                              containing block becomes the viewport — a 1px span parked outside this table's
                              horizontal scroller, dragging the page sideways. Same trap, same fix, as
                              `.lineupReadinessGo`. */}
                          {sportPack.pitcherPosition && (
                            <td className={styles.lineupPitchingCell}>
                              {row.player.lineupProfile?.pitcher ? (<>
                                <span aria-hidden="true">{pitching}/{pitcherCap ?? '∞'}</span>
                                <span className={styles.srOnly}>{pitcherCap == null ? `${pitching} pitched, no cap` : `${pitching} of ${pitcherCap} used`}</span>
                              </>) : <span className={styles.lineupZero}>—</span>}
                            </td>
                          )}
                          {/* ⚰ The zero `·` went with the same ruling. It rendered at `--white-25` — the ONE rung
                              of the alpha ladder the warm gate never remaps — so it had always painted white on
                              a white card and no coach has ever seen it. The olive heat tint is what says "this
                              player plays here"; ~30 invisible dots were carrying nothing. Left blank on purpose:
                              do not "restore" them. */}
                          {summaryPositions.filter(pos => pos !== sportPack.pitcherPosition).map(pos => { const n = fp?.positionCounts[pos] ?? 0; return <td key={pos} className={styles.lineupHeatCell} style={heatStyle(n)}>{n || ''}</td>; })}
                          {/* ⚠ `.lineupZero` goes on the GLYPH, never on the <td> (review finding, 2026-09-22).
                              It now dims by `opacity`, and opacity composites the WHOLE element as one group —
                              on a <td> that takes the cell's `background` and its `border-bottom` down with the
                              dash, washing out the row's hairline under this one column on the light skin. On a
                              <span> it reaches only the mark. Its two siblings in this table were already spans;
                              this was the odd one out. (It also makes `color: inherit` actually govern: against
                              a <td>, `.lineupSummaryTable td` is the more specific selector and silently won.) */}
                          {hasPlayerAttention && <td className={attention ? styles.lineupAttentionCell : undefined}>{attention || <span className={styles.lineupZero}>—</span>}</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className={styles.lineupSummaryMobile}>
              {rows.map(row => {
                const fp = fairPlayByPlayer.get(row.player.id);
                const played = summaryPositions.filter(pos => pos !== sportPack.pitcherPosition && (fp?.positionCounts[pos] ?? 0) > 0);
                return (
                  <div key={row.player.id} className={styles.lineupChipRow}>
                    <span className={styles.lineupChipName}>{playerDisplayName(row.player)}</span>
                    {onFieldGauge(fp)}
                    <span className={styles.lineupChips}>
                      {/* Same grammar as the desktop cell above — `∞` for no cap, never `—`. A phone is
                          where a coach actually reads this, so a second spelling here would be the worst
                          place to have one. */}
                      {sportPack.pitcherPosition && row.player.lineupProfile?.pitcher && (() => {
                        const cap = pitcherCapFor(row);
                        const pitched = fp?.positionCounts[sportPack.pitcherPosition!] ?? 0;
                        return (
                          <span className={styles.lineupChip}>
                            <span aria-hidden="true">P {pitched}/{cap ?? '∞'}</span>
                            <span className={styles.srOnly}>{cap == null ? `${pitched} pitched, no cap` : `${pitched} of ${cap} used`}</span>
                          </span>
                        );
                      })()}
                      {played.map(pos => <span key={pos} className={styles.lineupChip} style={heatStyle(fp!.positionCounts[pos])}>{pos}×{fp!.positionCounts[pos]}</span>)}
                      {played.length === 0 && <span className={styles.lineupZero}>—</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
