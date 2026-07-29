'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, Trophy } from 'lucide-react';
import { useCoaches, resolveClosedAssignment } from '@/lib/coaches-context';
import { useOrg } from '@/lib/org-context';
import type { SeasonWrappedPayload } from '@/lib/rep-season-wrapped';
import SeasonWrappedCard from '@/components/coaches/SeasonWrappedCard';
import StartNextSeasonModal from '@/components/coaches/StartNextSeasonModal';
import styles from '../../../coaches.module.css';

/**
 * Season's End (Batch 3, P0 #1 — approved mockups = spec). The landing surface for a
 * CLOSED season: leads with Season Wrapped, keeps read-only doors into what the coach
 * built, and names the honest path to the next season (standalone head coach: start it;
 * club coach: the team reappears when the admin staffs next season). Also reachable with
 * `?year=` from the Insights archive for any past season of an ACTIVE team.
 */
export default function SeasonEndPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(params);
  const { assignments, closedAssignments, loading, refresh } = useCoaches();
  const { currentOrg } = useOrg();
  const router = useRouter();
  const searchParams = useSearchParams();
  const yearParam = searchParams.get('year');
  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  const active = assignments.find(a => a.teamId === teamId) ?? null;
  // Shared closed-state predicate (lib/coaches-context.tsx) — same rule as the navs.
  const closed = resolveClosedAssignment(assignments, closedAssignments, teamId);

  const [wrapped, setWrapped] = useState<SeasonWrappedPayload | null>(null);
  const [error, setError] = useState('');
  const [fetching, setFetching] = useState(true);
  const [rolloverOpen, setRolloverOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    setFetching(true);
    setError('');
    fetch(`/api/coaches/${orgSlug}/teams/${teamId}/wrapped${yearParam ? `?year=${encodeURIComponent(yearParam)}` : ''}`)
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then(json => { if (!cancelled) setWrapped(json.wrapped as SeasonWrappedPayload); })
      .catch(() => { if (!cancelled) setError('This season’s wrap-up couldn’t be loaded — refresh to try again.'); })
      .finally(() => { if (!cancelled) setFetching(false); });
    return () => { cancelled = true; };
  }, [loading, orgSlug, teamId, yearParam]);

  if (loading) return <p className={styles.muted}>Loading...</p>;

  if (!active && !closed) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  const teamName = wrapped?.teamName ?? active?.teamName ?? closed?.teamName ?? '';
  const seasonName = wrapped?.seasonName ?? closed?.programYearName ?? '';
  const isTeamWorkspace = currentOrg?.accountKind === 'team_workspace' || currentOrg?.planId === 'team';
  const orgName = currentOrg?.name ?? 'your club';
  // The forward path only renders in the CLOSED-ONLY state; a coach browsing a past season
  // of a rolled-forward team already has their active season.
  const coachRole = active?.coachRole ?? closed?.coachRole ?? 'assistant_coach';
  const showStartNext = !active && !!closed && isTeamWorkspace && coachRole === 'head_coach';

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <h1 className={styles.pageTitle}>{teamName}</h1>
              <span className={`${styles.badge} ${styles.badgeCompleted}`}>Season complete</span>
            </div>
            {seasonName && <p className={styles.pageSub}>{seasonName}</p>}
          </div>
        </div>
      </div>

      {fetching ? (
        <div className={styles.loadingState}>Wrapping up the season…</div>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : wrapped ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', maxWidth: 560 }}>
          <SeasonWrappedCard wrapped={wrapped} />

          <section className={styles.setupPanel} aria-labelledby="season-end-doors">
            <p className={styles.setupKicker} id="season-end-doors">Look back any time</p>
            {/* ONE door (deviation from the mockup's two rows — both landed on the same page,
                which read as two destinations and delivered one). The archive carries the
                game log plus per-season records, roster size, and money summaries. */}
            <Link href={`${base}/history/results`} className={styles.seasonDoorRow}>
              <span>
                Results archive
                <small>Every score, plus records, roster &amp; money summaries per season</small>
              </span>
              <ChevronRight size={16} className={styles.seasonDoorArrow} aria-hidden />
            </Link>
          </section>

          {showStartNext && closed && (
            <>
              <button type="button" className={`btn btn-lime ${styles.setupNextCta}`} onClick={() => setRolloverOpen(true)}>
                Start next season
              </button>
              <p className={styles.seasonEndNote}>
                Starting next season carries your roster and staff forward. This season stays right here, read-only.
              </p>
            </>
          )}

          {active && (
            <Link href={base} className={styles.btnSecondary} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <Trophy size={15} aria-hidden /> Go to {active.programYearName}
            </Link>
          )}

          {!active && !isTeamWorkspace && (
            <section className={styles.setupPanel}>
              <p className={styles.seasonEndNote}>
                Seasons are managed by <strong>{orgName}</strong>. When you&apos;re on next season&apos;s
                coaching staff, the team reappears here automatically.
              </p>
            </section>
          )}
        </div>
      ) : null}

      {rolloverOpen && closed && (
        <StartNextSeasonModal
          orgSlug={orgSlug}
          teamId={teamId}
          currentSeasonName={closed.programYearName}
          defaultNextYear={(closed.programYearYear ?? new Date().getFullYear()) + 1}
          onClose={() => setRolloverOpen(false)}
          onDone={async () => {
            setRolloverOpen(false);
            await refresh();
            router.push(base);
          }}
        />
      )}
    </div>
  );
}
