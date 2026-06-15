'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, Pencil, X, AlertCircle, Trash2, Check, AlertTriangle, Lock, Unlock, Plus, Minus, Network } from 'lucide-react';
import { Game, Team, Division, Venue, Tournament } from '@/lib/types';
import { checkVenueConflict, buildConflictMap, resolveGameTiming, type ConflictResult, type ConflictInfo } from '@/lib/schedule-conflict';
import { formatTime, formatPoolName } from '@/lib/utils';
import { buildPlaceholderOptions } from '@/lib/playoff-bracket';
import { scoreSubmissionSummary } from '@/lib/tournament-score-audit';
import { Pool } from '@/lib/types';
import s from '../../../admin-common.module.css';
import styles from '../schedule-admin.module.css';

interface GameListProps {
  games: Game[];
  teams: Team[];
  divisions: Division[];
  venues: Venue[];
  viewMode: 'pool' | 'playoff';
  groupByPool: boolean;
  pools?: Pool[];
  onEdit?: (g: Game) => void;
  /** Playoff games only: open the inline bracket canvas editor focused on this
   *  game (structural wiring). When absent, playoff rows edit inline as before. */
  onPlayoffEdit?: (g: Game) => void;
  onFinalize?: (id: string) => void;
  onDelete?: (id: string) => void;
  onCancel?: (id: string) => void;
  onSchedule?: (id: string) => void;
  onToggleGeneratorLock?: (id: string, nextLocked: boolean) => void;
  onSave?: (gameId: string, data: { date: string; time: string; venueId: string; venueFacilityId: string; notes: string; homeTeamId: string; awayTeamId: string; homePlaceholder: string; awayPlaceholder: string }) => Promise<void>;
  onSaveScore?: (gameId: string, homeScore: number, awayScore: number) => Promise<void>;
  /** Mark a game a forfeit; winningSide is the team that showed up and advances. */
  onForfeit?: (gameId: string, winningSide: 'home' | 'away') => Promise<void>;
  onCreateVenue?: () => void;
  mode: 'planning' | 'scoring';
  /** When true, only render games that currently have a venue conflict (planning triage). */
  conflictsOnly?: boolean;
  /** Tournament context used for conflict detection timing resolution. */
  tournament?: Tournament | null;
}

type EditFields = { date: string; time: string; venueId: string; venueFacilityId: string; notes: string; homeTeamId: string; awayTeamId: string; homePlaceholder: string; awayPlaceholder: string };

type ScoreFields = { home: string; away: string };

type LiveState = 'live' | 'overdue' | 'next';

/** Parse a game's local start timestamp from date (YYYY-MM-DD) + time (H:MM[:SS]). */
function parseGameStart(date?: string | null, time?: string | null): number {
  if (!date || !time) return NaN;
  const [h, m] = time.split(':');
  const hh = String(h ?? '').padStart(2, '0');
  const mm = String(m ?? '0').padStart(2, '0');
  return new Date(`${date}T${hh}:${mm}:00`).getTime();
}

export default function GameList({
  games, teams, divisions, venues, viewMode, groupByPool, pools: poolsProp,
  onEdit, onPlayoffEdit, onFinalize, onDelete, onCancel, onSchedule, onToggleGeneratorLock, onSave, onSaveScore, onForfeit, onCreateVenue, mode, conflictsOnly = false, tournament
}: GameListProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editState, setEditState] = useState<Record<string, EditFields>>({});
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});
  const previousStatusesRef = useRef<Map<string, string>>(new Map());

  // Scoring-mode inline state
  const [scoreState, setScoreState] = useState<Record<string, ScoreFields>>({});
  const [scoreSaving, setScoreSaving] = useState<Set<string>>(new Set());
  const [scoreErrors, setScoreErrors] = useState<Record<string, string>>({});

  // ── Live game-row states (B3) — re-evaluate "now" each minute so live/overdue/next advance ──
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const liveStates = useMemo(() => {
    const map = new Map<string, LiveState>();
    const d = new Date(now);
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    let nextId: string | null = null;
    let nextStart = Infinity;
    for (const g of games) {
      // Only un-scored games carry time-based states (submitted already shows "Reviewing").
      if (g.status !== 'scheduled') continue;
      const start = parseGameStart(g.date, g.time);
      if (Number.isNaN(start)) continue;
      const division = divisions.find(dv => dv.id === g.divisionId);
      const { durationMinutes } = resolveGameTiming(division, tournament, g.durationMinutes);
      const end = start + durationMinutes * 60_000;
      if (now < start) {
        if (g.date === todayStr && start < nextStart) { nextStart = start; nextId = g.id; }
      } else if (now < end) {
        map.set(g.id, 'live');
      } else {
        map.set(g.id, 'overdue');
      }
    }
    if (nextId) map.set(nextId, 'next');
    return map;
  }, [games, divisions, tournament, now]);

  // Thumb score steppers (B7) — bump a score without the keyboard; clamps at 0.
  function bumpScore(id: string, side: 'home' | 'away', delta: number) {
    setScoreState(prev => {
      const cur = prev[id] ?? { home: '', away: '' };
      const next = Math.max(0, (parseInt(cur[side], 10) || 0) + delta);
      return { ...prev, [id]: { ...cur, [side]: String(next) } };
    });
  }

  const getTeamName = (id: string) => teams.find(t => t.id === id)?.name ?? null;
  const resolveTeam = (id: string, placeholder?: string) => getTeamName(id) ?? placeholder ?? 'TBD';
  const isNoShow = (id?: string) => !!id && teams.find(t => t.id === id)?.checkInStatus === 'no_show';
  const getVenueName = (venueId?: string, facilityId?: string) => {
    const venue = venueId ? venues.find(d => d.id === venueId) : null;
    if (!venue) return '';
    if (!facilityId) return venue.name;
    const facility = venue.facilities?.find(f => f.id === facilityId);
    return facility ? `${venue.name} — ${facility.name}` : venue.name;
  };
  const getVenueParts = (venueId?: string, facilityId?: string): { name: string; facility: string } => {
    const venue = venueId ? venues.find(d => d.id === venueId) : null;
    if (!venue) return { name: '', facility: '' };
    const facility = facilityId ? venue.facilities?.find(f => f.id === facilityId) : null;
    return { name: venue.name, facility: facility?.name ?? '' };
  };

  useEffect(() => {
    const previousStatuses = previousStatusesRef.current;
    const newlyCancelled = games
      .filter(g => g.status === 'cancelled' && previousStatuses.get(g.id) !== 'cancelled')
      .map(g => g.id);

    if (newlyCancelled.length > 0) {
      setExpanded(prev => {
        const next = new Set(prev);
        newlyCancelled.forEach(id => next.delete(id));
        return next;
      });
    }

    previousStatusesRef.current = new Map(games.map(g => [g.id, g.status]));
  }, [games]);

  function toggleExpand(id: string, game?: Game) {
    const isExpanding = !expanded.has(id);
    setExpanded(prev => {
      const set = new Set(prev);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return set;
    });
    // Initialize edit state the first time a planning-mode row expands
    if (isExpanding && game && mode === 'planning') {
      setEditState(prev => {
        if (prev[id]) return prev;
        return {
          ...prev,
          [id]: {
            date: game.date ?? '',
            time: game.time ?? '',
            venueId: game.venueId ?? '',
            venueFacilityId: game.venueFacilityId ?? '',
            notes: game.notes ?? '',
            homeTeamId: game.homeTeamId ?? '',
            awayTeamId: game.awayTeamId ?? '',
            homePlaceholder: game.homePlaceholder ?? '',
            awayPlaceholder: game.awayPlaceholder ?? '',
          },
        };
      });
    }
    // Initialize score state the first time a scoring-mode row expands
    if (isExpanding && game && mode === 'scoring') {
      setScoreState(prev => {
        if (prev[id]) return prev;
        return {
          ...prev,
          [id]: {
            home: game.homeScore != null ? String(game.homeScore) : '',
            away: game.awayScore != null ? String(game.awayScore) : '',
          },
        };
      });
    }
  }

  function formatDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function renderLiveChip(id: string) {
    const state = liveStates.get(id);
    if (!state) return null;
    const label = state === 'live' ? 'Now' : state === 'overdue' ? 'Overdue' : 'Next';
    return (
      <span className={styles.liveChip} data-live={state}>
        {state === 'live' && <span className={styles.liveChipDot} aria-hidden />}
        {label}
      </span>
    );
  }

  function formatShortDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
  }

  const getPlayoffPriority = (code?: string) => {
    if (!code) return 99;
    if (/^FIN/i.test(code)) return 4;
    if (/^3RD/i.test(code)) return 3;
    if (/^SF/i.test(code)) return 2;
    if (/^QF/i.test(code)) return 1;
    return 5; // Custom/manually-added rounds appear after standard rounds
  };

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // ── Conflict maps ─────────────────────────────────────────────────────────
  // Read-mode badges: which saved games already conflict with each other,
  // including the clashing partner (for "double-booked with…" labels).
  const conflictMap = useMemo((): Map<string, ConflictInfo> => {
    if (!tournament || mode !== 'planning') return new Map();
    return buildConflictMap(
      games.map(g => ({
        id: g.id,
        gameDate: g.date ?? null,
        startTime: g.time ?? null,
        status: g.status ?? null,
        venueId: g.venueId ?? null,
        venueFacilityId: g.venueFacilityId ?? null,
        scheduleFacilityLaneId: g.scheduleFacilityLaneId ?? null,
        divisionId: g.divisionId ?? null,
        durationMinutes: g.durationMinutes ?? null,
      })),
      divisions,
      tournament,
    );
  }, [games, divisions, tournament, mode]);

  // Feature 5: optionally show only games that have a conflict (planning triage).
  const sortedGames = [...games]
    .filter(g => !conflictsOnly || conflictMap.has(g.id))
    .sort((a, b) => {
      if (a.date !== b.date) return (a.date || '9999').localeCompare(b.date || '9999');
      if (a.time !== b.time) return (a.time || '99:99').localeCompare(b.time || '99:99');
      if (viewMode === 'playoff') {
        return getPlayoffPriority(a.bracketCode) - getPlayoffPriority(b.bracketCode);
      }
      return 0;
    });

  // Feature 4: the first conflicting row gets a stable id so the health bar can scroll to it.
  const firstConflictId = sortedGames.find(g => conflictMap.has(g.id))?.id;

  // Inline-edit conflicts: conflict result for any currently expanded+editing row.
  const inlineConflicts = useMemo((): Map<string, ConflictResult | null> => {
    if (mode !== 'planning') return new Map();
    const result = new Map<string, ConflictResult | null>();
    for (const gameId of expanded) {
      const edit = editState[gameId];
      if (!edit || !edit.date || !edit.time) continue;
      if (!edit.venueId && !edit.venueFacilityId) continue;
      const game = games.find(g => g.id === gameId);
      if (!game) continue;

      const conflict = checkVenueConflict({
        proposedGame: {
          id: gameId,
          gameDate: edit.date,
          startTime: edit.time,
          status: 'scheduled',
          venueId: edit.venueId || null,
          venueFacilityId: edit.venueFacilityId || null,
          divisionId: game.divisionId || null,
          durationMinutes: game.durationMinutes ?? null,
        },
        allGames: games.map(g => ({
          id: g.id,
          gameDate: g.date ?? null,
          startTime: g.time ?? null,
          status: g.status ?? null,
          venueId: g.venueId ?? null,
          venueFacilityId: g.venueFacilityId ?? null,
          scheduleFacilityLaneId: g.scheduleFacilityLaneId ?? null,
          divisionId: g.divisionId ?? null,
          durationMinutes: g.durationMinutes ?? null,
        })),
        divisions,
        tournament: tournament ?? null,
      });
      result.set(gameId, conflict);
    }
    return result;
  }, [expanded, editState, games, divisions, tournament, mode]);

  function statusBadge(status: string, source?: string | null) {
    // A passive status label — deliberately borderless (no button-like box) so it
    // never reads as the clickable Finalize control beside it.
    // A PENDING forfeit is status 'submitted' with source 'forfeit' — label it as
    // a forfeit awaiting approval so it never reads as a real played score.
    const pendingForfeit = status === 'submitted' && source === 'forfeit';
    const cfg =
      status === 'completed' ? { label: '✓ Final', tone: 'completed' }
      : status === 'forfeit' ? { label: '⚑ Forfeit', tone: 'completed' }
      : pendingForfeit ? { label: '⚑ Forfeit — Pending', tone: 'submitted' }
      : status === 'submitted' ? { label: '⚠ Pending Review', tone: 'submitted' }
      : status === 'cancelled' ? { label: '✕ Cancelled', tone: 'cancelled' }
      : { label: 'Scheduled', tone: 'scheduled' };
    return <span className={styles.statusTag} data-status={cfg.tone}>{cfg.label}</span>;
  }

  const renderRow = (g: Game) => {
    const isExpanded = expanded.has(g.id);
    const hasScoredResult = mode === 'scoring'
      && (g.status === 'completed' || g.status === 'submitted' || g.status === 'forfeit')
      && g.homeScore != null
      && g.awayScore != null;
    const scoreAuditSummary = hasScoredResult
      ? scoreSubmissionSummary({
          source: g.scoreSubmissionSource,
          email: g.scoreSubmittedByEmail,
          submittedAt: g.scoreSubmittedAt,
        })
      : '';

    // ── SCORING MODE ──────────────────────────────────────────────────────────
    if (mode === 'scoring') {
      const score = scoreState[g.id] ?? { home: '', away: '' };
      const isScoringBusy = scoreSaving.has(g.id);
      const hasExistingScore = g.status === 'completed' || g.status === 'submitted';

      // Derived win/loss/tie for colour coding
      const awayWon  = hasScoredResult && (g.awayScore ?? 0) > (g.homeScore ?? 0);
      const homeWon  = hasScoredResult && (g.homeScore ?? 0) > (g.awayScore ?? 0);
      const isTie    = hasScoredResult && g.awayScore === g.homeScore;

      const handleScoreDiscard = () => {
        setScoreState(prev => { const n = { ...prev }; delete n[g.id]; return n; });
        setScoreErrors(prev => { const n = { ...prev }; delete n[g.id]; return n; });
        setExpanded(prev => { const next = new Set(prev); next.delete(g.id); return next; });
      };

      const handleScoreSave = async () => {
        if (!onSaveScore) return;
        if (score.home === '' || score.away === '') {
          setScoreErrors(prev => ({ ...prev, [g.id]: 'Both scores are required.' }));
          return;
        }
        setScoreSaving(prev => new Set(prev).add(g.id));
        setScoreErrors(prev => { const n = { ...prev }; delete n[g.id]; return n; });
        try {
          await onSaveScore(g.id, Number(score.home), Number(score.away));
          setScoreState(prev => { const n = { ...prev }; delete n[g.id]; return n; });
          setExpanded(prev => { const next = new Set(prev); next.delete(g.id); return next; });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Save failed — please try again.';
          setScoreErrors(prev => ({ ...prev, [g.id]: msg }));
        } finally {
          setScoreSaving(prev => { const next = new Set(prev); next.delete(g.id); return next; });
        }
      };

      const handleForfeit = async (winningSide: 'home' | 'away') => {
        if (!onForfeit) return;
        setScoreSaving(prev => new Set(prev).add(g.id));
        setScoreErrors(prev => { const n = { ...prev }; delete n[g.id]; return n; });
        try {
          await onForfeit(g.id, winningSide);
          setScoreState(prev => { const n = { ...prev }; delete n[g.id]; return n; });
          setExpanded(prev => { const next = new Set(prev); next.delete(g.id); return next; });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Forfeit failed — please try again.';
          setScoreErrors(prev => ({ ...prev, [g.id]: msg }));
        } finally {
          setScoreSaving(prev => { const next = new Set(prev); next.delete(g.id); return next; });
        }
      };

      // Forfeit is offered only on a game with no recorded result yet (scheduled),
      // and only when both teams are known (a TBD/placeholder bracket slot can't
      // forfeit). A game that's already submitted/completed/forfeit is resolved via
      // Finalize/Revert, not a fresh forfeit. The winning side is the team that
      // showed up; the loser is the no-show.
      const canForfeit = Boolean(onForfeit) && !!g.homeTeamId && !!g.awayTeamId
        && g.status === 'scheduled';
      const homeLabel = resolveTeam(g.homeTeamId ?? '', g.homePlaceholder);
      const awayLabel = resolveTeam(g.awayTeamId ?? '', g.awayPlaceholder);

      return (
        <div key={g.id} className={`${s.row} ${styles.scoringRow}`} data-status={g.status} data-live={liveStates.get(g.id) ?? undefined}>
          {/* ── Compact row — scores always visible inline with team names ── */}
          <div className={`${s.rowMain} ${styles.gameRowMain} ${styles.scoringGameRow}`} style={{ gap: '1rem' }}>
            {/* Date · Time · status + venue sub-line */}
            <div className={`${s.gameColDate} ${styles.scoringDateCell}`} style={{ fontFamily: 'var(--font-data)' }}>
              <div className={styles.dateLine}>
                <span style={{ whiteSpace: 'nowrap' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--fl-text)', letterSpacing: '0.01em' }}>
                    {g.date ? formatShortDate(g.date) : 'TBD'}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--data-gray)', marginLeft: '0.4rem' }}>
                    {g.time ? `· ${formatTime(g.time)}` : '· —'}
                  </span>
                  {!isExpanded && (g.status === 'completed' || g.status === 'submitted') && (
                    <span className={styles.scoringMobileStatus} data-status={g.status}>
                      {g.status === 'completed' ? '· ✓ FINAL' : '· ⚠ REVIEWING'}
                    </span>
                  )}
                </span>
                {renderLiveChip(g.id)}
              </div>
              {(g.venueId || g.location) && (() => {
                const vp = g.venueId
                  ? getVenueParts(g.venueId, g.venueFacilityId)
                  : { name: g.location || '', facility: '' };
                return vp.name ? (
                  <div className={styles.venueInDate}>
                    <MapPin size={10} style={{ flexShrink: 0, opacity: 0.55 }} />
                    <span className={styles.venueLine}>
                      {vp.name}{vp.facility ? ` · ${vp.facility}` : ''}
                    </span>
                  </div>
                ) : null;
              })()}
            </div>

            {/* Matchup — symmetric: [W/L · score · Away]  VS  [Home · score · W/L] */}
            <div className={`${s.gameColMatchup} ${styles.scoringMatchupCell}`} data-editing={isExpanded ? 'true' : undefined} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>

              {/* Away side — right-aligned: W/L · score/input · team name */}
              <div style={{ flex: '0 1 auto', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', minWidth: 0 }}>
                {/* W/L indicator — outer left, only in view mode */}
                {hasScoredResult && !isExpanded && (
                  <span style={{ fontFamily: 'var(--font-data)', fontSize: '1rem', fontWeight: 900, flexShrink: 0, color: awayWon ? 'var(--success)' : isTie ? 'var(--warning)' : 'rgba(var(--danger-rgb), 0.6)' }}>
                    {awayWon ? 'W' : isTie ? 'T' : 'L'}
                  </span>
                )}
                {/* Score or input */}
                {isExpanded ? (
                  <span className={styles.scoreStepper}>
                    <button type="button" className={styles.scoreStepBtn} onClick={e => { e.stopPropagation(); bumpScore(g.id, 'away', -1); }} aria-label="Decrease away score"><Minus size={16} /></button>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={score.away}
                      onChange={e => { const v = e.target.value; if (v === '' || /^\d+$/.test(v)) setScoreState(prev => ({ ...prev, [g.id]: { ...prev[g.id], away: v } })); }}
                      className={styles.scoreInlineInput}
                      placeholder="0"
                      autoFocus
                    />
                    <button type="button" className={styles.scoreStepBtn} onClick={e => { e.stopPropagation(); bumpScore(g.id, 'away', 1); }} aria-label="Increase away score"><Plus size={16} /></button>
                  </span>
                ) : hasScoredResult ? (
                  <span className={styles.scoreInlineValue} style={{ color: awayWon ? 'var(--success)' : isTie ? 'var(--warning)' : 'rgba(var(--danger-rgb), 0.65)' }}>
                    {g.awayScore}
                  </span>
                ) : null}
                {/* Team name */}
                {isNoShow(g.awayTeamId) && <span className={styles.noShowTag}>No-show</span>}
                <span className={styles.scoringTeamName} style={{ textAlign: 'right' }} title={resolveTeam(g.awayTeamId, g.awayPlaceholder)}>
                  {resolveTeam(g.awayTeamId, g.awayPlaceholder)}
                </span>
              </div>

              <div style={{ color: 'var(--white-30)', fontFamily: 'var(--font-data)', fontWeight: 900, fontSize: '0.6rem', letterSpacing: '0.12em', flexShrink: 0 }}>VS</div>

              {/* Home side — left-aligned: team name · score/input · W/L */}
              <div style={{ flex: '0 1 auto', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '0.5rem', minWidth: 0 }}>
                {/* Team name */}
                <span className={styles.scoringTeamName} title={resolveTeam(g.homeTeamId, g.homePlaceholder)}>
                  {resolveTeam(g.homeTeamId, g.homePlaceholder)}
                </span>
                {isNoShow(g.homeTeamId) && <span className={styles.noShowTag}>No-show</span>}
                {/* Score or input */}
                {isExpanded ? (
                  <span className={styles.scoreStepper}>
                    <button type="button" className={styles.scoreStepBtn} onClick={e => { e.stopPropagation(); bumpScore(g.id, 'home', -1); }} aria-label="Decrease home score"><Minus size={16} /></button>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={score.home}
                      onChange={e => { const v = e.target.value; if (v === '' || /^\d+$/.test(v)) setScoreState(prev => ({ ...prev, [g.id]: { ...prev[g.id], home: v } })); }}
                      className={styles.scoreInlineInput}
                      placeholder="0"
                    />
                    <button type="button" className={styles.scoreStepBtn} onClick={e => { e.stopPropagation(); bumpScore(g.id, 'home', 1); }} aria-label="Increase home score"><Plus size={16} /></button>
                  </span>
                ) : hasScoredResult ? (
                  <span className={styles.scoreInlineValue} style={{ color: homeWon ? 'var(--success)' : isTie ? 'var(--warning)' : 'rgba(var(--danger-rgb), 0.65)' }}>
                    {g.homeScore}
                  </span>
                ) : null}
                {/* W/L indicator — outer right, only in view mode */}
                {hasScoredResult && !isExpanded && (
                  <span style={{ fontFamily: 'var(--font-data)', fontSize: '1rem', fontWeight: 900, flexShrink: 0, color: homeWon ? 'var(--success)' : isTie ? 'var(--warning)' : 'rgba(var(--danger-rgb), 0.6)' }}>
                    {homeWon ? 'W' : isTie ? 'T' : 'L'}
                  </span>
                )}
              </div>
            </div>

            {/* Right rail — status (desktop) · Finalize · Edit pencil */}
            <div className={styles.scoringRailCell} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
              {(g.homeSlotId || g.awaySlotId) && !g.isPlayoff && (
                <span className="badge badge-neutral" style={{ fontSize: '0.65rem', letterSpacing: '0.05em' }}>SLOT</span>
              )}
              {/* Desktop-only status badge — hidden on mobile where scoringStatusRow renders it */}
              <div className={`${s.gameStatusSlot} ${styles.desktopStatusSlot}`}>{statusBadge(g.status, g.scoreSubmissionSource)}</div>
              {/* Finalize — quick-access, rendered only when relevant (no fixed-width wrapper) */}
              {!isExpanded && onFinalize && g.status === 'submitted' && (
                <button className="btn btn-success btn-data" onClick={e => { e.stopPropagation(); onFinalize(g.id); }}>
                  Finalize
                </button>
              )}
              {/* Pencil — only visible when not editing */}
              <div style={{ width: 28, display: 'flex', justifyContent: 'center' }}>
                {!isExpanded && (
                  <button
                    className={s.iconBtn}
                    title={hasExistingScore ? 'Edit score' : 'Enter score'}
                    onClick={e => { e.stopPropagation(); toggleExpand(g.id, g); }}
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Slim action bar — only while editing ── */}
          {isExpanded && (
            <div className={styles.scoreActionBar}>
              <div className={styles.scoreActionBarLeft}>
                {hasExistingScore && onSchedule && (
                  <button className="btn btn-ghost btn-data" style={{ color: 'rgba(var(--warning-rgb), 0.8)', flexShrink: 0 }} onClick={e => { e.stopPropagation(); onSchedule(g.id); }}>
                    <X size={13} /> Revert Score
                  </button>
                )}
                {canForfeit && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--data-gray)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>No-show:</span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-data"
                      style={{ color: 'rgba(var(--warning-rgb), 0.85)' }}
                      disabled={isScoringBusy}
                      title={`${awayLabel} forfeits — ${homeLabel} advances`}
                      onClick={e => { e.stopPropagation(); void handleForfeit('home'); }}
                    >
                      {awayLabel}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-data"
                      style={{ color: 'rgba(var(--warning-rgb), 0.85)' }}
                      disabled={isScoringBusy}
                      title={`${homeLabel} forfeits — ${awayLabel} advances`}
                      onClick={e => { e.stopPropagation(); void handleForfeit('away'); }}
                    >
                      {homeLabel}
                    </button>
                  </span>
                )}
                {hasExistingScore && scoreAuditSummary && (
                  <span className={styles.scoreActionBarAudit}>{scoreAuditSummary}</span>
                )}
                {scoreErrors[g.id] && (
                  <span className={styles.saveError}>{scoreErrors[g.id]}</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
                <button className="btn btn-ghost btn-data" onClick={handleScoreDiscard}>Discard</button>
                <button
                  className="btn btn-lime btn-data"
                  disabled={isScoringBusy || !onSaveScore}
                  onClick={handleScoreSave}
                >
                  {isScoringBusy ? 'Saving…' : <><Check size={13} /> Save Result</>}
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

    // ── PLANNING MODE ─────────────────────────────────────────────────────────
    const edit = editState[g.id] ?? {
      date: g.date ?? '',
      time: g.time ?? '',
      venueId: g.venueId ?? '',
      venueFacilityId: g.venueFacilityId ?? '',
      notes: g.notes ?? '',
      homeTeamId: g.homeTeamId ?? '',
      awayTeamId: g.awayTeamId ?? '',
      homePlaceholder: g.homePlaceholder ?? '',
      awayPlaceholder: g.awayPlaceholder ?? '',
    };
    const isSaving = saving.has(g.id);

    const handleDiscard = () => {
      setEditState(prev => ({
        ...prev,
        [g.id]: { date: g.date ?? '', time: g.time ?? '', venueId: g.venueId ?? '', venueFacilityId: g.venueFacilityId ?? '', notes: g.notes ?? '', homeTeamId: g.homeTeamId ?? '', awayTeamId: g.awayTeamId ?? '', homePlaceholder: g.homePlaceholder ?? '', awayPlaceholder: g.awayPlaceholder ?? '' },
      }));
      setSaveErrors(prev => { const n = { ...prev }; delete n[g.id]; return n; });
      setExpanded(prev => { const next = new Set(prev); next.delete(g.id); return next; });
    };

    const inlineConflict = inlineConflicts.get(g.id) ?? null;

    const handleSave = async () => {
      if (!onSave) return;
      // Hard block: do not allow saving when a true overlap exists.
      if (inlineConflict?.kind === 'overlap') return;
      setSaving(prev => new Set(prev).add(g.id));
      setSaveErrors(prev => { const n = { ...prev }; delete n[g.id]; return n; });
      try {
        await onSave(g.id, edit);
        setEditState(prev => { const n = { ...prev }; delete n[g.id]; return n; });
        setExpanded(prev => { const next = new Set(prev); next.delete(g.id); return next; });
      } catch {
        setSaveErrors(prev => ({ ...prev, [g.id]: 'Save failed — please try again.' }));
      } finally {
        setSaving(prev => { const next = new Set(prev); next.delete(g.id); return next; });
      }
    };

    const isCompleted = g.status === 'completed';
    const isCancelled = g.status === 'cancelled';
    const locksEditing = isCompleted;
    const isGeneratorLocked = Boolean(g.generatorLocked);
    const canToggleGeneratorLock = Boolean(onToggleGeneratorLock && g.status === 'scheduled');
    const venueLabel = g.venueId ? getVenueName(g.venueId, g.venueFacilityId) : (g.location || '');
    const venueParts = g.venueId
      ? getVenueParts(g.venueId, g.venueFacilityId)
      : { name: g.location || '', facility: '' };

    return (
      <div
        key={g.id}
        id={g.id === firstConflictId ? 'schedule-first-conflict' : undefined}
        className={`${s.row} ${styles.planningRow} ${isExpanded ? styles.expanded : ''}`}
        data-status={g.status}
        data-live={liveStates.get(g.id) ?? undefined}
        data-conflict={conflictMap.get(g.id)?.kind ?? undefined}
      >
        {/* ── Compact planning row ── */}
        <div
          className={`${s.rowMain} ${styles.gameRowMain} ${styles.planningGameRow}`}
          onClick={locksEditing ? undefined : () => toggleExpand(g.id, g)}
          style={{ cursor: locksEditing ? 'default' : 'pointer', gap: '1rem' }}
        >
          {/* Date + Time + venue sub-line */}
          <div className={`${s.gameColDate} ${styles.planningDateCell}`} style={{ fontFamily: 'var(--font-data)' }}>
            <div className={styles.dateLine}>
              <span style={{ whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--fl-text)' }}>
                  {g.date ? formatShortDate(g.date) : 'TBD'}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--data-gray)', marginLeft: '0.4rem' }}>
                  {g.time ? `· ${formatTime(g.time)}` : '· —'}
                </span>
                {g.status !== 'scheduled' && (
                  <span className={styles.mobileStatusTag} data-status={g.status}>
                    {g.status === 'completed' ? '· ✓ Final' : g.status === 'submitted' ? '· ⚠ Pending' : '· ✕ Cancelled'}
                  </span>
                )}
                {!isExpanded && conflictMap.has(g.id) && (
                  <span className={styles.mobileConflictTag} data-kind={conflictMap.get(g.id)!.kind}>
                    {conflictMap.get(g.id)!.kind === 'overlap' ? '· ⚠ Conflict' : '· ⚠ Buffer'}
                  </span>
                )}
              </span>
              {renderLiveChip(g.id)}
            </div>
            {venueParts.name && (
              <div className={styles.venueInDate}>
                <MapPin size={10} style={{ flexShrink: 0, opacity: 0.55 }} />
                <span className={styles.venueLine}>
                  {venueParts.name}{venueParts.facility ? ` · ${venueParts.facility}` : ''}
                </span>
              </div>
            )}
          </div>

          {/* Matchup */}
          <div className={`${s.gameColMatchup} ${styles.planningMatchup}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.65rem' }}>
            <div className={styles.planningTeamAway} title={resolveTeam(g.awayTeamId, g.awayPlaceholder)}>
              {isNoShow(g.awayTeamId) && <span className={styles.noShowTag}>No-show</span>}
              {resolveTeam(g.awayTeamId, g.awayPlaceholder)}
            </div>
            <div className={styles.planningVs} style={{ fontFamily: 'var(--font-data)', fontSize: '0.58rem', fontWeight: 900, color: 'var(--white-25)', letterSpacing: '0.1em', flexShrink: 0 }}>VS</div>
            <div className={styles.planningTeamHome} title={resolveTeam(g.homeTeamId, g.homePlaceholder)}>
              {resolveTeam(g.homeTeamId, g.homePlaceholder)}
              {isNoShow(g.homeTeamId) && <span className={styles.noShowTag}>No-show</span>}
            </div>
          </div>

          {/* Fixed-width status area — desktop badge only; mobile handled by mobileStatusTag in date cell */}
          <div className={styles.planningStatusCell}>
            {g.status !== 'scheduled' && (
              <span className={styles.desktopStatusBadge}>{statusBadge(g.status, g.scoreSubmissionSource)}</span>
            )}
            {(g.homeSlotId || g.awaySlotId) && !g.isPlayoff && (
              <span className="badge badge-neutral" style={{ fontSize: '0.6rem', letterSpacing: '0.04em' }}>SLOT</span>
            )}
            {isGeneratorLocked && g.status === 'scheduled' && !g.isPlayoff && (
              <span className={styles.generatorLockBadge} title="Kept during Build from current regeneration">
                <Lock size={9} /> KEPT
              </span>
            )}
            {/* Conflict badge — read mode only (not while editing). Tokenized + names the clash. */}
            {!isExpanded && (() => {
              const info = conflictMap.get(g.id);
              if (!info) return null;
              const isOverlap = info.kind === 'overlap';
              const partner = games.find(x => x.id === info.partnerId);
              const partnerName = partner ? (partner.bracketCode || resolveTeam(partner.homeTeamId, partner.homePlaceholder)) : '';
              const partnerTime = info.partnerTime ? formatTime(info.partnerTime) : '';
              const title = partner
                ? `${isOverlap ? 'Double-booked with' : 'Too close to'} ${partnerName}${partnerTime ? ` · ${partnerTime}` : ''}`
                : (isOverlap ? 'Venue conflict: game windows overlap' : 'Buffer zone warning: games are too close together');
              return (
                <span className={styles.conflictBadge} data-kind={info.kind} title={title}>
                  <AlertTriangle size={9} />
                  {isOverlap ? 'CONFLICT' : 'BUFFER'}
                </span>
              );
            })()}
          </div>

          {/* Playoff games: jump to the bracket canvas editor (structural wiring),
              focused on this game. Inline expand still handles quick scheduling. */}
          {g.isPlayoff && onPlayoffEdit && !isExpanded && (
            <button
              className={`${s.iconBtn} ${styles.playoffEditIconBtn}`}
              onClick={e => { e.stopPropagation(); onPlayoffEdit(g); }}
              style={{ flexShrink: 0 }}
              title="Edit in bracket builder"
              aria-label="Edit in bracket builder"
            >
              <Network size={15} />
            </button>
          )}

          {/* Chevron — hidden for completed games */}
          {!locksEditing ? (
            <button
              className={s.iconBtn}
              data-role="schedule-expand"
              onClick={e => { e.stopPropagation(); toggleExpand(g.id, g); }}
              style={{ flexShrink: 0 }}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          ) : (
            <div className={styles.planningExpandPlaceholder} style={{ width: 28, flexShrink: 0 }} />
          )}
        </div>

        {isExpanded && isCancelled && (
          <div className={styles.cancelledActionBar}>
            <span className={styles.cancelledActionText}>Cancelled games must be reinstated before details can be changed.</span>
            <div className={styles.cancelledActions}>
              {onSchedule && (
                <button className="btn btn-lime btn-data" onClick={() => onSchedule(g.id)}>
                  <AlertCircle size={13} /> Reinstate
                </button>
              )}
              {onDelete && (
                <button className="btn btn-danger btn-data" onClick={() => onDelete(g.id)}>
                  <Trash2 size={13} /> Delete
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Inline edit panel ── */}
        {isExpanded && !isCancelled && (
          <div className={styles.inlineForm}>
            {(() => {
              const info = conflictMap.get(g.id);
              if (!info) return null;
              const isOverlap = info.kind === 'overlap';
              const partner = games.find(x => x.id === info.partnerId);
              const partnerName = partner
                ? (partner.bracketCode || `${resolveTeam(partner.awayTeamId, partner.awayPlaceholder)} vs ${resolveTeam(partner.homeTeamId, partner.homePlaceholder)}`)
                : 'another game';
              const partnerTime = info.partnerTime ? formatTime(info.partnerTime) : '';
              return (
                <div className={styles.conflictBanner} data-kind={info.kind}>
                  <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                  <span>
                    {isOverlap ? 'Double-booked with ' : 'Too close to '}
                    <strong>{partnerName}</strong>
                    {partnerTime ? ` · ${partnerTime}` : ''}
                    {isOverlap ? ' at this venue.' : ' — buffer too short.'}
                  </span>
                </div>
              );
            })()}
            <div className={styles.inlineFormBody}>
              {/* Date */}
              <div className={styles.formField}>
                <label className={styles.formLabel}>Date</label>
                <input
                  type="date"
                  className={styles.formInput}
                  value={edit.date}
                  onChange={e => setEditState(prev => ({ ...prev, [g.id]: { ...prev[g.id], date: e.target.value } }))}
                />
              </div>
              {/* Time */}
              <div className={styles.formField}>
                <label className={styles.formLabel}>Time</label>
                <input
                  type="time"
                  className={styles.formInput}
                  value={edit.time}
                  onChange={e => setEditState(prev => ({ ...prev, [g.id]: { ...prev[g.id], time: e.target.value } }))}
                />
              </div>
              {/* Venue / Facility */}
              <div className={styles.formField}>
                <label className={styles.formLabel}>Venue / Facility</label>
                <select
                  className={styles.formSelect}
                  value={edit.venueFacilityId || edit.venueId}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '__create__') {
                      onCreateVenue?.();
                      return;
                    }
                    // Find which venue owns this facility ID
                    let parentVenueId = '';
                    let facilityId = '';
                    for (const v of venues) {
                      const fac = v.facilities?.find(f => f.id === val);
                      if (fac) { parentVenueId = v.id; facilityId = fac.id; break; }
                    }
                    // Fallback: val might be a raw venueId (backward compat / venues without facilities)
                    if (!parentVenueId && venues.find(v => v.id === val)) {
                      parentVenueId = val;
                    }
                    setEditState(prev => ({
                      ...prev,
                      [g.id]: { ...prev[g.id], venueId: parentVenueId, venueFacilityId: facilityId },
                    }));
                  }}
                >
                  <option value="">— TBD —</option>
                  {venues.filter(v => (v.facilities?.length ?? 0) > 0).map(v => (
                    <optgroup key={v.id} label={v.name}>
                      {v.facilities!.map(f => (
                        <option key={f.id} value={f.id}>{v.name} — {f.name}</option>
                      ))}
                    </optgroup>
                  ))}
                  {/* Venues without facilities (pre-migration or newly created): show flat */}
                  {venues.filter(v => (v.facilities?.length ?? 0) === 0).map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                  <option disabled>──────────</option>
                  <option value="__create__">＋ Add venue…</option>
                </select>
              </div>
              {/* Away / Home participants — order matches row display (away left, home right).
                  Playoff games wire by Seed/Winner/Loser placeholder (or a known team);
                  round-robin games pick a team directly. */}
              {!g.homeSlotId && !g.awaySlotId && (g.isPlayoff ? (() => {
                const divPo = divisions.find(d => d.id === g.divisionId);
                const seedCount = (divPo?.playoffConfig?.teamsQualifying as number | undefined)
                  || teams.filter(t => t.divisionId === g.divisionId).length || 8;
                const codes = games
                  .filter(x => x.isPlayoff && x.divisionId === g.divisionId && x.bracketCode && x.id !== g.id)
                  .map(x => x.bracketCode as string);
                const opts = buildPlaceholderOptions(seedCount, codes);
                const dteams = teams.filter(t => t.divisionId === g.divisionId);
                // Each Seed / Winner / Loser feeds exactly one slot: hide refs
                // already wired into another game (and this game's other side).
                const assignedElsewhere = new Set(
                  games
                    .filter(x => x.isPlayoff && x.divisionId === g.divisionId && x.id !== g.id)
                    .flatMap(x => [x.homePlaceholder, x.awayPlaceholder])
                    .filter((x): x is string => !!x),
                );
                const setSide = (isHome: boolean, v: string) => {
                  const teamId = v.startsWith('team:') ? v.slice(5) : '';
                  const ph = v.startsWith('ph:') ? v.slice(3) : '';
                  setEditState(prev => ({
                    ...prev,
                    [g.id]: { ...prev[g.id], ...(isHome
                      ? { homeTeamId: teamId, homePlaceholder: ph }
                      : { awayTeamId: teamId, awayPlaceholder: ph }) },
                  }));
                };
                const sideSelect = (isHome: boolean, label: string) => {
                  const teamId = isHome ? edit.homeTeamId : edit.awayTeamId;
                  const ph = isHome ? edit.homePlaceholder : edit.awayPlaceholder;
                  const otherPh = isHome ? edit.awayPlaceholder : edit.homePlaceholder;
                  const value = teamId ? `team:${teamId}` : ph ? `ph:${ph}` : '';
                  const avail = (s: string) => s === ph || (!assignedElsewhere.has(s) && s !== otherPh);
                  const seeds = opts.seeds.filter(avail);
                  const winners = opts.winners.filter(avail);
                  const losers = opts.losers.filter(avail);
                  return (
                    <div className={styles.formField}>
                      <label className={styles.formLabel}>{label}</label>
                      <select className={styles.formSelect} value={value} onChange={e => setSide(isHome, e.target.value)}>
                        <option value="">— TBD —</option>
                        {seeds.length > 0 && <optgroup label="Seeds">{seeds.map(sd => <option key={sd} value={`ph:${sd}`}>{sd}</option>)}</optgroup>}
                        {winners.length > 0 && <optgroup label="Winner of…">{winners.map(sd => <option key={sd} value={`ph:${sd}`}>{sd}</option>)}</optgroup>}
                        {losers.length > 0 && <optgroup label="Loser of…">{losers.map(sd => <option key={sd} value={`ph:${sd}`}>{sd}</option>)}</optgroup>}
                        {dteams.length > 0 && <optgroup label="Teams">{dteams.map(t => <option key={t.id} value={`team:${t.id}`}>{t.name}</option>)}</optgroup>}
                      </select>
                    </div>
                  );
                };
                return (
                  <div className={styles.formFieldFull} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    {sideSelect(false, 'Away')}
                    {sideSelect(true, 'Home')}
                  </div>
                );
              })() : (
                <div className={styles.formFieldFull} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className={styles.formField}>
                    <label className={styles.formLabel}>Away Team</label>
                    <select
                      className={styles.formSelect}
                      value={edit.awayTeamId}
                      onChange={e => setEditState(prev => ({ ...prev, [g.id]: { ...prev[g.id], awayTeamId: e.target.value } }))}
                    >
                      <option value="">— TBD —</option>
                      {teams.filter(t => t.divisionId === g.divisionId).map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.formLabel}>Home Team</label>
                    <select
                      className={styles.formSelect}
                      value={edit.homeTeamId}
                      onChange={e => setEditState(prev => ({ ...prev, [g.id]: { ...prev[g.id], homeTeamId: e.target.value } }))}
                    >
                      <option value="">— TBD —</option>
                      {teams.filter(t => t.divisionId === g.divisionId).map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}

              {/* Notes — full width */}
              <div className={`${styles.formField} ${styles.formFieldFull}`}>
                <label className={styles.formLabel}>Notes</label>
                <textarea
                  className={styles.formTextarea}
                  value={edit.notes}
                  onChange={e => setEditState(prev => ({ ...prev, [g.id]: { ...prev[g.id], notes: e.target.value } }))}
                  placeholder="Optional game notes…"
                  rows={2}
                />
              </div>
            </div>

            {/* Inline conflict banner */}
            {inlineConflict && (
              <div style={{
                margin: '0 0 0.5rem',
                padding: '0.55rem 0.75rem',
                borderRadius: '2px',
                background: inlineConflict.kind === 'overlap' ? 'rgba(239,68,68,0.08)' : 'rgba(251,191,36,0.08)',
                border: `1px solid ${inlineConflict.kind === 'overlap' ? 'rgba(239,68,68,0.4)' : 'rgba(251,191,36,0.35)'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <p style={{
                    fontWeight: 700, fontSize: '0.78rem', margin: 0,
                    color: inlineConflict.kind === 'overlap' ? '#f87171' : '#fbbf24',
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                  }}>
                    <AlertTriangle size={12} />
                    {inlineConflict.kind === 'overlap'
                      ? `${inlineConflict.conflictingDivisionName} overlaps this slot`
                      : `${inlineConflict.conflictingDivisionName} — within buffer window`}
                  </p>
                  <button
                    type="button"
                    className="btn btn-outline btn-data"
                    style={{ fontSize: '0.75rem', height: '26px', padding: '0 0.5rem', whiteSpace: 'nowrap' }}
                    onClick={() => setEditState(prev => ({ ...prev, [g.id]: { ...prev[g.id], time: inlineConflict.availableAt } }))}
                  >
                    Use {formatTime(inlineConflict.availableAt)} ↑
                  </button>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className={styles.inlineFormFooter}>
              <div className={styles.inlineFormActions}>
                {canToggleGeneratorLock && (
                  <button
                    type="button"
                    className={`btn btn-ghost btn-data ${styles.generatorLockAction}`}
                    title={isGeneratorLocked ? 'Allow the generator to replace this game in Build from current mode' : 'Keep this game fixed during Build from current regeneration'}
                    onClick={() => onToggleGeneratorLock?.(g.id, !isGeneratorLocked)}
                  >
                    {isGeneratorLocked ? <Unlock size={13} /> : <Lock size={13} />}
                    {isGeneratorLocked ? 'Release' : 'Keep'}
                  </button>
                )}
                {onCancel && g.status === 'scheduled' && (
                  <button className={`btn btn-ghost btn-data ${styles.inlineCancelButton}`} onClick={() => onCancel(g.id)}>
                    <X size={13} /> Cancel Game
                  </button>
                )}
                {onSchedule && g.status === 'cancelled' && (
                  <button className="btn btn-ghost btn-data" onClick={() => onSchedule(g.id)}>
                    <AlertCircle size={13} /> Reinstate
                  </button>
                )}
                {onDelete && (
                  <button className="btn btn-danger btn-data" onClick={() => onDelete(g.id)}>
                    <Trash2 size={13} /> Delete
                  </button>
                )}
                {g.isPlayoff && onPlayoffEdit && (
                  <button className="btn btn-ghost btn-data" onClick={() => onPlayoffEdit(g)} title="Open this game in the bracket canvas to rewire matchups">
                    <Network size={13} /> Edit in bracket
                  </button>
                )}
                {saveErrors[g.id] && (
                  <span className={styles.saveError}>{saveErrors[g.id]}</span>
                )}
                <span className={styles.inlineActionSpacer} />
                <button className="btn btn-ghost btn-data" onClick={handleDiscard}>
                  Discard
                </button>
                {inlineConflict?.kind === 'buffer' ? (
                  <button
                    className="btn btn-outline btn-data"
                    style={{ borderColor: 'rgba(251,191,36,0.5)', color: '#fbbf24' }}
                    disabled={isSaving || !onSave}
                    onClick={handleSave}
                  >
                    {isSaving ? 'Saving…' : <><Check size={13} /> Save Anyway</>}
                  </button>
                ) : (
                  <button
                    className="btn btn-lime btn-data"
                    disabled={isSaving || !onSave || inlineConflict?.kind === 'overlap'}
                    title={inlineConflict?.kind === 'overlap' ? 'Resolve the venue conflict before saving' : undefined}
                    onClick={handleSave}
                  >
                    {isSaving ? 'Saving…' : <><Check size={13} /> Save</>}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const firstGameGroupId = games[0]?.divisionId;
  const currentDivision = divisions.find(g => g.id === firstGameGroupId);
  const pools = currentDivision?.pools || [];

  return (
    <div className={s.flatList}>
      <div className={s.tableHeader} style={{ gap: '1rem' }}>
        <div className={s.gameColDate}>Date / Location</div>
        <div className={s.gameColMatchup} style={{ textAlign: 'center' }}>Matchup</div>
        <div style={{ flex: '0 0 96px' }} />
        <div style={{ flex: '0 0 28px' }} />
      </div>

      <div className={s.compactListContent}>
        {/* Playoff View */}
        {viewMode === 'playoff' && (() => {
          function groupByRound(gList: Game[]) {
            const rounds: Record<string, Game[]> = {};
            gList.forEach(g => {
              const code = g.bracketCode || 'OTHER';
              let prefix: string;
              if (/^QF/i.test(code)) prefix = 'QF';
              else if (/^SF/i.test(code)) prefix = 'SF';
              else if (/^(FIN|IF|3RD)$/i.test(code)) prefix = 'FIN';
              else if (code === 'OTHER') prefix = 'OTHER';
              else prefix = code;
              if (!rounds[prefix]) rounds[prefix] = [];
              rounds[prefix].push(g);
            });
            const standardOrder = ['QF', 'SF', 'FIN'];
            const standardLabels: Record<string, string> = { QF: 'Quarterfinals', SF: 'Semifinals', FIN: 'Finals' };
            const activeStandard = standardOrder.filter(r => rounds[r]);
            const customKeys = Object.keys(rounds).filter(k => !standardOrder.includes(k) && k !== 'OTHER');
            return [
              ...activeStandard.map(r => ({ key: r, label: standardLabels[r], games: rounds[r] })),
              ...customKeys.map(k => ({ key: k, label: k, games: rounds[k] })),
              ...(rounds['OTHER'] ? [{ key: 'OTHER', label: 'Additional Games', games: rounds['OTHER'] }] : []),
            ];
          }

          // Detect pool-split bracket from placeholder data + per-pool bracketIds
          const activePools = poolsProp || [];
          const hasPoolPlaceholders = activePools.length >= 2 && sortedGames.some(g =>
            activePools.some(p => {
              const bare = p.name.replace(/^Pool\s+/i, '').trim();
              const tag = `Pool ${bare}`;
              return g.homePlaceholder?.includes(tag) || g.awayPlaceholder?.includes(tag);
            })
          );

          if (hasPoolPlaceholders) {
            // Group games by bracketId; infer pool name from direct placeholders
            const byBracketId: Record<string, Game[]> = {};
            sortedGames.forEach(g => {
              const bid = g.bracketId || 'default';
              if (!byBracketId[bid]) byBracketId[bid] = [];
              byBracketId[bid].push(g);
            });

            const poolSections: Array<{ poolName: string; games: Game[] }> = [];
            Object.entries(byBracketId).forEach(([, bGames]) => {
              let poolName: string | null = null;
              for (const g of bGames) {
                for (const p of activePools) {
                  const bare = p.name.replace(/^Pool\s+/i, '').trim();
                  if (g.homePlaceholder?.includes(`Pool ${bare}`) || g.awayPlaceholder?.includes(`Pool ${bare}`)) {
                    poolName = p.name;
                    break;
                  }
                }
                if (poolName) break;
              }
              poolSections.push({ poolName: poolName || 'Other', games: bGames });
            });

            // Sort by pool name then render
            poolSections.sort((a, b) => a.poolName.localeCompare(b.poolName));

            return poolSections.map(({ poolName, games: poolGames }) => (
              <div key={poolName}>
                <div className={s.poolSubHeader} style={{ marginTop: '1rem' }}>
                  <div className={s.poolDot} style={{ background: 'var(--logic-lime)' }} />
                  <span className={s.poolSubLabel} style={{ color: 'var(--logic-lime)', fontSize: '0.7rem' }}>
                    {formatPoolName(poolName)} PLAYOFFS
                  </span>
                  <span className={s.poolSubCount}>({poolGames.length})</span>
                </div>
                {groupByRound(poolGames).map(({ key, label, games: rGames }) => (
                  <div key={key} className={s.poolSubSection}>
                    <div className={s.poolSubHeader} style={{ paddingLeft: '1.5rem' }}>
                      <div className={s.poolDot} style={{ background: 'var(--white-20)' }} />
                      <span className={s.poolSubLabel}>{label}</span>
                      <span className={s.poolSubCount}>({rGames.length})</span>
                    </div>
                    {rGames.map(g => renderRow(g))}
                  </div>
                ))}
              </div>
            ));
          }

          // Flat playoff view (standard/reseed crossover)
          return groupByRound(sortedGames).map(({ key, label, games: rGames }) => (
            <div key={key} className={s.poolSubSection}>
              <div className={s.poolSubHeader}>
                <div className={s.poolDot} style={{ background: 'var(--logic-lime)' }} />
                <span className={s.poolSubLabel}>{label}</span>
                <span className={s.poolSubCount}>({rGames.length})</span>
              </div>
              {rGames.map(g => renderRow(g))}
            </div>
          ));
        })()}

        {/* Pool View with Grouping */}
        {viewMode === 'pool' && groupByPool && pools.length >= 2 && (() => {
          const byPool = sortedGames.reduce((acc, g) => {
            // Try to find which pool this game belongs to based on teams
            const homeTeam = teams.find(t => t.id === g.homeTeamId);
            const awayTeam = teams.find(t => t.id === g.awayTeamId);
            const pid = homeTeam?.poolId || awayTeam?.poolId || 'unassigned';
            if (!acc[pid]) acc[pid] = [];
            acc[pid].push(g);
            return acc;
          }, {} as Record<string, Game[]>);

          return [{ id: 'unassigned', name: 'Unassigned' }, ...pools].map(p => {
            const poolGames = byPool[p.id] || [];
            if (poolGames.length === 0) return null;

            return (
              <div key={p.id} className={s.poolSubSection}>
                <div className={s.poolSubHeader}>
                  <div className={s.poolDot} style={{ background: p.id === 'unassigned' ? 'var(--danger)' : 'var(--logic-lime)' }} />
                  <span className={s.poolSubLabel} style={{ color: p.id === 'unassigned' ? 'var(--danger)' : undefined }}>
                    {p.id === 'unassigned' ? 'UNASSIGNED' : formatPoolName(p.name).toUpperCase()}
                  </span>
                  <span className={s.poolSubCount}>({poolGames.length})</span>
                </div>
                {poolGames.map(g => renderRow(g))}
              </div>
            );
          });
        })()}

        {/* Pool View Flat or Single Pool — grouped by date */}
        {viewMode === 'pool' && (!groupByPool || pools.length < 2) && (
          <div>
            {(() => {
              const grouped = sortedGames.reduce<Record<string, Game[]>>((acc, g) => {
                const key = g.date || 'TBD';
                (acc[key] ??= []).push(g);
                return acc;
              }, {});
              return Object.entries(grouped).map(([date, dayGames]) => (
                <div key={date}>
                  <div className={styles.gameDateDivider}>
                    {date !== 'TBD' ? formatShortDate(date) : 'Date TBD'}
                    {date === today && (
                      <span className={styles.gameDateTodayBadge}>Today</span>
                    )}
                  </div>
                  {dayGames.map(g => renderRow(g))}
                </div>
              ));
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
