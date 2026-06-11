import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { sendEmail, orgDeletionRequestHtml } from '@/lib/email';
import { PLAN_CONFIG } from '@/lib/plan-config';
import type { OrgPlan } from '@/lib/types';
import { withObservability } from '@/lib/observability';

export const POST = withObservability(async (req: Request) => {
  const ctx = await getAuthContextWithRole();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner') return forbidden();

  const body = await req.json().catch(() => ({}));
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 1000) : '';

  const ownerEmail = ctx.user.email ?? '(unknown)';
  const supportEmail = 'fieldlogichq@gmail.com';
  const planLabel = PLAN_CONFIG[ctx.org.planId as OrgPlan]?.label ?? ctx.org.planId;

  await sendEmail(
    supportEmail,
    `[FieldLogicHQ] Org deletion request — ${ctx.org.name}`,
    orgDeletionRequestHtml({
      orgName: ctx.org.name,
      orgSlug: ctx.org.slug,
      orgId: ctx.org.id,
      ownerEmail,
      planLabel,
      reason,
      requestedAt: new Date().toISOString(),
    }),
  );

  return NextResponse.json({ ok: true });
}, { route: '/api/admin/org/request-deletion' });
