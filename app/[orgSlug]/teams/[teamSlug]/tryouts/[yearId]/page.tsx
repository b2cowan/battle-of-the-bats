import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getOrganizationBySlug, getRepTeamBySlug, getRepProgramYear } from '@/lib/db';
import HelpCallout from '@/components/help/HelpCallout';

export const dynamic = 'force-dynamic';

export default async function TryoutLandingPage({
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
          href={`/${orgSlug}/teams/${teamSlug}`}
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
          ← Back to {team.name}
        </Link>

        <div style={{ marginBottom: '2.5rem' }}>
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
            {programYear.name} Tryouts
          </h1>
          {team.division && (
            <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.25rem' }}>
              {team.division}
            </div>
          )}
        </div>

        {programYear.tryoutDescription && (
          <div
            style={{
              padding: '1.25rem 1.5rem',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.03)',
              marginBottom: '2rem',
              fontSize: '0.9rem',
              color: 'rgba(255,255,255,0.75)',
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
            }}
          >
            {programYear.tryoutDescription}
          </div>
        )}

        {programYear.tryoutOpen ? (
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.3rem 0.75rem',
                borderRadius: '6px',
                background: 'rgba(163,230,53,0.1)',
                border: '1px solid rgba(163,230,53,0.3)',
                color: 'var(--logic-lime, #a3e635)',
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '1.25rem',
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />{' '}
              Accepting Applications
            </div>
            <div>
              <Link
                href={`/${orgSlug}/teams/${teamSlug}/tryouts/${yearId}/register`}
                style={{
                  display: 'inline-block',
                  padding: '0.85rem 2rem',
                  background: 'var(--logic-lime, #a3e635)',
                  color: '#0A0A0A',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '1rem',
                  textDecoration: 'none',
                  fontFamily: 'var(--font-display, sans-serif)',
                }}
              >
                Register for Tryouts →
              </Link>
            </div>
          </div>
        ) : (
          <HelpCallout
            variant="info"
            title="Tryouts are currently closed"
            body={
              <>
                Tryout registration for {team.name} — {programYear.name} is not accepting applications at this time.
                {org.contactEmail && (
                  <> Questions? <a href={`mailto:${org.contactEmail}`} style={{ color: '#4fa3e0' }}>Contact us</a>.</>
                )}
              </>
            }
          />
        )}
      </div>
    </div>
  );
}
