import { NextResponse } from 'next/server';
import { requireAnyPlatformPower, hasPlatformPower } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { OrgPlan } from '@/lib/types';
import { buildClubStory } from '@/lib/platform-story';
import { applyClubSections, endClubOverride } from '@/lib/club-record-changes';
import { applyOperatorPlanChange } from '@/lib/operator-plan-change';

/**
 * Put it back (Support console Stage 2, rule R5; kickoff Q2): undo a plan or limit, a section, or a running override from
 * the Story. Never anything that reached Stripe or an inbox.
 *
 * ⚖ THE STORY DECIDES. This route rebuilds the club's Story and acts only on the entry it finds there carrying a Put it
 * back — the same rule that put the door on the screen — so a stale screen, a hand-made request or an entry undone in
 * another window is refused rather than half-applied. The undo writes a NEW entry naming the old one (`put_back_of`); the
 * old one is never edited. Each kind is checked against its own power and goes through the one rule for that change.
 */
export const POST = withObservability(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requireAnyPlatformPower(['club_billing', 'club_sections']);
  if (auth.response) return auth.response;
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { key?: unknown; reason?: unknown };
  const key = typeof body.key === 'string' ? body.key : '';
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!reason) return NextResponse.json({ error: 'Say why before putting it back.' }, { status: 400 });

  const entry = (await buildClubStory(id)).find(e => e.key === key);
  if (!entry?.putBack) {
    return NextResponse.json({ error: 'This entry can no longer be put back. Reload the Story to see what changed.' }, { status: 409 });
  }
  const power = entry.putBack.kind === 'section' ? 'club_sections' : 'club_billing';
  if (!hasPlatformPower(auth.role, power)) return NextResponse.json({ error: 'Insufficient platform role' }, { status: 403 });
  const actor = auth.user.email!;
  const extra = { put_back_of: key };

  if (entry.putBack.kind === 'override') {
    const r = await endClubOverride({ orgId: id, overrideId: key.slice('override:'.length), reason, actorEmail: actor, extra });
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: r.status });
  }

  const auditId = key.split(':')[1];
  const { data: row } = await supabaseAdmin
    .from('platform_audit_log')
    .select('id, actor_email, old_value, new_value, created_at, action, field')
    .eq('id', auditId)
    .eq('org_id', id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: 'That entry was not found.' }, { status: 404 });

  if (entry.putBack.kind === 'section') {
    const section = key.split(':')[2];
    const { data: org } = await supabaseAdmin.from('organizations').select('enabled_addons').eq('id', id).single<{ enabled_addons: string[] | null }>();
    const current = new Set(org?.enabled_addons ?? []);
    if (current.has(section)) current.delete(section); else current.add(section);
    const r = await applyClubSections({ orgId: id, enabledAddons: [...current], reason, actorEmail: actor, extra });
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: r.status });
  }

  // A plan or limit: back to the entry's old plan and limit, and its old team limit when the same change set one.
  const old = (row.old_value ?? {}) as { plan_id?: string; tournament_limit?: number };
  if (!old.plan_id || typeof old.tournament_limit !== 'number') {
    return NextResponse.json({ error: 'This entry does not say what the plan was before.' }, { status: 409 });
  }
  const t = Date.parse(row.created_at as string);
  const { data: siblings } = await supabaseAdmin
    .from('platform_audit_log')
    .select('old_value, created_at')
    .eq('org_id', id)
    .eq('action', 'update_plan')
    .eq('field', 'team_limit')
    .eq('actor_email', row.actor_email as string)
    .gte('created_at', new Date(t - 10_000).toISOString()) // utc-intentional: an instant window
    .lte('created_at', new Date(t + 10_000).toISOString()); // utc-intentional: an instant window
  const teamRow = (siblings ?? []).at(-1) as { old_value: unknown } | undefined;
  try {
    const result = await applyOperatorPlanChange({
      orgId: id,
      planId: old.plan_id as OrgPlan,
      tournamentLimit: old.tournament_limit,
      ...(teamRow ? { teamLimit: typeof teamRow.old_value === 'number' ? teamRow.old_value : null } : {}),
      reason,
      actor,
      audit: { action: 'update_org_plan_and_limit', extra },
    });
    return NextResponse.json({ ok: true, warnings: [...result.warnings, ...(result.archiveWarning ? [result.archiveWarning] : [])] });
  } catch {
    return NextResponse.json({ error: 'The plan could not be put back.' }, { status: 500 });
  }
}, { route: '/api/platform-admin/orgs/[id]/put-back' });
