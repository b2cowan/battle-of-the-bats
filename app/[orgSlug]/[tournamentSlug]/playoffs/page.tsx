import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Trophy, ChevronRight, Crown, Flame, Shield, Swords, Calendar, MapPin } from 'lucide-react';
import {
  getOrganizationBySlug,
  getPublicTournamentBySlug,
  getGames,
  getTeams,
  getDivisions,
  getVenues,
  getStandings,
} from '@/lib/db';
import { toPublicTeam } from '@/lib/public-tournament-data';
import { resolveGameVenueLabel } from '@/lib/venue-label';
import { buildPlayoffPicture, type PlayoffStatCallout } from '@/lib/playoff-picture';
import type { DivisionStandingRow } from '@/lib/tie-breakers';
import { isPublicPageEnabled } from '@/lib/public-pages';
import { formatTime, formatPoolName, splitTeamQualifier } from '@/lib/utils';
import PublicTournamentState from '@/components/public/PublicTournamentState';
import SharePageButton from '@/components/public/SharePageButton';
import styles from '@/components/public/PlayoffPicture.module.css';
// Canonical soft LIVE chip — same classes the schedule + game-detail pages use.
import liveStyles from '@/app/[orgSlug]/schedule/schedule.module.css';

export const dynamic = 'force-dynamic';

function calloutIcon(label: string) {
  if (label === 'Top seed') return <Crown size={15} />;
  if (label === 'Best offense') return <Flame size={15} />;
  if (label === 'Stingiest defense') return <Shield size={15} />;
  return <Swords size={15} />;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return null;
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-CA', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

export default async function PlayoffsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string }>;
}) {
  const { orgSlug, tournamentSlug } = await params;
  const org = await getOrganizationBySlug(orgSlug);
  if (!org || org.subscriptionStatus === 'canceled') notFound();
  const tournament = await getPublicTournamentBySlug(org.id, tournamentSlug);
  if (!tournament) notFound();

  const publicBaseEarly = `/${orgSlug}/${tournamentSlug}`;
  // The Playoff Picture is a seeding/standings view, so it inherits the Standings
  // page's visibility — an organizer who hid Standings must not have the seeding
  // leaked through this URL.
  if (!isPublicPageEnabled(tournament, 'standings')) {
    return (
      <div className="page-content">
        <div className="section">
          <div className="container">
            <PublicTournamentState
              icon={<Trophy size={40} />}
              eyebrow="Playoff Picture"
              title="Playoff Picture unavailable"
              description="The organizer has hidden results and standings for this tournament."
              actions={[{ href: publicBaseEarly, label: 'Tournament Home', variant: 'ghost' as const }]}
            />
          </div>
        </div>
      </div>
    );
  }

  const readOptions = { admin: true } as const;
  const [allGames, allTeams, divisions, venues] = await Promise.all([
    getGames(tournament.id, readOptions),
    getTeams(tournament.id, readOptions),
    getDivisions(tournament.id, readOptions),
    getVenues(tournament.id, { ...readOptions, includeFacilities: true }),
  ]);
  const teams = allTeams
    .filter(t => t.status === 'accepted')
    .map(t => toPublicTeam(t, tournament.coachNamesShowOnPublic === true));

  const standingsEntries = await Promise.all(
    divisions.map(async d => [
      d.id,
      await getStandings(d.id, d.playoffConfig, readOptions, tournament.settings),
    ] as const),
  );
  const standingsByDivision = Object.fromEntries(standingsEntries) as Record<string, DivisionStandingRow[]>;

  const getTeamName = (id?: string | null) => (id ? teams.find(t => t.id === id)?.name ?? 'TBD' : 'TBD');
  const picture = buildPlayoffPicture(
    tournament, divisions, teams, allGames, standingsByDivision,
    getTeamName,
    g => resolveGameVenueLabel(g, venues),
  );

  const publicBase = `/${orgSlug}/${tournamentSlug}`;
  const showStandings = isPublicPageEnabled(tournament, 'standings');
  const showSchedule = isPublicPageEnabled(tournament, 'schedule');

  if (!picture.hasPlayoffs) {
    return (
      <div className="page-content">
        <div className="section">
          <div className="container">
            <PublicTournamentState
              icon={<Trophy size={40} />}
              eyebrow="Playoff Picture"
              title="The bracket isn't set yet"
              description="Once the organizer sets the playoff bracket, the seeding, matchups, and key numbers will appear here."
              actions={[
                ...(showStandings ? [{ href: `${publicBase}/standings`, label: 'View Standings', variant: 'ghost' as const }] : []),
                { href: publicBase, label: 'Tournament Home', variant: 'ghost' as const },
              ]}
            />
          </div>
        </div>
      </div>
    );
  }

  const shareText = picture.divisions
    .map(d => (d.seeds[0] ? `${d.divisionName}: ${d.seeds[0].teamName} #1 seed` : d.divisionName))
    .join(' · ');

  return (
    <div className="page-content">
      {/* Hero — desktop/tablet only. On the mobile LIVE shell the unified event header
          (G3) already owns identity, so this poster would replay Home's headline one tap
          later (C2); it retires ≤900px in favor of the quiet page kicker below. */}
      <div className={styles.hero}>
        <div className={styles.heroBg} aria-hidden="true" />
        <div className={`container ${styles.heroInner}`}>
          <span className={styles.heroEyebrow}><Trophy size={13} /> Playoff Picture</span>
          <h1 className={styles.heroTitle}>The Bracket Is Set</h1>
          <p className={styles.heroSub}>{tournament.name} — here&apos;s the seeding, who plays who, and the numbers that got them there.</p>
          <div className={styles.heroActions}>
            <SharePageButton
              url={`${publicBase}/playoffs`}
              title={`${tournament.name} — Playoff Picture`}
              text={shareText}
              label="Share the bracket"
              className="btn btn-primary btn-sm"
            />
            {showStandings && (
              <Link href={`${publicBase}/standings`} className="btn btn-outline btn-sm">
                Full Bracket <ChevronRight size={14} />
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="section">
        <div className="container">
          {/* Mobile stand-in for the retired hero: a quiet kicker that never echoes
              Home's headline — the page is what its button promised. */}
          <p className={styles.pageKicker}><Trophy size={12} /> Seeding &amp; Matchups</p>
          <div className={styles.divisionStack}>
            {picture.divisions.map(div => (
              <section key={div.divisionId} className={styles.division}>
                <header className={styles.divisionHeader}>
                  <div>
                    <span className={styles.divisionKicker}>{div.formatLabel}{div.teamsQualifying > 0 ? ` · Top ${div.teamsQualifying} advance` : ''}</span>
                    <h2 className={styles.divisionName}>{div.divisionName}</h2>
                  </div>
                </header>

                {/* Narrative */}
                <div className={styles.narrative}>
                  {div.narrative.map((line, i) => (
                    <p key={i} className={i === 0 ? styles.narrativeLede : undefined}>{line}</p>
                  ))}
                </div>

                {/* Key-stat callouts — compress to a one-row strip on phones (R2-2) */}
                {div.callouts.length > 0 && (
                  <div className={styles.calloutGrid}>
                    {div.callouts.map((c: PlayoffStatCallout) => {
                      const cq = splitTeamQualifier(c.teamName);
                      return (
                        <div key={c.label} className={styles.calloutCard}>
                          <span className={styles.calloutIcon}>{calloutIcon(c.label)}</span>
                          <div className={styles.calloutBody}>
                            <span className={styles.calloutLabel}>{c.label}</span>
                            <strong className={styles.calloutTeam}>
                              {cq.base}
                              {cq.qualifier && <span className={styles.nameQualifier}> ({cq.qualifier})</span>}
                            </strong>
                            <span className={styles.calloutValue}>{c.value}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Seed list */}
                <div className={styles.seedBlock}>
                  <h3 className={styles.blockTitle}>Seeding</h3>
                  <ol className={styles.seedList}>
                    {div.seeds.map((s, idx) => {
                      const cut = div.teamsQualifying > 0 && div.gamesStarted && idx === div.teamsQualifying;
                      // Trailing "(Coach)" qualifier drops to a quiet second line with
                      // the pool — rows stop wrapping at full name weight (D3).
                      const sq = splitTeamQualifier(s.teamName);
                      const seedSub = [sq.qualifier, s.poolName ? formatPoolName(s.poolName) : null]
                        .filter(Boolean).join(' · ');
                      return (
                        <li key={s.teamId} className={styles.seedRowWrap}>
                          {cut && (
                            <div className={styles.cutLine}>
                              <span>Playoff cut · top {div.teamsQualifying} advance</span>
                            </div>
                          )}
                          <div className={`${styles.seedRow} ${s.qualified ? styles.seedQualified : ''}`}>
                            <span className={styles.seedNum}>{s.seed}</span>
                            <span className={styles.seedName}>
                              <span className={styles.seedTeam}>{sq.base}</span>
                              {seedSub && <span className={styles.seedSub}>{seedSub}</span>}
                            </span>
                            <span className={styles.seedRecord}>{s.w}-{s.l}-{s.t}</span>
                            <span className={s.rdRaw > 0 ? styles.seedRdPos : s.rdRaw < 0 ? styles.seedRdNeg : styles.seedRd}>
                              {s.rdRaw > 0 ? `+${s.rdRaw}` : s.rdRaw}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>

                {/* Matchups — locked/live games, then today's still-undecided rounds (A7) */}
                {(div.matchups.length > 0 || div.pending.length > 0) && (
                  <div className={styles.matchupBlock}>
                    <h3 className={styles.blockTitle}>{div.pending.length > 0 ? 'Matchups' : 'Opening matchups'}</h3>
                    <div className={styles.matchupGrid}>
                      {div.matchups.map(m => {
                        // While live: running score stays, winner/loser verdicts wait for the final.
                        const decided = !m.isLive;
                        return (
                        <div key={m.key} className={styles.matchupCard}>
                          <div className={styles.matchupTop}>
                            <span className="badge badge-primary">{m.bracketLabel ? `${m.bracketLabel} · ${m.roundLabel}` : m.roundLabel}</span>
                            {m.isLive && <span className={liveStyles.liveBadge}><span className={liveStyles.liveDot} />LIVE</span>}
                            {m.status === 'completed' && <span className={styles.matchupFinal}>Final</span>}
                          </div>
                          <div className={styles.matchupTeams}>
                            <div className={`${styles.matchupTeam} ${decided && m.away.isWinner ? styles.matchupWin : decided && m.home.isWinner ? styles.matchupLose : ''}`}>
                              {m.away.seed != null && <span className={styles.matchupSeed}>{m.away.seed}</span>}
                              <span className={styles.matchupName}>{m.away.name}</span>
                              {m.away.score != null && <span className={styles.matchupScore}>{m.away.score}</span>}
                            </div>
                            <div className={`${styles.matchupTeam} ${decided && m.home.isWinner ? styles.matchupWin : decided && m.away.isWinner ? styles.matchupLose : ''}`}>
                              {m.home.seed != null && <span className={styles.matchupSeed}>{m.home.seed}</span>}
                              <span className={styles.matchupName}>{m.home.name}</span>
                              {m.home.score != null && <span className={styles.matchupScore}>{m.home.score}</span>}
                            </div>
                          </div>
                          {(m.date || m.venueLabel) && (
                            <div className={styles.matchupMeta}>
                              {m.date && <span><Calendar size={12} /> {formatDate(m.date)}{m.time ? ` · ${formatTime(m.time)}` : ''}</span>}
                              {m.venueLabel && <span><MapPin size={12} /> {m.venueLabel}</span>}
                            </div>
                          )}
                        </div>
                        );
                      })}
                      {/* Today's unresolved games — the championship is on the page while its
                          feeders play. Honest words, real time and place, no bracket codes;
                          flips into a normal matchup card once the feeders decide. */}
                      {div.pending.map(p => (
                        <div key={p.key} className={`${styles.matchupCard} ${styles.matchupPending}`}>
                          <div className={styles.matchupTop}>
                            <span className="badge badge-primary">{p.bracketLabel ? `${p.bracketLabel} · ${p.roundLabel}` : p.roundLabel}</span>
                            <span className="badge badge-info">Pending</span>
                          </div>
                          <div className={styles.pendingTime}>{p.dayLabel}{p.time ? ` · ${formatTime(p.time)}` : ''}</div>
                          <p className={styles.pendingFeeds}>{p.feedsFrom}</p>
                          {(p.date || p.venueLabel) && (
                            <div className={styles.matchupMeta}>
                              {p.date && <span><Calendar size={12} /> {formatDate(p.date)}</span>}
                              {p.venueLabel && <span><MapPin size={12} /> {p.venueLabel}</span>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            ))}
          </div>

          <div className={styles.footerActions}>
            {showStandings && (
              <Link href={`${publicBase}/standings`} className="btn btn-primary">
                See the full bracket <ChevronRight size={16} />
              </Link>
            )}
            {showSchedule && (
              <Link href={`${publicBase}/schedule`} className="btn btn-outline">
                Playoff schedule <ChevronRight size={16} />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
