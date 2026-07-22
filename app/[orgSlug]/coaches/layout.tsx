import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuthContext } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { OrgRole } from '@/lib/types';
import { OrgProvider } from '@/lib/org-context';
import { CoachesProvider } from '@/lib/coaches-context';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import CoachesSidebar from '@/components/coaches/CoachesSidebar';
import CoachesBottomNav from '@/components/coaches/CoachesBottomNav';
import InstallAppPrompt from '@/components/InstallAppPrompt';
import HelpDrawerProvider from '@/components/help/HelpDrawerProvider';
import ConfirmProvider from '@/components/coaches/ConfirmProvider';
import { coachWarmAttr } from '@/lib/coach-warm-preview';
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

  const authCtx = await getAuthContext({ orgSlug });
  if (!authCtx) {
    redirect(`/auth/login?next=/${orgSlug}/coaches`);
  }
  if (authCtx.org.slug !== orgSlug) {
    redirect(`/${authCtx.org.slug}/coaches`);
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

  const assignments = await getCoachingAssignmentsForUser(authCtx.org.id, authCtx.user.id);

  if (assignments.length === 0) {
    const { name: orgName, contactEmail } = authCtx.org;
    const isTeamWorkspace = isTeamWorkspaceOrg(authCtx.org);
    return (
      <OrgProvider initialOrg={authCtx.org} initialUserRole={initialUserRole}>
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
          <Link href={`/${orgSlug}`} className={styles.notAssignedBack}>
            {isTeamWorkspace ? 'Back to Coaches Portal home' : `Back to ${orgName}`}
          </Link>
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
      <CoachesProvider orgSlug={orgSlug}>
        {/* Hosts the in-context "?" help slide-over for the team work pages (drawer +
            guide content load lazily on first click — no bundle cost until used). */}
        {/* Warm-portal preview gate: the marker sits on a display:contents wrapper (no box,
            layout-neutral) placed ABOVE the providers so it covers not just the shell + bottom
            nav but also the modals/drawers they render (the Confirm/discard dialog, the help
            drawer, the install prompt) — those are rendered as siblings of the shell, so a
            marker nested below the providers would leave them dark. Custom-property token
            overrides in globals.css cascade through display:contents to every subtree. */}
        <div style={{ display: 'contents' }} {...coachWarmAttr}>
          <HelpDrawerProvider>
            <ConfirmProvider>
              <div className={styles.coachesShell}>
                <CoachesSidebar orgSlug={orgSlug} />
                <main className={styles.coachesMain}>
                  {children}
                </main>
              </div>
              <CoachesBottomNav />
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
