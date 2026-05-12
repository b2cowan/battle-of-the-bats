import { redirect } from 'next/navigation';
import { getPlatformAuthContext } from '@/lib/platform-auth';

export default async function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS !== 'true') {
    redirect('/');
  }

  const user = await getPlatformAuthContext();
  if (!user) {
    redirect('/auth/login?next=/dev');
  }

  return <>{children}</>;
}
