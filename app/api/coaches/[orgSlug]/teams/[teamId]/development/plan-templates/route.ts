import { NextResponse } from 'next/server';
import { resolveCoachTeamAssignment } from '@/lib/coach-route-context';
import {
  getRepTeamPlanTemplates,
  createRepTeamPlanTemplate,
  getRepTeamPracticePlansAcrossSeasons,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canManageSchedule, canWriteDevelopment } from '@/lib/coach-capabilities';
import {
  MAX_TEMPLATES_PER_TEAM, countTemplateUses, validatePlanTemplateInput,
} from '@/lib/rep-plan-templates';

/**
 * Plan templates — the practice shape a coach saves and starts from again (Phase 3, mig 221).
 *
 * ── Capabilities (§8, D3 — NO new capability key) ──
 *   READ  → `schedule`. A template is practice content, and an assistant who can open Tuesday's
 *           practice can already read every word a loaded template put on it.
 *   WRITE → HEAD COACH ONLY (`canWriteDevelopment`). Managing the library IS a write.
 * ⚠ RLS mirrors both (mig 221), so a direct PostgREST call from an assistant's session can't
 * bypass this — the mig-141 chat-engine lesson.
 *
 * ⚠ **THE ARCHIVE DOOR — decided, not discovered.** This route deliberately does NOT use
 * `resolveCoachTeamRead`, so it resolves the team's live context and cannot serve a past season.
 * A template library is a reusable INSTRUMENT, not a record of a season (owner ruling 2026-08-01),
 * so the Development hub hides its door in a completed season. That costs a coach nothing: the
 * table is keyed by TEAM, not by program year, so a team's templates cross a rollover with nothing
 * to import — the same discovery that made the drill library's archive ruling cheap.
 *
 * ⚠ The ONE deliberate cross-season read is `getRepTeamPracticePlansAcrossSeasons`, which counts
 * how many plans each template has started. It reads the team's own records and writes nothing
 * into a finished season.
 */
/**
 * ⚠ The SHARED coach-team prefix, not a fourth hand-copy of it — and deliberately the variant that
 * does NOT require an active program year. Templates belong to the TEAM, so a coach between
 * seasons must still be able to open and manage their library; demanding a live season here would
 * take the room away every autumn, which is the exact failure the team-scoped table exists to
 * avoid.
 */
const resolveContext = resolveCoachTeamAssignment;

export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { assignment } = resolved;
  const denied = denyUnless(canManageSchedule(assignment.capabilities), 'You do not have access to the schedule.');
  if (denied) return denied;

  const includeRetired = new URL(req.url).searchParams.get('all') === '1';

  const [templates, plans] = await Promise.all([
    getRepTeamPlanTemplates(teamId, { includeRetired }),
    // Non-fatal: on a database without mig 213 this read names a column that does not exist and
    // errors rather than returning nothing. Losing the counts must not take the room down with
    // them — the templates themselves are the point. (The migration still has to precede the code
    // to prod; this is defence in depth, not a substitute.)
    getRepTeamPracticePlansAcrossSeasons(teamId).catch(() => []),
  ]);

  const uses = countTemplateUses(plans);
  return NextResponse.json({
    templates: templates.map(t => ({
      ...t,
      // ⚠ "Started N plans", never "used N×" — nothing records what was actually run (D4).
      planCount: uses.get(t.id)?.planCount ?? 0,
      lastPlannedAt: uses.get(t.id)?.lastPlannedAt ?? null,
    })),
    canWrite: canWriteDevelopment(assignment.capabilities),
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/development/plan-templates' });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignment } = resolved;
  const denied = denyUnless(canWriteDevelopment(assignment.capabilities), 'Only the head coach can manage plan templates.');
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // ⚠ An empty NAME is rejected here and never in the plan editor. That asymmetry is deliberate:
  // this is an explicit submit, so a nameless template is a mistake worth reporting; a plan's rows
  // exist because a coach pressed "Add" mid-autosave, so discarding one would be data loss.
  const parsed = validatePlanTemplateInput(body);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const existing = await getRepTeamPlanTemplates(teamId, { includeRetired: true });
  if (existing.filter(t => t.isActive).length >= MAX_TEMPLATES_PER_TEAM) {
    return NextResponse.json(
      { error: `You can keep up to ${MAX_TEMPLATES_PER_TEAM} templates. Retire one to add another.` },
      { status: 400 },
    );
  }

  try {
    const template = await createRepTeamPlanTemplate({
      orgId: ctx.org.id,
      teamId,
      name: parsed.template.name,
      // `undefined` means "no shape supplied" — an empty template the coach is about to build in
      // the room. `validatePlanTemplateInput` has already emptied it of people either way.
      plan: parsed.template.plan ?? { version: 1, blocks: [] },
      tagIds: parsed.template.tagIds,
      createdBy: ctx.user.id,
    });
    return NextResponse.json({ template: { ...template, planCount: 0, lastPlannedAt: null } }, { status: 201 });
  } catch (error: unknown) {
    // Partial unique index on ACTIVE names, case-insensitive → 409, matching the drill library.
    if ((error as { code?: string })?.code === '23505') {
      return NextResponse.json(
        { error: `You already have a template called “${parsed.template.name}”.` },
        { status: 409 },
      );
    }
    throw error;
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/development/plan-templates' });
