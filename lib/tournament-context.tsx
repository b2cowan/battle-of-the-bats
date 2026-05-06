'use client';
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { Tournament, TournamentStatus } from './types';

interface TournamentContextType {
  /** All available tournaments, newest first — scoped to user's assignments when applicable */
  tournaments: Tournament[];
  /** Tournament admin is currently editing (may differ from the public active one) */
  currentTournament: Tournament | null;
  setCurrentTournament: (t: Tournament) => void;
  refresh: () => Promise<void>;
}

const TournamentContext = createContext<TournamentContextType>({
  tournaments: [],
  currentTournament: null,
  setCurrentTournament: () => {},
  refresh: async () => {},
});

const ADMIN_T_KEY = 'botb_admin_tournament_id';

function mapRow(r: any): Tournament {
  const status: TournamentStatus = r.status ?? (r.is_active ? 'active' : 'completed');
  return {
    id:             r.id,
    organizationId: r.organization_id ?? undefined,
    year:           r.year,
    name:           r.name,
    slug:           r.slug ?? '',
    status,
    isActive:       status === 'active',
    startDate:      r.start_date ?? undefined,
    endDate:        r.end_date ?? undefined,
  };
}

export function TournamentProvider({ children }: { children: ReactNode }) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [currentTournament, setCurrentState] = useState<Tournament | null>(null);

  const refresh = useCallback(async () => {
    // Use the scoped API endpoint — server enforces org filter + assignment filter
    const res = await fetch('/api/admin/tournaments');
    const rows: any[] = res.ok ? await res.json() : [];
    const ts = rows.map(mapRow).filter(t => t.status !== 'archived');

    setTournaments(ts);
    const savedId = typeof window !== 'undefined' ? localStorage.getItem(ADMIN_T_KEY) : null;
    const saved   = savedId ? ts.find(t => t.id === savedId) : null;
    const active  = ts.find(t => t.status === 'active');
    setCurrentState(saved ?? active ?? ts[0] ?? null);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  function setCurrentTournament(t: Tournament) {
    setCurrentState(t);
    if (typeof window !== 'undefined') {
      localStorage.setItem(ADMIN_T_KEY, t.id);
    }
  }

  return (
    <TournamentContext.Provider value={{ tournaments, currentTournament, setCurrentTournament, refresh }}>
      {children}
    </TournamentContext.Provider>
  );
}

export function useTournament() {
  return useContext(TournamentContext);
}
