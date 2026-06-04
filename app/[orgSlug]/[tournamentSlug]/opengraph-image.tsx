import { ImageResponse } from 'next/og';
import { getPublicTournamentPageData } from '@/lib/public-tournament-data';
import { resolveTheme } from '@/lib/themes';

export const alt = 'Tournament';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface CardData {
  name: string;
  orgName: string;
  dateLabel: string;
  teamCount: number;
  divisionCount: number;
  primary: string;
  rgb: string;
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

async function loadCard(params: Promise<{ orgSlug: string; tournamentSlug: string }>): Promise<CardData | null> {
  try {
    const { orgSlug, tournamentSlug } = await params;
    const data = await getPublicTournamentPageData(orgSlug, tournamentSlug, 'teams');
    if (!data?.tournament) return null;
    const t = data.tournament;
    const theme = resolveTheme(t.themePreset, t.themePrimary, t.themeAccent);
    return {
      name: t.name,
      orgName: data.organization?.name ?? '',
      dateLabel: fmtRange(t.startDate, t.endDate),
      teamCount: data.teams?.length ?? 0,
      divisionCount: data.divisions?.length ?? 0,
      primary: theme.primary,
      rgb: theme.primaryRgb,
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
