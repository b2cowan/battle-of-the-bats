import { ImageResponse } from 'next/og';
import { getPublicTournamentPageData } from '@/lib/public-tournament-data';
import { shareImageTheme } from '@/lib/tournament-share-look';
import { teamColor, teamInitials } from '@/lib/team-color';
import { publicGameStatus, DEFAULT_GAME_DURATION_MINUTES } from '@/lib/game-status';
import { publicGameDetailView } from '@/lib/public-game-detail';

export const alt = 'Tournament score';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface CardData {
  tournamentName: string;
  away: string;
  home: string;
  awayScore: number;
  homeScore: number;
  hasScore: boolean;
  awayWin: boolean;
  homeWin: boolean;
  statusLabel: string;
  isLive: boolean;
  isUnofficial: boolean;
  primary: string;
  rgb: string;
  metaLine: string;
}

async function loadCard(params: Promise<{ orgSlug: string; tournamentSlug: string; gameId: string }>): Promise<CardData | null> {
  try {
    const { orgSlug, tournamentSlug, gameId } = await params;
    const data = await getPublicTournamentPageData(orgSlug, tournamentSlug, 'schedule');
    if (!data?.tournament) return null;

    const game = data.games.find(g => g.id === gameId);
    if (!game) return null;
    const requireFinalization = data.organization.requireScoreFinalization ?? true;
    // The card's words follow the game's page: names, score, state and round come from the page's own view.
    const view = publicGameDetailView(game, { ...data, requireFinalization });
    const away = view.sides[0].name;
    const home = view.sides[1].name;
    const hasScore = view.hasScore;
    const awayScore = game.awayScore ?? 0;
    const homeScore = game.homeScore ?? 0;

    // One shared definition (J6-013): a game in its time-window is LIVE; a submitted
    // score awaiting confirmation is UNOFFICIAL, never "PENDING" on a share card (J6-015).
    const state = publicGameStatus(game, game.durationMinutes ?? DEFAULT_GAME_DURATION_MINUTES, requireFinalization);
    const isLive = state === 'live';
    const isUnofficial = state === 'unofficial';
    const statusLabel = (view.cancelled ? 'Cancelled' : view.stateLabel ?? 'Up next').toUpperCase();

    const t = data.tournament;
    const theme = await shareImageTheme(orgSlug, t);

    const dateLabel = game.date
      ? new Date(`${game.date}T12:00:00`).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
      : '';
    const gameType = view.round;

    return {
      tournamentName: t.name,
      away, home, awayScore, homeScore, hasScore,
      awayWin: hasScore && awayScore > homeScore,
      homeWin: hasScore && homeScore > awayScore,
      statusLabel, isLive, isUnofficial,
      primary: theme.primary,
      rgb: theme.primaryRgb,
      metaLine: [dateLabel, gameType, game.location].filter(Boolean).join('  ·  '),
    };
  } catch {
    return null;
  }
}

export default async function Image({
  params,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string; gameId: string }>;
}) {
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

  const row = (name: string, score: number, win: boolean, dim: boolean) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
      <div style={{
        width: 96, height: 96, borderRadius: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: teamColor(name), color: '#fff', fontSize: 40, fontWeight: 800,
      }}>
        {teamInitials(name)}
      </div>
      <div style={{ display: 'flex', flex: 1, minWidth: 0, fontSize: 56, fontWeight: 800, color: dim ? 'rgba(255,255,255,0.5)' : '#fff' }}>
        {name}
      </div>
      {c.hasScore && (
        <div style={{ display: 'flex', fontSize: 116, fontWeight: 800, color: dim ? 'rgba(255,255,255,0.4)' : (win ? '#fff' : 'rgba(255,255,255,0.85)') }}>
          {score}
        </div>
      )}
    </div>
  );

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: 64,
        backgroundColor: '#0A0A12',
        backgroundImage: `linear-gradient(135deg, rgba(${c.rgb},0.34) 0%, rgba(${c.rgb},0.08) 45%, rgba(10,10,18,0) 78%)`,
        fontFamily: 'sans-serif',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 10, background: c.primary }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', color: 'rgba(255,255,255,0.72)', fontSize: 30, fontWeight: 700, letterSpacing: 1 }}>
            {c.tournamentName.toUpperCase()}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', padding: '10px 22px', borderRadius: 12, fontSize: 26, fontWeight: 800,
            color: c.isLive ? '#FCA5A5' : c.isUnofficial ? '#FCD34D' : '#86EFAC',
            background: c.isLive ? 'rgba(239,68,68,0.16)' : c.isUnofficial ? 'rgba(245,158,11,0.16)' : 'rgba(34,197,94,0.16)',
            border: `2px solid ${c.isLive ? 'rgba(239,68,68,0.5)' : c.isUnofficial ? 'rgba(245,158,11,0.5)' : 'rgba(34,197,94,0.5)'}`,
          }}>
            {c.statusLabel}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, flex: 1, justifyContent: 'center' }}>
          {row(c.away, c.awayScore, c.awayWin, c.homeWin)}
          <div style={{ display: 'flex', height: 2, background: 'rgba(255,255,255,0.12)' }} />
          {row(c.home, c.homeScore, c.homeWin, c.awayWin)}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', color: 'rgba(255,255,255,0.5)', fontSize: 26 }}>{c.metaLine}</div>
          <div style={{ display: 'flex', color: 'rgba(255,255,255,0.62)', fontSize: 24, fontWeight: 700 }}>Live on FieldLogicHQ</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
