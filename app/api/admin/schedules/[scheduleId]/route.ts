import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { clearSettled } from '@/lib/needs-attention';
import { withObservability, captureAndJson } from '@/lib/observability';
import {
  draftToSave, editSlotsStep, familyOthers, familyTeamTwice, keepingFor, loadSchedule, readParts, requestOnStored, timeWithoutPermit, pricePermitOf, readBill, readClubTeams, readName, readRequestPrices, readScheduleRequest,
  repTeamsRefusal, resolveScheduler, roomChecker, saveScheduleStep, schedulePermitIds, schedulePrices, scheduleView, schedulerRefusal, timePayload,
  type ScheduleRequest,
} from '@/lib/club-schedule-server';
import { changesSummary, sendLog } from '@/lib/club-schedule-send';
import { scheduleReplies } from '@/lib/club-schedule-coach';
import { PART_WORDS, SCHEDULE_REFUSALS as R } from '@/lib/club-schedule-words';
import { readScheduleOutside } from '@/lib/permit-dates-off';
import { datesOffKeepingParks } from '@/lib/club-schedule-permit-rows';
import { hasOrgVenueLibrary } from '@/lib/plan-features';
import { tournamentToday } from '@/lib/timezone';
import { DEFAULT_PRICE_MODE } from '@/lib/club-schedule-bill';
import type { KeepChange } from '@/lib/club-schedule-keep';

// ---------------------------------------------------------------------------
// ONE SCHEDULE (Club Tier Stage 11a, part A — hub K4MPu4ni53Ct7yrDcmWJd9 → Stages 10 + 11, specimens 6–10, 14).
//
// GET    ?orgSlug=  — its page: the schedule, its time, every slot (held and clashing marked), fairness, the bill (money
//                     readers only), the review round's replies, the changes since it was sent, the send log, and the
//                     asks waiting on it (Stage 11d part B — their figures and what each team pays, money readers only).
//                     Phase 8: and its ADDED PARTS (`parts`, each with its own view — the page reads the family as one).
//                     An added part's own address reads the schedule it was added to: the page is the family's.
// PATCH  ?orgSlug=  { action, version, … } — every write acts on the version it read (409 `changed` otherwise):
//          rename      { name }
//          regenerate  { startsOn, endsOn, blocks, datesOff, settings, assignments } — Tools › Settings… and "Regenerate
//                      the unlocked slots": the slots locked or moved by hand stay where they are (Ask 19). On a sent
//                      schedule it is a change to send (Ask 14), and nothing before today moves (P10 A).
//          (Tools › Add time… no longer writes here: since Phase 8 Session 2 it makes a PART — POST /api/admin/schedules
//          with `partOf` — and the schedule it is added to is not saved at all.)
//          take_permit_off { permitId } — Settings… › "Take it off…" (P11 A): that permit's rows and slots come off, and
//                      nothing else moves. On a sent schedule its slots before today stay (and so does their bill); its rows
//                      end the day before today; the rest waits for Send the changes, which credits it.
//          edit        { edits: [{ slotId, teamIds?, locked? }] } — the grid's hand edits (Ask 13): a slot whose teams change
//                      by hand LOCKS ITSELF; `locked: false` frees it. The client works out which weeks a drop reaches
//                      (`planMove`); the server re-validates (the one refusal: a team twice at once). UNDO (the 8-second
//                      notice, part B) sends `{ undo: true, edits: [{ slotId, teamIds, locked, movedByHand }] }`: each slot
//                      put back EXACTLY as it was — its teams and both flags — never "moved by hand" by the undo itself.
//          dismiss_unbilled {} — "It's free" on a part sent without a bill (walk §538 call C2): its Needs attention row stays away.
//                      Money readers only; a sent part with no bill. Never bumps the version.
//          bill        { bill: null | { lineId, permitId, amount, plan, firstDue, dates } } — Bill the teams (Ask 23): the
//                      bill rides with the schedule until Finalize. Money readers only; never on a final schedule (its
//                      bill went out at Finalize and a bill's terms never change — 3d Ask 7b).
// DELETE ?orgSlug=  — a draft or a schedule in review; never a final one (its practices and bill exist).
// ---------------------------------------------------------------------------

type Params = { params: Promise<{ scheduleId: string }> };

/** The family's send log (Phase 8, Session 3): the schedule's sends and each added part's — a part taken off too (its send
 *  record is kept, 11-17 ruling) — newest first, a part's named by its label. */
async function familySendLog(orgId: string, scheduleId: string) {
  // parts-ok: by the schedule they were added to — every part's sends belong in its log, a part taken off included.
  const { data, error } = await supabaseAdmin.from('club_schedules').select('id, part_label').eq('org_id', orgId).eq('part_of_schedule_id', scheduleId);
  if (error) throw error;
  const parts = (data ?? []) as { id: string; part_label: string | null }[];
  const logs = await Promise.all([
    sendLog(orgId, scheduleId).then(rows => rows.map(x => ({ ...x, partLabel: null as string | null }))),
    ...parts.map(p => sendLog(orgId, p.id).then(rows => rows.map(x => ({ ...x, partLabel: p.part_label })))),
  ]);
  return logs.flat().sort((a, b) => b.at.localeCompare(a.at));
}

export const GET = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveScheduler(req);
  if ('error' in r) return r.error;
  const { scheduleId: asked } = await params;
  const first = await loadSchedule(r.ctx.org.id, asked);
  // A part's link (a practice's "From …", a bell) opens the family's page: the schedule it was added to.
  const loaded = first?.row.part_of_schedule_id ? await loadSchedule(r.ctx.org.id, first.row.part_of_schedule_id) : first;
  if (!loaded) return schedulerRefusal(404, 'not_found', R.notFound);
  const scheduleId = loaded.row.id;
  const closed = repTeamsRefusal(r, loaded);
  if (closed) return closed;
  // ⚖ 13c Session C (C2): what the permit's own dates off took of THIS schedule — Needs attention's "Outside the permit"
  // row. Its OWN read, asked after the page has read (the measured-gate rule of Session B), so the page never waits on it
  // and a failure is the row's alone. Permits ride the Venue library's plans.
  if (new URL(req.url).searchParams.get('outside') === '1') {
    // Every permit behind the schedule's rows (a schedule on several permits), never one column.
    const permitIds = schedulePermitIds(loaded.row, loaded.time.blocks);
    const noStore = { headers: { 'Cache-Control': 'no-store' } };
    if (!permitIds.length || !hasOrgVenueLibrary(r.ctx.org.planId)) return NextResponse.json({ outside: null, version: loaded.row.version }, noStore);
    const outside = await readScheduleOutside(
      { org: r.ctx.org, member: { role: r.ctx.role, capabilities: r.ctx.capabilities }, userId: r.ctx.user.id, assignedTournamentIds: null },
      {
        permitIds, today: tournamentToday(), nowMs: Date.now(),
        slots: loaded.slots.filter(s => !s.removed).map(s => ({
          key: s.key, venueId: s.venueId, facilityId: s.facilityId, startMs: Date.parse(s.startsAt), endMs: Date.parse(s.endsAt), teamIds: s.teamIds,
        })),
      },
    );
    return NextResponse.json({ outside, version: loaded.row.version }, noStore);
  }
  // Its added parts first: their slot ids are the family's, which neither view reads as a booking (Phase 8).
  const family = await readParts(r.ctx.org.id, loaded, { houseLeague: r.houseLeague, canMoney: r.canMoney, repTeams: r.repTeams, changesOf: part => changesSummary(r, part) });
  const [view, replies, log, changes] = await Promise.all([
    scheduleView(r.ctx.org.id, loaded, r.canMoney, { houseLeague: r.houseLeague, familySlotIds: family.familySlotIds }),
    scheduleReplies(r.ctx.org.id, scheduleId),
    familySendLog(r.ctx.org.id, scheduleId),
    loaded.row.changed_since_sent ? changesSummary(r, loaded) : Promise.resolve({ teams: [] }),
  ]);
  // The send log's money (what a correction billed, what a team is owed back, the bill it made) reads only to a money
  // reader, as the page's bill does.
  const shownLog = r.canMoney ? log : log.map(s => ({ ...s, billed: {}, owedBack: {}, settled: {}, allocationId: null }));
  return NextResponse.json({ ...view, replies, sendLog: shownLog, changes, parts: family.parts });
}, { route: '/api/admin/schedules/[scheduleId]' });

export const PATCH = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveScheduler(req, { write: true });
  if ('error' in r) return r.error;
  const orgId = r.ctx.org.id, actor = r.ctx.user.id;
  const { scheduleId } = await params;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const loaded = await loadSchedule(orgId, scheduleId);
  if (!loaded) return schedulerRefusal(404, 'not_found', R.notFound);
  const closed = repTeamsRefusal(r, loaded);
  if (closed) return closed;
  const version = Number(body.version);
  if (!Number.isInteger(version) || version !== loaded.row.version) return schedulerRefusal(409, 'changed', R.changed, { version: loaded.row.version });

  /** The one save for a change to the time: what the change keeps is kept exactly (`keepingFor`), and so are the slots
   *  locked or moved by hand that the new time still holds (Ask 19). */
  const keepTime = async (asked: ScheduleRequest, change: KeepChange, assignments: unknown = body.assignments) => {
    const keep = keepingFor(loaded, asked.time, change, asked.places);
    const req = keep ? { ...asked, time: keep.time } : asked;
    // The rows it sends, each priced by its own permit (a schedule on several permits).
    const { prices, gone } = await readRequestPrices(orgId, pricePermitOf(loaded.row), req.time.blocks);
    if (gone) return gone;
    const kept = new Map(loaded.slots.filter(s => !s.removed && (s.locked || s.movedByHand)).map(s => [s.key, s]));
    // Never over the rest of the family's places, never a team it already has then (Phase 8).
    const draft = draftToSave(req, prices, assignments, kept, keep, await familyOthers(orgId, loaded.row));
    if (!draft.ok) return draft.response;
    const saved = await saveScheduleStep(orgId, scheduleId, actor, version, {
      settings: req.settings, ...timePayload(req.time), slots: draft.slots,
    });
    return saved.ok ? NextResponse.json({ version: saved.version }) : saved.response;
  };

  try {
    if (body.action === 'rename') {
      const name = readName(body.name);
      if (!name) return schedulerRefusal(400, 'bad_name', 'Name the schedule.');
      const saved = await saveScheduleStep(orgId, scheduleId, actor, version, { name });
      return saved.ok ? NextResponse.json({ version: saved.version }) : saved.response;
    }

    if (body.action === 'regenerate') {
      const read = await readScheduleRequest(orgId, body, { houseLeague: r.houseLeague, repTeams: r.repTeams });
      if (!read.ok) return read.response;
      // A date off whose request never said its parks (a tab from before mig 488) keeps the ones stored: the drafts are cut,
      // and the save keeps, what the day names today — never widened to All venues.
      const asked = { ...read, value: { ...read.value, time: { ...read.value.time, datesOff: datesOffKeepingParks(read.value.time.datesOff, loaded.time.datesOff) } } };
      return keepTime(asked.value, { kind: 'regenerate' });
    }

    if (body.action === 'take_permit_off') {
      const permitId = typeof body.permitId === 'string' ? body.permitId : '';
      // The time without that permit's rows (the rest by id, untouched); its past comes back through the keeping rule.
      const time = timeWithoutPermit(loaded, permitId);
      if (!time) return schedulerRefusal(409, 'changed', R.changed, { version: loaded.row.version });
      // ⚖ PHASE 8 (Session 3, drawing tab 4): an added part's ONLY permit taken off removes the part. Before its first send
      // it simply goes (nobody was told; the row and its slots are deleted); after it, see below.
      if (loaded.row.part_of_schedule_id && !time.blocks.length && loaded.row.state !== 'final') {
        const { data: gone, error: delError } = await supabaseAdmin.from('club_schedules').delete()
          .eq('id', scheduleId).eq('org_id', orgId).eq('version', version).neq('state', 'final').select('id');
        if (delError) throw delError;
        if (!gone?.length) return schedulerRefusal(409, 'changed', R.changed, { version: loaded.row.version });
        return NextResponse.json({ version: null, removed: true });
      }
      const asked = await requestOnStored(orgId, loaded, time, { houseLeague: r.houseLeague, repTeams: r.repTeams });
      if (!asked.ok) return asked.response;
      // A SENT part with nothing played on it: every practice comes off and waits for Send the changes, which credits it;
      // once that is sent the part leaves the page (its row, bill and send record stay — 11-17 ruling). With practices
      // already played, the usual take-off keeps them (and their rows, ending yesterday).
      if (loaded.row.part_of_schedule_id && !time.blocks.length && !keepingFor(loaded, time, { kind: 'take_off', permitId }, asked.value.places)?.stored.length) {
        const saved = await saveScheduleStep(orgId, scheduleId, actor, version, { ...timePayload(time), slots: [] });
        return saved.ok ? NextResponse.json({ version: saved.version }) : saved.response;
      }
      return keepTime(asked.value, { kind: 'take_off', permitId }, []);
    }

    if (body.action === 'edit') {
      if (!Array.isArray(body.edits) || !body.edits.length || body.edits.length > 500) return schedulerRefusal(400, 'bad_edit', 'Nothing to change.');
      const bySlot = new Map(loaded.slots.filter(s => !s.removed).map(s => [s.id, s]));
      const undo = body.undo === true;
      // A slot given two or more teams asks its room (below) by the facility's price share: read beside the teams. Undo
      // asks it too — what it puts back must still fit the schedule's sharing rules.
      const crowds = (body.edits as Record<string, unknown>[]).some(e => Array.isArray(e?.teamIds) && e.teamIds.length > 1);
      const [teams, prices] = await Promise.all([
        readClubTeams(orgId, { houseLeague: r.houseLeague, repTeams: r.repTeams }),
        crowds ? schedulePrices(orgId, loaded) : null,
      ]);
      const running = new Set(teams.filter(x => x.season).map(x => x.id));
      // A team already on the schedule may stay where it is (its season ended mid-schedule): only NEW time needs a season.
      const onSchedule = new Set(loaded.slots.filter(s => !s.removed).flatMap(s => s.teamIds));
      const edits: { slotId: string; teamIds?: string[]; locked?: boolean; movedByHand?: boolean }[] = [];
      for (const e of body.edits as Record<string, unknown>[]) {
        if (typeof e?.slotId !== 'string' || !bySlot.has(e.slotId)) return schedulerRefusal(409, 'changed', R.changed);
        const edit: (typeof edits)[number] = { slotId: e.slotId };
        if (undo) {
          // Put back exactly as it was before the move the notice names (its teams, its lock, whether a hand moved it).
          if (!Array.isArray(e.teamIds) || !e.teamIds.every(x => typeof x === 'string' && (running.has(x) || onSchedule.has(x)))
            || typeof e.locked !== 'boolean' || typeof e.movedByHand !== 'boolean') {
            return schedulerRefusal(409, 'changed', R.changed);
          }
          edits.push({ slotId: e.slotId, teamIds: [...new Set(e.teamIds as string[])], locked: e.locked, movedByHand: e.movedByHand });
          continue;
        }
        if (e.teamIds !== undefined) {
          const here = new Set(bySlot.get(e.slotId)!.teamIds);
          if (!Array.isArray(e.teamIds) || !e.teamIds.every(x => typeof x === 'string' && (running.has(x) || here.has(x)))) {
            return schedulerRefusal(409, 'team_not_running', 'That team has no season running, so it can’t be given time. Start its season first.');
          }
          edit.teamIds = [...new Set(e.teamIds as string[])];
          // A slot moved by hand locks itself (Ask 19): a regenerate never undoes a decision made on the grid.
          edit.movedByHand = true;
          edit.locked = true;
        }
        if (e.locked === true) edit.locked = true;
        if (e.locked === false) { edit.locked = false; edit.movedByHand = false; }
        edits.push(edit);
      }
      // Each slot's room (Stage 11c): only one sharing rule's teams share, up to its number, never on a half facility —
      // asked before the database's floor, whose one number is the largest rule's.
      if (prices) {
        const room = roomChecker(loaded.settings, teams);
        for (const x of edits) {
          const slot = bySlot.get(x.slotId)!;
          const full = (x.teamIds?.length ?? 0) > 1 ? room(x.teamIds!, prices.weightOf(slot.facilityId, slot.permitId)) : null;
          if (full) return schedulerRefusal(409, 'slot_full', full);
        }
      }
      // An added part's practice goes only to its own teams, so it never moves onto another bill (Phase 8, drawing tab 4).
      const label = loaded.row.part_label;
      if (label && !undo) {
        const own = new Set(loaded.settings.teamIds);
        for (const x of edits) {
          const here = new Set(bySlot.get(x.slotId)!.teamIds);
          if (x.teamIds?.some(t => !own.has(t) && !here.has(t))) return schedulerRefusal(409, 'team_not_in_part', PART_WORDS.teamNotInPart(label));
        }
      }
      // A team the rest of the family already has then (the schedule it was added to, or another part).
      const given = edits.filter(x => x.teamIds?.length);
      if (given.length) {
        const family = await familyOthers(orgId, loaded.row);
        const nameOf = (id: string) => teams.find(c => c.id === id)?.name ?? 'A team';
        const twice = familyTeamTwice(
          given.map(x => { const s = bySlot.get(x.slotId)!; return { key: s.id, venueId: s.venueId, facilityId: s.facilityId, startMs: Date.parse(s.startsAt), endMs: Date.parse(s.endsAt) }; }),
          key => given.find(x => x.slotId === key)?.teamIds ?? [], family, nameOf);
        if (twice) return schedulerRefusal(409, 'team_twice', twice);
      }
      const saved = await editSlotsStep(orgId, scheduleId, actor, version, edits);
      return saved.ok ? NextResponse.json({ version: saved.version }) : saved.response;
    }

    if (body.action === 'bill') {
      if (!r.canMoney) return schedulerRefusal(403, 'bill_money', R.billMoney);
      if (loaded.row.state === 'final') return schedulerRefusal(409, 'already_final', R.billFinal);
      const bill = await readBill(orgId, body.bill);
      if (!bill.ok) return schedulerRefusal(400, bill.code, bill.error);
      const { data, error } = await supabaseAdmin.from('club_schedules').update({
        bill_line_id: bill.value?.lineId ?? null, bill_permit_id: bill.value?.permitId ?? null, bill_amount: bill.value?.amount ?? null,
        bill_plan: bill.value?.plan ?? null, bill_first_due: bill.value?.firstDue ?? null, bill_dates: bill.value?.dates ?? null,
        // A bill term (mig 489): saved with the rest, frozen once the bill is made. A removed bill goes back to the default.
        // A save that does not say keeps what is stored (a stale tab never resets a chosen mode).
        ...(!bill.value ? { bill_price_mode: DEFAULT_PRICE_MODE } : bill.value.mode ? { bill_price_mode: bill.value.mode } : {}),
        version: version + 1, updated_by: actor, updated_at: new Date().toISOString(),
      }).eq('id', scheduleId).eq('org_id', orgId).eq('version', version).select('version').maybeSingle();
      if (error) throw error;
      if (!data) return schedulerRefusal(409, 'changed', R.changed);
      return NextResponse.json({ version: data.version });
    }

    // A part sent free on purpose: "It's free" clears its Needs attention row (walk §538 call C2). Money readers only, like the
    // row's Bill it…; the part must be sent and have no bill. A record of the choice, not an edit: the version stays.
    if (body.action === 'dismiss_unbilled') {
      if (!r.canMoney) return schedulerRefusal(403, 'bill_money', R.billMoney);
      const row = loaded.row;
      if (!row.part_of_schedule_id || row.state !== 'final' || row.bill_plan || row.allocation_id) return schedulerRefusal(409, 'not_unbilled', R.dismissNotHere);
      // Already marked: the first person's record stands (a second press, or a second tab, changes nothing).
      if (row.bill_dismissed_at) return NextResponse.json({ version: row.version });
      const { data, error } = await supabaseAdmin.from('club_schedules')
        .update({ bill_dismissed_at: new Date().toISOString(), bill_dismissed_by: actor })
        .eq('id', scheduleId).eq('org_id', orgId).eq('version', version).select('version').maybeSingle();
      if (error) throw error;
      if (!data) return schedulerRefusal(409, 'changed', R.changed);
      return NextResponse.json({ version: data.version });
    }

    return schedulerRefusal(400, 'bad_action', 'That isn’t something a schedule does.');
  } catch (e) {
    return captureAndJson(e, { error: R.notSaved, code: 'save_failed' }, 500);
  }
}, { route: '/api/admin/schedules/[scheduleId]' });

export const DELETE = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveScheduler(req, { write: true });
  if ('error' in r) return r.error;
  const { scheduleId } = await params;
  const { data, error } = await supabaseAdmin.from('club_schedules').select('id, state').eq('id', scheduleId).eq('org_id', r.ctx.org.id).maybeSingle();
  if (error) throw error;
  if (!data) return schedulerRefusal(404, 'not_found', R.notFound);
  if (data.state === 'final') return schedulerRefusal(409, 'final_delete', R.finalDelete);
  if (!r.repTeams) {
    const loaded = await loadSchedule(r.ctx.org.id, scheduleId);
    const closed = loaded ? repTeamsRefusal(r, loaded) : null;
    if (closed) return closed;
  }
  // The schedule's blocks, dates off, slots, replies and sends go with it (ON DELETE CASCADE).
  const { data: gone, error: delError } = await supabaseAdmin.from('club_schedules').delete().eq('id', scheduleId).eq('org_id', r.ctx.org.id)
    .neq('state', 'final').select('id');
  if (delError) throw delError;
  // Finalized between the read and the delete: nothing went, and saying "deleted" would be untrue.
  if (!gone?.length) return schedulerRefusal(409, 'final_delete', R.finalDelete);
  // Needs attention clears itself (owner 2026-10-16): a review of a deleted schedule waits on no one.
  await clearSettled({ orgIds: [r.ctx.org.id], kinds: ['club_schedule_review'] });
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/schedules/[scheduleId]' });
