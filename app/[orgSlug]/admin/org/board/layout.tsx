import { redirectWorkspaceWithoutProgram } from '@/lib/coach-portal-request';

/**
 * Organization › The board: a Premium workspace has no board (ruling 1R — its people live on the team staff page), and the page had no door for it. A Premium Coaches Portal or a tournament-only organization whose plan has none of it is sent home before the page
 * mounts (Retire the old tournament-only menu, step 3 — `lib/typed-only-pages.ts` holds the rule). Clubs and leagues pass.
 */
export default async function BoardLayout({
  params,
  children,
}: {
  params: Promise<{ orgSlug: string }>;
  children: React.ReactNode;
}) {
  await redirectWorkspaceWithoutProgram((await params).orgSlug, 'board');
  return <>{children}</>;
}
