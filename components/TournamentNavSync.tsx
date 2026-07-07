'use client';
import { useEffect } from 'react';
import { useOrgNav } from './OrgNavContext';
import type { PublicPageKey } from '@/lib/public-pages';

export default function TournamentNavSync({
  slug,
  tournamentName,
  colorMode,
  hiddenPages = [],
  registerCta = null,
  startDate = null,
  endDate = null,
  status = null,
  finished = false,
  tournamentId = null,
  fanAlertsEnabled = false,
}: {
  slug: string;
  tournamentName: string;
  colorMode?: 'dark' | 'light' | null;
  hiddenPages?: PublicPageKey[];
  registerCta?: 'register' | 'waitlist' | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: string | null;
  finished?: boolean;
  tournamentId?: string | null;
  fanAlertsEnabled?: boolean;
}) {
  const { setTournamentNav, setTournamentStatus } = useOrgNav();

  useEffect(() => {
    setTournamentNav(slug, tournamentName, colorMode ?? 'dark', hiddenPages, registerCta, tournamentId, fanAlertsEnabled);
    setTournamentStatus(startDate, endDate, status, finished);
    return () => {
      setTournamentNav(null, null);
      setTournamentStatus(null, null, null);
    };
  }, [slug, tournamentName, colorMode, hiddenPages, registerCta, startDate, endDate, status, finished, tournamentId, fanAlertsEnabled, setTournamentNav, setTournamentStatus]);

  return null;
}
