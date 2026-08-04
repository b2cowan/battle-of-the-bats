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

interface TournamentContextType {
  /** All available tournaments, newest first — scoped to user's assignments when applicable */
  tournaments: Tournament[];
  /** Tournament admin is currently editing (may differ from the public active one) */
  currentTournament: Tournament | null;
  /** True when the current tournament is completed — all data is read-only */
  isLocked: boolean;
  loading: boolean;
  setCurrentTournament: (t: Tournament) => void;
  refresh: () => Promise<void>;
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
};

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
    contactEmail:   r.contact_email ?? undefined,
    notifyTeamsOnComplete: Boolean(r.notify_teams_on_complete),
    resultsNotifiedAt: r.results_notified_at ?? null,
    resultsNotificationSentCount: r.results_notification_sent_count ?? 0,
    settings:       (r.settings && typeof r.settings === 'object') ? r.settings : {},
  };
}

export function TournamentProvider({ children, orgSlug }: { children: ReactNode; orgSlug?: string }) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [currentTournament, setCurrentState] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    // Use the scoped API endpoint — server enforces org filter + assignment filter
    try {
      const orgParam = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
      const res = await fetch(`/api/admin/tournaments${orgParam}`);
      const data: unknown = res.ok ? await res.json() : [];
      const rows = Array.isArray(data) ? data as TournamentRow[] : [];
      const ts = rows.map(mapRow).filter(t => t.status !== 'archived');

      setTournaments(ts);
      // Deep-link support: a ?tournamentId= in the URL (notifications, emails)
      // takes priority over the saved/active tournament so links land correctly.
      // ?tournamentSlug= is the same door keyed by slug — slugs are stable across
      // environments where row ids are not, which is what lets the sandbox (and any
      // shared link) address "the Invitational" without knowing this database's ids.
      const params = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search)
        : null;
      const urlId   = params?.get('tournamentId') ?? null;
      const urlSlug = params?.get('tournamentSlug') ?? null;
      const fromUrl = (urlId ? ts.find(t => t.id === urlId) : null)
        ?? (urlSlug ? ts.find(t => t.slug === urlSlug) : null);

      const savedId = typeof window !== 'undefined' ? localStorage.getItem(storageKey(orgSlug)) : null;
      const saved   = savedId ? ts.find(t => t.id === savedId) : null;
      const active  = ts.find(t => t.status === 'active');
      const resolved = fromUrl ?? saved ?? active ?? ts[0] ?? null;
      setCurrentState(resolved);

      // Persist the deep-linked choice so the switcher + later navigation agree.
      if (fromUrl && typeof window !== 'undefined') {
        localStorage.setItem(storageKey(orgSlug), fromUrl.id);
      }
    } catch (error) {
      console.error('[tournament-context] Failed to load tournaments', error);
      setTournaments([]);
      setCurrentState(null);
    } finally {
      setLoading(false);
    }
  }, [orgSlug]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  function setCurrentTournament(t: Tournament) {
    setCurrentState(t);
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey(orgSlug), t.id);
    }
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
