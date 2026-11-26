import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { isUuid } from '@/lib/utils';
import { maskProp } from '@/lib/field-parts';
import { generateDrafts, seatCounts, shareTargets, slotsTeamsCanHold, teamSlotSizes, teamsCanHold } from '@/lib/club-schedule-engine';
import {
  buildEngineInput, familyOthers, hasPartOf, keepingFor, loadSchedule, partParent, partTimeRefusal, pricePermitOf, readRequestPrices, readScheduleRequest, repTeamsRefusal,
  resolveScheduler, schedulerRefusal, teamNamer,
} from '@/lib/club-schedule-server';
import { datesOffKeepingParks } from '@/lib/club-schedule-permit-rows';
import { pastPractices } from '@/lib/club-schedule-keep';
import { SCHEDULE_REFUSALS as R, SCHEDULE_WORDS as W, measureLines, warningLine } from '@/lib/club-schedule-words';

// ---------------------------------------------------------------------------
// New schedule's engine (Club Tier Stage 11a, part A — Asks 5, 18–22; hub specimens 4–5, 14 step 3).
//
// POST ?orgSlug=  { startsOn, endsOn, blocks, datesOff, settings, startedFromPermitId?, scheduleId? | partOf?, round?, previewOnly? }
//   → previewOnly: what the time and the settings hand out, for step 1's summary and closing row ("12 weeks · 2 lanes ·
//     30 slots a week · 354 slots"; each team's share in slots; what is left open; what a booking holds) — no drafts.
//   → otherwise: THREE RANKED DRAFTS (round 0; "Three more drafts" asks round 1, 2, …), each with its score, its measures
//     in words, its warnings, and its assignments; every slot the time holds, each marked prime / held.
//   With `scheduleId` (Tools › Settings…, a regenerate): the slots locked or moved by hand there are KEPT (Ask 19), and on
//   a sent schedule every slot before today, locked or not (P10 A; `club-schedule-keep.ts`).
//   With `partOf` (Tools › Add time… on a FINAL schedule, Phase 8 Session 2): the drafts of a new PART of that schedule — a
//   schedule of its own, asked exactly as New schedule asks (its time, its dates off, its teams, its settings), cut and
//   shared with the WHOLE family's places and teams then taken, and never before today (the schedule was sent).
// Nothing is written here: a draft is kept by POST /api/admin/schedules (or a regenerate's PATCH).
// ---------------------------------------------------------------------------

export const POST = withObservability(async (req: Request) => {
  const r = await resolveScheduler(req, { write: true });
  if ('error' in r) return r.error;
  const orgId = r.ctx.org.id;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  const scheduleId = isUuid(body.scheduleId) ? body.scheduleId : null;
  if (body.scheduleId && !scheduleId) return schedulerRefusal(404, 'not_found', R.notFound);
  const partOf = hasPartOf(body);
  if (partOf && scheduleId) return schedulerRefusal(400, 'bad_draft', R.notSaved);
  const scope = { houseLeague: r.houseLeague, repTeams: r.repTeams };
  const [asked, loaded, part] = await Promise.all([
    readScheduleRequest(orgId, body, scope),
    scheduleId ? loadSchedule(orgId, scheduleId) : null,
    partOf ? partParent(orgId, r, body.partOf) : null,
  ]);
  if (!asked.ok) return asked.response;
  if (part && !part.ok) return part.response;
  const tooEarly = part?.ok ? partTimeRefusal(part.parent, asked.value.time) : null;
  if (tooEarly) return tooEarly;
  if (scheduleId && !loaded) return schedulerRefusal(404, 'not_found', R.notFound);
  const closed = loaded ? repTeamsRefusal(r, loaded) : null;
  if (closed) return closed;
  const { teams, places, settings } = asked.value;
  // A saved schedule's date off whose request never said its parks (a tab from before mig 488) keeps the ones stored, so the
  // preview is cut exactly as the save will cut it — never widened to All venues (the regenerate's PATCH does the same).
  const askedTime = loaded ? { ...asked.value.time, datesOff: datesOffKeepingParks(asked.value.time.datesOff, loaded.time.datesOff) } : asked.value.time;
  // What the change keeps exactly as it is: a sent schedule's past (P10 A). A new part keeps nothing: it has nothing yet.
  const keep = loaded ? keepingFor(loaded, askedTime, { kind: 'regenerate' }, places) : null;
  const time = keep?.time ?? askedTime;
  // The price permit; each row is weighed by its own permit (a schedule on several permits).
  const permitId = isUuid(body.startedFromPermitId) ? body.startedFromPermitId : loaded ? pricePermitOf(loaded.row) : null;
  // The family (Phase 8): the places the schedule it was added to, or its parts, hold then are never cut, and their teams
  // then are taken — so a draft never offers what the save would refuse. A part being made: the whole family.
  const [{ prices, gone }, family] = await Promise.all([
    readRequestPrices(orgId, permitId, time.blocks, loaded ? { asked: askedTime.blocks, saved: loaded.time.blocks } : undefined),
    part?.ok ? part.family : loaded ? familyOthers(orgId, loaded.row) : [],
  ]);
  if (gone) return gone;
  const built = await buildEngineInput(orgId, { time, settings, teams, storedSlots: loaded?.slots ?? [], permitId, places, prices, keep, family });
  if (!built.ok) return schedulerRefusal(400, built.code, built.error);
  const { input } = built;
  const nameOf = teamNamer(teams);
  const avoid = settings.rules.avoidBookings;
  const counts = seatCounts(input.slots, settings, input.held, input.fixed);
  // A team kept on parts holds more practices for its share (Stage 2: a quarter counts ¼) — the Slots column says so.
  const targets = shareTargets(input.teams, settings, counts, { sizeOf: teamSlotSizes(input.slots, input.teams, settings.rules) });
  const perWeek = new Map<string, number>();
  for (const s of input.slots) perWeek.set(s.week, (perWeek.get(s.week) ?? 0) + 1);
  // What the per-day setting lets the teams hold (Stage 13 fix-now 3): never more than the shares are handed, and said as
  // the setting's own doing only when no daily limit would let them hold more (`dayLimit`, the hint beside the setting).
  const perDay = settings.rules.maxPerDay;
  const held = teamsCanHold(input, perDay);
  const canHold = held?.total ?? null;
  const handedOut = Math.min(targets.handedOut, canHold ?? Infinity);
  // The second count (no daily limit) only runs when the limit actually leaves shares unplaced.
  const dayLimit = perDay != null && canHold != null && canHold < targets.handedOut && canHold < (slotsTeamsCanHold(input, null) ?? 0)
    ? { perDay, canUse: canHold } : null;
  // 13c Session C (C5 = A): while the limit is what leaves them open, each team's Slots cell reads what it can get at it
  // "of" its share ("25 of 65"); otherwise the plain share, as before.
  const alone = dayLimit ? held!.each : null;
  const slotKeys = new Set(input.slots.map(s => s.key));
  const heldHere = avoid ? input.slots.filter(s => input.held.has(s.key) && !input.fixed.has(s.key)) : [];
  const summary = {
    weeks: perWeek.size, facilities: new Set(input.slots.map(s => `${s.venueId}|${s.facilityId ?? ''}`)).size, slots: input.slots.length,
    perWeek: perWeek.size ? Math.max(...perWeek.values()) : 0,
    seats: counts.capacity, held: heldHere.length,
    heldBy: [...new Set(heldHere.map(s => input.held.get(s.key)!.ownerName))],
    // Who holds them, with what kind of booking ("13U AAA’s tryout day") — step 1's closing row names it (part B).
    heldWhat: [...new Map(heldHere.map(s => { const h = input.held.get(s.key)!; return [h.ownerName, { name: h.ownerName, kind: h.kind ?? null }]; })).values()],
    // Each team's practices its share comes to (a shared slot is half a facility, so a team that shares holds more of
    // them for the same share — Stage 11c), and the slots they fill, a shared slot once ("250 slots for 8 teams.").
    targets: input.teams.map(x => {
      const slots = targets.practices.get(x.id) ?? 0;
      return { teamId: x.id, slots, prime: targets.prime.get(x.id) ?? 0, ...(alone ? { canGet: Math.min(slots, alone.get(x.id) ?? 0) } : {}) };
    }),
    handedOut, open: Math.max(0, counts.capacity - handedOut), dayLimit,
    // The half facilities a sharing rule never shares (the rule's sentence names them).
    // Case C only ("Half cost" whole fields): a field's PART is never shared either, but it is not a half facility.
    half: [...new Set(input.slots.filter(s => s.weight < 1 && s.facilityId && !s.sectionMask).map(s => s.facilityId!))],
    kept: [...input.fixed.keys()].filter(k => slotKeys.has(k)).length,
    notKept: [...input.fixed.keys()].filter(k => !slotKeys.has(k)).length,
    // A sent schedule's practices before today, which stay as they were sent (P10 A: the regenerate question counts them).
    past: keep ? pastPractices(keep) : 0,
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
      // Its part (Stage 2), so the drafts step names "Field 1 side A"; a whole-field slot reads exactly as before.
      ...maskProp(s.sectionMask),
    })),
    drafts: drafts.map(d => ({
      strategy: d.strategy, label: W.strategy[d.strategy], round: d.round, score: d.score,
      lines: measureLines(d.measures, nameOf, g => teams.find(x => x.groupId === g)?.groupName ?? 'A group'), measures: d.measures,
      warnings: d.warnings.map(w => ({ ...w, line: warningLine(w, groupName) })),
      totals: d.totals, teams: d.teams,
      assignments: Object.fromEntries([...d.assignments].filter(([, v]) => v.length)),
    })),
  });
}, { route: '/api/admin/schedules/generate' });
