import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { fetchAll, fetchAllIn } from '@/lib/supabase-paging';
import { andList } from '@/lib/tournament-board-words';
import { readClubPlaces, readPermitTimes } from '@/lib/permit-lookup';
import { isUuid } from '@/lib/utils';
import {
  buildEngineInput, draftToSave, loadSchedule, readClubTeams, readName, readPrices, readScheduleRequest, resolveScheduler, saveScheduleStep,
  scheduleList, schedulerRefusal, timePayload,
} from '@/lib/club-schedule-server';
import { sendSchedule } from '@/lib/club-schedule-send';
import { HOUSE_LEAGUE } from '@/lib/club-schedule-holders';
import { SCHEDULE_REFUSALS as R } from '@/lib/club-schedule-words';

// ---------------------------------------------------------------------------
// The club's SCHEDULES (Club Tier Stage 11a, part A — plan CLUB_PERMITS_AND_SCHEDULER_PLAN.md §5.3–§5.4; hub
// K4MPu4ni53Ct7yrDcmWJd9 → Stages 10 + 11, specimens 4 and 5).
//
// GET  ?orgSlug=          — the Schedules list: each schedule's name, state, dates, places, teams, slots handed out and
//                           open, last sent; `nothingToSchedule` when the club has no rep team to hand time to (League Plus
//                           until 11b — the screens hide the door).
// GET  ?orgSlug=&new=1    — New schedule's inputs: the club's teams by group (each with its running season; teams with
//                           none listed apart), its places, its permits' time (the Permit field), its schedules newest
//                           first with the venues each holds (the window's opening screen, "Copy a schedule").
// POST ?orgSlug=          — keep a draft (Save as a draft, specimen 5): the name, the time, the settings and the chosen
//                           draft's assignments. The server cuts the slots again from the time and refuses a team twice
//                           at once; nothing reaches a team.
//                           `giveToHouseLeague` (Stage 11b, k1 — all of it to house league): no drafts — every slot no
//                           booking already holds goes to House league, and the schedule is finalized in the same request
//                           (the one send path, `sendSchedule`), so its league admins can divide it right away. Never billed.
//
// ⚖ WHO: the club's owner or an admin, on League Plus or a Club band (`resolveScheduler`). House league is offered when the
// club has it (Stage 11b), so a League Plus club with no rep teams schedules too.
// ---------------------------------------------------------------------------

export const GET = withObservability(async (req: Request) => {
  const r = await resolveScheduler(req);
  if ('error' in r) return r.error;
  const orgId = r.ctx.org.id;
  if (!r.canSchedule) return NextResponse.json({ schedules: [], nothingToSchedule: true, canMoney: r.canMoney });
  const teams = await readClubTeams(orgId, { houseLeague: r.houseLeague, repTeams: r.repTeams });
  const nothingToSchedule = !teams.some(t => t.season);

  if (new URL(req.url).searchParams.get('new') !== '1') {
    // A member who can't open Rep Teams sees house league's schedules only (11b review).
    const schedules = (await scheduleList(orgId)).filter(s => r.repTeams || !s.repTeams);
    return NextResponse.json({ schedules, nothingToSchedule, canMoney: r.canMoney });
  }

  const [places, permits, schedules, groups] = await Promise.all([
    readClubPlaces(orgId),
    readPermitTimes(orgId, {}),
    fetchAll<{ id: string; name: string; starts_on: string; ends_on: string }>((a, b) => supabaseAdmin.from('club_schedules')
      .select('id, name, starts_on, ends_on').eq('org_id', orgId).order('starts_on', { ascending: false }).range(a, b)),
    fetchAll<{ id: string; name: string; display_order: number | null }>((a, b) => supabaseAdmin.from('rep_team_groups')
      .select('id, name, display_order').eq('org_id', orgId).order('display_order').order('name').range(a, b)),
  ]);
  // Each schedule's venues, for its row on the opening screen ("Oct 4, 2026 – Mar 28, 2027 · Lakeshore Dome").
  const blocks = await fetchAllIn<{ schedule_id: string; org_venue_id: string }>(schedules.map(s => s.id), (c, a, b) => supabaseAdmin
    .from('org_time_blocks').select('schedule_id, org_venue_id').eq('org_id', orgId).in('schedule_id', c).order('id').range(a, b));
  const venuesOf = (id: string) => andList([...new Set(blocks.filter(b => b.schedule_id === id)
    .map(b => places.venueName.get(b.org_venue_id)).filter((n): n is string => !!n))]);
  return NextResponse.json({
    nothingToSchedule,
    canMoney: r.canMoney,
    groups: groups.map(g => ({ id: g.id, name: g.name })),
    teams: teams.map(t => ({ id: t.id, name: t.name, groupId: t.groupId, groupName: t.groupName, color: t.color, season: t.season, program: t.program ?? null })),
    places: [...places.venueName].map(([venueId, venueName]) => ({
      venueId, venueName, facilities: (places.byVenue.get(venueId) ?? []).map(id => ({ id, name: places.facilityName.get(id) ?? '' })),
    })),
    // "Start from a permit": its time only (a permit's money reads to Accounting, never here — the bill reads its prices).
    permits: permits.permits.map(p => ({ id: p.id, name: p.name, startsOn: p.startsOn, endsOn: p.endsOn, blocks: p.blocks, datesOff: p.datesOff })),
    schedules: schedules.map(s => ({ id: s.id, name: s.name, startsOn: s.starts_on, endsOn: s.ends_on, venues: venuesOf(s.id) })),
  });
}, { route: '/api/admin/schedules' });

export const POST = withObservability(async (req: Request) => {
  const r = await resolveScheduler(req, { write: true });
  if ('error' in r) return r.error;
  const orgId = r.ctx.org.id;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  const name = readName(body.name);
  if (!name) return schedulerRefusal(400, 'bad_name', 'Name the schedule.');
  const permitId = isUuid(body.startedFromPermitId) ? body.startedFromPermitId : null;
  const fromSchedule = isUuid(body.startedFromScheduleId) ? body.startedFromScheduleId : null;
  const given = (v: unknown) => v !== undefined && v !== null && v !== '';
  if ((given(body.startedFromPermitId) && !permitId) || (given(body.startedFromScheduleId) && !fromSchedule)) {
    return schedulerRefusal(400, 'bad_start', 'Pick what the schedule starts from again.');
  }
  const [asked, prices, from] = await Promise.all([
    readScheduleRequest(orgId, body, { houseLeague: r.houseLeague, repTeams: r.repTeams }),
    readPrices(orgId, permitId),
    // "Last year's schedule" — one of THIS club's (a plain link, never another club's id).
    fromSchedule ? supabaseAdmin.from('club_schedules').select('id').eq('id', fromSchedule).eq('org_id', orgId).maybeSingle() : null,
  ]);
  if (!asked.ok) return asked.response;
  if (permitId && !prices.found) return schedulerRefusal(409, 'permit_gone', R.permitGone);
  if (from?.error) throw from.error;
  if (fromSchedule && !from?.data) return schedulerRefusal(409, 'schedule_gone', R.notFound);

  // All of it to house league (k1): every slot no booking already holds, as the time stands — no drafts.
  const whole = body.giveToHouseLeague === true;
  let assignments = body.assignments;
  if (whole) {
    const ids = asked.value.settings.teamIds;
    if (!r.houseLeague || ids.length !== 1 || ids[0] !== HOUSE_LEAGUE) return schedulerRefusal(400, 'bad_draft', R.notSaved);
    const built = await buildEngineInput(orgId, { time: asked.value.time, settings: asked.value.settings, teams: asked.value.running, storedSlots: [], permitId, places: asked.value.places });
    if (!built.ok) return schedulerRefusal(400, built.code, built.error);
    assignments = built.input.slots.filter(s => !built.input.held.has(s.key)).map(s => ({ slotKey: s.key, teamIds: [HOUSE_LEAGUE] }));
  }
  // The chosen draft's assignments, onto the slots the server cut.
  const draft = draftToSave(asked.value, prices, assignments);
  if (!draft.ok) return draft.response;

  const saved = await saveScheduleStep(orgId, null, r.ctx.user.id, 1, {
    name, settings: asked.value.settings, startedFromPermitId: permitId, startedFromScheduleId: fromSchedule,
    ...timePayload(asked.value.time), slots: draft.slots,
  });
  if (!saved.ok) return saved.response;
  if (whole) {
    // Finalized through the one send path: no team to tell, no bill (11b·A), and the time is house league's at once. A
    // refusal leaves the draft, which the schedule's page can still send; the window lands there either way.
    const loaded = await loadSchedule(orgId, saved.id);
    const sent = loaded ? await sendSchedule(r, loaded, 'final', { version: loaded.row.version, teamIds: [] }) : null;
    if (!sent?.ok) return NextResponse.json({ id: saved.id, version: saved.version, sent: false }, { status: 201 });
    return NextResponse.json({ id: saved.id, version: sent.version, sent: true }, { status: 201 });
  }
  return NextResponse.json({ id: saved.id, version: saved.version }, { status: 201 });
}, { route: '/api/admin/schedules' });
