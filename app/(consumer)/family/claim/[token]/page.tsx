import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GUARDIAN_TIER_ENABLED } from '@/lib/family-guardian';
import { accountNameOf, FAMILY_HOME_PATH, inspectInvitation } from '@/lib/family-invitation';
import { createClient } from '@/lib/supabase-server';
import ClaimClient from './ClaimClient';

/**
 * /family/claim/[token] — the invitation's accept page (Signed-in family accounts Stage 4a, Part 4; drawing tab 2).
 *
 * One page, filled once, whatever account the parent has: the email first (no address rides in the link), then a new password
 * (a new account, created already confirmed: ruling 15) or the existing one's, or nothing at all when already signed in as the
 * invited address (A); then /legal draft (a)'s "Before you join" and its two boxes. The failure states C–F as drawn. The page
 * learns the invited address only partly hidden; the server decides every state (lib/family-invitation.ts inspectInvitation).
 *
 * ⚠ The token only opens this page. It never signs anyone in and never shows a team (Part 9 guard f).
 * While the guardian tier is off it answers 404.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Join your child’s team',
  robots: { index: false, follow: false },
};

export default async function FamilyClaimPage({ params }: { params: Promise<{ token: string }> }) {
  if (!GUARDIAN_TIER_ENABLED) notFound();
  const { token } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const view = await inspectInvitation(token, user
    ? { id: user.id, email: user.email ?? null, name: accountNameOf(user.user_metadata) }
    : null);
  return (
    <ClaimClient
      token={token}
      state={view.state}
      maskedEmail={view.maskedEmail}
      from={view.source === 'rep_coach' ? 'coach' : 'club'}
      kids={view.children}
      viewer={view.viewer}
      club={view.sender ? {
        name: view.sender.clubName,
        contact: view.sender.contact,
        privacyNoticeUrl: view.sender.privacyNoticeUrl,
      } : null}
      homePath={FAMILY_HOME_PATH}
    />
  );
}
