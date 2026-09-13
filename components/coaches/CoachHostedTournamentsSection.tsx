'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy } from 'lucide-react';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import { trackTournamentAcquisition } from '@/components/marketing/tournament-acquisition';
import { formatCardDateRange } from '@/components/coaches/CoachRegistrationCard';
import type { HostedTournamentRow } from '@/app/api/coaches/[orgSlug]/teams/[teamId]/hosted-tournaments/route';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import card from '@/components/coaches/CoachRegistrationCard.module.css';

/**
 * "TOURNAMENTS YOU RUN" — the second half of the team's tournament season, on the page that
 * already holds the first half (owner ruling 2026-09-13: *"a centralized tournaments section
 * instead of 2 separate navs"*). It replaced the Overview's "run local tournaments here too"
 * banner, which showed to every staff member and walked the ones without the right into a
 * "Forbidden".
 *
 * Draws NOTHING unless the viewer may run tournaments in this org — the read decides that the
 * way every admin tournament route does, so there is no door here that the admin side would
 * refuse. Sits BELOW this season's entries (D8): the entries are what the page is for.
 *
 * Both doors skip the workspace-level "All tournaments" list (owner, on the first mockup):
 *   · Set up a tournament → the create wizard, directly; finishing lands on the new Dashboard.
 *   · Manage → that tournament's own Dashboard, the screen it is run from.
 */
const STATUS_WORD: Record<string, string> = { draft: 'Draft', active: 'Active', completed: 'Completed' };

export default function CoachHostedTournamentsSection({ orgSlug, teamId }: { orgSlug: string; teamId: string }) {
  const [state, setState] = useState<{ canRun: boolean; tournaments: HostedTournamentRow[] } | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/coaches/${orgSlug}/teams/${teamId}/hosted-tournaments`)
      .then(res => (res.ok ? res.json() as Promise<{ canRun: boolean; tournaments: HostedTournamentRow[] }> : null))
      .then(json => { if (active && json) setState({ canRun: !!json.canRun, tournaments: json.tournaments ?? [] }); })
      .catch(() => {});
    return () => { active = false; };
  }, [orgSlug, teamId]);

  if (!state?.canRun) return null;

  const setupHref = `/${orgSlug}/admin/org/tournaments?create=1&source=coach_portal_tournaments`;
  const track = (eventType: 'tournament_plus_acquisition_cta_viewed' | 'tournament_plus_acquisition_cta_clicked') =>
    trackTournamentAcquisition({
      eventType,
      acquisitionSource: 'coach_portal_tournaments',
      surface: 'admin_upgrade_gate',
      orgSlug,
      currentPath: window.location.pathname,
      ctaHref: setupHref,
    });

  return (
    <section aria-labelledby="hosted-tournaments-heading">
      <h2 id="hosted-tournaments-heading" className={styles.sectionKicker}>Tournaments you run</h2>
      {state.tournaments.length === 0 ? (
        <SetupCard href={setupHref} onView={() => track('tournament_plus_acquisition_cta_viewed')} onClick={() => track('tournament_plus_acquisition_cta_clicked')} />
      ) : (
        <div className={styles.tournamentHistoryList}>
          {state.tournaments.map(t => {
            const parts: string[] = [];
            const dates = formatCardDateRange(t.startDate, t.endDate);
            if (dates) parts.push(dates);
            parts.push(`${t.registeredTeams} ${t.registeredTeams === 1 ? 'team' : 'teams'} registered`);
            return (
              <div key={t.id} className={card.entry}>
                <Link
                  href={`/${orgSlug}/admin/tournaments/dashboard?tournamentSlug=${encodeURIComponent(t.slug)}`}
                  className={card.card}
                  aria-label={`Manage ${t.name}`}
                >
                  <div className={card.cardMain}>
                    <div className={card.cardTitle}>{t.name}</div>
                    <div className={card.cardMeta}>
                      {parts.map((p, i) => <span key={i}>{p}</span>)}
                    </div>
                  </div>
                  <div className={card.cardStatus}>
                    <span className="badge badge-info">{STATUS_WORD[t.status] ?? t.status}</span>
                    <span className={card.cardAction} aria-hidden>Manage →</span>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** The retired Overview banner's sentence, in its permanent home; fires the same analytics. */
function SetupCard({ href, onView, onClick }: { href: string; onView: () => void; onClick: () => void }) {
  useEffect(() => { onView(); /* once per mount */ }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div onClickCapture={e => { if ((e.target as HTMLElement).closest('a')) onClick(); }}>
      <CoachEmptyState
        compact
        icon={<Trophy size={20} aria-hidden />}
        headline="Run your own tournament"
        description="A quick round robin or exhibition weekend, set up from here."
        payoff="Registrations, the schedule, scores and what visiting teams see — all on one page you run."
        primaryAction={{ label: 'Set up a tournament', href }}
      />
    </div>
  );
}
