import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import {
  getOrganizationBySlug,
  getRepTeamBySlug,
  getRepProgramYears,
  getActiveTournamentByOrg,
} from '@/lib/db';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  draft:     'Draft',
  active:    'Active',
  completed: 'Completed',
  archived:  'Archived',
};

export default async function TeamPublicPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamSlug: string }>;
}) {
  const { orgSlug, teamSlug } = await params;

  const org = await getOrganizationBySlug(orgSlug);
  if (!org) notFound();

  // Try to resolve as a rep team slug first
  const team = await getRepTeamBySlug(org.id, teamSlug);

  if (!team) {
    // Fall back to legacy tournament team redirect (teamSlug may be a UUID from an old link)
    const active = await getActiveTournamentByOrg(org.id);
    if (active?.slug) redirect(`/${orgSlug}/${active.slug}/teams/${teamSlug}`);
    redirect(`/${orgSlug}`);
  }

  const programYears = await getRepProgramYears(team.id);

  const openYear = !team.isArchived
    ? (programYears.find(y => y.status === 'active' && y.tryoutOpen) ?? null)
    : null;
  const pastYears = programYears.filter(y => y.status === 'completed' || y.status === 'archived');

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--pitch-black, #0A0A0A)',
        fontFamily: 'var(--font-sans, Inter, sans-serif)',
        color: 'var(--fl-text, #F1F5F9)',
      }}
    >
      {/* Color accent strip */}
      {team.color && (
        <div style={{ height: '4px', background: team.color }} />
      )}

      <div
        style={{
          maxWidth: '680px',
          margin: '0 auto',
          padding: 'calc(var(--nav-height, 64px) + 2rem) 1.5rem 5rem',
        }}
      >
        <Link
          href={`/${orgSlug}`}
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
          ← {org.name}
        </Link>

        {/* Team header */}
        <div style={{ marginBottom: '2.5rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '0.5rem',
              flexWrap: 'wrap',
            }}
          >
            <h1
              style={{
                fontSize: '2rem',
                fontWeight: 900,
                color: '#f0f0f0',
                fontFamily: 'var(--font-display, sans-serif)',
                margin: 0,
                lineHeight: 1.1,
              }}
            >
              {team.name}
            </h1>
            {team.division && (
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  padding: '0.25rem 0.6rem',
                  borderRadius: '5px',
                  background: team.color ? `${team.color}22` : 'rgba(255,255,255,0.07)',
                  color: team.color ?? 'rgba(255,255,255,0.6)',
                  border: `1px solid ${team.color ? `${team.color}44` : 'rgba(255,255,255,0.1)'}`,
                }}
              >
                {team.division}
              </span>
            )}
            {team.isArchived && (
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  padding: '0.25rem 0.6rem',
                  borderRadius: '5px',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.4)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                Alumni
              </span>
            )}
          </div>
          {team.description && (
            <p
              style={{
                fontSize: '0.95rem',
                color: 'rgba(255,255,255,0.6)',
                lineHeight: 1.65,
                margin: '0.5rem 0 0',
                maxWidth: '520px',
              }}
            >
              {team.description}
            </p>
          )}
        </div>

        {/* Alumni notice */}
        {team.isArchived && (
          <div
            style={{
              padding: '1rem 1.25rem',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '10px',
              background: 'rgba(255,255,255,0.02)',
              marginBottom: '2rem',
              fontSize: '0.88rem',
              color: 'rgba(255,255,255,0.45)',
              lineHeight: 1.6,
            }}
          >
            This program has concluded. The full season history is preserved below.
          </div>
        )}

        {/* Tryouts open banner */}
        {openYear && (
          <div
            style={{
              padding: '1.25rem 1.5rem',
              border: '1px solid rgba(163,230,53,0.3)',
              borderRadius: '12px',
              background: 'rgba(163,230,53,0.05)',
              marginBottom: '2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  color: 'var(--logic-lime, #a3e635)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: '0.35rem',
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />{' '}
                Tryouts Open
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f0f0f0' }}>
                {openYear.name}
              </div>
            </div>
            <Link
              href={`/${orgSlug}/teams/${team.slug}/tryouts/${openYear.id}/register`}
              style={{
                display: 'inline-block',
                padding: '0.65rem 1.5rem',
                background: 'var(--logic-lime, #a3e635)',
                color: '#0A0A0A',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.9rem',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                fontFamily: 'var(--font-display, sans-serif)',
              }}
            >
              Register Now →
            </Link>
          </div>
        )}

        {/* Past seasons */}
        {pastYears.length > 0 && (
          <div>
            <div
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'rgba(255,255,255,0.35)',
                marginBottom: '0.75rem',
              }}
            >
              Past Seasons
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {pastYears.map(py => (
                <div
                  key={py.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(255,255,255,0.02)',
                  }}
                >
                  <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.75)' }}>
                    {py.name}
                  </span>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'rgba(255,255,255,0.35)',
                    }}
                  >
                    {STATUS_LABEL[py.status] ?? py.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
