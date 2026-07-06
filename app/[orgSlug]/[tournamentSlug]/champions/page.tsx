import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Trophy, ChevronRight, Crown } from 'lucide-react';
import {
  getOrganizationBySlug,
  getPublicTournamentBySlug,
  getGames,
  getTeams,
  getDivisions,
  getStandings,
} from '@/lib/db';
import { toPublicTeam } from '@/lib/public-tournament-data';
import { deriveTierChampions, isTournamentPlayoffsComplete } from '@/lib/champions';
import type { DivisionStandingRow } from '@/lib/tie-breakers';
import { isPublicPageEnabled } from '@/lib/public-pages';
import { formatPoolName } from '@/lib/utils';
import PublicTournamentState from '@/components/public/PublicTournamentState';
import SharePageButton from '@/components/public/SharePageButton';
import styles from '@/components/public/ChampionsRecap.module.css';

export const dynamic = 'force-dynamic';

export default async function ChampionsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string }>;
}) {
  const { orgSlug, tournamentSlug } = await params;
  const org = await getOrganizationBySlug(orgSlug);
  if (!org || org.subscriptionStatus === 'canceled') notFound();
  const tournament = await getPublicTournamentBySlug(org.id, tournamentSlug);
  if (!tournament) notFound();

  const publicBase = `/${orgSlug}/${tournamentSlug}`;

  // The Champions recap shows final results + closing standings, so it inherits the
  // Standings page's visibility — an organizer who hid Standings must not have the final
  // results leaked through this URL (same rule as the Playoff Picture).
  if (!isPublicPageEnabled(tournament, 'standings')) {
    return (
      <div className="page-content">
        <div className="section">
          <div className="container">
            <PublicTournamentState
              icon={<Trophy size={40} />}
              eyebrow="Champions"
              title="Final results unavailable"
              description="The organizer has hidden results and standings for this tournament."
              actions={[{ href: publicBase, label: 'Tournament Home', variant: 'ghost' as const }]}
            />
          </div>
        </div>
      </div>
    );
  }

  const readOptions = { admin: true } as const;
  const [allGames, allTeams, divisions] = await Promise.all([
    getGames(tournament.id, readOptions),
    getTeams(tournament.id, readOptions),
    getDivisions(tournament.id, readOptions),
  ]);
  const teams = allTeams
    .filter(t => t.status === 'accepted')
    .map(t => toPublicTeam(t, tournament.coachNamesShowOnPublic === true));
  const sortedDivisions = [...divisions].sort((a, b) => a.order - b.order);

  const tierChampions = deriveTierChampions(allGames, teams, sortedDivisions);
  const showSchedule = isPublicPageEnabled(tournament, 'schedule');

  // Only crown once the WHOLE tournament's playoffs are complete — same gate as the
  // home hero and the one-time announcement. This stops the recap from surfacing a
  // winner from a final that's been score-entered but not yet finalized ('submitted').
  const playoffsComplete = isTournamentPlayoffsComplete(allGames, sortedDivisions);

  if (!playoffsComplete || tierChampions.length === 0) {
    return (
      <div className="page-content">
        <div className="section">
          <div className="container">
            <PublicTournamentState
              icon={<Trophy size={40} />}
              eyebrow="Champions"
              title="No champions crowned yet"
              description="Once the playoff finals are decided, the champion(s) and final results will appear here."
              actions={[
                { href: `${publicBase}/playoffs`, label: 'Playoff Picture', variant: 'ghost' as const },
                { href: publicBase, label: 'Tournament Home', variant: 'ghost' as const },
              ]}
            />
          </div>
        </div>
      </div>
    );
  }

  // Final standings per division.
  const standingsEntries = await Promise.all(
    sortedDivisions.map(async d => [
      d.id,
      await getStandings(d.id, d.playoffConfig, readOptions, tournament.settings),
    ] as const),
  );
  const standingsByDivision = Object.fromEntries(standingsEntries) as Record<string, DivisionStandingRow[]>;

  const multiDivision = sortedDivisions.length > 1;
  const topChampions = tierChampions.filter(c => c.isTopTier);
  const heroTitle = topChampions.length === 1 ? topChampions[0].champion : 'Champions';
  const shareText = `${topChampions
    .map(c => `${c.champion}${multiDivision ? ` (${c.division})` : ''}`)
    .join(', ')} — ${topChampions.length > 1 ? 'Champions' : 'Champion'}`;

  const tierBadge = (tierLabel: string | null, isTopTier: boolean) => {
    if (isTopTier) return tierLabel ? `${tierLabel} · Champion` : 'Champion';
    return tierLabel ? `${tierLabel} Champion` : 'Champion';
  };

  return (
    <div className="page-content">
      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroBg} aria-hidden="true" />
        <div className={`container ${styles.heroInner}`}>
          <span className={styles.heroEyebrow}><Trophy size={13} /> Champions</span>
          <h1 className={styles.heroTitle}>{heroTitle}</h1>
          <p className={styles.heroSub}>{tournament.name} — the final results are in. Congratulations to every team that competed.</p>
          <div className={styles.heroActions}>
            <SharePageButton
              url={`${publicBase}/champions`}
              title={`${tournament.name} — ${topChampions.length > 1 ? 'Champions' : 'Champion'}`}
              text={shareText}
              label="Share results"
              className="btn btn-primary btn-sm"
            />
            <Link href={`${publicBase}/standings`} className="btn btn-outline btn-sm">
              Full Standings <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="container">
          <div className={styles.divisionStack}>
            {sortedDivisions.map(div => {
              const champs = tierChampions.filter(c => c.division === div.name);
              if (champs.length === 0) return null;
              const rows = standingsByDivision[div.id] ?? [];
              const multiPool = (div.pools?.length ?? 0) >= 2;
              const poolNameOf = (poolId?: string) => div.pools?.find(p => p.id === poolId)?.name;

              return (
                <section key={div.id} className={styles.division}>
                  <header className={styles.divisionHeader}>
                    <div>
                      <span className={styles.divisionKicker}>Final Results</span>
                      <h2 className={styles.divisionName}>{div.name}</h2>
                    </div>
                  </header>

                  {/* Champion(s) — top tier first, headlined; lower tiers beneath. */}
                  <div className={styles.championList}>
                    {champs.map((c, i) => (
                      <div
                        key={`${c.division}-${c.tierLabel ?? 'single'}-${i}`}
                        className={`${styles.championCard} ${c.isTopTier ? styles.championTop : ''}`}
                      >
                        <span className={styles.crown}><Crown size={c.isTopTier ? 26 : 20} /></span>
                        <div className={styles.championBody}>
                          <span className={styles.tierBadge}>{tierBadge(c.tierLabel, c.isTopTier)}</span>
                          <span className={styles.championName}>{c.champion}</span>
                          {c.runnerUp && (
                            <span className={styles.championMeta}>
                              Defeated {c.runnerUp}
                              {c.championScore != null && c.runnerUpScore != null && (
                                <> <strong>{c.championScore}–{c.runnerUpScore}</strong></>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Final standings */}
                  {rows.length > 0 && (
                    <div className={styles.standingsBlock}>
                      <h3 className={styles.blockTitle}>Final Standings</h3>
                      <ol className={styles.standingsList}>
                        {rows.map((r, idx) => (
                          <li key={r.teamId} className={idx === 0 ? styles.rankFirst : undefined}>
                            <div className={styles.standingsRow}>
                              <span className={styles.rankNum}>{idx + 1}</span>
                              <span className={styles.rankName}>
                                {r.teamName}
                                {multiPool && poolNameOf(r.poolId) ? (
                                  <span className={styles.rankPool}>{formatPoolName(poolNameOf(r.poolId)!)}</span>
                                ) : null}
                              </span>
                              <span className={styles.rankRecord}>{r.w}-{r.l}-{r.t}</span>
                              <span className={r.rdRaw > 0 ? styles.rankRdPos : r.rdRaw < 0 ? styles.rankRdNeg : styles.rankRd}>
                                {r.rdRaw > 0 ? `+${r.rdRaw}` : r.rdRaw}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          <div className={styles.footerActions}>
            <Link href={`${publicBase}/standings`} className="btn btn-primary">
              Full standings <ChevronRight size={16} />
            </Link>
            {showSchedule && (
              <Link href={`${publicBase}/schedule`} className="btn btn-outline">
                Game results <ChevronRight size={16} />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
