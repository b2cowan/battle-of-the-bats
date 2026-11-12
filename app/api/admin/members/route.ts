import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, requireCapability } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { memberSection, whatTheyCanOpen } from '@/lib/member-access';
import type { OrgRole } from '@/lib/types';
import {
  graceStartsFor, memberTwoStep, orgTwoStepFacts, peopleSignInFacts, type MemberTwoStep, type OrgTwoStepRow,
} from '@/lib/two-step-club-status';

export const GET = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();

  // The roster exposes every member's email, capability map, and last sign-in — that is
  // members-management data, so gate it like the page does. Without this, any non-suspended
  // member (scorekeeper, staff, even a still-invited member) could read it (audit J10-002).
  const capErr = await requireCapability(ctx, 'module_members');
  if (capErr) return capErr;

  const { org } = ctx;

  const { data: members, error: membersError } = await supabaseAdmin
    .from('organization_members')
    .select('id, user_id, role, capabilities, invited_at, accepted_at, status, display_name, title')
    .eq('organization_id', org.id);

  if (membersError) {
    return NextResponse.json({ error: membersError.message }, { status: 500 });
  }

  if (!members || members.length === 0) {
    return NextResponse.json([]);
  }

  // Email, last sign-in and two-step for THIS club's people only (mig 475; owner ruling 2026-11-12). It replaced one
  // platform-wide page of 1,000 accounts, past which a member read "(unknown)" with no last sign-in.
  let people: Awaited<ReturnType<typeof peopleSignInFacts>>;
  try {
    people = await peopleSignInFacts(members.map(m => m.user_id as string | null));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'We couldn’t read the members.' }, { status: 500 });
  }

  // The Two-step column (Board Ready two-step, Part 4; ask 6): the club's owners and admins only. Members also opens
  // for a treasurer or registrar with the capability; they get no two-step field at all (owner, 2026-11-12).
  const viewer = members.find(m => m.user_id === ctx.user.id && (m.status ?? 'active') === 'active');
  const seesTwoStep = viewer?.role === 'owner' || viewer?.role === 'admin';
  let graces: Map<string, string> = new Map();
  let switches: OrgTwoStepRow | null = null;
  if (seesTwoStep) {
    // A failed read leaves the column blank ("—" for everyone), never a guessed On or Off.
    try { [graces, switches] = await Promise.all([graceStartsFor(org.id), orgTwoStepFacts(org.id)]); } catch { switches = null; }
  }
  const now = Date.now();

  // Batch-fetch tournament assignments for all members
  const memberIds = members.map(m => m.id);
  const [{ data: allAssignments }, { data: allRepGroupScopes }] = await Promise.all([
    supabaseAdmin
      .from('org_member_tournament_assignments')
      .select('org_member_id, tournament_id')
      .in('org_member_id', memberIds),
    supabaseAdmin
      .from('org_member_rep_group_scopes')
      .select('member_id, group_id')
      .in('member_id', memberIds),
  ]);

  const assignmentMap = new Map<string, string[]>();
  for (const a of allAssignments ?? []) {
    const arr = assignmentMap.get(a.org_member_id) ?? [];
    arr.push(a.tournament_id);
    assignmentMap.set(a.org_member_id, arr);
  }

  const repGroupScopeMap = new Map<string, string[]>();
  for (const s of allRepGroupScopes ?? []) {
    const arr = repGroupScopeMap.get(s.member_id) ?? [];
    arr.push(s.group_id);
    repGroupScopeMap.set(s.member_id, arr);
  }

  const result = members.map(m => {
    const authUser = m.user_id ? people.get(m.user_id) : undefined;
    const status = (m.status as 'invited' | 'active' | 'suspended') ?? 'active';
    // An invitation has no seat yet ("—"); an account the read did not return is unknown, never "Off".
    // A suspended person cannot sign in, so no requirement runs for them: only On or Off, never the amber count (/review:
    // the Overview reminder counts active seats only, and the two must agree).
    const twoStep: MemberTwoStep | null = !switches || status === 'invited' || !authUser
      ? null
      : status === 'suspended'
        ? { state: authUser.twoStepOn ? 'on' : 'off' }
        : memberTwoStep(switches, m.role as string, graces.get(m.user_id) ?? null, authUser.twoStepOn, now);
    const role = m.role as OrgRole;
    const capabilities = (m.capabilities as Record<string, boolean> | null) ?? null;
    return {
      // ── Added 2026-09-25 (Club Tier Stage 1), additively — every field below them is unchanged:
      //   section — which part of Members the row belongs to (the board, scorekeepers, or coaching
      //             staff; S1-03 / Ask 6). Coaching-staff rows are refused by the board endpoints.
      //   access  — "what they can open": one row per program the plan carries, computed by the SAME
      //             `canOpenModule` every gate asks (A13 / J10-024), with the override chip's state.
      section:               memberSection(role),
      access:                whatTheyCanOpen({ role, capabilities }, org),
      id:                    m.id,
      userId:                m.user_id,
      email:                 authUser?.email ?? '(unknown)',
      displayName:           (m as any).display_name ?? null,
      title:                 (m as any).title ?? null,
      role:                  m.role,
      status,
      capabilities:          (m.capabilities as Record<string, boolean> | null) ?? null,
      invitedAt:             m.invited_at,
      acceptedAt:            m.accepted_at ?? null,
      lastSignIn:            authUser?.lastSignInAt ?? null,
      assignedTournamentIds: assignmentMap.get(m.id) ?? [],
      repGroupIds:           repGroupScopeMap.get(m.id) ?? [],
      // Part 4: present (possibly null) only for an owner or admin viewer; absent for everyone else.
      ...(seesTwoStep ? { twoStep } : {}),
    };
  });

  return NextResponse.json(result);
}, { route: '/api/admin/members' });
