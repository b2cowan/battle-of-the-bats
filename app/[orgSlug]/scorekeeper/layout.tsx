import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { UserCheck } from 'lucide-react';
import { getAuthContextWithRole } from '@/lib/api-auth';
import ShellSignOutButton from '@/components/volunteer/ShellSignOutButton';
import { ScorekeeperFlipProvider, ScorekeeperFlipPill } from '@/components/volunteer/ScorekeeperFlip';
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
    title: org?.name ? `${org.name} Scorekeeper` : 'Scorekeeper',
    // Unified-app identity (Phase 0): one FieldLogicHQ install; the apple title now
    // matches the unified manifest name (was the old per-org "Scorekeeper" drift).
    manifest: '/manifest.json',
    other: {
      'mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-status-bar-style': 'black-translucent',
      'apple-mobile-web-app-title': 'FieldLogicHQ',
    },
  };
}

export default async function ScorekeeperLayout({
  params,
  children,
}: {
  params: Promise<{ orgSlug: string }>;
  children: React.ReactNode;
}) {
  const { orgSlug } = await params;

  // `allowSuspendedOrg` so a cancelled org reaches the wall below rather than a 500. The score
  // API is closed by the same rail regardless — this decides only what the volunteer SEES.
  const authCtx = await getAuthContextWithRole({ orgSlug, allowSuspendedOrg: true });
  if (!authCtx) {
    redirect(`/auth/login?next=/${orgSlug}/scorekeeper`);
  }

  if (authCtx.org.slug !== orgSlug) {
    redirect(`/${authCtx.org.slug}/scorekeeper`);
  }

  // Billing rail (owner ruling 2026-08-06). The cancel dialog has always promised "score updates"
  // shut down; this is the surface that kept working, because the scorekeeper PWA lives OUTSIDE
  // the admin shell whose client-side guard was doing the redirecting. The helper enforces the
  // before-the-capability-wall ordering so a cancelled org gets the accurate reason, not
  // "Access Denied".
  const suspendedWall = suspendedOrgWall(authCtx.org, 'scorekeeper');
  if (suspendedWall) return suspendedWall;

  if (!hasCapability(authCtx.role, authCtx.capabilities, 'submit_scores')) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--hud-surface)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}>
        <div style={{
          border: '1px solid rgba(var(--blueprint-blue-rgb), 0.4)',
          background: 'var(--hud-surface)',
          padding: '2rem',
          maxWidth: '420px',
          width: '100%',
        }}>
          <div className="hud-label" style={{ marginBottom: '0.75rem' }}>Access Denied</div>
          <p className="data-mono" style={{ color: '#94A3B8', fontSize: '0.875rem', lineHeight: 1.6 }}>
            This account does not have scorekeeper access. Contact your organization admin if you need to submit scores.
          </p>
        </div>
      </div>
    );
  }

  const canGate = hasCapability(authCtx.role, authCtx.capabilities, 'check_in_teams')
    || hasCapability(authCtx.role, authCtx.capabilities, 'manage_registrations');
  // Plain-language duty names for the Account sheet — what this person is allowed to do here,
  // which is the question a borrowed phone at a field raises.
  const duties = [canGate ? 'Gate' : null, 'Scorekeeper'].filter(Boolean) as string[];

  return (
    // "The Flip" P3: the provider bridges the page's score fetch (which knows the day's
    // tournaments) to the header pill — see components/volunteer/ScorekeeperFlip.tsx.
    <ScorekeeperFlipProvider>
    {/* Day-of volunteer shell — a RULED EXCEPTION to the nav grammar (top-nav audit §3):
        the wordmark here is deliberately INERT text, not a door. A gloved volunteer mid-game
        should not be one mis-tap from the consumer app.
        Do not "unify" this header into a platform strip.
        Ground + border + height now come from the same tokens as its twin (/{org}/check-in) —
        they were a hand-written #0A0A0A and a literal rgba here, so a volunteer who does both
        jobs watched the whole screen change colour crossing between them (§D9).
        `shell` declares the bottom-furniture budget every consumer below composes from — see
        DayOfShell.module.css before adding anything that reaches the bottom of this screen. */}
    <div className={shell.shell} style={{ minHeight: '100vh', background: 'var(--hud-surface)' }}>
      <header style={{
        borderBottom: '1px solid rgba(var(--blueprint-blue-rgb), 0.4)',
        background: 'var(--hud-surface)',
        padding: '0 1.25rem',
        minHeight: 'var(--dayof-bar-h)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1.25rem',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}>
        {/* `identity` clips: the wordmark below is `nowrap` and the actions beside it cannot
            shrink, so without a clip here the mark painted across them on every phone. */}
        <div className={shell.identity} style={{ flex: '1 1 auto', minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-data)', fontWeight: 700, fontSize: '1rem', whiteSpace: 'nowrap' }}>
            <span style={{ color: '#F1F5F9' }}>FIELD</span>
            <span style={{ color: '#D9F99D' }}>LOGIC</span>
            <span style={{ color: 'rgba(148,163,184,0.5)' }}>HQ</span>
          </div>
          <div style={{
            color: '#94A3B8',
            fontFamily: 'var(--font-data)',
            fontSize: '0.68rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {authCtx.org.name}
          </div>
        </div>
        {/* On a phone the gate hop and Sign Out live in the tab bar instead — they are marked
            `deskOnly`, not deleted. Above 640px there is no tab bar and this row has the room. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexShrink: 0 }}>
          {/* "The Flip" P3: constant public door — direct for one live event, chooser for 2+.
              Stays at EVERY width: it resolves to a specific event, which the Account sheet's
              plain org door cannot do. */}
          <ScorekeeperFlipPill orgSlug={orgSlug} />
          {/* J1-077: one-tap hop to the gate board for volunteers who also check teams in. */}
          {canGate && (
            <Link
              href={`/${orgSlug}/check-in`}
              aria-label="Check-In"
              className={`${shell.hop} ${shell.deskOnly}`}
              style={{ color: '#D9F99D', fontFamily: 'var(--font-data)', fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none', whiteSpace: 'nowrap' }}
            >
              {/* The admin nav's own Check-in icon, matching the Gate tab below. */}
              <UserCheck size={15} aria-hidden />
              <span>Check-In →</span>
            </Link>
          )}
          {/* No "Send feedback" here (owner call 2026-08-07). Everywhere else in the product it is
              a quiet footer link in the admin sidebar; these two volunteer headers were the only
              surface promoting it to top-level chrome — on the most space-starved row in the app,
              in front of the audience least likely to file product feedback mid-shift. */}
          <span className={shell.deskOnly}>
            <ShellSignOutButton />{/* J8-001: was a dead <Link href="/auth/logout"> (404) */}
          </span>
        </div>
      </header>

      {/* Bottom clearance is COMPOSED from the shell's budget, never guessed — the bars are fixed
          and a hand-picked number here is how the lineup builder's Undo bar ended up unreachable
          behind the nav on notched phones. Off a phone the term is 0px and this is today's 1.25rem. */}
      <main style={{ padding: '1.25rem', paddingBottom: 'calc(1.25rem + var(--dayof-bottom-h))' }}>
        {children}
      </main>
      {/* The feedback request-id recorder went with the launcher — it exists only to attach the
          last request id to a feedback report, and there is no way to file one from here now. */}
      <InstallAppPrompt
        appName="FieldLogicHQ"
        subtitle="Your teams, schedules and scores — one tap away."
      />
      <DayOfTabBar
        orgSlug={orgSlug}
        current="score"
        canScore
        canGate={canGate}
        displayName={getUserDisplayName(authCtx.user)}
        email={authCtx.user.email ?? ''}
        duties={duties}
        orgName={authCtx.org.name}
      />
    </div>
    </ScorekeeperFlipProvider>
  );
}
