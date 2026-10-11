import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability, captureAndJson } from '@/lib/observability';
import { hasOrgVenueLibrary } from '@/lib/plan-features';
import { canMoveClubMoney } from '@/lib/member-access';
import { canSaveVenueLibrary } from '@/lib/venue-library';
import { addCalendarMonths, isCalendarDate, tournamentToday } from '@/lib/timezone';
import { isUuid } from '@/lib/utils';
import { fiscalYearOf, readFiscalYearParam } from '@/lib/club-fiscal-year';
import { isClosedYearError, loadFiscalSetting, refuseIfClosed } from '@/lib/club-fiscal-year-server';
import { moveRefused } from '@/lib/club-money-route';
import { readClubPlaces, readPermitTimes } from '@/lib/permit-lookup';
import { readLinePermits, readPermitWindow, readPermitsYear } from '@/lib/permit-server';
import { permitPayload, readPermitBody, type PermitDraft } from '@/lib/permit-form';
import { PERMIT_WORDS as W, renewedName } from '@/lib/permit-words';

// ---------------------------------------------------------------------------
// The club's PERMITS — the time it holds at its venues (Club Tier Stage 10a; Asks 1, 2, 3, 4, 8a, 21 — hub
// K4MPu4ni53Ct7yrDcmWJd9 → Mockups → Stages 10 + 11, specimens 1, 2, 12, 14 step 1).
//
// GET  ?orgSlug=&year=<key>        — the Venue library's Permits view: the permits that START in that fiscal year.
// GET  ?orgSlug=&id=<permit>       — one permit's window: the permit, its time, its cost band, its use.
// GET  ?orgSlug=&line=<line>       — a budget line's "Pays for" (Accounting only).
// GET  ?orgSlug=&lines=<day>       — the cost lines of the fiscal year that day falls in: Add permit's Budget line.
// GET  ?orgSlug=&teams=1           — the club's teams, for "For: One team".
// POST ?orgSlug=  { action, … }    — add-permit · update-permit (the whole record, autosaved) · renew-permit ·
//                                    delete-permit.
//
// ⚖ WHO (owner 2026-10-11, plan §6 Ask 1): a permit's TIME reads to everyone who opens the Venue library (a coach never
// does: refused here, as the library is); its MONEY (cost, an hour held, the budget line) reads and writes only for those
// who hold the club's Accounting (`canMoveClubMoney`) — stripped from every read for anyone else, and a save from them
// keeps what is stored. The Venue library's savers write the rest (`canSaveVenueLibrary`).
// ⚖ THE PLAN (Ask 4, BUSINESS_DECISIONS 2026-10-11): permits ride the Venue library's gate — League Plus and both Club
// bands (`hasOrgVenueLibrary`), checked HERE on the server, never only by the page.
// ⚖ A CLOSED FISCAL YEAR LOCKS A PERMIT'S MONEY, NEVER ITS TIME: a change to the cost or the budget line of a permit that
// starts in the club's closed stretch is refused with the money windows' locked words (`refuseIfClosed`); the database
// is the floor (mig 322's `org_permits_check`).
// ---------------------------------------------------------------------------

function refusal(status: number, code: string, error: string) {
  return NextResponse.json({ error, code }, { status });
}

/** The database's floor answered (mig 322's triggers) — said in words, never a 500. */
function floorRefusal(e: unknown): Response | null {
  const msg = (e as { message?: string } | null)?.message ?? '';
  if (/\bpermit_line_year\b/.test(msg)) return refusal(409, 'permit_line_year', 'That budget line is another fiscal year’s. Pick a line of the year the permit starts in.');
  if (/\bblock_venue\b|\bblock_facility\b/.test(msg)) return refusal(409, 'block_place', 'A block names a venue or facility that isn’t in the Venue library any more. Reload and pick it again.');
  if (/\bpermit_issuer\b/.test(msg)) return refusal(409, 'permit_issuer', 'That payee isn’t one of the club’s any more. Pick the issuer again.');
  if (/\bpermit_team\b/.test(msg)) return refusal(409, 'permit_team', 'That team isn’t one of the club’s. Pick the team again.');
  if (/\bpermit_share\b/.test(msg)) return refusal(409, 'permit_share', 'A field’s price names a facility that isn’t at the permit’s venues any more. Reload and set it again.');
  if (/\bpermit_not_found\b/.test(msg)) return refusal(404, 'permit_not_found', 'That permit isn’t in the Venue library any more. Reload the page.');
  // A figure past what the record holds (a CHECK or a numeric overflow the form missed): said, never a 500 (/review 10a).
  const code = (e as { code?: string } | null)?.code;
  if (code === '23514' || code === '22003') return refusal(400, 'permit_value', 'A figure in this permit is out of range. Check the cost and each field’s share.');
  return null;
}

export const GET = withObservability(async (req: Request) => {
  const params = new URL(req.url).searchParams;
  const ctx = await getAuthContextWithRole({ orgSlug: params.get('orgSlug') ?? undefined, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (!hasOrgVenueLibrary(ctx.org.planId)) return refusal(403, 'plan_lacks_permits', W.planLocked);
  // A coaching-staff login opens nothing of the club's (the library's own rule): a coach never reads a permit.
  if (ctx.role === 'coach') return forbidden();
  const orgId = ctx.org.id;
  const canSave = canSaveVenueLibrary(ctx.role, ctx.capabilities);
  const canMoney = canMoveClubMoney(ctx, ctx.org);
  const today = tournamentToday();

  try {
    const lineId = params.get('line');
    if (lineId) {
      if (!canMoney) return forbidden();
      if (!isUuid(lineId)) return NextResponse.json({ permits: [] });
      return NextResponse.json({ permits: (await readLinePermits(orgId, [lineId]))[lineId] ?? [] });
    }
    if (params.get('teams') === '1') {
      const { data, error } = await supabaseAdmin.from('rep_teams').select('id, name').eq('org_id', orgId).eq('is_archived', false).order('name');
      if (error) throw error;
      return NextResponse.json({ teams: (data ?? []).map(t => ({ id: t.id, name: t.name })) });
    }
    const setting = await loadFiscalSetting(orgId);
    const linesDay = params.get('lines');
    if (linesDay) {
      if (!canMoney) return forbidden();
      if (!isCalendarDate(linesDay)) return NextResponse.json({ year: null, lines: [] });
      const year = fiscalYearOf(linesDay, setting);
      if (!year.id) return NextResponse.json({ year: { key: year.key, name: year.name, locked: year.locked }, lines: [] });
      const { data, error } = await supabaseAdmin.from('org_budget_lines')
        .select('id, description, budget_items ( name, direction )').eq('org_id', orgId).eq('fiscal_year_id', year.id).order('sort_order');
      if (error) throw error;
      const lines = ((data ?? []) as unknown as { id: string; description: string; budget_items: { name: string; direction: string } | null }[])
        .filter(l => l.budget_items?.direction !== 'in')
        .map(l => ({ id: l.id, name: l.description, word: l.budget_items?.name ?? null }));
      return NextResponse.json({ year: { key: year.key, name: year.name, locked: year.locked }, lines });
    }
    const id = params.get('id');
    if (id) {
      const read = isUuid(id) ? await readPermitWindow(orgId, id, { setting, canSave, canMoney }) : null;
      if (!read) return refusal(404, 'permit_not_found', 'That permit isn’t in the Venue library any more. Reload the page.');
      return NextResponse.json(read);
    }
    const year = readFiscalYearParam(params.get('year'), setting) ?? fiscalYearOf(today, setting);
    return NextResponse.json(await readPermitsYear(orgId, { year, setting, today, canSave, canMoney }));
  } catch (err) {
    return captureAndJson(err, { error: W.loadFailed, code: 'load_failed' }, 500);
  }
}, { route: '/api/admin/org/permits' });

export const POST = withObservability(async (req: Request) => {
  const params = new URL(req.url).searchParams;
  const ctx = await getAuthContextWithRole({ orgSlug: params.get('orgSlug') ?? undefined, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (!hasOrgVenueLibrary(ctx.org.planId)) return refusal(403, 'plan_lacks_permits', W.planLocked);
  if (!canSaveVenueLibrary(ctx.role, ctx.capabilities)) {
    return refusal(403, 'no_venue_permission', 'Your role can’t change the club’s permits. Ask your club’s owner or an admin.');
  }
  const orgId = ctx.org.id;
  const canMoney = canMoveClubMoney(ctx, ctx.org);

  try {
    const body = await req.json().catch(() => ({})) as { action?: string; id?: string; data?: unknown };
    const action = body.action;

    /** The stored permit, proved this club's (supabaseAdmin bypasses row security: this is the tenant wall). */
    const stored = async (id: unknown) => {
      if (!isUuid(id)) return null;
      const t = await readPermitTimes(orgId, { ids: [id] });
      return t.permits[0] ?? null;
    };

    /** The club's fiscal setting, read once however many steps ask for it. */
    let settingRead: ReturnType<typeof loadFiscalSetting> | null = null;
    const fiscalSetting = () => (settingRead ??= loadFiscalSetting(orgId));

    /** The record's own checks, the money rule, and the closed year — then one step writes it whole. */
    const save = async (permitId: string | null, draftIn: PermitDraft, keep: { cost: number | null; budgetLineId: string | null } | null) => {
      const payload = permitPayload(draftIn);
      // ⚖ Money is Accounting's: a saver without it keeps what is stored (none on a new permit).
      if (!canMoney) { payload.cost = keep?.cost ?? null; payload.budgetLineId = keep?.budgetLineId ?? null; }
      const setting = await fiscalSetting();
      const moneyChanged = keep
        ? (payload.cost ?? null) !== (keep.cost ?? null) || (payload.budgetLineId ?? null) !== (keep.budgetLineId ?? null)
        : payload.cost != null || payload.budgetLineId != null;
      if (moneyChanged) {
        const locked = refuseIfClosed(setting, [draftIn.startsOn], { canMove: canMoney, kind: 'plan' });
        if (locked) return moveRefused(locked);
      }
      if (payload.budgetLineId) {
        const year = fiscalYearOf(draftIn.startsOn, setting);
        const { data: line } = await supabaseAdmin.from('org_budget_lines')
          .select('id, fiscal_year_id, budget_items ( direction )').eq('id', payload.budgetLineId as string).eq('org_id', orgId).maybeSingle();
        const l = line as unknown as { fiscal_year_id: string; budget_items: { direction: string } | null } | null;
        if (!l || !year.id || l.fiscal_year_id !== year.id) {
          return refusal(409, 'permit_line_year', `Pick a line of ${year.name}, the fiscal year the permit starts in.`);
        }
        if (l.budget_items?.direction === 'in') return refusal(409, 'permit_line_in', 'A permit is paid from a cost line, not money coming in.');
      }
      const { data: id, error } = await supabaseAdmin.rpc('org_permit_save', {
        p_org: orgId, p_permit: permitId, p_actor: ctx.user.id, p_data: payload,
      });
      if (error) {
        if (isClosedYearError(error)) {
          const locked = refuseIfClosed(setting, [draftIn.startsOn], { canMove: canMoney, kind: 'plan' });
          if (locked) return moveRefused(locked);
        }
        const worded = floorRefusal(error);
        if (worded) return worded;
        throw error;
      }
      return id as string;
    };

    /** The club's facilities per venue, in its order — what "every facility" and the overlap check read (the lookup's one read). */
    const facilities = async () => (await readClubPlaces(orgId)).byVenue;

    // -- add-permit: Add permit (create asks) ---------------------------------
    if (action === 'add-permit') {
      const read = readPermitBody(body.data, await facilities(), canMoney);
      if (!read.ok) return refusal(400, read.code, read.error);
      const id = await save(null, read.draft, null);
      if (id instanceof Response) return id;
      return NextResponse.json({ success: true, id });
    }

    const permit = await stored(body.id);
    if (!permit) return refusal(404, 'permit_not_found', 'That permit isn’t in the Venue library any more. Reload the page.');

    // -- update-permit: the whole record, autosaved ---------------------------
    if (action === 'update-permit') {
      const read = readPermitBody(body.data, await facilities(), canMoney);
      if (!read.ok) return refusal(400, read.code, read.error);
      // The fiscal year's money moves with the start: a new start in a closed year with money on it is refused below.
      const startMoved = read.draft.startsOn !== permit.startsOn && (permit.cost != null || permit.budgetLineId != null);
      if (startMoved) {
        const locked = refuseIfClosed(await fiscalSetting(), [permit.startsOn, read.draft.startsOn], { canMove: canMoney, kind: 'plan' });
        if (locked) return moveRefused(locked);
      }
      const id = await save(permit.id, read.draft, { cost: permit.cost, budgetLineId: permit.budgetLineId });
      if (id instanceof Response) return id;
      return NextResponse.json({ success: true, id });
    }

    // -- renew-permit: a copy a year on (Ask 2) --------------------------------
    if (action === 'renew-permit') {
      // ⚖ The same blocks, facilities, prices and issuer, the dates a year on; NO reference, document, cost, budget line
      // or dates off (a holiday moves — recorded at build, plan §6 Ask 2). Opened for editing by the screen.
      const yearOn = (d: string) => addCalendarMonths(d, 12);
      const draft: PermitDraft = {
        name: renewedName(permit.name),
        issuerPayeeId: permit.issuerPayeeId,
        issuerName: permit.issuerName ?? '',
        reference: '',
        heldFor: permit.heldFor,
        heldForTeamId: permit.heldForTeamId,
        startsOn: yearOn(permit.startsOn),
        endsOn: yearOn(permit.endsOn),
        cost: '',
        budgetLineId: null,
        notes: '',
        blocks: permit.blocks.map((b, i) => ({
          key: `r${i}`, id: null, venueId: b.venueId, facilityIds: [...b.facilityIds], weekdays: [...b.weekdays],
          startTime: b.startTime, endTime: b.endTime,
        })),
        shares: { ...permit.shares },
        datesOff: [],
      };
      const payload = { ...permitPayload(draft), renewedFromId: permit.id };
      const { data: id, error } = await supabaseAdmin.rpc('org_permit_save', { p_org: orgId, p_permit: null, p_actor: ctx.user.id, p_data: payload });
      if (error) {
        const worded = floorRefusal(error);
        if (worded) return worded;
        throw error;
      }
      return NextResponse.json({ success: true, id: id as string, name: draft.name });
    }

    // -- delete-permit ------------------------------------------------------------
    if (action === 'delete-permit') {
      // ⚖ Offered while nothing hands its time out — Stage 11a adds the schedules that start from a permit; until then
      // nothing does. Its document goes with it.
      // ⚖ A closed year locks a permit's money: one that carries a cost or a budget line in the closed stretch stays —
      // deleting it would take that money out of a closed year (/review 10a). The database is the floor.
      const carriesMoney = permit.cost != null || permit.budgetLineId != null;
      const closed = () => (carriesMoney ? fiscalSetting().then(s => refuseIfClosed(s, [permit.startsOn], { canMove: canMoney, kind: 'plan' })) : null);
      const locked = await closed();
      if (locked) return moveRefused(locked);
      const { data: doc } = await supabaseAdmin.from('org_permits').select('document_path').eq('id', permit.id).eq('org_id', orgId).maybeSingle();
      const { error } = await supabaseAdmin.from('org_permits').delete().eq('id', permit.id).eq('org_id', orgId);
      if (error) {
        const raced = isClosedYearError(error) ? await closed() : null;
        if (raced) return moveRefused(raced);
        throw error;
      }
      if (doc?.document_path) {
        const { error: rmErr } = await supabaseAdmin.storage.from('org-permit-documents').remove([doc.document_path as string]);
        if (rmErr) console.error('[permits] the document stayed behind (the permit is deleted):', rmErr);
      }
      return NextResponse.json({ success: true });
    }

    return refusal(400, 'unsupported', 'Unsupported action.');
  } catch (err) {
    return captureAndJson(err, { error: 'We couldn’t save that just now. Try again.', code: 'save_failed' }, 500);
  }
}, { route: '/api/admin/org/permits' });
