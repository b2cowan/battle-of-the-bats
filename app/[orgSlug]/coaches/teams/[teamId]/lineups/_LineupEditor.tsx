'use client';
// The ONE editable lineup surface, shared by the game lineup builder (/lineups/[eventId]) and the
// standalone template builder (/lineups/templates/[templateId]). Controlled via props: the parent
// owns rows/mode/innings + persistence (game autosave vs explicit template save) and its own extras
// (attendance/mismatch/undo/PDF/notes for a game; name/save for a template). Everything about the
// editing itself — format/innings, auto-fill, Reshuffle, the grid, the playing-time view, add/remove
// — lives here so it's written once and both surfaces stay in lock-step.
import { useState, useRef, useEffect } from 'react';
import { useDismissable } from '@/lib/overlay-hooks';
import { X, ChevronUp, ChevronDown, GripVertical, Shuffle } from 'lucide-react';
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
import { analyzeLineup, deriveLineupBadge } from '@/lib/lineup-analysis';
import { generateBestLineup, describePlacementReason, type PositionPolicy, type FillMode, type GenerationRationale } from '@/lib/lineup-generator';
import { playerPositionPrefs } from '@/lib/lineup-profile';
import { resolveLineupCaps, normalizeRulesOverride } from '@/lib/lineup-caps';
import { playerDisplayName } from '@/lib/coach-roster-name';
import {
  LINEUP_POSITIONS, POSITION_ORDER, heatStyle, renumberBattingOrder,
  type LineupPlayerRow,
} from '@/lib/lineup-grid';
import type { getSportPack } from '@/lib/sports';
import type { RepLineupMode, RepRosterPlayer, LineupSettings } from '@/lib/types';
import styles from '../../../coaches.module.css';

type SportPack = ReturnType<typeof getSportPack>;
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
  /** A message to show in the insights strip (parent-owned, e.g. template-load result). */
  notice?: string;
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
  };
}

export default function LineupEditor(props: LineupEditorProps) {
  const {
    roster, rows, onRowsChange, lineupMode, onLineupModeChange, inningCount, onInningCountChange,
    sportPack, seasonCaps, gameRules, onGameRulesChange, defaultPolicy = 'balanced',
    addLabel, notInHeading, onBeforeMutate, onNotice, controlsExtra, notice, readyState,
  } = props;
  const confirm = useConfirm();

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
  useEffect(() => {
    if (rowActionsFor !== null) rowSheetRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
  }, [rowActionsFor]);
  // The inning inspector (Phase 4, F12): the inning-first lens over the grid, opened from an inning
  // heading or a coverage check's "Review inning N". null = closed.
  const [inspectedInning, setInspectedInning] = useState<number | null>(null);
  const autoFillLabel = { competitive: 'Competitive', balanced: 'Balanced', development: 'Development' }[autoPolicy];
  // Keep the auto-fill policy in sync when the parent changes its pre-pick (e.g. a game loads).
  const policyInitRef = useRef(false);
  useEffect(() => {
    if (!policyInitRef.current) { policyInitRef.current = true; setAutoPolicy(defaultPolicy); }
  }, [defaultPolicy]);

  const autoFillRef = useRef<HTMLDivElement>(null);
  useDismissable(autoFillOpen, autoFillRef, () => setAutoFillOpen(false));

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
  // Group innings that share the exact same open roles AND the exact same proven cause (D7) into
  // one line — a roster short a second arm can leave the mound open for most of the game, and that
  // reads as one fact ("innings 2-7"), not the same sentence repeated six times.
  const openRoleGroups: { key: string; positions: string[]; pitcherCapped: boolean; innings: number[] }[] = [];
  {
    const byKey = new Map<string, (typeof openRoleGroups)[number]>();
    for (const issue of openRoleInnings) {
      const pitcherCapped = !!sportPack.pitcherPosition && issue.positions.includes(sportPack.pitcherPosition) && rationale.pitcherCappedInnings.has(issue.inning);
      const key = `${issue.positions.join(',')}|${pitcherCapped}`;
      const existing = byKey.get(key);
      if (existing) existing.innings.push(issue.inning);
      else {
        const group = { key, positions: issue.positions, pitcherCapped, innings: [issue.inning] };
        byKey.set(key, group);
        openRoleGroups.push(group);
      }
    }
  }
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
  // real Draft/Ready badge (readyState present) and offers "Mark ready" once coverage allows it.
  const badge = readyState ? deriveLineupBadge(analysis, readyState.status) : analysis.readiness;
  const readinessCopy = readyState ? {
    not_started: { label: 'Not started', detail: 'Choose positions or Auto-fill to begin.' },
    draft: {
      label: 'Draft',
      detail: analysis.readiness === 'ready'
        ? 'Every role is covered — mark it ready when you’re confident in it.'
        : openRoleInnings.length ? `${openRoleInnings.length} ${sportPack.periodLabel.toLowerCase()}${openRoleInnings.length === 1 ? '' : 's'} still need coverage.` : 'Some player decisions are still open.',
    },
    needs_review: { label: 'Needs review', detail: 'Resolve the highlighted position clashes before game day.' },
    ready: {
      label: 'Ready',
      detail: readyState.readyAtLabel ? `Marked ready · ${readyState.readyAtLabel}. Any edit returns this to Draft.` : 'Marked ready. Any edit returns this to Draft.',
    },
  }[badge] : {
    not_started: { label: 'Not started', detail: 'Choose positions or Auto-fill to begin.' },
    draft: { label: 'Draft', detail: openRoleInnings.length ? `${openRoleInnings.length} inning${openRoleInnings.length === 1 ? '' : 's'} still need coverage.` : 'Some player decisions are still open.' },
    needs_review: { label: 'Needs review', detail: 'Resolve the highlighted position clashes before game day.' },
    ready: { label: 'Coverage complete', detail: 'Every player has a decision and each required role is covered.' },
  }[analysis.readiness];
  const pitcherCapFor = (row: LineupPlayerRow) => {
    const playerCap = row.player.lineupProfile?.pitcher?.maxInnings ?? null;
    const teamCap = effectiveCaps.pitcherInningsCap;
    if (playerCap == null) return teamCap;
    if (teamCap == null) return playerCap;
    return Math.min(playerCap, teamCap);
  };
  const hasPlayerAttention = analysis.fairPlay.some(f => f.consecutiveBench || f.unassigned > 0);

  // "Review inning N" opens the inspector ON that inning (the review is the lens) and still
  // scrolls the grid to it underneath, so closing the lens leaves the coach at the right column.
  function focusInning(inning: number) {
    setView('lineup');
    setInspectedInning(inning);
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
      const player = roster.find(p => p.id === playerId);
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
      setAutoFillOpen(false);
    } finally {
      genBusyRef.current = false;
    }
  }
  async function handleReshuffle() {
    if (genBusyRef.current || rows.length === 0) return;
    genBusyRef.current = true;
    try {
      if (rows.some(r => Object.values(r.inningPositions).some(Boolean))) {
        if (!(await confirm({ title: 'Reshuffle the lineup?', message: 'This replaces the positions currently in the grid with a fresh arrangement with even bench rotation, using your current auto-fill settings. Continue?', confirmText: 'Reshuffle', cancelText: 'Keep current', tone: 'warning' }))) return;
      }
      runGenerate('regenerate');
    } finally {
      genBusyRef.current = false;
    }
  }

  async function handleClear() {
    if (rows.some(r => Object.values(r.inningPositions).some(Boolean))) {
      if (!(await confirm({ title: 'Clear all positions?', message: 'This empties every inning for every player. You can undo it right after.', confirmText: 'Clear', cancelText: 'Keep', tone: 'warning' }))) return;
    }
    mutate(list => list.map(r => ({ ...r, inningPositions: {} })));
    onNotice?.('');
  }

  const notInLineup = roster.filter(p => !rows.some(r => r.player.id === p.id));
  // A removed or re-fetched row simply stops matching and the sheet closes itself.
  const sheetIndex = rowActionsFor === null ? -1 : rows.findIndex(r => r.player.id === rowActionsFor);
  const sheetRow = sheetIndex >= 0 ? rows[sheetIndex] : null;

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
        <div className={styles.lineupReadiness} data-state={badge}>
          <span className={styles.lineupReadinessState}>{readinessCopy.label}</span>
          <p>{readinessCopy.detail}</p>
          {openRoleInnings[0] && (
            <button type="button" className={styles.lineupIssueJump} onClick={() => focusInning(openRoleInnings[0].inning)}>
              Review inning {openRoleInnings[0].inning}
            </button>
          )}
          {readyState && analysis.readiness === 'ready' && readyState.status === 'draft' && (
            <button type="button" className={styles.btnPrimary} disabled={readyState.marking} onClick={readyState.onMarkReady} style={{ marginTop: '0.5rem' }}>
              {readyState.marking ? 'Marking ready…' : 'Mark lineup ready'}
            </button>
          )}
          {readyState?.error && <p className={styles.errorText}>{readyState.error}</p>}
        </div>
        <div className={styles.lineupControls}>
          {/* Setup group (D3): Format and Innings are per-game configuration, not the primary
              action — grouped and labelled quietly so Auto-fill is the obvious next step. The
              "Setup" caption sits above the fields, the same way Format/Innings label theirs,
              rather than floating beside them at the group's mid-height. */}
          <div className={styles.lineupSetupGroup} aria-label="Setup">
            <span className={styles.lineupSetupLabel}>Setup</span>
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
          </div>
          <div className={styles.lineupAutoWrap} ref={autoFillRef}>
              <button type="button" className={styles.btnPrimary} disabled={rows.length === 0} onClick={() => setAutoFillOpen(v => !v)}>Auto-fill · {autoFillLabel} ▾</button>
              {autoFillOpen && (
                <div className={styles.lineupAutoMenu}>
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
                  {gameRules && onGameRulesChange && (
                    <div>
                      <button type="button" onClick={() => setGameRulesOpen(v => !v)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, color: 'var(--home-ink-soft, rgba(255,255,255,0.6))' }}>
                        Game rules {gameRulesOpen ? '▴' : '▾'}
                      </button>
                      {gameRulesOpen && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
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
                      )}
                    </div>
                  )}
                  <p className={styles.lineupAutoNote}>Auto-fill spreads bench time evenly across the roster. It&apos;s a starting point — tweak after.</p>
                  <button type="button" className={styles.btnSecondary} onClick={handleAutoFill}>Generate lineup</button>
                </div>
              )}
            </div>
            <button type="button" className={styles.btnSecondary} disabled={rows.length === 0} onClick={handleReshuffle} title="Fresh arrangement with even bench rotation, using your current auto-fill settings" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Shuffle size={14} /> Reshuffle
            </button>
            {controlsExtra}
          </div>

        {(notice || analysis.hasConflicts || openRoleInnings.length > 0 || (analysis.benchSpread && (analysis.benchSpread.max - analysis.benchSpread.min) > 1)) && (
          <div className={styles.lineupInsights}>
            {notice && <p className={styles.lineupNotice}>{notice}</p>}
            {analysis.hasConflicts && (
              <p className={`${styles.lineupWarn} ${styles.lineupWarnClash}`}>⚠ Position clash: {analysis.conflicts.map(c => `two at ${c.position} in inning ${c.inning}`).join(' · ')}</p>
            )}
            {openRoleGroups.map(group => (
              <p key={group.key} className={styles.lineupDraftCheck}>
                {group.innings.length === 1 ? (
                  <strong>{sportPack.periodLabel} {group.innings[0]}</strong>
                ) : (
                  <strong>{sportPack.periodLabel}s {formatInningRanges(group.innings)}</strong>
                )}
                {' '}{group.innings.length === 1 ? 'has' : 'each have'} {group.positions.length} open role{group.positions.length === 1 ? '' : 's'}: {group.positions.join(', ')}.
                {/* D7: the one blank-cell cause this pass will name — every other open role stays
                    a neutral fact, per F01, rather than a guess. */}
                {group.pitcherCapped && ' No eligible pitcher was available under the innings cap.'}
                <button type="button" onClick={() => focusInning(group.innings[0])}>Review {sportPack.periodLabel.toLowerCase()} {group.innings[0]}</button>
              </p>
            ))}
            {analysis.benchSpread && (analysis.benchSpread.max - analysis.benchSpread.min) > 1 && (
              <p className={styles.lineupWarn}>⚠ Uneven bench time — players sit between {analysis.benchSpread.min} and {analysis.benchSpread.max} innings.</p>
            )}
          </div>
        )}

        {rows.length === 0 ? (
          <div className={styles.attendanceEmpty}>
            {roster.length === 0 ? 'Add active players to the roster first.' : `No players in the lineup yet — add players from the ${notInHeading.toLowerCase()} below.`}
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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
                            onOpen={() => setInspectedInning(inning)}
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
            <button type="button" className={styles.lineupClearBtn} onClick={handleClear} style={{ marginTop: '0.6rem' }}>Clear positions</button>
          </DndContext>
        )}

        {/* The row-actions sheet (D8): opened by a TAP on a row's number at touch widths. It wears
            the toolbar popovers' phone recipe (`lineupAutoMenu` — a panel anchored above the nav),
            so it is the same surface Auto-fill, Templates and Print already open there. Move up /
            Move down are the non-drag path — the ↑ ↓ the order view used to carry, one tap away
            instead of one tab away — so nobody is stranded if press-and-hold feels wrong on a
            given phone. */}
        {sheetRow && (
          <div ref={rowSheetRef} className={`${styles.lineupAutoMenu} ${styles.lineupRowSheet}`} role="dialog" aria-label={`Options for ${playerDisplayName(sheetRow.player)}`}>
            <p className={styles.lineupRowSheetHead}>
              <strong>{playerDisplayName(sheetRow.player)}</strong>
              <span>{sheetRow.battingOrder ? `${sportPack.orderLabel} · ${sheetRow.battingOrder} of ${rows.filter(r => r.starter).length}` : 'Bench'}</span>
            </p>
            <button type="button" className={styles.lineupRowSheetItem} disabled={sheetIndex === 0} onClick={() => moveRowByPlayer(sheetRow.player.id, -1)}><ChevronUp size={18} aria-hidden="true" /> Move up</button>
            <button type="button" className={styles.lineupRowSheetItem} disabled={sheetIndex === rows.length - 1} onClick={() => moveRowByPlayer(sheetRow.player.id, 1)}><ChevronDown size={18} aria-hidden="true" /> Move down</button>
            <button type="button" className={`${styles.lineupRowSheetItem} ${styles.lineupRowSheetDanger}`} onClick={() => { removePlayer(sheetRow.player.id); setRowActionsFor(null); }}><X size={18} aria-hidden="true" /> Remove from lineup</button>
            <button type="button" className={styles.lineupRowSheetCancel} onClick={() => setRowActionsFor(null)}>Cancel</button>
          </div>
        )}

        <LineupInningInspector
          inning={rows.length ? inspectedInning : null}
          inningCount={inningCount}
          onClose={() => setInspectedInning(null)}
          onNavigate={setInspectedInning}
          rows={rows}
          sportPack={sportPack}
          pitcherCapFor={pitcherCapFor}
          onApply={applyInningChanges}
        />

        {notInLineup.length > 0 && (
          <div className={styles.lineupNotPlaying}>
            <p className={styles.lineupNotPlayingHead}>{notInHeading} · {notInLineup.length}</p>
            <div className={styles.lineupNotPlayingList}>
              {notInLineup.map(p => (
                <div key={p.id} className={styles.lineupNotPlayingRow}>
                  <span className={styles.lineupNotPlayingName}>{playerDisplayName(p)}</span>
                  <button type="button" className={styles.lineupAddBackBtn} onClick={() => addPlayer(p.id)}>{addLabel}</button>
                </div>
              ))}
            </div>
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
                          {sportPack.pitcherPosition && <td className={styles.lineupPitchingCell}>{row.player.lineupProfile?.pitcher ? `${pitching}/${pitcherCap ?? '—'}` : '—'}</td>}
                          {summaryPositions.filter(pos => pos !== sportPack.pitcherPosition).map(pos => { const n = fp?.positionCounts[pos] ?? 0; return <td key={pos} className={styles.lineupHeatCell} style={heatStyle(n)}>{n || <span className={styles.lineupZero}>·</span>}</td>; })}
                          {hasPlayerAttention && <td className={attention ? styles.lineupAttentionCell : styles.lineupZero}>{attention || '—'}</td>}
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
                      {sportPack.pitcherPosition && row.player.lineupProfile?.pitcher && <span className={styles.lineupChip}>P {fp?.positionCounts[sportPack.pitcherPosition] ?? 0}/{pitcherCapFor(row) ?? '—'}</span>}
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
