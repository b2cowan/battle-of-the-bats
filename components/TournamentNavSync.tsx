'use client';
import { useEffect } from 'react';
import { useOrgNav } from './OrgNavContext';
import type { PublicPageKey } from '@/lib/public-pages';

export default function TournamentNavSync({
  slug,
  tournamentName,
  colorMode,
  hiddenPages = [],
}: {
  slug: string;
  tournamentName: string;
  colorMode?: 'dark' | 'light' | null;
  hiddenPages?: PublicPageKey[];
}) {
  const { setTournamentNav } = useOrgNav();

  useEffect(() => {
    setTournamentNav(slug, tournamentName, colorMode ?? 'dark', hiddenPages);
    return () => setTournamentNav(null, null);
  }, [slug, tournamentName, colorMode, hiddenPages, setTournamentNav]);

  return null;
}
