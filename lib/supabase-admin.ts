import { createClient } from '@supabase/supabase-js';
import { assertSafeSupabaseServerEnvironment } from './supabase-safety';

assertSafeSupabaseServerEnvironment('Supabase admin client');

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder'
);

/**
 * ONE owner's address, for a single contact address (a reply-to, a fallback sender, the Stripe customer's email). An email ABOUT
 * the plan or billing goes to every owner instead (`orgOwnerEmails`, lib/notify-recipients.ts; GST/HST 6.4 ruling Q4).
 * The first active owner to accept, never an error: this read used `.single()` with no status filter, so a club with two owners
 * (or a removed one) got no address at all (fixed 2026-11-13).
 */
export async function getOrgOwnerEmail(orgId: string): Promise<string | undefined> {
  const { data: member } = await supabaseAdmin
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', orgId)
    .eq('role', 'owner')
    .eq('status', 'active')
    .order('accepted_at', { ascending: true, nullsFirst: false })
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!member?.user_id) return undefined;

  const { data } = await supabaseAdmin.auth.admin.getUserById(member.user_id);
  return data?.user?.email ?? undefined;
}
