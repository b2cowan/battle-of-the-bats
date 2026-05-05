import { NextRequest, NextResponse } from 'next/server';
import { getPlatformAuthContext } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

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

  const { error } = await supabaseAdmin
    .from('organizations')
    .update({ plan_id: planId, tournament_limit: tournamentLimit })
    .eq('id', id);

  if (error) {
    console.error('[platform-admin] org plan update error:', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
