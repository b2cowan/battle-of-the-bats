'use client';
import { use, useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { ListOrdered, ArrowLeft, CalendarDays, X, Undo2, Redo2, Printer, Check } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import { useOrg } from '@/lib/org-context';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import UnsavedChangesGuard from '@/components/coaches/UnsavedChangesGuard';
import { getSportPack, DEFAULT_SPORT } from '@/lib/sports';
import { normalizeRulesOverride } from '@/lib/lineup-caps';
import type { PositionPolicy } from '@/lib/lineup-generator';
import {
  downloadLineupPoster, downloadBattingOrderCard, buildPositionLegend, buildFilename,
  DEFAULT_PDF_SETTINGS, type OrgPdfSettings, type LineupPosterPlayer,
} from '@/lib/export';
import { playerDisplayName } from '@/lib/coach-roster-name';
import {
  LINEUP_POSITIONS, buildLineupRows, renumberBattingOrder, sortLineupRows, type LineupPlayerRow,
} from '@/lib/lineup-grid';
import LineupEditor from '../_LineupEditor';
import styles from '../../../../coaches.module.css';
import type {
  LineupSettings, LineupRulesOverride,
  RepAttendanceStatus, RepLineupMode, RepRosterPlayer, RepTeamEvent, RepTeamEventAttendance,
  RepTeamLineup, RepTeamLineupEntry, RepTeamLineupTemplate, RepProgramYear,
} from '@/lib/types';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true });
}
function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function CoachLineupBuilderPage({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string; eventId: string }>;
}) {
  const { orgSlug, teamId, eventId } = use(paramsPromise);
  const { assignments, loading: ctxLoading } = useCoaches();
  const { currentOrg } = useOrg();
  const confirm = useConfirm();
  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  const assignment = assignments.find(a => a.teamId === teamId);
  const sportPack = getSportPack(assignment?.teamSport ?? DEFAULT_SPORT);
  const canLineups = assignment ? assignment.capabilities.lineups : true;

  const [event, setEvent] = useState<RepTeamEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [lineupMode, setLineupMode] = useState<RepLineupMode>('everyone_bats');
  const [lineupInningCount, setLineupInningCount] = useState(sportPack.defaultPeriodCount);
  const [lineupNotes, setLineupNotes] = useState('');
  const [lineupRows, setLineupRows] = useState<LineupPlayerRow[]>([]);
  const [lineupPdfOpen, setLineupPdfOpen] = useState(false);
  const [pdfIncludeNotes, setPdfIncludeNotes] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templates, setTemplates] = useState<RepTeamLineupTemplate[]>([]);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateError, setTemplateError] = useState('');
  const [lineupNotice, setLineupNotice] = useState('');
  const [lineupSeasonCaps, setLineupSeasonCaps] = useState<LineupSettings | null>(null);
  const [gameRules, setGameRules] = useState({ maxPos: '', pitcher: '', minPlay: '' });
  const [lineupLoading, setLineupLoading] = useState(false);
  const [lineupSaving, setLineupSaving] = useState(false);
  const [lineupDirty, setLineupDirty] = useState(false);
  const [lineupError, setLineupError] = useState('');
  const [pdfSettings, setPdfSettings] = useState<OrgPdfSettings | null>(null);

  // Attendance is loaded READ-ONLY here (edited on the Schedule) — used only to flag lineup ↔
  // attendance mismatches. The lineup and attendance are independent: neither auto-changes the other.
  const [attendanceRows, setAttendanceRows] = useState<{ player: RepRosterPlayer; status: RepAttendanceStatus; note: string }[]>([]);

  // ── Undo/redo — snapshots of the editable lineup state (notes excluded on purpose). ──
  type LineupSnap = { rows: LineupPlayerRow[]; mode: RepLineupMode; innings: number };
  const [lineupHistory, setLineupHistory] = useState<{ undo: LineupSnap[]; redo: LineupSnap[] }>({ undo: [], redo: [] });
  const lineupSnap = (): LineupSnap => ({ rows: lineupRows, mode: lineupMode, innings: lineupInningCount });
  function pushLineupUndo() {
    setLineupHistory(h => ({ undo: [...h.undo, lineupSnap()].slice(-60), redo: [] }));
  }
  function applyLineupSnap(s: LineupSnap) {
    setLineupRows(s.rows);
    setLineupMode(s.mode);
    setLineupInningCount(s.innings);
    setLineupDirty(true);
  }
  function undoLineup() {
    if (lineupHistory.undo.length === 0) return;
    const prev = lineupHistory.undo[lineupHistory.undo.length - 1];
    const cur = lineupSnap();
    applyLineupSnap(prev);
    setLineupHistory(h => ({ undo: h.undo.slice(0, -1), redo: [...h.redo, cur] }));
  }
  function redoLineup() {
    if (lineupHistory.redo.length === 0) return;
    const next = lineupHistory.redo[lineupHistory.redo.length - 1];
    const cur = lineupSnap();
    applyLineupSnap(next);
    setLineupHistory(h => ({ undo: [...h.undo, cur], redo: h.redo.slice(0, -1) }));
  }

  const buildGameRulesOverride = (): LineupRulesOverride | null => normalizeRulesOverride({
    maxInningsPerPosition: gameRules.maxPos,
    pitcherMaxInnings: gameRules.pitcher,
    minInningsPerPlayer: gameRules.minPlay,
  });
  const lineupSig = () => JSON.stringify({ m: lineupMode, i: lineupInningCount, n: lineupNotes, g: gameRules, r: lineupRows.map(r => [r.player.id, r.battingOrder, r.starter, r.inningPositions]) });
  const lineupSigRef = useRef('');
  useEffect(() => { lineupSigRef.current = lineupSig(); }, [lineupRows, lineupMode, lineupInningCount, lineupNotes, gameRules]); // eslint-disable-line react-hooks/exhaustive-deps

  // Org PDF settings (poster branding) — optional; poster falls back to defaults.
  useEffect(() => {
    fetch(`/api/admin/org/pdf-settings?orgSlug=${orgSlug}`)
      .then(r => r.ok ? r.json() : {})
      .then(d => setPdfSettings(d as OrgPdfSettings))
      .catch(() => setPdfSettings(null));
  }, [orgSlug]);

  // Saved lineup templates (team + active-program-year scoped, not per event).
  const reloadTemplates = useCallback(async () => {
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/lineup-templates`);
      if (!res.ok) return;
      const data = await res.json();
      setTemplates(data.templates ?? []);
    } catch { /* non-blocking — templates are optional */ }
  }, [orgSlug, teamId]);
  useEffect(() => { if (canLineups) void Promise.resolve().then(reloadTemplates); }, [canLineups, reloadTemplates]);

  // Load the game + its lineup. Sequence guard: a slow earlier response must not stomp a newer one.
  const loadSeqRef = useRef(0);
  const load = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    const isStale = () => seq !== loadSeqRef.current;
    setLoading(true);
    setLineupLoading(true);
    setLoadError('');
    setLineupError('');
    setLineupDirty(false);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${eventId}/lineup`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(d.error ?? 'Could not load this lineup');
      }
      const data: {
        event?: RepTeamEvent;
        players?: RepRosterPlayer[];
        attendance?: RepTeamEventAttendance[];
        lineup?: RepTeamLineup | null;
        entries?: RepTeamLineupEntry[];
        programYear?: RepProgramYear | null;
      } = await res.json();
      if (isStale()) return;

      setEvent(data.event ?? null);
      const players = data.players ?? [];
      const attendanceByPlayer = new Map((data.attendance ?? []).map(row => [row.playerId, row]));
      setAttendanceRows(players.map(player => {
        const existing = attendanceByPlayer.get(player.id);
        return { player, status: existing?.status ?? 'unknown', note: existing?.note ?? '' };
      }));

      const mode = data.lineup?.lineupMode ?? 'everyone_bats';
      const entries = data.entries ?? [];
      // Rows come from the SAVED lineup (independent of attendance). A brand-new lineup (no entries
      // yet) seeds from the whole active roster as a starting point the coach trims/fills.
      const rosterById = new Map(players.map(p => [p.id, p]));
      const seedPlayers = entries.length > 0
        ? entries.map(e => rosterById.get(e.playerId)).filter((p): p is RepRosterPlayer => !!p)
        : players;
      setLineupMode(mode);
      setLineupInningCount(data.lineup?.inningCount ?? sportPack.defaultPeriodCount);
      setLineupNotes(data.lineup?.notes ?? '');
      setLineupSeasonCaps(data.programYear?.lineupSettings ?? null);
      const ro = data.lineup?.rulesOverride ?? null;
      setGameRules({
        maxPos: ro?.maxInningsPerPosition != null ? String(ro.maxInningsPerPosition) : '',
        pitcher: ro?.pitcherMaxInnings != null ? String(ro.pitcherMaxInnings) : '',
        minPlay: ro?.minInningsPerPlayer != null ? String(ro.minInningsPerPlayer) : '',
      });
      setLineupRows(renumberBattingOrder(sortLineupRows(buildLineupRows(seedPlayers, entries, mode)), mode));
      setLineupHistory({ undo: [], redo: [] });
    } catch (e: unknown) {
      if (isStale()) return;
      setLoadError(errorMessage(e, 'Could not load this lineup'));
    } finally {
      if (!isStale()) { setLoading(false); setLineupLoading(false); }
    }
  }, [orgSlug, teamId, eventId, sportPack.defaultPeriodCount]);

  useEffect(() => {
    if (!ctxLoading && canLineups) void Promise.resolve().then(load);
  }, [ctxLoading, canLineups, load]);

  // Close the Templates / Print popovers on an outside tap or Escape (the auto-fill popover is
  // self-managed inside LineupEditor).
  const templatesRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!templatesOpen && !lineupPdfOpen) return;
    function closeMenus() { setTemplatesOpen(false); setLineupPdfOpen(false); }
    function onDown(e: PointerEvent) {
      const t = e.target as Node;
      if (templatesRef.current?.contains(t) || pdfRef.current?.contains(t)) return;
      closeMenus();
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') closeMenus(); }
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [templatesOpen, lineupPdfOpen]);

  // Auto-save the lineup ~0.9s after the last change (debounced) — no Save button.
  useEffect(() => {
    if (!lineupDirty || lineupSaving || !event || lineupLoading || lineupRows.length === 0) return;
    const t = setTimeout(() => { void handleLineupSave(); }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineupDirty, lineupSaving, lineupRows, lineupNotes, lineupMode, lineupInningCount, gameRules]);

  // ── Template popover handlers ──
  function lineupTemplatePayload() {
    return lineupRows.map(row => ({
      playerId: row.player.id,
      battingOrder: lineupMode === 'nine_player' && !row.starter ? null : (Number(row.battingOrder) || null),
      starter: lineupMode === 'nine_player' ? row.starter : true,
      inningPositions: row.inningPositions,
    }));
  }
  async function handleSaveTemplate() {
    const name = newTemplateName.trim();
    if (!name || lineupRows.length === 0) return;
    setTemplateSaving(true);
    setTemplateError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/lineup-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, lineupMode, inningCount: lineupInningCount, entries: lineupTemplatePayload() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(d.error ?? 'Could not save template');
      }
      setNewTemplateName('');
      await reloadTemplates();
      setLineupNotice(`Saved “${name}” as a template.`);
      setTemplatesOpen(false);
    } catch (e: unknown) {
      setTemplateError(errorMessage(e, 'Could not save template'));
    } finally {
      setTemplateSaving(false);
    }
  }
  async function applyTemplate(t: RepTeamLineupTemplate) {
    const hasAny = lineupRows.some(r => Object.values(r.inningPositions).some(Boolean));
    if (hasAny && !(await confirm({
      title: 'Start from template?',
      message: `Replace the current lineup with “${t.name}”? Unsaved changes will be lost.`,
      confirmText: 'Load template', cancelText: 'Keep current', tone: 'warning',
    }))) return;
    const byId = new Map(t.entries.map(e => [e.playerId, e]));
    const rosterIds = new Set(lineupRows.map(r => r.player.id));
    const skipped = t.entries.filter(e => !rosterIds.has(e.playerId)).length;
    pushLineupUndo();
    setLineupMode(t.lineupMode);
    setLineupInningCount(t.inningCount);
    setLineupRows(rows => renumberBattingOrder(sortLineupRows(rows.map(row => {
      const e = byId.get(row.player.id);
      if (e) return { ...row, starter: e.starter, battingOrder: e.battingOrder != null ? String(e.battingOrder) : '', inningPositions: { ...e.inningPositions } };
      return { ...row, starter: t.lineupMode === 'everyone_bats', battingOrder: '', inningPositions: {} };
    })), t.lineupMode));
    setLineupDirty(true);
    setTemplatesOpen(false);
    setLineupNotice(skipped > 0
      ? `Loaded “${t.name}” — skipped ${skipped} player${skipped === 1 ? '' : 's'} no longer on the roster.`
      : `Loaded “${t.name}” — review and save when ready.`);
  }
  async function handleDeleteTemplate(t: RepTeamLineupTemplate) {
    if (!(await confirm({
      title: 'Delete template?',
      message: `Delete the saved template “${t.name}”? This can't be undone.`,
      confirmText: 'Delete', cancelText: 'Keep', tone: 'warning',
    }))) return;
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/lineup-templates/${t.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(d.error ?? 'Could not delete template');
      }
      await reloadTemplates();
    } catch (e: unknown) {
      setTemplateError(errorMessage(e, 'Could not delete template'));
    }
  }

  // Reconcile actions for the attendance-mismatch banner — lineup-side only, dedup in the updater.
  function addPlayersToLineup(ids: string[]) {
    pushLineupUndo();
    setLineupRows(rows => {
      const present = new Set(rows.map(r => r.player.id));
      const added: LineupPlayerRow[] = ids
        .filter(id => !present.has(id))
        .map(id => attendanceRows.find(r => r.player.id === id)?.player)
        .filter((p): p is RepRosterPlayer => !!p)
        .map(p => ({ player: p, battingOrder: '', starter: lineupMode === 'everyone_bats', inningPositions: {}, notes: '' }));
      return added.length === 0 ? rows : renumberBattingOrder([...rows, ...added], lineupMode);
    });
    setLineupDirty(true);
  }
  function removePlayersFromLineup(ids: string[]) {
    const idSet = new Set(ids);
    if (!lineupRows.some(r => idSet.has(r.player.id))) return;
    pushLineupUndo();
    setLineupRows(rows => renumberBattingOrder(rows.filter(r => !idSet.has(r.player.id)), lineupMode));
    setLineupDirty(true);
  }

  async function handleLineupSave(): Promise<boolean> {
    if (!event) return true;
    const sigAtSave = lineupSig();
    setLineupSaving(true);
    setLineupError('');
    try {
      const rows = lineupRows.map(row => ({
        playerId: row.player.id,
        battingOrder: lineupMode === 'nine_player' && !row.starter ? null : row.battingOrder,
        starter: lineupMode === 'nine_player' ? row.starter : true,
        inningPositions: row.inningPositions,
        notes: row.notes ?? '',
      }));
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${event.id}/lineup`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineupMode, inningCount: lineupInningCount, notes: lineupNotes, rulesOverride: buildGameRulesOverride(), entries: rows }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(d.error ?? 'Lineup save failed');
      }
      await res.json().catch(() => ({}));
      if (lineupSigRef.current === sigAtSave) setLineupDirty(false);
      setLineupNotice('');
      return true;
    } catch (e: unknown) {
      setLineupError(errorMessage(e, 'Lineup save failed'));
      return false;
    } finally {
      setLineupSaving(false);
    }
  }

  function buildPosterOptions() {
    if (!event || lineupRows.length === 0) return null;
    const settings: OrgPdfSettings = { ...DEFAULT_PDF_SETTINGS, ...(pdfSettings && Object.keys(pdfSettings).length > 0 ? pdfSettings : {}) };
    const players: LineupPosterPlayer[] = sortLineupRows(lineupRows).map(row => {
      const isSub = lineupMode === 'nine_player' && !row.starter;
      return { battingOrder: isSub ? '' : row.battingOrder, name: playerDisplayName(row.player), isSub, inningPositions: row.inningPositions };
    });
    return {
      teamName: assignment?.teamName ?? teamId,
      opponent: event.opponent,
      homeAway: event.homeAway,
      dateLabel: event.startsAt ? `${fmtDate(event.startsAt)} · ${fmtTime(event.startsAt)}` : '',
      eventName: event.name,
      inningCount: lineupInningCount,
      players,
      legend: buildPositionLegend(LINEUP_POSITIONS.filter(p => p && p !== 'Bench')),
      includeNotes: pdfIncludeNotes,
      notes: lineupNotes,
      accentColor: settings.accentColor,
      showBranding: settings.showBranding,
    };
  }
  async function handleLineupPoster() {
    const opts = buildPosterOptions();
    if (!opts || !event) return;
    setLineupPdfOpen(false);
    await downloadLineupPoster(buildFilename({ org: currentOrg?.slug ?? orgSlug, dataset: 'lineup', scope: event.name || opts.teamName }, 'pdf'), opts);
  }
  async function handleBattingCard() {
    const opts = buildPosterOptions();
    if (!opts || !event) return;
    setLineupPdfOpen(false);
    await downloadBattingOrderCard(buildFilename({ org: currentOrg?.slug ?? orgSlug, dataset: 'batting-order', scope: event.name || opts.teamName }, 'pdf'), opts);
  }

  // ── Render ──
  if (ctxLoading) return <div className={styles.loadingState}>Loading…</div>;
  if (!assignment) {
    return <div className={styles.notAssigned}><h2>Team not found</h2><p>You are not assigned to this team.</p></div>;
  }

  const gameTitle = event
    ? (event.opponent ? `${event.homeAway === 'away' ? '@' : 'vs'} ${event.opponent}` : event.name || 'Game')
    : 'Lineup';
  const gameMeta = event && event.startsAt ? `${fmtDate(event.startsAt)} · ${fmtTime(event.startsAt)}` : '';
  const defaultPolicy: PositionPolicy = event?.eventType === 'tournament_game' ? 'competitive'
    : event?.eventType === 'scrimmage' ? 'development' : 'balanced';

  const header = (
    <>
      <Link href={`${base}/lineups`} className={styles.lineupBackLink}><ArrowLeft size={14} aria-hidden /> All lineups</Link>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><ListOrdered size={22} /></div>
          <div>
            <h1 className={styles.pageTitle}>{gameTitle}</h1>
            <div className={styles.lineupMetaRow}>
              <span className={styles.lineupMetaText}>{gameMeta || 'Set the batting order and field positions for this game.'}</span>
              {event && (
                <Link href={`${base}/schedule?event=${eventId}`} className={styles.lineupOnScheduleLink}>
                  <CalendarDays size={12} aria-hidden /> View on schedule
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );

  if (!canLineups) {
    return (
      <div className={styles.page}>
        {header}
        <div className={styles.emptyState}>
          <ListOrdered size={28} style={{ opacity: 0.3, margin: '0 auto 0.75rem', display: 'block' }} />
          <p className={styles.emptyStateTitle}>Lineups aren&apos;t enabled for you</p>
          <p className={styles.emptyStateSub}>Ask your head coach to grant lineup access.</p>
        </div>
      </div>
    );
  }

  const lineupRowIds = new Set(lineupRows.map(r => r.player.id));
  const comingNotInLineup = attendanceRows.filter(r => (r.status === 'attending' || r.status === 'late') && !lineupRowIds.has(r.player.id));
  const outButInLineup = attendanceRows.filter(r => r.status === 'absent' && lineupRowIds.has(r.player.id));

  // The Templates popover, injected into the editor's controls row via `controlsExtra`.
  const templatesControl = (
    <div className={styles.lineupAutoWrap} ref={templatesRef}>
      <button type="button" className={styles.btnSecondary} disabled={lineupRows.length === 0}
        onClick={() => { setTemplatesOpen(v => !v); setTemplateError(''); setLineupPdfOpen(false); }} aria-expanded={templatesOpen}>
        Templates ▾
      </button>
      {templatesOpen && (
        <div className={styles.lineupAutoMenu}>
          <div className={styles.lineupTemplateSection}>
            <span className={styles.lineupTemplateHead}>Start from a saved template</span>
            {templates.length === 0 ? (
              <p className={styles.lineupAutoNote}>No saved templates yet — build a lineup, then save it below.</p>
            ) : (
              <ul className={styles.lineupTemplateList}>
                {templates.map(t => (
                  <li key={t.id} className={styles.lineupTemplateRow}>
                    <button type="button" className={styles.lineupTemplateLoad} onClick={() => applyTemplate(t)}>
                      <strong>{t.name}</strong>
                      <span>{t.lineupMode === 'nine_player' ? '9 player ball' : 'Everyone bats'} · {t.inningCount} {sportPack.periodLabelPlural.toLowerCase()}</span>
                    </button>
                    <button type="button" className={styles.lineupTemplateDelete} aria-label={`Delete template ${t.name}`} title="Delete template" onClick={() => handleDeleteTemplate(t)}><X size={14} /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className={styles.lineupTemplateSection}>
            <span className={styles.lineupTemplateHead}>Save current lineup as a template</span>
            <input className={styles.input} value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)} placeholder="e.g. Gold medal game" maxLength={80} aria-label="New template name" />
            <button type="button" className={styles.btnPrimary} disabled={!newTemplateName.trim() || templateSaving || lineupRows.length === 0} onClick={handleSaveTemplate}>
              {templateSaving ? 'Saving…' : 'Save as template'}
            </button>
            {templateError && <p className={styles.errorText}>{templateError}</p>}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className={styles.page}>
      {header}
      <UnsavedChangesGuard active={lineupDirty} />

      {loading ? (
        <div className={styles.loadingState}>Loading lineup…</div>
      ) : loadError ? (
        <p className={styles.errorText}>{loadError}</p>
      ) : (
        <>
          {(comingNotInLineup.length > 0 || outButInLineup.length > 0) && (
            <div className={styles.lineupPeekWarn} role="status" style={{ marginBottom: '1rem' }}>
              {comingNotInLineup.length > 0 && <p>⚠ Marked in but not in the lineup: {comingNotInLineup.map(r => playerDisplayName(r.player)).join(', ')}.</p>}
              {outButInLineup.length > 0 && <p>⚠ In the lineup but marked Out: {outButInLineup.map(r => playerDisplayName(r.player)).join(', ')}.</p>}
              <div className={styles.lineupReconcileActions}>
                {comingNotInLineup.length > 0 && (
                  <button type="button" className={styles.btnSecondary} onClick={() => addPlayersToLineup(comingNotInLineup.map(r => r.player.id))}>
                    Add {comingNotInLineup.length} coming {comingNotInLineup.length === 1 ? 'player' : 'players'}
                  </button>
                )}
                {outButInLineup.length > 0 && (
                  <button type="button" className={styles.btnSecondary} onClick={() => removePlayersFromLineup(outButInLineup.map(r => r.player.id))}>
                    Remove {outButInLineup.length} Out {outButInLineup.length === 1 ? 'player' : 'players'}
                  </button>
                )}
              </div>
              <span>Nothing changes until you tap a button — or fix the attendance on the Schedule if that&apos;s what&apos;s wrong.</span>
            </div>
          )}

          <LineupEditor
            roster={attendanceRows.map(r => r.player)}
            rows={lineupRows}
            onRowsChange={updater => { setLineupRows(updater); setLineupDirty(true); }}
            lineupMode={lineupMode}
            onLineupModeChange={m => { setLineupMode(m); setLineupDirty(true); }}
            inningCount={lineupInningCount}
            onInningCountChange={n => { setLineupInningCount(n); setLineupDirty(true); }}
            sportPack={sportPack}
            seasonCaps={lineupSeasonCaps}
            gameRules={gameRules}
            onGameRulesChange={g => { setGameRules(g); setLineupDirty(true); }}
            defaultPolicy={defaultPolicy}
            addLabel="Add to lineup"
            notInHeading="Not in the lineup"
            onBeforeMutate={pushLineupUndo}
            onNotice={setLineupNotice}
            notice={lineupNotice}
            controlsExtra={templatesControl}
          />

          {lineupRows.length > 0 && (
            <textarea className={styles.textarea} rows={2} value={lineupNotes}
              onChange={e => { setLineupNotes(e.target.value); setLineupDirty(true); }}
              placeholder="Lineup notes (opponent scouting, reminders) — can be printed on the dugout poster" maxLength={1000} style={{ marginTop: '1rem' }} />
          )}

          {lineupRows.length > 0 && (
            <div className={styles.attendanceFooter}>
              <div className={styles.lineupFooterTools}>
                <button type="button" className={styles.footerIconBtn} aria-label="Undo" title="Undo" disabled={lineupHistory.undo.length === 0} onClick={undoLineup}><Undo2 size={18} /></button>
                <button type="button" className={styles.footerIconBtn} aria-label="Redo" title="Redo" disabled={lineupHistory.redo.length === 0} onClick={redoLineup}><Redo2 size={18} /></button>
                <div className={styles.lineupPdfWrap} ref={pdfRef}>
                  <button type="button" className={styles.footerIconBtn} aria-label="Print" title="Print" disabled={lineupRows.length === 0}
                    onClick={() => { setLineupPdfOpen(v => !v); setTemplatesOpen(false); }} aria-expanded={lineupPdfOpen}>
                    <Printer size={18} />
                  </button>
                  {lineupPdfOpen && (
                    <div className={styles.lineupPdfMenu}>
                      <button type="button" className={styles.lineupPdfItem} onClick={handleLineupPoster}>
                        <strong>Dugout poster</strong>
                        <span>Positions by {sportPack.periodLabel.toLowerCase()} — blank boxes to pen in at the field</span>
                      </button>
                      <button type="button" className={styles.lineupPdfItem} onClick={handleBattingCard}>
                        <strong>Batting order card</strong>
                        <span>Large-type order for the scorekeeper or dugout</span>
                      </button>
                      {lineupNotes.trim() && (
                        <label className={styles.lineupPdfNotesToggle}>
                          <input type="checkbox" checked={pdfIncludeNotes} onChange={e => setPdfIncludeNotes(e.target.checked)} />
                          <span>Print lineup notes on the poster</span>
                        </label>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <span className={styles.saveStatus} aria-live="polite">
                {lineupError
                  ? <button type="button" className={styles.saveRetry} onClick={handleLineupSave}>Couldn’t save · Retry</button>
                  : (lineupSaving || lineupDirty) ? 'Saving…' : <><Check size={13} /> Saved</>}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
