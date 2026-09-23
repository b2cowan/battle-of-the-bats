'use client';
/**
 * Game-Day Mode P1 — the bench console (plan: COACH_GAME_DAY_MODE_PLAN.md §3, owner-approved
 * mockups artifact 46d0fa8b, rev 3). One phone screen for running a game: the matchup + score +
 * period cursor, the board (On field / Bench for the current period), tap-to-substitute, the
 * Who's here sheet, quiet running-score saves, and the End-game wrap. Afterwards — and at this
 * URL any time outside the live window — the same screen is a read-only recap. Never a 404.
 *
 * ── D4, BY CONSTRUCTION ─────────────────────────────────────────────────────────────────────
 * Nothing new is recorded at the field. A substitution edits `inning_positions` on the one
 * lineup that already exists, through the EXISTING lineup PUT (same debounce, same full-replace
 * contract as the builder). Attendance rides the existing batch PATCH; the score rides the
 * existing events PATCH with the server-checked `quiet` flag. Close the tab in the 4th and the
 * grid simply keeps the plan for the rest — indistinguishable from never opening this screen.
 *
 * ── Practice-run bans carried over ──────────────────────────────────────────────────────────
 * No swipe/drag/long-press (gloves defeat them; swipe collides with browser back), no sound or
 * vibration, no auto-advance. The period cursor is a sessionStorage UI preference, exactly like
 * the practice station pick — never persisted server-side, because "which column is
 * highlighted" is not a fact about the game.
 *
 * ⚠ The wake-lock ban does NOT carry over (owner ruling 2026-08-05, P3): the run screen is a
 * plan you read and put down; this is a screen you glance at between pitches for two hours.
 * It is live-window-only, drive-grants-only, and ALWAYS visible as a chip you can switch off in
 * one tap — a screen that refuses to sleep without saying so reads as a broken phone.
 *
 * ── P3 (owner-ruled 2026-08-05) ─────────────────────────────────────────────────────────────
 * The bench sorts longest-sitting first, and the order FREEZES until the period cursor moves
 * (`benchOrderIds` / `applyBenchOrder`) — a list that re-shuffles between the moment a coach
 * looks and the moment they tap is how the wrong child gets sent in. The arm-care chip resolves
 * the cap the way the builder does (per-player ?? game override ?? season default). Neither
 * adds a write, a request, or an optimistic update; both are derived from state already here.
 *
 * ── Who drives (plan §6) ────────────────────────────────────────────────────────────────────
 * Zone by zone from the caller's existing grants — subs on `lineups`, Who's here on
 * `attendance`, score + End game on `scheduleManage`. A schedule-only Helper gets the whole
 * board read-only with the practice screen's sentence pattern ("Your coach runs the bench."),
 * never a disabled button. On a tournament-mirrored game the score zone steps back ("Scored by
 * the tournament") and End game is absent — the organizer owns the result and its notification.
 */
import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Circle, Undo2, X } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import { hasNonMoneyRecordAccess } from '@/lib/coach-capabilities';
import { getSportPack, surfaceLabel, DEFAULT_SPORT } from '@/lib/sports';
import { lineupBuilderHref } from '@/lib/lineups-address';
import { analyzeLineup, BENCH_POSITION } from '@/lib/lineup-analysis';
import { generateBestLineup } from '@/lib/lineup-generator';
import { playerPositionPrefs } from '@/lib/lineup-profile';
import { playerDisplayName, playerName, isCallUp, CALL_UP_LABEL } from '@/lib/coach-roster-name';
import { ATTENDANCE_WORD } from '@/lib/coach-schedule-vocab';
import { insightsSectionHref } from '@/lib/coach-insights-links';
import { ATTENDANCE_OPTIONS } from '@/components/coaches/attendanceOptions';
import { LINEUP_POSITIONS, type LineupPlayerRow, type LineupSeedEntry } from '@/lib/lineup-grid';
import { ordinal } from '@/lib/playoff-bracket';
import {
  applyBenchOrder, applyConsoleSwap, benchOrderIds, benchOrderStillSorted, benchStreakThrough,
  consoleMode, deriveGameResult, gameDayPeriodKey, gameDaySkipLineupKey,
  toGameDayEventShape,
} from '@/lib/coach-game-day';
import { resolveLineupCaps, resolvePlayerPitcherCap } from '@/lib/lineup-caps';
import { useScreenWakeLock } from '@/lib/hooks/useScreenWakeLock';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { useDismissable } from '@/lib/overlay-hooks';
import { useBackStep } from '@/components/coaches/useBackStep';
import LineupPositionSheet from '@/components/coaches/LineupPositionSheet';
import SaveStatusPill from '@/components/coaches/SaveStatusPill';
import { GAME_MOMENT_MAX, sortMomentsNewestFirst } from '@/lib/coach-game-moments';
import { formatInOrgZone } from '@/lib/timezone';
import OpponentScoutingPanel from '@/components/coaches/OpponentScoutingPanel';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import { formatStoredClock } from '@/lib/utils';
import styles from '../../../../coaches.module.css';
import type {
  LineupSettings, RepAttendanceStatus, RepRosterPlayer, RepTeamEvent, RepTeamEventAttendance,
  RepTeamGameMoment, RepTeamLineup, RepTeamLineupEntry,
} from '@/lib/types';

// ⚠ HARD REQUIREMENT (plan §3.5): the attendance control is the schedule tab's, verbatim —
// same four words, icons and order, from the ONE shared module (components/coaches/attendanceOptions).

/** A console grid row IS a lineup entry — the same shape the builder and templates share, so
 *  the compiler ties this page to the lineup PUT contract instead of a hand-kept copy. */
type GridRow = LineupSeedEntry;

interface ConsoleData {
  event: RepTeamEvent;
  lineup: RepTeamLineup | null;
  entries: RepTeamLineupEntry[];
  players: RepRosterPlayer[];
  attendance: RepTeamEventAttendance[];
  /** P2 — tonight's captured lines. Empty for anyone without a console drive grant (gated at
   *  the source in the read route, not here: `can` flags gate affordances, never data). */
  moments: RepTeamGameMoment[];
  /** P3 — this season's default caps; null when the caller has no lineup grant (gated at the
   *  source, like every other zone's payload). Resolved against the game's own override. */
  lineupSettings: LineupSettings | null;
  isMirrored: boolean;
  window: { opensAtMs: number; closesAtMs: number } | null;
  can: { subs: boolean; attendance: boolean; score: boolean; moments: boolean };
  headCoachName: string | null;
}

type SheetKind = null | 'score' | 'attendance' | 'book' | 'end' | 'moment';

export default function CoachGameConsolePage({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string; eventId: string }>;
}) {
  const { orgSlug, teamId, eventId } = use(paramsPromise);
  const { assignments } = useCoaches();
  const assignment = assignments.find(a => a.teamId === teamId);
  const sportPack = getSportPack(assignment?.teamSport ?? DEFAULT_SPORT);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  const [data, setData] = useState<ConsoleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const restoredRef = useRef(false);

  // "Live" is re-derived from the clock, not stored — a console left open past the window's
  // close quietly becomes the recap on the next tick instead of offering writes time has closed.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const [rows, setRows] = useState<GridRow[]>([]);
  const [lineupMeta, setLineupMeta] = useState<{ mode: string; inningCount: number; notes: string }>(
    { mode: 'everyone_bats', inningCount: sportPack.defaultPeriodCount, notes: '' },
  );
  const [period, setPeriod] = useState(1);
  const [periodAtOpen, setPeriodAtOpen] = useState<number | null>(null);
  /** P3 — the bench order as it was when this period started (see the board's `benched`). */
  const [benchOrder, setBenchOrder] = useState<{ period: number; ids: string[] } | null>(null);
  const [skipLineup, setSkipLineup] = useState(false);

  const [teamScore, setTeamScore] = useState<number | null>(null);
  const [oppScore, setOppScore] = useState<number | null>(null);
  /**
   * Attendance carries the NOTE as well as the status, even though this console has no note
   * UI — the attendance PATCH is a full-row upsert, so a tap that sent `{playerId, status}`
   * alone would silently null a note a coach recorded on the schedule tab ("epi-pen in bag").
   * The console must hand back what it was given (/review 2026-08-04, Critical).
   */
  const [att, setAtt] = useState<Record<string, { status: RepAttendanceStatus; note: string | null }>>({});
  /** Latest-write-wins guard for optimistic attendance: a FAILED earlier tap must not roll
   *  back a later tap on the same player that already succeeded. */
  const attSeqRef = useRef(new Map<string, number>());

  /**
   * P2 — moments. Held apart from every other piece of state on this screen on purpose: no
   * derived value below reads `moments`, nothing in the lineup PUT body or the score PATCH
   * touches it, and removing this block would leave the console's behaviour identical. That
   * separation IS the D4 test, expressed in the component.
   */
  const [moments, setMoments] = useState<RepTeamGameMoment[]>([]);
  const [momentBody, setMomentBody] = useState('');
  const [momentPlayerId, setMomentPlayerId] = useState<string | null>(null);
  const [momentSaving, setMomentSaving] = useState(false);
  const [momentError, setMomentError] = useState('');
  /** Counts THIS sitting, not the night — the scouting book's "add another?" idiom, verbatim. */
  const [momentSavedCount, setMomentSavedCount] = useState(0);
  const momentInputRef = useRef<HTMLTextAreaElement | null>(null);

  const [sheet, setSheet] = useState<SheetKind>(null);
  const [subInId, setSubInId] = useState<string | null>(null);
  const [coverFor, setCoverFor] = useState<{ playerId: string; position: string } | null>(null);
  /** `fromPeriod` is FROZEN at the moment the decision sheet opens — the board stays live
   *  underneath (deliberately non-modal), so the apply step re-validates against current
   *  state rather than trusting what was true when the sheet opened. */
  const [pendingSwap, setPendingSwap] =
    useState<{ inId: string; outId: string | null; position: string | null; fromPeriod: number } | null>(null);

  const [subCount, setSubCount] = useState(0);
  const [attChangeCount, setAttChangeCount] = useState(0);
  const [ended, setEnded] = useState(false);
  const [endSaving, setEndSaving] = useState(false);
  const [endError, setEndError] = useState('');
  const [finalTeam, setFinalTeam] = useState('');
  const [finalOpp, setFinalOpp] = useState('');

  // Lineup autosave — the builder's exact contract: 0.9s debounce, full-replace PUT,
  // Saving…/Saved/Couldn't save · Retry pill, undo.
  const [lineupDirty, setLineupDirty] = useState(false);
  const [lineupSaving, setLineupSaving] = useState(false);
  const [lineupError, setLineupError] = useState('');
  const [undoStack, setUndoStack] = useState<GridRow[][]>([]);

  // Score autosave — 10s debounce, `quiet: true` (server-checked; families hear once, at End game).
  const [scoreDirty, setScoreDirty] = useState(false);
  const [scoreSaving, setScoreSaving] = useState(false);
  const [scoreError, setScoreError] = useState('');

  const event = data?.event ?? null;
  const mirrored = data?.isMirrored ?? false;
  const can = data?.can ?? { subs: false, attendance: false, score: false, moments: false };
  const live = !ended && !!event && consoleMode(toGameDayEventShape(event), nowMs) === 'live';
  const readOnlyViewer = !can.subs && !can.attendance && !can.score;
  const periodLabel = sportPack.periodLabel;
  const inningCount = lineupMeta.inningCount;

  /**
   * P3 — settle the bench order for a period. THE ONLY WAY the bench re-sorts: called when the
   * board arrives, when a new board is seeded, and when the period cursor moves — never on a
   * substitution, which is the whole point (see the board's `benched`).
   */
  const freezeBenchOrder = useCallback((forRows: GridRow[], forPeriod: number) => {
    setBenchOrder({ period: forPeriod, ids: benchOrderIds(forRows, forPeriod) });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${eventId}/game-console`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Could not load this game.');
      const d = json as ConsoleData;
      setData(d);
      // ⚠ Filter saved entries to the ACTIVE roster (the builder gets this for free by seeding
      // from players): a player deactivated since the lineup was saved would otherwise ride
      // along into every full-replace PUT, which rejects non-roster players — poisoning EVERY
      // save for the rest of the game with the same 400 (/review 2026-08-04, Critical).
      const activeIds = new Set(d.players.map(p => p.id));
      const loadedRows = d.entries.filter(e => activeIds.has(e.playerId)).map(e => ({
        playerId: e.playerId, battingOrder: e.battingOrder, starter: e.starter,
        inningPositions: { ...e.inningPositions }, notes: e.notes,
      }));
      setRows(loadedRows);
      const count = d.lineup?.inningCount ?? sportPack.defaultPeriodCount;
      setLineupMeta({
        mode: d.lineup?.lineupMode ?? 'everyone_bats',
        inningCount: count,
        notes: d.lineup?.notes ?? '',
      });
      setTeamScore(d.event.teamScore ?? null);
      setOppScore(d.event.opponentScore ?? null);
      setAtt(Object.fromEntries(d.attendance.map(a => [a.playerId, { status: a.status, note: a.note ?? null }])));
      setMoments(sortMomentsNewestFirst(d.moments ?? []));
      // Restore the UI prefs ONCE per mount — `load` can legitimately re-run (the sport pack
      // resolving flips its dependency), and a second pass must not discard a period tap the
      // coach made in between (practice-run `restoredRef` precedent).
      if (!restoredRef.current) {
        restoredRef.current = true;
        let initial = 1;
        try {
          const saved = Number(sessionStorage.getItem(gameDayPeriodKey(eventId)) ?? '');
          if (Number.isInteger(saved) && saved >= 1 && saved <= count) initial = saved;
          setSkipLineup(sessionStorage.getItem(gameDaySkipLineupKey(eventId)) === '1');
        } catch { /* private mode — defaults stand */ }
        setPeriod(initial);
        setPeriodAtOpen(prev => prev ?? initial);
        // The board's first arrival. (A later re-load keeps the order already frozen for this
        // period; the rows changed, the period did not.)
        freezeBenchOrder(loadedRows, initial);
      }
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : 'Could not load this game.');
    } finally {
      setLoading(false);
    }
  }, [orgSlug, teamId, eventId, sportPack.defaultPeriodCount, freezeBenchOrder]);

  useEffect(() => { void load(); }, [load]);

  const setCursor = (next: number) => {
    const clamped = Math.min(Math.max(next, 1), inningCount);
    setPeriod(clamped);
    // Moving the cursor is the one moment a coach expects the board to change under them.
    freezeBenchOrder(rows, clamped);
    try { sessionStorage.setItem(gameDayPeriodKey(eventId), String(clamped)); } catch { /* UI pref only */ }
  };

  // ── The screen stays on, silently (owner ruling 2026-09-22, console re-draw · G4) ──────────
  // The policy still lives HERE — live window only, drive grants only — and the hook only holds
  // the lock. Review mode never keeps a screen awake, and neither does a helper's console.
  //
  // ⚠ THE "SCREEN STAYING ON" CHIP IS GONE, and with it the 2026-08-05 rule that a screen which
  // refuses to sleep must always say so. That rule was retired on its own merits, not for space:
  // a wake lock defers the IDLE timeout and nothing else, so the power button still sleeps the
  // handset, and the browser releases the lock the moment the tab hides (see the hook) — so a
  // pocketed phone sleeps normally and nothing was ever trapped awake. The chip was a 44px
  // button among 26px chips, which cost the chip row a second line on the most crowded screen in
  // the portal. The honesty moved to the help article, where it answers the question a coach
  // actually asks ("why does my screen keep turning off?").
  useScreenWakeLock(live && !readOnlyViewer);

  // ── Lineup save (the builder's PUT, verbatim contract) ────────────────────────────────────
  const lineupPutBody = useCallback((currentRows: GridRow[]) => JSON.stringify({
    lineupMode: lineupMeta.mode,
    inningCount: lineupMeta.inningCount,
    notes: lineupMeta.notes,
    entries: currentRows.map(r => ({
      playerId: r.playerId, battingOrder: r.battingOrder, starter: r.starter,
      inningPositions: r.inningPositions, notes: r.notes ?? '',
    })),
  }), [lineupMeta]);

  /**
   * ⚠ Two guards the builder's autosave taught us the hard way (/review 2026-08-04, High):
   *  · SIGNATURE-GUARDED dirty clear — an edit made while a PUT is in flight re-dirties the
   *    grid, and the completing save must not wipe that flag (the newer edit would then never
   *    save, and End game's `if (lineupDirty)` flush would skip it: a substitution silently
   *    lost at the bench).
   *  · A PROMISE CHAIN serializes PUTs — End game can flush while a debounced save is still
   *    in flight, and two concurrent full-replaces have no server-side ordering, so the stale
   *    one could win. Chained, the newer body always writes last.
   * Returns whether THIS save landed, so End game can refuse to finish on a failed flush.
   */
  const lineupSigRef = useRef('');
  useEffect(() => { lineupSigRef.current = JSON.stringify(rows); }, [rows]);
  const saveChainRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const saveLineup = useCallback((currentRows: GridRow[]): Promise<boolean> => {
    const run = async (): Promise<boolean> => {
      setLineupSaving(true);
      setLineupError('');
      const sigAtSave = JSON.stringify(currentRows);
      try {
        const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${eventId}/lineup`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: lineupPutBody(currentRows),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json?.error || 'Couldn’t save');
        }
        if (lineupSigRef.current === sigAtSave) setLineupDirty(false);
        return true;
      } catch (error: unknown) {
        setLineupError(error instanceof Error ? error.message : 'Couldn’t save');
        return false;
      } finally {
        setLineupSaving(false);
      }
    };
    const next = saveChainRef.current.then(run, run);
    saveChainRef.current = next;
    return next;
  }, [orgSlug, teamId, eventId, lineupPutBody]);

  useEffect(() => {
    if (!lineupDirty || lineupSaving || rows.length === 0) return;
    const t = setTimeout(() => { void saveLineup(rows); }, 900);
    return () => clearTimeout(t);
  }, [lineupDirty, lineupSaving, rows, saveLineup]);

  const mutateRows = (next: GridRow[]) => {
    setUndoStack(prev => [...prev, rows].slice(-30));
    setRows(next);
    setLineupDirty(true);
  };
  const undo = () => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      setRows(prev[prev.length - 1]);
      setLineupDirty(true);
      return prev.slice(0, -1);
    });
  };

  // ── Score save (quiet — the server refuses the flag anywhere it must not apply) ───────────
  // Same signature-guarded dirty clear as the lineup save: a bump landed while the PATCH was
  // in flight must survive it, or the running score sticks stale until the next bump.
  const scoreSigRef = useRef('');
  useEffect(() => { scoreSigRef.current = `${teamScore}|${oppScore}`; }, [teamScore, oppScore]);
  useEffect(() => {
    if (!scoreDirty || scoreSaving || !live || mirrored || !can.score) return;
    const t = setTimeout(async () => {
      setScoreSaving(true);
      setScoreError('');
      const sigAtSave = `${teamScore}|${oppScore}`;
      try {
        const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${eventId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamScore, opponentScore: oppScore, quiet: true }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json?.error || 'Couldn’t save the score');
        }
        if (scoreSigRef.current === sigAtSave) setScoreDirty(false);
      } catch (error: unknown) {
        setScoreError(error instanceof Error ? error.message : 'Couldn’t save the score');
      } finally {
        setScoreSaving(false);
      }
    }, 10_000);
    return () => clearTimeout(t);
  }, [scoreDirty, scoreSaving, live, mirrored, can.score, teamScore, oppScore, orgSlug, teamId, eventId]);

  // A pocketed phone or a closed tab must not eat the last ten seconds of scoring or the last
  // sub: on visibility loss, best-effort keepalive writes flush whatever is still dirty. The
  // quiet score flush stays inside the live window (the server enforces it anyway); the lineup
  // PUT has no window to miss. The 30s live→review flip at the window's far edge (3h after the
  // game) can still drop an unsaved bump — accepted; End game is the authoritative final write.
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState !== 'hidden') return;
      try {
        if (scoreDirty && live && can.score && !mirrored) {
          void fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${eventId}`, {
            method: 'PATCH', keepalive: true,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teamScore, opponentScore: oppScore, quiet: true }),
          });
        }
        if (lineupDirty && rows.length > 0 && can.subs) {
          void fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${eventId}/lineup`, {
            method: 'PUT', keepalive: true,
            headers: { 'Content-Type': 'application/json' },
            body: lineupPutBody(rows),
          });
        }
      } catch { /* best-effort only */ }
    };
    document.addEventListener('visibilitychange', flush);
    return () => document.removeEventListener('visibilitychange', flush);
  }, [scoreDirty, lineupDirty, live, can.score, can.subs, mirrored, teamScore, oppScore, rows, lineupPutBody, orgSlug, teamId, eventId]);

  const bumpScore = (side: 'us' | 'them', delta: number) => {
    if (!live || mirrored || !can.score) return;
    if (side === 'us') setTeamScore(s => Math.max(0, (s ?? 0) + delta));
    else setOppScore(s => Math.max(0, (s ?? 0) + delta));
    setScoreDirty(true);
    setScoreError('');
  };

  // ── Attendance (existing batch PATCH; one-tap rows; schedule vocabulary verbatim) ─────────
  const setAttendance = async (playerId: string, status: RepAttendanceStatus) => {
    const prev = att[playerId] ?? { status: 'unknown' as RepAttendanceStatus, note: null };
    if (!can.attendance || prev.status === status) return;
    const seq = (attSeqRef.current.get(playerId) ?? 0) + 1;
    attSeqRef.current.set(playerId, seq);
    setAtt(a => ({ ...a, [playerId]: { status, note: prev.note } }));
    setAttChangeCount(n => n + 1);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${eventId}/attendance`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // The note rides along UNCHANGED — the route's upsert writes the whole row, so
        // omitting it would erase a note recorded on the schedule tab.
        body: JSON.stringify({ entries: [{ playerId, status, note: prev.note ?? '' }] }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Roll back ONLY if no later tap on this player has superseded this one.
      if (attSeqRef.current.get(playerId) === seq) {
        setAtt(a => ({ ...a, [playerId]: prev }));
        setAttChangeCount(n => Math.max(0, n - 1));
      }
      return;
    }
    // "Ava is out — who covers CF?" A player marked Out while on the board flows straight
    // into the substitution (plan §3.5), never a dead end. Any half-made swap decision is
    // cleared — the situation it described just changed.
    const row = rows.find(r => r.playerId === playerId);
    const pos = row?.inningPositions[String(period)] ?? '';
    if (status === 'absent' && live && can.subs && row && pos && pos !== BENCH_POSITION) {
      setCoverFor({ playerId, position: pos });
      setSubInId(null);
      setPendingSwap(null);
      setSheet(null);
    }
  };

  // ── Moments (P2) — capture and erase. No notification path exists here, deliberately. ─────
  const saveMoment = async () => {
    const body = momentBody.trim();
    if (!body || momentSaving || !can.moments) return;
    setMomentSaving(true);
    setMomentError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${eventId}/game-moments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, playerId: momentPlayerId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.moment) throw new Error(json?.error || 'Couldn’t save that moment.');
      setMoments(m => sortMomentsNewestFirst([json.moment as RepTeamGameMoment, ...m]));
      setMomentBody('');
      setMomentPlayerId(null);
      setMomentSavedCount(n => n + 1);
      // The one-sitting loop: the sheet stays open and the keyboard stays up, so a second
      // thought costs no taps. Nothing re-prompts — closing the sheet ends it.
      momentInputRef.current?.focus();
    } catch (error: unknown) {
      setMomentError(error instanceof Error ? error.message : 'Couldn’t save that moment.');
    } finally {
      setMomentSaving(false);
    }
  };

  const deleteMoment = async (momentId: string) => {
    const removed = moments.find(m => m.id === momentId);
    if (!removed) return;
    setMoments(m => m.filter(x => x.id !== momentId));
    setMomentError('');
    try {
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/events/${eventId}/game-moments/${momentId}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error();
    } catch {
      /**
       * Put back ONLY THIS ROW, functionally — never a whole-list snapshot taken before the
       * request went out (/review 2026-08-05, High). On a field with flaky signal two erases
       * and a capture overlap constantly, and restoring the old array would undo whatever
       * landed in between: a second, already-confirmed deletion would reappear, or a moment
       * captured while this request was in flight would silently vanish from the list while
       * sitting safely on the server. The same lesson attendance learned in P1's review.
       */
      setMoments(m => (m.some(x => x.id === removed.id) ? m : sortMomentsNewestFirst([removed, ...m])));
      setMomentError('That moment couldn’t be removed — try again.');
    }
  };

  // ── End game (the one deliberate act; the single family notification) ─────────────────────
  const openEndSheet = () => {
    setFinalTeam(String(teamScore ?? 0));
    setFinalOpp(String(oppScore ?? 0));
    setEndError('');
    setSheet('end');
    setPendingSwap(null);
    setSubInId(null);
  };
  /** Digits only, non-empty. `Number('')` is 0 and would let an accidentally-cleared field
   *  submit a real 0–0 to every family (/review 2026-08-04, High). */
  const isFinalScore = (s: string) => /^\d+$/.test(s.trim());
  const confirmEnd = async () => {
    if (!isFinalScore(finalTeam) || !isFinalScore(finalOpp)) {
      setEndError('Enter both final scores.');
      return;
    }
    const ts = Number(finalTeam);
    const os = Number(finalOpp);
    setEndSaving(true);
    setEndError('');
    try {
      // The lineup flush must LAND before the game finishes — a poisoned save chain would
      // otherwise let the coach walk away from a recap whose substitutions never persisted.
      if (lineupDirty) {
        const saved = await saveLineup(rows);
        if (!saved) {
          setEndError('Tonight’s substitutions couldn’t be saved — Retry on the board, then end the game.');
          return;
        }
      }
      // Non-quiet, no explicit result: the server derives win/loss/tie and sends the ONE
      // family notification for tonight (the quiet path never called the dispatcher).
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamScore: ts, opponentScore: os }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Couldn’t finish the game.');
      setTeamScore(ts);
      setOppScore(os);
      setScoreDirty(false);
      if (json?.event) setData(d => (d ? { ...d, event: json.event } : d));
      setEnded(true);
      setSheet(null);
    } catch (error: unknown) {
      setEndError(error instanceof Error ? error.message : 'Couldn’t finish the game.');
    } finally {
      setEndSaving(false);
    }
  };

  // ── "Everyone plays" fallback: seed the whole roster, let the generator rotate the bench ──
  const everyonePlays = () => {
    // An empty roster would seed zero rows, which the autosave refuses — leaving the pill
    // stuck on "Saving…" forever. Nothing to generate from means the button does nothing.
    if (!data || !can.subs || data.players.length === 0) return;
    const players = data.players;
    const seeded: GridRow[] = players.map((p, i) => ({
      playerId: p.id, battingOrder: i + 1, starter: true, inningPositions: {}, notes: null,
    }));
    const { assignment: generated } = generateBestLineup({
      players: players.map(p => {
        const prefs = playerPositionPrefs(p, sportPack.pitcherPosition);
        return {
          playerId: p.id, preferred: prefs.preferred, never: prefs.never,
          pitcher: p.lineupProfile?.pitcher ?? null, aSquad: p.lineupProfile?.aSquad ?? false,
          inningPositions: {},
        };
      }),
      inningCount,
      policy: 'balanced',
      fillMode: 'regenerate',
      fieldPositions: sportPack.fieldPositions,
      pitcherPosition: sportPack.pitcherPosition,
      noBackToBackSits: true,
    });
    const next = seeded.map(r => ({ ...r, inningPositions: generated.get(r.playerId) ?? {} }));
    setUndoStack([]);
    setRows(next);
    // A brand-new board — nothing carries over from a board that didn't exist.
    freezeBenchOrder(next, period);
    setLineupDirty(true);
  };

  const chooseSkipLineup = () => {
    setSkipLineup(true);
    try { sessionStorage.setItem(gameDaySkipLineupKey(eventId), '1'); } catch { /* UI pref only */ }
  };

  // ── Derived board state ───────────────────────────────────────────────────────────────────
  const playerById = useMemo(
    () => new Map((data?.players ?? []).map(p => [p.id, p])),
    [data?.players],
  );
  const analysis = useMemo(
    () => analyzeLineup(
      rows.map(r => ({ playerId: r.playerId, inningPositions: r.inningPositions })),
      inningCount,
      sportPack.fieldPositions,
    ),
    [rows, inningCount, sportPack.fieldPositions],
  );
  const key = String(period);
  const onField = rows.filter(r => {
    const pos = r.inningPositions[key] ?? '';
    return pos && pos !== BENCH_POSITION;
  });
  const benchedRaw = rows.filter(r => {
    const pos = r.inningPositions[key] ?? '';
    return !pos || pos === BENCH_POSITION;
  });
  /**
   * P3 — longest sitting on top, FROZEN for the rest of the period.
   *
   * The order is recomputed at exactly three moments, all of them events rather than renders:
   * the board first arriving, a brand-new board being seeded, and the period cursor moving
   * (`freezeBenchOrder`, called from those three places). Between them nothing re-sorts, so a
   * substitution never re-shuffles rows under the coach's thumb — a player benched mid-period
   * simply lands at the bottom, where the sort would have put them anyway.
   *
   * The `period` guard is the safety net: an order frozen for a period we are no longer in is
   * discarded in favour of the natural order, never applied to the wrong period's board.
   */
  const benched = applyBenchOrder(benchedRaw, benchOrder?.period === period ? benchOrder.ids : []);
  /**
   * P3 — the team's pitching cap for THIS game, resolved the way the lineup builder resolves
   * it (this game's override ?? this season's default). A player's own cap still wins over it
   * (`resolvePlayerPitcherCap`); when neither exists the board says nothing at all, because
   * this product never invents an arm-care ceiling a coach did not set.
   */
  const teamPitcherCap = useMemo(
    () => resolveLineupCaps(data?.lineupSettings ?? null, data?.lineup?.rulesOverride ?? null).pitcherInningsCap,
    [data?.lineupSettings, data?.lineup?.rulesOverride],
  );
  const openPositions = (analysis.unfilledFieldPositions.find(u => u.inning === period)?.positions ?? []);
  const pitchedThrough = (row: GridRow) => {
    if (!sportPack.pitcherPosition) return 0;
    let n = 0;
    for (let p = 1; p <= period; p++) {
      if (row.inningPositions[String(p)] === sportPack.pitcherPosition) n += 1;
    }
    return n;
  };

  /**
   * ── EDITING A POSITION IS THE BUILDER'S TAP (console re-draw · G1, owner 2026-09-22) ───────
   * The pill beside a name is a real control now, on the field and on the bench alike, and it
   * raises the SAME `LineupPositionSheet` the phone builder raises — one component, one grammar,
   * so the two screens can never drift into different answers to "what does Casey play?".
   *
   * ⚠ Phone only, exactly as the builder gates it: the sheet is the fourth member of the phone's
   * bottom-sheet system, and that system's positioning rules live entirely inside the nav's
   * ≤900px block (`.sheetAnchor` in CoachesBottomNav.module.css). Rendered above that width it
   * would lay out in the document flow. So ≤640 raises the sheet and wider widths get the
   * builder's other control, a native `<select>` — which is what the desktop grid has always used.
   */
  const isPhone = useIsPhone();
  const [positionFor, setPositionFor] = useState<string | null>(null);
  /**
   * ⚠ WHERE FOCUS GOES AFTER A PICK (/review 2026-09-22 — measured landing on `<body>`).
   *
   * Changing a position is the one edit that MOVES A ROW BETWEEN THE TWO GROUPS: give a benched
   * player a position and they leave `benched.map()` for `onField.map()`. Those are different
   * parents, so React unmounts the old control and mounts a new one — and the position sheet's
   * focus-restore is holding the node that just died, so focus fell to the document body. For a
   * keyboard or screen-reader coach that is being thrown to the top of the page after the most
   * common edit on the screen; the same happens to the desktop `<select>`, which unmounts too.
   *
   * So the row asks for focus back BY PLAYER rather than by node. The ref is deliberately not
   * state: this is a one-shot that must not cause a render of its own.
   */
  const refocusPlayerRef = useRef<string | null>(null);
  useEffect(() => {
    const playerId = refocusPlayerRef.current;
    if (!playerId) return;
    refocusPlayerRef.current = null;
    document.querySelector<HTMLElement>(`[data-pos-for="${playerId}"]`)?.focus({ preventScroll: true });
  });

  /** One cell edit — the same shape the Full grid's select made, and one undo step. */
  const setPositionAt = (playerId: string, code: string) => {
    refocusPlayerRef.current = playerId;
    mutateRows(rows.map(r => (r.playerId === playerId
      ? { ...r, inningPositions: { ...r.inningPositions, [key]: code } }
      : r)));
  };
  /** The sheet speaks `LineupPlayerRow` (the builder's shape); the console's row is a seed
   *  entry. One adapter here beats teaching a shared component a second shape. */
  const positionSheetRow: LineupPlayerRow | null = useMemo(() => {
    if (!positionFor) return null;
    const row = rows.find(r => r.playerId === positionFor);
    const player = playerById.get(positionFor);
    if (!row || !player) return null;
    return {
      player,
      battingOrder: row.battingOrder != null ? String(row.battingOrder) : '',
      starter: row.starter,
      inningPositions: row.inningPositions,
      notes: row.notes ?? '',
    };
  }, [positionFor, rows, playerById]);

  /**
   * The pinned stepper's dots — the builder's own read of each inning, on the console's own
   * `analysis`. A clash is louder than an open role, which is louder than a finished inning;
   * an inning nobody has touched stays quiet rather than reading as a problem.
   */
  const inningDots = useMemo(() => {
    const assigned = new Set<number>();
    for (const r of rows) {
      for (const [k, v] of Object.entries(r.inningPositions)) if (v) assigned.add(Number(k));
    }
    const openBy = new Map(analysis.missingFieldPositions.map(m => [m.inning, m.positions]));
    return Array.from({ length: inningCount }, (_, i) => {
      const n = i + 1;
      if (analysis.conflictInnings.has(n)) return 'clash' as const;
      if (!assigned.has(n)) return 'untouched' as const;
      return (openBy.get(n)?.length ? 'open' : 'done') as 'open' | 'done';
    });
  }, [rows, analysis, inningCount]);

  const selectingTarget = subInId !== null;
  const coveringAbsent = coverFor !== null;
  const boardInteractive = live && can.subs && rows.length > 0;

  const tapBenchRow = (r: GridRow) => {
    if (!boardInteractive) return;
    if (coveringAbsent) {
      setPendingSwap({ inId: r.playerId, outId: coverFor!.playerId, position: null, fromPeriod: period });
      return;
    }
    setSubInId(prev => (prev === r.playerId ? null : r.playerId));
  };
  const tapFieldRow = (r: GridRow) => {
    if (!boardInteractive || !selectingTarget || r.playerId === subInId) return;
    setPendingSwap({ inId: subInId!, outId: r.playerId, position: null, fromPeriod: period });
  };
  const tapOpenPosition = (pos: string) => {
    if (!boardInteractive || !selectingTarget) return;
    setPendingSwap({ inId: subInId!, outId: null, position: pos, fromPeriod: period });
  };
  /**
   * THE ONE RULE: any user-initiated surface abandons a half-made swap decision. The sheets are
   * deliberately non-modal, and two open decisions at once is how the wrong one gets tapped.
   *
   * ⚠ This is now a named function because the console re-draw added a SECOND way in (the
   * position control on every row) and hand-rolled a partial copy of it — clearing `subInId` and
   * `coverFor` but not `pendingSwap`. /review 2026-09-22 found both halves of that: a confirmed
   * swap card survived behind the position sheet's scrim and came back live when the sheet
   * closed, and on the desktop `<select>` nothing was cleared at all, so a hand-picked position
   * was silently overwritten by the swap that was still pending behind it. One function, three
   * call sites, no third copy.
   */
  const abandonSwap = () => {
    setPendingSwap(null);
    setSubInId(null);
    setCoverFor(null);
  };
  /**
   * Open the position sheet for one player — a surface, so it abandons a swap like any other AND
   * closes any open sheet. ⚠ The closing matters: `.gdSheet` is deliberately scrim-less so the
   * board stays visible behind it, which also leaves the board's position pills TAPPABLE behind
   * it. Without this, tapping a pill while (say) the score sheet was open left two surfaces up at
   * once — the thing `openSheet`'s rule exists to prevent, arrived at from the other direction.
   */
  const beginPositionEdit = (playerId: string) => {
    setSheet(null);
    abandonSwap();
    setPositionFor(playerId);
  };
  /**
   * ── LEAVING A SHEET (owner from the phone, 2026-09-22: "I can't escape or click out of these
   * modals, only the X allows me to leave") ──────────────────────────────────────────────────
   *
   * Every `.gdSheet` on this screen — score, Who's here, Note, the scouting book, the End-game
   * wrap AND the substitution confirm — declared `role="dialog"` and offered exactly one way out.
   * No Escape, no tap-away, and no phone Back either: §219 gave a history entry to every dialog
   * FLOOR, and these six never had one, so Back walked out of the game entirely.
   *
   * They stay NON-MODAL by design — no scrim, the board readable behind them, because a bench
   * decision is made while looking at the bench. So this is `useDismissable` (a pointer-down
   * outside dismisses, Escape dismisses) plus `useBackStep`, rather than `useDialogFloor`, whose
   * focus TRAP would contradict a surface you are meant to be able to look and tap past.
   *
   * ⚠ Both states are cleared together on purpose. They are supposed to be mutually exclusive,
   * but nothing enforced it: with a sheet open you could still tap a bench row and then a field
   * row, and the swap confirm would render ON TOP of the open sheet. Dismissing clears the
   * overlay, whatever is in it.
   */
  const sheetRef = useRef<HTMLDivElement>(null);
  const swapRef = useRef<HTMLDivElement>(null);
  const overlayOpen = sheet !== null || pendingSwap !== null;
  const dismissOverlay = useCallback(() => { setSheet(null); setPendingSwap(null); }, []);
  useDismissable(overlayOpen, [sheetRef, swapRef], dismissOverlay);
  useBackStep(overlayOpen, dismissOverlay);

  const openSheet = (kind: SheetKind) => {
    setSheet(kind);
    abandonSwap();
    setPositionFor(null);
    // A failure from an earlier sitting must not greet the coach on a fresh open — it would
    // misattribute a save that already failed to a capture that hasn't happened yet.
    setMomentError('');
  };
  const applyPendingSwap = (scope: 'onward' | 'single') => {
    if (!pendingSwap) return;
    // Re-validate against CURRENT state: the board stayed live under the sheet, so the spot
    // may have been claimed (or the outgoing player benched) since the decision opened. A
    // stale decision is dropped, never blind-applied over what the board now shows.
    const swapKey = String(pendingSwap.fromPeriod);
    const stillValid = pendingSwap.outId
      ? (() => {
          const out = rows.find(r => r.playerId === pendingSwap.outId);
          const pos = out?.inningPositions[swapKey] ?? '';
          return Boolean(pos && pos !== BENCH_POSITION);
        })()
      : !rows.some(r => (r.inningPositions[swapKey] ?? '') === pendingSwap.position);
    if (stillValid) {
      const next = applyConsoleSwap(rows, {
        inPlayerId: pendingSwap.inId,
        outPlayerId: pendingSwap.outId,
        position: pendingSwap.position ?? undefined,
        fromPeriod: pendingSwap.fromPeriod,
        periodCount: inningCount,
        scope,
      });
      if (next !== rows) {
        mutateRows(next);
        setSubCount(n => n + 1);
      }
    }
    setPendingSwap(null);
    setSubInId(null);
    setCoverFor(null);
  };

  const nameOf = (playerId: string) => {
    const p = playerById.get(playerId);
    return p ? playerName(p) : 'Player';
  };
  const numberOf = (playerId: string) => playerById.get(playerId)?.playerNumber ?? null;
  /**
   * The call-up mark (mig 309) — drawn on the field rows AND the bench rows, from one place so the
   * two halves of this board cannot disagree. The console is the screen where a coach is making
   * live decisions about who plays next, so "is this one of mine?" is at its most load-bearing.
   */
  const callUpMarkFor = (playerId: string) =>
    (isCallUp(playerById.get(playerId)) ? <span className={styles.gdWarn}>{CALL_UP_LABEL}</span> : null);

  /**
   * The position, as a CONTROL — the builder's two, chosen by width (see `isPhone` above).
   * Rendered on every board row, on the field and on the bench alike: on the bench it is also
   * the one-tap way to send somebody in, which is why the row's own tap can stay the swap.
   *
   * `locked` is the honest inert form — no grant, outside the live window, or an absent player,
   * who must not be put on the field from here. A locked position is a plain span rather than a
   * disabled control, because a disabled-looking button on a row is the defect this screen just
   * came out of.
   */
  const positionControl = (r: GridRow, locked = false) => {
    const pos = r.inningPositions[key] ?? '';
    const shown = pos || '—';
    if (!boardInteractive || locked) {
      return <span className={styles.gdPos} data-field-key>{shown}</span>;
    }
    const label = `${nameOf(r.playerId)}, ${periodLabel.toLowerCase()} ${period}`;
    return isPhone ? (
      <button
        type="button"
        className={styles.gdPosBtn}
        data-field-key
        data-pos-for={r.playerId}
        aria-label={`${label} — currently ${pos || 'on the bench'}. Change it.`}
        onClick={() => beginPositionEdit(r.playerId)}
      >
        {shown}
      </button>
    ) : (
      <select
        className={styles.gdPosSelect}
        data-field-key
        data-pos-for={r.playerId}
        value={pos}
        aria-label={label}
        onChange={e => { abandonSwap(); setPositionAt(r.playerId, e.target.value); }}
      >
        {LINEUP_POSITIONS.map(p => <option key={p || 'blank'} value={p}>{p || '—'}</option>)}
      </select>
    );
  };

  const attendingCount = (data?.players ?? []).filter(p => (att[p.id]?.status ?? 'unknown') !== 'absent').length;
  const outCount = (data?.players ?? []).filter(p => att[p.id]?.status === 'absent').length;

  const whoRunsTheBench = data?.headCoachName?.trim()
    ? `${data.headCoachName.trim()} runs the bench.`
    : 'Your coach runs the bench.';

  const derivedResult = event?.result
    ?? deriveGameResult(teamScore, oppScore);

  // ── Render ────────────────────────────────────────────────────────────────────────────────
  /** The recap's and the error state's way back — inside `.gdBar`, which the LIVE screen no
   *  longer renders. The word is the destination now, not the page it happens to live on; at
   *  phone width the stylesheet drops it and the accessible name carries the detail. */
  const backLink = (
    <Link
      href={`${base}/schedule?event=${eventId}`}
      className={styles.gdBack}
      aria-label="Back to this game on the schedule"
    >
      <ArrowLeft size={15} aria-hidden /> <span className={styles.gdBackWord}>Back</span>
    </Link>
  );

  if (loading) return <div className={styles.page}><div className={styles.loadingState}>Loading the game…</div></div>;
  if (loadError || !event || !data) {
    return (
      <div className={styles.page}>
        {backLink}
        <CoachEmptyState
          quiet
          icon={<Circle size={22} />}
          headline="This game couldn’t be opened"
          description={loadError || 'It may belong to a different season.'}
          secondaryAction={{ href: `${base}/schedule`, label: 'Back to the schedule' }}
        />
      </div>
    );
  }

  const opponentDoor = Boolean(event.opponent);
  const matchupTitle = event.opponent
    ? `${event.homeAway === 'away' ? '@' : 'vs'} ${event.opponent}`
    : event.name;
  const startLine = formatInOrgZone(event.startsAt, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  /**
   * ── THE AUTOSAVE WORD IS THE SHARED PILL (console re-draw, owner 2026-09-22) ───────────────
   * This screen hand-rolled its own `.saveStatus` span and pinned it in the top strip, always
   * visible — the home every other autosaving coach screen left on 2026-09-20. It was missed
   * because the console was never added to `coach-save-pill-guard`'s list of surfaces; it is on
   * that list now, so the next time this word moves, this screen moves with it.
   *
   * ⚠ Three honest states come from the component, and it must never lump dirty into saving.
   * Two zones save here, so the pill reports whichever is working and retries whichever failed —
   * a lineup error wins the retry because it is the one with edits queued behind it.
   */
  const savePill = (can.subs || can.score) && live ? (
    <SaveStatusPill
      saving={lineupSaving || scoreSaving}
      dirty={lineupDirty || scoreDirty}
      error={lineupError || scoreError}
      onRetry={() => { if (lineupError) void saveLineup(rows); else setScoreDirty(true); }}
    />
  ) : null;

  /**
   * Every sheet wears the same head; one definition instead of six hand-copies — and the grab
   * line rides with it, which is what makes these five DRAWERS and leaves the substitution
   * confirm (whose head is inline, by itself) a card. Owner ruling 2026-09-22.
   *
   * The line is decorative: nothing here is draggable, and there are already four ways out
   * (Escape, tap-away, the phone's Back, the X). It is the phone sheet system's signature, so a
   * coach reads these as the same kind of surface as the position sheet and the More sheet.
   */
  const sheetHead = (title: React.ReactNode) => (
    <>
      <span className={styles.gdGrab} aria-hidden />
      <div className={styles.gdSheetHead}>
        <b>{title}</b>
        <button type="button" className={styles.gdSheetClose} onClick={() => setSheet(null)} aria-label="Close">
          <X size={16} />
        </button>
      </div>
    </>
  );

  /**
   * ONE moment row, rendered by all three places a moment appears (the capture sheet, the
   * End-game wrap, the recap) — the same reason `sheetHead` exists: three hand-copies of a
   * timestamped line is three chances for the timestamp to disagree with itself.
   * `onRemove` is passed ONLY by the capture sheet; the wrap and the recap read, never erase.
   */
  const momentRow = (m: RepTeamGameMoment, onRemove?: (id: string) => void) => (
    <div key={m.id} className={styles.gdMomentRow}>
      <span className={styles.gdMomentTime}>
        {formatInOrgZone(m.happenedAt, { hour: 'numeric', minute: '2-digit' })}
      </span>
      <span className={styles.gdMomentBody}>
        {/* The chip renders only when the tag RESOLVES. A player deactivated since the moment
            was captured would otherwise be labelled with `nameOf`'s generic "Player" fallback,
            and a moment attributed to nobody in particular reads worse than one with no chip
            at all (/review 2026-08-05). The line itself is never hidden. */}
        {m.playerId && playerById.has(m.playerId) && (
          <span className={styles.gdMomentWho}>{nameOf(m.playerId)}</span>
        )}
        {m.body}
      </span>
      {onRemove && (
        <button
          type="button"
          className={styles.gdMomentX}
          onClick={() => void onRemove(m.id)}
          aria-label={`Remove the moment “${m.body.slice(0, 40)}”`}
        >
          <X size={13} aria-hidden />
        </button>
      )}
    </div>
  );

  // The Scouting Book sheet (the rider's door) — ONE instance, rendered by both the live
  // console (header-name door) and the recap (capture door), so the two can never drift.
  /**
   * The drawers' scrim. Rendered for the five `sheet` surfaces and NOT for the substitution
   * confirm, which is deliberately still a card over a board the coach is meant to read.
   *
   * ⚠ It is a SIBLING of the sheet, never a child or a pseudo-element of it — see `.gdScrim`
   * for what happened when it was the latter. Being a sibling is also what keeps it "outside"
   * for `useDismissable`, so a tap on it closes without needing a handler of its own, and the
   * page underneath stays inert instead of taking the tap through a dimmed layer.
   */
  const drawerScrim = sheet !== null ? <div className={styles.gdScrim} aria-hidden /> : null;

  const bookSheet = sheet === 'book' && event.opponent ? (
    <div ref={sheetRef} className={styles.gdSheet} role="dialog" aria-label={`Your book on ${event.opponent}`}>
      {sheetHead(`${event.opponent} — your book`)}
      <OpponentScoutingPanel
        orgSlug={orgSlug} teamId={teamId} eventId={eventId}
        opponentName={event.opponent} mirrored={mirrored}
      />
    </div>
  ) : null;

  // ── Review mode (after End game, or at this URL outside the live window) ──────────────────
  if (!live) {
    const fieldCounts = new Map(analysis.fairPlay.map(f => [f.playerId, f.onField]));
    return (
      <div className={styles.page}>
        <div className={styles.gdPage} data-field-floor>
          <div className={styles.gdBar}>
            {backLink}
            <b>Game recap</b>
            <span className={styles.gdBarNote}>Read-only</span>
          </div>

          <div className={styles.gdCard}>
            <div className={styles.gdMatch}>
              {opponentDoor ? (
                <button type="button" className={styles.gdOppDoor} onClick={() => setSheet('book')}>
                  <span className={styles.gdOppName}>{matchupTitle}</span>
                </button>
              ) : (
                <span className={styles.gdOpp}>{matchupTitle}</span>
              )}
              {/* The badge renders whenever a result EXISTS — a server-authoritative result
                  with no numeric scores (a forfeit) must not be hidden by a score gate. */}
              {derivedResult && (
                <span className={styles.gdResBadge} data-result={derivedResult}>
                  {derivedResult === 'win' ? 'W' : derivedResult === 'loss' ? 'L' : 'T'}
                  {teamScore !== null && oppScore !== null ? ` ${teamScore}–${oppScore}` : ''}
                </span>
              )}
            </div>
            <p>{startLine}{event.status === 'cancelled' ? ' · Cancelled' : ''}</p>
          </div>

          {/* The Scouting Book capture door (rider): quiet line, never a modal; skipping never
              re-asks — it simply sits here. Same surface the score-saved toast opens. */}
          {opponentDoor && ended && (
            <button type="button" className={styles.gdBookLine} onClick={() => setSheet('book')}>
              While it’s fresh — <b>add to the book on {event.opponent}?</b> ›
            </button>
          )}

          {rows.length > 0 && (
            <div className={styles.gdCard}>
              <p className={styles.gdGroupLbl}>Playing time tonight</p>
              {rows.map(r => {
                const n = fieldCounts.get(r.playerId) ?? 0;
                return (
                  <div key={r.playerId} className={styles.gdPtRow}>
                    <span className={styles.gdPtName}>{nameOf(r.playerId)}</span>
                    <span className={styles.gdPtBar}>
                      <i style={{ width: `${inningCount ? Math.round((n / inningCount) * 100) : 0}%` }} />
                    </span>
                    <span className={styles.gdPtN}>{n}</span>
                  </div>
                );
              })}
              <p className={styles.gdQuietNote}>
                {sportPack.periodLabelPlural} on the field, straight from the lineup you ran tonight.
              </p>
            </div>
          )}

          {/* Tonight's moments, read-only. Absent when none were captured — no empty state,
              no "you didn't add any" (the sparse-data honesty rule; mockup frame 15). */}
          {moments.length > 0 && (
            <div className={styles.gdCard}>
              <p className={styles.gdGroupLbl}>Moments from this game</p>
              {moments.map(m => momentRow(m))}
              <p className={styles.gdQuietNote}>
                Yours and your staff’s — families are never notified about these.
              </p>
            </div>
          )}

          {/* The Insights portal's own door — offered only to a coach it admits (a helper's
              review of a game must not end on a report they cannot open). */}
          {assignment && hasNonMoneyRecordAccess(assignment.capabilities) && (
            <Link href={insightsSectionHref(base, 'playing-time')} className={styles.gdDoorRow}>
              <span>Playing time — season report</span><span aria-hidden>›</span>
            </Link>
          )}

          {drawerScrim}


          {bookSheet}
        </div>
      </div>
    );
  }

  // ── Live mode ─────────────────────────────────────────────────────────────────────────────
  const showFallback = rows.length === 0 && !skipLineup;
  const boardVisible = rows.length > 0;
  /** LABELLED footer buttons only — the undo arrow is icon-width and keeps its own room.
   *  Full grid left with the sideways table; Scouting took its slot (console re-draw · G3). */
  const footerLabelCount = [can.attendance, can.moments, opponentDoor, can.score && !mirrored]
    .filter(Boolean).length;

  return (
    <div className={styles.page}>
      {/* data-field-floor (owner 2026-09-20, stage 0 · A4): read standing up — nothing under 12px
          inside, the position at 14; the sweep's `field-floor` rule holds it. */}
      <div className={styles.gdPage} data-field-floor>
        {readOnlyViewer && <p className={styles.gdHandedOff}>{whoRunsTheBench}</p>}

        {/* ── The head, which SCROLLS (console re-draw, owner 2026-09-22) ────────────────────
            The 47px top strip above this is gone: the back arrow moved onto this line, "GAME DAY"
            became the live dot beside it (a coach who opened game day knows they are on game day;
            what the badge was really carrying is that writes are open, because this same address
            serves a read-only recap outside the window), and the save word left for the shared
            floating pill.

            ⚠ The home/away WORD is gone too, not relocated: `matchupTitle` already says it —
            "vs" for a home game, "@" for an away one — so the line was stating one fact twice,
            in two grammars, and it was the fourth chip's worth of room that did it. */}
        <div className={styles.gdCard}>
          <div className={styles.gdMatch}>
            <Link
              href={`${base}/schedule?event=${eventId}`}
              className={styles.gdBackBtn}
              aria-label="Back to this game on the schedule"
            >
              <ArrowLeft size={17} aria-hidden />
            </Link>
            {opponentDoor ? (
              // The Scouting Book door (rider): the opponent's name opens your book as a sheet.
              // Kept as the CONTEXTUAL route now that the footer carries a door you can see
              // (G3 = A) — two routes to one sheet are fine when they cannot disagree.
              // Absent when the slot is TBD — a door to nothing is a dead end, not a feature.
              <button type="button" className={styles.gdOppDoor} onClick={() => openSheet('book')}>
                <span className={styles.gdOppName}>{matchupTitle}</span>
              </button>
            ) : (
              <span className={styles.gdOpp}>{matchupTitle}</span>
            )}
            {/* No `aria-label`: a bare span has the generic role, which does not take a name from
                one, so the attribute was inert. The visible word says it. */}
            <span className={styles.gdLiveDot}>
              <i aria-hidden /> LIVE
            </span>
          </div>
          <div className={styles.gdChips}>
            {event.fieldNumber && <span className={styles.gdChip}>{surfaceLabel(sportPack.id, event.fieldNumber)}</span>}
            {event.arrivalTime && <span className={styles.gdChip}>Arrive {formatStoredClock(event.arrivalTime)}</span>}
            {event.uniform && <span className={styles.gdChip}>{event.uniform}</span>}
          </div>
        </div>

        {/* ── The one thing that PINS: the inning ───────────────────────────────────────────
            With the running score gone (nothing in the product reads a mid-game score — the
            season record refuses one by design, and End game carries its own two fields), the
            control worth following a coach down the page is the inning: it drives the board, and
            stepping it is how a later inning gets corrected now that the Full grid sheet is gone.
            So this is the lineup builder's own pinned stepper, dots and all.

            ⚠ `data-sticky="head"` STAYS on this element. It is the layout sweep's readiness
            selector for this screen (`scripts/layout-screens.mjs`), and it is rendered only in
            live mode, so it still proves both things the sweep needs: the screen resolved, and it
            resolved as the console rather than the recap. */}
        <div className={styles.gdInningBar} data-sticky="head">
          <div className={styles.gdInningRow}>
            {(can.subs || can.score || can.attendance) && (
              <button
                type="button" className={styles.gdStepper} onClick={() => setCursor(period - 1)}
                disabled={period <= 1} aria-label={`Back one ${periodLabel.toLowerCase()}`}
              >‹</button>
            )}
            <span className={styles.gdPeriodChip}>
              {periodLabel.toUpperCase()} {period} OF {inningCount}
            </span>
            {(can.subs || can.score || can.attendance) && (
              <button
                type="button" className={styles.gdStepper} onClick={() => setCursor(period + 1)}
                disabled={period >= inningCount} aria-label={`Next ${periodLabel.toLowerCase()}`}
              >›</button>
            )}
          </div>
          {/* Decorative, never a tap target — the same rule the builder's dots follow. The
              sentence beside them is what a screen reader gets instead. */}
          {boardVisible && (
            <>
              <div className={styles.gdDots} aria-hidden>
                {inningDots.map((state, i) => (
                  <i key={i} data-state={state} data-now={i + 1 === period ? 'yes' : undefined} />
                ))}
              </div>
              {/* ⚠ Reports BOTH conditions, not whichever it meets first (/review 2026-09-22).
                  The dots show a clash and an open role at the same time whenever both exist —
                  an ordinary mid-game state — and an if/else here told a screen-reader user only
                  about the clash, dropping the open role entirely. The eye gets both; so does
                  this. Named by inning, because "which one" is the whole question. */}
              <span className={styles.srOnly}>
                {(() => {
                  const lc = periodLabel.toLowerCase();
                  const list = (state: string) => inningDots
                    .map((d, i) => (d === state ? i + 1 : 0)).filter(Boolean).join(', ');
                  const clash = list('clash');
                  const open = list('open');
                  const parts: string[] = [];
                  if (clash) parts.push(`two players at one position in ${lc} ${clash}`);
                  if (open) parts.push(`a position still open in ${lc} ${open}`);
                  return parts.length ? parts.join('; ') : `Every started ${lc} is filled`;
                })()}
              </span>
            </>
          )}
        </div>

        {/* Substitution hint line — the two-tap flow's one instruction. */}
        {selectingTarget && (
          <div className={styles.gdHint}>
            Tap who <b>{nameOf(subInId!)}</b> goes in for
            <button type="button" className={styles.gdHintCancel} onClick={() => { setSubInId(null); setCoverFor(null); }}>
              Cancel
            </button>
          </div>
        )}
        {coveringAbsent && !selectingTarget && (
          <div className={styles.gdHint}>
            <b>{nameOf(coverFor!.playerId)}</b> is {ATTENDANCE_WORD.absent.toLowerCase()} — tap who covers {coverFor!.position}
            <button type="button" className={styles.gdHintCancel} onClick={() => setCoverFor(null)}>
              Cancel
            </button>
          </div>
        )}

        {/* No-lineup fallback: three doors, never a dead end (plan §3.2).
            ⚠ Not for a read-only viewer: the lineup was WITHHELD from them, not absent, so "No
            lineup saved" and "Score and attendance still work tonight" were both false for a
            helper (staff access review, 2026-09-10). */}
        {showFallback && !readOnlyViewer && (
          <div className={styles.gdCard}>
            <p className={styles.gdFallbackLead}>No lineup saved for this game yet.</p>
            {can.subs ? (
              <div className={styles.gdFallbackDoors}>
                {/* The builder, with the way back to this console (stage 3 · D3). */}
                <Link href={lineupBuilderHref(base, eventId, { returnTo: `${base}/game/${eventId}` })} className={styles.gdBigBtn} data-primary="yes">
                  Start from a template
                  <small>your usual grid, ready to adjust</small>
                </Link>
                <button type="button" className={styles.gdBigBtn} onClick={everyonePlays}>
                  Everyone plays
                  <small>auto-fill an even rotation</small>
                </button>
                <button type="button" className={styles.gdBigBtn} onClick={chooseSkipLineup}>
                  Skip lineup — just score &amp; attendance
                  <small>the board stays off tonight</small>
                </button>
              </div>
            ) : (
              <p className={styles.gdQuietNote}>Score and attendance still work tonight.</p>
            )}
          </div>
        )}

        {/* The board: the lineup grid's current-period column as big rows. */}
        {boardVisible && (
          <>
            <div className={styles.gdGroup}>
              <p className={styles.gdGroupLbl}>On the field — {periodLabel.toLowerCase()} {period}</p>
              {onField.map(r => {
                const pos = r.inningPositions[key] ?? '';
                const isPitching = pos === sportPack.pitcherPosition;
                const pitched = isPitching ? pitchedThrough(r) : 0;
                const cap = isPitching
                  ? resolvePlayerPitcherCap(
                      playerById.get(r.playerId)?.lineupProfile?.pitcher?.maxInnings, teamPitcherCap)
                  : null;
                const isOut = att[r.playerId]?.status === 'absent';
                // A field row is a swap TARGET only while somebody is picked off the bench —
                // `tapFieldRow` accepts nothing else. Outside that, the row's facts are text and
                // the position beside them is the control.
                const isTarget = boardInteractive && selectingTarget && r.playerId !== subInId;
                const facts = (
                  <>
                    <span className={styles.gdNum}>{numberOf(r.playerId)}</span>
                    <span className={styles.gdName}>{nameOf(r.playerId)}</span>
                    {callUpMarkFor(r.playerId)}
                    {isOut && <span className={styles.gdWarn} data-tone="red">{ATTENDANCE_WORD.absent}</span>}
                    {pitched > 0 && cap !== null && (
                      <span className={styles.gdWarn} data-tone={pitched >= cap ? 'red' : undefined}>
                        {pitched} of {cap} {sportPack.periodLabelPlural.toLowerCase()} pitched
                      </span>
                    )}
                  </>
                );
                return (
                  <div key={r.playerId} className={styles.gdRow} data-target={isTarget ? 'yes' : undefined}>
                    {isTarget ? (
                      <button
                        type="button"
                        className={styles.gdRowMain}
                        onClick={() => tapFieldRow(r)}
                      >
                        {/* ⚠ The action is a HIDDEN PREFIX, not an `aria-label` (/review
                            2026-09-22). An explicit label REPLACES the name computed from the
                            content, so labelling this button silently dropped the warning chips
                            — "3 of 5 innings pitched", "OUT" — from what a screen reader says,
                            at exactly the moment they decide the swap. This way the name is the
                            action AND the facts. */}
                        <span className={styles.srOnly}>Put {nameOf(subInId!)} in for </span>
                        {facts}
                      </button>
                    ) : (
                      <span className={styles.gdRowMain} data-static="yes">{facts}</span>
                    )}
                    {positionControl(r)}
                  </div>
                );
              })}
              {selectingTarget && openPositions.map(pos => (
                <button
                  key={pos}
                  type="button"
                  className={styles.gdRow}
                  data-open="yes"
                  onClick={() => tapOpenPosition(pos)}
                >
                  <span className={styles.gdNum} />
                  <span className={styles.gdName}>Open — {pos}</span>
                  <span className={styles.gdPos} data-field-key>{pos}</span>
                </button>
              ))}
            </div>

            <div className={styles.gdGroup}>
              {/* The label is a promise, so it is only made while it is true: with more than one
                  row to order, and while the frozen order still matches what the streak chips
                  say. Bench someone mid-period who has been sitting all game and they land at
                  the bottom (nothing moves under your thumb, by ruling) — at which point this
                  quietly stops claiming an order it no longer has, until the next period. */}
              <p className={styles.gdGroupLbl}>
                Bench{benched.length > 1 && benchOrderStillSorted(benched, period)
                  ? ' — longest sitting first' : ''}
              </p>
              {benched.length === 0 && <p className={styles.gdQuietNote}>Nobody on the bench this {periodLabel.toLowerCase()}.</p>}
              {benched.map(r => {
                const streak = benchStreakThrough(r, period);
                const isOut = att[r.playerId]?.status === 'absent';
                const selectable = boardInteractive && !isOut;
                const facts = (
                  <>
                    <span className={styles.gdNum}>{numberOf(r.playerId)}</span>
                    <span className={styles.gdName}>{nameOf(r.playerId)}</span>
                    {callUpMarkFor(r.playerId)}
                    {isOut && <span className={styles.gdWarn} data-tone="red">{ATTENDANCE_WORD.absent}</span>}
                    {!isOut && streak >= 2 && (
                      <span className={styles.gdWarn} data-tone="red">
                        {ordinal(streak)} straight {periodLabel.toLowerCase()} sitting
                      </span>
                    )}
                  </>
                );
                return (
                  <div
                    key={r.playerId}
                    className={styles.gdRow}
                    data-selected={subInId === r.playerId ? 'yes' : undefined}
                    data-target={coveringAbsent && !isOut ? 'yes' : undefined}
                  >
                    {selectable ? (
                      <button
                        type="button"
                        className={styles.gdRowMain}
                        onClick={() => tapBenchRow(r)}
                        /* ⚠ `aria-pressed` only where it is TRUE that this toggles. Picking a
                           sub off the bench toggles (tap again to deselect); covering an absent
                           player is one-shot — it opens the confirm immediately — so announcing
                           "not pressed" there describes a toggle that does not exist. */
                        aria-pressed={coveringAbsent ? undefined : subInId === r.playerId}
                      >
                        {/* The action as a hidden prefix, so the warning chips stay in the name. */}
                        <span className={styles.srOnly}>
                          {coveringAbsent ? `Cover ${coverFor!.position} with ` : 'Pick to go in: '}
                        </span>
                        {facts}
                      </button>
                    ) : (
                      <span className={styles.gdRowMain} data-static="yes">{facts}</span>
                    )}
                    {/* An absent player is never sent onto the field from here. */}
                    {positionControl(r, isOut)}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── The score, demoted to a door (owner ruling 2026-09-22) ────────────────────────
            The running US — THEM block that used to sit in the header is gone. Nothing in the
            product reads a mid-game score: the season record refuses one by design (the quiet
            write may not carry `result`), the schedule, insights and the recap all read a
            FINISHED game, and End game carries its own two fields and its own win/loss/tie
            badge. So the score keeps a door — the same sheet, untouched, +1 buttons and all —
            and the door sits where you meet it on the way to ending the game, rather than
            taking the most valuable 50px on the screen.
            ⚠ NOT gated on `can.score`, and that is deliberate (/review 2026-09-22 — it WAS, and
            that was a regression). The block this replaced rendered for everyone in the live
            branch, so an assistant with lineups but not schedule-manage could always READ the
            score even though the pad was closed to them; gating the door shut that off, while the
            recap went on showing the final score to the same person the moment the game ended.
            The sheet already has the right three-way answer — the tournament's sentence, the pad,
            or "The score is kept by your coaching staff." — and that third branch was left
            unreachable by the gate, which is the tell. `can` flags gate AFFORDANCES, not reads.
            ⚠ Mirrored games keep the door too: the sheet is where "Scored by the tournament" is
            explained, and a coach who goes looking deserves that sentence, not a missing control. */}
        <button type="button" className={styles.gdScoreDoor} onClick={() => openSheet('score')}>
          <span>{can.score && !mirrored ? 'Update score' : 'Score'}</span>
          <b className={styles.gdScoreDoorVal}>
            {teamScore ?? '–'}<span className={styles.gdScoreDash}> – </span>{oppScore ?? '–'}
          </b>
          <span aria-hidden>›</span>
        </button>

        {/* The full builder — the Full grid sheet's last line, now that the sheet is gone.
            Batting order, modes and caps were never on this screen and still aren't. */}
        {boardVisible && can.subs && (
          <Link
            href={lineupBuilderHref(base, eventId, { returnTo: `${base}/game/${eventId}` })}
            className={styles.gdDoorRow}
          >
            <span>Open the full builder — batting order, modes, caps</span><span aria-hidden>›</span>
          </Link>
        )}

        {savePill}

        {/* Footer — sticky, safe-area aware; absent entirely for a read-only viewer.
            `data-tight` fires at four or more labelled buttons (P2's Note joins here): the
            labels step down one size so every target still clears the thumb minimum at 340px,
            which is the whole of owner question Q2 (mockup frame 11). */}
        {!readOnlyViewer && (
          <div
            className={`${styles.stickyActionBar} ${styles.gdFooter}`}
            data-tight={footerLabelCount >= 4 ? 'yes' : undefined}
          >
            {/* ⚠ The count was a `<small>` under this label and it is GONE (owner, 2026-09-22:
                "change this button to just 'who's here' to make it fit better, the count and such
                can be on the drawer after clicking it"). "11 HERE · 1 OUT" wrapped to two lines
                inside a 56px button at 390 and squeezed its three neighbours; the count is a
                thing you read once, and the drawer it opens is the place that owns it. */}
            {can.attendance && (
              <button type="button" className={styles.gdFbtn} onClick={() => openSheet('attendance')}>
                Who’s here
              </button>
            )}
            {can.moments && (
              <button type="button" className={styles.gdFbtn} onClick={() => openSheet('moment')}>
                Note
                {moments.length > 0 && <small>{moments.length} TONIGHT</small>}
              </button>
            )}
            {/* ── Scouting, out of the dotted underline (G3 = A, owner 2026-09-22) ─────────
                It was reachable only by knowing the opponent's name was tappable — the weakest
                affordance on the screen, for one of the three jobs this screen is FOR. The name
                keeps its door as the contextual route; this is the one you can see. Absent on a
                TBD opponent, like the name's door, because a book on nobody is a dead end. */}
            {opponentDoor && (
              <button type="button" className={styles.gdFbtn} onClick={() => openSheet('book')}>
                Scouting
              </button>
            )}
            {can.subs && rows.length > 0 && undoStack.length > 0 && (
              <button type="button" className={styles.gdFbtn} onClick={undo} aria-label="Undo the last change">
                <Undo2 size={16} aria-hidden />
              </button>
            )}
            {can.score && !mirrored && (
              <button type="button" className={styles.gdFbtn} data-tone="end" onClick={openEndSheet}>
                End game
              </button>
            )}
          </div>
        )}

        {/* ── Sheets ── */}
        {sheet === 'score' && (
          <div ref={sheetRef} className={styles.gdSheet} role="dialog" aria-label="Score">
            {sheetHead('Score')}
            {mirrored ? (
              <p className={styles.gdQuietNote}>
                Scored by the tournament — standings update automatically. Subs and attendance still work.
              </p>
            ) : can.score ? (
              <>
                <div className={styles.gdScorePad}>
                  {(['us', 'them'] as const).map(side => {
                    const value = side === 'us' ? teamScore : oppScore;
                    return (
                      <div key={side} className={styles.gdScoreCol}>
                        <span className={styles.gdScoreLbl}>{side === 'us' ? 'US' : 'THEM'}</span>
                        {/* Blank means "nothing recorded yet" — rendering null as 0 would read
                            as an already-entered scoreless game. Clearing the field clears the
                            stored score (the quiet path never notifies on a cleared value). */}
                        <input
                          className={styles.gdScoreInput}
                          inputMode="numeric"
                          value={value ?? ''}
                          placeholder="0"
                          aria-label={side === 'us' ? 'Our score' : 'Their score'}
                          onChange={e => {
                            const raw = e.target.value.trim();
                            if (raw === '') {
                              if (side === 'us') setTeamScore(null); else setOppScore(null);
                              setScoreDirty(true);
                              return;
                            }
                            const n = Number(raw);
                            if (!Number.isInteger(n) || n < 0) return;
                            if (side === 'us') setTeamScore(n); else setOppScore(n);
                            setScoreDirty(true);
                          }}
                        />
                        <button type="button" className={styles.gdPlus} data-side={side} onClick={() => bumpScore(side, 1)}>
                          +1 {sportPack.score.unit.toUpperCase()}
                        </button>
                        <button type="button" className={styles.gdMinus} onClick={() => bumpScore(side, -1)}>
                          − correct
                        </button>
                      </div>
                    );
                  })}
                </div>
                <p className={styles.gdQuietNote}>
                  Families aren’t pinged {sportPack.score.unit.toLowerCase()}-by-{sportPack.score.unit.toLowerCase()}.
                  They get one notification — the final score — when you end the game.
                </p>
              </>
            ) : (
              <p className={styles.gdQuietNote}>The score is kept by your coaching staff.</p>
            )}
          </div>
        )}

        {sheet === 'attendance' && (
          <div ref={sheetRef} className={styles.gdSheet} role="dialog" aria-label="Who’s here">
            {sheetHead('Who’s here')}
            {/* The count the footer button used to carry, in the drawer that owns it. */}
            <p className={styles.gdAttCount}>
              {attendingCount} here
              {outCount > 0 ? ` · ${outCount} ${ATTENDANCE_WORD.absent.toLowerCase()}` : ''}
            </p>
            {(data.players).map(p => {
              const current = att[p.id]?.status ?? 'unknown';
              return (
                <div key={p.id} className={styles.gdAttRow}>
                  <span className={styles.gdName}>{playerDisplayName(p)}</span>
                  <span className={styles.gdAttSeg} role="group" aria-label={`Attendance for ${playerName(p)}`}>
                    {ATTENDANCE_OPTIONS.map(option => {
                      const Icon = option.icon;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={styles.gdAttOpt}
                          data-status={option.value}
                          data-on={current === option.value ? 'yes' : undefined}
                          onClick={() => void setAttendance(p.id, option.value)}
                          aria-pressed={current === option.value}
                        >
                          <Icon size={12} aria-hidden /> {option.label}
                        </button>
                      );
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* ── THE POSITION SHEET — the builder's, unchanged (G1 = A, owner 2026-09-22) ─────
            The whole of "make it the lineup editor's experience". One component serves both
            screens, so a pick here and a pick there can never mean different things; the write
            is the same one-cell edit the Full grid's select used to make, and the same single
            undo step.

            ⚠ THE FULL GRID SHEET IS GONE, and with it the only sideways-scrolling table on a
            screen read one-handed at a fence. Correcting a later inning is the pinned stepper
            now — step to it, edit there — which is the same answer the phone builder gives.
            The door to the full builder was the sheet's last line and moves here, because
            batting order, modes and caps were never on this screen. */}
        {isPhone && positionSheetRow && (
          <LineupPositionSheet
            row={positionSheetRow}
            inning={period}
            inningCount={inningCount}
            periodLabel={periodLabel}
            sportPack={sportPack}
            pitcherCap={resolvePlayerPitcherCap(
              positionSheetRow.player.lineupProfile?.pitcher?.maxInnings, teamPitcherCap)}
            onPick={code => { setPositionAt(positionSheetRow.player.id, code); setPositionFor(null); }}
            onClose={() => setPositionFor(null)}
          />
        )}

        {/* The capture sheet (P2, mockup frames 12–13). Quiet sheet, never a modal over the
            game: one line, an optional player, one button. Nothing here notifies anyone. */}
        {sheet === 'moment' && can.moments && (
          <div ref={sheetRef} className={styles.gdSheet} role="dialog" aria-label="Note a moment">
            {sheetHead('Note')}
            {momentSavedCount > 0 && (
              <p className={styles.gdMomentSaved} aria-live="polite">
                <Check size={12} aria-hidden />
                <span>
                  {momentSavedCount === 1 ? 'Saved' : `${momentSavedCount} saved this sitting`} — add another?
                </span>
              </p>
            )}
            {moments.map(m => momentRow(m, deleteMoment))}
            <textarea
              ref={momentInputRef}
              className={styles.gdMomentInput}
              value={momentBody}
              maxLength={GAME_MOMENT_MAX}
              rows={2}
              aria-label="A moment from tonight"
              placeholder="One line about tonight — something worth remembering."
              onChange={e => setMomentBody(e.target.value)}
            />
            <div className={styles.gdMomentMeta}>
              <span>{moments.length > 0 ? 'Remove one you mistyped — moments aren’t edited.' : 'For you and your staff.'}</span>
              <span className={styles.gdMomentCount}>{momentBody.length} / {GAME_MOMENT_MAX}</span>
            </div>

            {/* ⚠ A DROPDOWN, not a wrap of chips (owner, 2026-09-22: "can we make 'about a
                player' a dropdown so we can keep the save button on the screen?"). One chip per
                player is a grid that grows with the roster — on a 13-player team it pushed
                `Save note` off the bottom of the drawer, so the one action the sheet exists for
                was the one thing you had to scroll to find. A select is one 44px row whatever the
                roster does, and it is the portal's ruled form idiom besides.
                The native `<label>` wraps the control, so the visible text IS the accessible
                name — no `aria-label` to drift from what is on screen. */}
            <label className={styles.gdMomentTag}>
              <span>About a player?</span>
              <select
                className={`${styles.select} ${styles.gdMomentTagSelect}`}
                value={momentPlayerId ?? ''}
                onChange={e => setMomentPlayerId(e.target.value || null)}
              >
                <option value="">Nobody in particular</option>
                {/* ⚠ `playerDisplayName` ALREADY prefixes "#2" — the chip this replaced also
                    prefixed the bare number, so it read "2 #2 Blake Test". Pre-existing, and
                    invisible at chip size; a dropdown row puts it in 14px type where it is not. */}
                {data.players.map(p => (
                  <option key={p.id} value={p.id}>{playerDisplayName(p)}</option>
                ))}
              </select>
            </label>

            {momentError && <p className={styles.errorText}>{momentError}</p>}
            <div className={styles.gdSheetActions}>
              <button
                type="button" className={styles.gdBigBtn} data-primary="yes"
                onClick={() => void saveMoment()}
                disabled={momentSaving || momentBody.trim().length === 0}
              >
                {momentSaving ? 'Saving…' : 'Save note'}
              </button>
            </div>
            {/* ⚠ The closing "Moments stay with you and your staff — families are never notified"
                line is GONE (owner, 2026-09-22). The sheet already says it, twice: the meta line
                under the textarea reads "For you and your staff", and the footer button's own
                help article covers the notification rule. A drawer that has to be short should
                not spend a two-line paragraph repeating its own caption. */}
          </div>
        )}

        {drawerScrim}


        {bookSheet}

        {sheet === 'end' && (
          <div ref={sheetRef} className={styles.gdSheet} role="dialog" aria-label="End game">
            {sheetHead('End game')}
            <div className={styles.gdFinal}>
              <span className={styles.gdScoreLbl}>FINAL — {matchupTitle.toUpperCase()}</span>
              <div className={styles.gdFinalScores}>
                <input
                  className={styles.gdScoreInput} inputMode="numeric" value={finalTeam}
                  aria-label="Our final score"
                  onChange={e => setFinalTeam(e.target.value)}
                />
                <span className={styles.gdScoreDash}>–</span>
                <input
                  className={styles.gdScoreInput} inputMode="numeric" value={finalOpp}
                  aria-label="Their final score"
                  onChange={e => setFinalOpp(e.target.value)}
                />
              </div>
              {(() => {
                // Digits-only gate: `Number('')` is 0, and a badge flashing WIN over a field
                // the coach just cleared would be the sheet lying mid-edit.
                const r = isFinalScore(finalTeam) && isFinalScore(finalOpp)
                  ? deriveGameResult(Number(finalTeam), Number(finalOpp))
                  : null;
                return r ? (
                  <span className={styles.gdResBadge} data-result={r}>
                    {r === 'win' ? 'WIN' : r === 'loss' ? 'LOSS' : 'TIE'}
                  </span>
                ) : null;
              })()}
              <p className={styles.gdQuietNote}>Tap a number to correct it before confirming.</p>
            </div>
            <div className={styles.gdSumLines}>
              <span className={styles.gdSumLine}>Substitutions tonight<b>{subCount}</b></span>
              <span className={styles.gdSumLine}>Attendance updated<b>{attChangeCount === 0 ? 'no changes' : `${attChangeCount} change${attChangeCount === 1 ? '' : 's'}`}</b></span>
              {periodAtOpen !== null && period !== periodAtOpen && (
                <span className={styles.gdSumLine}>{sportPack.periodLabelPlural} tracked live<b>{periodAtOpen} → {period}</b></span>
              )}
            </div>
            {/* Tonight's moments read back above the one deliberate act (mockup frame 14).
                A night with none shows NOTHING here — no empty state, no apology — so the
                wrap is byte-identical to the P1 screen for the coach who never taps Note. */}
            {moments.length > 0 && (
              <div className={styles.gdCard} data-inset="yes">
                <p className={styles.gdGroupLbl}>Tonight’s moments</p>
                {moments.map(m => momentRow(m))}
              </div>
            )}
            {/* ⚠ Ending the game is a ONE-WAY flip to the read-only recap, and the capture
                sheet only exists in the live screen — so a line still sitting unsaved in the
                Note sheet becomes unrecoverable the moment this button is tapped. Say so here
                rather than losing it silently (/review 2026-08-05). Deliberately a statement,
                not a blocker: the coach may well have thought better of it. */}
            {momentBody.trim().length > 0 && (
              <p className={styles.gdQuietNote} data-tone="warn">
                You have a moment typed but not saved — go back and save it first, or it won’t be kept.
              </p>
            )}
            <p className={styles.gdQuietNote}>
              {moments.length > 0
                ? 'Moments stay with you and your staff. Confirming sends families the final score — nothing else.'
                : 'Confirming sends families their one notification for tonight and finishes the record.'}
            </p>
            {endError && <p className={styles.errorText}>{endError}</p>}
            <div className={styles.gdSheetActions}>
              <button type="button" className={styles.gdBigBtn} onClick={() => setSheet(null)}>
                Keep coaching
              </button>
              <button
                type="button" className={styles.gdBigBtn} data-primary="yes"
                onClick={() => void confirmEnd()} disabled={endSaving}
              >
                {endSaving ? 'Finishing…' : 'Confirm & notify families'}
              </button>
            </div>
          </div>
        )}

        {/* Swap confirm — the one decision, two big buttons (mockup frame 4). Anchored to the
            period the decision was MADE at (frozen in pendingSwap), not wherever the cursor
            has wandered since. */}
        {pendingSwap && (() => {
          const swapKey = String(pendingSwap.fromPeriod);
          const outRow = pendingSwap.outId ? rows.find(r => r.playerId === pendingSwap.outId) : null;
          // Honesty for "onward" on a planned rotation: the incoming player inherits the
          // outgoing player's REMAINING schedule, which may vary period to period.
          const remaining = outRow
            ? Array.from({ length: inningCount - pendingSwap.fromPeriod + 1 },
                (_, i) => outRow.inningPositions[String(pendingSwap.fromPeriod + i)] || '—')
            : [];
          const varies = new Set(remaining).size > 1;
          // ⚠ `data-card` — the ONE surface here that stays a floating card while the other five
          // became drawers (the owner's 2026-09-22 ruling covered those five). The board behind is
          // the thing this question is ABOUT, so it is not dimmed. See the plan's §3.9 for the
          // argument that it should probably join them; that is an owner call, not a tidy-up, so
          // it is asked rather than assumed.
          return (
            <div ref={swapRef} className={styles.gdSheet} data-card="yes" role="dialog" aria-label="Substitution">
              <div className={styles.gdSheetHead}>
                <b>
                  {nameOf(pendingSwap.inId)}
                  {pendingSwap.outId
                    ? ` in for ${nameOf(pendingSwap.outId)} — ${outRow?.inningPositions[swapKey] || '—'}`
                    : ` — ${pendingSwap.position}`}
                </b>
                <button type="button" className={styles.gdSheetClose} onClick={() => setPendingSwap(null)} aria-label="Close">
                  <X size={16} />
                </button>
              </div>
              <div className={styles.gdSheetActions}>
                <button type="button" className={styles.gdBigBtn} data-primary="yes" onClick={() => applyPendingSwap('onward')}>
                  From {periodLabel.toLowerCase()} {pendingSwap.fromPeriod} on
                </button>
                <button type="button" className={styles.gdBigBtn} onClick={() => applyPendingSwap('single')}>
                  This {periodLabel.toLowerCase()} only
                </button>
              </div>
              <p className={styles.gdQuietNote}>
                {varies && pendingSwap.outId
                  ? `${nameOf(pendingSwap.outId)} was due ${remaining.join(' · ')} — ${nameOf(pendingSwap.inId)} takes those spots. `
                  : ''}
                Saves straight into the game’s lineup — playing-time reports and player recaps update themselves.
              </p>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
