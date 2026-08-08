/**
 * Billing-retention shapes, split out from lib/billing-retention.ts so the PURE policy pieces
 * (lib/billing-downgrade-order.ts) can import them without dragging in `server-only` and the
 * Supabase client — which is what made the keep-order rule untestable in the first place.
 */
export type BillingTournamentSummary = {
  id: string;
  name: string;
  slug: string;
  status: string;
  year: number | null;
  startDate: string | null;
  endDate: string | null;
};
