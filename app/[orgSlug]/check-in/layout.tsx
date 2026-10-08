import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Trophy } from 'lucide-react';
import { getAuthContextWithRole } from '@/lib/api-auth';
import ShellSignOutButton from '@/components/volunteer/ShellSignOutButton';
import { getOrganizationBySlug } from '@/lib/db';
import { canGate as holdsGate, canScore as holdsScoring } from '@/lib/volunteer-jobs';
import { VOLUNTEER_DUTY, VOLUNTEER_HOP, VOLUNTEER_WALL } from '@/lib/volunteer-words';
import VolunteerWall from '@/components/volunteer/VolunteerWall';
import { suspendedOrgWall } from '@/components/billing/SubscriptionEndedWall';
import InstallAppPrompt from '@/components/InstallAppPrompt';
import DayOfTabBar from '@/components/volunteer/DayOfBottomBars';
import { getUserDisplayName } from '@/lib/user-display';
import { GuestKitRoot } from '@/components/admin/AdminKitProvider';
import shell from '@/components/volunteer/DayOfShell.module.css';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<Metadata> {
  const { orgSlug } = await params;
  const org = await getOrganizationBySlug(orgSlug);
  return {
    title: org?.name ? `${org.name} Check-in` : 'Check-in',
    manifest: '/manifest.json',
    other: {
      'mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-status-bar-style': 'black-translucent',
      'apple-mobile-web-app-title': 'FieldLogicHQ',
    },
  };
}

export default async function CheckInVolunteerLayout({
  params,
  children,
}: {
  params: Promise<{ orgSlug: string }>;
  children: React.ReactNode;
}) {
  const { orgSlug } = await params;

  // Admin Design Continuity, slice 5 / ruling R3 — released 2026-09-28, exactly as the scorekeeper twin (see
  // there): the kit with its warm palette FIXED, in every build, through `GuestKitRoot`, which has no off state.

  // `allowSuspendedOrg` so a cancelled org reaches the wall below rather than a 500. The check-in
  // APIs are closed by the same rail regardless — this decides only what the volunteer SEES.
  const authCtx = await getAuthContextWithRole({ orgSlug, allowSuspendedOrg: true });
  if (!authCtx) {
    redirect(`/auth/login?next=/${orgSlug}/check-in`);
  }
  if (authCtx.org.slug !== orgSlug) {
    redirect(`/${authCtx.org.slug}/check-in`);
  }

  // Billing rail (owner ruling 2026-08-06). Like the scorekeeper PWA, this surface sits outside
  // the admin shell, so the client-side cancellation redirect never reached it. The helper
  // enforces the before-the-capability-wall ordering so a cancelled org gets the accurate reason,
  // not "Access Denied".
  const suspendedWall = suspendedOrgWall(authCtx.org, 'check-in');
  if (suspendedWall) return <GuestKitRoot>{suspendedWall}</GuestKitRoot>;

  // Gate volunteers (check_in_teams) and organizers (manage_registrations) both qualify — the gate's
  // one question, shared with every landing (Stage 6, A26).
  const canScore = holdsScoring(authCtx.role, authCtx.capabilities);
  if (!holdsGate(authCtx.role, authCtx.capabilities)) {
    // The wrong-job wall: a scoring volunteer on the gate's address.
    return (
      <GuestKitRoot>
        <VolunteerWall
          message={VOLUNTEER_WALL.gate}
          hop={canScore ? { href: `/${orgSlug}/scorekeeper`, label: VOLUNTEER_HOP.toScoring } : null}
        />
      </GuestKitRoot>
    );
  }

  const duties = [canScore ? VOLUNTEER_DUTY.scoring : null, VOLUNTEER_DUTY.gate].filter(Boolean) as string[];

  return (
    <GuestKitRoot>
    {/* Day-of volunteer shell — a RULED EXCEPTION to the nav grammar (top-nav audit §3):
       the wordmark is deliberately INERT text, not a door. Do not "unify" this header into a
       platform strip.

       ⚠ The ⇄ FLIP DOOR: this shell carries none, and the note that used to sit here claimed that
       was "considered and declined, 2026-08-01". It was not. The top-nav audit (D9, same day)
       recorded it as "never considered, not ruled" and routed it to /design; no design-log entry
       exists. Its stated reason — "a check-in board has no public twin" — also does not hold: the
       scorekeeper's flip resolves to the public side of the EVENT, not to a mirror of the scoring
       board, and a gate volunteer stands at the same event. Settled 2026-08-07 (owner): the public
       door lives in the Account sheet on BOTH shells, and no ⇄ pill is added to this row. */}
    <div className={shell.shell} style={{ minHeight: '100vh' }}>
      <header className={shell.header}>
        {/* `identity` clips — see the scorekeeper twin: the wordmark is `nowrap` and the actions
            beside it cannot shrink, so a narrow row made the mark paint across them. */}
        <div className={shell.identity}>
          <div className={shell.wordmark}>
            <span>FIELD</span>
            <span className={shell.markLogic}>LOGIC</span>
            <span className={shell.markHq}>HQ</span>
          </div>
          <div className={shell.orgName}>{authCtx.org.name}</div>
        </div>
        {/* On a phone both of these live in the tab bar instead — marked `deskOnly`, not deleted.
            Shared with the scorekeeper twin (DayOfShell.module.css). */}
        <div className={shell.doors}>
          {/* J1-077: one-tap hop to the scorekeeper screen for volunteers who also score. */}
          {canScore && (
            <Link
              href={`/${orgSlug}/scorekeeper`}
              aria-label="Scorekeeper"
              className={`${shell.hop} ${shell.deskOnly}`}
            >
              {/* The admin nav's Results icon — score entry is where this door goes. */}
              <Trophy size={15} aria-hidden />
              <span>{VOLUNTEER_HOP.toScoring}</span>
            </Link>
          )}
          {/* No "Send feedback" here — see the scorekeeper twin (owner call 2026-08-07). */}
          <span className={shell.deskOnly}>
            <ShellSignOutButton />{/* J8-001: was a dead <Link href="/auth/logout"> (404) */}
          </span>
        </div>
      </header>

      {/* Bottom clearance composed from the shell's budget — see the scorekeeper twin. */}
      <main style={{
        padding: '1.25rem',
        paddingBottom: 'calc(1.25rem + var(--dayof-bottom-h))',
        maxWidth: '760px',
        margin: '0 auto',
      }}>
        {children}
      </main>
      {/* The feedback request-id recorder went with the launcher — see the scorekeeper twin. */}
      <InstallAppPrompt
        appName="FieldLogicHQ"
        subtitle="Check teams in at the gate — one tap away."
      />
      <DayOfTabBar
        orgSlug={orgSlug}
        current="gate"
        canScore={canScore}
        canGate
        displayName={getUserDisplayName(authCtx.user)}
        email={authCtx.user.email ?? ''}
        duties={duties}
        orgName={authCtx.org.name}
      />
    </div>
    </GuestKitRoot>
  );
}
