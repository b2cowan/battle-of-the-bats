import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin, requirePlatformPermission } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { withObservability } from '@/lib/observability';

const MAX_NOTE_LENGTH = 4000;

export const GET = withObservability(async (_req: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from('platform_user_notes')
    .select('id, body, created_by_email, created_at')
    .eq('user_id', id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[platform-admin] user-notes GET error:', error);
    return NextResponse.json({ error: 'Failed to load notes' }, { status: 500 });
  }

  return NextResponse.json({ notes: data ?? [] });
}, { route: '/api/platform-admin/users/[id]/notes' });

export const POST = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformPermission('manage_support');
  if (auth.response) return auth.response;

  const { id } = await params;
  const payload = await req.json().catch(() => ({})) as { body?: string };
  const body = typeof payload.body === 'string' ? payload.body.trim().slice(0, MAX_NOTE_LENGTH) : null;

  if (!body) {
    return NextResponse.json({ error: 'Note body is required.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('platform_user_notes')
    .insert({ user_id: id, body, created_by_email: auth.user.email! })
    .select('id, body, created_by_email, created_at')
    .single();

  if (error) {
    console.error('[platform-admin] user-notes POST error:', error);
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
  }

  await writePlatformAuditLog(auth.user.email!, null, 'create_user_note', 'user_id', null, id);

  return NextResponse.json({ note: data });
}, { route: '/api/platform-admin/users/[id]/notes' });
