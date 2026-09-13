import { redirect } from 'next/navigation';
import { skillsAndGoalsHref } from '@/lib/development-address';

/**
 * The team board's separate page is GONE (development lifecycle Phase 1, mockup screen 1): its
 * job — every player in roster order with what has been recorded — moved into the Players view
 * on Skills & Goals, where the coach also picks WHICH metric the row shows. The route stays so an
 * old link (a bookmark, a help article, the Overview tile's memory) lands on the same records
 * rather than a 404; every visitor is sent on, before anything renders.
 */
export default async function DevelopmentBoardRedirect({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = await params;
  redirect(skillsAndGoalsHref(`/${orgSlug}/coaches/teams/${teamId}`, 'players'));
}
