import { redirect } from 'next/navigation';
import { getPlatformAdminContext } from '@/lib/platform-auth';

export default async function DevToolsLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS !== 'true') {
    redirect('/platform-admin');
  }
  // dev_tools is super_admin-only in the access matrix; enforce it on the page too
  // (the client page can't run a server guard, and the env flag alone is not a role check).
  const auth = await getPlatformAdminContext();
  if (!auth) redirect('/platform-admin/login?next=/platform-admin/dev-tools');
  if (auth.role !== 'super_admin') redirect('/platform-admin');
  return <>{children}</>;
}
