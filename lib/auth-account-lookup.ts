import { supabaseAdmin } from './supabase-admin';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * "DOES AN AUTH ACCOUNT ALREADY EXIST FOR THIS EMAIL?" — the platform's ONE answer.
 *
 * This existed in three places before it lived here, in two different strengths, and the weak
 * form was the older one: a single `listUsers({ perPage: 1000 })` page, which reports **false**
 * for any account past row 1000 without erroring. That is the wrong direction for every caller —
 * a signup guard reads it as "safe to create" (clobbering a real pending account) and a
 * "welcome back" screen reads it as "new coach" (sending a returning one through a redundant
 * create-account form). The paginating form below is the correct-at-any-scale version and is now
 * the only one; do not reintroduce a local single-page copy.
 *
 * ⚠ **IT FAILS CLOSED — it THROWS rather than returning false on a listUsers error**, because a
 * swallowed error is indistinguishable from "no such account" and that is the dangerous answer
 * for a credential guard. Callers that would rather degrade than 500 (a preview screen deciding
 * which form to show) catch it themselves and fall back to the create-account path — that
 * decision belongs at the call site, where the cost of being wrong is known.
 *
 * (supabase-js v2.x has no `admin.getUserByEmail`; the exhaustive scan is the platform pattern.)
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
export async function authAccountExistsForEmail(email: string): Promise<boolean> {
  const target = (email ?? '').trim().toLowerCase();
  if (!target) return false;
  const perPage = 1000;
  // Hard page ceiling so a pathological account count can't spin forever: 50 x 1000 = 50k auth
  // users, far beyond current scale, and the loop exits on the first partial page anyway.
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users ?? [];
    if (users.some(u => u.email?.trim().toLowerCase() === target)) return true;
    if (users.length < perPage) return false; // last page reached — no match
  }
  return false;
}
