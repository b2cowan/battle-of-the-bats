import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuthContextWithRole } from '@/lib/api-auth';
import ShellSignOutButton from '@/components/volunteer/ShellSignOutButton';
import { getOrganizationBySlug } from '@/lib/db';
import { hasCapability } from '@/lib/roles';
import InstallAppPrompt from '@/components/InstallAppPrompt';
import FeedbackLauncher from '@/components/feedback/FeedbackLauncher';
import FeedbackRequestIdProvider from '@/components/feedback/FeedbackRequestIdProvider';

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

  const authCtx = await getAuthContextWithRole({ orgSlug });
  if (!authCtx) {
    redirect(`/auth/login?next=/${orgSlug}/check-in`);
  }
  if (authCtx.org.slug !== orgSlug) {
    redirect(`/${authCtx.org.slug}/check-in`);
  }

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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--hud-surface)' }}>
      <header style={{
        borderBottom: '1px solid rgba(var(--blueprint-blue-rgb), 0.4)', background: 'var(--hud-surface)', padding: '0 1.25rem',
        minHeight: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '1rem', position: 'sticky', top: 0, zIndex: 40,
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-data)', fontWeight: 700, fontSize: '1rem' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexShrink: 0 }}>
          {/* J1-077: one-tap hop to the scorekeeper screen for volunteers who also score. */}
          {hasCapability(authCtx.role, authCtx.capabilities, 'submit_scores') && (
            <Link
              href={`/${orgSlug}/scorekeeper`}
              style={{ color: '#D9F99D', fontFamily: 'var(--font-data)', fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none', whiteSpace: 'nowrap' }}
            >
              Scorekeeper →
            </Link>
          )}
          <FeedbackLauncher compact />
          <ShellSignOutButton />{/* J8-001: was a dead <Link href="/auth/logout"> (404) */}
        </div>
      </header>

      <main style={{ padding: '1.25rem', maxWidth: '760px', margin: '0 auto' }}>
        {children}
      </main>
      <FeedbackRequestIdProvider />
      <InstallAppPrompt
        appName="FieldLogicHQ"
        subtitle="Check teams in at the gate — one tap away."
        dismissKey="flhq-install-checkin"
      />
    </div>
  );
}
