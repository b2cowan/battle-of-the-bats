import { forwardToOwnAddress } from '@/lib/club-forward';
import { isPublicFrameOn } from '@/lib/public-frame-server';
import SchedulePageClient from './SchedulePageClient';

/**
 * The tournament's schedule. The page itself is a client component (./SchedulePageClient); this server page exists so a club
 * with its own web address can forward the old address to it first (Club Tier Stage 4e, lib/club-forward.ts), and so the
 * preview switch is decided on the server (Public tournament pages Stage 3): the client is told, not left to find out.
 */
export default async function SchedulePage({ params }: { params: Promise<{ orgSlug: string; tournamentSlug: string }> }) {
  const { orgSlug, tournamentSlug } = await params;
  await forwardToOwnAddress(orgSlug, `/${tournamentSlug}/schedule`);
  const frameOn = await isPublicFrameOn();
  return <SchedulePageClient frameOn={frameOn} />;
}
