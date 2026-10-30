import { redirectStandaloneWorkspace } from '@/lib/coach-portal-request';

/** Old setup links must not reopen the retired standalone welcome screen. */
export default async function OnboardingLayout({ params, children }: {
  params: Promise<{ orgSlug: string }>;
  children: React.ReactNode;
}) {
  await redirectStandaloneWorkspace((await params).orgSlug);
  return <>{children}</>;
}
