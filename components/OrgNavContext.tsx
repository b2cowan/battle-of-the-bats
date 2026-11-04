'use client';
import { createContext, useContext, useState, useCallback } from 'react';

/** What the shell needs to know about the tournament currently being viewed (the side rail's heading, the flip pill's
 *  id, today's-games window). The tab facts are not here: the band, rail and footer take them from the layout as props. */
export interface TournamentNavState {
  name: string;
  /** The flip pill's tournament (lib/use-public-flip.ts). */
  tournamentId: string;
  startDate: string | null;
  endDate: string | null;
  status: string | null;
}

interface OrgNavValue {
  logoUrl: string | null;
  orgName: string;
  /** Non-null when the org's public page is a real destination for this visitor's route
   *  (public-site module or 2+ active events — Nav Unification Stage B.2). Turns the
   *  event chrome's org name (the desktop rail crumb) into a link up. */
  orgHomeHref: string | null;
  tournamentName: string | null;
  tournamentId: string | null;
  tournamentStartDate: string | null;
  tournamentEndDate: string | null;
  tournamentStatus: string | null;
  setOrgNav: (logoUrl: string | null, orgName: string, orgHomeHref?: string | null) => void;
  /** One object; `null` clears the tournament identity (what the sync component does on unmount). */
  setTournamentNav: (nav: TournamentNavState | null) => void;
}

const OrgNavContext = createContext<OrgNavValue>({
  logoUrl: null,
  orgName: '',
  orgHomeHref: null,
  tournamentName: null,
  tournamentId: null,
  tournamentStartDate: null,
  tournamentEndDate: null,
  tournamentStatus: null,
  setOrgNav: () => {},
  setTournamentNav: () => {},
});

export function OrgNavProvider({ children }: { children: React.ReactNode }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [orgName, setOrgName] = useState('');
  const [orgHomeHref, setOrgHomeHref] = useState<string | null>(null);
  const [tournament, setTournamentNav] = useState<TournamentNavState | null>(null);

  const setOrgNav = useCallback((url: string | null, name: string, homeHref: string | null = null) => {
    setLogoUrl(url);
    setOrgName(name);
    setOrgHomeHref(homeHref);
  }, []);

  return (
    <OrgNavContext.Provider value={{
      logoUrl, orgName, orgHomeHref,
      tournamentName: tournament?.name ?? null,
      tournamentId: tournament?.tournamentId ?? null,
      tournamentStartDate: tournament?.startDate ?? null,
      tournamentEndDate: tournament?.endDate ?? null,
      tournamentStatus: tournament?.status ?? null,
      setOrgNav, setTournamentNav,
    }}>
      {children}
    </OrgNavContext.Provider>
  );
}

export function useOrgNav() {
  return useContext(OrgNavContext);
}
