'use client';
import { use } from 'react';
import { useSearchParams } from 'next/navigation';
import { Users, ShieldCheck } from 'lucide-react';
import { useCoachSeasonPage } from '@/lib/coaches-context';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import CoachStaffPanel from '@/components/coaches/CoachStaffPanel';
import { useCoaches } from '@/lib/coaches-context';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

export default function CoachStaffPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(params);
  const { loading } = useCoaches();
  const searchParams = useSearchParams();
  const page = useCoachSeasonPage(orgSlug, teamId, searchParams.get('year'));
  const isHeadCoach = page.capabilities?.isHeadCoach ?? false;

  if (loading) return <p className={styles.muted}>Loading…</p>;

  if (!page.hasAccess) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Page-header ruling 2026-08-11: breadcrumb and team-name line both retire into the
          masthead that already says both; the icon joins the portal's 22px convention. */}
      <CoachPageHeader
        icon={Users}
        title="Coaching staff"
        season={page.season}
        teamBase={page.teamBase}
        helpLabel="Coaching staff"
        help={{ module: 'coaches', sectionIds: ['premium-staff'], fullGuideHref: `/${orgSlug}/coaches/help#premium-staff` }}
      />

      {/*
        Governing rule 3 — the ONE deliberate write surface on a finished season, and the one
        place D-F4's chip-only signal is genuinely misleading: the season IS complete and these
        buttons DO work. Without this line, "Remove access" beside a Complete chip reads as though
        it might erase the person from the season's history rather than take away their view.
        Owner-approved exception, 2026-08-01 — one sentence, on one screen.
      */}
      {page.isReadOnly && isHeadCoach && (
        <div className={styles.seasonReadAccessNote} role="note">
          <strong>This season is finished, but you still control who can look at it.</strong>{' '}
          Removing someone here takes away their access to this season&apos;s records straight away,
          and affects nothing else — not what happened, and not your current season. What each
          person could see is part of the record, so it can&apos;t be changed.
        </div>
      )}

      {isHeadCoach ? (
        <CoachStaffPanel
          orgSlug={orgSlug}
          teamId={teamId}
          // In an archive the panel governs READ ACCESS ONLY: who may still open this season.
          // Nobody can be added to a season that has already happened.
          readAccessOnly={page.isReadOnly}
          seasonQuery={page.query}
        />
      ) : (
        <CoachEmptyState
          quiet
          icon={<ShieldCheck size={20} aria-hidden />}
          headline="Only the head coach manages staff"
          description="This is where a team's assistant coaches are invited and their access is set, one area at a time."
          payoff="It's what gives each assistant their own sign-in rather than a shared password — which is why your own access is set here too."
          blocker="Ask your head coach if you need more areas turned on for you."
        />
      )}
    </div>
  );
}
