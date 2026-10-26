import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { giveFreeTime } from '@/lib/free-time-writes';
import { withObservability } from '@/lib/observability';

export const GET = withObservability(async (_req: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformPower('club_billing');
  if (auth.response) return auth.response;

  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from('org_overrides')
    .select('*')
    .eq('org_id', id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[platform-admin] overrides list error:', error);
    return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
  }

  return NextResponse.json({ overrides: data ?? [] });
}, { route: '/api/platform-admin/orgs/[id]/overrides' });

/**
 * Give free time (Support console Stage 4): a whole plan, sections or a billing status, through a last free day, with a
 * reason. The rules and every refusal are `giveFreeTime` (lib/free-time-writes.ts). The body carries the last free day as
 * `YYYY-MM-DD`: the server turns it into the end of that day in Eastern time and refuses an instant. The club is the
 * address's `[id]`, never the body.
 */
export const POST = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformPower('club_billing');
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    kind?: unknown; plan?: unknown; addons?: unknown; last_day?: unknown; reason?: unknown;
  };
  const result = await giveFreeTime({
    orgId: id,
    kind: body.kind,
    plan: body.plan,
    addons: body.addons,
    lastDay: body.last_day,
    reason: body.reason,
    actor: { id: auth.user.id, email: auth.user.email!, role: auth.role },
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ override: result.override });
}, { route: '/api/platform-admin/orgs/[id]/overrides' });
