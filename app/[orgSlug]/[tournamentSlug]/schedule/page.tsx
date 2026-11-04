import { forwardToOwnAddress } from '@/lib/club-forward';
import PublicSchedule from '@/components/public/PublicSchedule';

/**
 * The tournament's schedule. A server page so a club with its own web address can forward the old address to it first
 * (Club Tier Stage 4e, lib/club-forward.ts); the body is the client component PublicSchedule (Stage 8 Part 3b deleted the
 * old body and the client wrapper that chose between the two).
 */
export default async function SchedulePage({ params }: { params: Promise<{ orgSlug: string; tournamentSlug: string }> }) {
  const { orgSlug, tournamentSlug } = await params;
  await forwardToOwnAddress(orgSlug, `/${tournamentSlug}/schedule`);
  return <PublicSchedule orgSlug={orgSlug} tournamentSlug={tournamentSlug} />;
}
