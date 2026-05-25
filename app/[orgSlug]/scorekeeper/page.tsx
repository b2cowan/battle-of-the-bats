'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  MapPin,
  RefreshCw,
  Save,
  Search,
  Trophy,
  X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase-browser';
import type { Division, Diamond, Game, GameStatus } from '@/lib/types';
import { formatTime } from '@/lib/utils';
import styles from './scorekeeper.module.css';

type ScoreState = 'idle' | 'entering' | 'saving';
type StatusFilter = 'open' | 'pending' | 'final' | 'all';

type ScorekeeperEmptyReason =
  | 'access_denied'
  | 'no_tournament_access'
  | 'no_active_tournaments'
  | 'no_games_today';

interface GameCard {
  game: Game;
  homeName: string;
  awayName: string;
  diamond: Diamond | null;
  divisionName: string;
  tournamentName: string | null;
}

interface ScorekeeperEmptyState {
  reason: ScorekeeperEmptyReason;
  title: string;
  message: string;
}

interface ScorekeeperResponse {
  date: string;
  tournamentIds: string[];
  scorePolicyByTournamentId: Record<string, boolean>;
  cards: GameCard[];
  diamonds: Diamond[];
  divisions: Division[];
  emptyMessage: string;
  emptyState: ScorekeeperEmptyState | null;
}

type RealtimeGameUpdate = {
  id?: unknown;
  home_score?: unknown;
  away_score?: unknown;
  status?: unknown;
};

type Notice = {
  kind: 'info' | 'success' | 'warning' | 'danger';
  title: string;
  message: string;
};

function todayString() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function isEmptyState(value: unknown): value is ScorekeeperEmptyState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Record<string, unknown>;
  return typeof state.title === 'string' && typeof state.message === 'string';
}

function scoreFromRealtime(value: unknown, fallback: number | null | undefined) {
  if (typeof value === 'number') return value;
  if (value === null) return null;
  return fallback;
}

function statusFromRealtime(value: unknown, fallback: GameStatus): GameStatus {
  if (value === 'scheduled' || value === 'submitted' || value === 'completed' || value === 'cancelled') {
    return value;
  }
  return fallback;
}

function normalizedText(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

function canEdit(game: Game) {
  return game.status === 'scheduled' || game.status === 'submitted';
}

function statusLabel(status: GameStatus) {
  if (status === 'submitted') return 'Pending Review';
  if (status === 'completed') return 'Finalized';
  if (status === 'cancelled') return 'Cancelled';
  return 'To Score';
}

export default function ScorekeeperPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const supabase = useMemo(() => createClient(), []);

  const [date, setDate] = useState(todayString);
  const [cards, setCards] = useState<GameCard[]>([]);
  const [diamonds, setDiamonds] = useState<Diamond[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [tournamentIds, setTournamentIds] = useState<string[]>([]);
  const [scorePolicies, setScorePolicies] = useState<Record<string, boolean>>({});
  const [emptyState, setEmptyState] = useState<ScorekeeperEmptyState | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);

  const [fieldFilter, setFieldFilter] = useState('');
  const [divisionFilter, setDivisionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [teamSearch, setTeamSearch] = useState('');

  const [editingCard, setEditingCard] = useState<GameCard | null>(null);
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [scoreState, setScoreState] = useState<ScoreState>('idle');
  const [showScoreErrors, setShowScoreErrors] = useState(false);

  const loadGames = useCallback(async () => {
    setLoading(true);
    setNotice(null);
    setEmptyState(null);

    try {
      const response = await fetch(
        `/api/scorekeeper/${encodeURIComponent(orgSlug)}/score?date=${encodeURIComponent(date)}`,
        { cache: 'no-store' },
      );
      const data = await response.json().catch(() => ({})) as Partial<ScorekeeperResponse> & { error?: string };

      if (!response.ok) {
        setCards([]);
        setDiamonds([]);
        setDivisions([]);
        setTournamentIds([]);
        setScorePolicies({});

        if (response.status === 401) {
          setNotice({
            kind: 'warning',
            title: 'Sign in required',
            message: 'Sign in again to continue scorekeeping.',
          });
          return;
        }

        if (response.status === 403) {
          const apiState = isEmptyState(data.emptyState) ? data.emptyState : null;
          setNotice({
            kind: 'danger',
            title: apiState?.title ?? 'Scorekeeper access unavailable',
            message: apiState?.message ?? 'This account cannot submit scores for this organization.',
          });
          return;
        }

        throw new Error(data.error ?? 'Unable to load games.');
      }

      setCards(Array.isArray(data.cards) ? data.cards : []);
      setDiamonds(Array.isArray(data.diamonds) ? data.diamonds : []);
      setDivisions(Array.isArray(data.divisions) ? data.divisions : []);
      setTournamentIds(Array.isArray(data.tournamentIds) ? data.tournamentIds : []);
      setScorePolicies(data.scorePolicyByTournamentId ?? {});
      setEmptyState(isEmptyState(data.emptyState) ? data.emptyState : null);
    } catch (error) {
      setCards([]);
      setDiamonds([]);
      setDivisions([]);
      setTournamentIds([]);
      setScorePolicies({});
      setNotice({
        kind: 'danger',
        title: 'Unable to load assignments',
        message: errorMessage(error, 'Refresh and try again.'),
      });
    } finally {
      setLoading(false);
    }
  }, [date, orgSlug]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadGames();
    }, 0);

    return () => window.clearTimeout(loadTimer);
  }, [loadGames]);

  const tournamentKey = tournamentIds.join('|');

  useEffect(() => {
    const scopedTournamentIds = tournamentKey.split('|').filter(Boolean);
    if (scopedTournamentIds.length === 0) return;

    const channel = supabase.channel(`scorekeeper-games-${orgSlug}-${tournamentKey}`);

    scopedTournamentIds.forEach(tournamentId => {
      channel.on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `tournament_id=eq.${tournamentId}` },
        payload => {
          const updated = payload.new as RealtimeGameUpdate;
          if (typeof updated.id !== 'string') return;

          setCards(previous => previous.map(card => (
            card.game.id === updated.id
              ? {
                  ...card,
                  game: {
                    ...card.game,
                    homeScore: scoreFromRealtime(updated.home_score, card.game.homeScore),
                    awayScore: scoreFromRealtime(updated.away_score, card.game.awayScore),
                    status: statusFromRealtime(updated.status, card.game.status),
                  },
                }
              : card
          )));
        },
      );
    });

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orgSlug, supabase, tournamentKey]);

  const counts = useMemo(() => ({
    open: cards.filter(card => card.game.status === 'scheduled').length,
    pending: cards.filter(card => card.game.status === 'submitted').length,
    final: cards.filter(card => card.game.status === 'completed').length,
    cancelled: cards.filter(card => card.game.status === 'cancelled').length,
  }), [cards]);

  const visibleCards = useMemo(() => {
    const query = normalizedText(teamSearch);

    return cards.filter(card => {
      if (fieldFilter && card.game.diamondId !== fieldFilter) return false;
      if (divisionFilter && card.game.divisionId !== divisionFilter) return false;

      if (statusFilter === 'open' && card.game.status !== 'scheduled') return false;
      if (statusFilter === 'pending' && card.game.status !== 'submitted') return false;
      if (statusFilter === 'final' && card.game.status !== 'completed') return false;

      if (query) {
        const haystack = [
          card.homeName,
          card.awayName,
          card.divisionName,
          card.diamond?.name,
          card.tournamentName,
        ].map(normalizedText).join(' ');
        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [cards, divisionFilter, fieldFilter, statusFilter, teamSearch]);

  const hasFilters = Boolean(fieldFilter || divisionFilter || teamSearch || statusFilter !== 'open');
  const selectedPolicyRequiresReview = editingCard
    ? scorePolicies[editingCard.game.tournamentId] ?? false
    : false;

  function resetFilters() {
    setFieldFilter('');
    setDivisionFilter('');
    setStatusFilter('open');
    setTeamSearch('');
  }

  function openScoreEntry(card: GameCard) {
    if (!canEdit(card.game)) return;
    setEditingCard(card);
    setHomeScore(card.game.homeScore == null ? '' : String(card.game.homeScore));
    setAwayScore(card.game.awayScore == null ? '' : String(card.game.awayScore));
    setShowScoreErrors(false);
    setScoreState('entering');
    setNotice(null);
  }

  function closeScoreEntry() {
    if (scoreState === 'saving') return;
    setEditingCard(null);
    setHomeScore('');
    setAwayScore('');
    setShowScoreErrors(false);
    setScoreState('idle');
  }

  async function submitScore() {
    if (!editingCard || scoreState === 'saving') return;
    if (homeScore === '' || awayScore === '') {
      setShowScoreErrors(true);
      return;
    }

    setScoreState('saving');

    try {
      const response = await fetch(`/api/scorekeeper/${encodeURIComponent(orgSlug)}/score`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingCard.game.id,
          homeScore: Number(homeScore),
          awayScore: Number(awayScore),
        }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string; status?: GameStatus };

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to save score.');
      }

      const nextStatus = statusFromRealtime(data.status, selectedPolicyRequiresReview ? 'submitted' : 'completed');
      setCards(previous => previous.map(card => (
        card.game.id === editingCard.game.id
          ? {
              ...card,
              game: {
                ...card.game,
                homeScore: Number(homeScore),
                awayScore: Number(awayScore),
                status: nextStatus,
              },
            }
          : card
      )));

      setNotice({
        kind: nextStatus === 'submitted' ? 'warning' : 'success',
        title: nextStatus === 'submitted' ? 'Score sent for review' : 'Score finalized',
        message: nextStatus === 'submitted'
          ? 'An admin can now review and finalize this result from Results & Scoring.'
          : 'This result is now final.',
      });
      closeScoreEntry();
    } catch (error) {
      setNotice({
        kind: 'danger',
        title: 'Score not saved',
        message: errorMessage(error, 'Try again before leaving the field.'),
      });
      setScoreState('entering');
    }
  }

  const emptyTitle = cards.length === 0
    ? emptyState?.title ?? 'No games for this date'
    : hasFilters
      ? 'No games match these filters'
      : 'No games to score';

  const emptyMessage = cards.length === 0
    ? emptyState?.message ?? 'Try another date or contact your tournament admin.'
    : hasFilters
      ? 'Clear filters or switch status buckets to widen the list.'
      : 'All available games are outside this bucket.';

  const submitLabel = editingCard?.game.status === 'submitted'
    ? 'Save Correction'
    : selectedPolicyRequiresReview
      ? 'Submit for Review'
      : 'Finalize Score';

  return (
    <div className={styles.page}>
      <section className={styles.header}>
        <div>
          <p className={styles.kicker}>Scorekeeper</p>
          <h1 className={styles.title}>Field scores</h1>
        </div>
        <button type="button" className={styles.iconButton} onClick={loadGames} aria-label="Refresh games">
          <RefreshCw size={18} />
        </button>
      </section>

      <section className={styles.statsGrid} aria-label="Score status summary">
        <div className={styles.stat}>
          <Clock size={16} />
          <span>{counts.open}</span>
          <small>To Score</small>
        </div>
        <div className={styles.stat}>
          <AlertTriangle size={16} />
          <span>{counts.pending}</span>
          <small>Review</small>
        </div>
        <div className={styles.stat}>
          <CheckCircle2 size={16} />
          <span>{counts.final}</span>
          <small>Final</small>
        </div>
      </section>

      <section className={styles.controls} aria-label="Find games">
        <label className={styles.dateControl}>
          <CalendarDays size={16} />
          <input type="date" value={date} onChange={event => setDate(event.target.value)} />
        </label>
        <button type="button" className={styles.todayButton} onClick={() => setDate(todayString())}>
          Today
        </button>

        <label className={styles.searchControl}>
          <Search size={16} />
          <input
            type="search"
            value={teamSearch}
            onChange={event => setTeamSearch(event.target.value)}
            placeholder="Search team"
          />
        </label>

        <select className={styles.select} value={fieldFilter} onChange={event => setFieldFilter(event.target.value)}>
          <option value="">All fields</option>
          {diamonds.map(diamond => (
            <option key={diamond.id} value={diamond.id}>{diamond.name}</option>
          ))}
        </select>

        <select className={styles.select} value={divisionFilter} onChange={event => setDivisionFilter(event.target.value)}>
          <option value="">All divisions</option>
          {divisions.map(division => (
            <option key={division.id} value={division.id}>{division.name}</option>
          ))}
        </select>
      </section>

      <section className={styles.statusTabs} aria-label="Status filter">
        {([
          ['open', `To Score ${counts.open}`],
          ['pending', `Review ${counts.pending}`],
          ['final', `Final ${counts.final}`],
          ['all', `All ${cards.length}`],
        ] as const).map(([filter, label]) => (
          <button
            key={filter}
            type="button"
            className={statusFilter === filter ? styles.statusTabActive : styles.statusTab}
            onClick={() => setStatusFilter(filter)}
          >
            {label}
          </button>
        ))}
      </section>

      {notice && (
        <div className={`${styles.notice} ${styles[`notice_${notice.kind}`] ?? ''}`}>
          <strong>{notice.title}</strong>
          <span>{notice.message}</span>
        </div>
      )}

      {loading ? (
        <section className={styles.loadingState} aria-label="Loading games">
          <span />
          <span />
          <span />
        </section>
      ) : visibleCards.length === 0 ? (
        <section className={styles.emptyState}>
          <Trophy size={22} />
          <h2>{emptyTitle}</h2>
          <p>{emptyMessage}</p>
          {hasFilters && (
            <button type="button" className={styles.secondaryButton} onClick={resetFilters}>
              Clear filters
            </button>
          )}
        </section>
      ) : (
        <section className={styles.gameList} aria-label="Games">
          {visibleCards.map(card => {
            const { game } = card;
            const editable = canEdit(game);
            const policyReview = scorePolicies[game.tournamentId] ?? false;
            const meta = [
              tournamentIds.length > 1 ? card.tournamentName : null,
              game.time ? formatTime(game.time) : 'Time TBD',
              card.diamond?.name ?? game.location,
              card.divisionName,
            ].filter(Boolean).join(' - ');

            return (
              <button
                key={game.id}
                type="button"
                className={`${styles.gameCard} ${styles[`gameCard_${game.status}`] ?? ''}`}
                onClick={() => openScoreEntry(card)}
                disabled={!editable}
              >
                <span className={styles.gameMeta}>
                  <MapPin size={13} />
                  {meta}
                </span>
                <span className={`${styles.statusBadge} ${styles[`status_${game.status}`] ?? ''}`}>
                  {statusLabel(game.status)}
                </span>

                <span className={styles.matchup}>
                  <span className={styles.teamBlock}>
                    <span>{card.homeName}</span>
                    {game.status !== 'scheduled' && <strong>{game.homeScore ?? '-'}</strong>}
                  </span>
                  <span className={styles.versus}>{game.status === 'scheduled' ? 'vs' : '-'}</span>
                  <span className={styles.teamBlock}>
                    <span>{card.awayName}</span>
                    {game.status !== 'scheduled' && <strong>{game.awayScore ?? '-'}</strong>}
                  </span>
                </span>

                <span className={styles.cardAction}>
                  {editable
                    ? game.status === 'submitted'
                      ? 'Correct before finalization'
                      : policyReview
                        ? 'Enter score for review'
                        : 'Enter final score'
                    : game.status === 'cancelled'
                      ? 'Cancelled game'
                      : 'Final score locked'}
                </span>
              </button>
            );
          })}
        </section>
      )}

      {editingCard && scoreState !== 'idle' && (
        <div className={styles.sheetBackdrop} role="presentation" onClick={closeScoreEntry}>
          <form
            className={styles.scoreSheet}
            onSubmit={event => {
              event.preventDefault();
              void submitScore();
            }}
            onClick={event => event.stopPropagation()}
          >
            <div className={styles.sheetHeader}>
              <div>
                <p className={styles.kicker}>Enter Score</p>
                <h2>{editingCard.homeName} vs {editingCard.awayName}</h2>
              </div>
              <button type="button" className={styles.iconButton} onClick={closeScoreEntry} aria-label="Close score entry">
                <X size={18} />
              </button>
            </div>

            <div className={styles.scoreGrid}>
              <label>
                <span>{editingCard.homeName}</span>
                <input
                  autoFocus
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={homeScore}
                  onChange={event => setHomeScore(event.target.value.replace(/\D/g, ''))}
                  className={showScoreErrors && homeScore === '' ? styles.inputError : ''}
                />
              </label>
              <span className={styles.scoreDivider}>-</span>
              <label>
                <span>{editingCard.awayName}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={awayScore}
                  onChange={event => setAwayScore(event.target.value.replace(/\D/g, ''))}
                  className={showScoreErrors && awayScore === '' ? styles.inputError : ''}
                />
              </label>
            </div>

            {showScoreErrors && (homeScore === '' || awayScore === '') && (
              <p className={styles.formError}>Both scores are required.</p>
            )}

            <p className={styles.policyNote}>
              {editingCard.game.status === 'submitted'
                ? 'This replaces the pending score before an admin finalizes it.'
                : selectedPolicyRequiresReview
                  ? 'This tournament requires admin review before scores become final.'
                  : 'This score becomes final immediately after saving.'}
            </p>

            <div className={styles.sheetActions}>
              <button type="button" className={styles.secondaryButton} onClick={closeScoreEntry} disabled={scoreState === 'saving'}>
                Cancel
              </button>
              <button type="submit" className={styles.primaryButton} disabled={scoreState === 'saving'}>
                <Save size={16} />
                {scoreState === 'saving' ? 'Saving...' : submitLabel}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
