import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { cancelPractice } from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ seasonId: string; practiceId: string }> },
) {
  const { practiceId } = await params;
  const ctx = await getAuthContextWithRole();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_house_league'))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (ctx.role !== 'owner' && ctx.role !== 'league_admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { action, scope = 'one' } = await req.json();
  if (action !== 'cancel')
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  if (!['one', 'remaining', 'all'].includes(scope))
    return NextResponse.json({ error: 'Invalid scope' }, { status: 400 });

  await cancelPractice(practiceId, scope as 'one' | 'remaining' | 'all');
  return NextResponse.json({ ok: true });
}
