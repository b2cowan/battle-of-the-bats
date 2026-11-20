import OrgDoor from './OrgDoor';
import { redirectPremiumOffOrgPage } from '@/lib/coach-portal-request';

/**
 * `/org` — the door to Organization's first tab (`OrgDoor`). A Premium Coaches Portal has no Organization tabs left
 * (Settings in both workspaces, Session 3 — `lib/premium-org-pages.ts`): its door would open onto the "not yours" screen,
 * so it goes where sign-in sends the coach instead. The old Settings & access row on the tournament side came here.
 */
export default async function OrgDoorPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  await redirectPremiumOffOrgPage((await params).orgSlug, 'door');
  return <OrgDoor />;
}
