import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getLeagueSeasonBySlug, getDivisionsForSeason, computeStandings } from '@/lib/db';
import { resolvePublicLeagueContext } from '@/lib/public-league';
import type { LeagueDivision, LeagueStandingsRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function PublicStandingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string; seasonSlug: string }>;
  searchParams: Promise<{ d?: string }>;
}) {
  const { orgSlug, seasonSlug } = await params;
  const { d: divisionIdParam } = await searchParams;

  const org = await resolvePublicLeagueContext(orgSlug);
  if (!org) notFound();

  const season = await getLeagueSeasonBySlug(org.id, seasonSlug);
  if (!season) notFound();
  if (season.status === 'draft') notFound();

  const divisions = await getDivisionsForSeason(season.id);
  if (divisions.length === 0) {
    return <EmptyState orgSlug={orgSlug} seasonSlug={seasonSlug} seasonName={season.name} />;
  }

  const activeDivision: LeagueDivision =
    divisions.find(d => d.id === divisionIdParam) ?? divisions[0];

  const standings = await computeStandings(activeDivision.id);

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
          maxWidth: '800px',
          margin: '0 auto',
          padding: 'calc(var(--nav-height, 64px) + 2rem) 1.5rem 5rem',
        }}
      >
        {/* Back */}
        <Link
          href={`/${orgSlug}/league/${seasonSlug}`}
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
          ← {season.name}
        </Link>

        {/* Title */}
        <div style={{ marginBottom: '1.75rem' }}>
          <h1
            style={{
              fontSize: '2rem',
              fontWeight: 900,
              color: '#f0f0f0',
              fontFamily: 'var(--font-display, sans-serif)',
              margin: '0 0 0.25rem',
              lineHeight: 1.1,
            }}
          >
            Standings
          </h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)' }}>
            {season.name}
          </p>
        </div>

        {/* Division tabs */}
        {divisions.length > 1 && (
          <div
            style={{
              display: 'flex',
              gap: '0.4rem',
              marginBottom: '1.5rem',
              flexWrap: 'wrap',
            }}
          >
            {divisions.map(d => {
              const isActive = d.id === activeDivision.id;
              return (
                <Link
                  key={d.id}
                  href={`/${orgSlug}/league/${seasonSlug}/standings?d=${d.id}`}
                  style={{
                    padding: '0.4rem 1rem',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    fontWeight: isActive ? 700 : 500,
                    background: isActive ? 'rgba(163,230,53,0.12)' : 'rgba(255,255,255,0.05)',
                    color: isActive ? '#a3e635' : 'rgba(255,255,255,0.55)',
                    border: isActive
                      ? '1px solid rgba(163,230,53,0.3)'
                      : '1px solid rgba(255,255,255,0.08)',
                    textDecoration: 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {d.name}
                </Link>
              );
            })}
          </div>
        )}

        {/* Standings table */}
        {standings.length === 0 ? (
          <div
            style={{
              padding: '2.5rem 1.5rem',
              textAlign: 'center',
              border: '1px dashed rgba(255,255,255,0.1)',
              borderRadius: '10px',
              color: 'rgba(255,255,255,0.35)',
              fontSize: '0.9rem',
            }}
          >
            No games have been completed yet. Check back once the season is underway.
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.88rem',
                }}
              >
                <thead>
                  <tr>
                    {['#', 'Team', 'GP', 'W', 'L', 'T', 'Pts', 'GF', 'GA', 'Diff'].map((h, i) => (
                      <th
                        key={h}
                        style={{
                          textAlign: i < 2 ? 'left' : 'center',
                          padding: '0.55rem 0.75rem',
                          fontSize: '0.63rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          color: 'rgba(255,255,255,0.35)',
                          borderBottom: '1px solid rgba(255,255,255,0.08)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {standings.map((row, i) => (
                    <StandingsRow key={row.team.id} row={row} rank={i + 1} isFirst={i === 0} />
                  ))}
                </tbody>
              </table>
            </div>
            <p
              style={{
                marginTop: '1rem',
                fontSize: '0.72rem',
                color: 'rgba(255,255,255,0.25)',
              }}
            >
              Pts: W=2, T=1, L=0 &nbsp;·&nbsp; Tiebreaker: run differential, then runs for
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function StandingsRow({
  row,
  rank,
  isFirst,
}: {
  row: LeagueStandingsRow;
  rank: number;
  isFirst: boolean;
}) {
  const diff = row.runDifferential;
  return (
    <tr style={{ background: isFirst ? 'rgba(163,230,53,0.04)' : undefined }}>
      <td
        style={{
          padding: '0.6rem 0.75rem',
          textAlign: 'left',
          color: 'rgba(255,255,255,0.3)',
          fontWeight: 600,
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        {rank}
      </td>
      <td
        style={{
          padding: '0.6rem 0.75rem',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
          {row.team.color && (
            <span
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: row.team.color,
                flexShrink: 0,
              }}
            />
          )}
          <span style={{ fontWeight: 600, color: isFirst ? '#a3e635' : '#f0f0f0' }}>
            {row.team.name}
          </span>
        </span>
      </td>
      {[row.gamesPlayed, row.wins, row.losses, row.ties].map((val, i) => (
        <td
          key={i}
          style={{
            padding: '0.6rem 0.75rem',
            textAlign: 'center',
            color: i === 1 ? '#f0f0f0' : 'rgba(255,255,255,0.6)',
            fontWeight: i === 1 ? 700 : 400,
            borderBottom: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          {val}
        </td>
      ))}
      <td
        style={{
          padding: '0.6rem 0.75rem',
          textAlign: 'center',
          fontWeight: 800,
          color: '#a3e635',
          fontVariantNumeric: 'tabular-nums',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        {row.points}
      </td>
      <td
        style={{
          padding: '0.6rem 0.75rem',
          textAlign: 'center',
          color: 'rgba(255,255,255,0.6)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        {row.runsFor}
      </td>
      <td
        style={{
          padding: '0.6rem 0.75rem',
          textAlign: 'center',
          color: 'rgba(255,255,255,0.6)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        {row.runsAgainst}
      </td>
      <td
        style={{
          padding: '0.6rem 0.75rem',
          textAlign: 'center',
          fontWeight: 600,
          color: diff > 0 ? '#4ade80' : diff < 0 ? '#f87171' : 'rgba(255,255,255,0.3)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        {diff > 0 ? '+' : ''}{diff}
      </td>
    </tr>
  );
}

function EmptyState({
  orgSlug,
  seasonSlug,
  seasonName,
}: {
  orgSlug: string;
  seasonSlug: string;
  seasonName: string;
}) {
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
          maxWidth: '800px',
          margin: '0 auto',
          padding: 'calc(var(--nav-height, 64px) + 2rem) 1.5rem 5rem',
        }}
      >
        <Link
          href={`/${orgSlug}/league/${seasonSlug}`}
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
          ← {seasonName}
        </Link>
        <h1
          style={{
            fontSize: '2rem',
            fontWeight: 900,
            color: '#f0f0f0',
            fontFamily: 'var(--font-display, sans-serif)',
            margin: '0 0 1.5rem',
          }}
        >
          Standings
        </h1>
        <div
          style={{
            padding: '2.5rem 1.5rem',
            textAlign: 'center',
            border: '1px dashed rgba(255,255,255,0.1)',
            borderRadius: '10px',
            color: 'rgba(255,255,255,0.35)',
            fontSize: '0.9rem',
          }}
        >
          No divisions have been set up for this season yet.
        </div>
      </div>
    </div>
  );
}
