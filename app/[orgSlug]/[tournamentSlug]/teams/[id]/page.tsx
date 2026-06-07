'use client';
import { useState, useEffect, use, type CSSProperties } from 'react';
import Link from 'next/link';
import { ChevronLeft, Star, AlertTriangle, Users, Clock } from 'lucide-react';
import { formatTime } from '@/lib/utils';
import { teamColor, teamInitials } from '@/lib/team-color';
import SharePageButton from '@/components/public/SharePageButton';
import styles from '../../../../teams/[id]/team-profile.module.css';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TeamProfileData {
  team: {
    id: string;
    name: string;
    coach: string;
    divisionId: string;
    poolId?: string;
  };
  divisionName: string;
  poolName: string | null;
  gameDurationMinutes: number;
  standings: {
    w: number; l: number; t: number;
    pts: number; rf: number; ra: number; rd: number;
    poolRank: number | null;
    poolRankLabel: string | null;
    inPlayoffSpot: boolean;
  };
  games: {
    id: string;
    homeTeamId: string;
    awayTeamId: string;
    homeTeamName: string;
    awayTeamName: string;
    date: string;
    time: string;
    location: string;
    homeScore?: number | null;
    awayScore?: number | null;
    status: string;
    isPlayoff?: boolean;
    homePlaceholder?: string;
    awayPlaceholder?: string;
  }[];
}

// ── localStorage follow helpers ───────────────────────────────────────────────

function followKey(orgSlug: string, tournamentSlug: string) {
  return `fl_follow_team_${orgSlug}_${tournamentSlug}`;
}

function readFollowedTeamId(orgSlug: string, tournamentSlug: string) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(followKey(orgSlug, tournamentSlug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: string };
    return parsed.id ?? null;
  } catch {
    return null;
  }
}

function saveFollowedTeam(orgSlug: string, tournamentSlug: string, id: string, name: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(followKey(orgSlug, tournamentSlug), JSON.stringify({ id, name }));
}

function clearFollowedTeam(orgSlug: string, tournamentSlug: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(followKey(orgSlug, tournamentSlug));
}

// ── Avatar helpers ────────────────────────────────────────────────────────────

function cleanName(name: string) {
  return name.replace(/\s*\(.*?\)\s*/g, '').trim();
}

// ── Live detection ────────────────────────────────────────────────────────────

function isGameLive(game: TeamProfileData['games'][0], durationMinutes: number): boolean {
  if (game.status !== 'scheduled') return false;
  if (game.homeScore != null || game.awayScore != null) return false;
  if (!game.time) return false;

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  if (game.date !== today) return false;

  const [h, m] = game.time.split(':').map(Number);
  const start = new Date(now);
  start.setHours(h, m, 0, 0);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return now >= start && now < end;
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function TeamProfilePage({
  params,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string; id: string }>;
}) {
  const { orgSlug, tournamentSlug, id } = use(params);

  const [data, setData]       = useState<TeamProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [followedTeamId, setFollowedTeamId] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFollowedTeamId(readFollowedTeamId(orgSlug, tournamentSlug));
  }, [orgSlug, tournamentSlug]);

  useEffect(() => {
    async function load() {
      try {
        const params = new URLSearchParams({ teamId: id, orgSlug, tournamentSlug });
        const res = await fetch(`/api/public/team-profile?${params}`);
        if (!res.ok) throw new Error('Not found');
        const json = await res.json();
        setData(json);
      } catch {
        setError('Team not found.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, orgSlug, tournamentSlug]);

  if (loading) {
    return (
      <div className="page-content">
        <div className="section">
          <div className="container">
            <div className="empty-state"><Users size={40} /><p>Loading…</p></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page-content">
        <div className="section">
          <div className="container">
            <div className="empty-state"><AlertTriangle size={40} /><p>{error || 'Team not found.'}</p></div>
          </div>
        </div>
      </div>
    );
  }

  const { team, divisionName, poolName, gameDurationMinutes, standings, games } = data;
  const cleanedName = cleanName(team.name);
  const initials = teamInitials(cleanedName);
  const color = teamColor(cleanedName);
  const isFollowed = followedTeamId === team.id;

  const teamsHref = `/${orgSlug}/${tournamentSlug}/teams`;

  function toggleFollow() {
    if (isFollowed) {
      clearFollowedTeam(orgSlug, tournamentSlug);
      setFollowedTeamId(null);
    } else {
      saveFollowedTeam(orgSlug, tournamentSlug, team.id, team.name);
      setFollowedTeamId(team.id);
    }
  }

  // Form: pool play + playoffs, sorted chronologically
  const completedGames = games.filter(
    g => g.status === 'completed' || g.status === 'submitted',
  );
  const formBubbles = completedGames.slice(-5).map(g => {
    const isHome = g.homeTeamId === team.id;
    const myScore = isHome ? (g.homeScore ?? 0) : (g.awayScore ?? 0);
    const oppScore = isHome ? (g.awayScore ?? 0) : (g.homeScore ?? 0);
    if (myScore > oppScore) return 'W';
    if (myScore < oppScore) return 'L';
    return 'T';
  });

  // Next game
  const today = new Date().toISOString().split('T')[0];
  const liveGame = games.find(g => isGameLive(g, gameDurationMinutes));
  const nextGame = !liveGame
    ? games.find(g => g.status === 'scheduled' && g.date >= today)
    : null;

  const focusGame = liveGame ?? nextGame ?? null;
  const focusOpponent = focusGame
    ? focusGame.homeTeamId === team.id
      ? cleanName(focusGame.awayTeamName)
      : cleanName(focusGame.homeTeamName)
    : null;

  const runDiffStr = standings.rd >= 0 ? `+${standings.rd}` : `${standings.rd}`;

  return (
    <div className="page-content">
      <div className="section">
        <div className="container">
         <div className={styles.profile} style={{ '--team-color': color } as CSSProperties}>

          {/* Back nav */}
          <Link href={teamsHref} className={styles.backNav}>
            <ChevronLeft size={16} />
            All Teams
          </Link>

          {/* Hero card */}
          <div className={styles.heroCard}>
            <div className={styles.heroWatermark} aria-hidden>{initials}</div>

            <div className={styles.heroTop}>
              <div className={styles.heroAvatar} style={{ background: color }}>
                {initials}
              </div>
              <div className={styles.heroInfo}>
                <h1 className={styles.heroName}>{cleanedName.toUpperCase()}</h1>
                <p className={styles.heroSub}>
                  {divisionName}
                  {poolName && <> · {poolName}</>}
                  {team.coach && <> · {team.coach}</>}
                </p>
              </div>
              <div className={styles.heroActions}>
                <button
                  type="button"
                  className={`${styles.followHeroBtn} ${isFollowed ? styles.followHeroBtnActive : ''}`}
                  onClick={toggleFollow}
                  aria-pressed={isFollowed}
                >
                  <Star size={14} fill={isFollowed ? 'currentColor' : 'none'} />
                  {isFollowed ? 'Following' : 'Follow'}
                </button>
                <SharePageButton
                  url={`/${orgSlug}/${tournamentSlug}/teams/${id}`}
                  title={cleanedName}
                  text={`Follow ${cleanedName} on FieldLogicHQ`}
                  label="Share team"
                  className={styles.followHeroBtn}
                />
              </div>
            </div>

            <div className={styles.heroStats}>
              <div className={styles.heroStat}>
                <span className={styles.heroStatValue}>{standings.w}-{standings.l}-{standings.t}</span>
                <span className={styles.heroStatLabel}>RECORD</span>
              </div>
              <div className={styles.heroStatDivider} />
              <div className={styles.heroStat}>
                <span className={styles.heroStatValue}>{standings.poolRankLabel ?? '—'}</span>
                <span className={styles.heroStatLabel}>POOL RANK</span>
              </div>
              <div className={styles.heroStatDivider} />
              <div className={styles.heroStat}>
                <span className={`${styles.heroStatValue} ${styles.heroStatAccent}`}>{standings.pts}</span>
                <span className={styles.heroStatLabel}>PTS</span>
              </div>
              <div className={styles.heroStatDivider} />
              <div className={styles.heroStat}>
                <span className={styles.heroStatValue}>{runDiffStr}</span>
                <span className={styles.heroStatLabel}>RUN DIFF</span>
              </div>
            </div>
          </div>

          {/* Stat tiles */}
          <div className={styles.statGrid}>
            <div className={styles.statTile}>
              <span className={styles.statTileLabel}>POINTS</span>
              <span className={`${styles.statTileValue} ${styles.statTileAccent}`}>{standings.pts}</span>
            </div>
            <div className={styles.statTile}>
              <span className={styles.statTileLabel}>POOL RANK</span>
              <span className={styles.statTileValue}>{standings.poolRankLabel ?? '—'}</span>
              {standings.inPlayoffSpot && (
                <span className={styles.statTileSub}>In playoff spot</span>
              )}
            </div>
            <div className={styles.statTile}>
              <span className={styles.statTileLabel}>RUNS FOR</span>
              <span className={styles.statTileValue}>{standings.rf}</span>
            </div>
            <div className={styles.statTile}>
              <span className={styles.statTileLabel}>RUNS AGAINST</span>
              <span className={styles.statTileValue}>{standings.ra}</span>
            </div>
          </div>

          {/* Form + next game */}
          {(formBubbles.length > 0 || focusGame) && (
            <div className={styles.formCard}>
              {formBubbles.length > 0 && (
                <div className={styles.formRow}>
                  <span className={styles.formLabel}>FORM</span>
                  <div className={styles.formBubbles}>
                    {formBubbles.map((result, i) => (
                      <span
                        key={i}
                        className={`${styles.formBubble} ${
                          result === 'W' ? styles.formW : result === 'L' ? styles.formL : styles.formT
                        }`}
                      >
                        {result}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {focusGame && (
                <div className={styles.nextGameRow}>
                  <div className={styles.nextGameLabel}>
                    {liveGame ? (
                      <span className={styles.liveTag}>
                        <span className={styles.liveDot} />
                        LIVE
                      </span>
                    ) : (
                      <span className={styles.nextGameKicker}>NEXT GAME</span>
                    )}
                  </div>
                  <div className={styles.nextGameDetails}>
                    <span className={styles.nextGameOpponent}>vs {focusOpponent}</span>
                    {!liveGame && focusGame.time && (
                      <span className={styles.nextGameTime}>{formatTime(focusGame.time)}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Schedule & Results */}
          {games.length > 0 && (
            <div className={`card ${styles.scheduleCard}`}>
              <h3 className={styles.sectionTitle}>Schedule &amp; Results</h3>
              <div className={styles.gameList}>
                {games.map(g => {
                  const isHome = g.homeTeamId === team.id;
                  const opponent = isHome ? cleanName(g.awayTeamName) : cleanName(g.homeTeamName);
                  const hasResult = g.homeScore != null && g.awayScore != null;
                  const myScore = isHome ? g.homeScore : g.awayScore;
                  const oppScore = isHome ? g.awayScore : g.homeScore;
                  const won = hasResult && myScore! > oppScore!;
                  const lost = hasResult && myScore! < oppScore!;
                  const live = isGameLive(g, gameDurationMinutes);

                  return (
                    <Link
                      key={g.id}
                      href={`/${orgSlug}/${tournamentSlug}/schedule/${g.id}`}
                      prefetch={false}
                      className={`${styles.gameRow} ${live ? styles.gameRowLive : ''}`}
                    >
                      <div className={styles.gameDate}>
                        <strong>
                          {new Date(g.date + 'T12:00:00').toLocaleDateString('en-CA', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </strong>
                        {g.time && <span>{formatTime(g.time)}</span>}
                      </div>

                      <div className={styles.gameMatchup}>
                        <div className={styles.opponentWrap}>
                          <span className={styles.vsLabel}>{isHome ? 'vs' : 'at'}</span>
                          <span className={styles.opponentName}>{opponent}</span>
                          {g.isPlayoff && <span className={styles.playoffTag}>Playoff</span>}
                        </div>
                        {g.location && (
                          <span className={styles.location}>{g.location}</span>
                        )}
                      </div>

                      <div className={styles.gameResult}>
                        {live && (
                          <span className={styles.liveBadge}>
                            <span className={styles.liveDot} /> LIVE
                          </span>
                        )}
                        {!live && hasResult && (
                          <div className={styles.resultBadge}>
                            <span className={won ? styles.resW : lost ? styles.resL : styles.resT}>
                              {won ? 'W' : lost ? 'L' : 'T'}
                            </span>
                            <strong>{myScore} – {oppScore}</strong>
                          </div>
                        )}
                        {!live && !hasResult && g.status === 'scheduled' && (
                          <span className={styles.upcomingBadge}>Upcoming</span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {games.length === 0 && (
            <div className={styles.noGames}>
              <Clock size={28} />
              <p>No games scheduled yet.</p>
            </div>
          )}

         </div>{/* /profile */}
        </div>
      </div>
    </div>
  );
}
