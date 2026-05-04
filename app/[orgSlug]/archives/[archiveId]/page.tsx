import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getArchiveById } from '@/lib/db';
import type { Game, Team, AgeGroup } from '@/lib/types';

// Compute standings from a frozen snapshot — no live DB queries
function computeStandings(
  teams: Team[],
  games: Game[],
  ageGroupId: string
) {
  const groupTeams = teams.filter(t => t.ageGroupId === ageGroupId);
  const groupGames = games.filter(
    g => g.ageGroupId === ageGroupId && !g.isPlayoff &&
      (g.status === 'completed' || g.status === 'submitted')
  );

  return groupTeams.map(t => {
    const teamGames = groupGames.filter(g => g.homeTeamId === t.id || g.awayTeamId === t.id);
    let wins = 0, losses = 0, ties = 0, rf = 0, ra = 0;
    teamGames.forEach(g => {
      const isHome = g.homeTeamId === t.id;
      const tScore = isHome ? (g.homeScore ?? 0) : (g.awayScore ?? 0);
      const oScore = isHome ? (g.awayScore ?? 0) : (g.homeScore ?? 0);
      rf += tScore;
      ra += oScore;
      if (tScore > oScore) wins++;
      else if (tScore < oScore) losses++;
      else ties++;
    });
    return {
      teamId:   t.id,
      teamName: t.name,
      poolId:   t.poolId,
      gp:       teamGames.length,
      w:        wins, l: losses, t: ties,
      pts:      wins * 2 + ties,
      rf, ra,
      rd:       rf - ra,
    };
  }).sort((a, b) => b.pts - a.pts || b.rd - a.rd || b.rf - a.rf);
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-CA', {
      year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
    });
  } catch {
    return iso;
  }
}

function formatTime(hhmm: string) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

export default async function ArchiveDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; archiveId: string }>;
}) {
  const { orgSlug, archiveId } = await params;
  const archive = await getArchiveById(archiveId);
  if (!archive) notFound();

  const { finalSnapshot: snap, tournamentName, season, sealedAt, integrityHash } = archive;
  const { ageGroups, teams, games } = snap;

  const playoffGames = games.filter(g => g.isPlayoff && g.status === 'completed');
  const poolGames    = games.filter(g => !g.isPlayoff && (g.status === 'completed' || g.status === 'submitted'));

  function teamName(id: string) {
    return teams.find(t => t.id === id)?.name ?? 'TBD';
  }

  const sealedDate = formatDate(sealedAt);
  const shortHash  = integrityHash.slice(0, 16) + '...';

  // ─── Styles ────────────────────────────────────────────────────────────────
  const mono: React.CSSProperties = { fontFamily: 'var(--font-data, "IBM Plex Mono", monospace)' };
  const hudLabel: React.CSSProperties = {
    ...mono,
    fontSize: '0.625rem',
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color: 'var(--blueprint-blue, #1E3A8A)',
  };
  const dataGray = 'var(--data-gray, #94A3B8)';
  const flText   = 'var(--fl-text, #F1F5F9)';
  const blue     = 'var(--blueprint-blue, #1E3A8A)';
  const lime     = 'var(--logic-lime, #D9F99D)';
  const surface  = 'var(--hud-surface, #111827)';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--pitch-black, #0A0A0A)',
        padding: '2rem',
        ...mono,
      }}
    >
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>

        {/* Back link */}
        <Link
          href={`/${orgSlug}/archives`}
          style={{ fontSize: '0.625rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: dataGray, textDecoration: 'none' }}
        >
          ← Archives
        </Link>

        {/* Header */}
        <div
          style={{
            borderBottom: `1px solid ${blue}`,
            paddingBottom: '1.25rem',
            marginBottom: '2rem',
            marginTop: '1.25rem',
          }}
        >
          <div style={hudLabel}>Sealed Record · {season}</div>
          <h1
            style={{
              fontFamily: 'var(--font-sans, Inter, sans-serif)',
              fontWeight: 800,
              fontSize: '1.75rem',
              textTransform: 'uppercase',
              letterSpacing: '-0.02em',
              color: flText,
              margin: '0.375rem 0',
            }}
          >
            {tournamentName}
          </h1>
          <div style={{ fontSize: '0.6875rem', color: dataGray, display: 'flex', gap: '1rem', flexWrap: 'wrap' as const }}>
            <span>Sealed: {sealedDate}</span>
            <span style={{ color: 'rgba(148,163,184,0.4)' }}>·</span>
            <span>
              Hash: {shortHash}
              {' '}
              <span
                style={{
                  fontSize: '0.5625rem',
                  border: `1px solid rgba(217,249,157,0.4)`,
                  color: lime,
                  padding: '0.0625rem 0.3125rem',
                  letterSpacing: '0.06em',
                  marginLeft: '0.25rem',
                }}
              >
                VERIFIED
              </span>
            </span>
          </div>
        </div>

        {/* Champion block */}
        {(archive.winnerTeamName || archive.runnerUpName) && (
          <div
            style={{
              background: surface,
              border: `1px solid ${lime}`,
              boxShadow: `0 0 16px rgba(217,249,157,0.25)`,
              padding: '1.5rem',
              marginBottom: '2rem',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1.5rem',
            }}
          >
            <div>
              <div style={hudLabel}>Division Champion</div>
              <div
                style={{
                  fontSize: '1.75rem',
                  fontWeight: 700,
                  color: lime,
                  marginTop: '0.375rem',
                  letterSpacing: '-0.02em',
                }}
              >
                {archive.winnerTeamName ?? '—'}
              </div>
            </div>
            {archive.runnerUpName && (
              <div>
                <div style={hudLabel}>Runner-Up</div>
                <div
                  style={{
                    fontSize: '1.125rem',
                    fontWeight: 600,
                    color: flText,
                    marginTop: '0.375rem',
                  }}
                >
                  {archive.runnerUpName}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Standings — per age group, from snapshot */}
        {ageGroups.length > 0 && poolGames.length > 0 && (
          <section style={{ marginBottom: '2.5rem' }}>
            <div
              style={{
                ...hudLabel,
                fontSize: '0.6875rem',
                color: dataGray,
                marginBottom: '1rem',
              }}
            >
              Pool Play Standings
            </div>
            {ageGroups.map(ag => {
              const standings = computeStandings(teams, games, ag.id);
              if (standings.length === 0) return null;
              return (
                <div key={ag.id} style={{ marginBottom: '1.5rem' }}>
                  <div
                    style={{
                      ...hudLabel,
                      color: blue,
                      marginBottom: '0.5rem',
                      borderBottom: `1px solid rgba(30,58,138,0.3)`,
                      paddingBottom: '0.25rem',
                    }}
                  >
                    {ag.name}
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                    <thead>
                      <tr style={{ color: dataGray, fontSize: '0.5625rem', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
                        <th style={{ textAlign: 'left', paddingBottom: '0.375rem', paddingRight: '1rem' }}>Team</th>
                        <th style={{ textAlign: 'center', paddingBottom: '0.375rem', paddingRight: '0.5rem' }}>GP</th>
                        <th style={{ textAlign: 'center', paddingBottom: '0.375rem', paddingRight: '0.5rem' }}>W</th>
                        <th style={{ textAlign: 'center', paddingBottom: '0.375rem', paddingRight: '0.5rem' }}>L</th>
                        <th style={{ textAlign: 'center', paddingBottom: '0.375rem', paddingRight: '0.5rem' }}>T</th>
                        <th style={{ textAlign: 'center', paddingBottom: '0.375rem', paddingRight: '0.5rem' }}>PTS</th>
                        <th style={{ textAlign: 'center', paddingBottom: '0.375rem', paddingRight: '0.5rem' }}>RF</th>
                        <th style={{ textAlign: 'center', paddingBottom: '0.375rem' }}>RA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((s, idx) => (
                        <tr
                          key={s.teamId}
                          style={{
                            borderBottom: '1px solid rgba(30,58,138,0.15)',
                            background: idx === 0 ? 'rgba(217,249,157,0.04)' : 'transparent',
                          }}
                        >
                          <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: idx === 0 ? lime : flText, fontWeight: idx === 0 ? 700 : 400 }}>
                            {idx === 0 && (
                              <span style={{ color: lime, marginRight: '0.375rem', fontSize: '0.5625rem' }}>★</span>
                            )}
                            {s.teamName}
                          </td>
                          <td style={{ textAlign: 'center', padding: '0.5rem', color: dataGray }}>{s.gp}</td>
                          <td style={{ textAlign: 'center', padding: '0.5rem', color: flText }}>{s.w}</td>
                          <td style={{ textAlign: 'center', padding: '0.5rem', color: flText }}>{s.l}</td>
                          <td style={{ textAlign: 'center', padding: '0.5rem', color: flText }}>{s.t}</td>
                          <td style={{ textAlign: 'center', padding: '0.5rem', color: lime, fontWeight: 700 }}>{s.pts}</td>
                          <td style={{ textAlign: 'center', padding: '0.5rem', color: dataGray }}>{s.rf}</td>
                          <td style={{ textAlign: 'center', padding: '0.5rem', color: dataGray }}>{s.ra}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </section>
        )}

        {/* Playoff bracket results */}
        {playoffGames.length > 0 && (
          <section style={{ marginBottom: '2.5rem' }}>
            <div style={{ ...hudLabel, fontSize: '0.6875rem', color: dataGray, marginBottom: '1rem' }}>
              Playoff Results
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.5rem' }}>
              {playoffGames.map(g => {
                const hScore = g.homeScore ?? 0;
                const aScore = g.awayScore ?? 0;
                const homeWon = hScore > aScore;
                return (
                  <div
                    key={g.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '80px 1fr auto auto 1fr',
                      gap: '0.75rem',
                      alignItems: 'center',
                      borderBottom: '1px solid rgba(30,58,138,0.15)',
                      padding: '0.5rem 0',
                      fontSize: '0.75rem',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.5625rem',
                        letterSpacing: '0.08em',
                        color: blue,
                        fontWeight: 700,
                      }}
                    >
                      {g.bracketCode ?? 'PLAYOFF'}
                    </span>
                    <span
                      style={{
                        color: homeWon ? lime : dataGray,
                        fontWeight: homeWon ? 700 : 400,
                        textAlign: 'right' as const,
                      }}
                    >
                      {teamName(g.homeTeamId)}
                    </span>
                    <span
                      style={{
                        color: flText,
                        fontWeight: 700,
                        minWidth: '3rem',
                        textAlign: 'center' as const,
                      }}
                    >
                      {hScore} – {aScore}
                    </span>
                    <span style={{ color: 'rgba(148,163,184,0.3)', fontSize: '0.5rem' }}>vs</span>
                    <span
                      style={{
                        color: !homeWon ? lime : dataGray,
                        fontWeight: !homeWon ? 700 : 400,
                      }}
                    >
                      {teamName(g.awayTeamId)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Pool play results */}
        {poolGames.length > 0 && (
          <section style={{ marginBottom: '2.5rem' }}>
            <div style={{ ...hudLabel, fontSize: '0.6875rem', color: dataGray, marginBottom: '1rem' }}>
              Pool Play Results
            </div>
            {ageGroups.map(ag => {
              const agGames = poolGames.filter(g => g.ageGroupId === ag.id);
              if (agGames.length === 0) return null;
              return (
                <div key={ag.id} style={{ marginBottom: '1.25rem' }}>
                  <div
                    style={{
                      ...hudLabel,
                      color: blue,
                      marginBottom: '0.5rem',
                      borderBottom: '1px solid rgba(30,58,138,0.3)',
                      paddingBottom: '0.25rem',
                    }}
                  >
                    {ag.name}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.375rem' }}>
                    {agGames.map(g => {
                      const hScore = g.homeScore ?? 0;
                      const aScore = g.awayScore ?? 0;
                      const homeWon = hScore > aScore;
                      return (
                        <div
                          key={g.id}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '80px 1fr 60px 1fr 100px',
                            gap: '0.5rem',
                            alignItems: 'center',
                            fontSize: '0.6875rem',
                            borderBottom: '1px solid rgba(30,58,138,0.1)',
                            padding: '0.375rem 0',
                          }}
                        >
                          <span style={{ color: dataGray, fontSize: '0.5625rem' }}>{formatDate(g.date)}</span>
                          <span style={{ color: homeWon ? lime : flText, fontWeight: homeWon ? 700 : 400, textAlign: 'right' as const }}>
                            {teamName(g.homeTeamId)}
                          </span>
                          <span style={{ color: flText, fontWeight: 700, textAlign: 'center' as const }}>
                            {hScore} – {aScore}
                          </span>
                          <span style={{ color: !homeWon ? lime : flText, fontWeight: !homeWon ? 700 : 400 }}>
                            {teamName(g.awayTeamId)}
                          </span>
                          <span style={{ color: dataGray, fontSize: '0.5625rem', textAlign: 'right' as const }}>
                            {formatTime(g.time)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* Footer integrity strip */}
        <div
          style={{
            borderTop: '1px solid rgba(30,58,138,0.2)',
            paddingTop: '1.25rem',
            marginTop: '1rem',
            fontSize: '0.5625rem',
            color: 'rgba(148,163,184,0.4)',
            letterSpacing: '0.08em',
            wordBreak: 'break-all' as const,
          }}
        >
          SHA-256: {integrityHash}
        </div>

      </div>
    </div>
  );
}
