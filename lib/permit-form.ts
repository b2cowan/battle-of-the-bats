/**
 * permit-form.ts — a permit's record as a form holds it, and the ONE check both sides run (Club Tier Stage 10a; hub
 * specimens 2 and 14 step 1). The window's form HOLDS a save with the reason in its pill (`permitHeldReason`); the route
 * REFUSES the same record with the same words (`readPermitBody`), so a reason never differs between the two. Pure,
 * client-safe.
 *
 * The record is sent WHOLE on every save (the 2026-10-01 record standard: the pencil edits the whole record, autosaved;
 * Add permit asks once): the permit's fields, its blocks (each keeps its id), the field prices and the dates off. The
 * route writes it in one step (`org_permit_save`, mig 322).
 */
import { overlappingBlocks, type TimeBlock, type VenueFacilities } from './permit-time.ts';
import { daysBetweenDateStrings, isCalendarDate } from './timezone.ts';
import { isUuid } from './utils.ts';
import { PERMIT_WORDS as W, type PermitHeldFor } from './permit-words.ts';

export interface PermitBlockDraft {
  /** The row's key in the form (its id once saved, else a new key). */
  key: string;
  id: string | null;
  venueId: string;
  /** Empty = every facility at the venue. */
  facilityIds: string[];
  weekdays: number[];
  startTime: string;
  endTime: string;
}

export interface PermitDateOffDraft { key: string; day: string; note: string }

export interface PermitDraft {
  name: string;
  issuerPayeeId: string | null;
  issuerName: string;
  reference: string;
  heldFor: PermitHeldFor;
  heldForTeamId: string | null;
  startsOn: string;
  endsOn: string;
  /** Money — sent only by a reader who holds Accounting; the route keeps what is stored otherwise. */
  cost: string;
  budgetLineId: string | null;
  notes: string;
  blocks: PermitBlockDraft[];
  /** Facility id → its share of a full field (< 1). No entry = Full. */
  shares: Record<string, number>;
  datesOff: PermitDateOffDraft[];
}

export const EMPTY_PERMIT_DRAFT = (): PermitDraft => ({
  name: '', issuerPayeeId: null, issuerName: '', reference: '', heldFor: 'club', heldForTeamId: null,
  startsOn: '', endsOn: '', cost: '', budgetLineId: null, notes: '', blocks: [], shares: {}, datesOff: [],
});

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
const HELD_FOR: readonly PermitHeldFor[] = ['club', 'rep', 'league', 'team'];

/** "3,200.00" / "$3200" / "3200" → 3200; '' → null; anything else → NaN — a figure past the column (ten digits of
 *  dollars) too, so it is held in words rather than refused by the database (/review 10a). */
export function parseCost(raw: string): number | null {
  const t = raw.replace(/[$,\s]/g, '');
  if (!t) return null;
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(t)) return NaN;
  return Number(t);
}

/** A field's share of a full field, as stored (four places): above none and below Full once rounded (/review 10a). */
export const shareStores = (s: number) => {
  const r = Math.round(s * 10_000) / 10_000;
  return r > 0 && r < 1;
};

const toBlock = (b: PermitBlockDraft): TimeBlock => ({
  id: b.id ?? b.key, venueId: b.venueId, facilityIds: b.facilityIds, weekdays: b.weekdays,
  startTime: b.startTime, endTime: b.endTime, fromDate: null, untilDate: null,
});

/**
 * Why this record can't save yet — the pill says it, nothing typed is lost — or null. `money` is whether this reader
 * sets the cost (a reader without Accounting never sees it, so it never holds their save).
 */
export function permitHeldReason(d: PermitDraft, venueFacilities: VenueFacilities, money: boolean): string | null {
  if (!d.name.trim()) return W.nameHeld;
  if (!isCalendarDate(d.startsOn) || !isCalendarDate(d.endsOn)) return W.datesHeld;
  if (d.endsOn < d.startsOn) return W.datesOrderHeld;
  if (d.blocks.some(b => !b.venueId || !b.weekdays.length || !CLOCK.test(b.startTime) || !CLOCK.test(b.endTime))) return W.blockHeld;
  if (d.blocks.some(b => b.endTime <= b.startTime)) return W.blockHoursHeld;
  if (overlappingBlocks({ blocks: d.blocks.map(toBlock) }, venueFacilities)) return W.blocksOverlapHeld;
  if (money && Number.isNaN(parseCost(d.cost) as number)) return W.costHeld;
  if (Object.values(d.shares).some(s => !shareStores(s))) return W.shareHeld;
  return null;
}

/** The record as the route's one step takes it (mig 322's `org_permit_save` payload). */
export function permitPayload(d: PermitDraft): Record<string, unknown> {
  return {
    name: d.name.trim(),
    issuerPayeeId: d.issuerPayeeId,
    issuerName: d.issuerName.trim() || null,
    reference: d.reference.trim() || null,
    heldFor: d.heldFor,
    heldForTeamId: d.heldFor === 'team' ? d.heldForTeamId : null,
    startsOn: d.startsOn,
    endsOn: d.endsOn,
    cost: parseCost(d.cost),
    budgetLineId: d.budgetLineId,
    notes: d.notes.trim() || null,
    blocks: d.blocks.map(b => ({
      id: b.id, venueId: b.venueId, facilityIds: [...new Set(b.facilityIds)], weekdays: [...new Set(b.weekdays)].sort((x, y) => x - y),
      startTime: b.startTime, endTime: b.endTime,
    })),
    shares: Object.entries(d.shares).filter(([, s]) => shareStores(s)).map(([facilityId, share]) => ({ facilityId, share })),
    datesOff: d.datesOff.filter(o => isCalendarDate(o.day)).map(o => ({ day: o.day, note: o.note.trim() || null })),
  };
}

/** What the route reads from a request: the same record, checked field by field, or the refusal in words. */
export type PermitBody = { ok: true; draft: PermitDraft } | { ok: false; code: string; error: string };

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const idOrNull = (v: unknown) => (isUuid(v) ? v : null);

export function readPermitBody(raw: unknown, venueFacilities: VenueFacilities, money: boolean): PermitBody {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const blocks = (Array.isArray(r.blocks) ? r.blocks : []).slice(0, 60).map((b, i): PermitBlockDraft => {
    const x = (b && typeof b === 'object' ? b : {}) as Record<string, unknown>;
    return {
      key: `b${i}`,
      id: idOrNull(x.id),
      venueId: idOrNull(x.venueId) ?? '',
      facilityIds: (Array.isArray(x.facilityIds) ? x.facilityIds : []).map(idOrNull).filter((f): f is string => !!f),
      weekdays: (Array.isArray(x.weekdays) ? x.weekdays : []).map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 7),
      startTime: str(x.startTime, 5),
      endTime: str(x.endTime, 5),
    };
  });
  const shares: Record<string, number> = {};
  for (const s of Array.isArray(r.shares) ? r.shares.slice(0, 200) : []) {
    const x = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
    const id = idOrNull(x.facilityId);
    const share = Number(x.share);
    if (id && Number.isFinite(share) && share < 1) shares[id] = share;
  }
  const heldFor = HELD_FOR.includes(r.heldFor as PermitHeldFor) ? r.heldFor as PermitHeldFor : 'club';
  const draft: PermitDraft = {
    name: str(r.name, 120),
    issuerPayeeId: idOrNull(r.issuerPayeeId),
    issuerName: str(r.issuerName, 200),
    reference: str(r.reference, 80),
    heldFor,
    heldForTeamId: heldFor === 'team' ? idOrNull(r.heldForTeamId) : null,
    startsOn: str(r.startsOn, 10),
    endsOn: str(r.endsOn, 10),
    cost: r.cost == null ? '' : String(r.cost),
    budgetLineId: idOrNull(r.budgetLineId),
    notes: str(r.notes, 2000),
    blocks,
    shares,
    datesOff: (Array.isArray(r.datesOff) ? r.datesOff : []).slice(0, 200).map((o, i) => {
      const x = (o && typeof o === 'object' ? o : {}) as Record<string, unknown>;
      return { key: `o${i}`, day: str(x.day, 10), note: str(x.note, 120) };
    }),
  };
  const held = permitHeldReason(draft, venueFacilities, money);
  if (held) return { ok: false, code: 'permit_held', error: held };
  if (draft.heldFor === 'team' && !draft.heldForTeamId) return { ok: false, code: 'permit_team', error: 'Pick the team the permit is for.' };
  // A long permit reads in windows, but a record past three years is a typing slip (mig 322's CHECK).
  if (daysBetweenDateStrings(draft.startsOn, draft.endsOn) > 1096) return { ok: false, code: 'permit_too_long', error: 'A permit runs three years at most. Check the last day.' };
  if (draft.datesOff.some(o => o.day < draft.startsOn || o.day > draft.endsOn)) {
    return { ok: false, code: 'date_off_outside', error: 'A date off has to fall inside the permit’s dates.' };
  }
  return { ok: true, draft };
}
