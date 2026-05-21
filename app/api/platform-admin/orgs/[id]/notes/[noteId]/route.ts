import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPermission } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { writePlatformAuditLog } from '@/lib/platform-audit';

const MAX_NOTE_LENGTH = 4000;

function cleanNoteBody(value: unknown) {
  if (typeof value !== 'string') return null;
  const body = value.trim();
  if (!body) return null;
  return body.slice(0, MAX_NOTE_LENGTH);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const auth = await requirePlatformPermission('manage_support');
  if (auth.response) return auth.response;

  const { id, noteId } = await params;
  const payload = await req.json().catch(() => ({})) as { body?: string };
  const body = cleanNoteBody(payload.body);
  if (!body) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { data: current, error: currentError } = await supabaseAdmin
    .from('org_internal_notes')
    .select('id, body')
    .eq('id', noteId)
    .eq('org_id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (currentError || !current) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  }

  const updatedAt = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('org_internal_notes')
    .update({
      body,
      updated_by_email: auth.user.email ?? 'platform-admin',
      updated_at: updatedAt,
    })
    .eq('id', noteId)
    .eq('org_id', id)
    .select('id, body, created_by_email, updated_by_email, created_at, updated_at')
    .single();

  if (error) {
    console.error('[platform-admin] note update error:', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  await writePlatformAuditLog(
    auth.user.email ?? 'platform-admin',
    id,
    'update_internal_note',
    'org_internal_notes',
    current,
    data,
  );

  return NextResponse.json({ note: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const auth = await requirePlatformPermission('manage_support');
  if (auth.response) return auth.response;

  const { id, noteId } = await params;
  const { data: current, error: currentError } = await supabaseAdmin
    .from('org_internal_notes')
    .select('id, body')
    .eq('id', noteId)
    .eq('org_id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (currentError || !current) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  }

  const deletedAt = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('org_internal_notes')
    .update({
      deleted_at: deletedAt,
      deleted_by_email: auth.user.email ?? 'platform-admin',
      updated_by_email: auth.user.email ?? 'platform-admin',
      updated_at: deletedAt,
    })
    .eq('id', noteId)
    .eq('org_id', id);

  if (error) {
    console.error('[platform-admin] note delete error:', error);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }

  await writePlatformAuditLog(
    auth.user.email ?? 'platform-admin',
    id,
    'delete_internal_note',
    'org_internal_notes',
    current,
    { id: noteId, deleted_at: deletedAt },
  );

  return NextResponse.json({ ok: true });
}
