'use client';
import { createContext, useContext, useState, useCallback } from 'react';

interface OrgNavValue {
  logoUrl: string | null;
  orgName: string;
  tournamentSlug: string | null;
  tournamentName: string | null;
  setOrgNav: (logoUrl: string | null, orgName: string) => void;
  setTournamentNav: (slug: string | null, name: string | null) => void;
}

const OrgNavContext = createContext<OrgNavValue>({
  logoUrl: null,
  orgName: '',
  tournamentSlug: null,
  tournamentName: null,
  setOrgNav: () => {},
  setTournamentNav: () => {},
});

export function OrgNavProvider({ children }: { children: React.ReactNode }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [orgName, setOrgName] = useState('');
  const [tournamentSlug, setTournamentSlug] = useState<string | null>(null);
  const [tournamentName, setTournamentName] = useState<string | null>(null);

  const setOrgNav = useCallback((url: string | null, name: string) => {
    setLogoUrl(url);
    setOrgName(name);
  }, []);

  const setTournamentNav = useCallback((slug: string | null, name: string | null) => {
    setTournamentSlug(slug);
    setTournamentName(name);
  }, []);

  return (
    <OrgNavContext.Provider value={{ logoUrl, orgName, tournamentSlug, tournamentName, setOrgNav, setTournamentNav }}>
      {children}
    </OrgNavContext.Provider>
  );
}

export function useOrgNav() {
  return useContext(OrgNavContext);
}
