/**
 * permit-lookup.ts (server-only — touches supabaseAdmin) — Club Tier Stage 10a.
 *
 * THE ONE READ OF THE CLUB'S PERMITS, and the permit's answer for bookings — beside the clash lookup
 * (`lib/venue-clash-lookup.ts`), never inside its pair rule (P11-04b). Every check route and every writer that answers
 * with clash findings answers with this too, as ITS OWN FIELD (`permits`): the coach's live check, house league's, the
 * tournament generator's, and the saves' replies (`ClashReport.permits`, the rep writers' `permitsForSaved*`).
 *
 *   readPermitTimes   — the club's permits (their time: blocks, facilities, dates off, field prices) by venue and dates,
 *                       or by id; and the club's facilities at each venue they touch (what "every facility" reads).
 *   checkClubPermits  — the permit's answer per proposed booking key: only the OUTSIDE ones, named (`PermitOutside` —
 *                       a facility, days and hours; never a cost, issuer or reference: a coach reads this).
 *
 * Multi-tenant: every query is scoped by the club's `org_id`. A club with no permits pays one small read and answers
 * nothing; a booking on a place that isn't one of the club's venues costs no read at all.
 */
import { supabaseAdmin } from './supabase-admin';
import { fetchAll, fetchAllIn } from './supabase-paging';
import { hasOrgVenueLibrary } from './plan-features';
import type { OrgPlan } from './types';
import { orgDayKey, addCalendarDays } from './timezone';
import { clock, permitAnswer, type PermitOutsideIds, type PermitTime, type TimeBlock, type VenueFacilities, type DateOff } from './permit-time';
import type { PermitOutside } from './permit-words';
import type { ClubBooking } from './venue-clash';

type BlockRow = {
  id: string; permit_id: string; org_venue_id: string; weekdays: number[]; start_time: string; end_time: string;
  from_date: string | null; until_date: string | null; sort_order: number;
  org_time_block_facilities: { facility_id: string }[] | null;
};
type PermitRow = {
  id: string; name: string; issuer_payee_id: string | null; issuer_name: string | null; reference: string | null;
  held_for: 'club' | 'rep' | 'league' | 'team'; held_for_team_id: string | null; starts_on: string; ends_on: string;
  cost: number | string | null; budget_line_id: string | null; document_name: string | null; document_size: number | null;
  document_type: string | null; document_added_at: string | null; notes: string | null; renewed_from_id: string | null;
  created_at: string; updated_at: string; updated_by: string | null;
};
const PERMIT_COLUMNS = 'id, name, issuer_payee_id, issuer_name, reference, held_for, held_for_team_id, starts_on, ends_on, cost, budget_line_id, document_name, document_size, document_type, document_added_at, notes, renewed_from_id, created_at, updated_at, updated_by';

/** A permit as the server reads it: its time (the rule's `PermitTime`), its field prices, and its record's fields.
 *  ⚠ `cost` and `budgetLineId` are MONEY: a route strips them for a reader without Accounting (`permitForReader`). */
export interface PermitRecord extends PermitTime {
  name: string;
  issuerPayeeId: string | null;
  issuerName: string | null;
  reference: string | null;
  heldFor: 'club' | 'rep' | 'league' | 'team';
  heldForTeamId: string | null;
  cost: number | null;
  budgetLineId: string | null;
  /** Field prices: facility id → share of a full field (no entry = Full). */
  shares: Record<string, number>;
  document: { name: string; size: number; type: string | null; addedAt: string } | null;
  notes: string | null;
  renewedFromId: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
}

export interface PermitTimes {
  permits: PermitRecord[];
  /** The club's facilities at each venue a block touches, in the club's order. */
  venueFacilities: Map<string, string[]>;
  /** The club's names for those venues and facilities. */
  venueName: Map<string, string>;
  facilityName: Map<string, string>;
}

const EMPTY = (): PermitTimes => ({ permits: [], venueFacilities: new Map(), venueName: new Map(), facilityName: new Map() });

/** The club's venues and facilities: each venue's facilities in the club's order (what "every facility" reads, and the
 *  order a form validates in), and their names. One read of each — a club keeps a handful. */
export interface ClubPlaces {
  byVenue: Map<string, string[]>;
  order: Map<string, number>;
  venueName: Map<string, string>;
  facilityName: Map<string, string>;
}
export async function readClubPlaces(orgId: string): Promise<ClubPlaces> {
  const [venues, facilities] = await Promise.all([
    fetchAll<{ id: string; name: string }>((a, b) => supabaseAdmin.from('org_venues')
      .select('id, name').eq('org_id', orgId).order('id').range(a, b)),
    fetchAll<{ id: string; org_venue_id: string; name: string; display_order: number }>((a, b) => supabaseAdmin
      .from('org_venue_facilities').select('id, org_venue_id, name, display_order').eq('org_id', orgId).order('id').range(a, b)),
  ]);
  const byVenue = new Map<string, string[]>();
  for (const f of [...facilities].sort((x, y) => x.display_order - y.display_order || x.name.localeCompare(y.name))) {
    byVenue.set(f.org_venue_id, [...(byVenue.get(f.org_venue_id) ?? []), f.id]);
  }
  return {
    byVenue,
    order: new Map(facilities.map(f => [f.id, f.display_order])),
    venueName: new Map(venues.map(v => [v.id, v.name])),
    facilityName: new Map(facilities.map(f => [f.id, f.name])),
  };
}

/**
 * The club's permits — by the venues they hold time at and the days they cover (`venueIds`, `fromDay`, `toDay`), or by
 * id (`ids`), or every permit starting in a span (`startsFrom`/`startsTo`, the Permits view's year). A failed read THROWS:
 * a check route catches it and says nothing (never a line that isn't true); a page says it couldn't load.
 */
export async function readPermitTimes(orgId: string, opts: {
  venueIds?: readonly string[];
  fromDay?: string;
  toDay?: string;
  ids?: readonly string[];
  startsFrom?: string;
  startsTo?: string;
}): Promise<PermitTimes> {
  if (opts.venueIds && !opts.venueIds.length) return EMPTY();
  /** The date filters, said once for every way in. */
  type Ranged = { gte(column: string, value: string): Ranged; lte(column: string, value: string): Ranged };
  const ranged = <Q,>(query: Q): Q => {
    let q = query as unknown as Ranged;
    if (opts.startsFrom) q = q.gte('starts_on', opts.startsFrom);
    if (opts.startsTo) q = q.lte('starts_on', opts.startsTo);
    if (opts.toDay) q = q.lte('starts_on', opts.toDay);
    if (opts.fromDay) q = q.gte('ends_on', opts.fromDay);
    return q as unknown as Q;
  };
  // ONE read of the permits: by venue (an inner join on their blocks — a permit that holds time there), by id, or all.
  const rows = opts.venueIds
    ? await fetchAllIn<PermitRow>(opts.venueIds, (c, a, b) => ranged(supabaseAdmin.from('org_permits')
      .select(`${PERMIT_COLUMNS}, org_time_blocks!inner(org_venue_id)`).eq('org_id', orgId).in('org_time_blocks.org_venue_id', c))
      .order('id').range(a, b))
    : opts.ids
      ? await fetchAllIn<PermitRow>(opts.ids, (c, a, b) => ranged(supabaseAdmin.from('org_permits')
        .select(PERMIT_COLUMNS).eq('org_id', orgId).in('id', c)).order('id').range(a, b))
      : await fetchAll<PermitRow>((a, b) => ranged(supabaseAdmin.from('org_permits')
        .select(PERMIT_COLUMNS).eq('org_id', orgId)).order('id').range(a, b));
  const permitRows = [...new Map(rows.filter(p => !opts.ids || opts.ids.includes(p.id)).map(p => [p.id, p])).values()];
  if (!permitRows.length) return EMPTY();
  const ids = permitRows.map(p => p.id);

  // Then everything else at once: the blocks with their facilities, the dates off, the prices, the club's places.
  const [blocks, offs, shares, places] = await Promise.all([
    fetchAllIn<BlockRow>(ids, (c, a, b) => supabaseAdmin.from('org_time_blocks')
      .select('id, permit_id, org_venue_id, weekdays, start_time, end_time, from_date, until_date, sort_order, org_time_block_facilities(facility_id)')
      .eq('org_id', orgId).in('permit_id', c).order('id').range(a, b)),
    fetchAllIn<{ permit_id: string; day: string; note: string | null }>(ids, (c, a, b) => supabaseAdmin.from('org_time_dates_off')
      .select('permit_id, day, note').eq('org_id', orgId).in('permit_id', c).order('id').range(a, b)),
    fetchAllIn<{ permit_id: string; facility_id: string; share: number | string }>(ids, (c, a, b) => supabaseAdmin.from('org_permit_facility_shares')
      .select('permit_id, facility_id, share').eq('org_id', orgId).in('permit_id', c).order('permit_id').order('facility_id').range(a, b)),
    readClubPlaces(orgId),
  ]);

  const blocksOf = new Map<string, TimeBlock[]>();
  for (const b of [...blocks].sort((x, y) => x.sort_order - y.sort_order)) {
    const block: TimeBlock = {
      id: b.id, venueId: b.org_venue_id,
      facilityIds: (b.org_time_block_facilities ?? []).map(f => f.facility_id)
        .sort((x, y) => (places.order.get(x) ?? 0) - (places.order.get(y) ?? 0)),
      weekdays: [...(b.weekdays ?? [])].map(Number).sort((x, y) => x - y),
      startTime: clock(b.start_time), endTime: clock(b.end_time),
      fromDate: b.from_date, untilDate: b.until_date,
    };
    blocksOf.set(b.permit_id, [...(blocksOf.get(b.permit_id) ?? []), block]);
  }
  const offsOf = new Map<string, DateOff[]>();
  for (const o of offs) offsOf.set(o.permit_id, [...(offsOf.get(o.permit_id) ?? []), { day: o.day, note: o.note }]);
  const sharesOf = new Map<string, Record<string, number>>();
  for (const s of shares) sharesOf.set(s.permit_id, { ...(sharesOf.get(s.permit_id) ?? {}), [s.facility_id]: Number(s.share) });

  return {
    permits: permitRows.map((p): PermitRecord => ({
      id: p.id, startsOn: p.starts_on, endsOn: p.ends_on,
      blocks: blocksOf.get(p.id) ?? [],
      datesOff: (offsOf.get(p.id) ?? []).sort((a, b) => a.day.localeCompare(b.day)),
      name: p.name, issuerPayeeId: p.issuer_payee_id, issuerName: p.issuer_name, reference: p.reference,
      heldFor: p.held_for, heldForTeamId: p.held_for_team_id,
      cost: p.cost == null ? null : Number(p.cost), budgetLineId: p.budget_line_id,
      shares: sharesOf.get(p.id) ?? {},
      document: p.document_name ? { name: p.document_name, size: Number(p.document_size ?? 0), type: p.document_type, addedAt: p.document_added_at ?? p.updated_at } : null,
      notes: p.notes, renewedFromId: p.renewed_from_id, createdAt: p.created_at, updatedAt: p.updated_at, updatedBy: p.updated_by,
    })).sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.name.localeCompare(b.name, 'en-CA', { numeric: true })),
    venueFacilities: places.byVenue,
    venueName: places.venueName,
    facilityName: places.facilityName,
  };
}

/** The rule's ids, named — the wire shape of the quiet line. */
export function namePermitOutside(o: PermitOutsideIds, b: { venueId: string | null; facilityId: string | null }, names: Pick<PermitTimes, 'venueName' | 'facilityName'>): PermitOutside {
  const fac = (id: string) => names.facilityName.get(id) ?? '';
  return {
    kind: 'outside',
    day: o.day,
    venueName: (b.venueId && names.venueName.get(b.venueId)) || '',
    facilityName: b.facilityId ? fac(b.facilityId) || null : null,
    onFacility: o.onFacility,
    covers: o.covers.map(c => ({ facilities: c.facilityIds ? c.facilityIds.map(fac).filter(Boolean) : null, weekdays: c.weekdays, startTime: c.startTime, endTime: c.endTime })),
    until: o.until,
    dateOff: o.dateOff,
  };
}

/** The bookings' days, padded a day each side (a late booking's local day can be the next UTC one). */
function daySpan(bookings: readonly { startMs: number; endMs: number }[]): { fromDay: string; toDay: string } {
  const from = Math.min(...bookings.map(b => b.startMs));
  const to = Math.max(...bookings.map(b => b.endMs));
  return {
    fromDay: addCalendarDays(orgDayKey(new Date(from).toISOString()), -1),
    toDay: addCalendarDays(orgDayKey(new Date(to).toISOString()), 1),
  };
}

/**
 * THE PERMIT'S ANSWER for proposed (or just-saved) bookings, per key: only the ones OUTSIDE a permit the club holds,
 * named. A booking not on a club venue, inside a permit, or at a venue the club holds no permit at that day is absent.
 * Throws on a failed read — the caller decides (a live check says nothing; a writer's report logs and says nothing).
 */
export async function checkClubPermits(
  orgId: string,
  proposed: readonly Pick<ClubBooking, 'key' | 'venueId' | 'facilityId' | 'startMs' | 'endMs'>[],
): Promise<Map<string, PermitOutside>> {
  const placed = proposed.filter(p => p.venueId && Number.isFinite(p.startMs) && Number.isFinite(p.endMs));
  const out = new Map<string, PermitOutside>();
  if (!placed.length) return out;
  const venueIds = [...new Set(placed.map(p => p.venueId!))];
  // ⚖ Permits ride the Venue library's plans (Ask 4): a club that held permits and moved to a plan without the library
  // keeps its records but reads no line from them. Checked HERE, so no caller can miss it (/strategy drift check
  // 2026-10-11 — the save replies and house league's check had no plan check of their own).
  const [plan, times] = await Promise.all([
    supabaseAdmin.from('organizations').select('plan_id').eq('id', orgId).maybeSingle(),
    readPermitTimes(orgId, { venueIds, ...daySpan(placed) }),
  ]);
  if (plan.error) throw plan.error;
  if (!hasOrgVenueLibrary((plan.data?.plan_id as OrgPlan | null) ?? null)) return out;
  if (!times.permits.length) return out;
  for (const p of placed) {
    const a = permitAnswer(p, times.permits, times.venueFacilities as VenueFacilities);
    if (a.kind === 'outside') out.set(p.key, namePermitOutside(a, p, times));
  }
  return out;
}

/**
 * The same answer where a failed permit read must say NOTHING — every live check and every save reply (the one policy:
 * a permit line is never an error, and never a line that isn't true). The failure is logged; the booking stands.
 */
export async function checkClubPermitsQuietly(
  orgId: string,
  proposed: readonly Pick<ClubBooking, 'key' | 'venueId' | 'facilityId' | 'startMs' | 'endMs'>[],
): Promise<Map<string, PermitOutside>> {
  try {
    return await checkClubPermits(orgId, proposed);
  } catch (e) {
    console.error('[permits] the permit read failed (said nothing):', e);
    return new Map();
  }
}
