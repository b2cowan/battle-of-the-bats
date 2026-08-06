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
import { getSportPack, DEFAULT_SPORT } from '@/lib/sports';
import { analyzeLineup, BENCH_POSITION } from '@/lib/lineup-analysis';
import { generateBestLineup } from '@/lib/lineup-generator';
import { playerPositionPrefs } from '@/lib/lineup-profile';
import { playerDisplayName, playerName } from '@/lib/coach-roster-name';
import { ATTENDANCE_WORD } from '@/lib/coach-schedule-vocab';
import { ATTENDANCE_OPTIONS } from '@/components/coaches/attendanceOptions';
import { LINEUP_POSITIONS, type LineupSeedEntry } from '@/lib/lineup-grid';
import { ordinal } from '@/lib/playoff-bracket';
import {
  applyBenchOrder, applyConsoleSwap, benchOrderIds, benchOrderStillSorted, benchStreakThrough,
  consoleMode, deriveGameResult, gameDayAwakeKey, gameDayPeriodKey, gameDaySkipLineupKey,
  toGameDayEventShape,
} from '@/lib/coach-game-day';
import { resolveLineupCaps, resolvePlayerPitcherCap } from '@/lib/lineup-caps';
import { useScreenWakeLock } from '@/lib/hooks/useScreenWakeLock';
import { GAME_MOMENT_MAX, sortMomentsNewestFirst } from '@/lib/coach-game-moments';
import { formatInOrgZone } from '@/lib/timezone';
import OpponentScoutingPanel from '@/components/coaches/OpponentScoutingPanel';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
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

type SheetKind = null | 'score' | 'attendance' | 'grid' | 'book' | 'end' | 'moment';

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

  // ── The screen stays on (P3, owner-ruled 2026-08-05) ──────────────────────────────────────
  // Live window only, drive grants only, and never silent — the chip below says it out loud and
  // switches it off in one tap. Read once at mount, the same way this screen reads the clock:
  // no hydration risk, because nothing that depends on either renders until the fetch lands.
  const [awakeSupported] = useState(() => typeof navigator !== 'undefined' && 'wakeLock' in navigator);
  const [awake, setAwake] = useState(() => {
    try { return sessionStorage.getItem(gameDayAwakeKey(eventId)) !== '0'; } catch { return true; }
  });

  // The policy lives HERE (live window, drive grant, coach's own switch); the hook only holds
  // the lock. Review mode never keeps a screen awake, and neither does a helper's console.
  useScreenWakeLock(awake && awakeSupported && live && !readOnlyViewer);

  const toggleAwake = () => {
    setAwake(prev => {
      const next = !prev;
      try { sessionStorage.setItem(gameDayAwakeKey(eventId), next ? '1' : '0'); } catch { /* UI pref only */ }
      return next;
    });
  };

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
    const generated = generateBestLineup({
      players: players.map(p => {
        const prefs = playerPositionPrefs(p, sportPack.pitcherPosition);
        return {
          playerId: p.id, preferred: prefs.preferred, canPlay: prefs.canPlay, never: prefs.never,
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
  /** Any user-initiated sheet open abandons a half-made swap decision — the sheets are
   *  deliberately non-modal, and two open decisions at once is how the wrong one gets tapped. */
  const openSheet = (kind: SheetKind) => {
    setSheet(kind);
    setPendingSwap(null);
    setSubInId(null);
    setCoverFor(null);
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

  const attendingCount = (data?.players ?? []).filter(p => (att[p.id]?.status ?? 'unknown') !== 'absent').length;
  const outCount = (data?.players ?? []).filter(p => att[p.id]?.status === 'absent').length;

  const whoRunsTheBench = data?.headCoachName?.trim()
    ? `${data.headCoachName.trim()} runs the bench.`
    : 'Your coach runs the bench.';

  const derivedResult = event?.result
    ?? deriveGameResult(teamScore, oppScore);

  // ── Render ────────────────────────────────────────────────────────────────────────────────
  const backLink = (
    <Link href={`${base}/schedule?event=${eventId}`} className={styles.gdBack}>
      <ArrowLeft size={13} aria-hidden /> Schedule
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

  const scoreBlock = (
    <button
      type="button"
      className={styles.gdScore}
      onClick={() => openSheet('score')}
      aria-label="Open the score sheet"
      disabled={!live && !ended}
    >
      <span className={styles.gdScoreLbl}>US — THEM</span>
      <span className={styles.gdScoreVal}>
        {teamScore ?? '–'}<span className={styles.gdScoreDash}> – </span>{oppScore ?? '–'}
      </span>
    </button>
  );

  const savePill = (can.subs || can.score) && live ? (
    <span className={styles.saveStatus} aria-live="polite">
      {(lineupError || scoreError)
        ? (
          <button
            type="button"
            className={styles.saveRetry}
            onClick={() => { if (lineupError) void saveLineup(rows); else setScoreDirty(true); }}
          >
            Couldn’t save · Retry
          </button>
        )
        : (lineupSaving || lineupDirty || scoreSaving || scoreDirty)
          ? 'Saving…'
          : <><Check size={12} aria-hidden /> Saved</>}
    </span>
  ) : null;

  // Every sheet wears the same head; one definition instead of six hand-copies.
  const sheetHead = (title: React.ReactNode) => (
    <div className={styles.gdSheetHead}>
      <b>{title}</b>
      <button type="button" className={styles.gdSheetClose} onClick={() => setSheet(null)} aria-label="Close">
        <X size={16} />
      </button>
    </div>
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
  const bookSheet = sheet === 'book' && event.opponent ? (
    <div className={styles.gdSheet} role="dialog" aria-label={`Your book on ${event.opponent}`}>
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
        <div className={styles.gdPage}>
          <div className={styles.gdBar}>
            {backLink}
            <b>Game recap</b>
            <span className={styles.gdBarNote}>Read-only</span>
          </div>

          <div className={styles.gdCard}>
            <div className={styles.gdMatch}>
              {opponentDoor ? (
                <button type="button" className={styles.gdOppDoor} onClick={() => setSheet('book')}>
                  {matchupTitle}
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
            <p className={styles.gdMeta}>{startLine}{event.status === 'cancelled' ? ' · Cancelled' : ''}</p>
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

          <Link href={`${base}/history/playing-time`} className={styles.gdDoorRow}>
            <span>Playing time — season report</span><span aria-hidden>›</span>
          </Link>

          {bookSheet}
        </div>
      </div>
    );
  }

  // ── Live mode ─────────────────────────────────────────────────────────────────────────────
  const showFallback = rows.length === 0 && !skipLineup;
  const boardVisible = rows.length > 0;
  /** LABELLED footer buttons only — the undo arrow is icon-width and keeps its own room. */
  const footerLabelCount = [can.attendance, can.moments, boardVisible, can.score && !mirrored]
    .filter(Boolean).length;

  return (
    <div className={styles.page}>
      <div className={styles.gdPage}>
        <div className={styles.gdBar}>
          {backLink}
          <span className={styles.gdLivePill}>GAME DAY</span>
          {savePill}
        </div>

        {readOnlyViewer && <p className={styles.gdHandedOff}>{whoRunsTheBench}</p>}

        {/* Header strip — matchup, chips, score, period cursor (sticky). */}
        <div className={styles.gdCard} data-sticky="head">
          <div className={styles.gdMatch}>
            {opponentDoor ? (
              // The Scouting Book door (rider): the opponent's name opens your book as a sheet.
              // Absent when the slot is TBD — a door to nothing is a dead end, not a feature.
              <button type="button" className={styles.gdOppDoor} onClick={() => openSheet('book')}>
                {matchupTitle}
              </button>
            ) : (
              <span className={styles.gdOpp}>{matchupTitle}</span>
            )}
            <span className={styles.gdHa}>
              {event.homeAway === 'home' ? 'Home' : event.homeAway === 'away' ? 'Away' : ''}
            </span>
          </div>
          <div className={styles.gdChips}>
            {event.fieldNumber && <span className={styles.gdChip}>{event.fieldNumber}</span>}
            {event.arrivalTime && <span className={styles.gdChip}>Arrive {event.arrivalTime}</span>}
            {event.uniform && <span className={styles.gdChip}>{event.uniform}</span>}
            {/* P3 — the screen-awake switch. Present only where it does something: a live game,
                a coach who runs the bench, a browser that can do it. Never a silent behaviour. */}
            {awakeSupported && !readOnlyViewer && (
              <button
                type="button"
                className={styles.gdChip}
                aria-pressed={awake}
                onClick={toggleAwake}
              >
                {awake ? 'Screen staying on' : 'Screen sleeps normally'}
              </button>
            )}
          </div>
          <div className={styles.gdScoreRow}>
            {scoreBlock}
            <div className={styles.gdPeriod}>
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
          </div>
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

        {/* No-lineup fallback: three doors, never a dead end (plan §3.2). */}
        {showFallback && (
          <div className={styles.gdCard}>
            <p className={styles.gdFallbackLead}>No lineup saved for this game yet.</p>
            {can.subs ? (
              <div className={styles.gdFallbackDoors}>
                <Link href={`${base}/lineups/${eventId}`} className={styles.gdBigBtn} data-primary="yes">
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
                return (
                  <button
                    key={r.playerId}
                    type="button"
                    className={styles.gdRow}
                    data-target={selectingTarget ? 'yes' : undefined}
                    onClick={() => tapFieldRow(r)}
                    disabled={!boardInteractive || (!selectingTarget && !coveringAbsent)}
                  >
                    <span className={styles.gdNum}>{numberOf(r.playerId)}</span>
                    <span className={styles.gdName}>{nameOf(r.playerId)}</span>
                    {isOut && <span className={styles.gdWarn} data-tone="red">{ATTENDANCE_WORD.absent}</span>}
                    {pitched > 0 && cap !== null && (
                      <span className={styles.gdWarn} data-tone={pitched >= cap ? 'red' : undefined}>
                        {pitched} of {cap} {sportPack.periodLabelPlural.toLowerCase()} pitched
                      </span>
                    )}
                    <span className={styles.gdPos}>{pos}</span>
                  </button>
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
                  <span className={styles.gdPos}>{pos}</span>
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
                return (
                  <button
                    key={r.playerId}
                    type="button"
                    className={styles.gdRow}
                    data-selected={subInId === r.playerId ? 'yes' : undefined}
                    data-target={coveringAbsent ? 'yes' : undefined}
                    onClick={() => tapBenchRow(r)}
                    disabled={!boardInteractive || isOut}
                  >
                    <span className={styles.gdNum}>{numberOf(r.playerId)}</span>
                    <span className={styles.gdName}>{nameOf(r.playerId)}</span>
                    {isOut && <span className={styles.gdWarn} data-tone="red">{ATTENDANCE_WORD.absent}</span>}
                    {!isOut && streak >= 2 && (
                      <span className={styles.gdWarn} data-tone="red">
                        {ordinal(streak)} straight {periodLabel.toLowerCase()} sitting
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Footer — sticky, safe-area aware; absent entirely for a read-only viewer.
            `data-tight` fires at four or more labelled buttons (P2's Note joins here): the
            labels step down one size so every target still clears the thumb minimum at 340px,
            which is the whole of owner question Q2 (mockup frame 11). */}
        {!readOnlyViewer && (
          <div
            className={`${styles.stickyActionBar} ${styles.gdFooter}`}
            data-tight={footerLabelCount >= 4 ? 'yes' : undefined}
          >
            {can.attendance && (
              <button type="button" className={styles.gdFbtn} onClick={() => openSheet('attendance')}>
                Who’s here
                <small>{attendingCount} HERE{outCount > 0 ? ` · ${outCount} ${ATTENDANCE_WORD.absent.toUpperCase()}` : ''}</small>
              </button>
            )}
            {can.moments && (
              <button type="button" className={styles.gdFbtn} onClick={() => openSheet('moment')}>
                Note
                {moments.length > 0 && <small>{moments.length} TONIGHT</small>}
              </button>
            )}
            {boardVisible && (
              <button type="button" className={styles.gdFbtn} onClick={() => openSheet('grid')}>
                Full grid
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
          <div className={styles.gdSheet} role="dialog" aria-label="Score">
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
          <div className={styles.gdSheet} role="dialog" aria-label="Who’s here">
            {sheetHead('Who’s here')}
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

        {sheet === 'grid' && (
          <div className={styles.gdSheet} role="dialog" aria-label="Full grid">
            {sheetHead('Full grid')}
            {/* The familiar builder table, for corrections to ANY period (plan §3.3). The primary
                tap flow stays current-onward; batting order and modes stay builder-only. */}
            <div className={styles.scrollX}>
              <table className={styles.gdGridTable}>
                <thead>
                  <tr>
                    <th>Player</th>
                    {Array.from({ length: inningCount }, (_, i) => (
                      <th key={i} data-now={i + 1 === period ? 'yes' : undefined}>{i + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.playerId}>
                      <td className={styles.gdGridName}>{nameOf(r.playerId)}</td>
                      {Array.from({ length: inningCount }, (_, i) => {
                        const k = String(i + 1);
                        const value = r.inningPositions[k] ?? '';
                        return (
                          <td key={k} data-now={i + 1 === period ? 'yes' : undefined}>
                            {can.subs ? (
                              <select
                                value={value}
                                aria-label={`${nameOf(r.playerId)}, ${periodLabel.toLowerCase()} ${k}`}
                                onChange={e => {
                                  const next = rows.map(row => row.playerId === r.playerId
                                    ? { ...row, inningPositions: { ...row.inningPositions, [k]: e.target.value } }
                                    : row);
                                  mutateRows(next);
                                }}
                              >
                                {LINEUP_POSITIONS.map(pos => (
                                  <option key={pos || 'blank'} value={pos}>{pos || '—'}</option>
                                ))}
                              </select>
                            ) : (value || '—')}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Link href={`${base}/lineups/${eventId}`} className={styles.gdDoorRow}>
              <span>Open the full builder — batting order, modes, caps</span><span aria-hidden>›</span>
            </Link>
          </div>
        )}

        {/* The capture sheet (P2, mockup frames 12–13). Quiet sheet, never a modal over the
            game: one line, an optional player, one button. Nothing here notifies anyone. */}
        {sheet === 'moment' && can.moments && (
          <div className={styles.gdSheet} role="dialog" aria-label="Note a moment">
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

            <p className={styles.gdGroupLbl}>About a player? (optional)</p>
            <div className={styles.gdTagPick}>
              {data.players.map(p => (
                <button
                  key={p.id}
                  type="button"
                  className={styles.gdTagChip}
                  data-on={momentPlayerId === p.id ? 'yes' : undefined}
                  aria-pressed={momentPlayerId === p.id}
                  onClick={() => setMomentPlayerId(prev => (prev === p.id ? null : p.id))}
                >
                  {p.playerNumber ? `${p.playerNumber} ` : ''}{playerDisplayName(p)}
                </button>
              ))}
            </div>

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
            <p className={styles.gdQuietNote}>
              Moments stay with you and your staff — families are never notified about them.
            </p>
          </div>
        )}

        {bookSheet}

        {sheet === 'end' && (
          <div className={styles.gdSheet} role="dialog" aria-label="End game">
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
          return (
            <div className={styles.gdSheet} role="dialog" aria-label="Substitution">
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
