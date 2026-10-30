import { NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { captureError } from '@/lib/observability/capture';
import { FixedWindowRateLimiter } from '@/lib/rate-limit';
import { findClubs, findPeople, personAuthStatus } from '@/lib/platform-people-lookup';
import { freeTimePortalLabelsAmong } from '@/lib/portal-free-time-server';
import { planLabel, subscriptionStatusLabel } from '@/lib/platform-labels';
import { roleEmailLabel } from '@/lib/member-access';
import { isDemoOrgSlug } from '@/lib/demo-org';
import { getStripe } from '@/lib/stripe';
import { findStripeItem } from '@/lib/console-money-stripe';
import { stripeKeyIsLive } from '@/lib/online-payments-switch';
import { listSentEmails } from '@/lib/sent-log';
import {
  checkFindWords,
  invoiceNumberQuery,
  runFind,
  FIND_FAILED,
  type FindPersonClub,
  type FindReaders,
  type FindStripeRow,
} from '@/lib/platform-find';

/**
 * Find (Support console Stage 2) — `POST /api/platform-admin/find`, body `{ "q": "<words>" }`.
 *
 * ⚖ THE SECURITY SHAPE (drawings "Find security", threats T1–T14; `tests/unit/support-console-find-guard.test.ts`):
 *   • the staff check + power is the FIRST statement: a signed-out caller, a customer session or a disabled staff account
 *     gets 403 and nothing is read (T1);
 *   • the words travel in the BODY, never the address — the error catcher keeps a request's path including anything after
 *     a question mark, so an address would leak them (T6). This handler never reads the URL's search params;
 *   • 2–120 characters or refused; the database escapes its own wildcards and caps each group at 8 rows (T4, T5);
 *   • the answer is built per role from the one rulebook — a group the role may not read is never searched (T2, T9);
 *   • every answer is `Cache-Control: no-store` (T12);
 *   • every failure becomes `FIND_FAILED` before anything records it, so a database error echoing the words never reaches
 *     a log (T6).
 * The per-staff limit below is a SPEED BUMP, said honestly: our hosting runs many copies of the server and each counts on
 * its own. The real bounds are the two-character minimum, the 8-row cap and the trail of records opened.
 */

// About one search a second with a short burst, per staff ACCOUNT (never per network address).
const limiter = new FixedWindowRateLimiter(10_000, 15);

const NO_STORE = { 'Cache-Control': 'no-store' };
const TOO_SHORT = 'Type two characters or more.';

/** The organization columns a Stripe match reads, from any of its three sources. */
type OrgCols = { id: string; name: string; slug: string; plan_id: string | null };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

const readers: FindReaders = {
  async clubs(words) {
    const found = await findClubs(words);
    // A portal staff gave free time is stored cancelled for its whole life: its label says what is true, as the Clubs list
    // does. A failed read says "Status unread" for a stored-cancelled row, never "Cancelled".
    let portalLabels = new Map<string, string>();
    let portalUnread = false;
    try {
      portalLabels = await freeTimePortalLabelsAmong(found.rows.filter(c => c.subscriptionStatus === 'canceled').map(c => c.id));
    } catch {
      portalUnread = true;
    }
    return {
      total: found.total,
      rows: found.rows.map(c => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        planLabel: planLabel(c.planId ?? 'tournament'),
        statusLabel: portalLabels.get(c.id)
          ?? (portalUnread && c.subscriptionStatus === 'canceled' ? 'Status unread' : subscriptionStatusLabel(c.subscriptionStatus ?? 'active')),
        ownerEmail: c.ownerEmail,
      })),
    };
  },
  async people(words) {
    const found = await findPeople(words);
    return {
      total: found.total,
      rows: found.rows.map(p => ({
        id: p.id,
        email: p.email,
        name: p.displayName,
        lastSignInAt: p.lastSignInAt,
        banned: personAuthStatus(p) === 'banned',
      })),
    };
  },
  async personClubs(personIds) {
    const { data, error } = await supabaseAdmin
      .from('organization_members')
      .select('user_id, role, organizations(id, name, slug)')
      .in('user_id', personIds)
      .limit(200);
    if (error) throw new Error(FIND_FAILED);
    const out = new Map<string, FindPersonClub[]>();
    for (const row of (data ?? []) as unknown as Array<{
      user_id: string; role: string; organizations: { id: string; name: string; slug: string } | null;
    }>) {
      const org = row.organizations;
      if (!org || isDemoOrgSlug(org.slug)) continue;
      const list = out.get(row.user_id) ?? [];
      list.push({ id: org.id, name: org.name, role: roleEmailLabel(row.role) });
      out.set(row.user_id, list);
    }
    return out;
  },
  async stripe(number, kind) {
    const rows: FindStripeRow[] = [];
    const seen = new Set<string>();
    // One gate for all three sources: a demo sandbox never shows, and a club found twice shows once.
    const add = (org: OrgCols | null, k: FindStripeRow['kind'], extra: Partial<FindStripeRow> = {}) => {
      if (!org || seen.has(org.id) || isDemoOrgSlug(org.slug)) return;
      seen.add(org.id);
      rows.push({ orgId: org.id, orgName: org.name, planLabel: planLabel(org.plan_id ?? 'tournament'), number, kind: k, ...extra });
    };
    const orgCols = 'id, name, slug, plan_id';
    if (kind === 'customer' || kind === 'subscription') {
      const column = kind === 'customer' ? 'stripe_customer_id' : 'stripe_subscription_id';
      const [orgs, workspaces] = await Promise.all([
        supabaseAdmin.from('organizations').select(orgCols).eq(column, number).limit(8),
        supabaseAdmin.from('team_workspaces').select(`workspace_org_id, organizations:workspace_org_id(${orgCols})`).eq(column, number).limit(8),
      ]);
      if (orgs.error || workspaces.error) throw new Error(FIND_FAILED);
      for (const org of (orgs.data ?? []) as OrgCols[]) add(org, kind);
      for (const w of (workspaces.data ?? []) as unknown as Array<{ organizations: OrgCols | null }>) {
        add(w.organizations, kind);
      }
    } else if (kind === 'payment' && !number.startsWith('py_')) {
      const column = number.startsWith('ch_') ? 'stripe_charge_id' : 'stripe_payment_intent_id';
      const { data, error } = await supabaseAdmin
        .from('online_payments')
        .select(`org_id, organizations:org_id(${orgCols})`)
        .eq(column, number)
        .limit(8);
      if (error) throw new Error(FIND_FAILED);
      for (const p of (data ?? []) as unknown as Array<{ organizations: OrgCols | null }>) {
        add(p.organizations, 'payment');
      }
    }
    // Not a family payment: a club's own subscription charge, payment or invoice (Stage 3, owner Q5). ONE exact read of
    // that item on our own Stripe account, then its club by its customer — exactly one club, in this site's mode. "Not
    // found" and "found but not ours" read the same. The number's shape was checked before this (stripeNumberKind).
    if (rows.length === 0 && (kind === 'payment' || kind === 'invoice' || kind === 'invoice_number')) {
      // Stripe unreachable must not cost the person the clubs and people they also searched for (an invoice's printed
      // number looks like "U12-2026"): the Stripe group is then simply empty. Nothing is logged on Find's path (A3).
      const item = await findStripeItem(getStripe(), number, kind, kind === 'invoice_number' ? invoiceNumberQuery(number) : null)
        .catch(() => null);
      if (item && item.livemode === stripeKeyIsLive()) {
        const [orgsRes, portalsRes] = await Promise.all([
          supabaseAdmin.from('organizations').select(orgCols).eq('stripe_customer_id', item.customerId).limit(2),
          supabaseAdmin.from('team_workspaces').select('billing_owner_org_id').eq('stripe_customer_id', item.customerId),
        ]);
        if (orgsRes.error || portalsRes.error) throw new Error(FIND_FAILED);
        const orgs = (orgsRes.data ?? []) as OrgCols[];
        // Exactly one club, or none: a customer two clubs share (or a portal another club pays for) is never shown as either's.
        const shared = ((portalsRes.data ?? []) as Array<{ billing_owner_org_id: string | null }>).some(w => w.billing_owner_org_id !== orgs[0]?.id);
        add(orgs.length === 1 && !shared ? orgs[0] : null, kind === 'payment' ? 'charge' : 'invoice', {
          number: kind === 'invoice_number' ? number.toUpperCase() : number,
          amountCents: item.amountCents, currency: item.currency, at: item.at, chargeId: item.chargeId,
        });
      }
    }
    return rows;
  },
  async sentEmails(address, role) {
    // The reader applies the role itself: an email to a staff address reads for Super admin only (T15).
    const found = await listSentEmails(role, { to: address, limit: 8 });
    return {
      total: found.total,
      rows: found.rows.map(e => ({ id: e.id, label: e.label, to: e.to, orgName: e.orgName, sentAt: e.sentAt, state: e.state })),
    };
  },
};

export const POST = withObservability(async (req: Request) => {
  const auth = await requirePlatformPower('view_console');
  if (auth.response) return json({ error: 'Forbidden' }, auth.response.status);

  if (!limiter.take(auth.user.id)) {
    return json({ error: 'Too many searches at once. Wait a moment and try again.' }, 429);
  }

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: TOO_SHORT }, 400);
    }
    const verdict = checkFindWords((body as { q?: unknown } | null)?.q);
    if (!verdict.ok) {
      return json({ error: verdict.reason === 'too_long' ? 'Find takes up to 120 characters.' : TOO_SHORT }, 400);
    }
    const answer = await runFind(auth.role, verdict.words, readers);
    return json(answer);
  } catch {
    // Never the caught error itself: a database error can echo what was typed (T6). One fixed sentence, recorded as such.
    await captureError(new Error(FIND_FAILED), { route: '/api/platform-admin/find', method: 'POST' });
    return json({ error: FIND_FAILED }, 500);
  }
}, { route: '/api/platform-admin/find' });
