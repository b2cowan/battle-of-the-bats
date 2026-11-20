import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { withObservability } from '@/lib/observability';
import { closeDeletionRequest, readOpenDeletionRequest } from '@/lib/org-deletion-requests';

/**
 * Staff close an owner's open deletion request (Settings in both workspaces Session 1, gate 2 "as recommended" 2026-11-20):
 * Mark answered (we replied) or Mark withdrawn (the owner no longer wants it). The owner's "Request sent" line then goes,
 * and they can send a new request. Written to the staff log with the reason every staff change carries.
 */
export const PATCH = withObservability(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformPower('club_support');
  if (auth.response) return auth.response;
  const { id } = await params;

  const body = await req.json().catch(() => ({})) as { requestId?: unknown; status?: unknown; reason?: unknown };
  const status = body.status === 'answered' || body.status === 'withdrawn' ? body.status : null;
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 1000) : '';
  if (!status || typeof body.requestId !== 'string') return NextResponse.json({ error: 'Choose answered or withdrawn.' }, { status: 400 });
  if (!reason) return NextResponse.json({ error: 'Say why — every staff change carries a reason.' }, { status: 400 });

  const open = await readOpenDeletionRequest(id);
  if (!open || open.id !== body.requestId) return NextResponse.json({ error: 'This request is no longer open. Reload the page.' }, { status: 409 });
  if (!await closeDeletionRequest(open.id, status, auth.user.email ?? 'platform-admin')) {
    return NextResponse.json({ error: 'This request is no longer open. Reload the page.' }, { status: 409 });
  }
  await writePlatformAuditLog(auth.user.email!, id, `deletion_request_${status}`, 'deletion_request', 'sent', status, { reason });
  return NextResponse.json({ ok: true, notice: status === 'answered' ? 'Deletion request marked answered.' : 'Deletion request marked withdrawn.' });
}, { route: '/api/platform-admin/orgs/[id]/deletion-request' });
