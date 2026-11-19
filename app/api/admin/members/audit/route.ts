import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { getUserDisplayName } from '@/lib/user-display';
import { auditChangeSentence, AUDIT_LOG_ACTIONS, isPayLinkAuditAction } from '@/lib/member-audit';

const PAGE_SIZE = 25;

// ⚠ TODAY'S PAGE ONLY — `actionLabel` / `details` are what the legacy audit page renders. The kit's log
// reads `sentence` (`auditChangeSentence`, one wording per change). These two go with the legacy page
// in the Admin Design Continuity release slice; until then a new audit action needs both.
const ACTION_LABELS: Record<string, string> = {
  member_invited:       'Invited',
  member_removed:       'Removed',
  role_changed:         'Role changed',
  capabilities_changed: 'Capabilities updated',
  member_suspended:     'Suspended',
  member_reinstated:    'Reinstated',
  two_step_reset:           'Two-step sign-in reset',
  two_step_requirement_on:  'Two-step sign-in required',
  two_step_requirement_off: 'Two-step sign-in no longer required',
  pay_link_emailed:  'Pay link emailed',
  pay_link_replaced: 'Pay link replaced',
  pay_link_stopped:  'Pay link stopped',
};

function summarizePayload(action: string, payload: Record<string, unknown> | null): string {
  if (!payload) return '';
  switch (action) {
    case 'member_invited':       return `Invited as ${payload.role}`;
    case 'member_removed':       return `Removed (was ${payload.role})`;
    case 'role_changed':         return `${payload.before} → ${payload.after}`;
    case 'capabilities_changed': return 'Capability overrides updated';
    default:                     return '';
  }
}

/**
 * GET /api/admin/members/audit — who changed what about the board. Owner-only.
 *
 * ── Added by Club Tier Stage 1's screens session (2026-09-26), additively — today's screen reads the
 * same fields it always has:
 *   ?scope=members — what the owner's log lists: the MEMBER changes (invited, removed, role changed,
 *                    access changed, suspended, reinstated, Rep Teams groups changed, two-step) and,
 *                    since P8c, a team's pay link emailed, replaced or stopped. The same table also holds
 *                    billing and family events; the log deliberately shows none of those. Filtered HERE,
 *                    so the page count and the "1–25 of 41" are the log's own.
 *   actorName / targetName — the name a person goes by here (the org's display name, else the
 *                    account's name), so the log reads "Dana Whitfield", not an email.
 *   sentence — "Role changed: Staff → Admin", "Access changed: Families turned on" (lib/member-audit.ts).
 *
 * ── Board Ready P8c (owner ruling 2026-11-19, "Owner only, as recommended"): the scoped read also lists a team's
 * pay link emailed, replaced or stopped (`AUDIT_LOG_ACTIONS`). Those rows have no target person; their `targetName`
 * is "{team}, {tournament}", read here at read time from the ids the row holds, inside this organization only.
 * The team's address is never read or returned. Who may read the log does not change (owner only, above).
 */
export const GET = withObservability(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const orgSlug = searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner') return forbidden();
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const membersOnly = searchParams.get('scope') === 'members';

  let query = supabaseAdmin
    .from('org_audit_log')
    .select('id, actor_id, target_id, action, payload, created_at', { count: 'exact' })
    .eq('org_id', ctx.org.id);
  if (membersOnly) query = query.in('action', [...AUDIT_LOG_ACTIONS]);
  const { data: rows, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Resolve unique actor/target IDs to emails in parallel.
  // getUserById returns null for deleted auth users — shown as 'Deleted user'.
  const uniqueIds = [
    ...new Set(
      (rows ?? [])
        .flatMap(r => [r.actor_id, r.target_id])
        .filter((id): id is string => !!id)
    ),
  ];

  const emailMap: Record<string, string> = {};
  const userMap: Record<string, User> = {};
  await Promise.all(
    uniqueIds.map(async (id) => {
      try {
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(id);
        emailMap[id] = user?.email ?? 'Deleted user';
        if (user) userMap[id] = user;
      } catch {
        emailMap[id] = 'Deleted user';
      }
    })
  );

  // The name each person goes by HERE: the org's display name first (one read for the page), then
  // the account's own name. An email stands in only when neither exists.
  const displayNames: Record<string, string> = {};
  if (membersOnly && uniqueIds.length > 0) {
    const { data: memberRows } = await supabaseAdmin
      .from('organization_members')
      .select('user_id, display_name')
      .eq('organization_id', ctx.org.id)
      .in('user_id', uniqueIds);
    for (const m of memberRows ?? []) {
      const given = (m.display_name as string | null)?.trim();
      if (given) displayNames[m.user_id as string] = given;
    }
  }
  const nameOf = (id: string | null): string | null => {
    if (!id) return null;
    if (displayNames[id]) return displayNames[id];
    const user = userMap[id];
    return user ? (getUserDisplayName(user) || null) : null;
  };

  // P8c: a pay-link row's "To" is the team and its tournament. Names only (never `teams.email` / `coach_email`), and
  // only tournaments of THIS organization — a row's ids were written by our own route, but the read never trusts that.
  const payLinkNames = membersOnly ? await namePayLinkTeams(ctx.org.id, rows ?? []) : null;

  const result = (rows ?? []).map(r => {
    const payload = r.payload as Record<string, unknown> | null;
    const payLinkTo = payLinkNames && isPayLinkAuditAction(r.action) ? payLinkNames(payload) : null;
    // member_removed stores email in payload because the auth user is deleted by then.
    const targetEmail =
      r.action === 'member_removed' && payload?.email
        ? String(payload.email)
        : r.target_id ? (emailMap[r.target_id] ?? '—') : '—';

    return {
      id: r.id,
      action: r.action,
      actionLabel: ACTION_LABELS[r.action] ?? r.action,
      actorEmail: r.actor_id ? (emailMap[r.actor_id] ?? 'Deleted user') : 'System',
      targetEmail,
      details: summarizePayload(r.action, payload),
      createdAt: r.created_at,
      ...(membersOnly ? {
        actorName: r.actor_id ? nameOf(r.actor_id) : null,
        targetName: payLinkTo ?? (r.action === 'member_removed' ? null : nameOf(r.target_id)),
        sentence: auditChangeSentence(r.action, payload),
      } : {}),
    };
  });

  return NextResponse.json({
    rows: result,
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  });
}, { route: '/api/admin/members/audit' });

// Only a real id is looked up (the writer validates them; a malformed one must never fail the whole page's read).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const idOf = (v: unknown): string | null => (typeof v === 'string' && UUID.test(v) ? v : null);

/**
 * "{team}, {tournament}" for each pay-link row on this page, from two reads for the page. A team or tournament
 * deleted since reads "Deleted team" / "Deleted tournament" (as a deleted person reads "Deleted user"); a team whose
 * tournament is not this organization's is never named.
 */
async function namePayLinkTeams(
  orgId: string,
  rows: { action: string; payload: unknown }[],
): Promise<(payload: Record<string, unknown> | null) => string> {
  const payloads = rows.filter(r => isPayLinkAuditAction(r.action)).map(r => (r.payload ?? {}) as Record<string, unknown>);
  const tournamentIds = [...new Set(payloads.map(p => idOf(p.tournamentId)).filter((id): id is string => !!id))];
  const teamIds = [...new Set(payloads.map(p => idOf(p.teamId)).filter((id): id is string => !!id))];

  const tournamentName = new Map<string, string>();
  const teamName = new Map<string, string>();
  if (tournamentIds.length > 0) {
    const { data, error } = await supabaseAdmin.from('tournaments').select('id, name').eq('org_id', orgId).in('id', tournamentIds);
    // A failed read must not print "Deleted tournament" into an audit record: the log fails honestly instead.
    if (error) throw error;
    for (const t of data ?? []) tournamentName.set(t.id as string, (t.name as string | null)?.trim() || 'Untitled tournament');
  }
  const ownTournaments = [...tournamentName.keys()];
  const teamTournament = new Map<string, string>();
  if (teamIds.length > 0 && ownTournaments.length > 0) {
    const { data, error } = await supabaseAdmin.from('teams').select('id, name, tournament_id').in('id', teamIds).in('tournament_id', ownTournaments);
    if (error) throw error;
    for (const t of data ?? []) {
      teamName.set(t.id as string, (t.name as string | null)?.trim() || 'Unnamed team');
      teamTournament.set(t.id as string, t.tournament_id as string);
    }
  }

  return (payload) => {
    const p = payload ?? {};
    const tournamentId = idOf(p.tournamentId) ?? '';
    const teamId = idOf(p.teamId) ?? '';
    // The team is named only under ITS OWN tournament (the writer guarantees the pair; the read doesn't assume it).
    const team = teamTournament.get(teamId) === tournamentId ? (teamName.get(teamId) ?? 'Deleted team') : 'Deleted team';
    const tournament = tournamentName.get(tournamentId) ?? 'Deleted tournament';
    return `${team}, ${tournament}`;
  };
}
