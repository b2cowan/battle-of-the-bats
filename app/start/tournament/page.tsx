import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase-server';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import AddOrgForm from './AddOrgForm';

export const metadata: Metadata = {
  title: 'Run a tournament — FieldLogicHQ',
};

/**
 * /start/tournament — the organizer on-ramp.
 *  - Signed OUT → the existing tournament signup (creates the auth user + first org).
 *  - Signed IN  → add ANOTHER free tournament org against the live session, without
 *    re-signing-up (existing emails never error). This is the D2 add-workspace path.
 */
export default async function StartTournamentPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect('/auth/signup');
  }
  if (await isPlatformAdminEmail(user.email)) {
    redirect('/platform-admin');
  }

  return <AddOrgForm />;
}
