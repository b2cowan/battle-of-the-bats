'use client';
// The ONE editable lineup surface, shared by the game lineup builder (/lineups/[eventId]) and the
// standalone template builder (/lineups/templates/[templateId]). Controlled via props: the parent
// owns rows/mode/innings + persistence (game autosave vs explicit template save) and its own extras
// (attendance/mismatch/undo/PDF/notes for a game; name/save for a template). Everything about the
// editing itself — format/innings, auto-fill, Reshuffle, the grid, the playing-time view, add/remove
// — lives here so it's written once and both surfaces stay in lock-step.
import { useState, useRef, useEffect, type CSSProperties } from 'react';
import { X, ChevronUp, ChevronDown, GripVertical, Shuffle } from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import { analyzeLineup } from '@/lib/lineup-analysis';
import { generateBestLineup, type PositionPolicy, type FillMode } from '@/lib/lineup-generator';
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

// One drag-sortable lineup row. Batting order = drag position (auto-numbered), so duplicate slot
// numbers are impossible.
function SortableLineupRow({
  row, battingNumber, mode, inningCount, onStarterToggle, onPositionChange, index, count, onMove, onRemove,
}: {
  row: LineupPlayerRow; battingNumber: string; mode: RepLineupMode; inningCount: number;
  onStarterToggle: (playerId: string, checked: boolean) => void;
  onPositionChange: (playerId: string, inning: number, value: string) => void;
  index: number; count: number; onMove: (index: number, dir: -1 | 1) => void; onRemove: (playerId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.player.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  return (
    <tr ref={setNodeRef} style={style}>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <button type="button" aria-label={`Drag to reorder ${playerDisplayName(row.player)} in the batting order`}
            className={styles.lineupGrip} {...attributes} {...listeners}
            style={{ background: 'none', border: 'none', padding: 2, lineHeight: 0, cursor: 'grab', color: 'var(--home-dim, rgba(255,255,255,0.35))', touchAction: 'none' }}>
            <GripVertical size={14} />
          </button>
          <span className={styles.lineupMoveControls}>
            <button type="button" className={styles.lineupMoveBtn} aria-label={`Move ${playerDisplayName(row.player)} up`} disabled={index === 0} onClick={() => onMove(index, -1)}><ChevronUp size={14} /></button>
            <button type="button" className={styles.lineupMoveBtn} aria-label={`Move ${playerDisplayName(row.player)} down`} disabled={index === count - 1} onClick={() => onMove(index, 1)}><ChevronDown size={14} /></button>
          </span>
          <span style={{ minWidth: '1.2ch', textAlign: 'center', fontVariantNumeric: 'tabular-nums', color: battingNumber ? 'var(--white-90)' : 'var(--home-dim, rgba(255,255,255,0.3))' }}>{battingNumber || '–'}</span>
        </div>
      </td>
      {mode === 'nine_player' && (
        <td className={styles.lineupColStart}>
          <input type="checkbox" checked={row.starter} onChange={e => onStarterToggle(row.player.id, e.target.checked)} aria-label={`Starter for ${playerDisplayName(row.player)}`} />
        </td>
      )}
      <td className={styles.lineupPlayerCell} style={{ display: 'table-cell', verticalAlign: 'middle' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <span className={styles.lineupPlayerName}>{playerDisplayName(row.player)}</span>
          <button type="button" className={styles.lineupRemoveBtn} aria-label={`Remove ${playerDisplayName(row.player)} from the lineup`} title="Remove" onClick={() => onRemove(row.player.id)}><X size={13} /></button>
        </div>
      </td>
      {Array.from({ length: inningCount }, (_, i) => {
        const inning = i + 1;
        return (
          <td key={inning}>
            <select className={styles.lineupPositionSelect} value={row.inningPositions[String(inning)] ?? ''}
              onChange={e => onPositionChange(row.player.id, inning, e.target.value)} aria-label={`Inning ${inning} position for ${playerDisplayName(row.player)}`}>
              {LINEUP_POSITIONS.map(position => <option key={position || 'blank'} value={position}>{position || '-'}</option>)}
            </select>
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
}

export default function LineupEditor(props: LineupEditorProps) {
  const {
    roster, rows, onRowsChange, lineupMode, onLineupModeChange, inningCount, onInningCountChange,
    sportPack, seasonCaps, gameRules, onGameRulesChange, defaultPolicy = 'balanced',
    addLabel, notInHeading, onBeforeMutate, onNotice, controlsExtra, notice,
  } = props;
  const confirm = useConfirm();

  const [autoFillOpen, setAutoFillOpen] = useState(false);
  const [autoPolicy, setAutoPolicy] = useState<PositionPolicy>(defaultPolicy);
  const [autoFillMode, setAutoFillMode] = useState<FillMode>('empty');
  const [aSquadEmphasis, setASquadEmphasis] = useState<'balanced_sits' | 'prioritized'>('balanced_sits');
  const [noBackToBackSits, setNoBackToBackSits] = useState(true);
  const [gameRulesOpen, setGameRulesOpen] = useState(false);
  // Which innings auto-fill/reshuffle should WRITE (default = all). `fillTo === null` tracks the last
  // inning. Innings outside the range keep what's there and are still counted toward the rules.
  const [fillFrom, setFillFrom] = useState(1);
  const [fillTo, setFillTo] = useState<number | null>(null);
  const rangeFrom = Math.min(Math.max(1, fillFrom), inningCount);
  const rangeTo = Math.min(fillTo ?? inningCount, inningCount);
  const [view, setView] = useState<'lineup' | 'summary'>('lineup');
  // Keep the auto-fill policy in sync when the parent changes its pre-pick (e.g. a game loads).
  const policyInitRef = useRef(false);
  useEffect(() => {
    if (!policyInitRef.current) { policyInitRef.current = true; setAutoPolicy(defaultPolicy); }
  }, [defaultPolicy]);

  const autoFillRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!autoFillOpen) return;
    function onDown(e: PointerEvent) { if (!autoFillRef.current?.contains(e.target as Node)) setAutoFillOpen(false); }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setAutoFillOpen(false); }
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [autoFillOpen]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
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
  const unfilled = analysis.unfilledFieldPositions.filter(u => assignedInnings.has(u.inning));

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
  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    mutate(list => {
      const oldIndex = list.findIndex(r => r.player.id === active.id);
      const newIndex = list.findIndex(r => r.player.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return list;
      return renumberBattingOrder(arrayMove(list, oldIndex, newIndex), lineupMode);
    });
  }
  function moveRow(index: number, dir: -1 | 1) {
    mutate(list => (index + dir < 0 || index + dir >= list.length) ? list : renumberBattingOrder(arrayMove(list, index, index + dir), lineupMode));
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
    const generated = generateBestLineup({
      players: fielders.map(r => {
        const prefs = playerPositionPrefs(r.player, sportPack.pitcherPosition);
        return {
          playerId: r.player.id, preferred: prefs.preferred, canPlay: prefs.canPlay, never: prefs.never,
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
        if (!(await confirm({ title: 'Reshuffle the lineup?', message: 'This replaces the positions currently in the grid with a fresh fair arrangement using your current auto-fill settings. Continue?', confirmText: 'Reshuffle', cancelText: 'Keep current', tone: 'warning' }))) return;
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

  return (
    <div className={styles.lineupSection}>
      <div className={styles.lineupViewToggle} role="tablist" aria-label="Lineup view">
        <button type="button" role="tab" aria-selected={view === 'lineup'} className={`${styles.lineupViewBtn} ${view === 'lineup' ? styles.lineupViewBtnActive : ''}`} onClick={() => setView('lineup')}>Lineup</button>
        <button type="button" role="tab" aria-selected={view === 'summary'} className={`${styles.lineupViewBtn} ${view === 'summary' ? styles.lineupViewBtnActive : ''}`} disabled={rows.length === 0} onClick={() => setView('summary')}>Playing time</button>
      </div>

      {view === 'lineup' && (<>
        <div className={styles.lineupHeader}>
          <div>
            <h3 className={styles.attendanceTitle}>Lineup</h3>
            <p className={styles.attendanceSummary}>
              {lineupMode === 'nine_player'
                ? `${rows.filter(r => r.starter).length} starters, ${rows.filter(r => !r.starter).length} bench`
                : `${rows.length} hitters`}
            </p>
          </div>
          <div className={styles.lineupControls}>
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
            <div className={styles.lineupAutoWrap} ref={autoFillRef}>
              <button type="button" className={styles.btnSecondary} disabled={rows.length === 0} onClick={() => setAutoFillOpen(v => !v)}>Auto-fill ▾</button>
              {autoFillOpen && (
                <div className={styles.lineupAutoMenu}>
                  <label className={styles.lineupControlLabel}>
                    <span>Mode</span>
                    <select className={styles.select} value={autoPolicy} onChange={e => setAutoPolicy(e.target.value as PositionPolicy)}>
                      <option value="competitive">Competitive — best on the field</option>
                      <option value="balanced">Balanced — preferred spots, rotate</option>
                      <option value="development">Development — rotate everyone</option>
                    </select>
                  </label>
                  {autoPolicy === 'competitive' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8, borderTop: '1px solid var(--home-line, rgba(255,255,255,0.08))' }}>
                      <label className={styles.lineupControlLabel}>
                        <span>A-squad</span>
                        <select className={styles.select} value={aSquadEmphasis} onChange={e => setASquadEmphasis(e.target.value as 'balanced_sits' | 'prioritized')}>
                          <option value="balanced_sits">Play key spots — bench rotates evenly</option>
                          <option value="prioritized">Stay on field — others cover the bench</option>
                        </select>
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
                  <p className={styles.lineupAutoNote}>Auto-fill shares playing time fairly. It&apos;s a starting point — tweak after.</p>
                  <button type="button" className={styles.btnPrimary} onClick={handleAutoFill}>Generate</button>
                </div>
              )}
            </div>
            <button type="button" className={styles.btnSecondary} disabled={rows.length === 0} onClick={handleReshuffle} title="Fresh fair arrangement with your current auto-fill settings" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Shuffle size={14} /> Reshuffle
            </button>
            {controlsExtra}
          </div>
        </div>

        {(notice || analysis.hasConflicts || unfilled.length > 0 || (analysis.benchSpread && (analysis.benchSpread.max - analysis.benchSpread.min) > 1)) && (
          <div className={styles.lineupInsights}>
            {notice && <p className={styles.lineupNotice}>{notice}</p>}
            {analysis.hasConflicts && (
              <p className={`${styles.lineupWarn} ${styles.lineupWarnClash}`}>⚠ Position clash: {analysis.conflicts.map(c => `two at ${c.position} in inning ${c.inning}`).join(' · ')}</p>
            )}
            {unfilled.length > 0 && (
              <p className={styles.lineupWarn}>⚠ Couldn&apos;t fill {unfilled.map(u => `${u.positions.join(', ')} in ${sportPack.periodLabel.toLowerCase()} ${u.inning}`).join(' · ')} — a player may have this spot set to &ldquo;Never,&rdquo; leaving no one eligible.</p>
            )}
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
            <p className={styles.lineupScrollHint}>Swipe across innings →</p>
            <div className={styles.lineupTableWrap}>
              <table className={styles.lineupTable} style={{ '--lineup-lead': lineupMode === 'nine_player' ? '5.8rem' : '3.4rem' } as CSSProperties}>
                <thead>
                  <tr>
                    <th>Bat</th>
                    {lineupMode === 'nine_player' && <th className={styles.lineupColStart}>Start</th>}
                    <th className={styles.lineupColPlayer}>Player</th>
                    {Array.from({ length: inningCount }, (_, i) => {
                      const inning = i + 1;
                      const clash = analysis.conflictInnings.has(inning);
                      return <th key={inning} className={styles.lineupColInning} style={clash ? { color: 'var(--danger)' } : undefined} title={clash ? 'Two players share a position this inning' : undefined}>{inning}{clash ? ' ⚠' : ''}</th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  <SortableContext items={rows.map(r => r.player.id)} strategy={verticalListSortingStrategy}>
                    {rows.map((row, i) => (
                      <SortableLineupRow key={row.player.id} row={row} battingNumber={row.battingOrder} mode={lineupMode} inningCount={inningCount}
                        onStarterToggle={toggleStarter} onPositionChange={setPosition} index={i} count={rows.length} onMove={moveRow} onRemove={removePlayer} />
                    ))}
                  </SortableContext>
                </tbody>
              </table>
            </div>
            <button type="button" className={styles.lineupClearBtn} onClick={handleClear} style={{ marginTop: '0.6rem' }}>Clear positions</button>
          </DndContext>
        )}

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
              <span className={`${styles.lineupFairPill} ${benchMax - benchMin > 1 ? styles.lineupFairPillWarn : ''}`}>{benchMax - benchMin > 1 ? 'Uneven' : 'Balanced'}</span>
            </div>
            <div className={styles.lineupSummaryDesktop}>
              <div className={styles.lineupSummaryWrap}>
                <table className={styles.lineupSummaryTable}>
                  <thead><tr><th>Player</th><th title="Innings on the field vs benched">On field</th>{summaryPositions.map(pos => <th key={pos}>{pos}</th>)}</tr></thead>
                  <tbody>
                    {rows.map(row => {
                      const fp = fairPlayByPlayer.get(row.player.id);
                      return (
                        <tr key={row.player.id}>
                          <td className={styles.lineupSummaryName}>{playerDisplayName(row.player)}</td>
                          <td>{onFieldGauge(fp)}</td>
                          {summaryPositions.map(pos => { const n = fp?.positionCounts[pos] ?? 0; return <td key={pos} className={styles.lineupHeatCell} style={heatStyle(n)}>{n || <span className={styles.lineupZero}>·</span>}</td>; })}
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
                const played = summaryPositions.filter(pos => (fp?.positionCounts[pos] ?? 0) > 0);
                return (
                  <div key={row.player.id} className={styles.lineupChipRow}>
                    <span className={styles.lineupChipName}>{playerDisplayName(row.player)}</span>
                    {onFieldGauge(fp)}
                    <span className={styles.lineupChips}>
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
