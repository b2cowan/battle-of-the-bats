'use client';
/**
 * The Tournaments list's one read (Tournament admin redesign Stage 4; one list since D7): every event of the
 * club, archived included, with its counts (`?counts=1`), and the club's sealed records. `reload` after any
 * change; only the newest read paints (Stage 1's lesson).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { willEmailResultsOnComplete } from '@/lib/coach-email-rules';
import { hasPlanFeature } from '@/lib/plan-features';
import type { EventStatus, ListEvent } from '@/lib/tournament-lists';

type Row = {
  id: string;
  name: string;
  slug: string | null;
  year: number | null;
  status: EventStatus | null;
  is_active: boolean | null;
  start_date: string | null;
  end_date: string | null;
  contact_email: string | null;
  default_contact_member_id: string | null;
  notify_teams_on_complete: boolean | null;
  results_notified_at: string | null;
  settings: Record<string, unknown> | null;
  accepted_teams?: number;
  division_count?: number;
  teams_played?: number;
  games_played?: number;
};

export type ListEventWithMail = ListEvent & { willEmailOnComplete: boolean };
export type SealedRecord = { archiveId: string; tournamentId: string | null; name: string; sealedAt: string };

export function useTournamentLists(orgSlug: string | undefined, planId: string | undefined) {
  const [events, setEvents] = useState<ListEventWithMail[]>([]);
  const [sealed, setSealed] = useState<SealedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const seq = useRef(0);

  const reload = useCallback(async () => {
    if (!orgSlug) return;
    const mine = ++seq.current;
    const q = `?orgSlug=${encodeURIComponent(orgSlug)}`;
    try {
      const [eventsRes, archivesRes] = await Promise.all([
        fetch(`/api/admin/tournaments${q}&counts=1`, { cache: 'no-store' }),
        fetch(`/api/admin/tournament-archives${q}`, { cache: 'no-store' }),
      ]);
      const rows = await eventsRes.json().catch(() => null) as Row[] | { error?: string } | null;
      if (!eventsRes.ok || !Array.isArray(rows)) throw new Error((rows as { error?: string } | null)?.error ?? 'The tournaments didn’t load.');
      const archives = archivesRes.ok ? await archivesRes.json().catch(() => []) as Array<{ id: string; tournamentId: string | null; tournamentName: string; sealedAt: string }> : [];
      if (mine !== seq.current) return;
      const summary = planId ? hasPlanFeature(planId as Parameters<typeof hasPlanFeature>[0], 'post_tournament_summary') : false;
      setEvents(rows.map(r => ({
        id: r.id,
        name: r.name,
        slug: r.slug ?? '',
        year: r.year ?? null,
        status: (r.status ?? (r.is_active ? 'active' : 'draft')) as EventStatus,
        startDate: r.start_date ?? null,
        endDate: r.end_date ?? null,
        contactEmail: r.contact_email ?? null,
        defaultContactMemberId: r.default_contact_member_id ?? null,
        acceptedTeams: r.accepted_teams ?? 0,
        divisionCount: r.division_count ?? 0,
        teamsPlayed: r.teams_played ?? 0,
        gamesPlayed: r.games_played ?? 0,
        // The sender's own rule for "Mark complete will email the teams" (the board's confirm reads it too).
        willEmailOnComplete: willEmailResultsOnComplete({
          notifyTeamsOnComplete: r.notify_teams_on_complete,
          settings: r.settings,
          resultsNotifiedAt: r.results_notified_at,
          planHasSummary: summary,
        }),
      })));
      setSealed((Array.isArray(archives) ? archives : []).map(a => ({ archiveId: a.id, tournamentId: a.tournamentId, name: a.tournamentName, sealedAt: a.sealedAt })));
      setError('');
    } catch (err) {
      if (mine === seq.current) setError(err instanceof Error ? err.message : 'The tournaments didn’t load.');
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [orgSlug, planId]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => { void reload(); });
    return () => window.cancelAnimationFrame(frame);
  }, [reload]);

  return { events, sealed, loading, error, reload };
}
