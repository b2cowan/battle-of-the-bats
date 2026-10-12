/**
 * permit-server.ts (server-only — touches supabaseAdmin) — Club Tier Stage 10a.
 *
 * The permits route's reads, each in the shape its screen draws (hub K4MPu4ni53Ct7yrDcmWJd9 → Stages 10 + 11):
 *   readPermitsYear   — the Venue library's Permits view (specimen 1): the permits that START in a fiscal year (Ask 2),
 *                       each with where, its dates, its hours a week, how much of it is used, and its cost.
 *   readPermitWindow  — a permit's window (specimen 2): the permit, its time, its cost band, the field prices (Ask 21),
 *                       its use (Held · Booked · Unused), the budget line it names.
 *   readVenuePermits  — each venue's Permits section (specimen 1's venue window): the permits that hold time there.
 *   readLinePermits   — a budget line's "Pays for" (specimen 12): the permits that name it.
 *
 * ⚖ A PERMIT'S MONEY READS ONLY TO THOSE WHO HOLD THE CLUB'S ACCOUNTING (owner 2026-10-11, plan §6 Ask 1): `canMoney`
 * false strips cost, the field prices' money, an hour held and the budget line from every read here — absent, not
 * blanked — so no screen can show what it was never sent. Its time and its use read to every Venue-library reader.
 *
 * THE USE is read over the one pool of the club's bookings (`readClubBookings`, every program, paged, in windows), never
 * typed: Held from the blocks, Booked clipped to them (a place counted once) (lib/permit-time.ts). A booking no permit
 * covers is never listed on a permit (owner 2026-10-11 — the booking says so where it is made; see permit-time.ts §3).
 */
import { supabaseAdmin } from './supabase-admin';
import { fetchAllIn } from './supabase-paging';
import { addCalendarDays, zonedWallClockToUtc } from './timezone';
import { fiscalYearOf, fiscalYearOptions, type FiscalSetting, type FiscalYear, type FiscalYearOption } from './club-fiscal-year';
import { readClubBookings } from './venue-clash-lookup';
import { readPermitTimes, type PermitRecord, type PermitTimes } from './permit-lookup';
import { fieldPrices, heldTime, permitUse, type PermitUse, type UseBooking } from './permit-time';
import type { PermitHeldFor } from './permit-words';
import type { ClubBooking } from './venue-clash';

// ── Shapes the screens read ────────────────────────────────────────────────────────────────────────────

/** Where a permit holds time, one line per venue: "Lions Park · Diamond 2". */
export interface PermitWhere { venueId: string; venueName: string; facilities: string[] | null }

export interface PermitListRow {
  id: string;
  name: string;
  issuer: string | null;
  reference: string | null;
  where: PermitWhere[];
  startsOn: string;
  endsOn: string;
  weekMinutes: number;
  heldMinutes: number;
  bookedMinutes: number;
  /** Absent for a reader without Accounting. */
  cost?: number | null;
}

export interface PermitsYearRead {
  year: { key: string; name: string; locked: boolean; current: boolean };
  years: FiscalYearOption[];
  canSave: boolean;
  canMoney: boolean;
  permits: PermitListRow[];
}

export interface PermitBlockView {
  id: string;
  venueId: string;
  venueName: string;
  /** Null = every facility at the venue. */
  facilityIds: string[] | null;
  facilityNames: string[] | null;
  weekdays: number[];
  startTime: string;
  endTime: string;
  fromDate: string | null;
  untilDate: string | null;
  heldMinutes: number;
  weekMinutes: number;
  /** The use, per block (specimen 2's rows). */
  bookedMinutes: number;
  unplacedMinutes: number;
  who: string[];
}

export interface PermitPlaceView {
  venueId: string;
  venueName: string;
  facilityId: string | null;
  facilityName: string | null;
  share: number;
  heldMinutes: number;
  bookedMinutes: number;
  who: string[];
  /** An hour of this place (money readers only). */
  hour?: number | null;
}

export interface PermitView {
  id: string;
  name: string;
  issuerName: string | null;
  issuerPayeeId: string | null;
  reference: string | null;
  heldFor: PermitHeldFor;
  heldForTeam: { id: string; name: string } | null;
  startsOn: string;
  endsOn: string;
  notes: string | null;
  updatedAt: string;
  document: { name: string; size: number; addedAt: string; type: string | null } | null;
  year: { key: string; name: string; locked: boolean };
  blocks: PermitBlockView[];
  datesOff: { day: string; note: string | null }[];
  places: PermitPlaceView[];
  use: {
    heldMinutes: number;
    bookedMinutes: number;
    unusedMinutes: number;
    days: { day: string; heldMinutes: number; bookedMinutes: number }[];
  };
  weekMinutes: number;
  renewedFrom: { id: string; name: string } | null;
  /** The club schedules that hand this permit's time out (Club Tier Stage 11a: started from it, or billed at its prices) —
   *  while any does, Delete is refused ("only when no schedule hands it out", specimen 2) and the window offers none. */
  handedOutBy?: { id: string; name: string }[];
  /** Money — absent for a reader without Accounting. */
  cost?: number | null;
  budgetLine?: { id: string; name: string; yearKey: string; yearName: string } | null;
  prices?: { fullHour: number | null; allFull: boolean; fullFieldHours: number };
}

export interface PermitWindowRead { canSave: boolean; canMoney: boolean; permit: PermitView }

// ── Helpers ────────────────────────────────────────────────────────────────────────────────────────────

const byName = (a: string, b: string) => a.localeCompare(b, 'en-CA', { numeric: true });

/** Where each permit holds time, one line per venue in the order its blocks name them, the facilities in the club's order. */
function whereOf(p: PermitRecord, t: PermitTimes): PermitWhere[] {
  const byVenue = new Map<string, Set<string> | null>();
  for (const b of p.blocks) {
    const had = byVenue.get(b.venueId);
    if (had === null) continue;
    if (!b.facilityIds.length) { byVenue.set(b.venueId, null); continue; }
    const set = had ?? new Set<string>();
    for (const f of b.facilityIds) set.add(f);
    byVenue.set(b.venueId, set);
  }
  return [...byVenue.entries()].map(([venueId, facs]) => {
    const order = t.venueFacilities.get(venueId) ?? [];
    return {
      venueId,
      venueName: t.venueName.get(venueId) ?? 'A venue',
      facilities: facs ? [...facs].sort((a, b) => order.indexOf(a) - order.indexOf(b)).map(f => t.facilityName.get(f) ?? '') : null,
    };
  });
  // In the permit's own order (its first block first), as the drawing lists them — never re-sorted by name.
}

/** The issuer's name: the payee's current name while the link stands, else the words typed. */
async function issuerNames(orgId: string, permits: readonly PermitRecord[]): Promise<Map<string, string>> {
  const ids = [...new Set(permits.map(p => p.issuerPayeeId).filter((x): x is string => !!x))];
  const rows = await fetchAllIn<{ id: string; name: string }>(ids, (c, a, b) => supabaseAdmin.from('org_payees')
    .select('id, name').eq('org_id', orgId).in('id', c).order('id').range(a, b));
  return new Map(rows.map(r => [r.id, r.name]));
}
const issuerOf = (p: PermitRecord, names: Map<string, string>) => (p.issuerPayeeId && names.get(p.issuerPayeeId)) || p.issuerName || null;

/** The club's bookings over a set of permits' dates, as the use reads them. */
async function permitUseOf(orgId: string, permits: readonly PermitRecord[], t: PermitTimes): Promise<Map<string, PermitUse>> {
  const out = new Map<string, PermitUse>();
  if (!permits.length) return out;
  const fromDay = permits.reduce((m, p) => (p.startsOn < m ? p.startsOn : m), permits[0].startsOn);
  const toDay = permits.reduce((m, p) => (p.endsOn > m ? p.endsOn : m), permits[0].endsOn);
  const fromMs = Date.parse(zonedWallClockToUtc(fromDay, '00:00')!);
  const toMs = Date.parse(zonedWallClockToUtc(addCalendarDays(toDay, 1), '00:00')!);
  const pool = await readClubBookings(orgId, fromMs, toMs);
  const bookings: UseBooking[] = pool.bookings.map((b: ClubBooking) => ({
    key: b.key, ownerName: b.ownerName, venueId: b.venueId, facilityId: b.facilityId, startMs: b.startMs, endMs: b.endMs,
  }));
  for (const p of permits) out.set(p.id, permitUse(p, bookings, { venueFacilities: t.venueFacilities }));
  return out;
}

// ── The Permits view (specimen 1) ──────────────────────────────────────────────────────────────────────

export async function readPermitsYear(orgId: string, opts: {
  year: FiscalYear; setting: FiscalSetting; today: string; canSave: boolean; canMoney: boolean;
}): Promise<PermitsYearRead> {
  const { year, setting, today, canSave, canMoney } = opts;
  // Every permit's start, for the year pill (the years that hold permits, this year and the next — the Budget's rule).
  const { data: starts, error } = await supabaseAdmin.from('org_permits').select('starts_on').eq('org_id', orgId);
  if (error) throw error;
  const byYear: Record<string, number> = {};
  for (const s of starts ?? []) {
    const k = fiscalYearOf(s.starts_on as string, setting).key;
    byYear[k] = (byYear[k] ?? 0) + 1;
  }
  const t = await readPermitTimes(orgId, { startsFrom: year.firstDay, startsTo: year.lastDay });
  const [issuers, use] = await Promise.all([issuerNames(orgId, t.permits), permitUseOf(orgId, t.permits, t)]);
  return {
    year: { key: year.key, name: year.name, locked: year.locked, current: fiscalYearOf(today, setting).key === year.key },
    years: fiscalYearOptions(setting, today, byYear),
    canSave,
    canMoney,
    permits: t.permits.map(p => {
      const held = heldTime(p, t.venueFacilities);
      const u = use.get(p.id);
      const row: PermitListRow = {
        id: p.id, name: p.name, issuer: issuerOf(p, issuers), reference: p.reference, where: whereOf(p, t),
        startsOn: p.startsOn, endsOn: p.endsOn, weekMinutes: held.weekMinutes,
        heldMinutes: u?.totals.heldMinutes ?? held.heldMinutes, bookedMinutes: u?.totals.bookedMinutes ?? 0,
      };
      if (canMoney) row.cost = p.cost;
      return row;
    }),
  };
}

// ── A permit's window (specimen 2) ─────────────────────────────────────────────────────────────────────

/** The club schedules that hand a permit's time out: started from it, or billed at its prices (Club Tier Stage 11a). */
export async function schedulesHandingOut(orgId: string, permitId: string): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabaseAdmin.from('club_schedules').select('id, name').eq('org_id', orgId)
    .or(`started_from_permit_id.eq.${permitId},bill_permit_id.eq.${permitId}`).order('name');
  if (error) throw error;
  return (data ?? []) as { id: string; name: string }[];
}

export async function readPermitWindow(orgId: string, permitId: string, opts: {
  setting: FiscalSetting; canSave: boolean; canMoney: boolean;
}): Promise<PermitWindowRead | null> {
  const t = await readPermitTimes(orgId, { ids: [permitId] });
  const p = t.permits[0];
  if (!p) return null;
  const [issuers, use, team, renewed, line, handedOutBy] = await Promise.all([
    issuerNames(orgId, [p]),
    permitUseOf(orgId, [p], t),
    p.heldForTeamId
      ? supabaseAdmin.from('rep_teams').select('id, name').eq('id', p.heldForTeamId).eq('org_id', orgId).maybeSingle().then(r => r.data as { id: string; name: string } | null)
      : Promise.resolve(null),
    p.renewedFromId
      ? supabaseAdmin.from('org_permits').select('id, name').eq('id', p.renewedFromId).eq('org_id', orgId).maybeSingle().then(r => r.data as { id: string; name: string } | null)
      : Promise.resolve(null),
    opts.canMoney && p.budgetLineId
      ? supabaseAdmin.from('org_budget_lines').select('id, description, org_fiscal_years!inner(first_day, name)')
        .eq('id', p.budgetLineId).eq('org_id', orgId).maybeSingle()
        .then(r => r.data as { id: string; description: string; org_fiscal_years: { first_day: string; name: string } } | null)
      : Promise.resolve(null),
    schedulesHandingOut(orgId, p.id),
  ]);
  const u = use.get(p.id)!;
  const held = heldTime(p, t.venueFacilities);
  const shares = new Map(Object.entries(p.shares));
  const prices = fieldPrices(p, t.venueFacilities, shares, p.cost);
  const year = fiscalYearOf(p.startsOn, opts.setting);

  const blocks: PermitBlockView[] = p.blocks.map(b => {
    const h = held.blocks.find(x => x.blockId === b.id);
    const bu = u.blocks.find(x => x.blockId === b.id);
    return {
      id: b.id, venueId: b.venueId, venueName: t.venueName.get(b.venueId) ?? 'A venue',
      facilityIds: b.facilityIds.length ? [...b.facilityIds] : null,
      facilityNames: b.facilityIds.length ? b.facilityIds.map(f => t.facilityName.get(f) ?? '') : null,
      weekdays: [...b.weekdays], startTime: b.startTime, endTime: b.endTime, fromDate: b.fromDate, untilDate: b.untilDate,
      heldMinutes: h?.heldMinutes ?? 0, weekMinutes: h?.weekMinutes ?? 0,
      bookedMinutes: bu?.bookedMinutes ?? 0, unplacedMinutes: bu?.unplacedMinutes ?? 0, who: bu?.who ?? [],
    };
  });
  const places: PermitPlaceView[] = u.places.map(pl => {
    const view: PermitPlaceView = {
      venueId: pl.venueId, venueName: t.venueName.get(pl.venueId) ?? 'A venue',
      facilityId: pl.unit, facilityName: pl.unit ? t.facilityName.get(pl.unit) ?? '' : null,
      share: pl.unit ? shares.get(pl.unit) ?? 1 : 1,
      heldMinutes: pl.heldMinutes, bookedMinutes: pl.bookedMinutes, who: pl.who,
    };
    if (opts.canMoney) view.hour = prices.hourOf(pl.unit);
    return view;
  });
  // A place a block holds but no date did (a permit not yet begun reads its places anyway, at zero).
  for (const b of p.blocks) {
    const units = b.facilityIds.length ? b.facilityIds : (t.venueFacilities.get(b.venueId) ?? []).length ? t.venueFacilities.get(b.venueId)! : [null];
    for (const unit of units) {
      if (places.some(x => x.venueId === b.venueId && x.facilityId === unit)) continue;
      const view: PermitPlaceView = {
        venueId: b.venueId, venueName: t.venueName.get(b.venueId) ?? 'A venue', facilityId: unit,
        facilityName: unit ? t.facilityName.get(unit) ?? '' : null, share: unit ? shares.get(unit) ?? 1 : 1,
        heldMinutes: 0, bookedMinutes: 0, who: [],
      };
      if (opts.canMoney) view.hour = prices.hourOf(unit);
      places.push(view);
    }
  }
  const facilityOrder = (venueId: string, id: string | null) => (id ? (t.venueFacilities.get(venueId) ?? []).indexOf(id) : -1);
  places.sort((a, b) => byName(a.venueName, b.venueName) || facilityOrder(a.venueId, a.facilityId) - facilityOrder(b.venueId, b.facilityId));

  const view: PermitView = {
    id: p.id, name: p.name, issuerName: issuerOf(p, issuers), issuerPayeeId: p.issuerPayeeId, reference: p.reference,
    heldFor: p.heldFor, heldForTeam: team, startsOn: p.startsOn, endsOn: p.endsOn, notes: p.notes, updatedAt: p.updatedAt,
    document: p.document ? { name: p.document.name, size: p.document.size, addedAt: p.document.addedAt, type: p.document.type } : null,
    year: { key: year.key, name: year.name, locked: year.locked },
    blocks, datesOff: [...p.datesOff], places,
    use: {
      heldMinutes: u.totals.heldMinutes, bookedMinutes: u.totals.bookedMinutes, unusedMinutes: u.totals.unusedMinutes,
      days: u.days,
    },
    weekMinutes: held.weekMinutes,
    renewedFrom: renewed,
    handedOutBy,
  };
  if (opts.canMoney) {
    view.cost = p.cost;
    view.budgetLine = line ? { id: line.id, name: line.description, yearKey: line.org_fiscal_years.first_day, yearName: line.org_fiscal_years.name } : null;
    view.prices = { fullHour: prices.fullHour, allFull: prices.allFull, fullFieldHours: prices.fullFieldHours };
  }
  return { canSave: opts.canSave, canMoney: opts.canMoney, permit: view };
}

// ── Each venue's Permits section (specimen 1's venue window) ───────────────────────────────────────────

/** A permit that holds time at a venue, with only its blocks there. */
export interface VenuePermitRow {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  blocks: { facilities: string[] | null; weekdays: number[]; startTime: string; endTime: string }[];
}

export async function readVenuePermits(orgId: string, venueIds: readonly string[], today: string): Promise<Record<string, VenuePermitRow[]>> {
  const out: Record<string, VenuePermitRow[]> = {};
  if (!venueIds.length) return out;
  // Every permit not yet over (an ended one lives on the Permits view by its year; the window lists what holds time).
  const t = await readPermitTimes(orgId, { venueIds, fromDay: today });
  for (const p of t.permits) {
    for (const venueId of new Set(p.blocks.map(b => b.venueId))) {
      if (!venueIds.includes(venueId)) continue;
      (out[venueId] ??= []).push({
        id: p.id, name: p.name, startsOn: p.startsOn, endsOn: p.endsOn,
        blocks: p.blocks.filter(b => b.venueId === venueId).map(b => ({
          facilities: b.facilityIds.length ? b.facilityIds.map(f => t.facilityName.get(f) ?? '') : null,
          weekdays: [...b.weekdays], startTime: b.startTime, endTime: b.endTime,
        })),
      });
    }
  }
  for (const k of Object.keys(out)) out[k].sort((a, b) => b.startsOn.localeCompare(a.startsOn));
  return out;
}

// ── A budget line's "Pays for" (specimen 12) ───────────────────────────────────────────────────────────

export interface LinePermitRow { id: string; name: string; issuer: string | null; reference: string | null; startsOn: string; endsOn: string; cost: number | null }

/** The permits that name each line. Read only by Accounting's own routes (their readers hold Accounting). */
export async function readLinePermits(orgId: string, lineIds: readonly string[]): Promise<Record<string, LinePermitRow[]>> {
  const out: Record<string, LinePermitRow[]> = {};
  if (!lineIds.length) return out;
  const rows = await fetchAllIn<{ id: string; name: string; issuer_payee_id: string | null; issuer_name: string | null; reference: string | null; starts_on: string; ends_on: string; cost: number | string | null; budget_line_id: string }>(
    lineIds, (c, a, b) => supabaseAdmin.from('org_permits')
      .select('id, name, issuer_payee_id, issuer_name, reference, starts_on, ends_on, cost, budget_line_id')
      .eq('org_id', orgId).in('budget_line_id', c).order('id').range(a, b));
  const payeeIds = [...new Set(rows.map(r => r.issuer_payee_id).filter((x): x is string => !!x))];
  const payees = await fetchAllIn<{ id: string; name: string }>(payeeIds, (c, a, b) => supabaseAdmin.from('org_payees')
    .select('id, name').eq('org_id', orgId).in('id', c).order('id').range(a, b));
  const payee = new Map(payees.map(p => [p.id, p.name]));
  for (const r of rows) {
    (out[r.budget_line_id] ??= []).push({
      id: r.id, name: r.name, issuer: (r.issuer_payee_id && payee.get(r.issuer_payee_id)) || r.issuer_name || null,
      reference: r.reference, startsOn: r.starts_on, endsOn: r.ends_on, cost: r.cost == null ? null : Number(r.cost),
    });
  }
  for (const k of Object.keys(out)) out[k].sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  return out;
}
