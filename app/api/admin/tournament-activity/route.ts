import { NextResponse } from 'next/server';
import { getAuthContextWithScope, unauthorized, scopeGuard } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export type ActivityEvent = {
  id: string;
  type: 'registration' | 'score' | 'game_complete' | 'announcement';
  message: string;
  timestamp: string;
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const orgSlug = searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug });
  if (!ctx) return unauthorized();

  const tournamentId = searchParams.get('tournamentId');
  if (!tournamentId) return NextResponse.json([]);

  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;

  const limit = Math.min(parseInt(searchParams.get('limit') ?? '30', 10), 50);

  const [teamsRes, gamesRes, announcementsRes] = await Promise.all([
    supabaseAdmin
      .from('teams')
      .select('id, name, created_at, age_groups(name)')
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: false })
      .limit(limit),

    supabaseAdmin
      .from('games')
      .select('id, home_score, away_score, status, updated_at')
      .eq('tournament_id', tournamentId)
      .not('home_score', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(limit),

    supabaseAdmin
      .from('announcements')
      .select('id, title, created_at')
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const events: ActivityEvent[] = [];

  for (const row of teamsRes.data ?? []) {
    const ag = Array.isArray(row.age_groups) ? row.age_groups[0] : row.age_groups;
    const division = (ag as { name?: string } | null)?.name;
    events.push({
      id: `reg-${row.id}`,
      type: 'registration',
      message: division ? `${row.name} registered for ${division}` : `${row.name} registered`,
      timestamp: row.created_at,
    });
  }

  for (const row of gamesRes.data ?? []) {
    const ts = row.updated_at ?? new Date().toISOString();
    if (row.status === 'completed') {
      events.push({
        id: `gc-${row.id}`,
        type: 'game_complete',
        message: `Game final: ${row.home_score ?? 0} – ${row.away_score ?? 0}`,
        timestamp: ts,
      });
    } else {
      events.push({
        id: `sc-${row.id}`,
        type: 'score',
        message: `Score updated: ${row.home_score ?? 0} – ${row.away_score ?? 0}`,
        timestamp: ts,
      });
    }
  }

  for (const row of announcementsRes.data ?? []) {
    events.push({
      id: `ann-${row.id}`,
      type: 'announcement',
      message: `Announcement posted: "${row.title}"`,
      timestamp: row.created_at,
    });
  }

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return NextResponse.json(
    events.slice(0, limit).map(e => ({ ...e, timeAgo: timeAgo(e.timestamp) }))
  );
}
