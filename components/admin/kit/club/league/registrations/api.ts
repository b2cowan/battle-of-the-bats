/**
 * THE REGISTRATIONS SCREEN'S WRITES (Club Tier Stage 9b-2, Part 3): one PATCH on one registration, read once. Every
 * press on this screen — a status, a money move, a division — goes through here, so a refusal is always the server's
 * sentence and its code, and a failure to reach the server is the one "That didn’t go through" line.
 *
 * `orgQuery` is the page's "?orgSlug=…" carrier (the org-slug caller check reads that name).
 */
import { jsonInit, moneyFetch, refusalText } from '@/components/admin/kit/club/money/MoneyKit';
import { MONEY_REFUSAL } from '@/lib/house-league-money-words';
import type { Refusal } from '@/lib/house-league-registrations';
import type { LeagueRegistration } from '@/lib/types';

export interface PatchedOk {
  ok: true;
  registration: LeagueRegistration;
  /** The waitlist moved up: the child who took the spot. */
  promoted?: LeagueRegistration;
  /** A move that kept a paid child's price. */
  keptPrice?: boolean;
}
export type Patched = PatchedOk | ({ ok: false } & Refusal);

export async function patchRegistration(orgQuery: string, seasonId: string, regId: string, body: object): Promise<Patched> {
  try {
    const r = await moneyFetch<{ registration?: LeagueRegistration; promoted?: LeagueRegistration; keptPrice?: boolean; code?: string }>(
      `/api/admin/house-league/seasons/${seasonId}/registrations/${regId}${orgQuery}`,
      jsonInit('PATCH', body),
    );
    if (r.ok && r.data.registration) return { ok: true, registration: r.data.registration, promoted: r.data.promoted, keptPrice: r.data.keptPrice };
    return { ok: false, status: r.status, code: r.data.code ?? null, error: refusalText(r.data, MONEY_REFUSAL.failed) };
  } catch {
    return { ok: false, status: 0, code: null, error: MONEY_REFUSAL.failed };
  }
}

/** A POST read once: the route's answer, or the server's sentence (else `failed`) — it never throws. */
export type Posted<T> = { ok: true; data: T } | { ok: false; error: string };

export async function postJson<T = Record<string, unknown>>(url: string, body: unknown, failed: string = MONEY_REFUSAL.failed): Promise<Posted<T>> {
  try {
    const r = await moneyFetch<T>(url, jsonInit('POST', body));
    return r.ok ? { ok: true, data: r.data } : { ok: false, error: refusalText(r.data, failed) };
  } catch {
    return { ok: false, error: failed };
  }
}

/** A closed fiscal year refused the press (the whole batch stops: every line is dated the same). */
export const isClosedYear = (p: Patched) => !p.ok && p.code === 'year_closed';

/** The screen's one shared context: who is looking, at which season, with which rights. Passed to every window. */
export interface RegsContext {
  orgQuery: string;
  seasonId: string;
}
