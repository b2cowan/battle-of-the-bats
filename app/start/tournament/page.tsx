import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import AddOrgForm from './AddOrgForm';

export const metadata: Metadata = {
  title: 'Run a tournament — FieldLogicHQ',
};

/**
 * /start/tournament — the organizer on-ramp.
 *  - Signed OUT → the existing tournament signup (creates the auth user + first org).
 *  - Signed IN with NO org yet → create their first org (account-first / invited-then-no-invite).
 *  - Signed IN who ALREADY has an org → redirect home. Identity model is "single-org by default"
 *    (decision 2026-06-19): a second organization is reached only by a deliberate invite or a
 *    Coaches Portal purchase — never by self-serve spinning up another empty workspace here.
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

  // Single-org by default: an existing member can't self-serve a second empty org. Only a
  // brand-new account with no active membership yet reaches the create-first-org form.
  const { count: activeMemberships } = await supabaseAdmin
    .from('organization_members')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'active');
  if ((activeMemberships ?? 0) > 0) {
    redirect('/home');
  }

  return <AddOrgForm />;
}
