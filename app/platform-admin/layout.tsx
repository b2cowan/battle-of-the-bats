import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getPlatformAdminContext } from '@/lib/platform-auth';
import { canAccessBookkeeping } from '@/lib/bookkeeping-access';
import { PLATFORM_PORTAL_LABEL } from '@/lib/workspace-labels';
import { AdminKitProvider, GuestKitRoot } from '@/components/admin/AdminKitProvider';
import CoachThemeColor from '@/components/coaches/CoachThemeColor';
import { adminKitAttr } from '@/lib/admin-kit-marker';
import PlatformShell from './PlatformShell';
import PlatformVisitRecorder from './PlatformVisitRecorder';

export const metadata: Metadata = { title: `${PLATFORM_PORTAL_LABEL} — FieldLogicHQ` };

export default async function PlatformAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const pathname    = headersList.get('x-pathname') ?? '';

  // The sign-in page renders without the shell — no auth check needed here since middleware already gates everything
  // else. ⚖ It is ALWAYS WARM, like every signed-out page (owner 2026-10-24, Support console Stage 1 Ask 5; the rule of
  // 2026-10-23: a signed-out visitor has no Warm / Dark control, and signing out resets the browser to warm). `GuestKitRoot`
  // is the kit's fixed-warm root — the one the volunteer shells use — so no account setting can turn it dark.
  if (pathname === '/platform-admin/login') {
    return <GuestKitRoot>{children}</GuestKitRoot>;
  }

  const auth = await getPlatformAdminContext();
  if (!auth) {
    redirect('/platform-admin/login?next=/platform-admin');
  }

  // ⚖ THE CONSOLE TAKES THE ADMIN KIT (owner ruling F1, 2026-10-24 — `memory/design_decisions.md`: its dark-console
  // exceptions retired, and the old "RULED EXCEPTION … do not unify" comment that stood here went with them). The marker
  // sits on a box-less wrapper ABOVE the shell, as the club admin's layout places it, so the warm palette applies to
  // everything inside, the account's Warm / Dark setting chooses, and the status-bar colour follows it. The help pages
  // wear the same shell now (they open in place, with the menu).
  return (
    <AdminKitProvider on>
      <div style={{ display: 'contents' }} {...adminKitAttr}>
        <CoachThemeColor />
        <PlatformShell role={auth.role} canBookkeep={canAccessBookkeeping(auth)}>
          <PlatformVisitRecorder />
          {children}
        </PlatformShell>
      </div>
    </AdminKitProvider>
  );
}
