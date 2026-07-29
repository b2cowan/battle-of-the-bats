'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { use, useEffect } from 'react';
import { Users } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { useCoaches } from '@/lib/coaches-context';
import styles from './coaches.module.css';

/**
 * The /coaches entry point is a pure REDIRECTOR (owner call, Batch 3 QA 2026-07-29 —
 * replaces the old My Teams card grid): a coach lands in a team, never on a landing page.
 * Target order: the LAST team they were in (remembered per org by the sidebar) → their
 * first active team → their first closed team's Season's End. Team switching lives in the
 * sidebar dropdown (desktop) and the More sheet (mobile). Only a coach with no teams at
 * all sees a page here (the honest empty state below).
 */
export default function CoachesDashboard({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = use(params);
  const { currentOrg } = useOrg();
  const { assignments, closedAssignments, loading } = useCoaches();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isTeamWorkspace = currentOrg?.accountKind === 'team_workspace' || currentOrg?.planId === 'team';
  // Post-checkout arrival (`?success=1`) — carried through to the team landing so its welcome
  // (the "your team came with you" summary) reads correctly.
  const checkoutSucceeded = searchParams.get('success') === '1';

  useEffect(() => {
    if (loading) return;
    if (assignments.length === 0 && closedAssignments.length === 0) return; // empty state renders

    let lastId: string | null = null;
    try { lastId = localStorage.getItem(`flhq-coach-last-team:${orgSlug}`); } catch { /* ignore */ }
    const isActive = (id: string | null) => !!id && assignments.some(a => a.teamId === id);
    const isClosed = (id: string | null) => !!id && closedAssignments.some(a => a.teamId === id);

    const targetId = (isActive(lastId) || isClosed(lastId) ? lastId : null)
      ?? assignments[0]?.teamId
      ?? closedAssignments[0]?.teamId;
    if (!targetId) return;

    if (isClosed(targetId)) {
      router.replace(`/${orgSlug}/coaches/teams/${targetId}/season-end`);
    } else {
      const qs = checkoutSucceeded ? '?success=1' : '';
      router.replace(`/${orgSlug}/coaches/teams/${targetId}${qs}`);
    }
  }, [loading, assignments, closedAssignments, orgSlug, checkoutSucceeded, router]);

  if (loading) return <div className={styles.loadingState}>Loading teams…</div>;

  if (assignments.length === 0 && closedAssignments.length === 0) {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>
          <Users size={32} style={{ opacity: 0.25, marginBottom: '0.75rem' }} />
          <p className={styles.emptyStateTitle}>No team assignments yet</p>
          <p className={styles.emptyStateSub}>
            {isTeamWorkspace
              ? 'Your Coaches Portal exists, but your coach assignment is not active yet.'
              : "You'll appear here once your org admin assigns you to a team."}
          </p>
        </div>
      </div>
    );
  }

  return <div className={styles.loadingState}>Opening your portal…</div>;
}
