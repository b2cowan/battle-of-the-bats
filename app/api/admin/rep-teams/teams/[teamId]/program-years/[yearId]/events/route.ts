import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import {
  getRepTeam,
  getRepProgramYear,
  getRepTeamEvents,
  createRepTeamEvent,
  createRepTeamEvents,
} from '@/lib/db';
import type { RepEventType } from '@/lib/types';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  return null;
}

function generateOccurrences(
  startDate: string,
  endDate: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string | null,
): { startsAt: string; endsAt: string | null }[] {
  const result: { startsAt: string; endsAt: string | null }[] = [];
  const end = new Date(endDate + 'T23:59:59');
  const current = new Date(startDate + 'T00:00:00');
  const daysUntil = (dayOfWeek - current.getDay() + 7) % 7;
  current.setDate(current.getDate() + daysUntil);

  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10);
    result.push({
      startsAt: `${dateStr}T${startTime}:00`,
      endsAt: endTime ? `${dateStr}T${endTime}:00` : null,
    });
    current.setDate(current.getDate() + 7);
  }
  return result;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ teamId: string; yearId: string }> },
) {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  const { teamId, yearId } = await params;
  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx!.org.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const programYear = await getRepProgramYear(yearId);
  if (!programYear || programYear.teamId !== team.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const url = new URL(req.url);
  const from = url.searchParams.get('from') ?? undefined;
  const to   = url.searchParams.get('to')   ?? undefined;
  const type = url.searchParams.get('type') as RepEventType | undefined ?? undefined;

  const events = await getRepTeamEvents(programYear.id, { from, to, type });
  return NextResponse.json({ events, programYear });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ teamId: string; yearId: string }> },
) {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'admin') return forbidden();

  const { teamId, yearId } = await params;
  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx!.org.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const programYear = await getRepProgramYear(yearId);
  if (!programYear || programYear.teamId !== team.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await req.json();
  const {
    eventType,
    name,
    description = null,
    startsAt,
    endsAt = null,
    location = null,
    opponent = null,
    homeAway = null,
    parentEventId = null,
    isRecurring = false,
    recurrenceRule = null,
  } = body;

  if (!eventType || !name?.trim()) {
    return NextResponse.json({ error: 'eventType and name are required' }, { status: 400 });
  }

  const VALID_TYPES: RepEventType[] = [
    'external_tournament', 'tournament_game', 'scrimmage', 'league_game', 'practice', 'team_event',
  ];
  if (!VALID_TYPES.includes(eventType)) {
    return NextResponse.json({ error: 'Invalid eventType' }, { status: 400 });
  }

  if (isRecurring && eventType === 'practice') {
    const { dayOfWeek, startDate, endDate, startTime, endTime = null } = recurrenceRule ?? {};
    if (dayOfWeek == null || !startDate || !endDate || !startTime) {
      return NextResponse.json(
        { error: 'recurrenceRule must include dayOfWeek, startDate, endDate, startTime for recurring practices' },
        { status: 400 },
      );
    }

    const occurrences = generateOccurrences(startDate, endDate, Number(dayOfWeek), startTime, endTime);
    if (!occurrences.length) {
      return NextResponse.json({ error: 'No occurrences generated in the given date range' }, { status: 400 });
    }

    const parentId = randomUUID();
    const rows = occurrences.map((occ, i) => ({
      programYearId: programYear.id,
      teamId: team.id,
      orgId: ctx!.org.id,
      eventType: 'practice' as RepEventType,
      name: name.trim(),
      description: description?.trim() || null,
      startsAt: occ.startsAt,
      endsAt: occ.endsAt,
      location: location?.trim() || null,
      isRecurring: true,
      recurrenceRule,
      recurrenceParentId: i === 0 ? null : parentId,
    }));

    const events = await createRepTeamEvents(rows);
    return NextResponse.json({ events, count: events.length }, { status: 201 });
  }

  if (!startsAt) {
    return NextResponse.json({ error: 'startsAt is required' }, { status: 400 });
  }

  const event = await createRepTeamEvent({
    programYearId: programYear.id,
    teamId: team.id,
    orgId: ctx!.org.id,
    eventType,
    name: name.trim(),
    description: description?.trim() || null,
    startsAt,
    endsAt: endsAt || null,
    location: location?.trim() || null,
    opponent: opponent?.trim() || null,
    homeAway: homeAway || null,
    parentEventId: parentEventId || null,
  });

  return NextResponse.json({ event }, { status: 201 });
}
