import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { getStripe } from './stripe';
import { peopleByIds } from './platform-people-lookup';

/**
 * "Your own club" — the ONE check every staff money or access write uses before it changes a club (Support console
 * Stage 3, owner Q1 2026-10-26; free time adopts it, so does Bulk changes' billing status override). Stage 4's check read
 * club membership only; a staff member can belong to a club in more ways than that. A club is the staff member's when ANY
 * holds:
 *   1. a member of the club, any role or state — or a pending invite to it (the invited email);
 *   2. a coach on one of its teams: rep-team staff (active), or a house-league coach (not removed, by account or email —
 *      the email also catches an invite not yet accepted), or a pending rep-team assistant invite;
 *   3. an owner or billing owner of a Coaches Portal the club pays for (its workspace, or an owner of its portal org);
 *   4. the staff email is the club owner's email or its Stripe customer's email.
 * Read on the server at the moment of writing; never from the browser. Emails compare lowercased. A database error throws
 * (fail closed).
 *
 * The Stripe customer's email (4): a caller that has already read the customer (the refund) passes it in; otherwise ONE
 * Stripe search by the staff email finds the customers that carry it, however many clubs are asked about (Stripe's email
 * filter is exact). A Stripe outage does not refuse a change on its own — every other test still runs, and the owner's
 * email (the usual customer email: checkout creates the customer from the signed-in owner) is checked without Stripe.
 */
export type StaffIdentity = { id: string; email: string };

const STRIPE_READ_MS = 4000;

/** An email as a LIKE pattern that matches only itself, case-blind (`_`, `%` and `\\` taken literally). */
const exactly = (email: string) => email.replace(/[\\%_]/g, c => `\\${c}`);
/** An email as a quoted PostgREST filter value (a comma or a bracket in it can never widen the filter). */
const quoted = (email: string) => `"${email.replace(/["\\]/g, c => `\\${c}`)}"`;

type Rows<T> = PromiseLike<{ data: T[] | null; error: unknown }>;
async function rows<T>(q: Rows<T>): Promise<T[]> {
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

async function stripeCustomersWithEmail(email: string): Promise<Set<string>> {
  try {
    const res = await getStripe().customers.list({ email, limit: 100 }, { timeout: STRIPE_READ_MS, maxNetworkRetries: 0 });
    return new Set(res.data.map(c => c.id));
  } catch (err) {
    console.warn('[staff-own-club] Stripe customers not read; the other checks still ran:', (err as { code?: string }).code ?? 'error');
    return new Set();
  }
}

/** The clubs, of those asked about, that the staff member belongs to in any of the ways above. */
export async function clubsStaffBelongsTo(orgIds: readonly string[], staff: StaffIdentity, opts: { stripeCustomerEmail?: string | null } = {}): Promise<Set<string>> {
  const ids = [...new Set(orgIds)];
  const mine = new Set<string>();
  if (ids.length === 0) return mine;
  const email = staff.email.trim().toLowerCase();
  const add = (list: Array<{ org: string | null }>) => { for (const r of list) if (r.org) mine.add(r.org); };

  const [members, invited, repStaff, leagueCoaches, assistantInvites, portals, owners, orgs] = await Promise.all([
    rows<{ organization_id: string }>(supabaseAdmin.from('organization_members').select('organization_id').in('organization_id', ids).eq('user_id', staff.id)),
    email ? rows<{ organization_id: string }>(supabaseAdmin.from('organization_members').select('organization_id').in('organization_id', ids).ilike('invited_email', exactly(email))) : [],
    rows<{ org_id: string }>(supabaseAdmin.from('rep_team_staff_memberships').select('org_id').in('org_id', ids).eq('user_id', staff.id).eq('status', 'active')),
    rows<{ org_id: string }>(supabaseAdmin.from('league_team_coaches').select('org_id').in('org_id', ids).is('removed_at', null)
      .or(email ? `user_id.eq.${staff.id},email.eq.${quoted(email)}` : `user_id.eq.${staff.id}`)),
    email ? rows<{ org_id: string }>(supabaseAdmin.from('assistant_invite_tokens').select('org_id').in('org_id', ids).ilike('invited_email', exactly(email))
      .in('status', ['pending', 'pending_approval'])) : [],
    rows<{ billing_owner_org_id: string; workspace_org_id: string | null; primary_owner_user_id: string | null; billing_owner_user_id: string | null }>(
      supabaseAdmin.from('team_workspaces').select('billing_owner_org_id, workspace_org_id, primary_owner_user_id, billing_owner_user_id').in('billing_owner_org_id', ids)),
    email ? rows<{ organization_id: string; user_id: string }>(supabaseAdmin.from('organization_members').select('organization_id, user_id').in('organization_id', ids).eq('role', 'owner')) : [],
    email ? rows<{ id: string; stripe_customer_id: string | null }>(supabaseAdmin.from('organizations').select('id, stripe_customer_id').in('id', ids)) : [],
  ]);
  add(members.map(r => ({ org: r.organization_id })));
  add(invited.map(r => ({ org: r.organization_id })));
  add(repStaff.map(r => ({ org: r.org_id })));
  add(leagueCoaches.map(r => ({ org: r.org_id })));
  add(assistantInvites.map(r => ({ org: r.org_id })));
  add(portals.filter(w => w.primary_owner_user_id === staff.id || w.billing_owner_user_id === staff.id).map(w => ({ org: w.billing_owner_org_id })));

  // An owner of a portal one of these clubs pays for.
  const portalOrgs = portals.filter(w => w.workspace_org_id && !mine.has(w.billing_owner_org_id));
  if (portalOrgs.length > 0) {
    const owned = new Set((await rows<{ organization_id: string }>(supabaseAdmin.from('organization_members').select('organization_id')
      .in('organization_id', portalOrgs.map(w => w.workspace_org_id!)).eq('user_id', staff.id).eq('role', 'owner'))).map(r => r.organization_id));
    add(portalOrgs.filter(w => owned.has(w.workspace_org_id!)).map(w => ({ org: w.billing_owner_org_id })));
  }
  if (!email || ids.every(id => mine.has(id))) return mine;

  // The owner's email.
  const left = owners.filter(o => !mine.has(o.organization_id));
  if (left.length > 0) {
    const people = await peopleByIds(left.map(o => o.user_id));
    add(left.filter(o => people.get(o.user_id)?.email?.toLowerCase() === email).map(o => ({ org: o.organization_id })));
  }

  // The Stripe customer's email.
  const withCustomer = orgs.filter(o => o.stripe_customer_id && !o.stripe_customer_id.startsWith('mock_') && !mine.has(o.id));
  if (withCustomer.length > 0) {
    if (opts.stripeCustomerEmail !== undefined) {
      if (opts.stripeCustomerEmail?.trim().toLowerCase() === email) add(withCustomer.map(o => ({ org: o.id })));
    } else {
      const customers = await stripeCustomersWithEmail(email);
      add(withCustomer.filter(o => customers.has(o.stripe_customer_id!)).map(o => ({ org: o.id })));
    }
  }
  return mine;
}

/** One club: true when the staff member belongs to it in any way. */
export async function staffBelongsToClub(orgId: string, staff: StaffIdentity, opts: { stripeCustomerEmail?: string | null } = {}): Promise<boolean> {
  return (await clubsStaffBelongsTo([orgId], staff, opts)).has(orgId);
}
