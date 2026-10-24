import { forwardToOwnAddress } from '@/lib/club-forward';
import SchedulePageClient from './SchedulePageClient';

/**
 * The tournament's schedule. The page itself is a client component (./SchedulePageClient); this server page exists so a club
 * with its own web address can forward the old address to it first (Club Tier Stage 4e, lib/club-forward.ts).
 */
export default async function SchedulePage({ params }: { params: Promise<{ orgSlug: string; tournamentSlug: string }> }) {
  const { orgSlug, tournamentSlug } = await params;
  await forwardToOwnAddress(orgSlug, `/${tournamentSlug}/schedule`);
  return <SchedulePageClient />;
}
