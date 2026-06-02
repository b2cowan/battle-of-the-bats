'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, Search, ChevronDown, Star, X, Calendar, Clock, Trophy } from 'lucide-react';
import { getDivisionPref, setDivisionPref } from '@/lib/division-cookie';
import { isPublicPageEnabled } from '@/lib/public-pages';
import { Game, Team, Division, Tournament, Venue } from '@/lib/types';
import { formatTime } from '@/lib/utils';
import YearSelector from '@/components/YearSelector';
import LocationLink from '@/components/LocationLink';
import styles from '@/app/[orgSlug]/teams/teams.module.css';
import homeStyles from '@/app/[orgSlug]/Home.module.css';
import { fetchPublicTournamentData } from '@/lib/public-tournament-client';
import type { PublicTournamentPageData } from '@/lib/public-tournament-data';

interface Props {
  orgSlug: string;
  tournamentSlug: string;
  isPreview?: boolean;
  initialData?: PublicTournamentPageData;
}

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

function saveFollowedTeam(orgSlug: string, tournamentSlug: string, team: Pick<Team, 'id' | 'name' | 'divisionId'>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(followKey(orgSlug, tournamentSlug), JSON.stringify({
    id: team.id,
    name: team.name,
    divisionId: team.divisionId,
  }));
}

function clearFollowedTeam(orgSlug: string, tournamentSlug: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(followKey(orgSlug, tournamentSlug));
}

function cleanTeamName(name: string) {
  return name.replace(/\s*\(.*?\)\s*/g, '').trim();
}

export function TournamentHomeFollowedTeamCard({
  orgSlug,
  tournamentSlug,
  teams,
  games,
  venues,
  scheduleHref,
}: {
  orgSlug: string;
  tournamentSlug: string;
  teams: Team[];
  games: Game[];
  venues: Venue[];
  scheduleHref: string;
}) {
  const [followedTeamId, setFollowedTeamId] = useState<string | null>(null);

  useEffect(() => {
    // Browser-local preference hydrates after the public home renders.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFollowedTeamId(readFollowedTeamId(orgSlug, tournamentSlug));
  }, [orgSlug, tournamentSlug]);

  const followedTeam = followedTeamId ? teams.find(team => team.id === followedTeamId) ?? null : null;
  if (!followedTeam) return null;

  const today = new Date().toISOString().split('T')[0];
  const teamGames = games
    .filter(game => game.homeTeamId === followedTeam.id || game.awayTeamId === followedTeam.id)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.time || '').localeCompare(b.time || '');
    });
  const nextGame = teamGames.find(game => game.status === 'scheduled' && game.date >= today);
  const latestResult = [...teamGames]
    .filter(game => game.status === 'completed' && game.homeScore != null && game.awayScore != null)
    .sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return (b.time || '').localeCompare(a.time || '');
    })[0];
  const highlightGame = nextGame ?? latestResult ?? teamGames[0] ?? null;
  const opponent = highlightGame
    ? highlightGame.homeTeamId === followedTeam.id
      ? teams.find(team => team.id === highlightGame.awayTeamId)?.name ?? highlightGame.awayPlaceholder ?? 'TBD'
      : teams.find(team => team.id === highlightGame.homeTeamId)?.name ?? highlightGame.homePlaceholder ?? 'TBD'
    : null;
  const venue = highlightGame?.venueId ? venues.find(v => v.id === highlightGame.venueId) ?? null : null;
  return (
    <div className={`card ${homeStyles.myTeamCard}`}>
      <div className={homeStyles.dayCardHeader}>
        <div className={homeStyles.dayCardIcon}><Star size={16} fill="currentColor" /></div>
        <div>
          <span className={homeStyles.dayCardKicker}>My Team</span>
          <h3>{cleanTeamName(followedTeam.name)}</h3>
        </div>
      </div>

      {highlightGame ? (
        <div className={homeStyles.myTeamGame}>
          <div className={homeStyles.myTeamGameTop}>
            <Clock size={14} />
            <span>
              {new Date(highlightGame.date + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
              {' at '}
              {formatTime(highlightGame.time)}
            </span>
          </div>
          <strong>{nextGame ? 'Next game' : 'Latest result'} vs {opponent}</strong>
          {latestResult && highlightGame.id === latestResult.id && (
            <span className={homeStyles.scorePill}>
              {latestResult.homeScore} - {latestResult.awayScore}
            </span>
          )}
          <LocationLink location={highlightGame.location} venue={venue} size="sm" />
        </div>
      ) : (
        <p className={homeStyles.dayCardSub}>No games are scheduled for this team yet.</p>
      )}

      <div className={homeStyles.dayCardActions}>
        <Link href={scheduleHref} className="btn btn-lime btn-sm">
          <Calendar size={14} /> Team Schedule
        </Link>
        <Link href={`/${orgSlug}/${tournamentSlug}/teams/${followedTeam.id}`} className="btn btn-ghost btn-sm">
          <Trophy size={14} /> Team Profile
        </Link>
      </div>
    </div>
  );
}

export default function TeamsContent({ orgSlug, tournamentSlug, isPreview = false, initialData }: Props) {
  const [teams, setTeams]           = useState<Team[]>(() => initialData?.teams ?? []);
  const [divisions, setDivisions]   = useState<Division[]>(() => initialData?.divisions ?? []);
  const [allTournaments, setAllTournaments] = useState<Tournament[]>(() => initialData?.tournaments ?? []);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(() => initialData?.tournament ?? null);
  const [contactEmail, setContactEmail] = useState<string | null>(
    () => initialData?.tournament?.contactEmail ?? initialData?.organization?.contactEmail ?? null
  );
  const [activeGroup, setActiveGroup] = useState<string>('all');
  const [search, setSearch]         = useState('');
  const [followedTeamId, setFollowedTeamId] = useState<string | null>(null);

  useEffect(() => {
    // Browser-local preference hydrates after the public page renders.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFollowedTeamId(readFollowedTeamId(orgSlug, tournamentSlug));
  }, [orgSlug, tournamentSlug]);

  // Set initial active group from cookie preference
  useEffect(() => {
    const groups = initialData?.divisions ?? [];
    const pref = getDivisionPref(orgSlug);
    const preferred = pref ? groups.find(g => g.name === pref) : null;
    if (preferred) setActiveGroup(preferred.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (initialData) return;
    async function init() {
      const data = await fetchPublicTournamentData(orgSlug, tournamentSlug, 'teams');
      const current = data?.tournament ?? null;
      setAllTournaments(data?.tournaments ?? []);
      setSelectedTournament(current);
      setContactEmail(current?.contactEmail ?? data?.organization?.contactEmail ?? null);
      setTeams(data?.teams ?? []);
      const groups = data?.divisions ?? [];
      setDivisions(groups);
      const pref = getDivisionPref(orgSlug);
      const preferred = pref ? groups.find(g => g.name === pref) : null;
      if (preferred) setActiveGroup(preferred.id);
    }
    init();
  }, [orgSlug, tournamentSlug, initialData]);

  const filtered = (activeGroup === 'all' ? teams : teams.filter(t => t.divisionId === activeGroup))
    .filter(t => {
      const q = search.toLowerCase();
      return t.name.toLowerCase().includes(q) || (t.coach && t.coach.toLowerCase().includes(q));
    });

  const countByGroup = Object.fromEntries(divisions.map(g => [g.id, teams.filter(t => t.divisionId === g.id).length]));
  const totalCount = teams.length;
  const homeHref = `/${orgSlug}/${tournamentSlug}`;
  const registerHref = `/${orgSlug}/${tournamentSlug}/register`;
  const scheduleHref = `/${orgSlug}/${tournamentSlug}/schedule`;
  const canRegister = Boolean(selectedTournament && isPublicPageEnabled(selectedTournament, 'register'));
  const showSchedulePage = Boolean(selectedTournament && isPublicPageEnabled(selectedTournament, 'schedule'));
  const followedTeam = followedTeamId ? teams.find(t => t.id === followedTeamId) ?? null : null;

  function followTeam(team: Team) {
    saveFollowedTeam(orgSlug, tournamentSlug, team);
    setFollowedTeamId(team.id);
    if (team.divisionId) {
      setActiveGroup(team.divisionId);
      setDivisionPref(orgSlug, divisions.find(g => g.id === team.divisionId)?.name ?? '');
    }
  }

  function stopFollowing() {
    clearFollowedTeam(orgSlug, tournamentSlug);
    setFollowedTeamId(null);
  }

  if (selectedTournament && !isPublicPageEnabled(selectedTournament, 'teams')) {
    return (
      <div className="page-content">
        <div className="section">
          <div className="container">
            <div className="empty-state">
              <Users size={48} />
              <p>Teams are not available for this tournament.</p>
              {!isPreview && <Link href={homeHref} className="btn btn-ghost btn-sm">Tournament Home</Link>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="public-page-header">
        <div className="container">
          <span className="eyebrow"><Users size={12} /> Teams</span>
          <h1>Registered Teams</h1>
          <p className="text-muted">Browse participating teams by age division.</p>
        </div>
      </div>

      <div className="section">
        <div className="container">
          {!isPreview && (
            <YearSelector
              tournaments={allTournaments}
              orgSlug={orgSlug}
              currentTournamentSlug={tournamentSlug}
              currentPage="teams"
            />
          )}

          {!isPreview && followedTeam && (
            <div className={styles.followBar}>
              <div className={styles.followMain}>
                <Star size={16} fill="currentColor" />
                <span>Following</span>
                <strong>{cleanTeamName(followedTeam.name)}</strong>
              </div>
              <div className={styles.followActions}>
                {showSchedulePage && <Link href={scheduleHref} className="btn btn-lime btn-sm">Team Schedule</Link>}
                <button type="button" className="btn btn-ghost btn-sm" onClick={stopFollowing}>
                  <X size={14} /> Clear
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {divisions.length > 1 && (
              <div className="select-wrapper" style={{ minWidth: '160px' }}>
                <select
                  className="form-select"
                  value={activeGroup}
                  onChange={e => {
                    setActiveGroup(e.target.value);
                    if (e.target.value !== 'all') setDivisionPref(orgSlug, divisions.find(g => g.id === e.target.value)?.name ?? '');
                  }}
                >
                  <option value="all">All Divisions ({totalCount})</option>
                  {divisions.map(g => (
                    <option key={g.id} value={g.id}>{g.name} ({countByGroup[g.id] || 0})</option>
                  ))}
                </select>
                <ChevronDown size={16} className="select-icon" />
              </div>
            )}
            <div className={styles.searchRow} style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
              <Search size={16} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search teams or coaches..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className={styles.searchInput}
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state">
              <Users size={48} />
              <p>
                {search
                  ? 'No teams match that search.'
                  : canRegister
                    ? 'No approved teams are listed yet. Coaches can register from the tournament navigation.'
                    : 'No approved teams are listed yet. Check back after teams are confirmed.'}
                {contactEmail ? (
                  <> Questions? Contact <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.</>
                ) : null}
              </p>
              {!isPreview && (
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  {canRegister && <Link href={registerHref} className="btn btn-lime btn-sm">Register</Link>}
                  {showSchedulePage && <Link href={scheduleHref} className="btn btn-ghost btn-sm">View Schedule</Link>}
                </div>
              )}
            </div>
          ) : (
            <div className={styles.divisionLayout}>
              {divisions.filter(g => activeGroup === 'all' || g.id === activeGroup).map(group => {
                const groupTeams = filtered.filter(t => t.divisionId === group.id);
                if (groupTeams.length === 0) return null;

                const groupPools = (group.poolCount || 0) >= 2 ? (group.pools || []) : [];
                const poolIds = groupPools.map(p => p.id);

                const poolGroups: { name: string; teams: Team[] }[] = [];

                if (groupPools.length >= 2) {
                  groupPools.forEach(p => {
                    const teamsInPool = groupTeams.filter(t => t.poolId === p.id);
                    if (teamsInPool.length > 0) {
                      poolGroups.push({ name: p.name, teams: teamsInPool });
                    }
                  });
                  const unassigned = groupTeams.filter(t => !t.poolId || !poolIds.includes(t.poolId));
                  if (unassigned.length > 0) {
                    poolGroups.push({ name: 'Awaiting Assignment', teams: unassigned });
                  }
                } else {
                  poolGroups.push({ name: '', teams: groupTeams });
                }

                return (
                  <div key={group.id} className={styles.groupSection}>
                    <h2 className={styles.groupTitle}>{group.name}</h2>
                    <div className={styles.poolGrid}>
                      {poolGroups.map(pg => (
                        <div key={pg.name} className={styles.poolCard}>
                          {pg.name && (
                            <h3 className={styles.poolName}>
                              {pg.name.replace(/^Pool\s+/i, '').trim()} Pool
                            </h3>
                          )}
                          <div className={styles.teamList}>
                            {pg.teams.map(team => {
                              const cleanName = cleanTeamName(team.name);
                              const isFollowed = followedTeamId === team.id;
                              return (
                                <div key={team.id} className={`${styles.teamRow} ${isFollowed ? styles.followedTeamRow : ''}`}>
                                  <div className={styles.teamMain}>
                                    <div>
                                      <h4 className={styles.teamName}>{cleanName}</h4>
                                      {team.coach && <span className={styles.coach}>Coach: {team.coach}</span>}
                                    </div>
                                  </div>
                                  {!isPreview && (
                                    <div className={styles.teamActions}>
                                      <button
                                        type="button"
                                        className={`${styles.followButton} ${isFollowed ? styles.followButtonActive : ''}`}
                                        onClick={() => isFollowed ? stopFollowing() : followTeam(team)}
                                        aria-pressed={isFollowed}
                                      >
                                        <Star size={13} fill={isFollowed ? 'currentColor' : 'none'} />
                                        {isFollowed ? 'Following' : 'Follow'}
                                      </button>
                                      <Link href={`/${orgSlug}/${tournamentSlug}/teams/${team.id}`} className={styles.viewLink}>Profile</Link>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
