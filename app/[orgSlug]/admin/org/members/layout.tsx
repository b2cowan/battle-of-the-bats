import { redirectPremiumOffOrgPage } from '@/lib/coach-portal-request';

/**
 * Organization › Members and its Audit log: a Premium Coaches Portal's people live on its team's Staff page (ruling 1R), so
 * both old addresses send the coach there before the page mounts (Settings in both workspaces, Session 3 —
 * `lib/premium-org-pages.ts` holds the rule). Clubs and leagues pass; a Tournament plan never reaches here (the org layout).
 * The audit log has no portal home of its own: its page sits under this layout, and the ruling sends it to Staff too.
 */
export default async function MembersLayout({
  params,
  children,
}: {
  params: Promise<{ orgSlug: string }>;
  children: React.ReactNode;
}) {
  await redirectPremiumOffOrgPage((await params).orgSlug, 'members');
  return <>{children}</>;
}
