/**
 * A MONEY ROUTE'S ANSWER, READ ONCE — both portals (moved here 2026-10-02, Ledger Parity session 2's
 * /simplify). The club's money screens (`components/admin/kit/club/money/MoneyKit.tsx`, which re-exports
 * these) and the coach's Payees page read a route's status and body the same way; the admin kit is
 * admin-only by rule, so the three helpers live where both may import them. Pure and client-safe.
 */

/** A money route's answer, read once: the status, and the body whatever it is. */
export async function moneyFetch<T = Record<string, unknown>>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(url, { cache: 'no-store', ...init });
  const data = await res.json().catch(() => ({})) as T;
  return { ok: res.ok, status: res.status, data };
}

/** JSON body helper for a PATCH / POST. */
export const jsonInit = (method: 'POST' | 'PATCH' | 'DELETE', body: unknown): RequestInit => ({
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

/**
 * A refused money move, in words: the server's sentence (every 409 `money_state_changed` carries one,
 * from lib/club-money-words.ts), or the fallback. A stale tap is refused in words and the screen
 * re-reads in place (specimen 7's rule, both sides).
 */
export function refusalText(data: unknown, fallback: string): string {
  const e = (data as { error?: unknown })?.error;
  return typeof e === 'string' && e.trim() ? e : fallback;
}
