import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { getPracticesForTeam, createPractices } from '@/lib/db';

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
    result.push({
      scheduledAt: `${dateStr}T${startTime}:00`,
      endsAt:      `${dateStr}T${endTime}:00`,
    });
    current.setDate(current.getDate() + 7);
  }
  return result;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ seasonId: string }> },
) {
  await params;
  const ctx = await getAuthContextWithRole();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_house_league'))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const teamId = req.nextUrl.searchParams.get('teamId');
  if (!teamId) return NextResponse.json({ error: 'teamId required' }, { status: 400 });

  const practices = await getPracticesForTeam(teamId);
  return NextResponse.json({ practices });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ seasonId: string }> },
) {
  const { seasonId } = await params;
  const ctx = await getAuthContextWithRole();
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
      inputs.push({ seasonId, divisionId, teamId, scheduledAt, endsAt, location, notes, recurrenceGroupId: groupId });
    }
  } else {
    if (!scheduledDate || !startTime)
      return NextResponse.json({ error: 'scheduledDate and startTime required' }, { status: 400 });

    const scheduledAt = `${scheduledDate}T${startTime}:00`;
    const endsAt = endTime ? `${scheduledDate}T${endTime}:00` : null;
    inputs.push({ seasonId, divisionId, teamId, scheduledAt, endsAt, location, notes });
  }

  const practices = await createPractices(inputs);
  return NextResponse.json({ practices, count: practices.length }, { status: 201 });
}
