import Link from 'next/link';
import { orgLinks } from '@/lib/org-links';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { forwardToOwnAddress } from '@/lib/club-forward';
import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getArchiveById } from '@/lib/db';
import { requirePublicClubPage } from '@/lib/public-club-page';
import { clubPageMetadata } from '@/lib/club-page-meta';
import kit from '@/components/public/ClubKit.module.css';
import parts from '@/components/public/PublicParts.module.css';
import PublicPage from '@/components/public/PublicPage';
import PublicSectionHead from '@/components/public/PublicSectionHead';
import { ScheduleMatchup, type MatchupSide } from '@/components/public/PublicGameRow';
import { formatShortWeekdayDate } from '@/lib/timezone';
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
  }, { path: `/archives/${archiveId}` });
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
  await forwardToOwnAddress(orgSlug, `/archives/${archiveId}`);
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
  // "Pool play standings" with one division; "Pool play standings · U11" with several.
  const titled = (words: string, division: string) => divisions.length > 1 ? `${words} · ${division}` : words;
  // No tab row without the public site (a Tournament-plan org): the tab is not there to be the way back, so the page
  // keeps one, to the list this record sits on (review 2026-10-25).
  const backToList = !hasModuleEntitlement(org, 'module_public_site') ? (await orgLinks(orgSlug))('/tournaments#past') : null;

  return (
    // The club page column (club round C2 + C5): on the logo edge, 960 at most (it was a 1,000 px block in .container,
    // 24 from a phone's edge), 24 between sections.
    <PublicPage frame="club">
      {/* No "← Past tournaments" (Stage 4f, Ask 6): the Tournaments tab is lit here and is the way back, the rule the
          About page follows (no back link where the tab row goes). Where there is no tab row, one link back. */}
      {backToList && (
        <Link href={backToList} className={kit.back} style={{ marginBottom: 0, alignSelf: 'flex-start' }}>
          ← Tournaments
        </Link>
      )}

      {/* A page about one thing keeps its name at 24 (club round C4): the season over it, "Results final" under it. */}
      <div className={kit.nameBlock}>
        <div className={kit.band} style={{ marginBottom: 0 }}>{season}</div>
        <h1 className={kit.pageName}>{tournamentName}</h1>
        <p className={kit.sub}>Results final {sealedDate}</p>
      </div>

      {/* Champion block */}
      {(archive.winnerTeamName || archive.runnerUpName) && (
        <div
          className={kit.card}
          style={{
            padding: '1.5rem',
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
      {/* One section per division, each with the standard heading row (R4) — "Pool play standings · U11" when there are
          several, as the tournament's own Final standings say it. The table keeps its look (tables are a registered
          exception, R10). */}
      {divisions.length > 0 && poolGames.length > 0 && divisions.map(ag => {
            const standings = computeStandings(teams, games, ag.id);
            if (standings.length === 0) return null;
            return (
              <section key={ag.id} className={kit.section}>
                <PublicSectionHead title={titled('Pool play standings', ag.name)} />
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
              </section>
            );
          })}

      {/* The results on the standard's game row (R6; club round Part 4, owner 2026-11-05): one line on a desk, stacked on a
          phone — they were hand-made rows held 520–560 px wide, so a phone scrolled them sideways. Every game here is
          sealed, so each reads Final, the away team first, the winner bold. */}
      {playoffGames.length > 0 && (
        <section className={kit.section}>
          <PublicSectionHead title="Playoff results" />
          <ul className={`${kit.list} ${parts.gameList}`}>
            {playoffGames.map(g => (
              <ResultRow key={g.id} game={g} teamName={teamName}
                context={divisions.length > 1 ? divisions.find(d => d.id === g.divisionId)?.name ?? null : null}
                round={bracketRoundLabel(g.bracketCode)} />
            ))}
          </ul>
        </section>
      )}

      {divisions.map(ag => {
        const agGames = poolGames.filter(g => g.divisionId === ag.id);
        if (agGames.length === 0) return null;
        return (
          <section key={ag.id} className={kit.section}>
            <PublicSectionHead title={titled('Pool play results', ag.name)} />
            <ul className={`${kit.list} ${parts.gameList}`}>
              {agGames.map(g => <ResultRow key={g.id} game={g} teamName={teamName} context={null} round={null} />)}
            </ul>
          </section>
        );
      })}
    </PublicPage>
  );
}

/** One sealed game on the standard's game row: the time, the day under it (or in the context line on a phone), the round
 *  and division at the right, the away team first, both scores, the winner bold. */
function ResultRow({ game: g, teamName, context, round }: {
  game: Game; teamName: (id: string) => string; context: string | null; round: string | null;
}) {
  const scored = g.homeScore != null && g.awayScore != null;
  const side = (id: string, score: number | null, other: number | null): MatchupSide => ({
    name: teamName(id),
    score,
    result: scored && score != null && other != null ? (score > other ? 'win' : score < other ? 'lose' : null) : null,
  });
  return (
    <li>
      <ScheduleMatchup
        time={g.time ? formatTime(g.time) : 'TBD'}
        round={g.date ? formatShortWeekdayDate(g.date) : null}
        division={context}
        pool={round}
        state="final"
        sides={[side(g.awayTeamId, g.awayScore ?? null, g.homeScore ?? null), side(g.homeTeamId, g.homeScore ?? null, g.awayScore ?? null)]}
      />
    </li>
  );
}
