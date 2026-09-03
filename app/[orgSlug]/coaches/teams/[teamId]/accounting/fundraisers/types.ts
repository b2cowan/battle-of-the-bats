import type { FundraisingKind, SponsorStatus } from '@/lib/coach-fundraising';

/** One row of the Fundraising list, as the fundraisers GET serves it. */
export interface Fundraiser {
  id: string;
  kind: FundraisingKind;
  /** Sponsor only — a drive uses `isActive` for the same job. */
  sponsorStatus: SponsorStatus | null;
  name: string;
  description: string | null;
  playerRebatePercent: number;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  totalRaised: number;
  teamNet: number;
  totalCredits: number;
  playerCount: number;
  /** Sponsor only, and null for a club-wide one — the two muted words the row keeps. */
  broughtInBy: string | null;
  broughtInById: string | null;
  createdAt: string;
  /** Money tags on the RECORD (mig 239). Not drawn on the row — see the row-density ruling —
   *  but carried here so the export can print them without a second read. */
  tagIds: string[];
  /** Arrivals model (mig 268/269) — sponsor only, null/zero on a drive. */
  pledgedAmount: number | null;
  stillToCome: number;
  expectedBy: string | null;
  creditFamilies: { playerId: string; value: number; unit: string; name: string | null }[];
}

/** One logged entry, as the entries route's flat `entries` array serves it (2026-08-31). */
export interface DriveEntryRow {
  id: string;
  playerId: string;
  playerName: string;
  /** False = the player has left the active roster; the entry stays on the board, marked. */
  playerActive: boolean;
  amountRaised: number;
  rebateAmount: number;
  notes: string | null;
  /** What the coach SEES this row dated — the stored date or the org-clock creation day. The
   *  ONLY value an edit may pre-fill (see the entries route's own note). */
  effectiveDate: string;
}

/** One cheque, as the entries route's `sponsorArrivals` serves it (mig 268). */
export interface SponsorArrival {
  entryId: string;
  amount: number;
  receivedDate: string | null;
  method: string | null;
  notes: string | null;
  credited: number;
}

/** One credited family on the sponsor's plan (Q16). */
export interface SponsorPlanRow {
  playerId: string;
  playerName: string | null;
  value: number;
  unit: string;
}

/**
 * THE ROOM'S RAW MATERIAL — the entries GET, read once per open record and re-read on every list
 * reload (a money bump anywhere). One shape for both kinds: a drive fills the first two fields
 * and a sponsor the last three, and the record's `kind` decides which room reads which.
 */
export interface RoomRecord {
  entries: DriveEntryRow[];
  rosterCount: number;
  arrivals: SponsorArrival[];
  plan: SponsorPlanRow[];
  /** How many dollars of each family's accrued credit are already spoken for by cash payouts —
   *  the figure the credit-plan zone warns with BEFORE the payout floor refuses. */
  exposureByFamily: { playerId: string; exposure: number }[];
}
