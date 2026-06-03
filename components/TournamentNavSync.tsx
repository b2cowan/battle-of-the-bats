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
}: {
  slug: string;
  tournamentName: string;
  colorMode?: 'dark' | 'light' | null;
  hiddenPages?: PublicPageKey[];
  registerCta?: 'register' | 'waitlist' | null;
}) {
  const { setTournamentNav } = useOrgNav();

  useEffect(() => {
    setTournamentNav(slug, tournamentName, colorMode ?? 'dark', hiddenPages, registerCta);
    return () => setTournamentNav(null, null);
  }, [slug, tournamentName, colorMode, hiddenPages, registerCta, setTournamentNav]);

  return null;
}
