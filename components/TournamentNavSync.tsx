'use client';
import { useEffect } from 'react';
import { useOrgNav } from './OrgNavContext';

/** Hands the tournament being viewed to the shell's context (the flip pill's id, today's-games window). The tab facts
 *  no longer ride here: the band, rail and footer take them from the layout as props. */
export default function TournamentNavSync({ tournamentId, startDate, endDate, status }: {
  tournamentId: string;
  startDate: string | null;
  endDate: string | null;
  status: string | null;
}) {
  const { setTournamentNav } = useOrgNav();

  useEffect(() => {
    setTournamentNav({ tournamentId, startDate, endDate, status });
    return () => setTournamentNav(null);
  }, [tournamentId, startDate, endDate, status, setTournamentNav]);

  return null;
}
