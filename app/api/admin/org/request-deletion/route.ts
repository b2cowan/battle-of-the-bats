import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { withObservability } from '@/lib/observability';
import { endingSection } from '@/lib/online-payment-endings';
import {
  readOpenDeletionRequest, ownerView, deletionOwnerCount, deletionExportFrom, sendDeletionRequest,
} from '@/lib/org-deletion-requests';

/**
 * THE DELETION REQUEST (Settings in both workspaces Session 1; mig 514). Owner only, every workspace: the Premium Coaches
 * Portal's and the Tournament plans' Plan & billing, and the club's Settings card.
 *
 * GET — what the section and the window read: the open request (the "Request sent" line), how many owners the reply goes
 *       to, the online-payments part (12d-2, words §4.4) and which page its export line names.
 * POST — records the request, emails privacy@, acknowledges it to every active owner. A second request while one is open
 *       returns the open one (200, `alreadyOpen`), never a second record or a second email.
 */
export const GET = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner') return forbidden();
  const [open, ownerCount, onlinePayments] = await Promise.all([
    readOpenDeletionRequest(ctx.org.id),
    deletionOwnerCount(ctx.org.id),
    endingSection(ctx.org.id, { includeDisconnected: true }),
  ]);
  return NextResponse.json({
    request: ownerView(open),
    ownerCount,
    viewerEmail: ctx.user.email ?? '',
    onlinePayments,
    exportFrom: deletionExportFrom(ctx.org),
  });
}, { route: '/api/admin/org/request-deletion' });

export const POST = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner') return forbidden();

  const body = await req.json().catch(() => ({}));
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 1000) : '';
  const email = ctx.user.email?.trim();
  if (!email) return NextResponse.json({ error: 'Your account has no email address to reply to.' }, { status: 400 });

  const result = await sendDeletionRequest({ org: ctx.org, userId: ctx.user.id, email, reason });
  return NextResponse.json({ ok: true, request: ownerView(result.request), alreadyOpen: result.status === 'already_open' });
}, { route: '/api/admin/org/request-deletion' });
