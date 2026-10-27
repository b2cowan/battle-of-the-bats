import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { expireCheckout, retrieveCheckout } from './stripe-connect';
import { expireCheckoutSession } from './online-payment-landing';

/**
 * A PAY PAGE LEFT OPEN WHILE THE DESK RECORDS BY HAND (Club Tier Stage 12d-1 Part 2, ask 12; words §2.1).
 *
 * The desk is warned, never blocked: the three drawn screens (Record a payment, Mark paid, Mark received) read the open
 * pages and say so, and EVERY hand-recording path closes them once its own write has landed, so the team or family can't
 * pay twice. A page is marked expired only when Stripe says it expired. One that completed a moment before the close is
 * left alone: its payment lands through the landing, and a team's lands flagged as more than it owed (ask 10), while
 * house league refuses it as `already_received` (12b) — the race in the build prompt.
 *
 * Closing never throws: the hand payment is already recorded, and a page that could not be closed is a page that Stripe
 * expires by itself or the landing catches.
 */

export type OpenPayPage = {
  id: string;
  amountCents: number;
  openedAt: string;
  /** Who opened it, when the record knows: the team's contact, or the family's guardian. */
  openedBy: string | null;
};

type OpenRow = { id: string; stripe_account_id: string; stripe_checkout_session_id: string | null; total_amount: number; created_at: string };
const OPEN_COLS = 'id, stripe_account_id, stripe_checkout_session_id, total_amount, created_at';

async function teamRows(teamIds: readonly string[]): Promise<OpenRow[]> {
  if (!teamIds.length) return [];
  const { data, error } = await supabaseAdmin.from('online_payments').select(OPEN_COLS)
    .eq('flow', 'tournament_team').eq('status', 'open').in('team_id', [...teamIds]);
  if (error) throw error;
  return (data ?? []) as OpenRow[];
}

/** A family's open pages that pay for any of these children (a page can pay for brothers and sisters together). */
async function childRows(registrationIds: readonly string[]): Promise<OpenRow[]> {
  if (!registrationIds.length) return [];
  const { data: items, error } = await supabaseAdmin.from('online_payment_items').select('online_payment_id').in('registration_id', [...registrationIds]);
  if (error) throw error;
  const ids = [...new Set((items ?? []).map(i => i.online_payment_id as string))];
  if (!ids.length) return [];
  const { data, error: opError } = await supabaseAdmin.from('online_payments').select(OPEN_COLS)
    .eq('flow', 'league_signup').eq('status', 'open').in('id', ids);
  if (opError) throw opError;
  return (data ?? []) as OpenRow[];
}

const asPage = (r: OpenRow, openedBy: string | null): OpenPayPage => ({
  id: r.id, amountCents: Math.round(Number(r.total_amount) * 100), openedAt: r.created_at, openedBy,
});

/** A team's open pay pages, for the record's notice (`payOpen.*`), oldest first. A failed read is no notice, never a
 *  broken screen (/review 2026-10-27). */
export async function openTeamPayPages(teamId: string): Promise<OpenPayPage[]> {
  try {
    const [rows, { data: team }] = await Promise.all([
      teamRows([teamId]),
      supabaseAdmin.from('teams').select('coach').eq('id', teamId).maybeSingle(),
    ]);
    const contact = ((team?.coach as string | null) ?? '').trim() || null;
    return rows.sort((a, b) => a.created_at.localeCompare(b.created_at)).map(r => asPage(r, contact));
  } catch (e) {
    console.error('[online-pay-pages] couldn’t read a team’s open pay pages:', teamId, e instanceof Error ? e.message : String(e));
    return [];
  }
}

/** A child's open pay pages, for Mark received's notice, oldest first. A failed read is no notice. */
export async function openChildPayPages(registrationId: string): Promise<OpenPayPage[]> {
  try {
    const [rows, { data: reg }] = await Promise.all([
      childRows([registrationId]),
      supabaseAdmin.from('league_registrations').select('guardian_first_name, guardian_last_name').eq('id', registrationId).maybeSingle(),
    ]);
    const guardian = [reg?.guardian_first_name, reg?.guardian_last_name].filter(Boolean).join(' ').trim() || null;
    return rows.sort((a, b) => a.created_at.localeCompare(b.created_at)).map(r => asPage(r, guardian));
  } catch (e) {
    console.error('[online-pay-pages] couldn’t read a child’s open pay pages:', registrationId, e instanceof Error ? e.message : String(e));
    return [];
  }
}

/** How long the desk's answer waits for Stripe (/review 2026-10-27): the hand payment is already recorded, so a slow
 *  Stripe must never make it look failed (a retry would record it twice). A close still running carries on unwatched. */
const CLOSE_DEADLINE_MS = 8000;

/** Close one page with Stripe, re-read it, and mark it expired only when Stripe says so. True when it closed. */
async function closeOne(r: OpenRow): Promise<boolean> {
  if (!r.stripe_checkout_session_id) return false;
  await expireCheckout(r.stripe_account_id, r.stripe_checkout_session_id);
  const session = await retrieveCheckout(r.stripe_account_id, r.stripe_checkout_session_id);
  // Completed meanwhile: the landing books it (and flags a team's extra). Still open: Stripe expires it by itself.
  if (session.status !== 'expired') return false;
  await expireCheckoutSession(r.stripe_checkout_session_id);
  return true;
}

/** Close the pages together, under one deadline. Returns how many closed in time. */
async function closeRows(rows: OpenRow[], where: string): Promise<number> {
  if (!rows.length) return 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<'late'>(resolve => { timer = setTimeout(() => resolve('late'), CLOSE_DEADLINE_MS); });
  const results = await Promise.all(rows.map(r => Promise.race([
    closeOne(r).catch(e => {
      console.error(`[online-pay-pages] couldn’t close a pay page after ${where}:`, r.id, e instanceof Error ? e.message : String(e));
      return false;
    }),
    late,
  ])));
  clearTimeout(timer);
  if (results.includes('late')) console.error(`[online-pay-pages] Stripe was slow closing a pay page after ${where}; it carries on.`);
  return results.filter(x => x === true).length;
}

/** After a team's payment was recorded by hand (any path): close its open pay pages. Never throws. */
export async function closeTeamPayPages(teamIds: readonly string[], where: string): Promise<number> {
  try {
    return await closeRows(await teamRows(teamIds), where);
  } catch (e) {
    console.error(`[online-pay-pages] couldn’t read the open pay pages after ${where}:`, e instanceof Error ? e.message : String(e));
    return 0;
  }
}

/** After a child's fee was marked received by hand (any path): close the family's open pay pages. Never throws. */
export async function closeChildPayPages(registrationIds: readonly string[], where: string): Promise<number> {
  try {
    return await closeRows(await childRows(registrationIds), where);
  } catch (e) {
    console.error(`[online-pay-pages] couldn’t read the open pay pages after ${where}:`, e instanceof Error ? e.message : String(e));
    return 0;
  }
}

// ── Every ending closes the club's open pages (Club Tier Stage 12d-2, ask 11) ──────────────────────────────────────

async function clubRows(orgId: string): Promise<OpenRow[]> {
  const { data, error } = await supabaseAdmin.from('online_payments').select(OPEN_COLS).eq('org_id', orgId).eq('status', 'open');
  if (error) throw error;
  return (data ?? []) as OpenRow[];
}

/** How many pay pages the club has open right now (the ending windows' count, words §4.1 `disconnect.pages`). */
export async function countClubPayPages(orgId: string): Promise<number> {
  const { count, error } = await supabaseAdmin.from('online_payments').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'open');
  if (error) throw error;
  return count ?? 0;
}

/** An ending (Disconnect, a downgrade on its date, a cancel, a deletion) closes every open pay page of the club. A bank
 *  debit already submitted is no open page (its session completed), so it clears or returns as it would have. Never
 *  throws: a page that could not be closed expires at Stripe within a day, and the landing catches one paid meanwhile. */
export async function closeClubPayPages(orgId: string, where: string): Promise<number> {
  try {
    return await closeRows(await clubRows(orgId), where);
  } catch (e) {
    console.error(`[online-pay-pages] couldn’t read the club’s open pay pages at ${where}:`, e instanceof Error ? e.message : String(e));
    return 0;
  }
}
