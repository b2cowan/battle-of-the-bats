/**
 * The families' CURRENT payment schedules, as the arrangement picker reads them (Sponsorship
 * Applies To, owner rulings D1–D8, 2026-09-21) — the client half of GET dues/schedules.
 *
 * ⚠ ONE fetch-and-parse for the two doors that draw the picker: the pledge branch of Record money
 * and the sponsor's room. Each keeps its OWN staleness guard (the conversation's generation
 * counter; the room's live flag) because those are the panels' conventions — but the URL and the
 * shape of the answer live here, so the two cannot drift about what a family's schedule is.
 */
import { normalizeCreditApplicationMode, type CreditApplicationMode } from './dues-credits';

/** One family's current payment schedule, as the picker draws it. */
export interface FamilyPaymentScheduleLite {
  installments: { n: number; dueDate: string; amount: number }[];
  /** When the schedule was last (re-)run — the newest installment's creation time. */
  lastRunAt: string | null;
}

export interface FamilyPaymentSchedules {
  /** playerId → schedule. A family absent from the map has no schedule (D6). */
  schedules: Map<string, FamilyPaymentScheduleLite>;
  /** The team's setting, for the arrangement line's wording. */
  creditMode: CreditApplicationMode;
}

/** Throws on a non-OK response so a caller's guard can decide what a failed read means. */
export async function fetchFamilyPaymentSchedules(orgSlug: string, teamId: string): Promise<FamilyPaymentSchedules> {
  const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/dues/schedules`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Could not load the payment schedules');
  const families = (data.families ?? []) as Array<{ playerId: string; installments: FamilyPaymentScheduleLite['installments']; lastRunAt: string | null }>;
  return {
    schedules: new Map(families.map(f => [f.playerId, { installments: f.installments, lastRunAt: f.lastRunAt }])),
    creditMode: normalizeCreditApplicationMode(data.creditApplication),
  };
}
