import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { isUuid } from '@/lib/utils';
import { isCalendarDate } from '@/lib/timezone';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { readTimeBody, resolveScheduler, schedulerRefusal } from '@/lib/club-schedule-server';
import { isClock } from '@/lib/club-schedule-settings';
import { SCHEDULE_REFUSALS as R } from '@/lib/club-schedule-words';
import { readFreeTime, type OwnTime } from '@/lib/permit-free-time-server';
import type { FreeFilters } from '@/lib/permit-free-time';
import { FACILITY_TYPES, type FacilityType } from '@/lib/types';

// ---------------------------------------------------------------------------
// FIND THE TIME (a schedule on several permits, Session D; plan CLUB_SCHEDULE_SEVERAL_PERMITS_PLAN.md §4d; drawing tab 2).
//
// POST ?orgSlug=  { from, to, weekdays?, hours?, kinds?, venueIds?, issuers?, minMinutes?, own?, scheduleId? }
//   → every place the club holds on any permit in the filters: days held, free and held by a draft (named), the free
//     minutes, the weekly stretches, and the pieces of time a pick brings (`freeTime`, lib/permit-free-time.ts).
//   `own`: New schedule's rows, not saved yet ({ startsOn, endsOn, blocks, datesOff }, as the form sends its time) —
//   taken, so the form's own time is never offered again. `scheduleId`: a saved schedule asking (Add time).
// The scheduler's gate (owner or admin, the plan carries it). A read: nothing is written, nothing is booked.
// POST, not GET, only because the form's own time rides along.
// ---------------------------------------------------------------------------

const MAX_DAYS = 400;

function readFilters(body: Record<string, unknown>): FreeFilters | string {
  const { from, to } = body;
  if (typeof from !== 'string' || !isCalendarDate(from) || typeof to !== 'string' || !isCalendarDate(to)) return 'Give the first and last day to look in.';
  if (to < from) return 'The last day is before the first.';
  if ((Date.parse(to) - Date.parse(from)) / 86_400_000 > MAX_DAYS) return 'Look in at most 400 days at once.';
  const list = (v: unknown) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : null);
  const weekdays = list(body.weekdays), hours = list(body.hours), kinds = list(body.kinds), venueIds = list(body.venueIds), issuers = list(body.issuers);
  if (!weekdays || !weekdays.every(d => Number.isInteger(d) && d >= 1 && d <= 7)) return 'Pick the days again.';
  if (!hours || hours.length > 6 || !hours.every(h => isClock((h as { start?: unknown })?.start) && isClock((h as { end?: unknown })?.end)
    && (h as { start: string }).start < (h as { end: string }).end)) return 'Each range of hours needs a start and a later end.';
  if (!kinds || !kinds.every(k => FACILITY_TYPES.includes(k as FacilityType))) return 'Pick the kinds again.';
  if (!venueIds || venueIds.length > 60 || !venueIds.every(isUuid)) return 'Pick the venues again.';
  if (!issuers || issuers.length > 40 || !issuers.every(x => typeof x === 'string' && x.length <= 200)) return 'Pick the towns again.';
  const min = body.minMinutes ?? 60;
  if (!Number.isInteger(min) || (min as number) < 15 || (min as number) > 720) return 'Pick the shortest time again.';
  return {
    from, to, weekdays: [...new Set(weekdays as number[])], hours: hours as { start: string; end: string }[],
    kinds: kinds as string[], venueIds: venueIds as string[], issuers: issuers as string[], minMinutes: min as number,
  };
}

export const POST = withObservability(async (req: Request) => {
  const r = await resolveScheduler(req);
  if ('error' in r) return r.error;
  const orgId = r.ctx.org.id;
  const parsed: unknown = await req.json().catch(() => null);
  // Only an object is a question (a body of `null`, a list or a number is refused, never read).
  const body = (parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}) as Record<string, unknown>;

  const filters = readFilters(body);
  if (typeof filters === 'string') return schedulerRefusal(400, 'bad_filters', filters);

  // The form's own time, when it has rows (none yet is nothing to take out).
  let own: OwnTime | null = null;
  const rawOwn = body.own as Record<string, unknown> | null | undefined;
  if (rawOwn && Array.isArray(rawOwn.blocks) && rawOwn.blocks.length) {
    if (rawOwn.blocks.length > 40) return schedulerRefusal(400, 'too_many_rows', R.findTooManyRows);
    const t = readTimeBody(rawOwn);
    if (!t.ok) return schedulerRefusal(400, t.code, t.error);
    own = { startsOn: t.time.startsOn, endsOn: t.time.endsOn, blocks: t.time.blocks, datesOff: t.time.datesOff };
  }

  let scheduleId: string | null = null;
  if (body.scheduleId != null) {
    if (!isUuid(body.scheduleId)) return schedulerRefusal(404, 'not_found', R.notFound);
    const { data, error } = await supabaseAdmin.from('club_schedules').select('id').eq('org_id', orgId).eq('id', body.scheduleId).maybeSingle();
    if (error) throw error;
    if (!data) return schedulerRefusal(404, 'not_found', R.notFound);
    scheduleId = data.id as string;
  }

  return NextResponse.json(await readFreeTime(orgId, filters, { scheduleId, own }));
}, { route: '/api/admin/schedules/free-time' });
