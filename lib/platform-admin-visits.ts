import { supabaseAdmin } from '@/lib/supabase-admin';

export async function getPreviousPlatformAdminVisit(actorEmail: string) {
  const { data, error } = await supabaseAdmin
    .from('platform_admin_visits')
    .select('visited_at, path')
    .eq('actor_email', actorEmail.toLowerCase())
    .order('visited_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[platform-admin] previous visit lookup failed', error);
    return null;
  }

  return data as { visited_at: string; path: string } | null;
}

export async function recordPlatformAdminVisit({
  actorUserId,
  actorEmail,
  path,
}: {
  actorUserId: string;
  actorEmail: string;
  path: string;
}) {
  const safePath = path.startsWith('/platform-admin') ? path.slice(0, 300) : '/platform-admin';
  const { error } = await supabaseAdmin
    .from('platform_admin_visits')
    .insert({
      actor_user_id: actorUserId,
      actor_email: actorEmail.toLowerCase(),
      path: safePath,
    });

  if (error) throw error;
}
