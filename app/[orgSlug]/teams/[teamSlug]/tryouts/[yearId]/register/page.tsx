import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getOrganizationBySlug, getRepTeamBySlug, getRepProgramYear } from '@/lib/db';
import TryoutRegisterForm from '@/components/rep-teams/TryoutRegisterForm';

export const dynamic = 'force-dynamic';

export default async function TryoutRegisterPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamSlug: string; yearId: string }>;
}) {
  const { orgSlug, teamSlug, yearId } = await params;

  const org = await getOrganizationBySlug(orgSlug);
  if (!org) notFound();

  const team = await getRepTeamBySlug(org.id, teamSlug);
  if (!team) notFound();

  const programYear = await getRepProgramYear(yearId);
  if (!programYear || programYear.teamId !== team.id || programYear.orgId !== org.id) notFound();

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--pitch-black, #0A0A0A)',
        fontFamily: 'var(--font-sans, Inter, sans-serif)',
        color: 'var(--fl-text, #F1F5F9)',
      }}
    >
      <div
        style={{
          maxWidth: '640px',
          margin: '0 auto',
          padding: 'calc(var(--nav-height, 64px) + 2rem) 1.5rem 5rem',
        }}
      >
        <Link
          href={`/${orgSlug}/teams/${teamSlug}/tryouts/${yearId}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.8rem',
            color: 'rgba(255,255,255,0.4)',
            textDecoration: 'none',
            marginBottom: '1.5rem',
          }}
        >
          ← Back to {programYear.name}
        </Link>

        <div style={{ marginBottom: '2rem' }}>
          <div
            style={{
              fontSize: '0.68rem',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'rgba(255,255,255,0.4)',
              marginBottom: '0.4rem',
            }}
          >
            {org.name} · {team.name}
          </div>
          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: 900,
              color: '#f0f0f0',
              fontFamily: 'var(--font-display, sans-serif)',
              margin: '0 0 0.4rem',
              lineHeight: 1.1,
            }}
          >
            Tryout Application — {programYear.name}
          </h1>
          {team.ageGroup && (
            <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>
              {team.ageGroup}
            </div>
          )}
        </div>

        {!programYear.tryoutOpen ? (
          <div
            style={{
              padding: '3rem 2rem',
              textAlign: 'center',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.02)',
            }}
          >
            <h2
              style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                color: 'rgba(255,255,255,0.7)',
                margin: '0 0 0.5rem',
              }}
            >
              Registration is not currently open
            </h2>
            <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.4)', margin: '0 0 1rem' }}>
              Tryout registration for {team.name} — {programYear.name} is not accepting applications at this time.
            </p>
            {org.contactEmail && (
              <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.35)', margin: 0 }}>
                Questions?{' '}
                <a
                  href={`mailto:${org.contactEmail}`}
                  style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'underline' }}
                >
                  Contact us
                </a>
              </p>
            )}
          </div>
        ) : (
          <TryoutRegisterForm
            orgSlug={orgSlug}
            teamSlug={teamSlug}
            yearId={yearId}
            teamName={team.name}
            yearName={programYear.name}
          />
        )}
      </div>
    </div>
  );
}
