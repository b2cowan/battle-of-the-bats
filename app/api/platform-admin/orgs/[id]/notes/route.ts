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
  const body = await req.json() as { notes?: string };
  if (typeof body.notes !== 'string') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { data: current } = await supabaseAdmin
    .from('organizations')
    .select('internal_notes')
    .eq('id', id)
    .single();

  const { error } = await supabaseAdmin
    .from('organizations')
    .update({ internal_notes: body.notes || null })
    .eq('id', id);

  if (error) {
    console.error('[platform-admin] notes update error:', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  await writePlatformAuditLog(
    user.email!,
    id,
    'update_notes',
    'internal_notes',
    (current as any)?.internal_notes ?? null,
    body.notes || null,
  );

  return NextResponse.json({ ok: true });
}
