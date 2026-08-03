import { NextResponse } from 'next/server';
import { resolveCoachTeamAssignment } from '@/lib/coach-route-context';
import {
  getRepTeamPlanTemplateById,
  getRepTeamPlanTemplateUsage,
  updateRepTeamPlanTemplate,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canManageSchedule, canWriteDevelopment } from '@/lib/coach-capabilities';
import { planToTemplateShape, validatePlanTemplateInput } from '@/lib/rep-plan-templates';
import { MAX_TAGS_PER_ITEM, uniqueIds } from '@/lib/rep-drills';

/**
 * One plan template — read it to edit, PATCH to rename, re-tag, rewrite the shape, retire or
 * restore (Practice Plans Phase 3).
 *
 * ⚠ **RETIRE, NEVER DELETE.** There is no DELETE verb and mig 221 grants no delete policy. Plans
 * already started from a template are unaffected either way — a plan COPIES the shape rather than
 * referencing it — but retiring keeps "Started 8 plans" readable, and a retired template dims in
 * place in the room rather than vanishing.
 *
 * ⚠ Live-season only, like its collection route: a template library is an INSTRUMENT.
 */
/** The SHARED coach-team prefix — see the collection route for why it takes no program year. */
const resolveContext = resolveCoachTeamAssignment;

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; templateId: string }> },) => {
  const { orgSlug, teamId, templateId } = await params;
  const resolved = await resolveContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { assignment } = resolved;
  const denied = denyUnless(canManageSchedule(assignment.capabilities), 'You do not have access to the schedule.');
  if (denied) return denied;

  // ⚠ A TARGETED usage read, not the library-wide walk the list route uses. Answering "how many
  // plans did THIS template start" by pulling up to 400 events with their full plan jsonb and
  // parsing every one is the right query for the list and the wrong one here.
  const [template, use] = await Promise.all([
    getRepTeamPlanTemplateById(templateId, teamId),
    getRepTeamPlanTemplateUsage(templateId, teamId).catch(() => ({ planCount: 0, lastPlannedAt: null })),
  ]);
  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

  return NextResponse.json({
    template: {
      ...template,
      planCount: use.planCount,
      lastPlannedAt: use.lastPlannedAt,
    },
    canWrite: canWriteDevelopment(assignment.capabilities),
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/development/plan-templates/[templateId]' });

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; templateId: string }> },) => {
  const { orgSlug, teamId, templateId } = await params;
  const resolved = await resolveContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignment } = resolved;
  const denied = denyUnless(canWriteDevelopment(assignment.capabilities), 'Only the head coach can manage plan templates.');
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  /**
   * ⚠ Field-by-field, and every absent key means "leave it alone".
   *
   * A retire/restore must not blank a template's name, shape or vocabulary, and the room's rename
   * box must not wipe its blocks. Validating the whole payload as if it were a create would do
   * exactly that — the drill route's `updateRepTeamDrill` draws the same line.
   */
  const patch: Parameters<typeof updateRepTeamPlanTemplate>[2] = {};

  if (body.name !== undefined) {
    const parsed = validatePlanTemplateInput({ name: body.name });
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    patch.name = parsed.template.name;
  }
  // Emptied of people on the way in — a template carries the shape and the teaching, never the
  // roster (D20, one level up from a drill).
  if (body.plan !== undefined) patch.plan = planToTemplateShape(body.plan);
  if (body.tagIds !== undefined) patch.tagIds = uniqueIds(body.tagIds, MAX_TAGS_PER_ITEM);
  if (typeof body.isActive === 'boolean') patch.isActive = body.isActive;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 });
  }

  try {
    const template = await updateRepTeamPlanTemplate(templateId, { orgId: ctx.org.id, teamId }, patch);
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    return NextResponse.json({ template });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === '23505') {
      return NextResponse.json(
        { error: `You already have a template called “${patch.name ?? ''}”.` },
        { status: 409 },
      );
    }
    throw error;
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/development/plan-templates/[templateId]' });
