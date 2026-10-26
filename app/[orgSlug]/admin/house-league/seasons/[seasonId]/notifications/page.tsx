'use client';

/**
 * A house-league season's Email families (Club Tier Stage 9d-1): the season's sent history, with the club's one email
 * window as its door. The screen lives in `components/admin/kit/club/league/email/` — this file is only the route. The
 * segment stays `notifications` (the rail's key; renaming it is a route change nothing asked for).
 */
import SeasonEmailsScreen from '@/components/admin/kit/club/league/email/SeasonEmailsScreen';

export default function SeasonEmailFamiliesPage() {
  return <SeasonEmailsScreen />;
}
