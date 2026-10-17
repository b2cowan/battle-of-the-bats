import { NextResponse } from 'next/server';
import { requireFamiliesAccess } from '@/lib/families-auth';
import { coachAskPreview, sendCoachAsk } from '@/lib/families-coach-ask';
import { withObservability } from '@/lib/observability';
import { writeOrgAudit } from '@/lib/org-audit';

export const dynamic = 'force-dynamic';

/**
 * Families' Ask the coaches (Club Tier Stage 5b, Ask 4 — lib/families-coach-ask.ts holds the rules).
 *   GET  — who it reaches: a row per team with its head coach and the players the email names, the sample, Last sent.
 *   POST — { teamIds } the teams the window showed: claim, email each head coach, bell them, complete the log.
 * Gated as every Families route (`requireFamiliesAccess`): the people who see the no-family list are the ones who ask.
 */
export const GET = withObservability(async (req: Request) => {
  const gate = await requireFamiliesAccess(req);
  if ('failure' in gate) return gate.failure;
  return NextResponse.json(await coachAskPreview(gate.ctx));
}, { route: '/api/admin/families/coach-ask' });

export const POST = withObservability(async (req: Request) => {
  const gate = await requireFamiliesAccess(req);
  if ('failure' in gate) return gate.failure;
  const { ctx } = gate;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const result = await sendCoachAsk(ctx, body.teamIds);
  if (!result.ok) return NextResponse.json(result.body, { status: result.status });
  // The club's audit log: counts only — never the children's names.
  await writeOrgAudit(ctx.org.id, ctx.user.id, null, 'families_coaches_asked', { teams: result.teams, coaches: result.coaches });
  return NextResponse.json(result);
}, { route: '/api/admin/families/coach-ask' });
