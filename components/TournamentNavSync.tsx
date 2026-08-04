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
  hasPublicBracket = false,
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
  /** True when the organizer has configured a bracket and Standings is public — adds the
   *  Playoffs tab to every nav surface. Resolved in the layout; see the note there. */
  hasPublicBracket?: boolean;
}) {
  const { setTournamentNav, setTournamentStatus } = useOrgNav();

  useEffect(() => {
    setTournamentNav({
      slug,
      name: tournamentName,
      colorMode: colorMode ?? 'dark',
      hiddenPages,
      registerCta,
      tournamentId,
      fanAlertsEnabled,
      hasBracket: hasPublicBracket,
    });
    setTournamentStatus(startDate, endDate, status, finished);
    return () => {
      setTournamentNav(null);
      setTournamentStatus(null, null, null);
    };
  }, [slug, tournamentName, colorMode, hiddenPages, registerCta, startDate, endDate, status, finished, tournamentId, fanAlertsEnabled, hasPublicBracket, setTournamentNav, setTournamentStatus]);

  return null;
}
