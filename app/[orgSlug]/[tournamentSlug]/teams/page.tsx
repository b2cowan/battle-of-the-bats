import { forwardToOwnAddress } from '@/lib/club-forward';
import TeamsPageClient from './TeamsPageClient';
import { isPublicFrameOn } from '@/lib/public-frame-server';

/**
 * The tournament's teams. The page itself is a client component (./TeamsPageClient); this server page exists so a club with its
 * own web address can forward the old address to it first (Club Tier Stage 4e, lib/club-forward.ts).
 */
export default async function TeamsPage({ params }: { params: Promise<{ orgSlug: string; tournamentSlug: string }> }) {
  const { orgSlug, tournamentSlug } = await params;
  await forwardToOwnAddress(orgSlug, `/${tournamentSlug}/teams`);
  const frameOn = await isPublicFrameOn();
  return <TeamsPageClient frameOn={frameOn} />;
}
