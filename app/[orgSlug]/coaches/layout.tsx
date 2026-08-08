import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  getCoachPortalAuth,
  getCoachPortalAssignments,
  getCoachPortalClosedAssignments,
  getCoachPortalPublicHref,
} from '@/lib/coach-portal-request';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthenticatedUser } from '@/lib/api-auth';
import type { OrgRole } from '@/lib/types';
import { buildCoachSeasons } from '@/lib/coach-season-view';
import { OrgProvider } from '@/lib/org-context';
import { CoachesProvider } from '@/lib/coaches-context';
import { getCoachOnboardingPrefs } from '@/lib/user-preferences';
import { CoachesOverlayProvider } from '@/lib/coaches-overlay';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import { COACHES_HOME_PATH } from '@/lib/coaches-portal-routes';
import CoachesSidebar from '@/components/coaches/CoachesSidebar';
import CoachesBottomNav from '@/components/coaches/CoachesBottomNav';
import CoachTopStrip from '@/components/coaches/CoachTopStrip';
import CoachWallSignOut from '@/components/coaches/CoachWallSignOut';
import InstallAppPrompt from '@/components/InstallAppPrompt';
import HelpDrawerProvider from '@/components/help/HelpDrawerProvider';
import ConfirmProvider from '@/components/coaches/ConfirmProvider';
import { coachWarmAttr } from '@/lib/coach-warm-preview';
import { isOrgBillingSuspended } from '@/lib/org-billing-access';
import SubscriptionEndedWall from '@/components/billing/SubscriptionEndedWall';
import CoachThemeColor from '@/components/coaches/CoachThemeColor';
import styles from './coaches.module.css';

export const metadata: Metadata = {
  manifest: '/manifest.json',
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'FieldLogicHQ',
  },
};

export default async function CoachesLayout({
  params,
  children,
}: {
  params: Promise<{ orgSlug: string }>;
  children: React.ReactNode;
}) {
  const { orgSlug } = await params;

  // Request-cached (lib/coach-portal-request): the team layout below this one needs the same auth,
  // the same assignments and the same public-site door to build the masthead's feed, and on a hard
  // load both layouts render in ONE request — so the pair now costs one read, not two.
  const authCtx = await getCoachPortalAuth(orgSlug);
  if (!authCtx) {
    // Two very different failures share this null: no session at all, and a session with no
    // membership in THIS org. Only the first is fixed by signing in — bouncing the second to
    // /auth/login sends them straight back here (the already-authenticated guard honours
    // `next`), which is an unbreakable loop with no form and no doors. Costs one extra auth
    // read, and only on a path that was already failing.
    const user = await getAuthenticatedUser();
    if (!user) {
      redirect(`/auth/login?next=/${orgSlug}/coaches`);
    }
    return (
      <div style={{ display: 'contents' }} {...coachWarmAttr}>
        <CoachThemeColor />
        <div className={styles.coachesShell}>
          {/* The strip is account-scoped — wordmark → Home, Account, Workspaces all resolve
              from WHO the viewer is, never from the org in the URL — so it renders correctly
              here even though this branch has no resolved org. Matching the two walls below
              it: the screen with the least to offer must not also be the one with no chrome. */}
          <CoachTopStrip />
          <main className={styles.coachesMain}>
            <div className={styles.notAssigned}>
              <h2>No access to this organization</h2>
              <p>
                You&apos;re signed in, but this account isn&apos;t a coach at{' '}
                <strong>{orgSlug}</strong>. If you were given a coaching account for this club,
                sign out and sign back in with that email.
              </p>
              <div className={styles.notAssignedDoors}>
                <Link href="/discover" className={styles.notAssignedDoor}>Go to Home</Link>
                <Link href={COACHES_HOME_PATH} className={styles.notAssignedDoor}>
                  Back to Coaches Portal home
                </Link>
                <CoachWallSignOut />
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }
  if (authCtx.org.slug !== orgSlug) {
    redirect(`/${authCtx.org.slug}/coaches`);
  }

  // Billing rail (owner ruling 2026-08-06) — the portal's human half. Every coach API route is
  // already closed for a cancelled org; this stops the shell from rendering into a wall of failed
  // fetches and says why instead. Placed BEFORE the assignment/season lookups so a cancelled club
  // costs no queries, and inside the portal frame so it reads as this product, not an error page.
  if (isOrgBillingSuspended(authCtx.org)) {
    return (
      <OrgProvider initialOrg={authCtx.org} initialUserRole={null}>
        <div style={{ display: 'contents' }} {...coachWarmAttr}>
          <CoachThemeColor />
          <div className={styles.coachesShell}>
            <CoachTopStrip />
            <main className={styles.coachesMain}>
              <SubscriptionEndedWall
                orgName={authCtx.org.name}
                contactEmail={authCtx.org.contactEmail}
                surface="coaches"
              />
            </main>
          </div>
        </div>
      </OrgProvider>
    );
  }

  // The viewer's org-membership role (null when they're a coach but NOT org staff) — seeded into
  // OrgProvider so the portal can show a "Back to admin" door only to admin-coaches (P3-4). Read
  // separately from the auth gate on purpose: a coach-only user has no membership row and must
  // still reach the portal (getAuthContextWithRole would null them out and redirect to login).
  const { data: membership } = await supabaseAdmin
    .from('organization_members')
    .select('role')
    .eq('organization_id', authCtx.org.id)
    .eq('user_id', authCtx.user.id)
    .maybeSingle();
  const initialUserRole = (membership?.role as OrgRole | undefined) ?? null;

  // Season's End access model (Batch 3, P0 #1): a coach whose season(s) were closed is NOT
  // "not assigned" — they keep the portal shell with read-only access to what they built.
  // The wall below is now only for coaches with no assignment on ANY season, ever. Both
  // lookups run here once and SEED CoachesProvider (mirroring OrgProvider's initialOrg), so
  // the client doesn't immediately re-fetch the identical data on mount.
  // The onboarding prefs ride this SAME parallel lookup (Quiet Mode Phase C2). They're
  // account-scoped, so fetching them from the team Overview instead would repeat an identical
  // request on every team switch for data that cannot differ by team — and would flash the wrong
  // state while it resolved. Reading them here costs no extra latency.
  const isTeamWorkspace = isTeamWorkspaceOrg(authCtx.org);
  // publicHref: the pinned team masthead's flip door (D2, 2026-08-01), and the wall's second door
  // below. Same resolver + same "is this org page real?" predicate as the event chrome; a team
  // workspace resolves to null and the masthead simply shows no flip. The wrapper carries the
  // `.catch(() => null)` that keeps a DB blip off the portal's critical path (/review 2026-08-02).
  const [assignments, closedAll, onboardingPrefs, publicHref] = await Promise.all([
    getCoachPortalAssignments(authCtx.org.id, authCtx.user.id, isTeamWorkspace),
    getCoachPortalClosedAssignments(authCtx.org.id, authCtx.user.id, isTeamWorkspace),
    getCoachOnboardingPrefs(authCtx.user.id),
    isTeamWorkspace ? Promise.resolve(null) : getCoachPortalPublicHref(authCtx.org),
  ]);
  // Same shaping as the assignments API: one entry per team, only teams with no active year.
  const activeTeamIds = new Set(assignments.map(a => a.teamId));
  const seenClosedTeams = new Set<string>();
  const closedAssignments = closedAll.filter(a => {
    if (activeTeamIds.has(a.teamId) || seenClosedTeams.has(a.teamId)) return false;
    seenClosedTeams.add(a.teamId);
    return true;
  });
  // The season switcher's list (Chunk F) — EVERY season, undeduped, including the past seasons of
  // a rolled-forward team, which `closedAssignments` above deliberately drops. Derived from the
  // lookups already in flight, so the switcher costs nothing.
  const seasons = buildCoachSeasons(assignments, closedAll);

  if (assignments.length === 0 && closedAssignments.length === 0) {
    const { name: orgName, contactEmail } = authCtx.org;
    // The wall's second door, by persona.
    //
    // A TEAM WORKSPACE has no meaningful public page — its shadow org can never own the
    // public-site module and can never run two active events, so the shared resolver always says
    // "not a real place" for it. Pointing at `/{orgSlug}` (what the old wall did unconditionally)
    // was therefore a guaranteed dead end for exactly this persona. Their real "Coaches Portal
    // home" is the org-less coach hub, which lists whatever they still hold — so that is the door.
    //
    // For a NORMAL org it is the org's public page, and only when the SAME shared resolver the
    // event chrome uses says that page is real (top-nav audit D1/D2, 2026-08-01). The answer
    // was already computed in the Promise.all above (`publicHref`) — re-awaiting the resolver
    // here was a second identical DB count per wall load (/review 2026-08-02).
    const orgHomeHref = isTeamWorkspace ? COACHES_HOME_PATH : publicHref;
    return (
      // R2 — the wall renders INSIDE the portal frame instead of returning before any chrome
      // mounts. A coach whose assignment was revoked (or anyone following a wrong-org link) now
      // keeps the operator strip above and a real triad of doors below: where am I, who am I,
      // and a way out. The warm marker + theme wrapper match the portal shell exactly, so the
      // wall reads as this product rather than as an error page.
      <OrgProvider initialOrg={authCtx.org} initialUserRole={initialUserRole}>
        <div style={{ display: 'contents' }} {...coachWarmAttr}>
          <CoachThemeColor />
          <div className={styles.coachesShell}>
            {/* Desktop-only by its own CSS; on a phone the card's doors below carry the same
                three answers, which is why the wall doesn't mount the team bottom nav (a coach
                with no teams has nothing for it to list). */}
            <CoachTopStrip />
            <main className={styles.coachesMain}>
              <div className={styles.notAssigned}>
                <h2>{isTeamWorkspace ? 'Coaches Portal not ready' : 'Not assigned to any teams'}</h2>
                <p>
                  {isTeamWorkspace
                    ? `Your coach assignment or Premium entitlement is not active for ${orgName}.`
                    : `You don't have an active coaching assignment for ${orgName}.`}
                </p>
                <p className={styles.notAssignedContact}>
                  {contactEmail ? (
                    <>Questions? <a href={`mailto:${contactEmail}`} className={styles.notAssignedEmailLink}>{contactEmail}</a></>
                  ) : (
                    <>{isTeamWorkspace ? 'Questions? Contact FieldLogicHQ support.' : 'Questions? Contact your org admin.'}</>
                  )}
                </p>
                <div className={styles.notAssignedDoors}>
                  <Link href="/discover" className={styles.notAssignedDoor}>Go to Home</Link>
                  {orgHomeHref && (
                    <Link href={orgHomeHref} className={styles.notAssignedDoor}>
                      {isTeamWorkspace ? 'Back to Coaches Portal home' : `Back to ${orgName}`}
                    </Link>
                  )}
                  <CoachWallSignOut />
                </div>
              </div>
            </main>
          </div>
        </div>
      </OrgProvider>
    );
  }

  return (
    // Seed the workspace identity from the SSR-resolved, auth-checked org (matches the admin
    // layout). Without this, OrgProvider fetches /api/org-context with no slug and a multi-org
    // user resolves to their DEFAULT org, not this team workspace — which mislabeled the sidebar
    // and scoped the notification bell to the wrong org (found 2026-07-13).
    <OrgProvider initialOrg={authCtx.org} initialUserRole={initialUserRole}>
      <CoachesProvider
        orgSlug={orgSlug}
        initialAssignments={assignments}
        initialClosedAssignments={closedAssignments}
        initialSeasons={seasons}
        initialOnboardingPrefs={onboardingPrefs}
      >
        {/* Hosts the in-context "?" help slide-over for the team work pages (drawer +
            guide content load lazily on first click — no bundle cost until used). */}
        {/* Warm-portal preview gate: the marker sits on a display:contents wrapper (no box,
            layout-neutral) placed ABOVE the providers so it covers not just the shell + bottom
            nav but also the modals/drawers they render (the Confirm/discard dialog, the help
            drawer, the install prompt) — those are rendered as siblings of the shell, so a
            marker nested below the providers would leave them dark. Custom-property token
            overrides in globals.css cascade through display:contents to every subtree. */}
        <div style={{ display: 'contents' }} {...coachWarmAttr}>
          <CoachThemeColor />
          <HelpDrawerProvider>
            <ConfirmProvider>
              {/* Shared "any modal/sheet open" signal (Coach Portal Batch 1, D3): wraps BOTH the
                  sidebar and the bottom nav so useOverlayOpen()/useAnyOverlayOpen() reach every
                  team page and the nav that needs to hide under them. */}
              <CoachesOverlayProvider>
                <div className={styles.coachesShell}>
                  {/* Stage H.1 (Nav Unification, D2 ratified 2026-07-31): the operator
                      frame strip — desktop-only fixed top bar (wordmark → Home, account ·
                      Workspaces) in the portal's own warm/dark skin. NO chat door and no
                      bell: chat is a section of the work for an operator, and the coach
                      sidebar keeps the bell (binding rulings 2026-07-31; this comment still
                      listed the removed chat door until the 2026-08-01 top-nav audit). Mounted
                      INSIDE the shell so it reads the shell's --coach-topstrip-h (custom
                      properties don't reach siblings); position:fixed keeps it out of the
                      flex flow. The shell pads down by the same var (coaches.module.css). */}
                  <CoachTopStrip />
                  <CoachesSidebar orgSlug={orgSlug} />
                  {/* The pinned team MASTHEAD (D2 Option A) is mounted by the TEAM layout, not
                      here — that is the first place `teamId` exists server-side, so its record +
                      status feed (A2) can ride down with the page instead of being fetched after
                      paint. It still renders as the first child of this <main>: that layout
                      returns a fragment, which the masthead's sticky pin + padding-cancelling
                      negative margins depend on. */}
                  <main className={styles.coachesMain}>{children}</main>
                </div>
                <CoachesBottomNav />
              </CoachesOverlayProvider>
            </ConfirmProvider>
            <InstallAppPrompt
              appName="FieldLogicHQ"
              subtitle="Your teams, schedules and scores — one tap away."
            />
          </HelpDrawerProvider>
        </div>
      </CoachesProvider>
    </OrgProvider>
  );
}
