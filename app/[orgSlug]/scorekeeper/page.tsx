'use client';

/**
 * The scorekeeper — a volunteer's list of the day's games, and the score sheet (Tournament admin
 * redesign Stage 6, V1 + V2, ruled 2026-10-07; the shapes ADC specimen 7 ruled stay: the cards, the
 * buckets under the thumb, the one big box per team, Cancel as the way out).
 *
 *   · The list: the whole card is the tap, the first game to score marked Up next with the olive edge.
 *     The state chips are the kit's one chip; the time line is in the body face, never capitals (F61);
 *     the Review bucket's count wears the amber pill while a score waits (A28).
 *   · The score sheet is the Sheet Frame's FORM (A30) at ≤900 — over the bars, 18px corners, the grab
 *     line, the portal's dim — with a sentence head and NO ×: Cancel is the way out (owner 2026-08-08), a
 *     tap on the dim does nothing (`holdDim`), and it stands on the visual viewport so the number pad
 *     never covers its button (`keypad`). Above 900 (a laptop or a landscape tablet at the scoring table)
 *     the same form sits in a centred card, as the coaches' game day does.
 *   · After a save, the product's one-off notice floats above the bars and fades (`NoticePill`, ~2.5s:
 *     the volunteer's own action) — the list no longer drops under a box that stayed (F64). A score the
 *     organizer sends back while the screen is open gets the same notice for ~8s, naming the game (A32).
 *     Nothing is stored: after a reload it is simply a game to score again. Errors and the sign-in
 *     recovery stay where they are, and stay — they need an answer.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { AlertCircle, Info, MapPin, RefreshCw, Search, SlidersHorizontal, Trophy } from 'lucide-react';
import { createClient } from '@/lib/supabase-browser';
import { useScorekeeperFlip } from '@/components/volunteer/ScorekeeperFlip';
import { DayOfFilterBar, DayOfFilterButton } from '@/components/volunteer/DayOfBottomBars';
import SheetFrame from '@/components/coaches/SheetFrame';
import { useDialogFloor } from '@/components/coaches/useDialogFloor';
import { Callout, NoticePill, RepChip, type ChipTone } from '@/components/admin/kit/club/RepKit';
import { useIsPhoneNav } from '@/lib/hooks/useIsPhoneNav';
import type { ScorekeeperFlipTournament } from '@/lib/flip-twins';
import type { Division, Venue, Game, GameStatus } from '@/lib/types';
import { formatTime } from '@/lib/utils';
import { GAME_DAY_LIST, GAME_STATE_WORD, SCOREKEEPER_BUCKET } from '@/lib/game-day-words';
import { SCOREKEEPER_WORDS } from '@/lib/volunteer-words';
import { gameWindowState } from '@/lib/game-live-state';
import { gameLengthMinutes } from '@/lib/booking-length';
import { tournamentToday } from '@/lib/timezone';
import { typedLocationKey } from '@/lib/venue-identity';
import styles from './scorekeeper.module.css';

type ScoreState = 'idle' | 'entering' | 'saving';

/**
 * Digits only, no leading zeros, at most three.
 *
 * The cap lives HERE and not in a `maxLength` attribute: the browser enforces `maxLength` on the
 * raw edit, before React sees the value, so pasting "ab27" was truncated to "ab2" and then stripped
 * to **2** — a silently wrong FINAL score with no error, because the field was not empty. Sanitise
 * first, cap second. Leading zeros go too: "007" saved correctly as 7 but read as three digits on a
 * screen whose whole job is being readable at a glance.
 */
function sanitizeScore(raw: string) {
  return raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 3);
}
type StatusFilter = 'open' | 'pending' | 'final' | 'all';

// WI-3: a score typed but not yet saved when the session lapsed. Stashed per-tab (sessionStorage
// survives the sign-in navigation; precedent: TeamSignupClient's draft) so the volunteer's numbers
// come back after they sign in, on the same game and date.
const PENDING_KEY = 'sk:pendingScore';

/** The score sheet's head, which names the dialog. */
const SHEET_TITLE_ID = 'sk-score-sheet-title';

type PendingScore = {
  orgSlug: string;
  gameId: string;
  homeScore: string;
  awayScore: string;
  date: string;
};

type ScorekeeperEmptyReason =
  | 'access_denied'
  | 'no_tournament_access'
  | 'no_active_tournaments'
  | 'no_games_today';

interface GameCard {
  game: Game;
  homeName: string;
  awayName: string;
  venue: Venue | null;
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
  /** Publicly-visible tournaments in scope — feeds the header FlipPill ("The Flip" P3). */
  publicTournaments: ScorekeeperFlipTournament[];
  cards: GameCard[];
  venues: Venue[];
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

/** Only what needs an answer stays on the page: the sign-in recovery and an error. */
type Notice = {
  kind: 'info' | 'warning' | 'danger';
  title: string;
  message: string;
  /** Optional recovery CTA (J8-002): e.g. a sign-in link when the session lapses mid-shift. */
  action?: { label: string; href: string };
};

const NOTICE_TONE: Record<Notice['kind'], 'info' | 'warn' | 'bad'> = { info: 'info', warning: 'warn', danger: 'bad' };

/** A floating notice that fades — the volunteer's own save (`news: false`) or the organizer's send-back. */
type Pill = { id: number; message: string; news: boolean };

/** A game whose score left the volunteer's hands: a send-back returns it to `scheduled`. */
const SCORED: ReadonlySet<GameStatus> = new Set<GameStatus>(['submitted', 'completed', 'forfeit']);

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

/** Every status a game can hold — a finalized forfeit too (F63: it used to keep Pending Review until a refresh). */
function statusFromRealtime(value: unknown, fallback: GameStatus): GameStatus {
  if (value === 'scheduled' || value === 'submitted' || value === 'completed' || value === 'cancelled' || value === 'forfeit') {
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

/** A finished game is Final — a forfeit the organizer approved is one too (F63: it sat in All alone). */
function isFinal(game: Game) {
  return game.status === 'completed' || game.status === 'forfeit';
}

// Game day's one word per state (Tournament admin redesign G5, /marketing 2026-09-29) — the same words
// as the organizer's board and Results, by the shared play-window rule: "Needs a score" once a game's time
// has passed, "Scheduled" before then. The game's length is THE chain (A39), resolved by the score read (this page
// spans tournaments and holds none of their settings). A forfeit is a forfeit
// (it used to read "To Score").
function statusLabel(game: Game, readAt: number) {
  const { status } = game;
  if (status === 'submitted') return GAME_STATE_WORD.pendingReview;
  if (status === 'completed') return GAME_STATE_WORD.final;
  if (status === 'forfeit') return GAME_STATE_WORD.forfeit;
  if (status === 'cancelled') return 'Cancelled';
  const w = gameWindowState({ date: game.date, time: game.time, durationMinutes: gameLengthMinutes(game.durationMinutes), nowMs: readAt, today: tournamentToday(new Date(readAt)) });
  return w === 'overdue' ? GAME_STATE_WORD.needsScore : GAME_DAY_LIST.scheduled;
}

/** What a tap on a card does, in the card's own words. */
function cardActionWord(game: Game, policyReview: boolean): string {
  const W = SCOREKEEPER_WORDS.cardAction;
  if (game.status === 'submitted') return W.correct;
  if (canEdit(game)) return policyReview ? W.review : W.final;
  return game.status === 'cancelled' ? W.cancelled : W.locked;
}

/** The kit's one chip, toned by the state it names. */
function statusTone(status: GameStatus): ChipTone {
  if (status === 'submitted') return 'warn';
  if (status === 'completed' || status === 'forfeit') return 'good';
  return 'neutral';
}

export default function ScorekeeperPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const supabase = useMemo(() => createClient(), []);

  const [date, setDate] = useState(todayString);
  const [cards, setCards] = useState<GameCard[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  /** When the cards were last read — the clock a card's "Needs a score" is judged by. */
  const [readAt, setReadAt] = useState(() => Date.now());
  const [tournamentIds, setTournamentIds] = useState<string[]>([]);
  const [scorePolicies, setScorePolicies] = useState<Record<string, boolean>>({});
  const [emptyState, setEmptyState] = useState<ScorekeeperEmptyState | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pill, setPill] = useState<Pill | null>(null);

  const [fieldFilter, setFieldFilter] = useState('');
  const [divisionFilter, setDivisionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [teamSearch, setTeamSearch] = useState('');

  // Phone only: the setup controls (date, search, field, division) fold behind one button. They
  // are set once at the start of a shift, not touched between games, and on a 390px screen they
  // were the reason a volunteer arrived at a screenful of controls with no games on it. Above
  // 640px the panel is always open (CSS) and this state is inert.
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [editingCard, setEditingCard] = useState<GameCard | null>(null);
  /** Enter in the home field moves here rather than submitting — see `onScoreKeyDown`. */
  const awayScoreRef = useRef<HTMLInputElement | null>(null);
  /** Where Enter in the away field lands: dismisses the keypad AND keeps a keyboard user in the sheet. */
  const submitButtonRef = useRef<HTMLButtonElement | null>(null);
  /** The card that opened the sheet — focus goes back to it however the sheet closes (iOS never focuses a tapped button). */
  const openerRef = useRef<HTMLElement | null>(null);
  /** The centred card above 900, which the dialog floor watches. */
  const deskSheetRef = useRef<HTMLDivElement | null>(null);
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [scoreState, setScoreState] = useState<ScoreState>('idle');
  const [showScoreErrors, setShowScoreErrors] = useState(false);

  // The score sheet is the frame at the bar's breakpoint and a centred card above it.
  const isPhoneNav = useIsPhoneNav();

  // The cards as the screen shows them NOW — the live update reads what a game WAS, to say a send-back.
  const cardsRef = useRef<GameCard[]>([]);
  useEffect(() => { cardsRef.current = cards; }, [cards]);

  // "The Flip" P3: publish the board's publicly-visible tournaments to the header pill.
  const setFlipTournaments = useScorekeeperFlip();

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
        setVenues([]);
        setDivisions([]);
        setTournamentIds([]);
        setScorePolicies({});
        setFlipTournaments([]); // pill falls back to the org public site

        if (response.status === 401) {
          // J8-002: a session that lapses mid-shift must offer a way back in, not a dead end.
          // The sign-in link returns here after auth (login resolves a safe destination — FP-1).
          setNotice({
            kind: 'warning',
            title: 'Sign in required',
            message: 'Your session ended. Sign in again to continue scorekeeping.',
            action: { label: 'Sign in', href: `/auth/login?next=/${orgSlug}/scorekeeper` },
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
      setReadAt(Date.now());
      const loadedVenues: Venue[] = Array.isArray(data.venues) ? data.venues : [];
      setVenues(loadedVenues);
      // The field list is day-scoped now (only fields the day's games are on, plus typed
      // entries). A filter carried across a date change can point at a field the new day
      // doesn't have — which would silently empty the board. Snap it back to "All fields".
      setFieldFilter(prev => (prev && !loadedVenues.some(v => v.id === prev) ? '' : prev));
      setDivisions(Array.isArray(data.divisions) ? data.divisions : []);
      setTournamentIds(Array.isArray(data.tournamentIds) ? data.tournamentIds : []);
      setScorePolicies(data.scorePolicyByTournamentId ?? {});
      setFlipTournaments(Array.isArray(data.publicTournaments) ? data.publicTournaments : []);
      setEmptyState(isEmptyState(data.emptyState) ? data.emptyState : null);
    } catch (error) {
      setCards([]);
      setVenues([]);
      setDivisions([]);
      setTournamentIds([]);
      setScorePolicies({});
      setFlipTournaments([]);
      setNotice({
        kind: 'danger',
        title: 'Unable to load assignments',
        message: errorMessage(error, 'Refresh and try again.'),
      });
    } finally {
      setLoading(false);
    }
  }, [date, orgSlug, setFlipTournaments]);

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

          // A32: a score the organizer sends back (Results' Revert returns the game to `scheduled`, its
          // numbers cleared) is news the volunteer didn't cause — say it, name the game, while the screen
          // is open. Read from what the screen shows now, outside the state update (no side effect there).
          const before = cardsRef.current.find(card => card.game.id === updated.id);
          if (before && SCORED.has(before.game.status) && statusFromRealtime(updated.status, before.game.status) === 'scheduled') {
            setPill({ id: Date.now(), news: true, message: SCOREKEEPER_WORDS.sentBack(`${before.homeName} vs ${before.awayName}`) });
            // Open on that very game? It is no longer a correction — its sheet says so (its typed boxes stay).
            setEditingCard(open => (open && open.game.id === updated.id ? { ...open, game: { ...open.game, status: 'scheduled' } } : open));
          }

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

  // WI-3: after a sign-in round-trip, restore a score the volunteer typed before their session
  // lapsed. Runs once (ref-guarded). If the stash is for another date, switch to it and let the
  // reload re-fire this effect; once the matching day's cards are in, re-check editability and
  // reopen the sheet with the values. Always clears the stash so it can't re-open a second time.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (loading || restoredRef.current) return;

    let pending: PendingScore | null = null;
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (raw) pending = JSON.parse(raw) as PendingScore;
    } catch { pending = null; }
    if (!pending || typeof pending.gameId !== 'string') return;

    if (pending.orgSlug !== orgSlug) {
      // Stash belongs to a different org's scorekeeper — leave it for that tab; don't consume here.
      restoredRef.current = true;
      return;
    }

    if (pending.date !== date) {
      // The lapsed score was on another day — jump there. Set loading NOW so this effect's own
      // re-fire (from the date change) short-circuits on the `loading` guard instead of consuming
      // the stash against the OLD day's still-current `cards` (the reload is deferred a tick, so
      // without this the restore would run against stale cards, find nothing, and drop the score).
      setDate(pending.date);
      setLoading(true);
      return;
    }

    // Right org + right day, cards are loaded: consume the stash exactly once.
    restoredRef.current = true;
    try { sessionStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }

    const card = cards.find(c => c.game.id === pending!.gameId);
    if (card && canEdit(card.game)) {
      setEditingCard(card);
      setHomeScore(pending.homeScore);
      setAwayScore(pending.awayScore);
      setShowScoreErrors(false);
      setScoreState('entering');
      setNotice(null);
    }
  }, [cards, loading, date, orgSlug]);

  const counts = useMemo(() => ({
    open: cards.filter(card => card.game.status === 'scheduled').length,
    pending: cards.filter(card => card.game.status === 'submitted').length,
    final: cards.filter(card => isFinal(card.game)).length,
    cancelled: cards.filter(card => card.game.status === 'cancelled').length,
  }), [cards]);

  const visibleCards = useMemo(() => {
    const query = normalizedText(teamSearch);

    return cards.filter(card => {
      if (fieldFilter) {
        // `text:` entries are the day's typed-only locations (no venue record) — matched with
        // the same key builder the server used to make the list, so a game placed by words
        // alone is reachable through the filter instead of invisible to it.
        if (fieldFilter.startsWith('text:')) {
          if (card.game.venueId || typedLocationKey(card.game.location) !== fieldFilter) return false;
        } else if (card.game.venueId !== fieldFilter) {
          return false;
        }
      }
      if (divisionFilter && card.game.divisionId !== divisionFilter) return false;

      if (statusFilter === 'open' && card.game.status !== 'scheduled') return false;
      if (statusFilter === 'pending' && card.game.status !== 'submitted') return false;
      if (statusFilter === 'final' && !isFinal(card.game)) return false;

      if (query) {
        const haystack = [
          card.homeName,
          card.awayName,
          card.divisionName,
          card.venue?.name,
          card.tournamentName,
        ].map(normalizedText).join(' ');
        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [cards, divisionFilter, fieldFilter, statusFilter, teamSearch]);

  // J8-006: the "now" signal. Cards are time-ordered; the first un-scored (scheduled) game is the
  // one the volunteer should score next. Marking it gives a glance-able NOW indicator instead of an
  // undifferentiated stack of identical cards.
  const nowCardId = useMemo(
    () => visibleCards.find(card => card.game.status === 'scheduled')?.game.id ?? null,
    [visibleCards],
  );

  const hasFilters = Boolean(fieldFilter || divisionFilter || teamSearch || statusFilter !== 'open');
  // What the Filters button admits to while it is closed. A folded panel that hides an active
  // filter would make a filtered board look like an empty one — the one way this fold could lie.
  const activeFilterCount = [fieldFilter, divisionFilter, teamSearch].filter(Boolean).length;
  const selectedPolicyRequiresReview = editingCard
    ? scorePolicies[editingCard.game.tournamentId] ?? false
    : false;

  function resetFilters() {
    setFieldFilter('');
    setDivisionFilter('');
    setStatusFilter('open');
    setTeamSearch('');
  }

  /**
   * Which game this is — time, field, division (and the tournament, when the day spans more than
   * one). The card and the score sheet share it deliberately: the sheet's title used to repeat the
   * two team names printed on the labels directly beneath it, so the one line it owns said nothing
   * the volunteer could use to confirm they had opened the right game out of eight on the field.
   * The clock is `formatTime`'s "11:30 a.m." and is never set in capitals (F61).
   */
  function gameMetaLine(card: GameCard) {
    return [
      tournamentIds.length > 1 ? card.tournamentName : null,
      card.game.time ? formatTime(card.game.time) : 'Time TBD',
      card.game.location || card.venue?.name,
      card.divisionName,
    ].filter(Boolean).join(' · ');
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

  /**
   * The keyboard's action key never finalizes a score. Enter in the home field moves to the away
   * field; in the away field it moves to the Finalize button. Both fields sit inside the form, so
   * the default would be an implicit submit — and committing an irreversible result from a keyboard
   * key nobody aimed at is not a thing this screen should be able to do.
   *
   * The away branch focuses the button rather than blurring: a blur put focus on `document.body`,
   * so the next Tab restarted from the top of the page and a keyboard-only volunteer was thrown out
   * of the sheet. Focusing the button dismisses the on-screen keypad just the same, and lands the
   * volunteer on the action they were heading for.
   */
  function onScoreKeyDown(event: React.KeyboardEvent<HTMLInputElement>, field: 'home' | 'away') {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (field === 'home') awayScoreRef.current?.focus();
    else submitButtonRef.current?.focus();
  }

  /** The sheet and its numbers gone — after a save, or on Cancel (which `closeScoreEntry` holds while saving). */
  function resetScoreEntry() {
    setEditingCard(null);
    setHomeScore('');
    setAwayScore('');
    setShowScoreErrors(false);
    setScoreState('idle');
  }

  function closeScoreEntry() {
    if (scoreState === 'saving') return;
    resetScoreEntry();
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
        // J8-002: a lapsed session on save is recoverable, not a dead "Score not saved" error.
        if (response.status === 401) {
          // WI-3: preserve the typed numbers across the sign-in round-trip so they aren't lost.
          try {
            const pending: PendingScore = {
              orgSlug,
              gameId: editingCard.game.id,
              homeScore,
              awayScore,
              date,
            };
            sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
          } catch { /* sessionStorage unavailable — degrade to the notice-only recovery */ }
          setNotice({
            kind: 'warning',
            title: 'Sign in required',
            message: 'Your session ended before the score saved. Sign in again — your score is saved here and will come back.',
            action: { label: 'Sign in', href: `/auth/login?next=/${orgSlug}/scorekeeper` },
          });
          setScoreState('entering');
          return;
        }
        throw new Error(data.error ?? 'Failed to save score.');
      }

      // WI-3: the save landed — drop any stashed pending score so it can't re-open later.
      try { sessionStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }

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

      // F64: what happened, to which game, in a notice that floats above the bars and fades — never a box
      // at the top of the list that pushes every card down until the next tap.
      const score = `${editingCard.homeName} ${Number(homeScore)}, ${editingCard.awayName} ${Number(awayScore)}`;
      setNotice(null);
      setPill({
        id: Date.now(),
        news: false,
        message: nextStatus === 'submitted' ? SCOREKEEPER_WORDS.saved.review(score) : SCOREKEEPER_WORDS.saved.final(score),
      });
      // The save is done: reset directly (`closeScoreEntry` holds while the state still says saving).
      resetScoreEntry();
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
    ? emptyState?.message ?? SCOREKEEPER_WORDS.emptyNoGames
    : hasFilters
      ? 'Clear filters or switch status buckets to widen the list.'
      : 'All available games are outside this bucket.';

  const isCorrection = editingCard?.game.status === 'submitted';
  const submitLabel = isCorrection
    ? SCOREKEEPER_WORDS.submit.correction
    : selectedPolicyRequiresReview
      ? SCOREKEEPER_WORDS.submit.review
      : SCOREKEEPER_WORDS.submit.final;
  const policyNote = isCorrection
    ? SCOREKEEPER_WORDS.note.correction
    : selectedPolicyRequiresReview
      ? SCOREKEEPER_WORDS.note.review
      : SCOREKEEPER_WORDS.note.final;

  // WI-3: the notice (incl. the session-lapsed "Sign in" recovery) must be visible where the
  // volunteer's eyes are. When the score sheet is open it renders INSIDE the sheet, above the
  // numbers; otherwise it renders in its usual place in the list.
  const sheetOpen = Boolean(editingCard) && scoreState !== 'idle';
  const noticeBlock = notice ? (
    <Callout tone={NOTICE_TONE[notice.kind]} role={notice.kind === 'danger' ? 'alert' : 'status'}>
      <strong className={styles.noticeTitle}>{notice.title}</strong>
      <span className={styles.noticeText}>{notice.message}</span>
      {notice.action && (
        <a href={notice.action.href} className={`btn btn-lime ${styles.noticeAction}`}>
          {notice.action.label}
        </a>
      )}
    </Callout>
  ) : null;

  // The centred card above 900 stands the same dialog floor the frame stands below it: Escape (Cancel's
  // twin), Back, focus in on open and home to the card on close, the keyboard kept inside.
  useDialogFloor(sheetOpen && !isPhoneNav, deskSheetRef, {
    onClose: closeScoreEntry,
    busy: scoreState === 'saving',
    opener: openerRef,
    trap: true,
  });

  const scoreForm = editingCard ? (
    <form
      className={styles.scoreForm}
      onSubmit={event => {
        event.preventDefault();
        void submitScore();
      }}
    >
      {/* The head: what the volunteer is entering, as a sentence, and which game — time, field,
          division. The team names are on the boxes' labels. No ×: Cancel is the way out. */}
      <div className={styles.sheetHead}>
        <h2 id={SHEET_TITLE_ID} className={styles.sheetTitle}>{SCOREKEEPER_WORDS.sheetHead}</h2>
        <p className={styles.sheetMeta}>{gameMetaLine(editingCard)}</p>
      </div>

      {/* WI-3: session-lapsed (and other) notices render here, above the score, while the sheet is
          open — so the volunteer sees the "Sign in" recovery without closing it. */}
      {noticeBlock && <div className={styles.sheetNotice}>{noticeBlock}</div>}

      {/* Two big fields, nothing beside them. The −/+ steppers this replaces (J8-007) were
          meant to spare a volunteer the keyboard, but at 48px each they left the number
          itself ~29px on a 390px phone — and the score is entered once, after the game, so
          there was never a running tally to step. `text` + `inputMode` + `pattern` is what
          reliably raises the 0-9 keypad; `type=number` also let a stray character blank the
          field and let a laptop scroll wheel change a final score. */}
      <div className={styles.scoreGrid}>
        <label>
          <span>{editingCard.homeName}</span>
          <input
            autoFocus
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            enterKeyHint="next"
            value={homeScore}
            onFocus={event => event.currentTarget.select()}
            onKeyDown={event => onScoreKeyDown(event, 'home')}
            onChange={event => setHomeScore(sanitizeScore(event.target.value))}
            className={`${styles.scoreInput} ${showScoreErrors && homeScore === '' ? styles.inputError : ''}`}
          />
        </label>
        <span className={styles.scoreDivider} aria-hidden>–</span>
        <label>
          <span>{editingCard.awayName}</span>
          <input
            ref={awayScoreRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            enterKeyHint="done"
            value={awayScore}
            onFocus={event => event.currentTarget.select()}
            onKeyDown={event => onScoreKeyDown(event, 'away')}
            onChange={event => setAwayScore(sanitizeScore(event.target.value))}
            className={`${styles.scoreInput} ${showScoreErrors && awayScore === '' ? styles.inputError : ''}`}
          />
        </label>
      </div>

      {showScoreErrors && (homeScore === '' || awayScore === '') && (
        <div className={styles.sheetNote}>
          <Callout tone="bad" role="alert" icon={<AlertCircle size={16} aria-hidden />} flush>
            {SCOREKEEPER_WORDS.bothRequired}
          </Callout>
        </div>
      )}

      {/* J8-008: what Submit will do, said before the press, directly above the button it explains —
          a white callout with an amber edge (the organizer reviews) or an olive one (final at once). */}
      <div className={styles.sheetNote}>
        <Callout tone={isCorrection || selectedPolicyRequiresReview ? 'warn' : 'olive'} icon={<Info size={16} aria-hidden />} flush>
          {policyNote}
        </Callout>
      </div>

      {/* Cancel takes only what it needs; the one lime takes the rest and stays under the thumb.
          Pinned to the sheet's foot (`data-sheet-foot`), so a long head never scrolls it away. */}
      <div className={styles.sheetActions} data-sheet-foot="">
        <button type="button" className={`btn btn-outline ${styles.sheetButton}`} onClick={closeScoreEntry} disabled={scoreState === 'saving'}>
          Cancel
        </button>
        <button ref={submitButtonRef} type="submit" className={`btn btn-lime ${styles.sheetButton}`} disabled={scoreState === 'saving'}>
          {scoreState === 'saving' ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  ) : null;

  return (
    <div className={styles.page}>
      {/* The title band: "Field scores" at the 20px every page title takes, Refresh on its line. No
          eyebrow — the tab under the thumb and the title already name the job. */}
      <section className={styles.header}>
        <h1 className={styles.title}>{SCOREKEEPER_WORDS.title}</h1>
        <button type="button" className={`btn btn-outline ${styles.iconButton}`} onClick={loadGames} aria-label="Refresh games">
          <RefreshCw size={18} aria-hidden />
        </button>
      </section>

      {/* The three counter tiles that used to sit here are retired: the status bar at the bottom
          of the screen now carries the same three numbers, and showing them twice was the single
          biggest contributor to a volunteer arriving at a screenful of chrome with no games on it. */}

      {/* The date stays visible at every width — it is the one piece of state a volunteer must be
          able to confirm at a glance before they trust the board in front of them. */}
      <section className={styles.dateRow} aria-label="Day">
        {/* No calendar glyph of our own: the browser's date input draws its own picker button, and
            two calendar icons on one field is one icon explaining the other. The native one is
            also the one that actually opens the picker — ours was decoration taking width the
            date itself needs. */}
        <label className={styles.dateControl}>
          <input
            type="date"
            value={date}
            aria-label="Day to score"
            /**
             * The browser's own picker carries a **Clear** button we cannot remove, and an empty
             * date leaves this board showing games for a day it can no longer name. Clearing
             * therefore means "back to today" — the field visibly refills, so the volunteer sees
             * what their press did rather than staring at `yyyy-mm-dd` over a stale list.
             */
            onChange={event => setDate(event.target.value || todayString())}
          />
        </label>
        <button type="button" className={`btn btn-outline ${styles.dayButton}`} onClick={() => setDate(todayString())}>
          Today
        </button>
        <button
          type="button"
          className={`btn btn-outline ${styles.dayButton} ${styles.filtersToggle}`}
          aria-expanded={filtersOpen}
          aria-controls="sk-find-games"
          /* The badge is decoration to a screen reader; the count belongs in the name. */
          aria-label={activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : 'Filters'}
          onClick={() => setFiltersOpen(open => !open)}
        >
          <SlidersHorizontal size={15} aria-hidden />
          Filters
          {/* A badge, not extra words: the button must not change width when a filter is set —
              that growth is what clipped the day off the date beside it. */}
          {activeFilterCount > 0 && (
            <span className={styles.filterCount} aria-hidden>{activeFilterCount}</span>
          )}
        </button>
      </section>

      <section
        id="sk-find-games"
        className={`${styles.controls} ${filtersOpen ? '' : styles.controlsClosed}`}
        aria-label="Find games"
      >
        <label className={styles.searchControl}>
          <Search size={16} aria-hidden />
          <input
            type="search"
            value={teamSearch}
            onChange={event => setTeamSearch(event.target.value)}
            placeholder="Search team"
          />
        </label>

        <select className={styles.select} value={fieldFilter} onChange={event => setFieldFilter(event.target.value)} aria-label="Field">
          <option value="">All fields</option>
          {venues.map(venue => (
            <option key={venue.id} value={venue.id}>{venue.name}</option>
          ))}
        </select>

        <select className={styles.select} value={divisionFilter} onChange={event => setDivisionFilter(event.target.value)} aria-label="Division">
          <option value="">All divisions</option>
          {divisions.map(division => (
            <option key={division.id} value={division.id}>{division.name}</option>
          ))}
        </select>
      </section>

      {/* Rendered HERE, in its natural place in the flow, and lifted to the bottom of the phone's
          screen by the shared stylesheet. Rendering it last instead would put the buckets at the
          foot of a tablet's page. Review's count is a waiting count: the amber pill while above zero. */}
      <DayOfFilterBar label="Status filter">
        {([
          ['open', SCOREKEEPER_BUCKET.open, counts.open],
          ['pending', SCOREKEEPER_BUCKET.pending, counts.pending],
          ['final', SCOREKEEPER_BUCKET.final, counts.final],
          ['all', SCOREKEEPER_BUCKET.all, cards.length],
        ] as const).map(([filter, label, count]) => (
          <DayOfFilterButton
            key={filter}
            label={label}
            count={count}
            waiting={filter === 'pending'}
            active={statusFilter === filter}
            onClick={() => setStatusFilter(filter)}
          />
        ))}
      </DayOfFilterBar>

      {!sheetOpen && noticeBlock}

      {loading ? (
        <section className={styles.loadingState} aria-label="Loading games">
          <span />
          <span />
          <span />
        </section>
      ) : visibleCards.length === 0 ? (
        <section className={styles.emptyState}>
          <Trophy size={22} aria-hidden />
          <h2>{emptyTitle}</h2>
          <p>{emptyMessage}</p>
          {hasFilters && (
            <button type="button" className={`btn btn-outline ${styles.dayButton}`} onClick={resetFilters}>
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
            const meta = gameMetaLine(card);

            const isNow = game.id === nowCardId;

            return (
              <button
                key={game.id}
                type="button"
                className={`${styles.gameCard} ${isNow ? styles.gameCardNow : ''} ${game.status === 'cancelled' ? styles.gameCardCancelled : ''}`}
                onClick={event => {
                  openerRef.current = event.currentTarget;
                  openScoreEntry(card);
                }}
                disabled={!editable}
              >
                <span className={styles.gameMeta}>
                  <MapPin size={14} aria-hidden />
                  {meta}
                </span>
                <span className={styles.chip}>
                  {isNow
                    ? <span className={styles.nowBadge}>{GAME_DAY_LIST.upNext}</span>
                    : <RepChip tone={statusTone(game.status)}>{statusLabel(game, readAt)}</RepChip>}
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

                <span className={styles.cardAction}>{cardActionWord(game, policyReview)}</span>
              </button>
            );
          })}
        </section>
      )}

      {/* The score sheet — the frame's form at the bar's breakpoint (over the bars, a tap on its dim does
          nothing, on the keypad's edge), a centred card above it. ONE form inside either. */}
      {sheetOpen && (isPhoneNav ? (
        <SheetFrame
          form
          holdDim
          keypad
          role="dialog"
          aria-labelledby={SHEET_TITLE_ID}
          onClose={closeScoreEntry}
          opener={openerRef}
          busy={scoreState === 'saving'}
        >
          {scoreForm}
        </SheetFrame>
      ) : (
        <>
          <div className={styles.deskDim} aria-hidden />
          <div ref={deskSheetRef} className={styles.deskSheet} role="dialog" aria-modal="true" aria-labelledby={SHEET_TITLE_ID} tabIndex={-1} data-escape-owner="">
            {scoreForm}
          </div>
        </>
      ))}

      {pill && <NoticePill key={pill.id} message={pill.message} news={pill.news} onDone={() => setPill(null)} />}
    </div>
  );
}
