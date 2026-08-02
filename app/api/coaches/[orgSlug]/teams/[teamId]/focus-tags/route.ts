import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getActiveRepProgramYear,
  getCoachingAssignmentsForUser,
  getRepTeam,
  getRepTeamTags,
  getRepTeamTagLibrary,
  createRepTeamTag,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless } from '@/lib/coach-capabilities';

/**
 * The 'focus' tag vocabulary (Practice Plans Phase 3, mig 221) — the ONE list behind drills, plan
 * templates, practice plans and players' focus areas.
 *
 * Same shape as the game-tag route beside it, and gated on `schedule` for the same reason: this
 * vocabulary is written from the practice-planning surfaces. ⚠ It is deliberately NOT gated on
 * `notes` even though focus areas use it — an assistant with notes-only must be able to READ the
 * vocabulary to see which areas match tonight, but minting team vocabulary is a head-coach act.
 *
 * ⚠ TODO(/simplify): this is the THIRD near-identical tag route group (game, expense, focus).
 * They differ only in `kind`, the capability they check, and the noun in their error copy. Collapse
 * them into one factory rather than letting a fourth appear.
 */

const MAX_TAGS_PER_KIND = 50;

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

/**
 * ⚠ NOT on the season-read rail, by decision.
 *
 * A tag vocabulary is an INSTRUMENT, like the drill library — the same ruling, for the same reason.
 * This resolves the team's ACTIVE year and therefore cannot address a past season at all, which is
 * the fail-closed default `coach-season-write-guard.test.ts` protects. The read-only PAST PLAN page
 * needs no live tags: a plan renders from the tag NAMES snapshotted into it when the drill was
 * added, so it stays honest about what the coach could see at the time without ever touching this.
 */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveTeamCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignment } = resolved;
  // Reading the vocabulary is what lets the focus rail explain itself, so `notes` is enough — an
  // assistant who can see focus areas must be able to see what they are grouped under.
  const denied = denyUnless(
    assignment.capabilities.schedule || assignment.capabilities.notes,
    'You do not have access to this team’s practice planning.',
  );
  if (denied) return denied;

  // The team's own tags PLUS the club's shared set — one list, because the picker shows one list
  // and fetching the halves separately is how they start disagreeing.
  const tags = await getRepTeamTagLibrary(teamId, 'focus', ctx.org.id);
  return NextResponse.json({ tags });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/focus-tags' });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveTeamCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignment } = resolved;
  const denied = denyUnless(assignment.capabilities.schedule, 'You do not have access to the schedule.');
  if (denied) return denied;

  const body = await req.json();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (name.length < 1 || name.length > 40) {
    return NextResponse.json({ error: 'Tag name must be 1–40 characters' }, { status: 400 });
  }

  const existing = await getRepTeamTags(teamId, 'focus');
  if (existing.length >= MAX_TAGS_PER_KIND) {
    return NextResponse.json(
      { error: `You can keep up to ${MAX_TAGS_PER_KIND} tags. Merge two to add another.` },
      { status: 400 },
    );
  }

  try {
    const tag = await createRepTeamTag({
      orgId: ctx.org.id,
      teamId,
      kind: 'focus',
      name,
      createdBy: ctx.user.id,
    });
    return NextResponse.json({ tag });
  } catch (error: unknown) {
    // ⚠ The case-insensitive unique index (team, kind, lower(name)) is what makes "Hitting" and
    // "hitting" impossible rather than merely discouraged. A 409 here is that guard working.
    const code = (error as { code?: string })?.code;
    if (code === '23505') {
      return NextResponse.json({ error: `You already have a tag called “${name}”` }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not save that tag' },
      { status: 400 },
    );
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/focus-tags' });
