import { supabaseAdmin } from '@/lib/supabase-admin';
import UsersClient from './UsersClient';

async function getUsers() {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error || !data) return [];

  return data.users.map(u => ({
    id:           u.id,
    email:        u.email ?? '(no email)',
    createdAt:    u.created_at,
    lastSignInAt: u.last_sign_in_at ?? null,
  }));
}

export default async function UsersPage() {
  const users = await getUsers();
  return <UsersClient users={users} />;
}
