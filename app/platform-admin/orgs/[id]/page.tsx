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
import { effectiveOrgFactsOf } from '@/lib/entitlement-grants';
import { freeTimeDoorFacts } from '@/lib/free-time-writes';
import { earliestLastDay, grantablePlansAbove, isGrantRunning, lastDayOfInstant, latestLastDay } from '@/lib/free-time';
import { isFoundingSeasonCompExpiry } from '@/lib/plan-config';
import { stripeStillBills } from '@/lib/stripe-billing-state';
import { readPortalRecordFreeTime } from '@/lib/portal-free-time-tab';
import ClubRecord, { type ClubRecordProps } from './ClubRecord';
import { readClubOnlinePayments } from '@/lib/platform-online-payments';

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
  id: string; type: string; value: string | null; target: { addons?: string[]; plan?: string } | null; starts_at: string | null; expires_at: string | null;
  reason: string | null; created_by: string | null; created_at: string; revoked_at: string | null; revoked_by: string | null;
};

/** Free time as the record reads it: running now, or when each ended (revoked, or ran out). The end is read as the last
 *  free day (owner ruling Q8); a comp period carrying Founding Season's end is Founding Season. */
function overrideRows(rows: OverrideRow[], now = new Date()): ClubRecordProps['overrides'] {
  const nowMs = now.getTime();
  return rows.map(o => ({
    id: o.id,
    type: o.type,
    value: o.value,
    addons: o.target?.addons ?? [],
    plan: o.target?.plan ?? null,
    expiresAt: o.expires_at,
    lastDay: o.expires_at ? lastDayOfInstant(o.expires_at) : null,
    founding: o.type === 'comp_period' && !!o.expires_at && isFoundingSeasonCompExpiry(o.expires_at),
    reason: o.reason,
    createdBy: o.created_by,
    createdAt: o.created_at,
    endedAt: o.revoked_at ?? (o.expires_at && Date.parse(o.expires_at) <= nowMs ? o.expires_at : null),
    running: isGrantRunning(o, now),
  }));
}

export default async function ClubRecordPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; via?: string }>;
}) {
  const auth = await requirePlatformAreaView('organizations');
  const { id } = await params;
  const { via } = await searchParams;
  const readsStripe = hasPlatformPower(auth.role, 'find_stripe');
  const onlinePaymentsRead = readsStripe ? readClubOnlinePayments(id).catch(() => 'failed' as const) : Promise.resolve(null);

  // Every read at once; the members' sign-in facts chain straight off the members read. Opening the record is the read
  // that matters after a complaint (A3): its trail row is written alongside, best effort, never a gate.
  const [orgRes, { memberRows, people }, tournamentsRes, teamCountRes, overridesRes, ownAddress, teamMoves, story, , doorFacts] = await Promise.all([
    supabaseAdmin
      .from('organizations')
      .select('id, name, slug, plan_id, tournament_limit, team_limit, subscription_status, subscription_period, current_period_end, stripe_customer_id, stripe_subscription_id, created_at, enabled_addons, account_kind')
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
    buildClubStory(id, { money: readsStripe, leads: hasPlatformPower(auth.role, 'growth') }),
    recordOpened({ actorUserId: auth.user.id, actorEmail: auth.user.email, kind: 'club', recordId: id, viaFind: via === 'find' }),
    hasPlatformPower(auth.role, 'club_billing') ? freeTimeDoorFacts(id, { id: auth.user.id, email: auth.user.email ?? '' }) : Promise.resolve(null),
  ]);
  const org = orgRes.data;
  if (!org) notFound();
  // A Coaches Portal's free time (Stage 4b) is its own kind: its chip, band, Access row and windows, never a club's.
  const isPortal = org.account_kind === 'team_workspace';
  const canGivePortal = hasPlatformPower(auth.role, 'portal_free_time');
  const portalFreeTime = isPortal
    ? await readPortalRecordFreeTime(id, org.name, { id: auth.user.id, email: auth.user.email ?? '', role: auth.role }, canGivePortal).catch(() => null)
    : null;
  // Club Tier 12d-2: the Online payments tab's read — ours only (no Stripe call), for the roles that read Stripe's records,
  // started beside the record's other reads (/review).
  const onlinePayments = await onlinePaymentsRead;

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
  // The band follows the plan the club is on RIGHT NOW (a Club grant reads as a Club band); the title's chip, the
  // pencil and Money keep the plan it holds.
  const now = await effectiveOrgFactsOf(org);
  const isClubBand = now.planId === 'club' || now.planId === 'club_large';
  const tournaments = ((tournamentsRes.data ?? []) as Array<{ id: string; name: string; status: string; start_date: string | null; end_date: string | null }>)
    .map(t => ({ id: t.id, name: t.name, status: t.status, startDate: t.start_date, endDate: t.end_date }));
  const overrides = overrideRows((overridesRes.data ?? []) as OverrideRow[]);

  const status = org.subscription_status ?? 'active';
  // The Money tab names running free time on our side only (it is not Stripe's to agree with).
  const runningGrant = portalFreeTime?.running
    ? overrides.find(o => o.id === portalFreeTime.running!.id)
    : overrides.find(o => o.running && o.type === 'plan_tier' && o.lastDay);
  const runningFounding = overrides.find(o => o.running && o.founding && o.lastDay);
  const freeRow = runningGrant ?? runningFounding;
  const freeThrough = freeRow ? { lastDay: freeRow.lastDay!, what: runningGrant ? 'free time' : 'Founding Season' } : null;
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
      billingCycle: org.subscription_period === 'annual' || org.subscription_period === 'monthly' ? org.subscription_period : null,
      stripeCustomerId: org.stripe_customer_id,
      stripeSubscriptionId: org.stripe_subscription_id,
      paysThroughStripe: stripeStillBills({ stripeSubscriptionId: org.stripe_subscription_id, subscriptionStatus: org.subscription_status }),
      tournamentLimit: getEffectiveTournamentLimit(plan, org.tournament_limit),
      teamLimit: plan === 'club' || plan === 'club_large' ? getEffectiveTeamLimit(plan, org.team_limit) : null,
      storedTeamLimit: org.team_limit,
      isClubBand,
      nowPlanId: now.planId,
      nowPlanLabel: planLabel(now.planId),
      nowTournamentLimit: now.tournamentLimit,
      nowTeamLimit: isClubBand ? now.teamLimit : null,
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
    portalFreeTime,
    freeTime: isPortal || !doorFacts ? null : {
      block: doorFacts.block,
      planBlock: doorFacts.planBlock,
      plansAbove: grantablePlansAbove(plan).map(p => ({ id: p, label: planLabel(p) })),
      earliest: earliestLastDay(),
      latest: latestLastDay(auth.role) ?? earliestLastDay(),
      capMonths: auth.role === 'super_admin' ? 12 : 6,
      superAdmin: auth.role === 'super_admin',
    },
    can: {
      support: hasPlatformPower(auth.role, 'club_support'),
      billing: hasPlatformPower(auth.role, 'club_billing'),
      sections: hasPlatformPower(auth.role, 'club_sections'),
      delete: hasPlatformPower(auth.role, 'delete_records'),
      emailOwner: hasPlatformPower(auth.role, 'email_owner'),
      portalFreeTime: canGivePortal,
    },
    onlinePayments,
    money: {
      readsStripe,
      billsClub: hasPlatformPower(auth.role, 'club_billing'),
      // Our side of the comparison: the plan the club PAYS for and the stored billing columns; free time shown, never compared.
      ours: {
        planId: plan,
        status,
        currentPeriodEnd: org.current_period_end,
        subscriptionId: org.stripe_subscription_id,
        customerId: org.stripe_customer_id,
        freeThrough,
      },
    },
  };
  return <ClubRecord {...props} />;
}
