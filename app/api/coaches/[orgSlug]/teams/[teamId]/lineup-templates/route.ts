import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getActiveRepProgramYear,
  getCoachingAssignmentsForUser,
  getRepRosterPlayers,
  getRepTeam,
  getRepTeamLineupTemplates,
  createRepTeamLineupTemplate,
} from '@/lib/db';
import type { RepLineupMode, RepTeamLineupTemplateEntry } from '@/lib/types';
import { withObservability } from '@/lib/observability';
import { denyUnless } from '@/lib/coach-capabilities';

const VALID_LINEUP_MODES: RepLineupMode[] = ['nine_player', 'everyone_bats'];
const VALID_POSITIONS = new Set([
  'P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'OF', 'DH', 'EH', 'Bench',
]);
const MAX_TEMPLATES_PER_SEASON = 50;

type RawTemplateEntry = {
  playerId?: unknown;
  battingOrder?: unknown;
  starter?: unknown;
  inningPositions?: unknown;
};

// Team-scoped coach guard (no event) — mirrors the lineup route's resolveCoachContext.
async function resolveTeamCoachContext(orgSlug: string, teamId: string) {
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

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }

  return { ctx, team, assignment, programYear };
}

function normalizeInningPositions(raw: unknown, inningCount: number): Record<string, string> {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  const next: Record<string, string> = {};
  for (let inning = 1; inning <= inningCount; inning += 1) {
    const value = source[String(inning)];
    if (typeof value !== 'string') continue;
    const position = value.trim();
    if (!position) continue;
    if (!VALID_POSITIONS.has(position)) throw new Error(`Invalid position for inning ${inning}`);
    next[String(inning)] = position;
  }
  return next;
}

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveTeamCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { assignment, programYear } = resolved;
  const denied = denyUnless(assignment.capabilities.lineups, 'You do not have access to lineups.');
  if (denied) return denied;

  const templates = await getRepTeamLineupTemplates(teamId, programYear.id);
  return NextResponse.json({ templates });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/lineup-templates' });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveTeamCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignment, programYear } = resolved;
  const denied = denyUnless(assignment.capabilities.lineups, 'You do not have access to lineups.');
  if (denied) return denied;

  const body = await req.json();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const lineupMode = body.lineupMode as RepLineupMode;
  const inningCount = Number(body.inningCount);
  const entries = Array.isArray(body.entries) ? body.entries : null;

  if (name.length < 1 || name.length > 80) {
    return NextResponse.json({ error: 'Template name must be 1–80 characters' }, { status: 400 });
  }
  if (!VALID_LINEUP_MODES.includes(lineupMode)) {
    return NextResponse.json({ error: 'Invalid lineup mode' }, { status: 400 });
  }
  if (!Number.isInteger(inningCount) || inningCount < 1 || inningCount > 12) {
    return NextResponse.json({ error: 'Inning count must be between 1 and 12' }, { status: 400 });
  }
  if (!entries) {
    return NextResponse.json({ error: 'entries must be an array' }, { status: 400 });
  }

  // Per-season cap (cheap abuse guard).
  const existing = await getRepTeamLineupTemplates(teamId, programYear.id);
  if (existing.length >= MAX_TEMPLATES_PER_SEASON) {
    return NextResponse.json(
      { error: `You can keep up to ${MAX_TEMPLATES_PER_SEASON} saved templates this season. Delete one to add another.` },
      { status: 400 },
    );
  }

  const players = (await getRepRosterPlayers(programYear.id)).filter(p => p.status === 'active');
  const activePlayerIds = new Set(players.map(p => p.id));
  const seen = new Set<string>();

  let cleanEntries: RepTeamLineupTemplateEntry[];
  try {
    cleanEntries = (entries as RawTemplateEntry[]).map(entry => {
      const playerId = typeof entry?.playerId === 'string' ? entry.playerId : '';
      if (!activePlayerIds.has(playerId)) throw new Error('Templates can only include active roster players');
      if (seen.has(playerId)) throw new Error('Each player can only appear once in a template');
      seen.add(playerId);

      const rawOrder = entry?.battingOrder;
      const battingOrder = rawOrder === null || rawOrder === undefined || rawOrder === ''
        ? null : Number(rawOrder);
      if (battingOrder !== null && (!Number.isInteger(battingOrder) || battingOrder < 1 || battingOrder > 99)) {
        throw new Error('Batting order must be a positive whole number');
      }
      return {
        playerId,
        battingOrder,
        starter: lineupMode === 'nine_player' ? Boolean(entry?.starter) : true,
        inningPositions: normalizeInningPositions(entry?.inningPositions, inningCount),
      };
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid template entries' },
      { status: 400 },
    );
  }

  try {
    const template = await createRepTeamLineupTemplate({
      orgId: ctx.org.id,
      teamId,
      programYearId: programYear.id,
      name,
      lineupMode,
      inningCount,
      entries: cleanEntries,
      createdBy: ctx.user.id,
    });
    return NextResponse.json({ template });
  } catch (error: unknown) {
    // Unique (team, program_year, lower(name)) violation → friendly 409.
    const code = (error as { code?: string })?.code;
    if (code === '23505') {
      return NextResponse.json({ error: `A template named “${name}” already exists this season` }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not save template' },
      { status: 400 },
    );
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/lineup-templates' });
