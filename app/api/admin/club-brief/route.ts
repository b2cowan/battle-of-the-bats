import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized } from '@/lib/api-auth';
import { canOpenModule, canOpenRepMoney } from '@/lib/member-access';
import { planCarriesModule } from '@/lib/module-entitlements';
import { orgRunsHouseLeague } from '@/lib/board-roles';
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
 * "yours, and nothing waits". The hub renders this and collapses to one line at all-zero.
 *
 * Scoped members (rep-group scopes) count only their groups' teams, as every Rep Teams list does.
 *
 * ── Added by the screens session (Club Tier Stage 1, 2026-09-26), additively ──────────────────────
 *   shape  — { runsHouseLeague, hostsTournaments }: what the club RUNS, the two facts the plan cannot
 *            answer. The hub, the desktop rail and the phone bar order the programs by it
 *            (`clubProgramOrder`, lib/admin-kit-nav.ts), so all three read it from this one place.
 *            Facts about the ORG, not the person — present for everyone who reaches the hub.
 *   teams  — { active, groups }: the Rep Teams door's line ("9 teams in 2 groups") and the capacity
 *            readout ("9 of 15 teams"). Present only for someone who can open Rep Teams — the same
 *            count the rep-team cap enforces (active = not archived).
 *   detail — the drawn sub-lines of two cards: tryouts { teams, oldest: { teamId, programYearId } }
 *            (how many teams have one waiting; the card opens the team with the OLDEST application)
 *            and paymentRequests { oldestDays }. Present only where the count itself is present.
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
type ClubBriefDetail = {
  tryoutApplications?: { teams: number; oldest: { teamId: string; programYearId: string } | null };
  paymentRequests?: { oldestDays: number | null };
};

const DUE_WINDOW_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

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
  const fail: { error: unknown } = { error: null };

  // ── The shape: what the club runs (every reader of the hub, whatever their role) ──────────────
  const shapeRead = (async () => {
    const [runsHouseLeague, tournamentsRes] = await Promise.all([
      orgRunsHouseLeague({ ...org, id: org.id }),
      planCarriesModule(org, 'module_tournaments')
        ? supabaseAdmin.from('tournaments').select('id', { count: 'exact', head: true })
            .eq('org_id', org.id).neq('status', 'archived')
        : Promise.resolve({ count: 0, error: null }),
    ]);
    if (tournamentsRes.error) fail.error = tournamentsRes.error;
    return { runsHouseLeague, hostsTournaments: (tournamentsRes.count ?? 0) > 0 };
  })();

  // Teams in the person's reach: non-archived, and inside their rep-group scope when they have one.
  const needTeams = repTeams || Object.values(want).some(Boolean);
  let teamRows: { id: string; group_id: string | null }[] = [];
  if (needTeams && planCarriesModule(org, 'module_rep_teams')) {
    let teamQuery = supabaseAdmin.from('rep_teams').select('id, group_id').eq('org_id', org.id).eq('is_archived', false);
    if (ctx.repGroupIds) teamQuery = teamQuery.in('group_id', ctx.repGroupIds);
    const { data, error: teamErr } = await teamQuery;
    if (teamErr) return captureAndJson(teamErr, { error: 'Could not read this morning’s brief.' }, 500);
    teamRows = (data ?? []) as { id: string; group_id: string | null }[];
  }
  const teamIds = teamRows.map(t => t.id);

  const counts: ClubBriefCounts = {};
  const detail: ClubBriefDetail = {};
  const reads: Promise<void>[] = [];

  if (teamIds.length === 0) {
    for (const [key, on] of Object.entries(want)) if (on) counts[key as keyof ClubBriefCounts] = 0;
    if (want.tryoutApplications) detail.tryoutApplications = { teams: 0, oldest: null };
    if (want.paymentRequests) detail.paymentRequests = { oldestDays: null };
  } else {
    if (want.tryoutApplications) {
      reads.push((async () => {
        // Waiting = pending_review (the only undecided state, mig 168), on a season that is still
        // open (draft or active). A registration left on a finished season is a record, not a task.
        // Rows, not a head count: the card says how many TEAMS have one waiting and opens the team
        // with the oldest (specimen 1). Bounded by what is waiting, which is the point of the card.
        const { data, error } = await supabaseAdmin
          .from('rep_tryout_registrations')
          .select('team_id, program_year_id, created_at, rep_program_years!inner(status)')
          .eq('org_id', org.id)
          .eq('status', 'pending_review')
          .in('team_id', teamIds)
          .in('rep_program_years.status', ['draft', 'active'])
          .order('created_at', { ascending: true });
        if (error) { fail.error = error; return; }
        const rows = (data ?? []) as { team_id: string; program_year_id: string }[];
        counts.tryoutApplications = rows.length;
        detail.tryoutApplications = {
          teams: new Set(rows.map(r => r.team_id)).size,
          oldest: rows[0] ? { teamId: rows[0].team_id, programYearId: rows[0].program_year_id } : null,
        };
      })());
    }

    if (want.paymentRequests) {
      reads.push((async () => {
        const { data, error } = await supabaseAdmin
          .from('rep_team_payment_requests')
          .select('created_at')
          .eq('org_id', org.id)
          .eq('status', 'pending')
          .in('team_id', teamIds)
          .order('created_at', { ascending: true });
        if (error) { fail.error = error; return; }
        const rows = (data ?? []) as { created_at: string }[];
        counts.paymentRequests = rows.length;
        // Whole days since the oldest request was sent — an age, never an amount (C04).
        detail.paymentRequests = {
          oldestDays: rows[0] ? Math.max(0, Math.floor((Date.now() - Date.parse(rows[0].created_at)) / DAY_MS)) : null,
        };
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
  }

  const [shape] = await Promise.all([shapeRead, ...reads]);
  // A count that failed is not a zero — say so rather than print a calm 0 (the brief is a to-do list).
  if (fail.error) return captureAndJson(fail.error, { error: 'Could not read this morning’s brief.' }, 500);

  return NextResponse.json({
    asOf: today,
    counts,
    shape,
    ...(repTeams && planCarriesModule(org, 'module_rep_teams')
      ? { teams: { active: teamIds.length, groups: new Set(teamRows.map(t => t.group_id).filter(Boolean)).size } }
      : {}),
    detail,
  });
}, { route: '/api/admin/club-brief' });
