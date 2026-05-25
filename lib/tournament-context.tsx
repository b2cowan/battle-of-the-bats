'use client';
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { Tournament, TournamentStatus } from './types';

interface TournamentContextType {
  /** All available tournaments, newest first — scoped to user's assignments when applicable */
  tournaments: Tournament[];
  /** Tournament admin is currently editing (may differ from the public active one) */
  currentTournament: Tournament | null;
  loading: boolean;
  setCurrentTournament: (t: Tournament) => void;
  refresh: () => Promise<void>;
}

const TournamentContext = createContext<TournamentContextType>({
  tournaments: [],
  currentTournament: null,
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
      const savedId = typeof window !== 'undefined' ? localStorage.getItem(storageKey(orgSlug)) : null;
      const saved   = savedId ? ts.find(t => t.id === savedId) : null;
      const active  = ts.find(t => t.status === 'active');
      setCurrentState(saved ?? active ?? ts[0] ?? null);
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

  return (
    <TournamentContext.Provider value={{ tournaments, currentTournament, loading, setCurrentTournament, refresh }}>
      {children}
    </TournamentContext.Provider>
  );
}

export function useTournament() {
  return useContext(TournamentContext);
}
