'use client';
import { createContext, useContext, useState, useCallback } from 'react';
import type { PublicPageKey } from '@/lib/public-pages';

interface OrgNavValue {
  logoUrl: string | null;
  orgName: string;
  tournamentSlug: string | null;
  tournamentName: string | null;
  tournamentColorMode: 'dark' | 'light' | null;
  tournamentHiddenPages: PublicPageKey[];
  setOrgNav: (logoUrl: string | null, orgName: string) => void;
  setTournamentNav: (slug: string | null, name: string | null, colorMode?: 'dark' | 'light' | null, hiddenPages?: PublicPageKey[]) => void;
}

const OrgNavContext = createContext<OrgNavValue>({
  logoUrl: null,
  orgName: '',
  tournamentSlug: null,
  tournamentName: null,
  tournamentColorMode: null,
  tournamentHiddenPages: [],
  setOrgNav: () => {},
  setTournamentNav: () => {},
});

export function OrgNavProvider({ children }: { children: React.ReactNode }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [orgName, setOrgName] = useState('');
  const [tournamentSlug, setTournamentSlug] = useState<string | null>(null);
  const [tournamentName, setTournamentName] = useState<string | null>(null);
  const [tournamentColorMode, setTournamentColorMode] = useState<'dark' | 'light' | null>(null);
  const [tournamentHiddenPages, setTournamentHiddenPages] = useState<PublicPageKey[]>([]);

  const setOrgNav = useCallback((url: string | null, name: string) => {
    setLogoUrl(url);
    setOrgName(name);
  }, []);

  const setTournamentNav = useCallback((slug: string | null, name: string | null, colorMode: 'dark' | 'light' | null = null, hiddenPages: PublicPageKey[] = []) => {
    setTournamentSlug(slug);
    setTournamentName(name);
    setTournamentColorMode(colorMode);
    setTournamentHiddenPages(hiddenPages);
  }, []);

  return (
    <OrgNavContext.Provider value={{ logoUrl, orgName, tournamentSlug, tournamentName, tournamentColorMode, tournamentHiddenPages, setOrgNav, setTournamentNav }}>
      {children}
    </OrgNavContext.Provider>
  );
}

export function useOrgNav() {
  return useContext(OrgNavContext);
}
