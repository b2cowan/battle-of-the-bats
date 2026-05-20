import { redirect } from 'next/navigation';
import { getAuthDestination } from '@/lib/auth-destination';

export default async function AdminLayout() {
  const destination = await getAuthDestination();
  redirect(destination === '/auth/login' ? '/auth/login?next=/admin' : destination);
}
