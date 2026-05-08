import { supabaseAdmin } from '@/lib/supabase-admin';
import UsersClient from './UsersClient';

async function getPlatformUsers() {
  const { data: members } = await supabaseAdmin
    .from('organization_members')
    .select('user_id');

  const memberIds = new Set((members ?? []).map((m: any) => m.user_id as string));

  // TODO Phase F2: replace with cursor-based pagination — listUsers caps at 1000 silently
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error || !data) return [];

  return data.users
    .filter(u => !memberIds.has(u.id))
    .map(u => ({
      id:           u.id,
      email:        u.email ?? '(no email)',
      createdAt:    u.created_at,
      lastSignInAt: u.last_sign_in_at ?? null,
    }));
}

export default async function UsersPage() {
  const users = await getPlatformUsers();
  return <UsersClient users={users} />;
}
