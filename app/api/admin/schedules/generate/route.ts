import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { isUuid } from '@/lib/utils';
import { generateDrafts, seatCounts, shareTargets } from '@/lib/club-schedule-engine';
import { buildEngineInput, loadSchedule, readScheduleRequest, resolveScheduler, schedulerRefusal, teamNamer } from '@/lib/club-schedule-server';
import { SCHEDULE_REFUSALS as R, SCHEDULE_WORDS as W, measureLines, warningLine } from '@/lib/club-schedule-words';

// ---------------------------------------------------------------------------
// New schedule's engine (Club Tier Stage 11a, part A — Asks 5, 18–22; hub specimens 4–5, 14 step 3).
//
// POST ?orgSlug=  { startsOn, endsOn, blocks, datesOff, settings, startedFromPermitId?, scheduleId?, round?, previewOnly? }
//   → previewOnly: what the time and the settings hand out, for step 1's summary and closing row ("12 weeks · 2 lanes ·
//     30 slots a week · 354 slots"; each team's share in slots; what is left open; what a booking holds) — no drafts.
//   → otherwise: THREE RANKED DRAFTS (round 0; "Three more drafts" asks round 1, 2, …), each with its score, its measures
//     in words, its warnings, and its assignments; every slot the time holds, each marked prime / held.
//   With `scheduleId` (Tools › Settings…, a regenerate): the slots locked or moved by hand there are KEPT (Ask 19).
// Nothing is written here: a draft is kept by POST /api/admin/schedules (or a regenerate's PATCH).
// ---------------------------------------------------------------------------

export const POST = withObservability(async (req: Request) => {
  const r = await resolveScheduler(req, { write: true });
  if ('error' in r) return r.error;
  const orgId = r.ctx.org.id;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  const scheduleId = isUuid(body.scheduleId) ? body.scheduleId : null;
  if (body.scheduleId && !scheduleId) return schedulerRefusal(404, 'not_found', R.notFound);
  const [asked, loaded] = await Promise.all([
    readScheduleRequest(orgId, body),
    scheduleId ? loadSchedule(orgId, scheduleId) : null,
  ]);
  if (!asked.ok) return asked.response;
  if (scheduleId && !loaded) return schedulerRefusal(404, 'not_found', R.notFound);
  const { time, teams, places, settings } = asked.value;
  const permitId = isUuid(body.startedFromPermitId) ? body.startedFromPermitId
    : loaded?.row.bill_permit_id ?? loaded?.row.started_from_permit_id ?? null;

  const built = await buildEngineInput(orgId, { time, settings, teams, storedSlots: loaded?.slots ?? [], permitId, places });
  if (!built.ok) return schedulerRefusal(400, built.code, built.error);
  const { input } = built;
  const nameOf = teamNamer(teams);
  const avoid = settings.rules.avoidBookings;
  const counts = seatCounts(input.slots, settings, input.held, input.fixed);
  const targets = shareTargets(input.teams, settings, counts);
  const perWeek = new Map<string, number>();
  for (const s of input.slots) perWeek.set(s.week, (perWeek.get(s.week) ?? 0) + 1);
  const slotKeys = new Set(input.slots.map(s => s.key));
  const heldHere = avoid ? input.slots.filter(s => input.held.has(s.key) && !input.fixed.has(s.key)) : [];
  const summary = {
    weeks: perWeek.size, facilities: new Set(input.slots.map(s => `${s.venueId}|${s.facilityId ?? ''}`)).size, slots: input.slots.length,
    perWeek: Math.max(...perWeek.values()),
    seats: counts.capacity, held: heldHere.length,
    heldBy: [...new Set(heldHere.map(s => input.held.get(s.key)!.ownerName))],
    targets: input.teams.map(x => ({ teamId: x.id, slots: targets.slots.get(x.id) ?? 0, prime: targets.prime.get(x.id) ?? 0 })),
    handedOut: targets.handedOut, open: Math.max(0, counts.capacity - targets.handedOut),
    kept: [...input.fixed.keys()].filter(k => slotKeys.has(k)).length,
    notKept: [...input.fixed.keys()].filter(k => !slotKeys.has(k)).length,
  };
  if (body.previewOnly === true) return NextResponse.json({ summary });

  const round = Number.isInteger(body.round) && (body.round as number) >= 0 && (body.round as number) < 50 ? body.round as number : 0;
  const drafts = generateDrafts(input, round);
  const groupName = (groupId: string | null, teamIds: string[]) =>
    teams.find(x => x.groupId && x.groupId === groupId)?.groupName ?? (teamIds.length === 1 ? nameOf(teamIds[0]) : 'Those teams');
  return NextResponse.json({
    summary,
    slots: input.slots.map(s => ({
      key: s.key, venueId: s.venueId, facilityId: s.facilityId, startsAt: new Date(s.startMs).toISOString(), endsAt: new Date(s.endMs).toISOString(),
      day: s.day, weekday: s.weekday, week: s.week, startClock: s.startClock, endClock: s.endClock, prime: s.prime, weight: s.weight,
      heldBy: input.held.has(s.key) ? { ownerName: input.held.get(s.key)!.ownerName, kind: input.held.get(s.key)!.kind ?? null } : null,
      kept: input.fixed.has(s.key),
    })),
    drafts: drafts.map(d => ({
      strategy: d.strategy, label: W.strategy[d.strategy], round: d.round, score: d.score,
      lines: measureLines(d.measures, nameOf), measures: d.measures,
      warnings: d.warnings.map(w => ({ ...w, line: warningLine(w, groupName) })),
      totals: d.totals, teams: d.teams,
      assignments: Object.fromEntries([...d.assignments].filter(([, v]) => v.length)),
    })),
  });
}, { route: '/api/admin/schedules/generate' });
