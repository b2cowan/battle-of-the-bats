import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { getAuthUserCached } from '@/lib/supabase-server';
import { getAuthDestination } from '@/lib/auth-destination';
import { getOrganizationBySlug } from '@/lib/db';
import { TournamentProvider } from '@/lib/tournament-context';
import { OrgProvider } from '@/lib/org-context';
import { LiveLogicProvider } from '@/components/live-logic/LiveLogicProvider';
import InstallAppPrompt from '@/components/InstallAppPrompt';
import HelpDrawerProvider from '@/components/help/HelpDrawerProvider';
import AdminChrome from './AdminChrome';

const MEMBER_INSTALL = {
  appName: 'FieldLogicHQ',
  subtitle: 'Your teams, schedules and scores — one tap away.',
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
    // Two very different situations wear the same `null` here, and sending BOTH to the login page
    // is what closes the J8-018 / J10-019 loop from this side:
    //
    //   • nobody is signed in            → login is exactly right;
    //   • somebody IS signed in but has no membership in THIS org → login sees a valid session
    //     with a workspace, honours the `next` we just handed it, and sends them straight back
    //     here. Login ↔ admin, forever.
    //
    // The login page already refuses to walk a session into a destination it can't reach; this is
    // the same rule stated on the other end. A signed-in stranger goes to their OWN workspace.
    // (Found while QA-ing the "See it live" sandbox, where the demo's operator URL is one tap from
    // a public page — but the loop was reachable by any signed-in visitor typing any org's
    // /admin URL.)
    const signedIn = await getAuthUserCached();
    if (signedIn) {
      redirect(await getAuthDestination());
    }
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
            <HelpDrawerProvider>
              {children}
            </HelpDrawerProvider>
          </AdminChrome>
          <InstallAppPrompt {...MEMBER_INSTALL} />
        </LiveLogicProvider>
      </TournamentProvider>
    </OrgProvider>
  );
}
