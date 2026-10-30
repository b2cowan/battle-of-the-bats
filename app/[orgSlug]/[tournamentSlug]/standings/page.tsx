import { forwardToOwnAddress } from '@/lib/club-forward';
import StandingsPageClient from './StandingsPageClient';
import { isPublicFrameOn } from '@/lib/public-frame-server';

/**
 * The tournament's standings. The page itself is a client component (./StandingsPageClient); this server page exists so a club
 * with its own web address can forward the old address to it first (Club Tier Stage 4e, lib/club-forward.ts).
 */
export default async function StandingsPage({ params }: { params: Promise<{ orgSlug: string; tournamentSlug: string }> }) {
  const { orgSlug, tournamentSlug } = await params;
  await forwardToOwnAddress(orgSlug, `/${tournamentSlug}/standings`);
  const frameOn = await isPublicFrameOn();
  return <StandingsPageClient frameOn={frameOn} />;
}
