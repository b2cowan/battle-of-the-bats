import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getActiveRepProgramYear,
  getCoachingAssignmentsForUser,
  getRepRosterPlayers,
  getRepTeam,
  deleteRepTeamLineupTemplate,
  updateRepTeamLineupTemplate,
} from '@/lib/db';
import type { RepLineupMode, RepTeamLineupTemplateEntry } from '@/lib/types';
import { withObservability } from '@/lib/observability';
import { denyUnless } from '@/lib/coach-capabilities';
import { cleanTemplateEntries } from '@/lib/lineup-template-entries';

const VALID_LINEUP_MODES: RepLineupMode[] = ['nine_player', 'everyone_bats'];

// Shared auth/context for the mutating verbs on a single template.
async function resolveTemplateContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };
  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }
  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: forbidden() };
  const denied = denyUnless(assignment.capabilities.lineups, 'You do not have access to lineups.');
  if (denied) return { error: denied };
  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }
  return { ctx, team, assignment, programYear };
}

export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; templateId: string }> },) => {
  const { orgSlug, teamId, templateId } = await params;
  const resolved = await resolveTemplateContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  // Delete is scoped by team_id, so a template can only be removed by a coach of its own team.
  await deleteRepTeamLineupTemplate(templateId, teamId);
  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/lineup-templates/[templateId]' });

// Update a template — rename only ({ name }) from the manager, or a full edit-save ({ name,
// lineupMode, inningCount, entries }) from the template builder. Scoped by team_id. Entry SHAPE is
// sanitized in the DB layer; the builder UI only offers valid positions.
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; templateId: string }> },) => {
  const { orgSlug, teamId, templateId } = await params;
  const resolved = await resolveTemplateContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { programYear } = resolved;

  const body = await req.json().catch(() => ({}));
  const patch: { name?: string; lineupMode?: RepLineupMode; inningCount?: number; entries?: RepTeamLineupTemplateEntry[] } = {};

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name.length < 1 || name.length > 80) {
      return NextResponse.json({ error: 'Template name must be 1–80 characters' }, { status: 400 });
    }
    patch.name = name;
  }
  if (body.lineupMode !== undefined) {
    if (!VALID_LINEUP_MODES.includes(body.lineupMode)) {
      return NextResponse.json({ error: 'Invalid lineup mode' }, { status: 400 });
    }
    patch.lineupMode = body.lineupMode;
  }
  if (body.inningCount !== undefined) {
    const n = Number(body.inningCount);
    if (!Number.isInteger(n) || n < 1 || n > 12) {
      return NextResponse.json({ error: 'Inning count must be between 1 and 12' }, { status: 400 });
    }
    patch.inningCount = n;
  }
  if (body.entries !== undefined) {
    // Entries are validated with the SAME contract as create (roster membership, no duplicates,
    // batting-order range, mode-consistent starters, whitelisted positions) — needs the mode +
    // inning count to check against, so a full edit-save must send them together.
    if (patch.lineupMode === undefined || patch.inningCount === undefined) {
      return NextResponse.json({ error: 'lineupMode and inningCount are required when updating a template’s players' }, { status: 400 });
    }
    const activePlayerIds = new Set(
      (await getRepRosterPlayers(programYear.id)).filter(p => p.status === 'active').map(p => p.id),
    );
    try {
      patch.entries = cleanTemplateEntries(body.entries, { activePlayerIds, lineupMode: patch.lineupMode, inningCount: patch.inningCount });
    } catch (error: unknown) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid template entries' }, { status: 400 });
    }
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const updated = await updateRepTeamLineupTemplate(templateId, teamId, patch);
  if (!updated) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  return NextResponse.json({ template: updated });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/lineup-templates/[templateId]' });
