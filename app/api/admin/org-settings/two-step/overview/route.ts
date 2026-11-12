import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability, captureAndJson } from '@/lib/observability';
import { roleLabel } from '@/lib/member-access';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-kind';
import { clubTwoStepWaiting, orgTwoStepFacts } from '@/lib/two-step-club-status';

/**
 * THE OVERVIEW'S TWO-STEP NOTICE (Board Ready · two-step sign-in, Part 4; drawings tab 8; asks 1 and F; owner ruling
 * 2026-11-12: one notice spot, two-step first).
 *
 *   GET  → `{ prompt, waiting }` for the club's owners and admins:
 *          - `prompt`: the OWNER's one-time card ("Your club can require two-step sign-in for the board"), while neither
 *            switch is on and they have not closed it (Open Settings, the ×, or turning a switch on closes it for good);
 *          - `waiting`: while a switch is on, the people who still need to set it up (in their 14 days or past them),
 *            soonest deadline first; null when nobody is waiting. Gone when the last person sets it up.
 *   POST → the owner closes the card (idempotent: the first close is the one kept).
 *
 * Never for a test organization or a coach's own team workspace (the rule never requires it there).
 */

const NAMES_SHOWN = 3;

export const GET = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner' && ctx.role !== 'admin') return forbidden();

  let org;
  try { org = await orgTwoStepFacts(ctx.org.id); } catch (e) { return captureAndJson(e, { error: 'We couldn’t read the setting.' }, 500); }
  if (!org || org.is_test_organization === true
    || isTeamWorkspaceOrg({ accountKind: org.account_kind ?? null, planId: org.plan_id ?? null })) {
    return NextResponse.json({ prompt: false, waiting: null });
  }

  const anyOn = Boolean(org.two_step_board_required_since || org.two_step_coaches_required_since);
  const prompt = ctx.role === 'owner' && !anyOn && !org.two_step_prompt_closed_at;
  if (!anyOn) return NextResponse.json({ prompt, waiting: null });

  let people;
  try { people = await clubTwoStepWaiting(org); } catch (e) { return captureAndJson(e, { error: 'We couldn’t read who still needs it.' }, 500); }
  if (people.length === 0) return NextResponse.json({ prompt: false, waiting: null });
  return NextResponse.json({
    prompt: false,
    waiting: {
      count: people.length,
      people: people.slice(0, NAMES_SHOWN).map(p => ({ name: p.name, role: roleLabel(p.role), deadline: p.deadline, overdue: p.overdue })),
    },
  });
}, { route: '/api/admin/org-settings/two-step/overview' });

export const POST = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner') return forbidden();
  const { error } = await supabaseAdmin
    .from('organizations')
    .update({ two_step_prompt_closed_at: new Date().toISOString() })
    .eq('id', ctx.org.id)
    .is('two_step_prompt_closed_at', null);
  if (error) return captureAndJson(error, { error: 'We couldn’t close it. Try again.' }, 500);
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/org-settings/two-step/overview' });
