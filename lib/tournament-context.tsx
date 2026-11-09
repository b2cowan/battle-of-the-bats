'use client';
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import type { Tournament, TournamentStatus } from './types';
import { DEFAULT_SPORT } from './sports';
import {
  isDemoOrgSlug,
  SANDBOX_TOURNAMENT_DATASET_KEY,
  SANDBOX_TOURNAMENT_CHANGED_EVENT,
  SANDBOX_SELECT_TOURNAMENT_EVENT,
} from './demo-org';
import { adminEventCookieName, adminEventCookiePath, chooseTournament } from './admin-event-choice';
import type { AdminTournamentSeed } from './admin-tournament-list';

interface TournamentContextType {
  /** All available tournaments, newest first — scoped to user's assignments when applicable */
  tournaments: Tournament[];
  /** Tournament admin is currently editing (may differ from the public active one) */
  currentTournament: Tournament | null;
  /** True when the current tournament is completed — all data is read-only */
  isLocked: boolean;
  loading: boolean;
  setCurrentTournament: (t: Tournament) => void;
  /** Re-read the list. `selectId` makes that event the current one once it is in the list (a tournament
   *  just created: its row exists only after this read). */
  refresh: (selectId?: string) => Promise<void>;
}

const TournamentContext = createContext<TournamentContextType>({
  tournaments: [],
  currentTournament: null,
  isLocked: false,
  loading: true,
  setCurrentTournament: () => {},
  refresh: async () => {},
});

const ADMIN_T_KEY = 'botb_admin_tournament_id';

function storageKey(orgSlug?: string) {
  return orgSlug ? `${ADMIN_T_KEY}:${orgSlug}` : ADMIN_T_KEY;
}

type TournamentRow = {
  id: string;
  org_id?: string | null;
  year: number;
  name: string;
  slug?: string | null;
  sport?: string | null;
  status?: TournamentStatus | null;
  is_active?: boolean | null;
  start_date?: string | null;
  end_date?: string | null;
  contact_email?: string | null;
  notify_teams_on_complete?: boolean | null;
  results_notified_at?: string | null;
  results_notification_sent_count?: number | null;
  settings?: Record<string, unknown> | null;
  /** Computed by the list route, not a column (the game-day rule's "first game started" half). */
  first_game_started?: boolean;
};

/** The remembered choice, in the order the browser tries it: the cookie (the copy the server reads too), then the
 *  `localStorage` copy (the only one before Navigation Phase 0 — a choice made before the cookie existed). */
function readSavedChoice(orgSlug?: string): string[] {
  if (typeof window === 'undefined') return [];
  const out: string[] = [];
  if (orgSlug) {
    const name = `${adminEventCookieName(orgSlug)}=`;
    const hit = document.cookie.split('; ').find(c => c.startsWith(name));
    if (hit) {
      try { out.push(decodeURIComponent(hit.slice(name.length))); } catch { /* a mangled cookie is no choice */ }
    }
  }
  try {
    const stored = localStorage.getItem(storageKey(orgSlug));
    if (stored) out.push(stored);
  } catch { /* storage blocked: the cookie alone */ }
  return out;
}

/** Remember the choice in both copies: the cookie, so the server's next paint names it (`lib/admin-event-choice.ts`), and
 *  `localStorage`, the browser's own copy. The last choice wins on the next load in every tab (as it always did). */
function rememberChoice(orgSlug: string | undefined, id: string) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(storageKey(orgSlug), id); } catch { /* storage blocked: the cookie alone */ }
  if (orgSlug) {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${adminEventCookieName(orgSlug)}=${encodeURIComponent(id)}; Path=${adminEventCookiePath(orgSlug)}; Max-Age=31536000; SameSite=Lax${secure}`;
  }
}

/** A re-read that found nothing new keeps the objects on screen, so nothing re-renders or refetches off a new identity
 *  (the seed and the browser's read carry the same rows). */
function same(a: unknown, b: unknown) {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

/** The provider's first state from the server's seed — props only (never the window), so the server's paint and the
 *  browser's first render are the same render and hydration matches. */
function fromSeed(seed: AdminTournamentSeed) {
  const tournaments = (seed.rows as unknown as TournamentRow[]).map(mapRow).filter(t => t.status !== 'archived');
  const { current } = chooseTournament(tournaments, { urlId: seed.urlId, urlSlug: seed.urlSlug, savedIds: [seed.savedId] });
  return { tournaments, current };
}

function mapRow(r: TournamentRow): Tournament {
  const status: TournamentStatus = r.status ?? (r.is_active ? 'active' : 'completed');
  return {
    id:             r.id,
    organizationId: r.org_id ?? undefined,
    year:           r.year,
    name:           r.name,
    slug:           r.slug ?? '',
    sport:          r.sport ?? DEFAULT_SPORT,
    status,
    isActive:       status === 'active',
    startDate:      r.start_date ?? undefined,
    endDate:        r.end_date ?? undefined,
    firstGameStarted: Boolean(r.first_game_started),
    contactEmail:   r.contact_email ?? undefined,
    notifyTeamsOnComplete: Boolean(r.notify_teams_on_complete),
    resultsNotifiedAt: r.results_notified_at ?? null,
    resultsNotificationSentCount: r.results_notification_sent_count ?? 0,
    settings:       (r.settings && typeof r.settings === 'object') ? r.settings : {},
  };
}

export function TournamentProvider({ children, orgSlug, seed }: {
  children: ReactNode;
  orgSlug?: string;
  /** The server's list and the remembered/addressed choice, on a tournament page's full load (Navigation Phase 0): the
   *  strip, the phone bar and the sidebar name the event on the first paint. Absent → the browser reads, as before. */
  seed?: AdminTournamentSeed;
}) {
  const [initial] = useState(() => (seed ? fromSeed(seed) : null));
  const [tournaments, setTournaments] = useState<Tournament[]>(initial?.tournaments ?? []);
  const [currentTournament, setCurrentState] = useState<Tournament | null>(initial?.current ?? null);
  const [loading, setLoading] = useState(!initial);

  // The newest read wins: an older one landing last would set a list without the event just created (or
  // just changed) and move the selection back. A caller's pick waits for whichever read lands.
  const readSeq = useRef(0);
  const pendingPick = useRef<string | null>(null);
  const chosenSinceMount = useRef(false);
  // `quiet`: the mount read behind a seed. The page already has its event, so the read must not flip `loading` and blank
  // a page for a read that (nearly always) changes nothing.
  const read = useCallback(async (selectId?: string, quiet = false) => {
    const mine = ++readSeq.current;
    if (selectId) pendingPick.current = selectId;
    if (!quiet) setLoading(true);
    // Use the scoped API endpoint — server enforces org filter + assignment filter
    try {
      const orgParam = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
      const res = await fetch(`/api/admin/tournaments${orgParam}`);
      // Behind a seed, a failed read keeps the server's list: it is the same list from moments ago, and an empty one would
      // take the event off a screen that had it (/review 2026-11-09). A loud read still empties, as it always did.
      if (quiet && !res.ok) return;
      const data: unknown = res.ok ? await res.json() : [];
      const rows = Array.isArray(data) ? data as TournamentRow[] : [];
      const ts = rows.map(mapRow).filter(t => t.status !== 'archived');
      if (mine !== readSeq.current) return;

      setTournaments(prev => (same(prev, ts) ? prev : ts));
      // Deep-link support: a ?tournamentId= in the URL (notifications, emails)
      // takes priority over the saved/active tournament so links land correctly.
      // ?tournamentSlug= is the same door keyed by slug — slugs are stable across
      // environments where row ids are not, which is what lets the sandbox (and any
      // shared link) address "the Invitational" without knowing this database's ids.
      // A caller's pick (the event it just created) outranks the address and the saved choice. The order is ONE rule,
      // shared with the server's first paint (`chooseTournament`).
      const params = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search)
        : null;
      // A person who switched events while this quiet read was in flight keeps their switch. The sidebar is live from the
      // first paint, so a read landing late could otherwise put back the address's event over the one they just chose
      // (/review 2026-11-09). The list still refreshes.
      if (quiet && chosenSinceMount.current) return;
      const pick = pendingPick.current;
      pendingPick.current = null;
      const { current, remember } = chooseTournament(ts, {
        pick,
        urlId: params?.get('tournamentId') ?? null,
        urlSlug: params?.get('tournamentSlug') ?? null,
        savedIds: readSavedChoice(orgSlug),
      });
      setCurrentState(prev => (prev && current && same(prev, current) ? prev : current));

      // A choice (the caller's, the address's or the saved one) is remembered in both copies, so the switcher, later
      // navigation and the server's next paint agree. A choice saved before the cookie existed gains its cookie here.
      if (remember) rememberChoice(orgSlug, remember.id);
    } catch (error) {
      if (mine !== readSeq.current) return;
      console.error('[tournament-context] Failed to load tournaments', error);
      if (quiet) return;
      setTournaments([]);
      setCurrentState(null);
    } finally {
      if (mine === readSeq.current) setLoading(false);
    }
  }, [orgSlug]);

  const refresh = useCallback((selectId?: string) => read(selectId), [read]);

  // The browser still reads the list on mount. Behind a seed the read is quiet, and it replaces the seed only where
  // something changed between the server's read and this one.
  const seeded = initial !== null;
  useEffect(() => {
    const timer = window.setTimeout(() => { void read(undefined, seeded); }, 0);
    return () => window.clearTimeout(timer);
  }, [read, seeded]);

  function setCurrentTournament(t: Tournament) {
    chosenSinceMount.current = true;
    setCurrentState(t);
    rememberChoice(orgSlug, t.id);
  }

  /**
   * Sandbox only — the two-way contract with the demo chrome's moments dock.
   *
   * The chrome is mounted by the org shell, OUTSIDE this provider, so it cannot call
   * `useTournament()`. Instead: the provider stamps the current selection on `<html>` (and
   * announces changes), so the dock can highlight the moment the visitor is actually editing —
   * including when they switch through the sidebar's own dropdown; and it listens for the dock's
   * select events, so pressing a moment switches the editing context without a reload. Both
   * effects are inert for every real customer: the org is not in the hardcoded demo allow-list,
   * so neither the stamp nor the listener is installed.
   */
  useEffect(() => {
    if (!orgSlug || !isDemoOrgSlug(orgSlug)) return;
    const root = document.documentElement;
    root.dataset[SANDBOX_TOURNAMENT_DATASET_KEY] = currentTournament?.slug ?? '';
    window.dispatchEvent(new CustomEvent(SANDBOX_TOURNAMENT_CHANGED_EVENT, {
      detail: { slug: currentTournament?.slug ?? null },
    }));
    return () => {
      delete root.dataset[SANDBOX_TOURNAMENT_DATASET_KEY];
      // Announce the clearing too, so the chrome's mirror of this value goes stale-free when the
      // visitor leaves the operator half (review finding: the stamp was symmetric, the signal
      // was not).
      window.dispatchEvent(new CustomEvent(SANDBOX_TOURNAMENT_CHANGED_EVENT, {
        detail: { slug: null },
      }));
    };
  }, [orgSlug, currentTournament]);

  /**
   * A dock/tour selection that arrives before the tournaments list has loaded (the provider
   * fetches on mount) would otherwise be silently dropped — the press's navigation still happens,
   * but the editing context never switches and the chrome's arrival narration never fires. Stash
   * the ask and honour it the moment the list lands. (Review finding — the window is a few
   * hundred milliseconds wide, exactly where a fast visitor crossing fan → operator lives.)
   */
  const pendingSandboxSelect = useRef<string | null>(null);

  useEffect(() => {
    if (!orgSlug || !isDemoOrgSlug(orgSlug)) return;
    const onSelect = (event: Event) => {
      const slug = (event as CustomEvent<{ slug?: string }>).detail?.slug;
      if (!slug) return;
      const target = tournaments.find(t => t.slug === slug);
      if (target) {
        pendingSandboxSelect.current = null;
        if (target.id !== currentTournament?.id) setCurrentTournament(target);
      } else {
        pendingSandboxSelect.current = slug;
      }
    };
    window.addEventListener(SANDBOX_SELECT_TOURNAMENT_EVENT, onSelect);
    return () => window.removeEventListener(SANDBOX_SELECT_TOURNAMENT_EVENT, onSelect);
    // setCurrentTournament is re-created per render but only wraps stable setters — the deps
    // that matter are the values the handler closes over.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug, tournaments, currentTournament]);

  // Honour a stashed selection once the list exists. Also covers the race where the first fetch
  // resolves against a URL the router hasn't updated yet: the stash, not the URL, carries intent.
  useEffect(() => {
    if (!orgSlug || !isDemoOrgSlug(orgSlug)) return;
    const wanted = pendingSandboxSelect.current;
    if (!wanted) return;
    const target = tournaments.find(t => t.slug === wanted);
    if (!target) return;
    pendingSandboxSelect.current = null;
    if (target.id !== currentTournament?.id) setCurrentTournament(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug, tournaments]);

  const isLocked = currentTournament?.status === 'completed';

  return (
    <TournamentContext.Provider value={{ tournaments, currentTournament, isLocked, loading, setCurrentTournament, refresh }}>
      {children}
    </TournamentContext.Provider>
  );
}

export function useTournament() {
  return useContext(TournamentContext);
}
