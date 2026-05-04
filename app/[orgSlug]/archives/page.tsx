import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOrganizationBySlug, getArchivesByOrg } from '@/lib/db';

export default async function ArchivesPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const org = await getOrganizationBySlug(orgSlug);
  if (!org) notFound();

  const archives = await getArchivesByOrg(org.id);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--pitch-black, #0A0A0A)',
        padding: '2rem',
        fontFamily: 'var(--font-data, "IBM Plex Mono", monospace)',
      }}
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

        {/* Page header */}
        <div
          style={{
            borderBottom: '1px solid var(--blueprint-blue, #1E3A8A)',
            paddingBottom: '1.25rem',
            marginBottom: '2rem',
          }}
        >
          <div className="hud-label" style={{ marginBottom: '0.375rem' }}>
            Tournament Archives // {org.name}
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-sans, Inter, sans-serif)',
              fontWeight: 800,
              fontSize: '1.875rem',
              textTransform: 'uppercase',
              letterSpacing: '-0.02em',
              color: 'var(--fl-text, #F1F5F9)',
              margin: 0,
            }}
          >
            Digital Ledger
          </h1>
          <div
            style={{
              fontFamily: 'var(--font-data, "IBM Plex Mono", monospace)',
              fontSize: '0.75rem',
              color: 'var(--data-gray, #94A3B8)',
              marginTop: '0.375rem',
            }}
          >
            {archives.length} SEALED RECORD{archives.length !== 1 ? 'S' : ''} · READ-ONLY
          </div>
        </div>

        {/* Ledger table */}
        {archives.length === 0 ? (
          <div
            style={{
              border: '1px solid rgba(30,58,138,0.3)',
              padding: '3rem',
              textAlign: 'center',
              color: 'var(--data-gray, #94A3B8)',
              fontSize: '0.75rem',
              letterSpacing: '0.08em',
            }}
          >
            NO SEALED RECORDS. ARCHIVES APPEAR HERE AFTER A TOURNAMENT IS SEALED.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.8125rem',
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid var(--blueprint-blue, #1E3A8A)',
                    color: 'var(--blueprint-light, #3B5FC4)',
                    fontSize: '0.625rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}
                >
                  <th style={{ textAlign: 'left', paddingBottom: '0.625rem', paddingRight: '1.5rem' }}>Season</th>
                  <th style={{ textAlign: 'left', paddingBottom: '0.625rem', paddingRight: '1.5rem' }}>Tournament</th>
                  <th style={{ textAlign: 'left', paddingBottom: '0.625rem', paddingRight: '1.5rem' }}>Division</th>
                  <th style={{ textAlign: 'left', paddingBottom: '0.625rem', paddingRight: '1.5rem' }}>Champion</th>
                  <th style={{ textAlign: 'right', paddingBottom: '0.625rem', paddingRight: '1.5rem' }}>Teams</th>
                  <th style={{ textAlign: 'right', paddingBottom: '0.625rem', paddingRight: '1.5rem' }}>Games</th>
                  <th style={{ textAlign: 'right', paddingBottom: '0.625rem' }}>Integrity</th>
                </tr>
              </thead>
              <tbody>
                {archives.map((a, i) => (
                  <tr
                    key={a.id}
                    style={{
                      borderBottom: '1px solid rgba(30,58,138,0.2)',
                      background: i % 2 !== 0 ? 'rgba(17,24,39,0.3)' : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <td style={{ padding: '0.75rem 1.5rem 0.75rem 0', color: 'var(--data-gray, #94A3B8)' }}>
                      <Link
                        href={`/${orgSlug}/archives/${a.id}`}
                        style={{ color: 'inherit', textDecoration: 'none', display: 'block' }}
                      >
                        {a.season}
                      </Link>
                    </td>
                    <td style={{ padding: '0.75rem 1.5rem 0.75rem 0', color: 'var(--fl-text, #F1F5F9)' }}>
                      <Link
                        href={`/${orgSlug}/archives/${a.id}`}
                        style={{ color: 'inherit', textDecoration: 'none', display: 'block' }}
                      >
                        {a.tournamentName}
                      </Link>
                    </td>
                    <td style={{ padding: '0.75rem 1.5rem 0.75rem 0', color: 'var(--data-gray, #94A3B8)' }}>
                      <Link
                        href={`/${orgSlug}/archives/${a.id}`}
                        style={{ color: 'inherit', textDecoration: 'none', display: 'block' }}
                      >
                        {a.division ?? '—'}
                      </Link>
                    </td>
                    <td
                      style={{
                        padding: '0.75rem 1.5rem 0.75rem 0',
                        color: 'var(--logic-lime, #D9F99D)',
                        fontWeight: 700,
                      }}
                    >
                      <Link
                        href={`/${orgSlug}/archives/${a.id}`}
                        style={{ color: 'inherit', textDecoration: 'none', display: 'block' }}
                      >
                        {a.winnerTeamName ?? '—'}
                      </Link>
                    </td>
                    <td style={{ padding: '0.75rem 1.5rem 0.75rem 0', textAlign: 'right', color: 'var(--data-gray, #94A3B8)' }}>
                      <Link
                        href={`/${orgSlug}/archives/${a.id}`}
                        style={{ color: 'inherit', textDecoration: 'none', display: 'block' }}
                      >
                        {a.totalTeams ?? '—'}
                      </Link>
                    </td>
                    <td style={{ padding: '0.75rem 1.5rem 0.75rem 0', textAlign: 'right', color: 'var(--data-gray, #94A3B8)' }}>
                      <Link
                        href={`/${orgSlug}/archives/${a.id}`}
                        style={{ color: 'inherit', textDecoration: 'none', display: 'block' }}
                      >
                        {a.totalGames ?? '—'}
                      </Link>
                    </td>
                    <td style={{ padding: '0.75rem 0', textAlign: 'right' }}>
                      <Link
                        href={`/${orgSlug}/archives/${a.id}`}
                        style={{ textDecoration: 'none', display: 'block' }}
                      >
                        {a.integrityHash ? (
                          <span
                            style={{
                              fontSize: '0.625rem',
                              border: '1px solid rgba(217,249,157,0.4)',
                              color: 'var(--logic-lime, #D9F99D)',
                              padding: '0.125rem 0.375rem',
                              letterSpacing: '0.06em',
                            }}
                          >
                            VERIFIED
                          </span>
                        ) : (
                          <span style={{ color: 'rgba(148,163,184,0.3)', fontSize: '0.75rem' }}>—</span>
                        )}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Back to org */}
        <div style={{ marginTop: '3rem', borderTop: '1px solid rgba(30,58,138,0.2)', paddingTop: '1.5rem' }}>
          <Link
            href={`/${orgSlug}`}
            style={{
              fontSize: '0.625rem',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--data-gray, #94A3B8)',
              textDecoration: 'none',
            }}
          >
            ← {org.name}
          </Link>
        </div>
      </div>
    </div>
  );
}
