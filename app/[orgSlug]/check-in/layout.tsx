import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Trophy } from 'lucide-react';
import { getAuthContextWithRole } from '@/lib/api-auth';
import ShellSignOutButton from '@/components/volunteer/ShellSignOutButton';
import { getOrganizationBySlug } from '@/lib/db';
import { hasCapability } from '@/lib/roles';
import { suspendedOrgWall } from '@/components/billing/SubscriptionEndedWall';
import InstallAppPrompt from '@/components/InstallAppPrompt';
import DayOfTabBar from '@/components/volunteer/DayOfBottomBars';
import { getUserDisplayName } from '@/lib/user-display';
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
  if (suspendedWall) return suspendedWall;

  // Gate volunteers (check_in_teams) and organizers (manage_registrations) both qualify.
  const allowed = hasCapability(authCtx.role, authCtx.capabilities, 'check_in_teams')
    || hasCapability(authCtx.role, authCtx.capabilities, 'manage_registrations');
  if (!allowed) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--hud-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ border: '1px solid rgba(var(--blueprint-blue-rgb), 0.4)', background: 'var(--hud-surface)', padding: '2rem', maxWidth: '420px', width: '100%' }}>
          <div className="hud-label" style={{ marginBottom: '0.75rem' }}>Access Denied</div>
          <p className="data-mono" style={{ color: '#94A3B8', fontSize: '0.875rem', lineHeight: 1.6 }}>
            This account does not have check-in access. Contact your organization admin if you need to check teams in at the gate.
          </p>
        </div>
      </div>
    );
  }

  const canScore = hasCapability(authCtx.role, authCtx.capabilities, 'submit_scores');
  const duties = [canScore ? 'Scorekeeper' : null, 'Gate'].filter(Boolean) as string[];

  return (
    /* Day-of volunteer shell — a RULED EXCEPTION to the nav grammar (top-nav audit §3):
       the wordmark is deliberately INERT text, not a door. Do not "unify" this header into a
       platform strip.

       ⚠ The ⇄ FLIP DOOR: this shell carries none, and the note that used to sit here claimed that
       was "considered and declined, 2026-08-01". It was not. The top-nav audit (D9, same day)
       recorded it as "never considered, not ruled" and routed it to /design; no design-log entry
       exists. Its stated reason — "a check-in board has no public twin" — also does not hold: the
       scorekeeper's flip resolves to the public side of the EVENT, not to a mirror of the scoring
       board, and a gate volunteer stands at the same event. Settled 2026-08-07 (owner): the public
       door lives in the Account sheet on BOTH shells, and no ⇄ pill is added to this row. */
    <div className={shell.shell} style={{ minHeight: '100vh', background: 'var(--hud-surface)' }}>
      <header style={{
        borderBottom: '1px solid rgba(var(--blueprint-blue-rgb), 0.4)', background: 'var(--hud-surface)', padding: '0 1.25rem',
        minHeight: 'var(--dayof-bar-h)', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '1.25rem', position: 'sticky', top: 0, zIndex: 40,
      }}>
        {/* `identity` clips — see the scorekeeper twin: the wordmark is `nowrap` and the actions
            beside it cannot shrink, so a narrow row made the mark paint across them. */}
        <div className={shell.identity} style={{ flex: '1 1 auto', minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-data)', fontWeight: 700, fontSize: '1rem', whiteSpace: 'nowrap' }}>
            <span style={{ color: '#F1F5F9' }}>FIELD</span>
            <span style={{ color: '#D9F99D' }}>LOGIC</span>
            <span style={{ color: 'rgba(148,163,184,0.5)' }}>HQ</span>
          </div>
          <div style={{
            color: '#94A3B8', fontFamily: 'var(--font-data)', fontSize: '0.68rem', letterSpacing: '0.08em',
            textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {authCtx.org.name}
          </div>
        </div>
        {/* On a phone both of these live in the tab bar instead — marked `deskOnly`, not deleted.
            Shared with the scorekeeper twin (DayOfShell.module.css). */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexShrink: 0 }}>
          {/* J1-077: one-tap hop to the scorekeeper screen for volunteers who also score. */}
          {canScore && (
            <Link
              href={`/${orgSlug}/scorekeeper`}
              aria-label="Scorekeeper"
              className={`${shell.hop} ${shell.deskOnly}`}
              style={{ color: '#D9F99D', fontFamily: 'var(--font-data)', fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none', whiteSpace: 'nowrap' }}
            >
              {/* The admin nav's Results icon — score entry is where this door goes. */}
              <Trophy size={15} aria-hidden />
              <span>Scorekeeper →</span>
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
  );
}
