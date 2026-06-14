import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { getRepTeams, bulkRenameTeamSlugs } from '@/lib/db';
import { withObservability } from '@/lib/observability';

const SLUG_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

function isValidSlug(s: string): boolean {
  return s.length >= 3 && s.length <= 80 && SLUG_RE.test(s);
}

export const PATCH = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  if (ctx.role !== 'owner' && ctx.role !== 'admin') return forbidden();

  let body: { renames?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!Array.isArray(body.renames) || body.renames.length === 0) {
    return NextResponse.json({ error: 'renames must be a non-empty array' }, { status: 400 });
  }

  // Validate each entry
  const fieldErrors: Record<string, string> = {};
  const renames: Array<{ teamId: string; newSlug: string }> = [];

  for (const item of body.renames) {
    if (typeof item !== 'object' || item === null) continue;
    const { teamId, newSlug } = item as Record<string, unknown>;
    if (typeof teamId !== 'string' || typeof newSlug !== 'string') continue;
    if (!isValidSlug(newSlug)) {
      fieldErrors[teamId] = 'Invalid slug: 3–80 chars, lowercase letters, numbers, hyphens only, no leading/trailing hyphens';
    }
    renames.push({ teamId, newSlug });
  }

  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json({ errors: fieldErrors }, { status: 400 });
  }

  // Validate no duplicates within the submitted batch
  const newSlugs = renames.map(r => r.newSlug);
  const slugSet = new Set(newSlugs);
  if (slugSet.size !== newSlugs.length) {
    return NextResponse.json(
      { error: 'Duplicate slugs in the batch — each team must have a unique new slug' },
      { status: 400 },
    );
  }

  // Validate no conflicts with teams NOT in this batch
  const allTeams = await getRepTeams(ctx.org.id);
  const renamingIds = new Set(renames.map(r => r.teamId));
  const outsideSlugs = new Set(allTeams.filter(t => !renamingIds.has(t.id)).map(t => t.slug));

  const conflicting = renames.filter(r => outsideSlugs.has(r.newSlug));
  if (conflicting.length > 0) {
    const conflicts = Object.fromEntries(
      conflicting.map(r => [r.teamId, `"${r.newSlug}" is already taken by another team`])
    );
    return NextResponse.json({ errors: conflicts }, { status: 409 });
  }

  await bulkRenameTeamSlugs(ctx.org.id, renames);

  return NextResponse.json({ updated: renames.length });
}, { route: '/api/admin/rep-teams/bulk-rename-slugs' });
