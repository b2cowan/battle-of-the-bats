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

  // J8-019: an `official` (scorekeeper) has no admin module capabilities, so the admin hub renders
  // a blank zero-tile dead-end for them. Send them to their actual surface instead of the empty
  // shell. (Org-level role→surface routing for other roles is FP-7's call; this is the shell fix
  // for the one role that can never use the admin hub.)
  if (authCtx.role === 'official') {
    redirect(`/${orgSlug}/scorekeeper`);
  }

  return (
    <OrgProvider
      initialOrg={authCtx.org}
      initialUserRole={authCtx.role}
      initialUserCapabilities={authCtx.capabilities}
    >
      <TournamentProvider orgSlug={orgSlug}>
        <LiveLogicProvider>
          <AdminChrome>
            {children}
          </AdminChrome>
          <InstallAppPrompt {...MEMBER_INSTALL} />
        </LiveLogicProvider>
      </TournamentProvider>
    </OrgProvider>
  );
}
