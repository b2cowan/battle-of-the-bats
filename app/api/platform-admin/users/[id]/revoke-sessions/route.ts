import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPermission } from '@/lib/platform-auth';
import { writePlatformAuditLog } from '@/lib/platform-audit';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePlatformPermission('manage_support');
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await req.json() as { email?: string };

  // GoTrue admin DELETE /sessions endpoint — invalidates all sessions for this user.
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users/${id}/sessions`,
    {
      method: 'DELETE',
      headers: {
        apikey:        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      },
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    console.error('[platform-admin] revoke-sessions error:', response.status, text);
    return NextResponse.json(
      { error: `Failed to revoke sessions (${response.status})` },
      { status: 500 },
    );
  }

  await writePlatformAuditLog(
    auth.user.email!,
    null,
    'revoke_sessions',
    'user_id',
    null,
    body.email ?? id,
  );

  return NextResponse.json({ ok: true });
}
