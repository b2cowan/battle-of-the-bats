'use client';
import { use, useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useDismissable } from '@/lib/overlay-hooks';
import { ListOrdered, CalendarDays, X, Undo2, Redo2, Printer } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import CoachNotOnTeam from '@/components/coaches/CoachNotOnTeam';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import { useOrg } from '@/lib/org-context';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import UnsavedChangesGuard from '@/components/coaches/UnsavedChangesGuard';
import SaveStatusPill from '@/components/coaches/SaveStatusPill';
import { getSportPack, DEFAULT_SPORT } from '@/lib/sports';
import { normalizeRulesOverride } from '@/lib/lineup-caps';
import type { PositionPolicy } from '@/lib/lineup-generator';
import {
  downloadLineupPoster, downloadBattingOrderCard, buildPositionLegend, buildFilename,
  fetchResolvedPdfSettings, DEFAULT_PDF_SETTINGS, type OrgPdfSettings, type LineupPosterPlayer, type LineupPosterOrientation,
} from '@/lib/export';
import { playerDisplayName, playerName } from '@/lib/coach-roster-name';
import { formatInOrgZone } from '@/lib/timezone';
import {
  LINEUP_POSITIONS, buildLineupRows, renumberBattingOrder, sortLineupRows, type LineupPlayerRow,
} from '@/lib/lineup-grid';
import { analyzeLineup } from '@/lib/lineup-analysis';
import LineupEditor from '../_LineupEditor';
import styles from '../../../../coaches.module.css';
import type {
  LineupSettings, LineupRulesOverride,
  RepAttendanceStatus, RepLineupMode, RepRosterPlayer, RepTeamEvent, RepTeamEventAttendance,
  RepTeamLineup, RepTeamLineupEntry, RepTeamLineupTemplate, RepProgramYear,
} from '@/lib/types';

// ⚠ Both format in the ORG's zone (corrected 2026-08-16), matching the Lineups hub next door.
// These were bare `toLocaleDateString` / `toLocaleTimeString` calls — the reader's clock, not the
// field's — which is precisely what `lib/timezone.ts` was written to stop. `startsAt` is a stored
// instant, so a coach reading this from another province was told the wrong start time, and the
// same string is stamped onto the printed lineup poster and the batting-order card.
function fmtDate(iso: string) {
  return formatInOrgZone(iso, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtTime(iso: string) {
  return formatInOrgZone(iso, { hour: 'numeric', minute: '2-digit' });
}
function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

// The poster's turn is a PER-DEVICE preference, not a per-lineup fact: a clipboard coach picks
// portrait once and never sees landscape again unless they ask (owner decision D1, 2026-09-19).
// First-time default is portrait (D2) — most coaches carry a clipboard, and the taller rows are
// the better pen sheet at seven or nine innings. Same store as the library sort order: local to
// the browser, read once on mount, and the sheet still prints if storage is unavailable.
const POSTER_ORIENTATION_KEY = 'flhq-coach-poster-orientation';
function readPosterOrientation(): LineupPosterOrientation {
  try { return localStorage.getItem(POSTER_ORIENTATION_KEY) === 'landscape' ? 'landscape' : 'portrait'; } catch { return 'portrait'; }
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
  const lineupHelpRequest = {
    module: 'coaches' as const,
    sectionIds: ['premium-lineups'],
    fullGuideHref: `/${orgSlug}/coaches/help#premium-lineups`,
  };

  const [event, setEvent] = useState<RepTeamEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [lineupMode, setLineupMode] = useState<RepLineupMode>('everyone_bats');
  const [lineupInningCount, setLineupInningCount] = useState(sportPack.defaultPeriodCount);
  const [lineupNotes, setLineupNotes] = useState('');
  const [lineupRows, setLineupRows] = useState<LineupPlayerRow[]>([]);
  const [lineupPdfOpen, setLineupPdfOpen] = useState(false);
  const [pdfIncludeNotes, setPdfIncludeNotes] = useState(false);
  const [posterOrientation, setPosterOrientation] = useState<LineupPosterOrientation>('portrait');
  // Read after mount — storage is a per-viewer convenience the server cannot see, so the first
  // client render must match the server's; the remembered turn arrives one commit later, long
  // before the Print menu can open. Once per mount, cannot cascade — the library sort's shape.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPosterOrientation(readPosterOrientation());
  }, []);
  function choosePosterOrientation(next: LineupPosterOrientation) {
    setPosterOrientation(next);
    try { localStorage.setItem(POSTER_ORIENTATION_KEY, next); } catch { /* no storage — this print still uses the choice */ }
  }
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
  // Persisted Draft/Ready (mig 304, Phase 2 D1) — the honest badge shown outside the builder.
  // Every ordinary save resets this to 'draft' server-side; markLineupDirty() mirrors that locally
  // the instant an edit happens, so the UI never shows "Ready" for the ~900ms until autosave lands.
  const [lineupStatus, setLineupStatus] = useState<'draft' | 'ready'>('draft');
  const [lineupReadyAt, setLineupReadyAt] = useState<string | null>(null);
  const [markingReady, setMarkingReady] = useState(false);
  const [readyError, setReadyError] = useState('');
  function markLineupDirty() {
    setLineupDirty(true);
    setLineupStatus('draft');
  }

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
    markLineupDirty();
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

  // Team-resolved PDF settings (D4: team accent/branding win over the club's) — optional;
  // poster falls back to defaults. Cleanup-guarded so a slow response for a previous team
  // can never land as this team's branding.
  useEffect(() => {
    let cancelled = false;
    void fetchResolvedPdfSettings(`/api/coaches/${orgSlug}/teams/${teamId}/pdf-settings`)
      .then(s => { if (!cancelled) setPdfSettings(s); });
    return () => { cancelled = true; };
  }, [orgSlug, teamId]);

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
      setLineupStatus(data.lineup?.status ?? 'draft');
      setLineupReadyAt(data.lineup?.readyAt ?? null);
      setReadyError('');
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
  // Two popovers, two boundaries, one dismiss — a tap outside BOTH closes both.
  const templatesRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<HTMLDivElement>(null);
  useDismissable(
    templatesOpen || lineupPdfOpen,
    [templatesRef, pdfRef],
    () => { setTemplatesOpen(false); setLineupPdfOpen(false); },
  );

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
    markLineupDirty();
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
    markLineupDirty();
  }
  function removePlayersFromLineup(ids: string[]) {
    const idSet = new Set(ids);
    if (!lineupRows.some(r => idSet.has(r.player.id))) return;
    pushLineupUndo();
    setLineupRows(rows => renumberBattingOrder(rows.filter(r => !idSet.has(r.player.id)), lineupMode));
    markLineupDirty();
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

  // A dirty grid is saved first — marking ready must check the lineup as it IS, not as it was
  // before the coach's last few taps (same reasoning as the practice plan's "Send to staff").
  async function handleMarkReady() {
    if (markingReady) return;
    setMarkingReady(true);
    setReadyError('');
    try {
      if (lineupDirty) {
        const saved = await handleLineupSave();
        if (!saved) { setReadyError('Save the lineup before marking it ready.'); return; }
      }
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${eventId}/lineup`, { method: 'PATCH' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? 'Could not mark this lineup ready');
      setLineupStatus('ready');
      setLineupReadyAt(d.lineup?.readyAt ?? new Date().toISOString());
    } catch (e: unknown) {
      setReadyError(errorMessage(e, 'Could not mark this lineup ready'));
    } finally {
      setMarkingReady(false);
    }
  }

  function buildPosterOptions() {
    if (!event || lineupRows.length === 0) return null;
    const settings: OrgPdfSettings = { ...DEFAULT_PDF_SETTINGS, ...(pdfSettings && Object.keys(pdfSettings).length > 0 ? pdfSettings : {}) };
    const players: LineupPosterPlayer[] = sortLineupRows(lineupRows).map(row => {
      const isSub = lineupMode === 'nine_player' && !row.starter;
      return {
        battingOrder: isSub ? '' : row.battingOrder,
        number: row.player.playerNumber ? String(row.player.playerNumber) : '',
        name: playerName(row.player),
        isSub,
        inningPositions: row.inningPositions,
      };
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
      orientation: posterOrientation,
      orderLabel: sportPack.orderLabel,
      includeNotes: pdfIncludeNotes,
      notes: lineupNotes,
      // The whole resolved identity — crest, club name, footer, date stamp — not just the
      // accent. This screen always fetched all of it; the poster and card simply had nowhere
      // to put it, which is why they were the only paper in the product with no crest on it.
      settings,
    };
  }
  // Print preflight (plan §5.5): a still-open lineup can still be printed, but the coach is told
  // exactly which roles are open first rather than discovering blank boxes at the field. Only the
  // dugout poster shows field positions — the batting-order card is unaffected by an open role, so
  // it prints without this check.
  async function confirmPrintIfOpen(): Promise<boolean> {
    const printAnalysis = analyzeLineup(
      lineupRows.map(r => ({ playerId: r.player.id, inningPositions: r.inningPositions })),
      lineupInningCount, sportPack.fieldPositions,
    );
    if (!printAnalysis.hasConflicts && printAnalysis.missingFieldPositions.length === 0) return true;
    return confirm({
      title: 'Print with open roles?',
      message: printAnalysis.hasConflicts
        ? 'This lineup still has a position clash — the poster will print exactly what’s in the grid.'
        : `${printAnalysis.missingFieldPositions.length} ${sportPack.periodLabel.toLowerCase()}${printAnalysis.missingFieldPositions.length === 1 ? '' : 's'} still ${printAnalysis.missingFieldPositions.length === 1 ? 'has' : 'have'} an open role: ${printAnalysis.missingFieldPositions.map(m => `${sportPack.periodLabel} ${m.inning} (${m.positions.join(', ')})`).join(' · ')}. The poster will print those cells blank.`,
      confirmText: 'Print anyway', cancelText: 'Keep working', tone: 'warning',
    });
  }
  async function handleLineupPoster() {
    const opts = buildPosterOptions();
    if (!opts || !event) return;
    if (!(await confirmPrintIfOpen())) return;
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
    return <CoachNotOnTeam />;
  }

  const gameTitle = event
    ? (event.opponent ? `${event.homeAway === 'away' ? '@' : 'vs'} ${event.opponent}` : event.name || 'Game')
    : 'Lineup';
  const gameMeta = event && event.startsAt ? `${fmtDate(event.startsAt)} · ${fmtTime(event.startsAt)}` : '';
  const defaultPolicy: PositionPolicy = event?.eventType === 'tournament_game' ? 'competitive'
    : event?.eventType === 'scrimmage' ? 'development' : 'balanced';

  // Page-header ruling 2026-08-11: the meta row is BODY content — it renders below the header
  // block, not inside it — and the builder gains the help "?" its practice-plan twin already had.
  const header = (
    <>
      <CoachPageHeader
        icon={ListOrdered}
        title={gameTitle}
        helpLabel="Lineup builder"
        help={lineupHelpRequest}
        backTo={{ href: `${base}/lineups`, label: 'All lineups' }}
      />
      <div className={styles.pageSummaryStrip}>
        <span className={styles.lineupMetaText}>{gameMeta || 'Set the batting order and field positions for this game.'}</span>
        {event && (
          <Link href={`${base}/schedule?event=${eventId}`} className={styles.lineupOnScheduleLink}>
            <CalendarDays size={12} aria-hidden /> View on schedule
          </Link>
        )}
      </div>
    </>
  );

  if (!canLineups) {
    return (
      <div className={`${styles.page} ${styles.pageWide}`}>
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

  // ⚠ THE ATTENDANCE RAIL WAS REMOVED HERE (owner, 2026-08-13) — it showed an In / Out / No-reply
  // headcount beside the grid. What still reports attendance on this page is the mismatch strip
  // above, and it reports the two states that need a DECISION: marked in but unplaced, and placed
  // but marked Out. A player who is Out and also not in the lineup needs nothing done, which is
  // why counting them earned less than the 300px it cost. Attendance is still edited on the
  // Schedule; this page has only ever read it.

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

  // Undo / Redo / Print + Templates — ALL of the editor's surface-specific extras, together in the
  // toolbar (owner, 2026-09-18). Undo/Redo/Print used to live in a bar docked to the viewport; that
  // bar is retired (the same "a docked bar is only earned by real content" ruling the practice plan
  // and the schedule's attendance list already followed on 2026-09-14) now that these three become
  // ordinary toolbar buttons and the save word floats as the same pill every other coach screen
  // uses. Print reuses the auto-fill/Templates popover recipe (`lineupAutoWrap`/`lineupAutoMenu`)
  // rather than a bar-specific menu of its own.
  const toolbarExtras = (
    <>
      <button type="button" className={styles.footerIconBtn} aria-label="Undo" title="Undo" disabled={lineupHistory.undo.length === 0} onClick={undoLineup}><Undo2 size={18} /></button>
      <button type="button" className={styles.footerIconBtn} aria-label="Redo" title="Redo" disabled={lineupHistory.redo.length === 0} onClick={redoLineup}><Redo2 size={18} /></button>
      <div className={styles.lineupAutoWrap} ref={pdfRef}>
        <button type="button" className={styles.footerIconBtn} aria-label="Print" title="Print" disabled={lineupRows.length === 0}
          onClick={() => { setLineupPdfOpen(v => !v); setTemplatesOpen(false); }} aria-expanded={lineupPdfOpen}>
          <Printer size={18} />
        </button>
        {lineupPdfOpen && (
          <div className={styles.lineupAutoMenu}>
            {/* ONE document with a turn, not two documents (owner D1, 2026-09-19): the row prints,
                the switch beneath it picks the sheet's orientation and remembers it on this device.
                The portal's own segmented control (segChoice) as a pair of pressed/unpressed toggle
                buttons — two Tab stops that read their state, no arrow-key contract. It sits BESIDE
                the row's button rather than inside it — a button cannot hold buttons. */}
            <div className={styles.lineupPdfPoster}>
              <button type="button" className={styles.lineupPdfItem} onClick={handleLineupPoster}>
                <strong>Dugout poster</strong>
                <span>Positions by {sportPack.periodLabel.toLowerCase()} — blank cells to pen in at the field</span>
              </button>
              <div className={`${styles.segChoice} ${styles.lineupPdfOrient}`} role="group" aria-label="Poster orientation">
                <button type="button" aria-pressed={posterOrientation === 'landscape'} className={`${styles.segBtn} ${posterOrientation === 'landscape' ? styles.segBtnActive : ''}`} onClick={() => choosePosterOrientation('landscape')}>Landscape · wall</button>
                <button type="button" aria-pressed={posterOrientation === 'portrait'} className={`${styles.segBtn} ${posterOrientation === 'portrait' ? styles.segBtnActive : ''}`} onClick={() => choosePosterOrientation('portrait')}>Portrait · clipboard</button>
              </div>
            </div>
            <button type="button" className={styles.lineupPdfItem} onClick={handleBattingCard}>
              <strong>{sportPack.orderLabel} card</strong>
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
      {templatesControl}
    </>
  );

  return (
    // .savePillPage reserves room for the floating SaveStatusPill so it never overlaps the
    // grid's last row or the notes field.
    <div className={`${styles.page} ${styles.pageWide} ${lineupRows.length > 0 ? styles.savePillPage : ''}`}>
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
            onRowsChange={updater => { setLineupRows(updater); markLineupDirty(); }}
            lineupMode={lineupMode}
            onLineupModeChange={m => { setLineupMode(m); markLineupDirty(); }}
            inningCount={lineupInningCount}
            onInningCountChange={n => { setLineupInningCount(n); markLineupDirty(); }}
            sportPack={sportPack}
            seasonCaps={lineupSeasonCaps}
            gameRules={gameRules}
            onGameRulesChange={g => { setGameRules(g); markLineupDirty(); }}
            defaultPolicy={defaultPolicy}
            addLabel="Add to lineup"
            notInHeading="Not in the lineup"
            onBeforeMutate={pushLineupUndo}
            onNotice={setLineupNotice}
            notice={lineupNotice}
            controlsExtra={toolbarExtras}
            readyState={{
              status: lineupStatus,
              readyAtLabel: lineupReadyAt ? formatInOrgZone(lineupReadyAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null,
              onMarkReady: handleMarkReady,
              marking: markingReady,
              error: readyError || undefined,
            }}
          />

          {lineupRows.length > 0 && (
            <textarea className={styles.textarea} rows={2} value={lineupNotes}
              onChange={e => { setLineupNotes(e.target.value); markLineupDirty(); }}
              placeholder="Lineup notes (opponent scouting, reminders) — can be printed on the dugout poster" maxLength={1000} style={{ marginTop: '1rem' }} />
          )}

          {/* The autosave word floats at the window's foot (owner, 2026-09-18) — Undo, Redo and
              Print now live in the toolbar above, so this bar would otherwise hold nothing but
              the save word, which is exactly the shape the practice plan, the plan-template
              editor and the schedule's attendance list already carry as a pill (2026-09-14). */}
          {lineupRows.length > 0 && (
            <SaveStatusPill saving={lineupSaving} dirty={lineupDirty} error={lineupError} onRetry={handleLineupSave} />
          )}
        </>
      )}
    </div>
  );
}
