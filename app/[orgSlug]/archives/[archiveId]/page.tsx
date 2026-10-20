import { cache } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getArchiveById } from '@/lib/db';
import { requirePublicClubPage } from '@/lib/public-club-page';
import { clubPageMetadata } from '@/lib/club-page-meta';
import kit from '@/components/public/ClubKit.module.css';
import { bracketRoundLabel } from '@/lib/playoff-bracket';
import type { Game, Team } from '@/lib/types';

// The archive row is large (it carries the whole frozen snapshot), so the title and the page share one read.
const getArchive = cache(getArchiveById);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string; archiveId: string }>;
}): Promise<Metadata> {
  const { orgSlug, archiveId } = await params;
  return clubPageMetadata(orgSlug, async club => {
    const archive = await getArchive(archiveId);
    return archive && archive.orgId === club.id ? archive.tournamentName : null;
  });
}

// Compute standings from a frozen snapshot — no live DB queries
function computeStandings(
  teams: Team[],
  games: Game[],
  divisionId: string
) {
  const groupTeams = teams.filter(t => t.divisionId === divisionId);
  const groupGames = games.filter(
    g => g.divisionId === divisionId && !g.isPlayoff &&
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

// One source for the clock — see formatTime in lib/utils.ts for why this is not local.
import { formatTime } from '@/lib/utils';

export default async function ArchiveDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; archiveId: string }>;
}) {
  const { orgSlug, archiveId } = await params;
  // The one rule (Club Tier Stage 4a, lib/public-club-access.ts); a refusal throws out of the Promise.all.
  const [org, archive] = await Promise.all([
    requirePublicClubPage(orgSlug, 'archives'),
    getArchive(archiveId),
  ]);
  if (!archive) notFound();
  // The archive is loaded by id alone — without this, any org's archive rendered under the name
  // in the URL (Club Tier Readiness F07).
  if (archive.orgId !== org.id) notFound();

  const { finalSnapshot: snap, tournamentName, season, sealedAt } = archive;
  const { divisions, teams, games } = snap;

  const playoffGames = games.filter(g => g.isPlayoff && g.status === 'completed');
  const poolGames    = games.filter(g => !g.isPlayoff && (g.status === 'completed' || g.status === 'submitted'));

  function teamName(id: string) {
    return teams.find(t => t.id === id)?.name ?? 'TBD';
  }

  const sealedDate = formatDate(sealedAt);

  return (
    // The pages' own column (`.container`): the club's bar takes the same edge, so the heading sits under its logo.
    <div className="container" style={{ paddingBlock: '2rem 5rem', fontFamily: 'var(--club-text-face)', color: 'var(--club-text)' }}>
      <div style={{ maxWidth: '1000px' }}>

        {/* Back link */}
        <Link href={`/${orgSlug}/archives`} className={kit.back} style={{ marginBottom: 0 }}>
          ← Past tournaments
        </Link>

        {/* Header */}
        <div
          style={{
            borderBottom: '1px solid var(--club-line)',
            paddingBottom: '1.25rem',
            marginBottom: '2rem',
            marginTop: '0.75rem',
          }}
        >
          <div className={kit.band} style={{ marginBottom: 0 }}>{season}</div>
          <h1 className={kit.title} style={{ margin: '0.375rem 0' }}>
            {tournamentName}
          </h1>
          <div style={{ fontSize: '0.875rem', color: 'var(--club-soft)' }}>
            Results final {sealedDate}
          </div>
        </div>

        {/* Champion block */}
        {(archive.winnerTeamName || archive.runnerUpName) && (
          <div
            className={kit.card}
            style={{
              padding: '1.5rem',
              marginBottom: '2rem',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1.5rem',
            }}
          >
            <div>
              <div className={kit.band} style={{ marginBottom: 0 }}>Division champion</div>
              <div
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: 'var(--club-text)',
                  marginTop: '0.375rem',
                }}
              >
                {archive.winnerTeamName ?? '—'}
              </div>
            </div>
            {archive.runnerUpName && (
              <div>
                <div className={kit.band} style={{ marginBottom: 0 }}>Runner-up</div>
                <div
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 600,
                    color: 'var(--club-text)',
                    marginTop: '0.375rem',
                  }}
                >
                  {archive.runnerUpName}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Standings — per division, from snapshot */}
        {divisions.length > 0 && poolGames.length > 0 && (
          <section style={{ marginBottom: '2.5rem' }}>
            <div className={kit.band} style={{ marginBottom: '1rem' }}>
              Pool play standings
            </div>
            {divisions.map(ag => {
              const standings = computeStandings(teams, games, ag.id);
              if (standings.length === 0) return null;
              return (
                <div key={ag.id} style={{ marginBottom: '1.5rem' }}>
                  <div
                    className={kit.band}
                    style={{
                      color: 'var(--club-text)',
                      marginBottom: '0.5rem',
                      borderBottom: '1px solid var(--club-line)',
                      paddingBottom: '0.25rem',
                    }}
                  >
                    {ag.name}
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr>
                          <th className={kit.band} style={{ paddingBottom: '0.375rem', textAlign: 'left', paddingRight: '1rem' }}>Team</th>
                          <th className={kit.band} style={{ paddingBottom: '0.375rem', textAlign: 'center', paddingRight: '0.5rem' }}>GP</th>
                          <th className={kit.band} style={{ paddingBottom: '0.375rem', textAlign: 'center', paddingRight: '0.5rem' }}>W</th>
                          <th className={kit.band} style={{ paddingBottom: '0.375rem', textAlign: 'center', paddingRight: '0.5rem' }}>L</th>
                          <th className={kit.band} style={{ paddingBottom: '0.375rem', textAlign: 'center', paddingRight: '0.5rem' }}>T</th>
                          <th className={kit.band} style={{ paddingBottom: '0.375rem', textAlign: 'center', paddingRight: '0.5rem' }}>PTS</th>
                          <th className={kit.band} style={{ paddingBottom: '0.375rem', textAlign: 'center', paddingRight: '0.5rem' }}>RF</th>
                          <th className={kit.band} style={{ paddingBottom: '0.375rem', textAlign: 'center' }}>RA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {standings.map((s, idx) => (
                          <tr key={s.teamId} style={{ borderBottom: '1px solid var(--club-line)' }}>
                            <td style={{ padding: '0.5rem 1rem 0.5rem 0', color: 'var(--club-text)', fontWeight: idx === 0 ? 700 : 400 }}>
                              {idx === 0 && (
                                <span style={{ color: 'var(--club-ink)', marginRight: '0.375rem', fontSize: '0.75rem' }}>★</span>
                              )}
                              {s.teamName}
                            </td>
                            <td style={{ textAlign: 'center', padding: '0.5rem', color: 'var(--club-soft)' }}>{s.gp}</td>
                            <td style={{ textAlign: 'center', padding: '0.5rem', color: 'var(--club-text)' }}>{s.w}</td>
                            <td style={{ textAlign: 'center', padding: '0.5rem', color: 'var(--club-text)' }}>{s.l}</td>
                            <td style={{ textAlign: 'center', padding: '0.5rem', color: 'var(--club-text)' }}>{s.t}</td>
                            <td style={{ textAlign: 'center', padding: '0.5rem', color: 'var(--club-text)', fontWeight: 700 }}>{s.pts}</td>
                            <td style={{ textAlign: 'center', padding: '0.5rem', color: 'var(--club-soft)' }}>{s.rf}</td>
                            <td style={{ textAlign: 'center', padding: '0.5rem', color: 'var(--club-soft)' }}>{s.ra}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* Playoff bracket results */}
        {playoffGames.length > 0 && (
          <section style={{ marginBottom: '2.5rem' }}>
            <div className={kit.band} style={{ marginBottom: '1rem' }}>
              Playoff results
            </div>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.5rem', minWidth: '520px' }}>
                {playoffGames.map(g => {
                  const hScore = g.homeScore ?? 0;
                  const aScore = g.awayScore ?? 0;
                  const homeWon = hScore > aScore;
                  return (
                    <div
                      key={g.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '96px 1fr auto auto 1fr',
                        gap: '0.75rem',
                        alignItems: 'center',
                        borderBottom: '1px solid var(--club-line)',
                        padding: '0.5rem 0',
                        fontSize: '0.875rem',
                      }}
                    >
                      <span style={{ fontSize: '0.75rem', color: 'var(--club-soft)', fontWeight: 700 }}>
                        {bracketRoundLabel(g.bracketCode)}
                      </span>
                      <span
                        style={{
                          color: homeWon ? 'var(--club-text)' : 'var(--club-soft)',
                          fontWeight: homeWon ? 700 : 400,
                          textAlign: 'right' as const,
                        }}
                      >
                        {teamName(g.homeTeamId)}
                      </span>
                      <span
                        style={{
                          color: 'var(--club-text)',
                          fontWeight: 700,
                          minWidth: '3rem',
                          textAlign: 'center' as const,
                        }}
                      >
                        {hScore} – {aScore}
                      </span>
                      <span style={{ color: 'var(--club-soft)', fontSize: '0.75rem' }}>vs</span>
                      <span
                        style={{
                          color: !homeWon ? 'var(--club-text)' : 'var(--club-soft)',
                          fontWeight: !homeWon ? 700 : 400,
                        }}
                      >
                        {teamName(g.awayTeamId)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Pool play results */}
        {poolGames.length > 0 && (
          <section style={{ marginBottom: '2.5rem' }}>
            <div className={kit.band} style={{ marginBottom: '1rem' }}>
              Pool play results
            </div>
            {divisions.map(ag => {
              const agGames = poolGames.filter(g => g.divisionId === ag.id);
              if (agGames.length === 0) return null;
              return (
                <div key={ag.id} style={{ marginBottom: '1.25rem' }}>
                  <div
                    className={kit.band}
                    style={{
                      color: 'var(--club-text)',
                      marginBottom: '0.5rem',
                      borderBottom: '1px solid var(--club-line)',
                      paddingBottom: '0.25rem',
                    }}
                  >
                    {ag.name}
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.375rem', minWidth: '560px' }}>
                      {agGames.map(g => {
                        const hScore = g.homeScore ?? 0;
                        const aScore = g.awayScore ?? 0;
                        const homeWon = hScore > aScore;
                        return (
                          <div
                            key={g.id}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '104px 1fr 60px 1fr 88px',
                              gap: '0.5rem',
                              alignItems: 'center',
                              fontSize: '0.875rem',
                              borderBottom: '1px solid var(--club-line)',
                              padding: '0.375rem 0',
                            }}
                          >
                            <span style={{ color: 'var(--club-soft)', fontSize: '0.75rem' }}>{formatDate(g.date)}</span>
                            <span style={{ color: 'var(--club-text)', fontWeight: homeWon ? 700 : 400, textAlign: 'right' as const }}>
                              {teamName(g.homeTeamId)}
                            </span>
                            <span style={{ color: 'var(--club-text)', fontWeight: 700, textAlign: 'center' as const }}>
                              {hScore} – {aScore}
                            </span>
                            <span style={{ color: 'var(--club-text)', fontWeight: !homeWon ? 700 : 400 }}>
                              {teamName(g.awayTeamId)}
                            </span>
                            <span style={{ color: 'var(--club-soft)', fontSize: '0.75rem', textAlign: 'right' as const }}>
                              {formatTime(g.time)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        )}

      </div>
    </div>
  );
}
