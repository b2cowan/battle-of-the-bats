import { ImageResponse } from 'next/og';
import { getPublicTournamentPageData } from '@/lib/public-tournament-data';
import { resolveTheme } from '@/lib/themes';
import type { Game } from '@/lib/types';
import { isGameLive, DEFAULT_GAME_DURATION_MINUTES } from '@/lib/game-status';
import { tournamentToday } from '@/lib/timezone';

export const alt = 'Tournament';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const GOLD = '#EFC44D';

interface ChampionInfo { division: string; champion: string; runnerUp: string | null; }
interface LiveInfo {
  /** Number of games scheduled today. */
  gamesToday: number;
  /** Number of games currently in-window (live). */
  liveCount: number;
  /** Score line of the first live game that has scores, or null. */
  topScore: string | null;
}
interface CardData {
  name: string;
  orgName: string;
  dateLabel: string;
  teamCount: number;
  divisionCount: number;
  primary: string;
  rgb: string;
  /** Decided division champions (one per division whose final is settled). */
  champions: ChampionInfo[];
  /** Present only on game day — drives the LIVE OG variant (J6-008). */
  liveInfo: LiveInfo | null;
}

function fmtRange(start?: string, end?: string): string {
  if (!start) return '';
  const s = new Date(`${start}T12:00:00`);
  if (!end || end === start) {
    return s.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  const e = new Date(`${end}T12:00:00`);
  const sameMonth = s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth();
  if (sameMonth) {
    return `${s.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}–${e.getDate()}, ${e.getFullYear()}`;
  }
  return `${s.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

// A bracket final is "decided" once it's scored with a winner and both sides resolved.
function isDecided(g?: Game): boolean {
  return !!g
    && (g.status === 'completed' || g.status === 'submitted')
    && g.homeScore != null && g.awayScore != null && g.homeScore !== g.awayScore
    && !!g.homeTeamId && !!g.awayTeamId;
}

async function loadCard(params: Promise<{ orgSlug: string; tournamentSlug: string }>): Promise<CardData | null> {
  try {
    const { orgSlug, tournamentSlug } = await params;
    const data = await getPublicTournamentPageData(orgSlug, tournamentSlug, 'teams');
    if (!data?.tournament) return null;
    const t = data.tournament;
    const theme = resolveTheme(t.themePreset, t.themePrimary, t.themeAccent);

    const teams = data.teams ?? [];
    const games = data.games ?? [];
    const divisions = data.divisions ?? [];
    const teamName = (id?: string | null) => (id ? teams.find(x => x.id === id)?.name ?? null : null);

    // Champion per division = the winner of the decided final (grand-final reset,
    // grand final, or single-elim/placement final, in that priority).
    const champions: ChampionInfo[] = [];
    for (const div of divisions) {
      const pg = games.filter(g => g.isPlayoff && g.divisionId === div.id);
      const byCode = (code: string) => pg.find(g => (g.bracketCode || '').toUpperCase() === code);
      const finalG = [byCode('GF2'), byCode('GF'), byCode('FIN')].find(isDecided);
      if (!finalG) continue;
      const champId = (finalG.homeScore ?? 0) > (finalG.awayScore ?? 0) ? finalG.homeTeamId : finalG.awayTeamId;
      const loserId = champId === finalG.homeTeamId ? finalG.awayTeamId : finalG.homeTeamId;
      const champion = teamName(champId);
      if (champion) champions.push({ division: div.name, champion, runnerUp: teamName(loserId) });
    }

    // ── Game-day / live detection (J6-008) ───────────────────────────────────
    const now = new Date();
    const today = tournamentToday(now);
    const todayGames = games.filter(g => g.date === today && g.status !== 'cancelled');
    let liveInfo: LiveInfo | null = null;
    if (todayGames.length > 0) {
      const liveGames = todayGames.filter(g =>
        isGameLive(g, g.durationMinutes ?? DEFAULT_GAME_DURATION_MINUTES, now),
      );
      let topScore: string | null = null;
      const scoredLive = liveGames.find(g => g.homeScore != null && g.awayScore != null);
      if (scoredLive) {
        const home = teamName(scoredLive.homeTeamId) ?? 'Home';
        const away = teamName(scoredLive.awayTeamId) ?? 'Away';
        topScore = `${home} ${scoredLive.homeScore} – ${scoredLive.awayScore} ${away}`;
      }
      liveInfo = { gamesToday: todayGames.length, liveCount: liveGames.length, topScore };
    }

    return {
      name: t.name,
      orgName: data.organization?.name ?? '',
      dateLabel: fmtRange(t.startDate, t.endDate),
      teamCount: teams.length,
      divisionCount: divisions.length,
      primary: theme.primary,
      rgb: theme.primaryRgb,
      champions,
      liveInfo,
    };
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ orgSlug: string; tournamentSlug: string }> }) {
  const c = await loadCard(params);

  if (!c) {
    return new ImageResponse(
      (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A0A12', color: '#fff', fontSize: 56, fontWeight: 800 }}>
          FieldLogicHQ
        </div>
      ),
      { ...size },
    );
  }

  // ── Champion / podium card (when a final is decided) ──────────────────────────
  if (c.champions.length > 0) {
    const single = c.champions.length === 1;
    return new ImageResponse(
      (
        <div style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: 72,
          backgroundColor: '#0A0A12',
          backgroundImage: `linear-gradient(135deg, rgba(239,196,77,0.32) 0%, rgba(239,196,77,0.08) 50%, rgba(10,10,18,0) 82%)`,
          fontFamily: 'sans-serif',
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 12, background: GOLD }} />

          {c.orgName
            ? <div style={{ display: 'flex', color: 'rgba(255,255,255,0.7)', fontSize: 28, fontWeight: 700, letterSpacing: 1 }}>{c.orgName.toUpperCase()}</div>
            : <div style={{ display: 'flex' }} />}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1, justifyContent: 'center' }}>
            <div style={{ display: 'flex', color: GOLD, fontSize: 30, fontWeight: 800, letterSpacing: 6 }}>
              {single ? '★ CHAMPION' : '★ CHAMPIONS'}
            </div>

            {single ? (
              <>
                <div style={{ display: 'flex', fontSize: 92, fontWeight: 800, color: '#fff', lineHeight: 1.02 }}>{c.champions[0].champion}</div>
                {c.divisionCount > 1 && (
                  <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>{c.champions[0].division}</div>
                )}
                {c.champions[0].runnerUp && (
                  <div style={{ display: 'flex', fontSize: 30, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>Runner-up · {c.champions[0].runnerUp}</div>
                )}
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {c.champions.slice(0, 4).map((ch, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
                    <div style={{ display: 'flex', fontSize: 26, fontWeight: 700, color: 'rgba(255,255,255,0.55)', width: 220 }}>{ch.division}</div>
                    <div style={{ display: 'flex', fontSize: 44, fontWeight: 800, color: '#fff' }}>{ch.champion}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: 30, fontWeight: 800, color: 'rgba(255,255,255,0.92)' }}>{c.name}</div>
              {c.dateLabel && <div style={{ display: 'flex', fontSize: 24, fontWeight: 600, color: 'rgba(255,255,255,0.55)' }}>{c.dateLabel}</div>}
            </div>
            <div style={{ display: 'flex', color: 'rgba(255,255,255,0.62)', fontSize: 26, fontWeight: 700 }}>Live on FieldLogicHQ</div>
          </div>
        </div>
      ),
      { ...size },
    );
  }

  // ── Game-day LIVE card (today has games) ─────────────────────────────────────
  if (c.liveInfo) {
    const { gamesToday, liveCount, topScore } = c.liveInfo;
    const isLiveNow = liveCount > 0;
    return new ImageResponse(
      (
        <div style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: 72,
          backgroundColor: '#0A0A12',
          backgroundImage: `linear-gradient(135deg, rgba(${c.rgb},0.4) 0%, rgba(${c.rgb},0.1) 48%, rgba(10,10,18,0) 80%)`,
          fontFamily: 'sans-serif',
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 12, background: c.primary }} />

          {c.orgName
            ? <div style={{ display: 'flex', color: 'rgba(255,255,255,0.7)', fontSize: 30, fontWeight: 700, letterSpacing: 1 }}>{c.orgName.toUpperCase()}</div>
            : <div style={{ display: 'flex' }} />}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, flex: 1, justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {isLiveNow && (
                <div style={{ display: 'flex', width: 22, height: 22, borderRadius: 11, background: '#FF3B30' }} />
              )}
              <div style={{
                display: 'flex', fontSize: 30, fontWeight: 800, letterSpacing: 6,
                color: isLiveNow ? '#FF3B30' : 'rgba(255,255,255,0.7)',
              }}>
                {isLiveNow ? 'LIVE NOW' : 'GAME DAY'}
              </div>
            </div>

            <div style={{ display: 'flex', fontSize: 86, fontWeight: 800, color: '#fff', lineHeight: 1.05 }}>{c.name}</div>

            {topScore
              ? <div style={{ display: 'flex', fontSize: 34, fontWeight: 700, color: 'rgba(255,255,255,0.88)' }}>{topScore}</div>
              : <div style={{ display: 'flex', fontSize: 34, fontWeight: 700, color: 'rgba(255,255,255,0.72)' }}>
                  {gamesToday === 1 ? '1 game today' : `${gamesToday} games today`}
                </div>
            }
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', fontSize: 26, fontWeight: 700, color: 'rgba(255,255,255,0.55)' }}>
              {topScore
                ? (gamesToday === 1 ? '1 game today' : `${gamesToday} games today`)
                : (c.dateLabel || '')}
            </div>
            <div style={{ display: 'flex', color: 'rgba(255,255,255,0.62)', fontSize: 26, fontWeight: 700 }}>Live on FieldLogicHQ</div>
          </div>
        </div>
      ),
      { ...size },
    );
  }

  // ── Event card (default, incl. pre-play / in-progress) ────────────────────────
  const stat = (n: number, label: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ display: 'flex', fontSize: 64, fontWeight: 800, color: '#fff' }}>{n || '—'}</div>
      <div style={{ display: 'flex', fontSize: 23, fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.55)' }}>{label}</div>
    </div>
  );

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: 72,
        backgroundColor: '#0A0A12',
        backgroundImage: `linear-gradient(135deg, rgba(${c.rgb},0.4) 0%, rgba(${c.rgb},0.1) 48%, rgba(10,10,18,0) 80%)`,
        fontFamily: 'sans-serif',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 12, background: c.primary }} />

        {c.orgName
          ? <div style={{ display: 'flex', color: 'rgba(255,255,255,0.7)', fontSize: 30, fontWeight: 700, letterSpacing: 1 }}>{c.orgName.toUpperCase()}</div>
          : <div style={{ display: 'flex' }} />}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, justifyContent: 'center' }}>
          <div style={{ display: 'flex', fontSize: 86, fontWeight: 800, color: '#fff', lineHeight: 1.05 }}>{c.name}</div>
          {c.dateLabel && <div style={{ display: 'flex', fontSize: 36, fontWeight: 700, color: 'rgba(255,255,255,0.82)' }}>{c.dateLabel}</div>}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 56 }}>
            {stat(c.teamCount, 'TEAMS')}
            {stat(c.divisionCount, 'DIVISIONS')}
          </div>
          <div style={{ display: 'flex', color: 'rgba(255,255,255,0.62)', fontSize: 26, fontWeight: 700 }}>Live on FieldLogicHQ</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
