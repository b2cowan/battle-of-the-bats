'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, Trophy } from 'lucide-react';
import { useCoaches, resolveClosedAssignment, useCoachSeasonPage } from '@/lib/coaches-context';
import CoachSeasonChip from '@/components/coaches/CoachSeasonChip';
import { useOrg } from '@/lib/org-context';
import type { SeasonWrappedPayload } from '@/lib/rep-season-wrapped';
import SeasonWrappedCard from '@/components/coaches/SeasonWrappedCard';
import StartNextSeasonModal from '@/components/coaches/StartNextSeasonModal';
import HelpButton from '@/components/help/HelpButton';
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
  // Chunk F: this page is now the ARCHIVE'S FRONT DOOR (D-F2), reached for any past season of
  // any team — not just a team whose only season has ended.
  const page = useCoachSeasonPage(orgSlug, teamId, yearParam);

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

  if (!page.hasAccess) {
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
              <CoachSeasonChip season={page.season} teamBase={page.teamBase} />
            </div>
            {seasonName && <p className={styles.pageSub}>{seasonName}</p>}
          </div>
        </div>
        {/* Chunk B (P1 #17): on a closed season this is one of only TWO doors the coach gets, so a
            missing help icon lands on the coach with the least context — the one returning months
            later to look something up. */}
        <HelpButton
          iconOnly
          label="Season's End"
          help={{ module: 'coaches', sectionIds: ['premium-season-end'], fullGuideHref: `/${orgSlug}/coaches/help#premium-season-end` }}
        />
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
            {/* Chunk F: the sidebar now carries the WHOLE record set for this season, so this
                page stops being the terminus it was in Batch 3 and becomes the way in. The one
                door that stays here is the cross-season view, which the sidebar can't express —
                it spans seasons rather than belonging to this one. */}
            <p className={styles.seasonEndNote} style={{ marginTop: 0 }}>
              Everything from this season is still here — roster, schedule, attendance, lineups,
              money records, documents and tryouts. Open any of them from the menu.
            </p>
            <Link href={`${base}/history/results`} className={styles.seasonDoorRow}>
              <span>
                Compare every season
                <small>Records, roster size and money summaries, season by season</small>
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
