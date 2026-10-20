import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  getDivisionsForSeason,
  getTeamsForSeason,
  getGamesForSeason,
} from '@/lib/db';
import { resolvePublicLeagueContext } from '@/lib/public-league';
import { clubPageMetadata, getClubSeason } from '@/lib/club-page-meta';
import { ORG_TIME_ZONE, addCalendarDays, formatInOrgZone, orgWeekKey } from '@/lib/timezone';
import type { LeagueDivision, LeagueTeam, LeagueGame } from '@/lib/types';
import column from '../../league-column.module.css';
import kit from '@/components/public/ClubKit.module.css';

export const dynamic = 'force-dynamic';

// A draft season is hidden by this page, so the tab does not name it either.
export async function generateMetadata({ params }: { params: Promise<{ orgSlug: string; seasonSlug: string }> }): Promise<Metadata> {
  const { orgSlug, seasonSlug } = await params;
  return clubPageMetadata(orgSlug, async club => {
    const season = await getClubSeason(club.id, seasonSlug);
    return season && season.status !== 'draft' ? `${season.name} schedule` : null;
  });
}

function formatDateTime(iso: string | null): { date: string; time: string } | null {
  if (!iso) return null;
  // J3-047: this is a SERVER component — without an explicit timeZone, toLocale* renders in
  // the server's zone (UTC on Amplify), so parents saw game times 4–5h off. Pin to the org
  // zone (America/Toronto V1) so 6:00 PM reads as 6:00 PM for every family.
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-CA', { timeZone: ORG_TIME_ZONE, weekday: 'short', month: 'short', day: 'numeric' }),
    time: d.toLocaleTimeString('en-CA', { timeZone: ORG_TIME_ZONE, hour: 'numeric', minute: '2-digit', hour12: true }),
  };
}

// ⚠ THE WEEK IS THE ORG'S, NOT THE SERVER'S (Club Tier Stage 6b, Ask 8 — S6-12): this is a server page, and
// `getDay()` here read the host's clock (UTC on Amplify), so a Sunday game after 8 p.m. Eastern filed into the next
// week for every family. Filed by the game's org-zone day instead.
function weekKey(iso: string | null): string {
  if (!iso) return 'unscheduled';
  return orgWeekKey(iso);
}

function weekLabel(key: string): string {
  if (key === 'unscheduled') return 'Unscheduled';
  // A week key is a calendar date: name it and its Sunday by date arithmetic, read at noon in the org's zone.
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const day = (date: string) => formatInOrgZone(`${date}T12:00:00Z`, opts);
  return `Week of ${day(key)} – ${day(addCalendarDays(key, 6))}`;
}

export default async function PublicSchedulePage({
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

  const season = await getClubSeason(org.id, seasonSlug);
  if (!season) notFound();
  if (season.status === 'draft') notFound();

  const [divisions, teams, games] = await Promise.all([
    getDivisionsForSeason(season.id),
    getTeamsForSeason(season.id),
    getGamesForSeason(season.id),
  ]);

  const teamMap = new Map<string, LeagueTeam>(teams.map(t => [t.id, t]));

  const activeDivision: LeagueDivision | null =
    divisions.find(d => d.id === divisionIdParam) ?? divisions[0] ?? null;

  const filteredGames = activeDivision
    ? games.filter(g => g.divisionId === activeDivision.id)
    : games;

  // Group by week
  const weekGroups = new Map<string, LeagueGame[]>();
  for (const game of filteredGames) {
    const key = weekKey(game.scheduledAt);
    if (!weekGroups.has(key)) weekGroups.set(key, []);
    weekGroups.get(key)!.push(game);
  }
  const sortedWeeks = [...weekGroups.entries()].sort(([a], [b]) => a.localeCompare(b));

  const teamName: React.CSSProperties = { fontWeight: 700, color: 'var(--club-text)', fontSize: '1rem' };

  // The light ground, bar and footer come from the club's frame (Club Tier Stage 4b-1).
  return (
    <div>
      {/* R6: the shared 1200px page column; this page's 800px measure left-aligns inside it. */}
      <div className={`container ${column.column}`} style={{ '--league-measure': '800px' } as React.CSSProperties}>
        {/* Back */}
        <Link href={`/${orgSlug}/league/${seasonSlug}`} className={kit.back}>
          ← {season.name}
        </Link>

        {/* Title */}
        <div style={{ marginBottom: '1.75rem' }}>
          <h1 className={kit.title}>Schedule</h1>
          <p className={kit.sub}>{season.name}</p>
        </div>

        {/* Division tabs */}
        {divisions.length > 1 && (
          <div className={column.tabs}>
            {divisions.map(d => {
              const isActive = d.id === activeDivision?.id;
              return (
                <Link
                  key={d.id}
                  href={`/${orgSlug}/league/${seasonSlug}/schedule?d=${d.id}`}
                  className={`${column.tab}${isActive ? ` ${column.tabActive}` : ''}`}
                >
                  {d.name}
                </Link>
              );
            })}
          </div>
        )}

        {/* Game weeks */}
        {filteredGames.length === 0 ? (
          <div className={kit.empty}>No games scheduled yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {sortedWeeks.map(([key, weekGames]) => (
              <div key={key}>
                <div
                  className={kit.band}
                  style={{ borderBottom: '1px solid var(--club-line)', paddingBottom: '0.4rem' }}
                >
                  {weekLabel(key)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {weekGames.map(game => {
                    const home = teamMap.get(game.homeTeamId);
                    const away = teamMap.get(game.awayTeamId);
                    const dt   = formatDateTime(game.scheduledAt);
                    const isDone = game.status === 'completed';

                    return (
                      <div
                        key={game.id}
                        className={kit.card}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr auto 1fr',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '0.75rem 1rem',
                        }}
                      >
                        {/* Home team */}
                        <div style={{ textAlign: 'right' }}>
                          {home?.color && (
                            <span
                              style={{
                                display: 'inline-block',
                                width: 8, height: 8,
                                borderRadius: '50%',
                                background: home.color,
                                marginRight: 6,
                                verticalAlign: 'middle',
                              }}
                            />
                          )}
                          <span style={teamName}>{home?.name ?? 'TBD'}</span>
                        </div>

                        {/* Score / time */}
                        <div style={{ textAlign: 'center', minWidth: '5rem' }}>
                          {isDone ? (
                            <span
                              style={{
                                fontWeight: 700,
                                fontSize: '1rem',
                                color: 'var(--club-text)',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {game.homeScore ?? 0} – {game.awayScore ?? 0}
                            </span>
                          ) : (
                            <div style={{ fontSize: '0.75rem', color: 'var(--club-soft)', lineHeight: 1.4 }}>
                              {dt ? (
                                <>
                                  <div>{dt.date}</div>
                                  <div>{dt.time}</div>
                                </>
                              ) : (
                                <span>TBD</span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Away team */}
                        <div>
                          {away?.color && (
                            <span
                              style={{
                                display: 'inline-block',
                                width: 8, height: 8,
                                borderRadius: '50%',
                                background: away.color,
                                marginRight: 6,
                                verticalAlign: 'middle',
                              }}
                            />
                          )}
                          <span style={teamName}>{away?.name ?? 'TBD'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
