'use client';
import { createContext, useContext, useState, useCallback } from 'react';
import type { PublicPageKey } from '@/lib/public-pages';

type RegisterCta = 'register' | 'waitlist' | null;

interface OrgNavValue {
  logoUrl: string | null;
  orgName: string;
  /** Non-null when the org's public page is a real destination for this visitor's route
   *  (public-site module or 2+ active events — Nav Unification Stage B.2). Turns the
   *  event chrome's org name (phone eyebrow, desktop rail crumb) into a link up. */
  orgHomeHref: string | null;
  tournamentSlug: string | null;
  tournamentName: string | null;
  /** Tournament id — powers the top-bar fan notification bell (needs an id to subscribe). */
  tournamentId: string | null;
  /** True when this tournament's plan includes fan push (Tournament Plus+) — gates the bell. */
  fanAlertsEnabled: boolean;
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
  setOrgNav: (logoUrl: string | null, orgName: string, orgHomeHref?: string | null) => void;
  setTournamentNav: (slug: string | null, name: string | null, colorMode?: 'dark' | 'light' | null, hiddenPages?: PublicPageKey[], registerCta?: RegisterCta, tournamentId?: string | null, fanAlertsEnabled?: boolean) => void;
  setTournamentStatus: (startDate: string | null, endDate: string | null, status: string | null, finished?: boolean) => void;
}

const OrgNavContext = createContext<OrgNavValue>({
  logoUrl: null,
  orgName: '',
  orgHomeHref: null,
  tournamentSlug: null,
  tournamentName: null,
  tournamentId: null,
  fanAlertsEnabled: false,
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
  const [orgHomeHref, setOrgHomeHref] = useState<string | null>(null);
  const [tournamentSlug, setTournamentSlug] = useState<string | null>(null);
  const [tournamentName, setTournamentName] = useState<string | null>(null);
  const [tournamentId, setTournamentId] = useState<string | null>(null);
  const [fanAlertsEnabled, setFanAlertsEnabled] = useState(false);
  const [tournamentColorMode, setTournamentColorMode] = useState<'dark' | 'light' | null>(null);
  const [tournamentHiddenPages, setTournamentHiddenPages] = useState<PublicPageKey[]>([]);
  const [tournamentRegisterCta, setTournamentRegisterCta] = useState<RegisterCta>(null);
  const [tournamentStartDate, setTournamentStartDate] = useState<string | null>(null);
  const [tournamentEndDate, setTournamentEndDate] = useState<string | null>(null);
  const [tournamentStatus, setTournamentStatusState] = useState<string | null>(null);
  const [tournamentFinished, setTournamentFinished] = useState(false);

  const setOrgNav = useCallback((url: string | null, name: string, homeHref: string | null = null) => {
    setLogoUrl(url);
    setOrgName(name);
    setOrgHomeHref(homeHref);
  }, []);

  const setTournamentNav = useCallback((slug: string | null, name: string | null, colorMode: 'dark' | 'light' | null = null, hiddenPages: PublicPageKey[] = [], registerCta: RegisterCta = null, tId: string | null = null, fanAlerts = false) => {
    setTournamentSlug(slug);
    setTournamentName(name);
    setTournamentColorMode(colorMode);
    setTournamentHiddenPages(hiddenPages);
    setTournamentRegisterCta(registerCta);
    setTournamentId(tId);
    setFanAlertsEnabled(fanAlerts);
  }, []);

  const setTournamentStatus = useCallback((startDate: string | null, endDate: string | null, status: string | null, finished = false) => {
    setTournamentStartDate(startDate);
    setTournamentEndDate(endDate);
    setTournamentStatusState(status);
    setTournamentFinished(finished);
  }, []);

  return (
    <OrgNavContext.Provider value={{ logoUrl, orgName, orgHomeHref, tournamentSlug, tournamentName, tournamentId, fanAlertsEnabled, tournamentColorMode, tournamentHiddenPages, tournamentRegisterCta, tournamentStartDate, tournamentEndDate, tournamentStatus, tournamentFinished, setOrgNav, setTournamentNav, setTournamentStatus }}>
      {children}
    </OrgNavContext.Provider>
  );
}

export function useOrgNav() {
  return useContext(OrgNavContext);
}
