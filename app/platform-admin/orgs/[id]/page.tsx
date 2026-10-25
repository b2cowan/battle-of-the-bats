import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getEffectiveTournamentLimit, getEffectiveTeamLimit, PLAN_CONFIG } from '@/lib/plan-config';
import { hasPlatformPower, requirePlatformAreaView } from '@/lib/platform-auth';
import type { OrgPlan } from '@/lib/types';
import { clubDomainStore } from '@/lib/club-domain-store';
import { peopleByIds } from '@/lib/platform-people-lookup';
import { buildClubStory } from '@/lib/platform-story';
import { recordOpened } from '@/lib/platform-record-opens';
import { planLabel, subscriptionStatusLabel } from '@/lib/platform-labels';
import { holdsSlot } from '@/lib/tournament-slot';
import ClubRecord, { type ClubRecordProps } from './ClubRecord';

/**
 * A club's record (Support console Stage 2, owner rulings A4 + A6 + R2 + R6, 2026-10-25; drawings Ub7fXLh29SC34Zp4oqKUx1,
 * "The customer record reads first"). A club, a tournament host and a coaches portal are all this record; the band's
 * figures follow the plan.
 *
 * It READS FIRST: title + plan and state chips + a caption (owner · web name · created), a four-figure band, and four tabs —
 * Story · Money · Access · People & tournaments — opening on the Story. One pencil turns the whole record into its form;
 * the check mark confirms in one sentence and asks why. A read-only role (R6) sees the same record with no pencil, no Put
 * it back, no rare doors, no Add a note and no Email the owner, and no banner: the menu's eye already said so.
 *
 * Opening it writes one row to the trail of records opened (A3) — who, when, which, via Find or not; never the words.
 */
export const metadata = { title: 'Club record — Support console' };

const STORY_PAGE = 50;

function stripeBase() {
  // The mode comes from the secret key's prefix, not the id (a `sub_…` looks the same in both modes).
  return `https://dashboard.stripe.com${(process.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_live_') ? '' : '/test'}`;
}

/** The coach's own teams brought into this club (Club Tier Stage 2, B04): finished moves and open requests. Read only. */
async function getTeamMoves(orgId: string): Promise<ClubRecordProps['teamMoves']> {
  const { data: links } = await supabaseAdmin
    .from('team_org_links')
    .select('id, rep_team_id, status, approved_by_org_user_id, updated_at')
    .eq('linked_org_id', orgId)
    .in('status', ['ownership_pending', 'org_owned'])
    .eq('link_type', 'ownership')
    .order('updated_at', { ascending: false });
  const rows = (links ?? []) as Array<{ id: string; rep_team_id: string; status: string; approved_by_org_user_id: string | null; updated_at: string }>;
  if (rows.length === 0) return [];
  const { data: teams } = await supabaseAdmin.from('rep_teams').select('id, name').in('id', [...new Set(rows.map(r => r.rep_team_id))]);
  const names = new Map(((teams ?? []) as Array<{ id: string; name: string }>).map(t => [t.id, t.name]));
  return rows.map(r => ({
    id: r.id,
    teamName: names.get(r.rep_team_id) ?? 'A team',
    at: r.updated_at,
    state: r.status === 'org_owned' ? 'moved' : r.approved_by_org_user_id ? 'waiting_on_coach' : 'waiting_on_club',
  }));
}

type OverrideRow = {
  id: string; type: string; value: string | null; target: { addons?: string[] } | null; starts_at: string | null; expires_at: string | null;
  reason: string | null; created_by: string | null; created_at: string; revoked_at: string | null; revoked_by: string | null;
};

/** Overrides as the record reads them: running now, or when each ended (revoked, or ran out). */
function overrideRows(rows: OverrideRow[], nowMs = Date.now()): ClubRecordProps['overrides'] {
  return rows.map(o => ({
    id: o.id,
    type: o.type,
    value: o.value,
    addons: o.target?.addons ?? [],
    expiresAt: o.expires_at,
    reason: o.reason,
    createdBy: o.created_by,
    createdAt: o.created_at,
    endedAt: o.revoked_at ?? (o.expires_at && Date.parse(o.expires_at) <= nowMs ? o.expires_at : null),
    running: !o.revoked_at && (!o.starts_at || Date.parse(o.starts_at) <= nowMs) && (!o.expires_at || Date.parse(o.expires_at) > nowMs),
  }));
}

export default async function ClubRecordPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; via?: string }>;
}) {
  const auth = await requirePlatformAreaView('organizations');
  const { id } = await params;
  const { via } = await searchParams;

  // Every read at once; the members' sign-in facts chain straight off the members read. Opening the record is the read
  // that matters after a complaint (A3): its trail row is written alongside, best effort, never a gate.
  const [orgRes, { memberRows, people }, tournamentsRes, teamCountRes, overridesRes, ownAddress, teamMoves, story] = await Promise.all([
    supabaseAdmin
      .from('organizations')
      .select('id, name, slug, plan_id, tournament_limit, team_limit, subscription_status, current_period_end, stripe_customer_id, stripe_subscription_id, created_at, enabled_addons, account_kind')
      .eq('id', id)
      .maybeSingle(),
    supabaseAdmin.from('organization_members').select('user_id, role, status, accepted_at').eq('organization_id', id).limit(2000)
      .then(async res => {
        const rows = (res.data ?? []) as Array<{ user_id: string; role: string; status: string | null; accepted_at: string | null }>;
        return { memberRows: rows, people: await peopleByIds(rows.map(m => m.user_id)).catch(() => new Map()) };
      }),
    supabaseAdmin.from('tournaments').select('id, name, status, start_date, end_date').eq('org_id', id).neq('status', 'archived').order('start_date', { ascending: false }),
    supabaseAdmin.from('rep_teams').select('id', { count: 'exact', head: true }).eq('org_id', id).eq('is_archived', false),
    supabaseAdmin.from('org_overrides').select('id, type, value, target, starts_at, expires_at, reason, created_by, created_at, revoked_at, revoked_by').eq('org_id', id).order('created_at', { ascending: false }),
    clubDomainStore.getByOrg(id).catch(() => null),
    getTeamMoves(id),
    buildClubStory(id),
    recordOpened({ actorUserId: auth.user.id, actorEmail: auth.user.email, kind: 'club', recordId: id, viaFind: via === 'find' }),
  ]);
  const org = orgRes.data;
  if (!org) notFound();

  const members = memberRows.map(m => {
    const p = people.get(m.user_id);
    return {
      userId: m.user_id,
      email: p?.email ?? '(no email)',
      name: p?.displayName ?? null,
      role: m.role,
      status: m.status ?? 'active',
      lastSignInAt: p?.lastSignInAt ?? null,
    };
  });
  const owners = members.filter(m => m.role === 'owner');
  const ownerLastSignIn = owners.map(o => o.lastSignInAt).filter((v): v is string => !!v).sort().at(-1) ?? null;

  const plan = (org.plan_id ?? 'tournament') as OrgPlan;
  const isClubBand = plan === 'club' || plan === 'club_large';
  const tournaments = ((tournamentsRes.data ?? []) as Array<{ id: string; name: string; status: string; start_date: string | null; end_date: string | null }>)
    .map(t => ({ id: t.id, name: t.name, status: t.status, startDate: t.start_date, endDate: t.end_date }));
  const overrides = overrideRows((overridesRes.data ?? []) as OverrideRow[]);

  const status = org.subscription_status ?? 'active';
  const props: ClubRecordProps = {
    org: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      planId: plan,
      planLabel: planLabel(plan),
      status,
      statusLabel: subscriptionStatusLabel(status),
      createdAt: org.created_at,
      currentPeriodEnd: org.current_period_end,
      stripeCustomerId: org.stripe_customer_id,
      stripeSubscriptionId: org.stripe_subscription_id,
      tournamentLimit: getEffectiveTournamentLimit(plan, org.tournament_limit),
      teamLimit: isClubBand ? getEffectiveTeamLimit(plan, org.team_limit) : null,
      storedTeamLimit: org.team_limit,
      isClubBand,
      enabledAddons: org.enabled_addons ?? [],
      planSections: (PLAN_CONFIG[plan]?.moduleEntitlements ?? []) as string[],
    },
    stripeBase: stripeBase(),
    ownerEmail: owners[0]?.email ?? null,
    ownerLastSignIn,
    teamCount: teamCountRes.count ?? 0,
    // The limit counts the tournaments that hold a slot (draft or active), the one rule in lib/tournament-slot.
    slotsHeld: tournaments.filter(t => holdsSlot(t.status)).length,
    members,
    tournaments,
    overrides,
    ownAddress: ownAddress ? { address: ownAddress.full_name, status: ownAddress.status } : null,
    teamMoves,
    story: { entries: story.slice(0, STORY_PAGE), total: story.length },
    planOptions: Object.entries(PLAN_CONFIG).map(([key, c]) => ({ id: key, label: c.label, tournamentLimit: c.tournamentLimit, teamLimit: c.teamLimit })),
    can: {
      support: hasPlatformPower(auth.role, 'club_support'),
      billing: hasPlatformPower(auth.role, 'club_billing'),
      sections: hasPlatformPower(auth.role, 'club_sections'),
      delete: hasPlatformPower(auth.role, 'delete_records'),
      emailOwner: hasPlatformPower(auth.role, 'email_owner'),
    },
  };
  return <ClubRecord {...props} />;
}
