import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuthContext } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser } from '@/lib/db';
import { OrgProvider } from '@/lib/org-context';
import { CoachesProvider } from '@/lib/coaches-context';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import CoachesSidebar from '@/components/coaches/CoachesSidebar';
import CoachesBottomNav from '@/components/coaches/CoachesBottomNav';
import InstallAppPrompt from '@/components/InstallAppPrompt';
import HelpDrawerProvider from '@/components/help/HelpDrawerProvider';
import ConfirmProvider from '@/components/coaches/ConfirmProvider';
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

  const assignments = await getCoachingAssignmentsForUser(authCtx.org.id, authCtx.user.id);

  if (assignments.length === 0) {
    const { name: orgName, contactEmail } = authCtx.org;
    const isTeamWorkspace = isTeamWorkspaceOrg(authCtx.org);
    return (
      <OrgProvider>
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
    <OrgProvider>
      <CoachesProvider orgSlug={orgSlug}>
        {/* Hosts the in-context "?" help slide-over for the team work pages (drawer +
            guide content load lazily on first click — no bundle cost until used). */}
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
      </CoachesProvider>
    </OrgProvider>
  );
}
