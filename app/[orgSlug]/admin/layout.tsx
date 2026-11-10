import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { readAdminTournamentSeed } from '@/lib/admin-tournament-list';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { getAuthUserCached } from '@/lib/supabase-server';
import { getAuthDestination } from '@/lib/auth-destination';
import { getOrganizationBySlug } from '@/lib/db';
import { volunteerHome } from '@/lib/volunteer-jobs';
import { TournamentProvider } from '@/lib/tournament-context';
import { OrgProvider } from '@/lib/org-context';
import { canOpenModule } from '@/lib/member-access';
import { clubHasPayouts } from '@/lib/online-payouts';
import { readClubShape } from '@/lib/club-shape-read';
import { isTournamentOnlyWorkspace } from '@/lib/module-entitlements';
import InstallAppPrompt from '@/components/InstallAppPrompt';
import HelpDrawerProvider from '@/components/help/HelpDrawerProvider';
import PlanPanelHost from '@/components/billing/PlanPanelHost';
import { AdminKitProvider } from '@/components/admin/AdminKitProvider';
import CoachThemeColor from '@/components/coaches/CoachThemeColor';
import TermsAcceptGate from '@/components/legal/TermsAcceptGate';
import { adminKitAttr } from '@/lib/admin-kit-marker';
import AdminChrome from './AdminChrome';

const MEMBER_INSTALL = {
  appName: 'FieldLogicHQ',
  subtitle: 'Your teams, schedules and scores — one tap away.',
  // Stage 13b (A4): a person arriving for the first time is shown their home first; the install ask waits for a later visit.
  skipFirstLanding: true,
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

  // ⚠ `allowSuspendedOrg: true` is LOAD-BEARING for the comeback path: the resubscribe page lives
  // at /{orgSlug}/admin/org/billing, INSIDE this layout. If the billing rail threw here, a
  // cancelled org could never reach the one page that lets it pay again. The existing
  // CancellationGuard (AdminChrome) already redirects a cancelled org to that billing page and
  // nowhere else, and every admin API route stays closed by the rail — so opening the shell here
  // grants nothing. Do not "tidy" this flag away.
  const authCtx = await getAuthContextWithRole({ orgSlug, allowSuspendedOrg: true });
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

  // J8-019: an `official` (a volunteer) has no admin module capabilities, so the admin hub renders
  // a blank zero-tile dead-end for them. Send them to their job instead of the empty shell — by the
  // same rule as a sign-in (Stage 6, A26), so a gate volunteer lands on the gate. (Org-level
  // role→surface routing for other roles is FP-7's call; this is the shell fix for the one role that
  // can never use the admin hub.)
  const volunteer = volunteerHome(orgSlug, authCtx.role, authCtx.capabilities);
  if (volunteer) redirect(volunteer);

  // Accounting's Payouts tab is a server fact (a row in the club's payment accounts): read ONCE here, on a full load and
  // only for someone who can open Accounting, so the pinned bar names the exact tab row on its first paint (Admin header
  // bar Phase 2). The Payouts page itself still asks the server (`notFound` without it). A failed read is "no Payouts tab",
  // never a broken shell: this layout is every admin page's.
  //
  // The chosen tournament (Navigation Phase 0): a tournament has no address, so on a tournament page's full load the
  // server reads the remembered choice (a cookie per organization) and the address's `?tournamentId`/`?tournamentSlug`
  // (forwarded by the proxy as `x-search`), with the list this person may open, and the provider starts from them — the
  // strip, the phone bar and the sidebar name the event on the first paint instead of the club's name and a swap. Only
  // on tournament pages: everywhere else nothing names the event, and the browser's read stays the only one, as before.
  // This layout is already dynamic per request (it reads the session), so the cookie read costs no caching.
  const requestHeaders = await headers();
  const onTournamentPage = /^\/[^/]+\/admin\/tournaments(?:\/|$)/.test(requestHeaders.get('x-pathname') ?? '');
  // The club's shape (Navigation Phase 1 Part B): what the club runs orders the sidebar's Programs and decides the foot's
  // Tournaments door, so it is read here and handed down — the sidebar's first paint is its last. A tournament-only
  // organization has no club to order, and a cancelled one gets no brief and no places. The read never throws.
  const [hasPayouts, tournamentSeed, clubShape] = await Promise.all([
    canOpenModule(authCtx, authCtx.org, 'module_accounting')
      ? clubHasPayouts(authCtx.org.id).catch(() => false)
      : Promise.resolve(false),
    onTournamentPage ? readAdminTournamentSeed(orgSlug, requestHeaders.get('x-search')) : Promise.resolve(undefined),
    isTournamentOnlyWorkspace(authCtx.org) || authCtx.org.subscriptionStatus === 'canceled'
      ? Promise.resolve(undefined)
      : readClubShape(authCtx.org).then(r => r.shape),
  ]);

  const shell = (
    <OrgProvider
      initialOrg={authCtx.org}
      initialUserRole={authCtx.role}
      initialUserCapabilities={authCtx.capabilities}
      clubHasPayouts={hasPayouts}
      limitedToTeamGroups={!!authCtx.repGroupIds}
    >
      <TournamentProvider orgSlug={orgSlug} seed={tournamentSeed}>
        <AdminChrome clubShape={clubShape}>
          <HelpDrawerProvider>
            {children}
          </HelpDrawerProvider>
        </AdminChrome>
        <InstallAppPrompt {...MEMBER_INSTALL} />
        {/* Every upgrade link opens the plan's panel over the page it is on (owner 2026-10-16). */}
        <PlanPanelHost />
      </TournamentProvider>
    </OrgProvider>
  );

  // Admin Design Continuity — the admin wears the coaches portal's kit in every build (released
  // 2026-09-28; the dev-only switch that decided it is gone — `lib/admin-kit-marker.ts`). The marker
  // sits on a box-less wrapper ABOVE the providers — the coaches layout's placement, for its reason: the
  // shell's modals, drawers and install prompt render as SIBLINGS of the shell, and custom properties
  // reach them only through a common ancestor.
  return (
    <AdminKitProvider on>
      <div style={{ display: 'contents' }} {...adminKitAttr}>
        <CoachThemeColor />
        {/* The sign-in screen (GST/HST Stage 6 step 6.3) replaces the shell for someone who still needs to agree to the Terms. */}
        <TermsAcceptGate user={authCtx.user}>{shell}</TermsAcceptGate>
      </div>
    </AdminKitProvider>
  );
}
