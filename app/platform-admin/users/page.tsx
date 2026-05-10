import { supabaseAdmin } from '@/lib/supabase-admin';
import UsersClient from './UsersClient';

const PER_PAGE = 50;

interface Props {
  searchParams: Promise<{ page?: string }>;
}

async function getPlatformUsers(page: number) {
  const { data: members } = await supabaseAdmin
    .from('organization_members')
    .select('user_id');

  const memberIds = new Set((members ?? []).map((m: any) => m.user_id as string));

  const { data, error } = await supabaseAdmin.auth.admin.listUsers({
    page,
    perPage: PER_PAGE,
  });
  if (error || !data) return { users: [], totalPages: 1 };

  const users = data.users
    .filter(u => !memberIds.has(u.id))
    .map(u => ({
      id:           u.id,
      email:        u.email ?? '(no email)',
      createdAt:    u.created_at,
      lastSignInAt: u.last_sign_in_at ?? null,
    }));

  const totalPages = data.total ? Math.ceil(data.total / PER_PAGE) : (data.nextPage ? page + 1 : page);

  return { users, totalPages };
}

export default async function UsersPage({ searchParams }: Props) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1);
  const { users, totalPages } = await getPlatformUsers(page);
  return <UsersClient users={users} page={page} totalPages={totalPages} />;
}
