import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepRosterPlayers,
  getRepPlayerDuesSchedules,
  getRepPlayerDuesInstallments,
  upsertRepPlayerDuesSchedule,
} from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';

async function resolveCoachContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext();
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: forbidden() };

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }

  return { ctx, team, assignment, programYear };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },
) {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { programYear } = resolved;

  const [rosterPlayers, schedules] = await Promise.all([
    getRepRosterPlayers(programYear.id),
    getRepPlayerDuesSchedules(programYear.id),
  ]);

  const scheduleMap = new Map(schedules.map(s => [s.playerId, s]));

  // Fetch all credits for this program year in one query
  const { data: allCredits } = await supabaseAdmin
    .from('rep_dues_credits')
    .select('*')
    .eq('program_year_id', programYear.id)
    .order('credit_date', { ascending: false });

  const creditsMap = new Map<string, Array<Record<string, unknown>>>();
  for (const c of (allCredits ?? []) as Array<Record<string, unknown>>) {
    const pid = c.player_id as string;
    if (!creditsMap.has(pid)) creditsMap.set(pid, []);
    creditsMap.get(pid)!.push(c);
  }

  const playersWithDues = await Promise.all(
    rosterPlayers.map(async p => {
      const schedule = scheduleMap.get(p.id) ?? null;
      const installments = schedule ? await getRepPlayerDuesInstallments(schedule.id) : [];
      const paidAmount = installments.filter(i => i.paidAt).reduce((s, i) => s + i.amount, 0);
      const outstanding = schedule ? schedule.totalAmount - paidAmount : 0;

      const rawCredits = creditsMap.get(p.id) ?? [];
      const credits = rawCredits.map(c => ({
        id:          c.id,
        programYearId: c.program_year_id,
        playerId:    c.player_id,
        amount:      c.amount,
        description: c.description,
        creditDate:  c.credit_date,
        creditType:  c.credit_type,
        notes:       c.notes ?? null,
        createdAt:   c.created_at,
      }));
      const totalCredits  = credits.reduce((s, c) => s + (c.amount as number), 0);
      const rollingBalance = Math.round((outstanding - totalCredits) * 100) / 100;

      return {
        player: p,
        schedule,
        installments,
        paidAmount,
        outstanding,
        credits,
        totalCredits: Math.round(totalCredits * 100) / 100,
        rollingBalance,
      };
    }),
  );

  return NextResponse.json({ players: playersWithDues });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },
) {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { team, programYear } = resolved;

  const body = await req.json();
  const { playerId, totalAmount, notes = null, installments } = body;

  if (!playerId || typeof totalAmount !== 'number' || totalAmount <= 0) {
    return NextResponse.json({ error: 'playerId and totalAmount > 0 are required' }, { status: 400 });
  }
  if (!Array.isArray(installments) || !installments.length) {
    return NextResponse.json({ error: 'At least one installment is required' }, { status: 400 });
  }

  const installmentSum = installments.reduce((s: number, i: any) => s + Number(i.amount), 0);
  if (Math.abs(installmentSum - totalAmount) > 0.01) {
    return NextResponse.json(
      { error: `Installment amounts (${installmentSum}) must sum to totalAmount (${totalAmount})` },
      { status: 400 },
    );
  }

  const result = await upsertRepPlayerDuesSchedule({
    programYearId: programYear.id,
    playerId,
    teamId: team.id,
    orgId: team.orgId,
    totalAmount,
    notes,
    installments: installments.map((i: any, idx: number) => ({
      installmentNumber: i.installmentNumber ?? idx + 1,
      amount: Number(i.amount),
      dueDate: i.dueDate,
    })),
  });

  return NextResponse.json(result, { status: 201 });
}
