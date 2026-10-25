import { NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { captureError } from '@/lib/observability/capture';
import { FixedWindowRateLimiter } from '@/lib/rate-limit';
import { findClubs, findPeople, personAuthStatus } from '@/lib/platform-people-lookup';
import { planLabel } from '@/lib/platform-metrics';
import { subscriptionStatusLabel, humanize } from '@/lib/platform-labels';
import { DEMO_ORG_SLUGS, isDemoOrgSlug } from '@/lib/demo-org';
import {
  checkFindWords,
  runFind,
  FIND_FAILED,
  type FindPersonClub,
  type FindReaders,
  type FindStripeKind,
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

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

const readers: FindReaders = {
  async clubs(words) {
    const found = await findClubs(words);
    return {
      total: found.total,
      rows: found.rows.map(c => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        planLabel: planLabel(c.planId ?? 'tournament'),
        statusLabel: subscriptionStatusLabel(c.subscriptionStatus ?? 'active'),
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
      list.push({ id: org.id, name: org.name, role: humanize(row.role).toLowerCase() });
      out.set(row.user_id, list);
    }
    return out;
  },
  async stripe(number, kind) {
    const rows: FindStripeRow[] = [];
    const seen = new Set<string>();
    const add = (org: { id: string; name: string; slug: string; plan_id: string | null } | null, k: FindStripeKind) => {
      if (!org || seen.has(org.id) || isDemoOrgSlug(org.slug)) return;
      seen.add(org.id);
      rows.push({ orgId: org.id, orgName: org.name, planLabel: planLabel(org.plan_id ?? 'tournament'), number, kind: k });
    };
    const orgCols = 'id, name, slug, plan_id';
    if (kind === 'customer' || kind === 'subscription') {
      const column = kind === 'customer' ? 'stripe_customer_id' : 'stripe_subscription_id';
      const [orgs, workspaces] = await Promise.all([
        supabaseAdmin.from('organizations').select(orgCols).eq(column, number).not('slug', 'in', `(${DEMO_ORG_SLUGS.join(',')})`).limit(8),
        supabaseAdmin.from('team_workspaces').select(`workspace_org_id, organizations:workspace_org_id(${orgCols})`).eq(column, number).limit(8),
      ]);
      if (orgs.error || workspaces.error) throw new Error(FIND_FAILED);
      for (const org of orgs.data ?? []) add(org as { id: string; name: string; slug: string; plan_id: string | null }, kind);
      for (const w of (workspaces.data ?? []) as unknown as Array<{ organizations: { id: string; name: string; slug: string; plan_id: string | null } | null }>) {
        add(w.organizations, kind);
      }
    } else {
      const column = number.startsWith('ch_') ? 'stripe_charge_id' : 'stripe_payment_intent_id';
      const { data, error } = await supabaseAdmin
        .from('online_payments')
        .select(`org_id, organizations:org_id(${orgCols})`)
        .eq(column, number)
        .limit(8);
      if (error) throw new Error(FIND_FAILED);
      for (const p of (data ?? []) as unknown as Array<{ organizations: { id: string; name: string; slug: string; plan_id: string | null } | null }>) {
        add(p.organizations, 'payment');
      }
    }
    return rows;
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
      return json({ error: 'Type two characters or more.' }, 400);
    }
    const verdict = checkFindWords((body as { q?: unknown } | null)?.q);
    if (!verdict.ok) {
      return json({ error: verdict.reason === 'too_long' ? 'Find takes up to 120 characters.' : 'Type two characters or more.' }, 400);
    }
    const answer = await runFind(auth.role, verdict.words, readers);
    return json(answer);
  } catch {
    // Never the caught error itself: a database error can echo what was typed (T6). One fixed sentence, recorded as such.
    await captureError(new Error(FIND_FAILED), { route: '/api/platform-admin/find', method: 'POST' });
    return json({ error: FIND_FAILED }, 500);
  }
}, { route: '/api/platform-admin/find' });
