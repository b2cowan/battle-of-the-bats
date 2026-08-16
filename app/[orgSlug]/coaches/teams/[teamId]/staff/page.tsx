'use client';
import { use } from 'react';
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
  const { assignments, loading } = useCoaches();
  const page = useCoachSeasonPage(orgSlug, teamId);
  // M1: the panel is team-scoped and membership-gated, so the gate reads the CURRENT role — the
  // live assignment mirrors the membership. `page.capabilities` is season-resolved and, under a
  // stale archived `?year=` URL, would answer with a bygone season's role: a demoted former head
  // coach would watch the live panel try to render and fail, and a newly-promoted one would be
  // told only the head coach manages staff (adversarial review 2026-08-16).
  const isHeadCoach =
    (assignments.find(a => a.teamId === teamId)?.capabilities ?? page.capabilities)?.isHeadCoach ?? false;

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
        helpLabel="Coaching staff"
        help={{ module: 'coaches', sectionIds: ['premium-staff'], fullGuideHref: `/${orgSlug}/coaches/help#premium-staff` }}
      />

      {/*
        M1 (owner ruling 2026-08-16): staff belongs to the TEAM, not to a season — one list,
        wherever you opened it from. The old per-season "who may still look at this finished
        season" mode (Chunk F governing rule 3) is retired with the per-season access model.
        A stale archive URL still lands here; the panel it finds manages the team's staff.
      */}
      {page.isReadOnly && isHeadCoach && (
        <div className={styles.seasonReadAccessNote} role="note">
          <strong>Staff belongs to the team, not to a season.</strong>{' '}
          This is your team&apos;s one staff list — changes here apply everywhere at once. Who
          coached this finished season is part of its record and doesn&apos;t change.
        </div>
      )}

      {isHeadCoach ? (
        <CoachStaffPanel orgSlug={orgSlug} teamId={teamId} />
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
