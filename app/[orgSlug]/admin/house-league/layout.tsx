import { redirectWorkspaceWithoutProgram } from '@/lib/coach-portal-request';

/**
 * House league (and every season page under it): its only door for a workspace without the program is a typed address. A Premium Coaches Portal or a tournament-only organization whose plan has none of it is sent home before the page
 * mounts (Retire the old tournament-only menu, step 3 — `lib/typed-only-pages.ts` holds the rule). Clubs and leagues pass.
 */
export default async function HouseLeagueLayout({
  params,
  children,
}: {
  params: Promise<{ orgSlug: string }>;
  children: React.ReactNode;
}) {
  await redirectWorkspaceWithoutProgram((await params).orgSlug, 'houseLeague');
  return <>{children}</>;
}
