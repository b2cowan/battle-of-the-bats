import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized } from '@/lib/api-auth';
import { canOpenModule, canOpenRepMoney } from '@/lib/member-access';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability, captureAndJson } from '@/lib/observability';
import { tournamentToday, addCalendarDays } from '@/lib/timezone';
import type { OrgRole } from '@/lib/types';

/**
 * GET /api/admin/club-brief — "this morning": the president's brief on the club hub (Stage 1,
 * specimens 1–2). FOUR COUNTS, NO MONEY (C04: the club's money figures are known-wrong until
 * Stage 3, so the brief says how many things wait, never how much).
 *
 *   tryoutApplications — tryout registrations waiting for a decision, on a team's open season
 *   paymentRequests    — coaches' payment requests waiting for the club
 *   installmentsDue    — unpaid team installments due within 14 days, the overdue ones included
 *   assistantCoaches   — assistant-coach invites waiting for the club's approval
 *
 * ⚖ A count is present ONLY where the person can act on it (specimen 2: "a card appears only where
 * the person can act"). Two questions, both asked with the SAME rules the acting routes use:
 * can they reach the program (`canOpenModule` / `canOpenRepMoney`), and does their role pass that
 * route's write check. A key that is absent means "not yours to act on"; a present 0 means
 * "yours, and nothing waits". Session 2's hub renders this and collapses to one line at all-zero.
 *
 * Scoped members (rep-group scopes) count only their groups' teams, as every Rep Teams list does.
 */

/** Who may act, per count — copied from the route that performs the action, never widened. */
const ACTING_ROLES = {
  // tryouts/[regId] PATCH: owner | admin
  tryoutApplications: ['owner', 'admin'],
  // payment-requests/[id] PATCH: owner | treasurer | admin
  paymentRequests: ['owner', 'treasurer', 'admin'],
  // allocation installment PATCH (mark paid): owner | treasurer
  installmentsDue: ['owner', 'treasurer'],
  // assistant-coaches POST (approve): owner | admin
  assistantCoaches: ['owner', 'admin'],
} as const satisfies Record<string, readonly OrgRole[]>;

type ClubBriefCounts = Partial<Record<keyof typeof ACTING_ROLES, number>>;

const DUE_WINDOW_DAYS = 14;

export const GET = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();

  const org = ctx.org;
  const actsAs = (key: keyof typeof ACTING_ROLES) => (ACTING_ROLES[key] as readonly string[]).includes(ctx.role);
  const repTeams = canOpenModule(ctx, org, 'module_rep_teams');
  const repMoney = canOpenRepMoney(ctx, org);

  const want = {
    tryoutApplications: repTeams && actsAs('tryoutApplications'),
    paymentRequests: repMoney && actsAs('paymentRequests'),
    installmentsDue: repMoney && actsAs('installmentsDue'),
    assistantCoaches: repTeams && actsAs('assistantCoaches'),
  };
  const today = tournamentToday();
  if (!Object.values(want).some(Boolean)) {
    return NextResponse.json({ asOf: today, counts: {} satisfies ClubBriefCounts });
  }

  // Teams in the person's reach: non-archived, and inside their rep-group scope when they have one.
  let teamQuery = supabaseAdmin.from('rep_teams').select('id').eq('org_id', org.id).eq('is_archived', false);
  if (ctx.repGroupIds) teamQuery = teamQuery.in('group_id', ctx.repGroupIds);
  const { data: teamRows, error: teamErr } = await teamQuery;
  if (teamErr) return captureAndJson(teamErr, { error: 'Could not read this morning’s brief.' }, 500);
  const teamIds = (teamRows ?? []).map(t => t.id as string);

  const counts: ClubBriefCounts = {};
  if (teamIds.length === 0) {
    for (const [key, on] of Object.entries(want)) if (on) counts[key as keyof ClubBriefCounts] = 0;
    return NextResponse.json({ asOf: today, counts });
  }

  const reads: Promise<void>[] = [];
  const fail: { error: unknown } = { error: null };

  if (want.tryoutApplications) {
    reads.push((async () => {
      // Waiting = pending_review (the only undecided state, mig 168), on a season that is still
      // open (draft or active). A registration left on a finished season is a record, not a task.
      const { count, error } = await supabaseAdmin
        .from('rep_tryout_registrations')
        .select('id, rep_program_years!inner(status)', { count: 'exact', head: true })
        .eq('org_id', org.id)
        .eq('status', 'pending_review')
        .in('team_id', teamIds)
        .in('rep_program_years.status', ['draft', 'active']);
      if (error) fail.error = error; else counts.tryoutApplications = count ?? 0;
    })());
  }

  if (want.paymentRequests) {
    reads.push((async () => {
      const { count, error } = await supabaseAdmin
        .from('rep_team_payment_requests')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', org.id)
        .eq('status', 'pending')
        .in('team_id', teamIds);
      if (error) fail.error = error; else counts.paymentRequests = count ?? 0;
    })());
  }

  if (want.installmentsDue) {
    reads.push((async () => {
      // "Due in 14 days" counts what must be paid by then — so an overdue installment counts too.
      // Dates are the org's calendar day (`tournamentToday`), never the server's UTC day.
      const { count, error } = await supabaseAdmin
        .from('rep_allocation_installments')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', org.id)
        .is('paid_at', null)
        .lte('due_date', addCalendarDays(today, DUE_WINDOW_DAYS))
        .in('team_id', teamIds);
      if (error) fail.error = error; else counts.installmentsDue = count ?? 0;
    })());
  }

  if (want.assistantCoaches) {
    reads.push((async () => {
      // `pending_approval` is the only state the approve action accepts (assistant-coaches POST).
      const { count, error } = await supabaseAdmin
        .from('assistant_invite_tokens')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', org.id)
        .eq('status', 'pending_approval')
        .in('team_id', teamIds);
      if (error) fail.error = error; else counts.assistantCoaches = count ?? 0;
    })());
  }

  await Promise.all(reads);
  // A count that failed is not a zero — say so rather than print a calm 0 (the brief is a to-do list).
  if (fail.error) return captureAndJson(fail.error, { error: 'Could not read this morning’s brief.' }, 500);

  return NextResponse.json({ asOf: today, counts });
}, { route: '/api/admin/club-brief' });
