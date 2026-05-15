import { forbidden, getAuthContextWithScope, scopeGuard, unauthorized } from '@/lib/api-auth';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase-admin';

type GameStatusRow = {
  status: string | null;
};

type AgeGroupRow = {
  id: string;
  name: string;
  is_closed: boolean | null;
  capacity: number | null;
  deposit_amount: number | null;
  deposit_due_date: string | null;
  total_fee_amount: number | null;
  total_fee_due_date: string | null;
};

type TeamPaymentRow = {
  id: string;
  age_group_id: string;
  status: string | null;
  deposit_paid: number | null;
  total_paid: number | null;
};

type TournamentFeeRow = {
  start_date: string | null;
  end_date: string | null;
  contact_email: string | null;
  fee_schedule_mode: string | null;
  deposit_amount: number | null;
  deposit_due_date: string | null;
  total_fee_amount: number | null;
  total_fee_due_date: string | null;
};

export async function GET(req: Request) {
  const ctx = await getAuthContextWithScope();
  if (!ctx) return unauthorized();

  if (!hasCapability(ctx.role, ctx.capabilities, 'module_tournaments')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_tournaments')) return forbidden();

  const tournamentId = new URL(req.url).searchParams.get('tournamentId');
  if (!tournamentId) {
    return Response.json({ error: 'Missing tournamentId' }, { status: 400 });
  }

  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;

  const { data: tournament, error: tournamentError } = await supabaseAdmin
    .from('tournaments')
    .select('start_date, end_date, contact_email, fee_schedule_mode, deposit_amount, deposit_due_date, total_fee_amount, total_fee_due_date, logo_url, hero_banner_url, theme_preset, theme_primary')
    .eq('id', tournamentId)
    .eq('organization_id', ctx.org.id)
    .maybeSingle();

  if (tournamentError) {
    return Response.json({ error: tournamentError.message }, { status: 500 });
  }

  if (!tournament) {
    return Response.json({ error: 'Tournament not found' }, { status: 404 });
  }

  const t = tournament as TournamentFeeRow;

  const [ageGroupsRes, teamsRes, gamesRes, announcementsRes, teamPaymentsRes] = await Promise.all([
    supabaseAdmin
      .from('age_groups')
      .select('id, name, is_closed, capacity, deposit_amount, deposit_due_date, total_fee_amount, total_fee_due_date', { count: 'exact' })
      .eq('tournament_id', tournamentId),
    supabaseAdmin
      .from('teams')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId),
    supabaseAdmin
      .from('games')
      .select('status')
      .eq('tournament_id', tournamentId),
    supabaseAdmin
      .from('announcements')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId),
    supabaseAdmin
      .from('teams')
      .select('id, age_group_id, status, deposit_paid, total_paid')
      .eq('tournament_id', tournamentId),
  ]);

  const queryError = ageGroupsRes.error ?? teamsRes.error ?? gamesRes.error ?? announcementsRes.error ?? teamPaymentsRes.error;
  if (queryError) {
    return Response.json({ error: queryError.message }, { status: 500 });
  }

  const games = (gamesRes.data ?? []) as GameStatusRow[];
  const ageGroups = (ageGroupsRes.data ?? []) as AgeGroupRow[];
  const teamPayments = (teamPaymentsRes.data ?? []) as TeamPaymentRow[];
  const today = new Date().toISOString().split('T')[0];

  const hasDates = Boolean(t.start_date && t.end_date);
  const hasDivisions = ageGroups.length > 0;
  const hasPublicContact = Boolean(t.contact_email || ctx.org.contactEmail);
  const hasOpenDivision = hasDivisions && ageGroups.some(group => !group.is_closed);
  const hasBranding = Boolean((t as any).logo_url || (t as any).hero_banner_url || (t as any).theme_preset || (t as any).theme_primary);

  // Registration stats
  const byDivision = ageGroups.map(g => {
    const groupTeams = teamPayments.filter(tm => tm.age_group_id === g.id);
    return {
      id: g.id,
      name: g.name,
      capacity: g.capacity ?? null,
      accepted: groupTeams.filter(tm => tm.status === 'accepted').length,
      pending:  groupTeams.filter(tm => tm.status === 'pending').length,
      waitlist: groupTeams.filter(tm => tm.status === 'waitlist').length,
    };
  });

  const totalAccepted = byDivision.reduce((s, g) => s + g.accepted, 0);
  const totalPending  = byDivision.reduce((s, g) => s + g.pending, 0);
  const totalWaitlist = byDivision.reduce((s, g) => s + g.waitlist, 0);
  const totalCapacity = byDivision.reduce((s, g) => s + (g.capacity ?? 0), 0);

  // Payment stats — only accepted teams count
  const acceptedTeams = teamPayments.filter(tm => tm.status === 'accepted');
  const feeMode = t.fee_schedule_mode ?? 'tournament';

  const paymentCounts = { paid: 0, depositPaid: 0, pending: 0, pastDue: 0, noSchedule: 0 };
  let totalExpected = 0;
  let totalCollected = 0;

  for (const tm of acceptedTeams) {
    const ag = ageGroups.find(g => g.id === tm.age_group_id);
    const fee = feeMode === 'age_group' && ag?.total_fee_amount != null
      ? { depositAmount: ag.deposit_amount, depositDueDate: ag.deposit_due_date, totalFeeAmount: ag.total_fee_amount, totalFeeDueDate: ag.total_fee_due_date }
      : { depositAmount: t.deposit_amount, depositDueDate: t.deposit_due_date, totalFeeAmount: t.total_fee_amount, totalFeeDueDate: t.total_fee_due_date };

    const totalFee = fee.totalFeeAmount ?? 0;
    const depositAmt = fee.depositAmount ?? 0;
    const depDue = fee.depositDueDate;
    const totDue = fee.totalFeeDueDate;
    const depositPaid = Number(tm.deposit_paid ?? 0);
    const totalPaid   = Number(tm.total_paid ?? 0);

    if (!fee.totalFeeAmount) {
      paymentCounts.noSchedule++;
      continue;
    }

    totalExpected  += totalFee;
    totalCollected += totalPaid;

    if (totalPaid >= totalFee) {
      paymentCounts.paid++;
    } else if (totDue && today > totDue) {
      paymentCounts.pastDue++;
    } else if (depositAmt && depDue && today > depDue && depositPaid < depositAmt) {
      paymentCounts.pastDue++;
    } else if (depositAmt && depositPaid >= depositAmt) {
      paymentCounts.depositPaid++;
    } else {
      paymentCounts.pending++;
    }
  }

  return Response.json({
    ageGroups: ageGroupsRes.count ?? ageGroups.length,
    teams: teamsRes.count ?? 0,
    scheduled: games.filter(game => game.status === 'scheduled').length,
    completed: games.filter(game => game.status === 'completed').length,
    announcements: announcementsRes.count ?? 0,
    publishChecklist: {
      hasDates,
      hasDivisions,
      hasPublicContact,
      hasOpenDivision,
      hasBranding,
      ready: hasDates && hasDivisions && hasPublicContact && hasOpenDivision,
    },
    registration: {
      totalCapacity,
      totalAccepted,
      totalPending,
      totalWaitlist,
      byDivision,
    },
    payment: {
      hasFeeSchedule: acceptedTeams.length > 0 && paymentCounts.noSchedule < acceptedTeams.length,
      totalExpected,
      totalCollected,
      counts: paymentCounts,
    },
  });
}
