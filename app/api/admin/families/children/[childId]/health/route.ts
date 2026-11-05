import { NextResponse } from 'next/server';
import { requireFamiliesAccess } from '@/lib/families-auth';
import { confirmChildHealth } from '@/lib/child-page';
import { HEALTH_NOTHING_TO_CONFIRM } from '@/lib/child-page-words';
import { isUuid } from '@/lib/utils';
import { withObservability } from '@/lib/observability';
import { writeOrgAudit } from '@/lib/org-audit';

export const dynamic = 'force-dynamic';

/**
 * The club's "Still right for the {season}?" Confirm (Club Tier Stage 14 S5, call C). The medical note and emergency
 * contact are the child's ONE value, so the club's Confirm stamps every live entry of the child that is not stamped yet —
 * every coach's question goes with it. It changes no value (a value is changed where it is typed: the coach's Safety).
 *   POST — anyone who can open Families. 404 another org's child; 409 nothing to confirm.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ childId: string }> },) => {
  const gate = await requireFamiliesAccess(req);
  if ('failure' in gate) return gate.failure;
  const { childId } = await params;
  if (!isUuid(childId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const stamped = await confirmChildHealth(gate.ctx.org.id, childId, gate.ctx.user.id);
  if (stamped < 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (stamped === 0) return NextResponse.json({ error: HEALTH_NOTHING_TO_CONFIRM, code: 'nothing_to_confirm' }, { status: 409 });
  // Counts and the child's id only — never the health values or names.
  await writeOrgAudit(gate.ctx.org.id, gate.ctx.user.id, null, 'families_child_health_confirmed', { childId, stamped });
  return NextResponse.json({ ok: true, stamped });
}, { route: '/api/admin/families/children/[childId]/health' });
