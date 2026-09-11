'use client';
import { use, useState } from 'react';
import { Users, ShieldCheck, UserPlus } from 'lucide-react';
import { useCoachSeasonPage } from '@/lib/coaches-context';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import CoachStaffPanel from '@/components/coaches/CoachStaffPanel';
import { useCoaches } from '@/lib/coaches-context';
import CoachLoading from '@/components/coaches/CoachLoading';
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
  const assignment = assignments.find(a => a.teamId === teamId);
  const isHeadCoach = (assignment?.capabilities ?? page.capabilities)?.isHeadCoach ?? false;
  // Inviting is the page-level action, so the header owns the button and the panel owns the sheet
  // it opens (pass 2 of the staff access plan, 2026-09-11).
  const [inviteOpen, setInviteOpen] = useState(false);

  if (loading) return <CoachLoading label="Loading staff…" />;

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
          masthead that already says both; the icon joins the portal's 22px convention. No lede
          under the title — the list is the page. */}
      <CoachPageHeader
        icon={Users}
        title="Coaching staff"
        helpLabel="Coaching staff"
        help={{ module: 'coaches', sectionIds: ['premium-staff'], fullGuideHref: `/${orgSlug}/coaches/help#premium-staff` }}
        actions={isHeadCoach ? (
          <button type="button" className={styles.btnPrimary} onClick={() => setInviteOpen(true)}>
            <UserPlus size={15} aria-hidden /> Invite someone
          </button>
        ) : undefined}
      />

      {/*
        ⚠ The finished-season note that stood here is DELETED (2026-08-18). Staff belongs to the
        TEAM, not to a season (M1, 2026-08-16), and this note existed only to say so to a coach who
        had arrived from an archive URL — a state that no longer reaches this page at all, because
        a team with no live season lands on its closed-season page. One of the twenty-nine.
      */}

      {isHeadCoach ? (
        <CoachStaffPanel
          orgSlug={orgSlug}
          teamId={teamId}
          teamName={assignment?.teamName ?? 'the team'}
          inviteOpen={inviteOpen}
          onInviteOpenChange={setInviteOpen}
        />
      ) : (
        <CoachEmptyState
          quiet
          icon={<ShieldCheck size={20} aria-hidden />}
          headline="Only the head coach manages staff"
          description="This is where a team's staff are invited and their access is set, one area at a time."
          payoff="It's what gives each person their own sign-in rather than a shared password — which is why your own access is set here too."
          blocker="Ask your head coach if you need more areas turned on for you."
        />
      )}
    </div>
  );
}
