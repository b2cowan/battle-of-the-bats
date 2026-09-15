'use client';
import { use, type ReactNode } from 'react';
import { useSelectedLayoutSegment } from 'next/navigation';
import { TrendingUp } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import { canWriteDevelopment } from '@/lib/coach-capabilities';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import CoachNotGranted from '@/components/coaches/CoachNotGranted';
import styles from '../../../coaches.module.css';

/**
 * ═══ THE ONE DOOR TO SKILLS & GOALS (re-evaluation stage 0, owner ruling D5, 2026-09-14) ═══
 *
 * "Either they can see and update everything in there or they cannot." A coach without the
 * Development grant has no door: the nav hides the entry (`isCoachNavItemVisible`), the reads
 * behind the rooms refuse (`sessions`, `sessions/[id]`), and every address under `/development`
 * — the hub, a session, a metric's definition — answers with the ONE not-granted block. It lives
 * here, on the subtree's layout, so the rule is written once rather than once per room
 * (/simplify, 2026-09-14: three copies of the same predicate and copy were the drift the
 * shared-block rule exists to prevent). Same shape as `CoachTeamSeasonGate` one level up: it
 * renders `children` or it does not — never a read-only face.
 *
 * ⚠ The redirect pages in this subtree (`board`, `drills`, `templates`, and `metrics` — a
 * definition is a sheet on the hub since stage 1, its old pages redirect into `?edit=`) are server pages that
 * `redirect()` before anything of their own renders — but under a client layout that redirect
 * reaches the browser INSIDE the streamed children, and a gate that replaces the children
 * swallows it: a coach without the grant opening an old drills bookmark was stopped at this
 * block instead of landing on Practice plans (found 2026-09-14, the practices stage 0 walk). So
 * those segments are let through untouched; the addresses they redirect to carry their own
 * gates, and this block still shows for every page that would actually have rendered here.
 * ⚠ What is NOT behind this door, by ruling: the player's own Skills & Goals tab on the roster
 * page and the Insights → Development reports (station 9 of the re-evaluation decides those).
 */
export default function DevelopmentLayout({ children, params }: {
  children: ReactNode;
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(params);
  const { assignments, loading } = useCoaches();
  const segment = useSelectedLayoutSegment();
  const assignment = assignments.find(a => a.teamId === teamId);
  // A redirect page never renders anything of its own — see the header. Let it through.
  const redirectsAway = segment === 'board' || segment === 'drills' || segment === 'templates' || segment === 'metrics';
  if (!redirectsAway && !loading && assignment && !canWriteDevelopment(assignment.capabilities)) {
    return (
      <div className={styles.page}>
        <CoachPageHeader
          icon={TrendingUp}
          title="Skills & Goals"
          helpLabel="Skills & Goals"
          help={{ module: 'coaches', sectionIds: ['premium-development'], fullGuideHref: `/${orgSlug}/coaches/help#premium-development` }}
        />
        <CoachNotGranted
          icon={<TrendingUp size={20} aria-hidden />}
          section="Skills & Goals"
          what="What this team measures, the sessions that record it, and what each player is working on — one row per player, so nobody quietly gets overlooked."
          blocker="Skills & Goals opens with the Development grant. Ask your head coach to grant it."
        />
      </div>
    );
  }
  return <>{children}</>;
}
