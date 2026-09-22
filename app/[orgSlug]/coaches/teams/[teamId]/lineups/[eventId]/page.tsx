'use client';
import { use, useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useDismissable } from '@/lib/overlay-hooks';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { ListOrdered, CalendarDays, Undo2, Redo2, Printer, LayoutTemplate } from 'lucide-react';
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
import { playerName } from '@/lib/coach-roster-name';
import { formatInOrgZone } from '@/lib/timezone';
import {
  LINEUP_POSITIONS, buildLineupRows, renumberBattingOrder, sortLineupRows, type LineupPlayerRow,
} from '@/lib/lineup-grid';
import { analyzeLineup } from '@/lib/lineup-analysis';
import { gameHasStarted } from '@/lib/coach-game-day';
import { safeReturnPath, returnLabel } from '@/lib/development-address';
import { SCRIMMAGE_LABEL } from '@/lib/coach-schedule-vocab';
import { sideWord } from '@/lib/coach-tournament-games';
import { useMinuteClock } from '@/lib/use-minute-clock';
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
// The meta line's date in two parts — the day and the year — so a phone can drop the year (stage
// 3 · D4: the Schedule's rows never carry it and the season has one; at 360 it was what wrapped
// "View on schedule" onto a 44px line of its own). Joined, the two read exactly as `fmtDate`.
function fmtDay(iso: string) {
  return formatInOrgZone(iso, { weekday: 'short', month: 'short', day: 'numeric' });
}
function fmtYear(iso: string) {
  return formatInOrgZone(iso, { year: 'numeric' });
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
  const searchParams = useSearchParams();
  const { assignments, loading: ctxLoading } = useCoaches();
  // The phone's tool row (stage 3 · D2) differs from the desktop's toolbar in structure, so the DOM
  // decides; the editor beneath makes the same call for its own forms.
  const isPhone = useIsPhone();
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
  // Before game time every ordinary save resets this to 'draft' server-side; markLineupDirty()
  // mirrors that locally the instant an edit happens, so the UI never shows "Ready" for the ~900ms
  // until autosave lands. At or after game time (D11d) neither side resets it: the edit is the
  // game, not a reopened plan — the same clock the server reads (`gameHasStarted`), read here to
  // the minute so a tab left open through first pitch changes its mind at the right moment.
  const [lineupStatus, setLineupStatus] = useState<'draft' | 'ready'>('draft');
  const [lineupReadyAt, setLineupReadyAt] = useState<string | null>(null);
  const [markingReady, setMarkingReady] = useState(false);
  const [readyError, setReadyError] = useState('');
  const nowMs = useMinuteClock();
  const gameStarted = !!event && gameHasStarted(event, nowMs);
  function markLineupDirty() {
    setLineupDirty(true);
    if (!gameStarted) setLineupStatus('draft');
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

  /**
   * ⚠ Every lineup PUT from this page goes through ONE promise chain (the Game-Day console's own
   * guard, `/review` 2026-08-04; found missing HERE by `/review` 2026-09-20 on D11): two PUTs have
   * no server-side ordering, and Mark ready used to fire its own save while the debounced autosave
   * could still be in flight — the earlier PUT then landed AFTER the PATCH and reset the row the
   * coach had just marked to Draft, in front of them. Chained, the mark waits for every save that
   * was already going, and the newest body always writes last.
   */
  const saveChainRef = useRef<Promise<boolean>>(Promise.resolve(true));
  function handleLineupSave(): Promise<boolean> {
    const run = () => saveLineupNow();
    const next = saveChainRef.current.then(run, run);
    saveChainRef.current = next;
    return next;
  }
  async function saveLineupNow(): Promise<boolean> {
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
      const saved: { lineup?: { status?: 'draft' | 'ready'; readyAt?: string | null } } = await res.json().catch(() => ({}));
      // Both write-backs are signature-guarded: an edit made while this PUT was in flight has its
      // own save coming, and THAT response is the one that speaks for the grid as it is now.
      if (lineupSigRef.current === sigAtSave) {
        setLineupDirty(false);
        // The server decides what a save does to Ready (reset before game time, kept after) —
        // take its word so the strip never shows a status the row does not hold.
        if (saved.lineup?.status) { setLineupStatus(saved.lineup.status); setLineupReadyAt(saved.lineup.readyAt ?? null); }
      }
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
  // Either way the mark waits for the save chain, so a PUT that was already in flight can never
  // land after the PATCH and quietly undo it.
  async function handleMarkReady() {
    if (markingReady) return;
    setMarkingReady(true);
    setReadyError('');
    try {
      const saved = lineupDirty ? await handleLineupSave() : await saveChainRef.current.catch(() => false);
      if (!saved) { setReadyError('Save the lineup before marking it ready.'); return; }
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${eventId}/lineup`, { method: 'PATCH' });
      const d: { error?: string; lineup?: { status?: 'draft' | 'ready'; readyAt?: string | null } } = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? 'Could not mark this lineup ready');
      // The row as the server now holds it — the same trust the save path gives its response.
      setLineupStatus(d.lineup?.status ?? 'ready');
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
    ? (event.opponent ? `${sideWord(event.homeAway)} ${event.opponent}` : event.name || 'Game')
    : 'Lineup';
  // A scrimmage says so under the title — its game kind reads the same as any other Game now, so the
  // word is how a coach knows the auto-fill opened on Development for a reason.
  const gameMeta = event && event.startsAt
    ? <>{fmtDay(event.startsAt)}<span className={styles.lineupMetaYear}>, {fmtYear(event.startsAt)}</span> · {fmtTime(event.startsAt)}{event.isScrimmage ? ` · ${SCRIMMAGE_LABEL}` : ''}</>
    : null;
  // THE WAY BACK (stage 3 · D3, owner 2026-09-21: "back from the lineup must lead to the game, not
  // to Lineups"): the arrow returns to the door the builder was opened from — the game on the
  // Schedule (its sheet open on Lineup), the game-day console, the Overview — through the portal's
  // `return` convention (the player page's way back to Skills & Goals): the address carries it,
  // `safeReturnPath` drops anything outside this team's portal, `returnLabel` names it by where
  // it goes. A foreign or missing address falls back to All lineups, which is what the room's
  // rows send. Save, Mark ready and the autosave never navigate.
  const returnTo = safeReturnPath(searchParams.get('return'), base);
  const returnName = returnTo ? returnLabel(returnTo, base) : null;
  const backTo = returnTo && returnName ? { href: returnTo, label: returnName } : { href: `${base}/lineups`, label: 'All lineups' };
  // The box first, then the kind: a scrimmage (a Game with "This is a scrimmage" ticked) opens on
  // Development, a tournament game on Competitive, any other game on Balanced.
  const defaultPolicy: PositionPolicy = event?.isScrimmage ? 'development'
    : event?.eventType === 'tournament_game' ? 'competitive' : 'balanced';

  // Page-header ruling 2026-08-11: the meta row is BODY content — it renders below the header
  // block, not inside it — and the builder gains the help "?" its practice-plan twin already had.
  const header = (
    <>
      <CoachPageHeader
        icon={ListOrdered}
        title={gameTitle}
        helpLabel="Lineup builder"
        help={lineupHelpRequest}
        backTo={backTo}
      />
      <div className={styles.pageSummaryStrip}>
        <span className={styles.lineupMetaText}>{gameMeta ?? 'Set the batting order and field positions for this game.'}</span>
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
  // headcount beside the grid. What still reports attendance on this page is the editor's status
  // strip and the Lineup check behind it (the mismatch strip that stood here went into that check
  // on 2026-09-18), and it reports the two states that need a DECISION: marked in but unplaced,
  // and placed but marked Out. A player who is Out and also not in the lineup needs nothing done,
  // which is why counting them earned less than the 300px it cost. Attendance is still edited on
  // the Schedule; this page has only ever read it.

  // The Templates popover, injected into the editor's controls row via `controlsExtra`.
  // On a phone the trigger is a fourth `footerIconBtn` (stage 3 · D2) — a glyph BUTTON opening
  // exactly this panel, NOT a `CoachToolbarMenu`: the panel is a FORM (an input and a save
  // button) and nothing in it is checked (a lineup does not remember its template).
  // ⚠ NO DELETE HERE (owner, 2026-09-22). This panel does exactly two things — start FROM a saved
  // template, save this lineup AS one. Deleting, renaming, editing and applying a template all live
  // in the Templates tab of the Lineups room (`_LineupTemplatesView`), which is where the help
  // already sends coaches. A destructive glyph pinned to the edge of the row you are trying to TAP
  // is a mis-tap waiting to happen, and on a phone the row IS the tap target.
  const templatesControl = (
    <div className={styles.lineupAutoWrap} ref={templatesRef}>
      {isPhone ? (
        <button type="button" className={styles.footerIconBtn} aria-label="Templates" title="Templates" disabled={lineupRows.length === 0}
          onClick={() => { setTemplatesOpen(v => !v); setTemplateError(''); setLineupPdfOpen(false); }} aria-expanded={templatesOpen}>
          <LayoutTemplate size={18} />
        </button>
      ) : (
        <button type="button" className={styles.btnSecondary} disabled={lineupRows.length === 0}
          onClick={() => { setTemplatesOpen(v => !v); setTemplateError(''); setLineupPdfOpen(false); }} aria-expanded={templatesOpen}>
          Templates ▾
        </button>
      )}
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
  // On a phone these are squares in ONE flex row (stage 3 · D2, owner ruling — B: after the Setup
  // row, directly above the list): tools, not header actions — they act on the grid and the page
  // creates nothing, so the page-actions guard's `actions: null` stays true. The ROW itself is
  // built by the editor, which adds its own Clear as the last square (owner, 2026-09-22) — these
  // four are handed over bare.
  const lineupTools = (
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
    // grid's last row or the notes field while the word is up.
    <div className={`${styles.page} ${styles.pageWide} ${lineupRows.length > 0 ? styles.savePillPage : ''}`}>
      {header}
      <UnsavedChangesGuard active={lineupDirty} />

      {loading ? (
        <div className={styles.loadingState}>Loading lineup…</div>
      ) : loadError ? (
        <p className={styles.errorText}>{loadError}</p>
      ) : (
        <>
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
            controlsExtra={lineupTools}
            attendance={{
              comingNotInLineup: comingNotInLineup.map(r => r.player),
              outButInLineup: outButInLineup.map(r => r.player),
              onAddComing: () => addPlayersToLineup(comingNotInLineup.map(r => r.player.id)),
              onRemoveOut: () => removePlayersFromLineup(outButInLineup.map(r => r.player.id)),
            }}
            readyState={{
              status: lineupStatus,
              readyAtLabel: lineupReadyAt ? formatInOrgZone(lineupReadyAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null,
              onMarkReady: handleMarkReady,
              marking: markingReady,
              error: readyError || undefined,
              gameStarted,
            }}
          />

          {lineupRows.length > 0 && (
            <textarea className={styles.textarea} rows={2} value={lineupNotes}
              onChange={e => { setLineupNotes(e.target.value); markLineupDirty(); }}
              placeholder="Lineup notes (opponent scouting, reminders) — can be printed on the dugout poster" maxLength={1000} style={{ marginTop: '1rem' }} />
          )}

          {/* The autosave word, a transient pill at the window's foot (owner 2026-09-20, revising
              that morning's title-row home: the title row is pinned nowhere, so the word scrolled
              away exactly when a coach deep in the grid wanted it). It appears on an edit, says
              "Saved" and fades; only an error stays. */}
          {lineupRows.length > 0 && (
            <SaveStatusPill saving={lineupSaving} dirty={lineupDirty} error={lineupError} onRetry={handleLineupSave} />
          )}
        </>
      )}
    </div>
  );
}
