import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPermission } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { writePlatformAuditLog } from '@/lib/platform-audit';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const auth = await requirePlatformPermission('manage_support');
  if (auth.response) return auth.response;

  const { id, noteId } = await params;

  const { error } = await supabaseAdmin
    .from('platform_user_notes')
    .delete()
    .eq('id', noteId)
    .eq('user_id', id);

  if (error) {
    console.error('[platform-admin] user-note DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
  }

  await writePlatformAuditLog(auth.user.email!, null, 'delete_user_note', 'note_id', noteId, null);

  return NextResponse.json({ ok: true });
}
