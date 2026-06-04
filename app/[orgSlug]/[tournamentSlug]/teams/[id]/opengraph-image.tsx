import { ImageResponse } from 'next/og';
import { getPublicTournamentPageData } from '@/lib/public-tournament-data';
import { resolveTheme } from '@/lib/themes';
import { teamColor, teamInitials } from '@/lib/team-color';

export const alt = 'Team';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface CardData {
  name: string;
  tournamentName: string;
  divisionName: string;
  w: number;
  l: number;
  t: number;
  rgb: string;
  primary: string;
}

async function loadCard(params: Promise<{ orgSlug: string; tournamentSlug: string; id: string }>): Promise<CardData | null> {
  try {
    const { orgSlug, tournamentSlug, id } = await params;
    const data = await getPublicTournamentPageData(orgSlug, tournamentSlug, 'schedule');
    if (!data?.tournament) return null;

    const team = data.teams.find(t => t.id === id);
    if (!team) return null;

    let w = 0, l = 0, tie = 0;
    for (const g of data.games) {
      if (g.homeScore == null || g.awayScore == null) continue;
      if (g.status !== 'completed' && g.status !== 'submitted') continue;
      const isHome = g.homeTeamId === id;
      const isAway = g.awayTeamId === id;
      if (!isHome && !isAway) continue;
      const my = isHome ? g.homeScore : g.awayScore;
      const opp = isHome ? g.awayScore : g.homeScore;
      if (my === opp) tie++;
      else if (my > opp) w++;
      else l++;
    }

    const division = data.divisions.find(d => d.id === team.divisionId);
    const theme = resolveTheme(data.tournament.themePreset, data.tournament.themePrimary, data.tournament.themeAccent);
    const clean = team.name.replace(/\s*\([^)]*\)\s*/g, ' ').trim() || team.name;

    return {
      name: clean,
      tournamentName: data.tournament.name,
      divisionName: division?.name ?? '',
      w, l, t: tie,
      rgb: theme.primaryRgb,
      primary: theme.primary,
    };
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ orgSlug: string; tournamentSlug: string; id: string }> }) {
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

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: 72,
        backgroundColor: '#0A0A12',
        backgroundImage: `linear-gradient(135deg, rgba(${c.rgb},0.38) 0%, rgba(${c.rgb},0.1) 48%, rgba(10,10,18,0) 80%)`,
        fontFamily: 'sans-serif',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 12, background: c.primary }} />

        <div style={{ display: 'flex', color: 'rgba(255,255,255,0.7)', fontSize: 28, fontWeight: 700, letterSpacing: 1 }}>
          {c.tournamentName.toUpperCase()}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 44, flex: 1 }}>
          <div style={{
            width: 200, height: 200, borderRadius: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: teamColor(c.name), color: '#fff', fontSize: 92, fontWeight: 800, flexShrink: 0,
          }}>
            {teamInitials(c.name)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', fontSize: 78, fontWeight: 800, color: '#fff', lineHeight: 1.05 }}>{c.name}</div>
            {c.divisionName && <div style={{ display: 'flex', fontSize: 34, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>{c.divisionName}</div>}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <div style={{ display: 'flex', fontSize: 60, fontWeight: 800, color: '#fff' }}>{c.w}-{c.l}-{c.t}</div>
            <div style={{ display: 'flex', fontSize: 24, fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.5)' }}>RECORD</div>
          </div>
          <div style={{ display: 'flex', color: 'rgba(255,255,255,0.62)', fontSize: 26, fontWeight: 700 }}>Follow on FieldLogicHQ</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
