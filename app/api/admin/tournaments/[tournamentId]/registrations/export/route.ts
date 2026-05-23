import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextWithScope, forbidden, scopeGuard, unauthorized } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasPlanFeature, requiresTournamentPlusCopy } from '@/lib/plan-features';
import { supabaseAdmin } from '@/lib/supabase-admin';
import ExcelJS from 'exceljs';
import {
  getTournamentRegistrationFieldAnswersForRegistrations,
  getTournamentRegistrationFields,
} from '@/lib/db';
import { writePlatformEvent } from '@/lib/platform-events';

type RouteParams = { params: Promise<{ tournamentId: string }> };

type TeamExportRow = {
  id: string;
  name: string;
  coach: string | null;
  email: string | null;
  status: string | null;
  payment_status: string | null;
  deposit_paid: number | null;
  total_paid: number | null;
  registered_at: string | null;
  waitlist_position: number | null;
  age_group_id: string | null;
};

type FeeRow = {
  deposit_amount: number | null;
  deposit_due_date: string | null;
  total_fee_amount: number | null;
  total_fee_due_date: string | null;
};

type TournamentExportRow = FeeRow & {
  id: string;
  name: string;
  org_id: string | null;
  fee_schedule_mode: string | null;
};

type AgeGroupExportRow = FeeRow & {
  id: string;
  name: string;
};

function csvCell(value: unknown) {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function answerValue(answer: Awaited<ReturnType<typeof getTournamentRegistrationFieldAnswersForRegistrations>>[number] | undefined) {
  if (!answer) return '';
  if (answer.fileUrl) return answer.fileUrl;
  if (answer.valueText) return answer.valueText;
  if (answer.valueJson && typeof answer.valueJson === 'object' && 'checked' in answer.valueJson) {
    return (answer.valueJson as { checked?: unknown }).checked ? 'Yes' : 'No';
  }
  return '';
}

function effectiveFee(team: TeamExportRow, tournament: TournamentExportRow, ageGroups: Map<string, AgeGroupExportRow>): FeeRow {
  const group = team.age_group_id ? ageGroups.get(team.age_group_id) : null;
  if (tournament.fee_schedule_mode === 'age_group' && group?.total_fee_amount != null) {
    return group;
  }
  return tournament;
}

function paymentReadinessStatus(team: TeamExportRow, fee: FeeRow, today: string) {
  const depositPaid = Number(team.deposit_paid ?? 0);
  const totalPaid = Number(team.total_paid ?? 0);
  if (!fee.total_fee_amount) return 'No schedule';
  if (totalPaid >= Number(fee.total_fee_amount)) return 'Paid';
  if (fee.total_fee_due_date && today > fee.total_fee_due_date) return 'Past due';
  if (fee.deposit_amount && fee.deposit_due_date && today > fee.deposit_due_date && depositPaid < Number(fee.deposit_amount)) return 'Past due';
  if (fee.deposit_amount && depositPaid >= Number(fee.deposit_amount)) return 'Deposit paid';
  return 'Pending';
}

function paymentDue(team: TeamExportRow, fee: FeeRow) {
  const depositPaid = Number(team.deposit_paid ?? 0);
  const totalPaid = Number(team.total_paid ?? 0);
  if (!fee.total_fee_amount || totalPaid >= Number(fee.total_fee_amount)) return { amount: '', dueDate: '' };
  if (fee.deposit_amount && depositPaid < Number(fee.deposit_amount)) {
    return {
      amount: Math.max(Number(fee.deposit_amount) - depositPaid, 0),
      dueDate: fee.deposit_due_date ?? '',
    };
  }
  return {
    amount: Math.max(Number(fee.total_fee_amount) - totalPaid, 0),
    dueDate: fee.total_fee_due_date ?? '',
  };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const orgSlug = req.nextUrl.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug });
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_tournaments')) return forbidden();

  const { tournamentId } = await params;
  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;

  const { data: tournament, error: tournamentError } = await supabaseAdmin
    .from('tournaments')
    .select('id, name, org_id, fee_schedule_mode, deposit_amount, deposit_due_date, total_fee_amount, total_fee_due_date')
    .eq('id', tournamentId)
    .maybeSingle<TournamentExportRow>();

  if (tournamentError) return NextResponse.json({ error: tournamentError.message }, { status: 500 });
  if (!tournament || tournament.org_id !== ctx.org.id) return forbidden();

  await writePlatformEvent({
    eventType: 'tournament_plus_feature_used',
    source: 'app',
    orgId: ctx.org.id,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    planId: ctx.org.planId,
    metadata: { feature: 'registration_export', tournamentId, status: 'attempted' },
  });

  if (!hasPlanFeature(ctx.org.planId, 'registration_export')) {
    return NextResponse.json({ error: requiresTournamentPlusCopy('registration_export') }, { status: 403 });
  }

  const [{ data: teams, error: teamsError }, { data: ageGroups, error: groupsError }, fields] = await Promise.all([
    supabaseAdmin
      .from('teams')
      .select('id, name, coach, email, status, payment_status, deposit_paid, total_paid, registered_at, waitlist_position, age_group_id')
      .eq('tournament_id', tournamentId)
      .order('registered_at', { ascending: true }),
    supabaseAdmin
      .from('age_groups')
      .select('id, name, deposit_amount, deposit_due_date, total_fee_amount, total_fee_due_date')
      .eq('tournament_id', tournamentId),
    getTournamentRegistrationFields(tournamentId),
  ]);

  if (teamsError) return NextResponse.json({ error: teamsError.message }, { status: 500 });
  if (groupsError) return NextResponse.json({ error: groupsError.message }, { status: 500 });

  const typedTeams = (teams ?? []) as TeamExportRow[];
  const typedAgeGroups = (ageGroups ?? []) as AgeGroupExportRow[];
  const groupMap = new Map(typedAgeGroups.map(group => [group.id, group.name]));
  const groupFeeMap = new Map(typedAgeGroups.map(group => [group.id, group]));
  const answers = await getTournamentRegistrationFieldAnswersForRegistrations(typedTeams.map(team => team.id));
  const answersByRegistration = new Map<string, Map<string, typeof answers[number]>>();
  for (const answer of answers) {
    const registrationAnswers = answersByRegistration.get(answer.registrationId) ?? new Map();
    registrationAnswers.set(answer.fieldId, answer);
    answersByRegistration.set(answer.registrationId, registrationAnswers);
  }

  const headers = [
    'Team name',
    'Division',
    'Status',
    'Contact name',
    'Email',
    'Phone',
    'Registered at',
    'Payment status',
    'Deposit paid',
    'Total paid',
    'Payment readiness status',
    'Amount due',
    'Payment due date',
    'Waitlist position',
    ...fields.map(field => field.label),
  ];

  const today = new Date().toISOString().split('T')[0];
  const rows = typedTeams.map(team => {
    const fee = effectiveFee(team, tournament, groupFeeMap);
    const due = paymentDue(team, fee);
    return [
      team.name,
      team.age_group_id ? groupMap.get(team.age_group_id) ?? '' : '',
      team.status ?? '',
      team.coach ?? '',
      team.email ?? '',
      '',
      team.registered_at ?? '',
      team.payment_status ?? '',
      team.deposit_paid ?? '',
      team.total_paid ?? '',
      paymentReadinessStatus(team, fee, today),
      due.amount,
      due.dueDate,
      team.waitlist_position ?? '',
      ...fields.map(field => answerValue(answersByRegistration.get(team.id)?.get(field.id))),
    ];
  });

  await writePlatformEvent({
    eventType: 'tournament_plus_feature_used',
    source: 'app',
    orgId: ctx.org.id,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    planId: ctx.org.planId,
    metadata: { feature: 'registration_export', tournamentId, status: 'completed', rowCount: typedTeams.length },
  });

  const format = req.nextUrl.searchParams.get('format') ?? 'xlsx';
  const slug = tournament.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tournament';
  const date = new Date().toISOString().split('T')[0];

  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'FieldLogicHQ';
    workbook.created = new Date();
    const ws = workbook.addWorksheet('Registrations');

    const headerRow = ws.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };

    rows.forEach(row => ws.addRow(row.map(cell => (cell == null ? '' : cell))));

    ws.columns.forEach((col, i) => {
      const headerLen = (headers[i] ?? '').length;
      let maxData = 0;
      rows.forEach(r => { const l = String(r[i] ?? '').length; if (l > maxData) maxData = l; });
      col.width = Math.min(Math.max(headerLen, maxData) + 2, 60);
    });
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${slug}-registrations-${date}.xlsx"`,
      },
    });
  }

  // Default: CSV
  const csv = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\n');
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}-registrations-${date}.csv"`,
    },
  });
}
