import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { getPracticesForTeam, createPractices } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { zonedWallClockToUtc } from '@/lib/timezone';

function generateOccurrences(
  startDate: string,
  endDate: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
): { scheduledAt: string; endsAt: string }[] {
  const result: { scheduledAt: string; endsAt: string }[] = [];
  const end = new Date(endDate + 'T23:59:59');
  const current = new Date(startDate + 'T00:00:00');
  const daysUntil = (dayOfWeek - current.getDay() + 7) % 7;
  current.setDate(current.getDate() + daysUntil);

  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10);
    // J3-047: convert each occurrence's wall-clock (org zone, America/Toronto V1) to a
    // correct UTC instant before it lands in timestamptz — naive strings were previously
    // interpreted in the DB session zone (UTC on prod), shifting every practice 4–5h.
    result.push({
      scheduledAt: zonedWallClockToUtc(dateStr, startTime) ?? `${dateStr}T${startTime}:00`,
      endsAt:      zonedWallClockToUtc(dateStr, endTime)   ?? `${dateStr}T${endTime}:00`,
    });
    current.setDate(current.getDate() + 7);
  }
  return result;
}

export const GET = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  await params;
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_house_league'))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const teamId = req.nextUrl.searchParams.get('teamId');
  if (!teamId) return NextResponse.json({ error: 'teamId required' }, { status: 400 });

  const practices = await getPracticesForTeam(teamId);
  return NextResponse.json({ practices });
}, { route: '/api/admin/house-league/seasons/[seasonId]/practices' });

export const POST = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const { seasonId } = await params;
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_house_league'))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (ctx.role !== 'owner' && ctx.role !== 'league_admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const {
    teamId,
    divisionId = null,
    recurring = false,
    dayOfWeek,
    startDate,
    endDate,
    scheduledDate,
    startTime,
    endTime = null,
    location = null,
    notes = null,
  } = body;

  if (!teamId) return NextResponse.json({ error: 'teamId required' }, { status: 400 });

  const inputs: Parameters<typeof createPractices>[0] = [];

  if (recurring) {
    if (dayOfWeek == null || !startDate || !endDate || !startTime || !endTime)
      return NextResponse.json({ error: 'Missing recurring fields' }, { status: 400 });

    const groupId = randomUUID();
    const occurrences = generateOccurrences(startDate, endDate, Number(dayOfWeek), startTime, endTime);
    if (!occurrences.length)
      return NextResponse.json({ error: 'No occurrences in date range' }, { status: 400 });

    for (const { scheduledAt, endsAt } of occurrences) {
      inputs.push({ orgId: ctx.org.id, seasonId, divisionId, teamId, scheduledAt, endsAt, location, notes, recurrenceGroupId: groupId });
    }
  } else {
    if (!scheduledDate || !startTime)
      return NextResponse.json({ error: 'scheduledDate and startTime required' }, { status: 400 });

    // J3-047: org-zone wall-clock → UTC (see generateOccurrences).
    const scheduledAt = zonedWallClockToUtc(scheduledDate, startTime) ?? `${scheduledDate}T${startTime}:00`;
    const endsAt = endTime ? (zonedWallClockToUtc(scheduledDate, endTime) ?? `${scheduledDate}T${endTime}:00`) : null;
    inputs.push({ orgId: ctx.org.id, seasonId, divisionId, teamId, scheduledAt, endsAt, location, notes });
  }

  const practices = await createPractices(inputs);
  return NextResponse.json({ practices, count: practices.length }, { status: 201 });
}, { route: '/api/admin/house-league/seasons/[seasonId]/practices' });
