'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, Pencil, X, AlertCircle, Trash2, Check, AlertTriangle } from 'lucide-react';
import { Game, Team, Division, Venue, Tournament } from '@/lib/types';
import { checkVenueConflict, buildConflictMap, type ConflictResult, type ConflictKind } from '@/lib/schedule-conflict';
import { formatTime, formatPoolName } from '@/lib/utils';
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
  onFinalize?: (id: string) => void;
  onDelete?: (id: string) => void;
  onCancel?: (id: string) => void;
  onSchedule?: (id: string) => void;
  onSave?: (gameId: string, data: { date: string; time: string; venueId: string; venueFacilityId: string; notes: string; homeTeamId: string; awayTeamId: string }) => Promise<void>;
  onSaveScore?: (gameId: string, homeScore: number, awayScore: number) => Promise<void>;
  onCreateVenue?: () => void;
  mode: 'planning' | 'scoring';
  /** Tournament context used for conflict detection timing resolution. */
  tournament?: Tournament | null;
}

type EditFields = { date: string; time: string; venueId: string; venueFacilityId: string; notes: string; homeTeamId: string; awayTeamId: string };

type ScoreFields = { home: string; away: string };

export default function GameList({
  games, teams, divisions, venues, viewMode, groupByPool, pools: poolsProp,
  onEdit, onFinalize, onDelete, onCancel, onSchedule, onSave, onSaveScore, onCreateVenue, mode, tournament
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

  const getTeamName = (id: string) => teams.find(t => t.id === id)?.name ?? null;
  const resolveTeam = (id: string, placeholder?: string) => getTeamName(id) ?? placeholder ?? 'TBD';
  const getVenueName = (venueId?: string, facilityId?: string) => {
    const venue = venueId ? venues.find(d => d.id === venueId) : null;
    if (!venue) return '';
    if (!facilityId) return venue.name;
    const facility = venue.facilities?.find(f => f.id === facilityId);
    return facility ? `${venue.name} — ${facility.name}` : venue.name;
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

  const sortedGames = [...games].sort((a, b) => {
    if (a.date !== b.date) return (a.date || '9999').localeCompare(b.date || '9999');
    if (a.time !== b.time) return (a.time || '99:99').localeCompare(b.time || '99:99');
    if (viewMode === 'playoff') {
      return getPlayoffPriority(a.bracketCode) - getPlayoffPriority(b.bracketCode);
    }
    return 0;
  });

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // ── Conflict maps ─────────────────────────────────────────────────────────
  // Read-mode badges: which saved games already conflict with each other.
  const conflictMap = useMemo((): Map<string, ConflictKind> => {
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
      })),
      divisions,
      tournament,
    );
  }, [games, divisions, tournament, mode]);

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
        })),
        divisions,
        tournament: tournament ?? null,
      });
      result.set(gameId, conflict);
    }
    return result;
  }, [expanded, editState, games, divisions, tournament, mode]);

  function statusBadge(status: string) {
    if (status === 'completed') return <span className="badge badge-success">Final</span>;
    if (status === 'submitted') return <span className="badge badge-warning">Pending Review</span>;
    if (status === 'cancelled') return <span className="badge badge-danger">Cancelled</span>;
    return <span className="badge badge-neutral">Scheduled</span>;
  }

  const renderRow = (g: Game) => {
    const isExpanded = expanded.has(g.id);
    const hasScoredResult = mode === 'scoring'
      && (g.status === 'completed' || g.status === 'submitted')
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

      return (
        <div key={g.id} className={`${s.row} ${styles.scoringRow}`} data-status={g.status}>
          {/* ── Compact row — scores always visible inline with team names ── */}
          <div className={`${s.rowMain} ${styles.gameRowMain} ${styles.scoringGameRow}`} style={{ gap: '1rem' }}>
            {/* Date · Time on one line (matches planning mode); status sub-line below on mobile */}
            <div className={`${s.gameColDate} ${styles.scoringDateCell}`} style={{ fontFamily: 'var(--font-data)' }}>
              <div style={{ whiteSpace: 'nowrap' }}>
                <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--fl-text)', letterSpacing: '0.01em' }}>
                  {g.date ? formatShortDate(g.date) : 'TBD'}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--data-gray)', marginLeft: '0.4rem' }}>
                  {g.time ? `· ${formatTime(g.time)}` : '· —'}
                </span>
              </div>
              {!isExpanded && (
                <span className={styles.scoringMobileStatus} data-status={g.status}>
                  {g.status === 'completed' ? '✓ FINAL'
                    : g.status === 'submitted' ? '⚠ REVIEWING'
                    : 'SCHEDULED'}
                </span>
              )}
            </div>

            {/* Location — wider column, 2-line wrap */}
            <div className={s.gameColVenue}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px', fontSize: '0.72rem', color: 'var(--data-gray)', fontFamily: 'var(--font-data)' }}>
                <MapPin size={11} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: '1.35' }}>
                  {g.venueId ? getVenueName(g.venueId, g.venueFacilityId) : (g.location || 'TBD')}
                </span>
              </div>
            </div>

            {/* Matchup — symmetric: [W/L · score · Away]  VS  [Home · score · W/L] */}
            <div className={`${s.gameColMatchup} ${styles.scoringMatchupCell}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>

              {/* Away side — right-aligned: W/L · score/input · team name */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', minWidth: 0 }}>
                {/* W/L indicator — outer left, only in view mode */}
                {hasScoredResult && !isExpanded && (
                  <span style={{ fontFamily: 'var(--font-data)', fontSize: '1rem', fontWeight: 900, flexShrink: 0, color: awayWon ? 'var(--success)' : isTie ? 'var(--warning)' : 'rgba(var(--danger-rgb), 0.6)' }}>
                    {awayWon ? 'W' : isTie ? 'T' : 'L'}
                  </span>
                )}
                {/* Score or input */}
                {isExpanded ? (
                  <input
                    type="text"
                    inputMode="numeric"
                    value={score.away}
                    onChange={e => { const v = e.target.value; if (v === '' || /^\d+$/.test(v)) setScoreState(prev => ({ ...prev, [g.id]: { ...prev[g.id], away: v } })); }}
                    className={styles.scoreInlineInput}
                    placeholder="0"
                    autoFocus
                  />
                ) : hasScoredResult ? (
                  <span className={styles.scoreInlineValue} style={{ color: awayWon ? 'var(--success)' : isTie ? 'var(--warning)' : 'rgba(var(--danger-rgb), 0.65)' }}>
                    {g.awayScore}
                  </span>
                ) : null}
                {/* Team name */}
                <span style={{ fontFamily: 'var(--font-data)', fontSize: '0.85rem', fontWeight: 700, color: 'var(--fl-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {resolveTeam(g.awayTeamId, g.awayPlaceholder)}
                </span>
              </div>

              <div style={{ color: 'var(--white-30)', fontFamily: 'var(--font-data)', fontWeight: 900, fontSize: '0.6rem', letterSpacing: '0.12em', flexShrink: 0 }}>VS</div>

              {/* Home side — left-aligned: team name · score/input · W/L */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '0.5rem', minWidth: 0 }}>
                {/* Team name */}
                <span style={{ fontFamily: 'var(--font-data)', fontSize: '0.85rem', fontWeight: 700, color: 'var(--fl-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {resolveTeam(g.homeTeamId, g.homePlaceholder)}
                </span>
                {/* Score or input */}
                {isExpanded ? (
                  <input
                    type="text"
                    inputMode="numeric"
                    value={score.home}
                    onChange={e => { const v = e.target.value; if (v === '' || /^\d+$/.test(v)) setScoreState(prev => ({ ...prev, [g.id]: { ...prev[g.id], home: v } })); }}
                    className={styles.scoreInlineInput}
                    placeholder="0"
                  />
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
              <div className={`${s.gameStatusSlot} ${styles.desktopStatusSlot}`}>{statusBadge(g.status)}</div>
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
    };
    const isSaving = saving.has(g.id);

    const handleDiscard = () => {
      setEditState(prev => ({
        ...prev,
        [g.id]: { date: g.date ?? '', time: g.time ?? '', venueId: g.venueId ?? '', venueFacilityId: g.venueFacilityId ?? '', notes: g.notes ?? '', homeTeamId: g.homeTeamId ?? '', awayTeamId: g.awayTeamId ?? '' },
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
    const venueLabel = g.venueId ? getVenueName(g.venueId, g.venueFacilityId) : (g.location || '');

    return (
      <div key={g.id} className={`${s.row} ${styles.planningRow} ${isExpanded ? styles.expanded : ''}`} data-status={g.status}>
        {/* ── Compact planning row ── */}
        <div
          className={`${s.rowMain} ${styles.gameRowMain} ${styles.planningGameRow}`}
          onClick={locksEditing ? undefined : () => toggleExpand(g.id, g)}
          style={{ cursor: locksEditing ? 'default' : 'pointer', gap: '1rem' }}
        >
          {/* Date + Time — single line; status tag shown below on mobile */}
          <div className={`${s.gameColDate} ${styles.planningDateCell}`} style={{ fontFamily: 'var(--font-data)' }}>
            <div style={{ whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--fl-text)' }}>
                {g.date ? formatShortDate(g.date) : 'TBD'}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--data-gray)', marginLeft: '0.4rem' }}>
                {g.time ? `· ${formatTime(g.time)}` : '· —'}
              </span>
            </div>
            {g.status !== 'scheduled' && (
              <span className={styles.mobileStatusTag} data-status={g.status}>
                {g.status === 'completed' ? '✓ Final' : g.status === 'submitted' ? '⚠ Pending' : '✕ Cancelled'}
              </span>
            )}
          </div>

          <div
            className={`${s.gameColVenue} ${styles.planningVenueCell}`}
            data-empty={venueLabel ? undefined : 'true'}
            aria-hidden={venueLabel ? undefined : true}
            style={{ alignItems: 'flex-start', gap: '4px', fontFamily: 'var(--font-data)', fontSize: '0.72rem', color: 'var(--data-gray)' }}
          >
            {venueLabel && (
              <>
                <MapPin size={11} style={{ flexShrink: 0, opacity: 0.55, marginTop: '2px' }} />
                <span style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: '1.35' }}>
                  {venueLabel}
                </span>
              </>
            )}
          </div>

          {/* Matchup */}
          <div className={`${s.gameColMatchup} ${styles.planningMatchup}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.65rem' }}>
            <div className={styles.planningTeamAway} style={{ flex: 1, textAlign: 'right', fontFamily: 'var(--font-data)', fontSize: '0.82rem', fontWeight: 700, color: 'var(--fl-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {resolveTeam(g.awayTeamId, g.awayPlaceholder)}
            </div>
            <div className={styles.planningVs} style={{ fontFamily: 'var(--font-data)', fontSize: '0.58rem', fontWeight: 900, color: 'var(--white-25)', letterSpacing: '0.1em', flexShrink: 0 }}>VS</div>
            <div className={styles.planningTeamHome} style={{ flex: 1, fontFamily: 'var(--font-data)', fontSize: '0.82rem', fontWeight: 700, color: 'var(--fl-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {resolveTeam(g.homeTeamId, g.homePlaceholder)}
            </div>
          </div>

          {/* Fixed-width status area — desktop badge only; mobile handled by mobileStatusTag in date cell */}
          <div className={styles.planningStatusCell}>
            {g.status !== 'scheduled' && (
              <span className={styles.desktopStatusBadge}>{statusBadge(g.status)}</span>
            )}
            {(g.homeSlotId || g.awaySlotId) && !g.isPlayoff && (
              <span className="badge badge-neutral" style={{ fontSize: '0.6rem', letterSpacing: '0.04em' }}>SLOT</span>
            )}
            {/* Conflict badge — read mode only (not while editing) */}
            {!isExpanded && (() => {
              const kind = conflictMap.get(g.id);
              if (!kind) return null;
              const isOverlap = kind === 'overlap';
              return (
                <span
                  title={isOverlap ? 'Venue conflict: game windows overlap' : 'Buffer zone warning: games are too close together'}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                    fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.04em',
                    color: isOverlap ? '#f87171' : '#fbbf24',
                    background: isOverlap ? 'rgba(239,68,68,0.1)' : 'rgba(251,191,36,0.1)',
                    border: `1px solid ${isOverlap ? 'rgba(239,68,68,0.35)' : 'rgba(251,191,36,0.3)'}`,
                    borderRadius: '2px', padding: '1px 5px',
                  }}
                >
                  <AlertTriangle size={9} />
                  {isOverlap ? 'CONFLICT' : 'BUFFER'}
                </span>
              );
            })()}
          </div>

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
                        <option key={f.id} value={f.id}>{f.name}</option>
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
              {/* Away / Home Teams — order matches row display (away left, home right) */}
              {!g.homeSlotId && !g.awaySlotId && (
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
              )}

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
                    Use {inlineConflict.availableAt} ↑
                  </button>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className={styles.inlineFormFooter}>
              <div className={styles.inlineFormActions}>
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
        <div className={s.gameColDate}>Date</div>
        <div className={s.gameColVenue}>Location</div>
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
