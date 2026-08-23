import { redirect } from 'next/navigation';

/**
 * The standalone check-in sub-page retired in the One-Room build (2026-08-23): check-in is the
 * hub's Check-in face now. The address survives — bookmarks and muscle memory land on the face,
 * never a 404 — but the surface exists in exactly one place.
 */
export default async function CoachTryoutCheckInRedirect({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = await params;
  redirect(`/${orgSlug}/coaches/teams/${teamId}/tryouts?stage=tryout-day&view=check-in`);
}
