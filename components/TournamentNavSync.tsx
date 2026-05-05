'use client';
import { useEffect } from 'react';
import { useOrgNav } from './OrgNavContext';

export default function TournamentNavSync({
  slug,
  tournamentName,
}: {
  slug: string;
  tournamentName: string;
}) {
  const { setTournamentNav } = useOrgNav();

  useEffect(() => {
    setTournamentNav(slug, tournamentName);
    return () => setTournamentNav(null, null);
  }, [slug, tournamentName, setTournamentNav]);

  return null;
}
