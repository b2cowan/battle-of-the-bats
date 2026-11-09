import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GUARDIAN_TIER_ENABLED } from '@/lib/family-guardian';
import { clubNameOf, inspectInvitation } from '@/lib/family-invitation';
import { createClient } from '@/lib/supabase-server';
import ClaimClient from './ClaimClient';

/**
 * /family/claim/[token] — the invitation's accept page (Signed-in family accounts Stage 4a).
 *
 * ⚠ INTERIM (build Session 1): the rules moved to lib/family-invitation.ts; Part 4 rebuilds this page to the drawing (email first,
 * new account / existing account / signed in, states A–F). Until then it shows the /legal words for a signed-in parent and one
 * plain line otherwise. While the guardian tier is off it answers 404.
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
  const view = await inspectInvitation(token, user?.id ?? null);
  const clubName = view.orgId ? await clubNameOf(view.orgId) : null;
  return <ClaimClient token={token} open={view.state === 'open'} clubName={clubName} childNames={view.children} />;
}
