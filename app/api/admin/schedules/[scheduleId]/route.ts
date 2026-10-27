import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { clearSettled } from '@/lib/needs-attention';
import { withObservability, captureAndJson } from '@/lib/observability';
import {
  draftToSave, editSlotsStep, loadSchedule, readBill, readClubTeams, readName, readPrices, readScheduleRequest, repTeamsRefusal, resolveScheduler,
  roomChecker, saveScheduleStep, scheduleView, schedulerRefusal, timePayload,
} from '@/lib/club-schedule-server';
import { changesSummary, sendLog } from '@/lib/club-schedule-send';
import { scheduleReplies } from '@/lib/club-schedule-coach';
import { SCHEDULE_REFUSALS as R } from '@/lib/club-schedule-words';

// ---------------------------------------------------------------------------
// ONE SCHEDULE (Club Tier Stage 11a, part A — hub K4MPu4ni53Ct7yrDcmWJd9 → Stages 10 + 11, specimens 6–10, 14).
//
// GET    ?orgSlug=  — its page: the schedule, its time, every slot (held and clashing marked), fairness, the bill (money
//                     readers only), the review round's replies, the changes since it was sent, the send log, and the
//                     asks waiting on it (Stage 11d part B — their figures and what each team pays, money readers only).
// PATCH  ?orgSlug=  { action, version, … } — every write acts on the version it read (409 `changed` otherwise):
//          rename      { name }
//          regenerate  { startsOn, endsOn, blocks, datesOff, settings, assignments } — Tools › Settings… and "Regenerate
//                      the unlocked slots": the slots locked or moved by hand stay where they are (Ask 19). On a sent
//                      schedule it is a change to send (Ask 14).
//          edit        { edits: [{ slotId, teamIds?, locked? }] } — the grid's hand edits (Ask 13): a slot whose teams change
//                      by hand LOCKS ITSELF; `locked: false` frees it. The client works out which weeks a drop reaches
//                      (`planMove`); the server re-validates (the one refusal: a team twice at once). UNDO (the 8-second
//                      notice, part B) sends `{ undo: true, edits: [{ slotId, teamIds, locked, movedByHand }] }`: each slot
//                      put back EXACTLY as it was — its teams and both flags — never "moved by hand" by the undo itself.
//          bill        { bill: null | { lineId, permitId, amount, plan, firstDue, dates } } — Bill the teams (Ask 23): the
//                      bill rides with the schedule until Finalize. Money readers only; never on a final schedule (its
//                      bill went out at Finalize and a bill's terms never change — 3d Ask 7b).
// DELETE ?orgSlug=  — a draft or a schedule in review; never a final one (its practices and bill exist).
// ---------------------------------------------------------------------------

type Params = { params: Promise<{ scheduleId: string }> };

export const GET = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveScheduler(req);
  if ('error' in r) return r.error;
  const { scheduleId } = await params;
  const loaded = await loadSchedule(r.ctx.org.id, scheduleId);
  if (!loaded) return schedulerRefusal(404, 'not_found', R.notFound);
  const closed = repTeamsRefusal(r, loaded);
  if (closed) return closed;
  const [view, replies, log, changes] = await Promise.all([
    scheduleView(r.ctx.org.id, loaded, r.canMoney, { houseLeague: r.houseLeague }),
    scheduleReplies(r.ctx.org.id, scheduleId),
    sendLog(r.ctx.org.id, scheduleId),
    loaded.row.changed_since_sent ? changesSummary(r, loaded) : Promise.resolve({ teams: [] }),
  ]);
  // The send log's money (what a correction billed, what a team is owed back, the bill it made) reads only to a money
  // reader, as the page's bill does.
  const shownLog = r.canMoney ? log : log.map(s => ({ ...s, billed: {}, owedBack: {}, settled: {}, allocationId: null }));
  return NextResponse.json({ ...view, replies, sendLog: shownLog, changes });
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

  try {
    if (body.action === 'rename') {
      const name = readName(body.name);
      if (!name) return schedulerRefusal(400, 'bad_name', 'Name the schedule.');
      const saved = await saveScheduleStep(orgId, scheduleId, actor, version, { name });
      return saved.ok ? NextResponse.json({ version: saved.version }) : saved.response;
    }

    if (body.action === 'regenerate') {
      const [asked, prices] = await Promise.all([
        readScheduleRequest(orgId, body, { houseLeague: r.houseLeague, repTeams: r.repTeams }),
        readPrices(orgId, loaded.row.bill_permit_id ?? loaded.row.started_from_permit_id),
      ]);
      if (!asked.ok) return asked.response;
      // The slots locked or moved by hand are kept exactly (Ask 19) — whatever the draft says of them.
      const kept = new Map(loaded.slots.filter(s => !s.removed && (s.locked || s.movedByHand)).map(s => [s.key, s]));
      const draft = draftToSave(asked.value, prices, body.assignments, kept);
      if (!draft.ok) return draft.response;
      const saved = await saveScheduleStep(orgId, scheduleId, actor, version, {
        settings: asked.value.settings, ...timePayload(asked.value.time), slots: draft.slots,
      });
      return saved.ok ? NextResponse.json({ version: saved.version }) : saved.response;
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
        crowds ? readPrices(orgId, loaded.row.bill_permit_id ?? loaded.row.started_from_permit_id) : null,
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
          const full = (x.teamIds?.length ?? 0) > 1 ? room(x.teamIds!, prices.weightOf(bySlot.get(x.slotId)!.facilityId)) : null;
          if (full) return schedulerRefusal(409, 'slot_full', full);
        }
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
        version: version + 1, updated_by: actor, updated_at: new Date().toISOString(),
      }).eq('id', scheduleId).eq('org_id', orgId).eq('version', version).select('version').maybeSingle();
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
