import { createClient } from '@supabase/supabase-js';
import { assertSafeSupabaseServerEnvironment } from './supabase-safety';

assertSafeSupabaseServerEnvironment('Supabase admin client');

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder'
);

export async function getOrgOwnerEmail(orgId: string): Promise<string | undefined> {
  const { data: member } = await supabaseAdmin
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', orgId)
    .eq('role', 'owner')
    .single();

  if (!member?.user_id) return undefined;

  const { data } = await supabaseAdmin.auth.admin.getUserById(member.user_id);
  return data?.user?.email ?? undefined;
}
