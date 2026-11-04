'use client';
import { createContext, useContext, useState } from 'react';

/** What the shell needs to know about the tournament currently being viewed: the flip pill's id (lib/use-public-flip.ts,
 *  read by the installed app's bar, which the root layout mounts outside the tournament layout) and today's-games window.
 *  The tab facts are not here: the band, rail and footer take them from the layout as props. (The org's name, logo and
 *  home link and the tournament's name were the old side rail's identity block; they went with it, Public tournament
 *  pages Stage 8 Part 4a.) */
export interface TournamentNavState {
  /** The flip pill's tournament (lib/use-public-flip.ts). */
  tournamentId: string;
  startDate: string | null;
  endDate: string | null;
  status: string | null;
}

interface OrgNavValue {
  tournamentId: string | null;
  tournamentStartDate: string | null;
  tournamentEndDate: string | null;
  tournamentStatus: string | null;
  /** One object; `null` clears the tournament identity (what the sync component does on unmount). */
  setTournamentNav: (nav: TournamentNavState | null) => void;
}

const OrgNavContext = createContext<OrgNavValue>({
  tournamentId: null,
  tournamentStartDate: null,
  tournamentEndDate: null,
  tournamentStatus: null,
  setTournamentNav: () => {},
});

export function OrgNavProvider({ children }: { children: React.ReactNode }) {
  const [tournament, setTournamentNav] = useState<TournamentNavState | null>(null);

  return (
    <OrgNavContext.Provider value={{
      tournamentId: tournament?.tournamentId ?? null,
      tournamentStartDate: tournament?.startDate ?? null,
      tournamentEndDate: tournament?.endDate ?? null,
      tournamentStatus: tournament?.status ?? null,
      setTournamentNav,
    }}>
      {children}
    </OrgNavContext.Provider>
  );
}

export function useOrgNav() {
  return useContext(OrgNavContext);
}
