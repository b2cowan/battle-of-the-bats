import { redirect } from 'next/navigation';

/**
 * The standalone "score as yourself" sub-page (Chunk E, WI-1) retired in the One-Room build
 * (2026-08-23): the coach's signed-in scorer is the hub's Score face now. The address survives —
 * the demo dock and old bookmarks land on the face, never a 404. The volunteer token door
 * (/tryout-score/{token}) is untouched: same shared surface, no account, no shell.
 */
export default async function CoachTryoutSelfScoreRedirect({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = await params;
  redirect(`/${orgSlug}/coaches/teams/${teamId}/tryouts?stage=tryout-day&view=score`);
}
