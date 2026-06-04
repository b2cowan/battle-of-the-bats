import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { getOrganizationBySlug } from '@/lib/db';
import { TournamentProvider } from '@/lib/tournament-context';
import { OrgProvider } from '@/lib/org-context';
import { LiveLogicProvider } from '@/components/live-logic/LiveLogicProvider';
import InstallAppPrompt from '@/components/InstallAppPrompt';
import AdminChrome from './AdminChrome';

const MEMBER_INSTALL = {
  appName: 'FieldLogicHQ',
  subtitle: 'Your teams, schedules and scores — one tap away.',
  dismissKey: 'flhq-install-member',
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<Metadata> {
  const { orgSlug } = await params;
  const org = await getOrganizationBySlug(orgSlug);
  return {
    title: { default: 'Admin', template: `%s | ${org?.name ?? 'Admin'}` },
    manifest: '/manifest.json',
    other: {
      'mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-status-bar-style': 'black-translucent',
      'apple-mobile-web-app-title': 'FieldLogicHQ',
    },
  };
}

export default async function AdminLayout({
  params,
  children,
}: {
  params: Promise<{ orgSlug: string }>;
  children: React.ReactNode;
}) {
  const { orgSlug } = await params;

  const authCtx = await getAuthContextWithRole({ orgSlug });
  if (!authCtx) {
    redirect(`/auth/login?next=/${orgSlug}/admin`);
  }

  // Authenticated user belongs to a different org — send them to their own admin
  if (authCtx.org.slug !== orgSlug) {
    redirect(`/${authCtx.org.slug}/admin`);
  }

  return (
    <OrgProvider
      initialOrg={authCtx.org}
      initialUserRole={authCtx.role}
      initialUserCapabilities={authCtx.capabilities}
    >
      <TournamentProvider orgSlug={orgSlug}>
        <LiveLogicProvider>
          {/* No-flash admin density — set data-density on <html> before first paint */}
          <script
            dangerouslySetInnerHTML={{
              __html:
                "(function(){try{var k='fl_admin_density',v=null;try{v=localStorage.getItem(k);}catch(e){}if(v!=='comfortable'&&v!=='compact'){v=(window.matchMedia&&window.matchMedia('(pointer: coarse)').matches)?'comfortable':'compact';}document.documentElement.setAttribute('data-density',v);}catch(e){}})();",
            }}
          />
          <AdminChrome>
            {children}
          </AdminChrome>
          <InstallAppPrompt {...MEMBER_INSTALL} />
        </LiveLogicProvider>
      </TournamentProvider>
    </OrgProvider>
  );
}
