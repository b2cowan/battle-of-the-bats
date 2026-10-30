/**
 * THE LEAD BOOK — the reads behind `lib/lead-numbers.ts` (Support console Stage 7 Part 2). Every lead, its newest note
 * and follow-up change, who pays, the new accounts, and the offered matches. Server only; every caller has asked the
 * growth power first (Leads, Numbers, Today's growth rows). Business numbers reads the counts, never a lead.
 *
 * ⚠ Every read is checked. A failed read returns `not_read` (the screen says "Not read"), never an empty list that would
 * print as 0. The book reads in pages of 1,000, so it holds every lead, not the newest 5,000.
 */
import { supabaseAdmin } from './supabase-admin';
import { isDemoOrgId } from './demo-org-server';
import { getBootstrapAdminEmails } from './platform-auth';
import { effectiveOrgFactsById } from './entitlement-grants';
import { freeTimePortalOrgIds } from './portal-free-time-server';
import { paysNow } from './plan-growth';
import { isEarlyAccessStatus, type EarlyAccessStatus } from './early-access-admin';
import { sourceFromHeard } from './lead-form-answers';
import { isSignedUp, normalAddress, PAYING_RECORDED_FROM, selfConfirmed, type AccountsRead, type LeadFacts, type PayRead } from './lead-numbers';

const PAGE = 1000;

export type BookLead = LeadFacts & {
  name: string;
  email: string;
  organizationName: string | null;
  role: string | null;
  features: string[];
  nextAction: string | null;
  consent: boolean;
  lostReason: string | null;
  /** When the lead asked not to be contacted; it outlives the step (mig 404). */
  doNotContactAt: string | null;
  heardFrom: string | null;
  sourceWords: string | null;
  orgName: string | null;
  sports: string | null;
  lastContactedAt: string | null;
  words: string | null;
  /** `source` is the visitor's own answer mapped to the list, because staff set none. The export says so. */
  sourceFromForm: boolean;
};

export type Read<T> = { kind: 'read'; value: T } | { kind: 'not_read' };

const LEAD_COLUMNS = [
  'id', 'created_at', 'internal_status', 'linked_at', 'signed_up_at', 'converted_org_id', 'link_method', 'plan_interest',
  'features_interested', 'source_path', 'source', 'source_words', 'ref_tag', 'heard_from', 'follow_up_due_at',
  'step_changed_at', 'name', 'email', 'organization_name', 'role', 'next_action', 'release_notifications_consent',
  // The link by name: "Not this club" (early_access_lead_dismissed_offers) is a second path to organizations, so a bare
  // `organizations(name)` is ambiguous and the read fails (PGRST201).
  'lost_reason', 'do_not_contact_at', 'sports', 'last_contacted_at', 'notes', 'organizations!early_access_leads_converted_org_id_fkey(name)',
].join(', ');

type LeadRow = {
  id: string; created_at: string; internal_status: string; linked_at: string | null; signed_up_at: string | null;
  converted_org_id: string | null; link_method: 'offered' | 'by_hand' | null; plan_interest: string[] | null;
  features_interested: string[] | null; source_path: string | null; source: string | null; source_words: string | null;
  ref_tag: string | null; heard_from: string | null; follow_up_due_at: string | null; step_changed_at: string;
  name: string; email: string; organization_name: string | null; role: string | null; next_action: string | null;
  release_notifications_consent: boolean; lost_reason: string | null; do_not_contact_at: string | null; sports: string | null; last_contacted_at: string | null; notes: string | null;
  organizations: { name: string } | { name: string }[] | null;
};

async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[] | null> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error || !Array.isArray(data)) return null;
    out.push(...(data as T[]));
    if (data.length < PAGE) return out;
  }
}

function newer(map: Map<string, string>, key: string, at: string) {
  const had = map.get(key);
  if (!had || at > had) map.set(key, at);
}

/** Did this edit-log entry set or move the follow-up? A Stage 7 entry names the field; an older one holds both rows. */
function movedFollowUp(oldValue: unknown, newValue: unknown): boolean {
  const n = (newValue ?? {}) as Record<string, unknown>;
  if (Array.isArray(n.changed)) return n.changed.includes('follow_up_due_at');
  const o = (oldValue ?? {}) as Record<string, unknown>;
  return 'follow_up_due_at' in n && (o.follow_up_due_at ?? null) !== (n.follow_up_due_at ?? null);
}

/** Every lead, with the dated facts the one definition needs. */
export async function readLeadBook(): Promise<Read<BookLead[]>> {
  const rows = await readAll<LeadRow>((from, to) => supabaseAdmin.from('early_access_leads').select(LEAD_COLUMNS)
    .order('created_at', { ascending: false }).order('id').range(from, to));
  if (!rows) return { kind: 'not_read' };

  const notes = await readAll<{ lead_id: string; created_at: string }>((from, to) => supabaseAdmin
    .from('early_access_lead_notes').select('lead_id, created_at').order('created_at').order('id').range(from, to));
  const edits = await readAll<{ field: string | null; created_at: string; old_value: unknown; new_value: unknown }>((from, to) => supabaseAdmin
    .from('platform_audit_log').select('field, created_at, old_value, new_value').eq('action', 'update_early_access_lead')
    .order('created_at').order('id').range(from, to));
  if (!notes || !edits) return { kind: 'not_read' };

  const lastNote = new Map<string, string>();
  for (const n of notes) newer(lastNote, n.lead_id, n.created_at);
  const lastFollowUp = new Map<string, string>();
  for (const e of edits) if (e.field && movedFollowUp(e.old_value, e.new_value)) newer(lastFollowUp, e.field, e.created_at);

  // A demo club is never a sign-up; the check throws when it cannot tell, and then nothing is counted.
  const demo = new Set<string>();
  try {
    for (const id of new Set(rows.map(r => r.converted_org_id).filter((x): x is string => !!x))) {
      if (await isDemoOrgId(id)) demo.add(id);
    }
  } catch {
    return { kind: 'not_read' };
  }

  return {
    kind: 'read',
    value: rows.filter(r => isEarlyAccessStatus(r.internal_status)).map(r => {
      const org = Array.isArray(r.organizations) ? r.organizations[0] : r.organizations;
      return {
        id: r.id,
        createdAt: r.created_at,
        step: r.internal_status as EarlyAccessStatus,
        linkedAt: r.linked_at,
        signedUpAt: r.signed_up_at,
        orgId: r.converted_org_id,
        linkMethod: r.link_method,
        plans: r.plan_interest ?? [],
        sourcePath: r.source_path,
        // Staff's choice, else the visitor's own answer mapped to the same list (drawing J, question 13 A). A staff source
        // is never overwritten by the form; the page still shows what the visitor said beside it.
        source: r.source ?? sourceFromHeard(r.heard_from),
        sourceFromForm: !r.source && !!sourceFromHeard(r.heard_from),
        refTag: r.ref_tag,
        followUpDueAt: r.follow_up_due_at,
        stepChangedAt: r.step_changed_at,
        lastNoteAt: lastNote.get(r.id) ?? null,
        lastFollowUpSetAt: lastFollowUp.get(r.id) ?? null,
        demo: !!r.converted_org_id && demo.has(r.converted_org_id),
        name: r.name,
        email: r.email,
        organizationName: r.organization_name,
        role: r.role,
        features: r.features_interested ?? [],
        nextAction: r.next_action,
        consent: r.release_notifications_consent,
        lostReason: r.lost_reason,
        doNotContactAt: r.do_not_contact_at,
        heardFrom: r.heard_from,
        sourceWords: r.source_words,
        orgName: org?.name ?? null,
        sports: r.sports,
        lastContactedAt: r.last_contacted_at,
        words: r.notes,
      };
    }),
  };
}

type OrgBilling = { id: string; plan_id: string | null; subscription_status: string | null; stripe_subscription_id: string | null; account_kind: string | null };
type Workspace = { workspace_org_id: string; billing_mode: string | null; billing_owner_org_id: string | null; subscription_status: string | null; stripe_subscription_id: string | null };

/**
 * Which of these clubs pay today (`paysNow`). A Coaches Portal pays on its own subscription when it bills directly, and
 * counts with the club that pays for it otherwise — never as a second club. A Founding comp portal (`platform_override`)
 * does not pay.
 */
export async function readPaying(orgIds: string[], opts: { started?: boolean } = {}): Promise<PayRead> {
  const ids = [...new Set(orgIds.filter(Boolean))];
  if (ids.length === 0) return { kind: 'read', paying: new Set(), ...(opts.started ? { started: new Set<string>() } : {}) };
  try {
    // Numbers' Month by month: which of these clubs began a subscription of their own since starts were recorded.
    let started: Set<string> | undefined;
    if (opts.started) {
      const startedIds = new Set<string>();
      for (let i = 0; i < ids.length; i += 100) {
        const { data, error: evError } = await supabaseAdmin.from('platform_events').select('org_id')
          .eq('event_type', 'subscription_started').gte('occurred_at', `${PAYING_RECORDED_FROM}T00:00:00-04:00`).in('org_id', ids.slice(i, i + 100));
        if (evError) return { kind: 'not_read' };
        for (const r of (data ?? []) as { org_id: string | null }[]) if (r.org_id) startedIds.add(r.org_id);
      }
      started = startedIds;
    }
    const { data: ws, error: wsError } = await supabaseAdmin.from('team_workspaces')
      .select('workspace_org_id, billing_mode, billing_owner_org_id, subscription_status, stripe_subscription_id').in('workspace_org_id', ids);
    if (wsError) return { kind: 'not_read' };
    const workspaces = new Map(((ws ?? []) as Workspace[]).map(w => [w.workspace_org_id, w]));
    const owners = [...workspaces.values()].map(w => w.billing_owner_org_id).filter((x): x is string => !!x);
    const all = [...new Set([...ids, ...owners])];
    const { data: orgs, error } = await supabaseAdmin.from('organizations')
      .select('id, plan_id, subscription_status, stripe_subscription_id, account_kind').in('id', all);
    if (error) return { kind: 'not_read' };
    const facts = await effectiveOrgFactsById(all);
    const byId = new Map(((orgs ?? []) as OrgBilling[]).map(o => [o.id, o]));
    const orgPays = (id: string) => {
      const o = byId.get(id);
      if (!o) return false;
      return paysNow({ ownPlanId: o.plan_id, status: o.subscription_status, subscriptionId: o.stripe_subscription_id, onFreeTime: !!facts.get(id)?.freeTime });
    };
    const paying = new Set<string>();
    for (const id of ids) {
      const w = workspaces.get(id);
      if (!w) { if (orgPays(id)) paying.add(id); continue; }
      if (w.billing_mode === 'team_direct') {
        if (paysNow({ ownPlanId: 'team', status: w.subscription_status, subscriptionId: w.stripe_subscription_id, onFreeTime: !!facts.get(id)?.freeTime })) paying.add(id);
      } else if (w.billing_mode !== 'platform_override' && w.billing_owner_org_id && orgPays(w.billing_owner_org_id)) {
        paying.add(id);
      }
    }
    return { kind: 'read', paying, ...(started ? { started } : {}) };
  } catch {
    return { kind: 'not_read' };
  }
}

/** Every club and portal ever created, demo clubs and portals staff gave free time left out (New accounts; Stage 4b, T35). */
export async function readAccounts(): Promise<AccountsRead> {
  const rows = await readAll<{ id: string; created_at: string }>((from, to) => supabaseAdmin.from('organizations')
    .select('id, created_at').order('created_at').order('id').range(from, to));
  if (!rows) return { kind: 'not_read' };
  try {
    const freeTimePortals = await freeTimePortalOrgIds();
    const out: { id: string; createdAt: string }[] = [];
    for (const r of rows) if (!freeTimePortals.has(r.id) && !(await isDemoOrgId(r.id))) out.push({ id: r.id, createdAt: r.created_at });
    return { kind: 'read', created: out };
  } catch {
    return { kind: 'not_read' };
  }
}

export type LeadSummary = { leads: number; signedUp: number; rate: number | null; payNow: number | null; unanswered: number };

/**
 * Business numbers' "Leads and conversion" card (drawing F): the one definition's all-time band, as counts only. Any
 * role reads it; none of it names a lead.
 */
export async function readLeadSummary(): Promise<Read<LeadSummary>> {
  const book = await readLeadBook();
  if (book.kind === 'not_read') return book;
  const signed = book.value.filter(isSignedUp);
  const pay = await readPaying(signed.map(l => l.orgId).filter((x): x is string => !!x));
  return {
    kind: 'read',
    value: {
      leads: book.value.length,
      signedUp: signed.length,
      rate: book.value.length ? Math.round((signed.length / book.value.length) * 100) : null,
      payNow: pay.kind === 'read' ? signed.filter(l => l.orgId && pay.paying.has(l.orgId)).length : null,
      unanswered: book.value.filter(l => l.step === 'new').length,
    },
  };
}

// ── The offered match (owner Q2 + the build gate's "best signal, safe side", 2026-10-27) ─────────────────────────

export type OfferedClub = { orgId: string; name: string; planId: string | null; status: string | null; createdAt: string; ownerEmail: string };

type AccountDates = { user_id: string; email: string; created_at: string; confirmation_sent_at: string | null; email_confirmed_at: string | null; last_sign_in_at: string | null };

/**
 * Every staff address: the bootstrap list and every platform_users row, active or not (a former staff address is still
 * ours). Throws when the list cannot be read — every caller treats that as "cannot tell", never "no staff".
 */
export async function readStaffAddresses(): Promise<Set<string>> {
  const { data, error } = await supabaseAdmin.from('platform_users').select('email');
  if (error) throw error;
  return new Set([...getBootstrapAdminEmails(), ...((data ?? []) as { email: string }[]).map(s => normalAddress(s.email))]);
}

/**
 * The clubs offered for each lead. Computed only when the growth power opens Leads, a lead or Today — never in the public
 * form. ⚠ It REFUSES (returns not_read, so nothing is offered) whenever a check it needs cannot be read: the staff list,
 * the console's confirm entries, the memberships, or the demo check.
 */
export async function readOffers(leads: { id: string; email: string; step: EarlyAccessStatus; linkedAt: string | null }[]): Promise<Read<Map<string, OfferedClub[]>>> {
  const open = leads.filter(l => !l.linkedAt && l.step !== 'lost' && l.step !== 'converted');
  const out = new Map<string, OfferedClub[]>();
  if (open.length === 0) return { kind: 'read', value: out };
  try {
    const addresses = [...new Set(open.map(l => normalAddress(l.email)).filter(Boolean))];
    const accounts: AccountDates[] = [];
    for (let i = 0; i < addresses.length; i += 200) {
      const { data, error } = await supabaseAdmin.rpc('platform_lead_account_dates', { p_emails: addresses.slice(i, i + 200) });
      if (error) return { kind: 'not_read' };
      accounts.push(...((data ?? []) as AccountDates[]));
    }
    if (accounts.length === 0) return { kind: 'read', value: out };

    // Staff: the bootstrap list and every platform_users row, active or not (a former staff address is still ours).
    const staff = await readStaffAddresses();

    // An address staff confirmed or changed in the console is not the person's own confirmation.
    const userIds = accounts.map(a => a.user_id);
    const { data: touched, error: touchedError } = await supabaseAdmin.from('platform_audit_log').select('new_value')
      .in('action', ['confirm_email', 'update_user']).in('new_value->>userId', userIds);
    if (touchedError) return { kind: 'not_read' };
    const staffTouched = new Set(((touched ?? []) as { new_value: { userId?: string } | null }[]).map(t => t.new_value?.userId).filter(Boolean));

    const eligible = accounts.filter(a => !staff.has(normalAddress(a.email)) && !staffTouched.has(a.user_id) && selfConfirmed(a));
    if (eligible.length === 0) return { kind: 'read', value: out };

    // An owner or admin who has joined: never an invited coach or volunteer, never a pending invite.
    const { data: members, error: memberError } = await supabaseAdmin.from('organization_members')
      .select('user_id, organization_id, role, status, accepted_at, organizations(id, name, plan_id, subscription_status, created_at)')
      .in('user_id', eligible.map(a => a.user_id)).in('role', ['owner', 'admin']).eq('status', 'active').not('accepted_at', 'is', null);
    if (memberError) return { kind: 'not_read' };
    type Member = { user_id: string; organization_id: string; organizations: { id: string; name: string; plan_id: string | null; subscription_status: string | null; created_at: string } | { id: string; name: string; plan_id: string | null; subscription_status: string | null; created_at: string }[] | null };
    const memberRows = (members ?? []) as Member[];
    const orgIds = [...new Set(memberRows.map(m => m.organization_id))];

    // A club a staff address owns is a test club, never offered.
    const { data: owners, error: ownerError } = orgIds.length
      ? await supabaseAdmin.from('organization_members').select('organization_id, user_id').in('organization_id', orgIds).eq('role', 'owner')
      : { data: [], error: null };
    if (ownerError) return { kind: 'not_read' };
    const ownerIds = [...new Set(((owners ?? []) as { organization_id: string; user_id: string }[]).map(o => o.user_id))];
    const staffOwned = new Set<string>();
    if (ownerIds.length) {
      const { data: ownerPeople, error } = await supabaseAdmin.rpc('platform_people_by_ids', { p_ids: ownerIds });
      if (error) return { kind: 'not_read' };
      const staffOwners = new Set(((ownerPeople ?? []) as { id: string; email: string }[]).filter(p => staff.has(normalAddress(p.email))).map(p => p.id));
      for (const o of (owners ?? []) as { organization_id: string; user_id: string }[]) if (staffOwners.has(o.user_id)) staffOwned.add(o.organization_id);
    }

    const { data: dismissed, error: dismissError } = await supabaseAdmin.from('early_access_lead_dismissed_offers')
      .select('lead_id, org_id').in('lead_id', open.map(l => l.id));
    if (dismissError) return { kind: 'not_read' };
    const dismissedKey = new Set(((dismissed ?? []) as { lead_id: string; org_id: string }[]).map(d => `${d.lead_id}:${d.org_id}`));

    const demo = new Set<string>();
    for (const id of orgIds) if (await isDemoOrgId(id)) demo.add(id);

    // A Coaches Portal staff gave free time is the lead's own portal, stored cancelled: never offered as a club they signed up.
    let givenPortals: Set<string>;
    try { givenPortals = await freeTimePortalOrgIds(); } catch { return { kind: 'not_read' }; }

    const byAddress = new Map<string, OfferedClub[]>();
    for (const a of eligible) {
      for (const m of memberRows.filter(r => r.user_id === a.user_id)) {
        const org = Array.isArray(m.organizations) ? m.organizations[0] : m.organizations;
        if (!org || demo.has(m.organization_id) || staffOwned.has(m.organization_id) || givenPortals.has(m.organization_id)) continue;
        const key = normalAddress(a.email);
        const list = byAddress.get(key) ?? [];
        if (!list.some(c => c.orgId === m.organization_id)) {
          list.push({ orgId: m.organization_id, name: org.name, planId: org.plan_id, status: org.subscription_status, createdAt: org.created_at, ownerEmail: key });
        }
        byAddress.set(key, list);
      }
    }
    for (const l of open) {
      const clubs = (byAddress.get(normalAddress(l.email)) ?? []).filter(c => !dismissedKey.has(`${l.id}:${c.orgId}`));
      if (clubs.length) out.set(l.id, clubs.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    }
    return { kind: 'read', value: out };
  } catch {
    return { kind: 'not_read' };
  }
}
