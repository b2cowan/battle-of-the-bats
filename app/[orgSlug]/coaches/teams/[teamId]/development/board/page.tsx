import { redirect } from 'next/navigation';
import { insightsDevelopmentHref } from '@/lib/development-address';

/**
 * The team board's separate page is GONE (development lifecycle Phase 1, mockup screen 1), and so
 * is the Players view that replaced it (re-evaluation stage 4, owner ruling G1, 2026-09-16): the
 * roster table has ONE home — Insights → Development → Coverage — where every coach with record
 * access can read it, Development grant or not. The route stays so an old link (a bookmark, a help
 * article, a tile's memory) lands on the same records rather than a 404; every visitor is sent on,
 * before anything renders.
 */
export default async function DevelopmentBoardRedirect({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = await params;
  redirect(insightsDevelopmentHref(`/${orgSlug}/coaches/teams/${teamId}`));
}
