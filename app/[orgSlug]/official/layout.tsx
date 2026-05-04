import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { getOrganizationBySlug } from '@/lib/db';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<Metadata> {
  const { orgSlug } = await params;
  const org = await getOrganizationBySlug(orgSlug);
  return { title: org?.name ?? 'FieldLogic' };
}

export default async function OfficialLayout({
  params,
  children,
}: {
  params: Promise<{ orgSlug: string }>;
  children: React.ReactNode;
}) {
  const { orgSlug } = await params;

  const authCtx = await getAuthContextWithRole();
  if (!authCtx) {
    redirect(`/auth/login?next=/${orgSlug}/official/score`);
  }

  if (authCtx.org.slug !== orgSlug) {
    // User belongs to a different org — send them to their own official page
    if (authCtx.role === 'official') {
      redirect(`/${authCtx.org.slug}/official/score`);
    }
    redirect(`/${authCtx.org.slug}/admin`);
  }

  // Admins and owners have full access via the admin route
  if (authCtx.role === 'owner' || authCtx.role === 'admin') {
    redirect(`/${orgSlug}/admin`);
  }

  // Staff have admin access but not the official interface
  if (authCtx.role === 'staff') {
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
            Staff members use the admin panel to enter scores.
          </p>
          <Link
            href={`/${orgSlug}/admin/results`}
            style={{
              display: 'inline-block',
              marginTop: '1.5rem',
              fontFamily: 'var(--font-data)',
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#D9F99D',
              border: '1px solid #D9F99D',
              padding: '0.5rem 1rem',
              textDecoration: 'none',
            }}
          >
            Go to Results →
          </Link>
        </div>
      </div>
    );
  }

  // official role — render the shell
  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0A' }}>
      {/* Top bar */}
      <header style={{
        borderBottom: '1px solid rgba(30,58,138,0.5)',
        background: '#0A0A0A',
        padding: '0 1.25rem',
        height: '52px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}>
        <div style={{ fontFamily: 'var(--font-data)', fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.03em' }}>
          <span style={{ color: '#F1F5F9' }}>FIELD</span>
          <span style={{ color: '#D9F99D' }}>LOGIC</span>
          <span style={{ color: '#94A3B8', fontWeight: 400, fontSize: '0.7rem', letterSpacing: '0.1em', marginLeft: '0.75rem', textTransform: 'uppercase' }}>
            {authCtx.org.name}
          </span>
        </div>
        <Link
          href="/auth/logout"
          style={{
            fontFamily: 'var(--font-data)',
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: '#94A3B8',
            textDecoration: 'none',
          }}
        >
          Sign Out
        </Link>
      </header>

      <main style={{ padding: '1.25rem' }}>
        {children}
      </main>
    </div>
  );
}
