'use client';
import { createContext, useContext, useState, useCallback } from 'react';
import type { PublicPageKey } from '@/lib/public-pages';

type RegisterCta = 'register' | 'waitlist' | null;

interface OrgNavValue {
  logoUrl: string | null;
  orgName: string;
  tournamentSlug: string | null;
  tournamentName: string | null;
  tournamentColorMode: 'dark' | 'light' | null;
  tournamentHiddenPages: PublicPageKey[];
  tournamentRegisterCta: RegisterCta;
  tournamentStartDate: string | null;
  tournamentEndDate: string | null;
  tournamentStatus: string | null;
  /** True once the event is effectively over (marked complete, bracket decided, or a
   *  no-bracket event played out past its end date) — keeps the top-bar phase pill in
   *  step with the finished overview body. */
  tournamentFinished: boolean;
  setOrgNav: (logoUrl: string | null, orgName: string) => void;
  setTournamentNav: (slug: string | null, name: string | null, colorMode?: 'dark' | 'light' | null, hiddenPages?: PublicPageKey[], registerCta?: RegisterCta) => void;
  setTournamentStatus: (startDate: string | null, endDate: string | null, status: string | null, finished?: boolean) => void;
}

const OrgNavContext = createContext<OrgNavValue>({
  logoUrl: null,
  orgName: '',
  tournamentSlug: null,
  tournamentName: null,
  tournamentColorMode: null,
  tournamentHiddenPages: [],
  tournamentRegisterCta: null,
  tournamentStartDate: null,
  tournamentEndDate: null,
  tournamentStatus: null,
  tournamentFinished: false,
  setOrgNav: () => {},
  setTournamentNav: () => {},
  setTournamentStatus: () => {},
});

export function OrgNavProvider({ children }: { children: React.ReactNode }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [orgName, setOrgName] = useState('');
  const [tournamentSlug, setTournamentSlug] = useState<string | null>(null);
  const [tournamentName, setTournamentName] = useState<string | null>(null);
  const [tournamentColorMode, setTournamentColorMode] = useState<'dark' | 'light' | null>(null);
  const [tournamentHiddenPages, setTournamentHiddenPages] = useState<PublicPageKey[]>([]);
  const [tournamentRegisterCta, setTournamentRegisterCta] = useState<RegisterCta>(null);
  const [tournamentStartDate, setTournamentStartDate] = useState<string | null>(null);
  const [tournamentEndDate, setTournamentEndDate] = useState<string | null>(null);
  const [tournamentStatus, setTournamentStatusState] = useState<string | null>(null);
  const [tournamentFinished, setTournamentFinished] = useState(false);

  const setOrgNav = useCallback((url: string | null, name: string) => {
    setLogoUrl(url);
    setOrgName(name);
  }, []);

  const setTournamentNav = useCallback((slug: string | null, name: string | null, colorMode: 'dark' | 'light' | null = null, hiddenPages: PublicPageKey[] = [], registerCta: RegisterCta = null) => {
    setTournamentSlug(slug);
    setTournamentName(name);
    setTournamentColorMode(colorMode);
    setTournamentHiddenPages(hiddenPages);
    setTournamentRegisterCta(registerCta);
  }, []);

  const setTournamentStatus = useCallback((startDate: string | null, endDate: string | null, status: string | null, finished = false) => {
    setTournamentStartDate(startDate);
    setTournamentEndDate(endDate);
    setTournamentStatusState(status);
    setTournamentFinished(finished);
  }, []);

  return (
    <OrgNavContext.Provider value={{ logoUrl, orgName, tournamentSlug, tournamentName, tournamentColorMode, tournamentHiddenPages, tournamentRegisterCta, tournamentStartDate, tournamentEndDate, tournamentStatus, tournamentFinished, setOrgNav, setTournamentNav, setTournamentStatus }}>
      {children}
    </OrgNavContext.Provider>
  );
}

export function useOrgNav() {
  return useContext(OrgNavContext);
}
