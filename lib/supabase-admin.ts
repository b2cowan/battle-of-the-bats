import { createClient } from '@supabase/supabase-js';

// Admin client using service role key — server-side ONLY, never expose to browser
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
