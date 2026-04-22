'use client';
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Tournament } from './types';
import { getTournaments, getActiveTournament } from './storage';

interface TournamentContextType {
  /** All available tournaments, newest first */
  tournaments: Tournament[];
  /** Tournament admin is currently editing (may differ from the public active one) */
  currentTournament: Tournament | null;
  setCurrentTournament: (t: Tournament) => void;
  refresh: () => void;
}

const TournamentContext = createContext<TournamentContextType>({
  tournaments: [],
  currentTournament: null,
  setCurrentTournament: () => {},
  refresh: () => {},
});

const ADMIN_T_KEY = 'botb_admin_tournament_id';

export function TournamentProvider({ children }: { children: ReactNode }) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [currentTournament, setCurrentState] = useState<Tournament | null>(null);

  const refresh = useCallback(() => {
    const ts = getTournaments();
    setTournaments(ts);
    const savedId = typeof window !== 'undefined' ? localStorage.getItem(ADMIN_T_KEY) : null;
    const saved   = savedId ? ts.find(t => t.id === savedId) : null;
    const active  = getActiveTournament();
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
