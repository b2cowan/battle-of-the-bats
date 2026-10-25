import { NextResponse } from 'next/server';
import { requireAnyPlatformPower, hasPlatformPower } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';
import { PLAN_CONFIG } from '@/lib/plan-config';
import type { OrgPlan } from '@/lib/types';
import { applyClubIdentity, applyClubSections } from '@/lib/club-record-changes';
import { applyOperatorPlanChange, PlanUpdateError } from '@/lib/operator-plan-change';

/**
 * The club record's one pencil, saved (Support console Stage 2, owner ruling A6 — "one pencil for the whole record; the
 * check mark confirms in one sentence and asks why").
 *
 * One reason covers the whole save; each changed field still becomes its own Story entry (so each can be put back alone)
 * and each part is checked against its own power: the name and web name `club_support`, the plan and limits
 * `club_billing`, the sections `club_sections`. A part the role may not change is refused before anything is written.
 * Parts are applied in a fixed order — name, then plan, then sections — and a failure says which parts were already
 * saved, so nothing is reported as all-or-nothing that is not.
 */
type Body = {
  name?: string;
  slug?: string;
  plan?: { planId: string; tournamentLimit: number; teamLimit?: number | null };
  sections?: string[];
  reason?: string;
};

export const PATCH = withObservability(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requireAnyPlatformPower(['club_support', 'club_billing', 'club_sections']);
  if (auth.response) return auth.response;
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Body;
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!reason) return NextResponse.json({ error: 'Say why before saving.' }, { status: 400 });

  const wantsIdentity = body.name !== undefined || body.slug !== undefined;
  const wantsPlan = !!body.plan;
  const wantsSections = Array.isArray(body.sections);
  if (!wantsIdentity && !wantsPlan && !wantsSections) return NextResponse.json({ error: 'Nothing changed.' }, { status: 400 });
  if ((wantsIdentity && !hasPlatformPower(auth.role, 'club_support'))
    || (wantsPlan && !hasPlatformPower(auth.role, 'club_billing'))
    || (wantsSections && !hasPlatformPower(auth.role, 'club_sections'))) {
    return NextResponse.json({ error: 'Insufficient platform role' }, { status: 403 });
  }
  if (wantsPlan) {
    const p = body.plan!;
    if (!(p.planId in PLAN_CONFIG) || typeof p.tournamentLimit !== 'number' || p.tournamentLimit < 0) {
      return NextResponse.json({ error: 'That plan or limit is not valid.' }, { status: 400 });
    }
    if (p.teamLimit != null && (typeof p.teamLimit !== 'number' || p.teamLimit < 0 || p.teamLimit > 1000)) {
      return NextResponse.json({ error: 'A team limit is a number up to 1,000.' }, { status: 400 });
    }
  }

  const actor = auth.user.email!;
  const saved: string[] = [];
  const fail = (status: number, error: string) =>
    NextResponse.json({ error: saved.length ? `${error} Already saved: ${saved.join(', ')}.` : error, saved }, { status });

  if (wantsIdentity) {
    const r = await applyClubIdentity({ orgId: id, name: body.name, slug: body.slug, reason, actorEmail: actor });
    if (!r.ok) return fail(r.status, r.error);
    saved.push('name and web name');
  }

  const warnings: string[] = [];
  if (wantsPlan) {
    const p = body.plan!;
    try {
      const result = await applyOperatorPlanChange({
        orgId: id,
        planId: p.planId as OrgPlan,
        tournamentLimit: p.tournamentLimit,
        ...(p.teamLimit !== undefined ? { teamLimit: p.teamLimit } : {}),
        reason,
        actor,
        audit: { action: 'update_org_plan_and_limit' },
      });
      warnings.push(...result.warnings);
      if (result.archiveWarning) warnings.push(result.archiveWarning);
      if (result.archivedTournaments.length > 0) {
        warnings.push(`Archived over the new limit: ${result.archivedTournaments.map(t => t.name).join(', ')}.`);
      }
    } catch (err) {
      return fail(500, err instanceof PlanUpdateError ? 'The plan could not be saved.' : 'The plan could not be saved.');
    }
    saved.push('plan and limits');
  }

  if (wantsSections) {
    const r = await applyClubSections({ orgId: id, enabledAddons: body.sections!, reason, actorEmail: actor });
    if (!r.ok) return fail(r.status, r.error);
    saved.push('sections');
  }

  return NextResponse.json({ ok: true, saved, warnings });
}, { route: '/api/platform-admin/orgs/[id]/record' });
