import { redirect } from 'next/navigation';
import { practicePlansHref } from '@/lib/practice-plans-address';

/**
 * The drill library MOVED under Practice plans (practices re-evaluation stage 0, owner ruling D5,
 * 2026-09-14): Practice plans is the hub for the season's practices, plan templates AND drills;
 * Skills & Goals keeps metrics, goals and sessions. The address stays so an old link — a bookmark,
 * a help article, the Skills & Goals tile's memory — lands on the same library rather than a 404
 * (`development/board` → Insights → Coverage is the precedent); every visitor is sent on before anything renders.
 */
export default async function DevelopmentDrillsRedirect({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = await params;
  redirect(practicePlansHref(`/${orgSlug}/coaches/teams/${teamId}`, 'drills'));
}
