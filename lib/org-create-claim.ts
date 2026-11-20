/**
 * TWO TABS NAMING A CLUB AT THE SAME MOMENT MAKE ONE ORGANIZATION, NOT TWO (small fixes from the on-sale doors walk, call C5).
 *
 * `POST /api/org/create` checks "does this person already belong to a real organization?" and then writes. Two requests
 * that arrive together both read "no", both write, and the person owns two organizations (one of them an empty twin).
 * The slug generator is check-then-insert too, so a different or suffixed address sails through.
 *
 * The fix needs no migration: CLAIM, THEN VERIFY. Each request writes its organization and owner seat, then reads every real
 * organization the person now belongs to. The EARLIEST seat (by the database's own clock, then by id, a total order both
 * requests compute the same way) keeps its organization; any other request removes the one it just made and answers with
 * the winner's address. A request that wrote first and read before the other wrote sees only itself and keeps; the other,
 * reading after it wrote, sees both and, being later, steps aside.
 *
 * ⚠ HONEST LIMIT: the order is the seat's `invited_at` (the database's statement time), not the commit order. Two seats
 * created within the same few milliseconds in the opposite order to their commits can both keep. That needs a stalled
 * request on top of a double submit; the exact fix is a database function holding a per-person lock (a migration), and is
 * recorded as the follow-up in the plan. The pure decision is here so it is tested without a database.
 *
 * Pure part client-safe; the read is server-only (it takes the admin client from its caller's module graph).
 */

/** One real-organization seat, as read for the claim. */
export type RealSeat = {
  organizationId: string;
  /** The seat's `invited_at` — the database's own timestamp. */
  seatAt: string;
  slug: string | null;
  /** The organization's `created_at`. */
  orgCreatedAt: string | null;
};

/** Earlier seat first; the same instant falls to the organization id, so both requests compute the same winner. */
export function compareSeats(a: Pick<RealSeat, 'organizationId' | 'seatAt'>, b: Pick<RealSeat, 'organizationId' | 'seatAt'>): number {
  const ta = Date.parse(a.seatAt);
  const tb = Date.parse(b.seatAt);
  if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
  return a.organizationId < b.organizationId ? -1 : a.organizationId > b.organizationId ? 1 : 0;
}

export type Claim =
  | { keep: true }
  | { keep: false; winner: RealSeat };

/**
 * Does the organization this request just made stay? `seats` is every real organization the person now belongs to,
 * including the one just made. Not finding the own seat in the read (a read that lagged) keeps it: the person is never left
 * with nothing because of a missed read.
 */
export function settleClaim(seats: RealSeat[], madeOrgId: string): Claim {
  const mine = seats.find(s => s.organizationId === madeOrgId);
  if (!mine) return { keep: true };
  const earliest = [...seats].sort(compareSeats)[0];
  return earliest.organizationId === madeOrgId ? { keep: true } : { keep: false, winner: earliest };
}

/**
 * The earlier organization is the SAME start, not an old workspace, when it was made moments ago: the visitor's other tab
 * (or their double submit) won, and answering with its address lands them in the one club they asked for. An older
 * workspace is the ordinary "your account already has a workspace" refusal.
 */
export const SAME_START_WINDOW_MS = 2 * 60_000;

export function isTheSameStart(winner: Pick<RealSeat, 'orgCreatedAt'>, now: Date): boolean {
  const at = winner.orgCreatedAt ? Date.parse(winner.orgCreatedAt) : NaN;
  return Number.isFinite(at) && now.getTime() - at >= 0 && now.getTime() - at <= SAME_START_WINDOW_MS;
}

/** A unique-violation from the database, however the client words it (the address was taken between the check and the insert). */
export function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: unknown; message?: unknown } | null;
  if (!e) return false;
  return e.code === '23505' || (typeof e.message === 'string' && /duplicate key|unique constraint/i.test(e.message));
}
