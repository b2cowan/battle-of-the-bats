import { NextRequest, NextResponse } from 'next/server';
import { getPlatformAuthContext } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { writePlatformAuditLog } from '@/lib/platform-audit';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getPlatformAuthContext();
  if (!user) return new NextResponse('Forbidden', { status: 403 });

  const { id } = await params;
  const body = await req.json() as { planId?: string; tournamentLimit?: number };
  const { planId, tournamentLimit } = body;

  if (!planId || typeof tournamentLimit !== 'number') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { data: current } = await supabaseAdmin
    .from('organizations')
    .select('plan_id, tournament_limit')
    .eq('id', id)
    .single();

  const { error } = await supabaseAdmin
    .from('organizations')
    .update({ plan_id: planId, tournament_limit: tournamentLimit })
    .eq('id', id);

  if (error) {
    console.error('[platform-admin] org plan update error:', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  await writePlatformAuditLog(user.email!, id, 'update_plan', 'plan_id',
    (current as any)?.plan_id, planId);
  if ((current as any)?.tournament_limit !== tournamentLimit) {
    await writePlatformAuditLog(user.email!, id, 'update_plan', 'tournament_limit',
      (current as any)?.tournament_limit, tournamentLimit);
  }

  return NextResponse.json({ ok: true });
}
