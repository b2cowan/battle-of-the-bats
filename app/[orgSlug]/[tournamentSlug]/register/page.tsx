import { forwardToOwnAddress } from '@/lib/club-forward';
import { redirect } from 'next/navigation';
import RegisterContent from '@/components/public/RegisterContent';
import { getOrganizationBySlug } from '@/lib/db';
import { runsInviteOnlyEvents } from '@/lib/invite-only-event';
import { orgLinks } from '@/lib/org-links';

/**
 * An invite-only event takes no registrations (the free tournament tier, R3, B2): its host adds every team, so a stale
 * or typed Register link goes to the event's home page. The submit route refuses too.
 */
export default async function RegisterPage({ params }: { params: Promise<{ orgSlug: string; tournamentSlug: string }> }) {
  const { orgSlug, tournamentSlug } = await params;
  await forwardToOwnAddress(orgSlug, `/${tournamentSlug}/register`);
  const org = await getOrganizationBySlug(orgSlug);
  if (org && runsInviteOnlyEvents(org.planId)) redirect((await orgLinks(orgSlug))(`/${tournamentSlug}`));
  return <RegisterContent />;
}
