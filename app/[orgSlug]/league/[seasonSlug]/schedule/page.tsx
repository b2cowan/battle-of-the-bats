import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  getOrganizationBySlug,
  getLeagueSeasonBySlug,
  getDivisionsForSeason,
  getTeamsForSeason,
  getGamesForSeason,
} from '@/lib/db';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import type { LeagueDivision, LeagueTeam, LeagueGame } from '@/lib/types';

export const dynamic = 'force-dynamic';

function formatDateTime(iso: string | null): { date: string; time: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }),
    time: d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true }),
  };
}

function weekKey(iso: string | null): string {
  if (!iso) return 'unscheduled';
  const d = new Date(iso);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

function weekLabel(key: string): string {
  if (key === 'unscheduled') return 'Unscheduled';
  const d = new Date(key + 'T12:00:00');
  const end = new Date(d);
  end.setDate(d.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `Week of ${d.toLocaleDateString('en-CA', opts)} – ${end.toLocaleDateString('en-CA', opts)}`;
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

  const org = await getOrganizationBySlug(orgSlug);
  if (!org) notFound();
  if (!hasModuleEntitlement(org, 'module_house_league')) notFound();

  const season = await getLeagueSeasonBySlug(org.id, seasonSlug);
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
            Schedule
          </h1>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)' }}>
            {season.name}
          </p>
        </div>

        {/* Division tabs */}
        {divisions.length > 1 && (
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            {divisions.map(d => {
              const isActive = d.id === activeDivision?.id;
              return (
                <Link
                  key={d.id}
                  href={`/${orgSlug}/league/${seasonSlug}/schedule?d=${d.id}`}
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
                  }}
                >
                  {d.name}
                </Link>
              );
            })}
          </div>
        )}

        {/* Game weeks */}
        {filteredGames.length === 0 ? (
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
            No games scheduled yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {sortedWeeks.map(([key, weekGames]) => (
              <div key={key}>
                <div
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'rgba(255,255,255,0.35)',
                    marginBottom: '0.65rem',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    paddingBottom: '0.4rem',
                  }}
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
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr auto 1fr',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '0.75rem 1rem',
                          border: '1px solid rgba(255,255,255,0.07)',
                          borderRadius: '8px',
                          background: 'rgba(255,255,255,0.02)',
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
                          <span style={{ fontWeight: 700, color: '#f0f0f0', fontSize: '0.9rem' }}>
                            {home?.name ?? 'TBD'}
                          </span>
                        </div>

                        {/* Score / time */}
                        <div style={{ textAlign: 'center', minWidth: '5rem' }}>
                          {isDone ? (
                            <span
                              style={{
                                fontWeight: 800,
                                fontSize: '1rem',
                                color: '#a3e635',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {game.homeScore ?? 0} – {game.awayScore ?? 0}
                            </span>
                          ) : (
                            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>
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
                          <span style={{ fontWeight: 700, color: '#f0f0f0', fontSize: '0.9rem' }}>
                            {away?.name ?? 'TBD'}
                          </span>
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
