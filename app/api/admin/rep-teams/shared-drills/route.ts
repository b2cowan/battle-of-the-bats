import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { getOrgSharedDrills, createRepTeamDrill } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { MAX_SHARED_DRILLS_PER_ORG, validateDrillInput } from '@/lib/rep-drills';

/**
 * The CLUB's shared drill set (owner ruling 2026-08-01, "both now").
 *
 * An org owner/admin curates a small set of drills that every team's coaches can pull into a
 * practice. Stored with no owning team (org set) — the exact mig-184 shape shared tags and shared
 * award types already use, adopted up front here rather than retro-fitted.
 *
 * ⚠ **Coaches may USE these, never write them.** The coach routes scope every write to a real team
 * id, so a shared row cannot match; mig 218's RLS encodes the same rule again for a direct
 * PostgREST call. This is what makes a club's standard actually standard.
 *
 * ⚠ **It ships EMPTY and nothing is ever seeded.** A supplied drill list would be one sport talking
 * to a platform that serves many. The honest day-one cost of building both halves at once is that a
 * club has nothing to share until its coaches have drills worth sharing — which is precisely what
 * the coaches' "add from a past season" import is there to shorten.
 */
function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  return null;
}

export const GET = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  // Retired included so the manager can show and restore them.
  const drills = await getOrgSharedDrills(ctx!.org.id, { includeRetired: true });
  return NextResponse.json({ drills });
}, { route: '/api/admin/rep-teams/shared-drills' });

export const POST = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;
  if (ctx!.role !== 'owner' && ctx!.role !== 'admin') return forbidden();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = validateDrillInput(body);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const existing = await getOrgSharedDrills(ctx!.org.id, { includeRetired: true });
  if (existing.filter(d => d.isActive).length >= MAX_SHARED_DRILLS_PER_ORG) {
    return NextResponse.json(
      { error: `You can share up to ${MAX_SHARED_DRILLS_PER_ORG} drills. Retire one to add another.` },
      { status: 400 },
    );
  }

  try {
    // teamId null = shared with the whole org. This is the ONLY route that passes null.
    const drill = await createRepTeamDrill({
      ...parsed.drill, orgId: ctx!.org.id, teamId: null, createdBy: ctx!.user.id,
    });
    return NextResponse.json({ drill }, { status: 201 });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === '23505') {
      return NextResponse.json({ error: `A shared drill called “${parsed.drill.name}” already exists.` }, { status: 409 });
    }
    throw error;
  }
}, { route: '/api/admin/rep-teams/shared-drills' });
