import { NextResponse } from 'next/server';
import { requireAnyPlatformPower, hasPlatformPower } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';
import type { OrgPlan } from '@/lib/types';
import { buildClubStory } from '@/lib/platform-story';
import { applyClubSections, endClubOverride } from '@/lib/club-record-changes';
import { applyOperatorPlanChange, PlanRefusedError } from '@/lib/operator-plan-change';
import { changeFreeTimeEnd } from '@/lib/free-time-writes';
import { earliestLastDay } from '@/lib/free-time';
import { changePortalFreeTimeEnd, endPortalFreeTimeNow, readFreeTimePortal } from '@/lib/portal-free-time-give';

/**
 * Put it back (Support console Stage 2, rule R5; kickoff Q2): undo a plan or limit, a section, or a running override from
 * the Story. Never anything that reached Stripe or an inbox.
 *
 * ⚖ THE STORY DECIDES, ONCE. This route rebuilds the club's Story and applies the TARGET its entry carries (the old plan
 * and limits; a section and the state to set; the override to end) — the same decision that put the door on the screen,
 * never worked out a second time here. A stale screen, a hand-made request or an entry undone in another window finds no
 * door and is refused. The undo writes a NEW entry naming the old one (`put_back_of`); the old one is never edited. Each
 * kind is checked against its own power and goes through the one rule for that change.
 */
export const POST = withObservability(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requireAnyPlatformPower(['club_billing', 'club_sections', 'portal_free_time']);
  if (auth.response) return auth.response;
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { key?: unknown; reason?: unknown };
  const key = typeof body.key === 'string' ? body.key : '';
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!reason) return NextResponse.json({ error: 'Say why before putting it back.' }, { status: 400 });

  const target = (await buildClubStory(id)).find(e => e.key === key)?.putBack;
  if (!target) {
    return NextResponse.json({ error: 'This entry can no longer be put back. Reload the Story to see what changed.' }, { status: 409 });
  }
  const power = target.kind === 'section' ? 'club_sections'
    : target.kind === 'portal_end_now' || target.kind === 'portal_end' ? 'portal_free_time' : 'club_billing';
  if (!hasPlatformPower(auth.role, power)) {
    return NextResponse.json({ error: 'Insufficient platform role' }, { status: 403 });
  }
  const actor = auth.user.email!;
  const extra = { put_back_of: key };

  // A Coaches Portal's free time (Stage 4b, T12): its own path, which moves the team's entitlement with the grant. On
  // "given" Put it back is End it now; on "changed" it restores the earlier last day under the same limits.
  if (target.kind === 'portal_end_now' || target.kind === 'portal_end') {
    const portalActor = { id: auth.user.id, email: actor, role: auth.role };
    const r = target.kind === 'portal_end_now'
      ? await endPortalFreeTimeNow({ orgId: id, overrideId: target.overrideId, reason, actor: portalActor, extra })
      : await changePortalFreeTimeEnd({
        orgId: id, overrideId: target.overrideId, expectedExpiresAt: target.expectedExpiresAt, lastDay: target.lastDay, reason, actor: portalActor, extra,
      });
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: r.status });
  }

  // A club's override end never reaches a portal's free time: it would end the grant and leave the team's entitlement.
  if ((target.kind === 'override' || target.kind === 'override_end') && await readFreeTimePortal(id)) {
    return NextResponse.json({ error: "End a Coaches Portal's free time from its own Access list." }, { status: 409 });
  }

  if (target.kind === 'override') {
    const r = await endClubOverride({ orgId: id, overrideId: target.overrideId, reason, actorEmail: actor, extra });
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: r.status });
  }

  // Free time's newest change, undone (Support console Stage 4, T10): the earlier last day again, under the same cap and
  // compare-and-set as any change; if that day has passed, the grant ends now.
  if (target.kind === 'override_end') {
    if (target.lastDay < earliestLastDay()) {
      const r = await endClubOverride({ orgId: id, overrideId: target.overrideId, reason, actorEmail: actor, extra });
      return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: r.status });
    }
    const r = await changeFreeTimeEnd({
      orgId: id, overrideId: target.overrideId, expectedExpiresAt: target.expectedExpiresAt, lastDay: target.lastDay, reason,
      actor: { id: auth.user.id, email: actor, role: auth.role }, extra,
    });
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: r.status });
  }

  if (target.kind === 'section') {
    const r = await applyClubSections({ orgId: id, toggle: { section: target.section, on: target.on }, reason, actorEmail: actor, extra });
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: r.status });
  }

  try {
    const result = await applyOperatorPlanChange({
      orgId: id,
      planId: target.planId as OrgPlan,
      tournamentLimit: target.tournamentLimit,
      ...(target.teamLimit !== undefined ? { teamLimit: target.teamLimit } : {}),
      reason,
      actor,
      audit: { action: 'update_org_plan_and_limit', extra },
    });
    return NextResponse.json({ ok: true, warnings: [...result.warnings, ...(result.archiveWarning ? [result.archiveWarning] : [])] });
  } catch (err) {
    if (err instanceof PlanRefusedError) return NextResponse.json({ error: err.message }, { status: 409 });
    return NextResponse.json({ error: 'The plan could not be put back.' }, { status: 500 });
  }
}, { route: '/api/platform-admin/orgs/[id]/put-back' });
