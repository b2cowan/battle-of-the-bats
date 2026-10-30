import AdminHub from './AdminHub';

import { redirectStandaloneWorkspace } from '@/lib/coach-portal-request';

export default async function AdminHubPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  await redirectStandaloneWorkspace((await params).orgSlug);
  return <AdminHub />;
}
