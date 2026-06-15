import type { Metadata } from 'next';
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
    title: org?.name ? `${org.name} Scorekeeper` : 'Scorekeeper',
    // J8-004: scorekeeper-scoped manifest so an installed PWA opens the scoring screen, not /home.
    manifest: `/${orgSlug}/scorekeeper/manifest.webmanifest`,
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

  const authCtx = await getAuthContextWithRole({ orgSlug });
  if (!authCtx) {
    redirect(`/auth/login?next=/${orgSlug}/scorekeeper`);
  }

  if (authCtx.org.slug !== orgSlug) {
    redirect(`/${authCtx.org.slug}/scorekeeper`);
  }

  if (!hasCapability(authCtx.role, authCtx.capabilities, 'submit_scores')) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0A0A0A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}>
        <div style={{
          border: '1px solid rgba(30,58,138,0.4)',
          background: '#111827',
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

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0A' }}>
      <header style={{
        borderBottom: '1px solid rgba(30,58,138,0.5)',
        background: '#0A0A0A',
        padding: '0 1.25rem',
        minHeight: '52px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-data)', fontWeight: 700, fontSize: '1rem' }}>
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
            {authCtx.org.name} scorekeeper
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexShrink: 0 }}>
          <FeedbackLauncher compact />
          <ShellSignOutButton />{/* J8-001: was a dead <Link href="/auth/logout"> (404) */}
        </div>
      </header>

      <main style={{ padding: '1.25rem' }}>
        {children}
      </main>
      <FeedbackRequestIdProvider />
      <InstallAppPrompt
        appName="FieldLogicHQ"
        subtitle="Your teams, schedules and scores — one tap away."
        dismissKey="flhq-install-member"
      />
    </div>
  );
}
