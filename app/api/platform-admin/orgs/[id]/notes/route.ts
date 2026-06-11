import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin, requirePlatformPermission } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { withObservability } from '@/lib/observability';

const MAX_NOTE_LENGTH = 4000;

function cleanNoteBody(value: unknown) {
  if (typeof value !== 'string') return null;
  const body = value.trim();
  if (!body) return null;
  return body.slice(0, MAX_NOTE_LENGTH);
}

export const GET = withObservability(async (_req: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const { data, error } = await supabaseAdmin
    .from('org_internal_notes')
    .select('id, body, created_by_email, updated_by_email, created_at, updated_at')
    .eq('org_id', id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[platform-admin] notes list error:', error);
    return NextResponse.json({ error: 'Load failed' }, { status: 500 });
  }

  return NextResponse.json({ notes: data ?? [] });
}, { route: '/api/platform-admin/orgs/[id]/notes' });

export const POST = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformPermission('manage_support');
  if (auth.response) return auth.response;

  const { id } = await params;
  const payload = await req.json().catch(() => ({})) as { body?: string; notes?: string };
  const body = cleanNoteBody(payload.body ?? payload.notes);
  if (!body) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('org_internal_notes')
    .insert({
      org_id: id,
      body,
      created_by_email: auth.user.email ?? 'platform-admin',
      updated_by_email: auth.user.email ?? 'platform-admin',
    })
    .select('id, body, created_by_email, updated_by_email, created_at, updated_at')
    .single();

  if (error) {
    console.error('[platform-admin] notes create error:', error);
    return NextResponse.json({ error: 'Create failed' }, { status: 500 });
  }

  await writePlatformAuditLog(
    auth.user.email ?? 'platform-admin',
    id,
    'create_internal_note',
    'org_internal_notes',
    null,
    data,
  );

  return NextResponse.json({ note: data });
}, { route: '/api/platform-admin/orgs/[id]/notes' });
