import { openClubHome } from '../club-home';

/**
 * Plan & billing on a Tournament plan is the shared billing page (`page.tsx`, unchanged). ⚖ One home per setting (navigation
 * Phase 2 Part B, P2): a club's Plan & billing is its own, so an old link to this address opens it. A layout, so the page's own
 * routing (a one-team workspace to the Coaches Portal's billing) stays exactly as it was.
 */
export default async function TournamentPlanBillingLayout({ params, children }: {
  params: Promise<{ orgSlug: string }>;
  children: React.ReactNode;
}) {
  await openClubHome((await params).orgSlug, 'org/billing');
  return <>{children}</>;
}
