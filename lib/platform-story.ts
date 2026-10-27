/**
 * The Story — a record's one dated list of what happened, who did it and why (Support console Stage 2, owner rulings A4
 * + A6 + R5, 2026-10-25; drawings Ub7fXLh29SC34Zp4oqKUx1, "The customer record reads first", the Story entry table).
 *
 * ⚖ IT READS WHAT WE ALREADY KEEP, ONE SOURCE PER KIND (never a second row for an override and its audit entry):
 *   • staff changes — `platform_audit_log` (plan and limits, sections, name and web name, owner, own web address,
 *     cancellation, retention); the per-field `update_plan` rows of a plan change fold into their main entry;
 *   • overrides — `org_overrides` (applied, ended, ran out), the reason for an ending from its revoke entry;
 *   • notes — `org_internal_notes`; the customer's own billing — `platform_events` (downgraded, cancelled, missed a
 *     payment, recovered) and `org_audit_log` (moved up a plan); people — `org_audit_log` member events, team moves and
 *     `organization_members.accepted_at` (joined); emails — `email_sends`; feedback — `feedback_submissions`;
 *   • the club created — `organizations.created_at`.
 * ⚠ NOT IN IT YET (A4, the quiet line under the table): Stripe's charges and refunds and purchases the customer makes in
 * Stripe (Stage 3 reads Stripe), a CLUB's account emails (a PERSON's Story has them since Stage 5, for the sent-log roles only). Never the trail of records opened.
 *
 * ⚖ PUT IT BACK (R5) is decided HERE and nowhere else — on a plan or limit entry, a section entry and a running override
 * only; never on anything that reached Stripe or an inbox. The Put it back route rebuilds this list and acts on the entry
 * it finds, so the screen and the server cannot disagree about what may be undone. An undone entry is never edited: the
 * new entry names it (`put_back_of`) and the list marks the old one "Put back at …".
 */
import { supabaseAdmin } from './supabase-admin';
import { peopleByIds } from './platform-people-lookup';
import { consoleClock, consoleDay } from './console-dates';
import { aRole, humanize, limitWords, sectionLabel } from './platform-labels';
import { obj, planName, putBackOf, str, whyFields, type AuditRow, type PutBack, type StoryEntry } from './platform-story-view';
import { possessive } from './utils';
import { freeTimeStoryEntries } from './free-time-story';
import { formatCents } from './console-money';
import { CONSOLE_REFUND_TAIL } from './console-money-story';
import { hasPlatformPower } from './platform-areas';
import { LEAD_ACTIONS } from './platform-audit-reason';
import type { PlatformRole } from './platform-auth';
import { listSentEmails } from './sent-log';
import { SENT_STATES } from './sent-log-words';

// The shape and the on-screen filter are plain (the record filters on screen); this module builds the entries.
export type { PutBack, PutBackKind, StoryEntry, StoryKind } from './platform-story-view';
export { filterStory } from './platform-story-view';

const SOURCE_CAP = 500;
const THE_PRODUCT = 'The product';


function list(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  const o = obj(v);
  if (o && Array.isArray(o.value)) return o.value.filter((x): x is string => typeof x === 'string');
  if (o && Array.isArray(o.enabled_addons)) return o.enabled_addons.filter((x): x is string => typeof x === 'string');
  return [];
}
function when(iso: string): string {
  return `${consoleDay(iso)} at ${consoleClock(iso)}`;
}
function limitOf(v: unknown): string {
  return limitWords(typeof v === 'number' ? v : null);
}

const PLAN_MAIN = new Set(['update_org_plan_and_limit', 'bulk_update_org_plan_and_limit']);
/** A plan change's main entry (its per-field `update_plan` rows fold into it). */
const isPlanEntry = (r: AuditRow) => PLAN_MAIN.has(r.action) && r.field === 'plan_and_limit';

/** A bulk section change's list after it, from the list before it (the row keeps the one section it touched). */
function afterBulkAddons(before: Set<string>, newValue: unknown): Set<string> {
  const n = obj(newValue);
  const after = new Set(before);
  const k = str(n?.module_key);
  if (k) { if (n?.module_operation === 'disable') after.delete(k); else after.add(k); }
  return after;
}

/**
 * The club's Story, newest first. `money` (a role with the Stripe-reading power, owner A2/Q4): the customer's purchases
 * and the refunds made in this console join it, from what we keep, so they show even when Stripe is down. Stripe's own
 * charges and dashboard refunds are merged in on screen from the Money tab's live read (`lib/console-money-story.ts`).
 */
export async function buildClubStory(orgId: string, opts: { money?: boolean; leads?: boolean } = {}): Promise<StoryEntry[]> {
  // A lead's entries name a lead: a role without the growth power never reads them, filtered in the database (Stage 7).
  const auditQuery = supabaseAdmin.from('platform_audit_log').select('id, actor_email, action, field, old_value, new_value, reason, created_at')
    .eq('org_id', orgId);
  const [orgRes, auditRes, overridesRes, notesRes, eventsRes, orgAuditRes, membersRes, emailsRes, feedbackRes, refundsRes] = await Promise.all([
    supabaseAdmin.from('organizations')
      .select('id, name, plan_id, enabled_addons, created_at, subscription_status, stripe_subscription_id, current_period_end')
      .eq('id', orgId).maybeSingle(),
    (opts.leads ? auditQuery : auditQuery.not('action', 'in', `(${[...LEAD_ACTIONS].join(',')})`))
      .order('created_at', { ascending: false }).limit(SOURCE_CAP),
    supabaseAdmin.from('org_overrides').select('id, type, value, target, starts_at, expires_at, reason, created_by, created_at, revoked_at, revoked_by')
      .eq('org_id', orgId).order('created_at', { ascending: false }).limit(SOURCE_CAP),
    supabaseAdmin.from('org_internal_notes').select('id, body, created_by_email, created_at, deleted_at, deleted_by_email')
      .eq('org_id', orgId).order('created_at', { ascending: false }).limit(SOURCE_CAP),
    supabaseAdmin.from('platform_events').select('id, event_type, source, actor_email, previous_plan_id, plan_id, occurred_at')
      .eq('org_id', orgId)
      .in('event_type', ['plan_downgraded', 'subscription_canceled', 'subscription_past_due', 'subscription_recovered',
        ...(opts.money ? ['subscription_started'] : [])])
      .order('occurred_at', { ascending: false }).limit(SOURCE_CAP),
    supabaseAdmin.from('org_audit_log').select('id, actor_id, target_id, action, payload, created_at')
      .eq('org_id', orgId)
      .in('action', ['member_invited', 'member_removed', 'role_changed', 'member_suspended', 'member_reinstated',
        'team_moved_into_club', 'plan_moved_up', 'plan_move_scheduled', 'payouts_connected', 'payouts_disconnected'])
      .order('created_at', { ascending: false }).limit(SOURCE_CAP),
    supabaseAdmin.from('organization_members').select('user_id, role, status, invited_at, accepted_at, invited_email')
      .eq('organization_id', orgId).limit(SOURCE_CAP),
    supabaseAdmin.from('email_sends').select('id, subject, recipient_email, status, suppression_reason, sent_at, created_at')
      .eq('recipient_org_id', orgId).order('created_at', { ascending: false }).limit(SOURCE_CAP),
    supabaseAdmin.from('feedback_submissions').select('id, user_email, submitter_name, type, title, body, status, triaged_by, created_at')
      .eq('org_id', orgId).order('created_at', { ascending: false }).limit(SOURCE_CAP),
    opts.money
      ? supabaseAdmin.from('platform_refunds').select('id, stripe_charge_id, stripe_refund_id, amount_cents, currency, actor_email, reason, completed_at, created_at')
        .eq('org_id', orgId).eq('status', 'done').order('created_at', { ascending: false }).limit(SOURCE_CAP)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);
  const org = orgRes.data as {
    id: string; name: string; plan_id: string | null; enabled_addons: string[] | null; created_at: string;
    subscription_status: string | null; stripe_subscription_id: string | null; current_period_end: string | null;
  } | null;
  if (!org) return [];

  const audit = (auditRes.data ?? []) as AuditRow[];
  const members = (membersRes.data ?? []) as Array<{ user_id: string; role: string; status: string | null; invited_at: string | null; accepted_at: string | null; invited_email: string | null }>;
  const orgAudit = (orgAuditRes.data ?? []) as Array<{ id: string; actor_id: string | null; target_id: string | null; action: string; payload: unknown; created_at: string }>;

  // Emails for the ids the sources name (owners moved, members, actors in the club's own log).
  const ids = new Set<string>();
  for (const m of members) ids.add(m.user_id);
  for (const r of orgAudit) { if (r.actor_id) ids.add(r.actor_id); if (r.target_id) ids.add(r.target_id); }
  for (const r of audit) if (r.action === 'transfer_org_ownership') { const id = str(obj(r.new_value)?.newOwnerUserId); if (id) ids.add(id); }
  const people = await peopleByIds(ids).catch(() => new Map());
  const emailOf = (id: string | null | undefined) => (id ? people.get(id)?.email ?? null : null);

  // What has been put back, and when (an undone entry is marked, never edited).
  const putBackAt = new Map<string, string>();
  for (const r of audit) { const ref = putBackOf(r.new_value); if (ref && !putBackAt.has(ref)) putBackAt.set(ref, r.created_at); }
  /** An entry already undone says when; otherwise it carries the door the caller offers (or none). */
  const markPutBack = (entry: StoryEntry, offer: PutBack | null) => {
    const done = putBackAt.get(entry.key);
    if (done) entry.putBackAt = done;
    else if (offer) entry.putBack = offer;
  };
  /** "Undoes the 3:20 p.m. entry", for an entry that names the one it puts back. */
  const undoesSub = (ref: string) => `Undoes the ${consoleClock(audit.find(a => ref === `audit:${a.id}` || ref.startsWith(`audit:${a.id}:`))?.created_at)} entry`;

  const entries: StoryEntry[] = [];
  const currentAddons = new Set(org.enabled_addons ?? []);

  // ── Staff changes (platform_audit_log) ─────────────────────────────────────────────────────────────────────────────
  // The newest plan entry is the only one Put it back can undo (an older one would jump over the changes after it).
  const newestPlanId = audit.find(isPlanEntry)?.id;
  const seenSection = new Set<string>();
  for (const r of audit) {
    const who = r.actor_email ?? 'Staff';
    const key = `audit:${r.id}`;
    const undoing = putBackOf(r.new_value);
    if (isPlanEntry(r)) {
      const oldV = obj(r.old_value);
      const newV = obj(r.new_value) ?? {};
      // The per-field rows written by the same change fold in as its sub-line. The plan-change rule writes them just
      // AFTER the change's own row, so they are the same person's rows in the few seconds after it — and of each field
      // the earliest, which is this change's and not the next one's (`audit` is newest first).
      const t = Date.parse(r.created_at);
      const siblings = audit.filter(s => s.action === 'update_plan' && s.actor_email === r.actor_email
        && Date.parse(s.created_at) >= t && Date.parse(s.created_at) - t < 10_000);
      const sibling = (field: string) => siblings.filter(s => s.field === field).at(-1);
      const teamRow = sibling('team_limit');
      const subs: string[] = [];
      const trial = obj(sibling('club_trial')?.new_value);
      if (trial && typeof trial.days === 'number') subs.push(`A ${trial.days}-day trial started`);
      const archived = obj(sibling('archived_over_cap_tournaments')?.new_value);
      if (archived && typeof archived.count === 'number' && archived.count > 0) subs.push(`${archived.count} tournament${archived.count === 1 ? '' : 's'} archived over the limit`);
      if (r.action.startsWith('bulk_')) subs.push('From Bulk changes');

      const fromPlan = oldV?.plan_id;
      const toPlan = newV.plan_id;
      const samePlan = fromPlan === toPlan;
      // A save that changed only the team limit reads as that, not as "no limit → no limit".
      const teamOnly = samePlan && !!teamRow && oldV?.tournament_limit === newV.tournament_limit;
      if (teamRow && !teamOnly) subs.unshift(teamRow.new_value == null ? 'Team limit back to the plan’s' : `Team limit set to ${limitOf(teamRow.new_value)}`);
      if (undoing) subs.unshift(undoesSub(undoing));
      const title = undoing
        ? `Put back: plan back to ${planName(toPlan)}`
        : teamOnly
          ? `Team limit changed: ${teamRow!.old_value == null ? 'the plan’s' : limitOf(teamRow!.old_value)} → ${teamRow!.new_value == null ? 'the plan’s' : limitOf(teamRow!.new_value)}`
          : samePlan
            ? `Tournament limit changed: ${limitOf(oldV?.tournament_limit)} → ${limitOf(newV.tournament_limit)}`
            : `Plan changed: ${planName(fromPlan)} → ${planName(toPlan)}`;
      const entry: StoryEntry = { key, at: r.created_at, kind: 'staff', title, sub: subs.join(' · ') || undefined, who, ...whyFields(r, true) };
      // ⚖ NOTHING THAT REACHED STRIPE IS PUT BACK (rule R5). The plan-change rule restores the plan and limits only, so the
      // door is offered only where that puts the club back exactly: no live Stripe subscription now (a club that started
      // paying since — Stripe moves the plan without a Story entry), none cut by this change (it cannot be re-attached),
      // and — unless the club goes back to Tournament, which resets billing to free — the same billing state as before
      // (a trial this change started, or one that ended since, would be left wrong).
      const backToFree = oldV?.plan_id === 'tournament';
      const billingSame = backToFree
        || ((oldV?.subscription_status ?? null) === org.subscription_status
          && (oldV?.current_period_end ?? null) === org.current_period_end);
      const stripeFree = !org.stripe_subscription_id && !oldV?.stripe_subscription_id;
      // Only the newest plan entry, still in force, that says what came before it.
      const undoable = oldV && r.id === newestPlanId && org.plan_id === toPlan && stripeFree && billingSame
        && typeof oldV.plan_id === 'string' && typeof oldV.tournament_limit === 'number';
      const teamWas = teamRow ? (teamRow.old_value == null ? 'the plan’s' : limitOf(teamRow.old_value)) : '';
      const teamBack = teamRow ? ` Its team limit goes back to ${teamWas}.` : '';
      markPutBack(entry, undoable ? {
        kind: 'plan',
        title: `Put back the plan for ${org.name}`,
        sentence: teamOnly
          ? `${possessive(org.name)} team limit goes back to ${teamWas}, as it was before ${when(r.created_at)}.`
          : samePlan
            ? `${possessive(org.name)} tournament limit goes back from ${limitOf(newV.tournament_limit)} to ${limitOf(oldV.tournament_limit)}, as it was before ${when(r.created_at)}.${teamBack}`
            : `${org.name} goes back from ${planName(toPlan)} to ${planName(oldV.plan_id)}, as it was before ${when(r.created_at)}.${teamBack}`,
        planId: oldV.plan_id as string,
        tournamentLimit: oldV.tournament_limit as number,
        // The same change's team-limit row says what the cap was; without one the cap is left alone.
        ...(teamRow ? { teamLimit: typeof teamRow.old_value === 'number' ? teamRow.old_value : null } : {}),
      } : null);
      entries.push(entry);
      continue;
    }
    if (r.action === 'update_addons' || r.action === 'bulk_update_addons') {
      const before = new Set(list(r.old_value));
      const after = r.action === 'bulk_update_addons' ? afterBulkAddons(before, r.new_value) : new Set(list(r.new_value));
      const changed = [...new Set([...before, ...after])].filter(k => before.has(k) !== after.has(k));
      for (const section of changed) {
        const on = after.has(section);
        const sKey = `${key}:${section}`;
        const label = sectionLabel(section);
        const entry: StoryEntry = {
          key: sKey,
          at: r.created_at,
          kind: 'staff',
          title: undoing ? `Put back: ${label} ${on ? 'on' : 'off'} again` : `Section turned ${on ? 'on' : 'off'}: ${label}`,
          sub: undoing ? undoesSub(undoing) : r.action.startsWith('bulk_') ? 'From Bulk changes' : undefined,
          who,
          ...whyFields(r, true),
        };
        // Only the newest entry for a section, and only while the club is still as that entry left it.
        markPutBack(entry, !seenSection.has(section) && currentAddons.has(section) === on ? {
          kind: 'section',
          title: `Put back ${label} for ${org.name}`,
          sentence: `${label} turns ${on ? 'off' : 'on'} again for ${org.name}, as it was before ${when(r.created_at)}.`,
          section,
          on: !on,
        } : null);
        seenSection.add(section);
        entries.push(entry);
      }
      continue;
    }
    if (r.action === 'update_org_identity') {
      const to = str(obj(r.new_value)?.value) ?? '';
      const from = str(r.old_value) ?? '';
      entries.push(r.field === 'slug'
        ? { key, at: r.created_at, kind: 'staff', title: 'Web name changed:', codes: [from, to], who, ...whyFields(r, true) }
        : { key, at: r.created_at, kind: 'staff', title: `Name changed: ${from} → ${to}`, who, ...whyFields(r, true) });
      continue;
    }
    // A lead's link (Stage 7): read only by the growth power, filtered in the database read above.
    if (r.action === 'link_early_access_lead') {
      const how = str(obj(r.new_value)?.method) === 'offered' ? 'the offered match (same email)' : 'by hand';
      entries.push({ key, at: r.created_at, kind: 'staff', title: 'Arrived as a lead: linked to its lead', sub: `Linked ${how}`, who, why: null });
      continue;
    }
    if (r.action === 'unlink_early_access_lead') {
      entries.push({ key, at: r.created_at, kind: 'staff', title: 'Unlinked from its lead', who, why: null });
      continue;
    }
    if (r.action === 'dismiss_early_access_offer') continue;
    if (r.action === 'transfer_org_ownership') {
      const to = emailOf(str(obj(r.new_value)?.newOwnerUserId)) ?? 'another member';
      entries.push({ key, at: r.created_at, kind: 'staff', title: `Owner changed to ${to}`, sub: 'The previous owner became an admin', who, ...whyFields(r, true) });
      continue;
    }
    if (r.action === 'release_club_web_address') {
      const address = str(obj(r.old_value)?.address) ?? 'its own web address';
      entries.push({ key, at: r.created_at, kind: 'staff', title: `Own web address released: ${address}`, who, ...whyFields(r, true) });
      continue;
    }
    if (r.action === 'cancel_subscription') {
      const until = str(obj(r.new_value)?.retentionUntil);
      entries.push({ key, at: r.created_at, kind: 'staff', title: 'Subscription cancelled', sub: until ? `Its data is kept until ${consoleDay(until)}` : undefined, who, ...whyFields(r, true) });
      continue;
    }
    if (r.action === 'cancel_subscription_stripe_failed') {
      entries.push({ key, at: r.created_at, kind: 'staff', title: 'Stripe did not stop the subscription', sub: 'It needs cancelling in Stripe by hand', who, ...whyFields(r, true) });
      continue;
    }
    if (r.action === 'extend_billing_retention') {
      const days = obj(r.new_value)?.days;
      entries.push({ key, at: r.created_at, kind: 'staff', title: `Retention extended${typeof days === 'number' ? ` by ${days} days` : ''}`, who, ...whyFields(r, true) });
      continue;
    }
  }

  // ── Free time (org_overrides, and the audit entries that change or end it): lib/free-time-story.ts ──────────────
  entries.push(...freeTimeStoryEntries({
    org,
    overrides: (overridesRes.data ?? []) as Parameters<typeof freeTimeStoryEntries>[0]['overrides'],
    audit,
    putBackAt,
  }));

  // ── Notes ────────────────────────────────────────────────────────────────────────────────────────────────────────
  for (const n of (notesRes.data ?? []) as Array<{ id: string; body: string; created_by_email: string | null; created_at: string; deleted_at: string | null; deleted_by_email: string | null }>) {
    if (n.deleted_at) {
      entries.push({ key: `note-deleted:${n.id}`, at: n.deleted_at, kind: 'notes', title: 'Note deleted', who: n.deleted_by_email ?? 'Staff', why: null });
    } else {
      entries.push({ key: `note:${n.id}`, at: n.created_at, kind: 'notes', title: 'Note', sub: n.body, who: n.created_by_email ?? 'Staff', why: null });
    }
  }

  // ── The customer's own billing ───────────────────────────────────────────────────────────────────────────────────
  for (const e of (eventsRes.data ?? []) as Array<{ id: string; event_type: string; source: string | null; actor_email: string | null; previous_plan_id: string | null; plan_id: string | null; occurred_at: string }>) {
    const who = e.source === 'stripe' && e.event_type !== 'subscription_started' ? 'Stripe' : e.actor_email ?? 'The customer';
    if (e.event_type === 'subscription_started') {
      // A first purchase (Stage 3). An upgrade is already "Moved up" from the club's own log, so plan_upgraded is not read.
      entries.push({ key: `event:${e.id}`, at: e.occurred_at, kind: 'billing', title: `Bought ${planName(e.plan_id)}`, who, why: null, moneyEvent: 'bought' });
      continue;
    }
    const title = e.event_type === 'plan_downgraded' ? `Downgraded: ${planName(e.previous_plan_id)} → ${planName(e.plan_id)}`
      : e.event_type === 'subscription_canceled' ? (e.source === 'stripe' ? 'Subscription ended in Stripe' : 'Subscription cancelled by the customer')
      : e.event_type === 'subscription_past_due' ? 'A payment was missed'
      : 'Payment recovered';
    const moneyEvent = e.event_type === 'subscription_past_due' ? 'missed' as const : e.event_type === 'subscription_recovered' ? 'recovered' as const
      : e.event_type === 'plan_downgraded' ? 'moved' as const : undefined;
    entries.push({ key: `event:${e.id}`, at: e.occurred_at, kind: 'billing', title, who, why: null, ...(moneyEvent ? { moneyEvent } : {}) });
  }

  // ── Refunds made in this console (Stage 3): a fact, never Put it back; the card is never named ───────────────────
  for (const f of (refundsRes.data ?? []) as Array<{ id: string; stripe_charge_id: string; stripe_refund_id: string | null; amount_cents: number; currency: string; actor_email: string; reason: string; completed_at: string | null; created_at: string }>) {
    entries.push({
      key: `refund:${f.stripe_refund_id ?? f.id}`, at: f.completed_at ?? f.created_at, kind: 'billing',
      title: `Refunded ${formatCents(f.amount_cents, f.currency)}${CONSOLE_REFUND_TAIL}`, sub: 'To the card it came from · the plan did not change',
      who: f.actor_email, why: f.reason, chargeId: f.stripe_charge_id,
    });
  }

  // ── People, team moves and the customer's plan moves (the club's own log) ─────────────────────────────────────────
  for (const r of orgAudit) {
    const p = obj(r.payload) ?? {};
    const actor = emailOf(r.actor_id) ?? str(p.actorEmail) ?? 'A club member';
    const target = emailOf(r.target_id) ?? str(p.email) ?? 'a member';
    const key = `org:${r.id}`;
    if (r.action === 'member_invited') {
      const m = members.find(x => x.user_id === r.target_id);
      const pending = m && (m.status === 'invited' || !m.accepted_at);
      entries.push({ key, at: r.created_at, kind: 'people', title: `Invited ${str(p.email) ?? target}`, sub: `As ${aRole(str(p.role))}${pending ? ' · not accepted yet' : ''}`, who: actor, why: null });
    } else if (r.action === 'member_removed') {
      entries.push({ key, at: r.created_at, kind: 'people', title: `Removed ${str(p.email) ?? target}`, who: actor, why: null });
    } else if (r.action === 'role_changed') {
      entries.push({ key, at: r.created_at, kind: 'people', title: `Role changed: ${target}`, sub: `${humanize(str(p.before))} → ${humanize(str(p.after))}`, who: actor, why: null });
    } else if (r.action === 'member_suspended' || r.action === 'member_reinstated') {
      entries.push({ key, at: r.created_at, kind: 'people', title: `${r.action === 'member_suspended' ? 'Suspended' : 'Reinstated'}: ${target}`, who: actor, why: null });
    } else if (r.action === 'team_moved_into_club') {
      entries.push({ key, at: r.created_at, kind: 'people', title: `Team moved in: ${str(p.teamName) ?? 'a team'}`, sub: 'With its staff and every team record', who: str(p.actorEmail) ?? actor, why: null });
    } else if (r.action === 'plan_moved_up' || r.action === 'plan_move_scheduled') {
      entries.push({ key, at: r.created_at, kind: 'billing', title: `${r.action === 'plan_moved_up' ? 'Moved up' : 'Plan move scheduled'}: ${planName(p.from)} → ${planName(p.to)}`, who: actor, why: null, moneyEvent: 'moved' });
    } else if (r.action === 'payouts_connected' || r.action === 'payouts_disconnected') {
      entries.push({ key, at: r.created_at, kind: 'billing', title: r.action === 'payouts_connected' ? 'Family payments connected' : 'Family payments disconnected', who: actor, why: null });
    }
  }
  // Joined: an invite accepted later than it was sent (an existing account added at once is the invite itself).
  const created = Date.parse(org.created_at);
  for (const m of members) {
    if (!m.accepted_at) continue;
    const accepted = Date.parse(m.accepted_at);
    if (Math.abs(accepted - created) < 120_000) continue; // the first owner, who made the club
    if (m.invited_at && accepted - Date.parse(m.invited_at) < 60_000) continue;
    entries.push({ key: `joined:${m.user_id}`, at: m.accepted_at, kind: 'people', title: `Joined: ${emailOf(m.user_id) ?? m.invited_email ?? 'a member'}`, sub: `As ${aRole(m.role)}`, who: emailOf(m.user_id) ?? 'A club member', why: null });
  }

  // ── Emails ───────────────────────────────────────────────────────────────────────────────────────────────────────
  const owners = members.filter(m => m.role === 'owner');
  const ownerEmails = new Set(owners.map(m => emailOf(m.user_id)).filter(Boolean));
  for (const e of (emailsRes.data ?? []) as Array<{ id: string; subject: string | null; recipient_email: string | null; status: string; suppression_reason: string | null; sent_at: string | null; created_at: string }>) {
    const sent = e.status === 'sent' || e.status === 'queued';
    const to = e.recipient_email && ownerEmails.has(e.recipient_email.toLowerCase()) ? 'the owner' : e.recipient_email ?? 'the club';
    entries.push({
      key: `email:${e.id}`, at: e.sent_at ?? e.created_at, kind: 'emails',
      title: `${sent ? 'Campaign email sent' : 'Campaign email not sent'}: ${e.subject ?? 'an email'}`,
      sub: sent ? `Sent to ${to}` : `Not sent to ${to}${e.suppression_reason ? ` (${humanize(e.suppression_reason).toLowerCase()})` : ''}`,
      who: THE_PRODUCT, why: null,
    });
  }

  // ── Feedback ─────────────────────────────────────────────────────────────────────────────────────────────────────
  for (const f of (feedbackRes.data ?? []) as Array<{ id: string; user_email: string | null; submitter_name: string | null; type: string; title: string | null; body: string | null; status: string; triaged_by: string | null; created_at: string }>) {
    const words = (f.title ?? f.body ?? '').trim();
    const short = words.length > 80 ? `${words.slice(0, 79)}…` : words;
    entries.push({
      key: `feedback:${f.id}`, at: f.created_at, kind: 'feedback', title: `Feedback sent: “${short}”`,
      sub: f.status === 'new' ? 'Not triaged yet' : f.triaged_by ? `${humanize(f.status)} by ${f.triaged_by}` : humanize(f.status),
      who: f.user_email ?? f.submitter_name ?? 'A club member', why: null,
    });
  }

  // ── Created ──────────────────────────────────────────────────────────────────────────────────────────────────────
  const firstPlan = [...audit].reverse().find(isPlanEntry);
  const startPlan = obj(firstPlan?.old_value)?.plan_id ?? org.plan_id;
  const firstOwner = [...owners].sort((a, b) => (a.accepted_at ?? '').localeCompare(b.accepted_at ?? ''))[0];
  entries.push({
    key: `created:${org.id}`, at: org.created_at, kind: 'people',
    title: `Club created on the ${planName(startPlan)} plan`, who: emailOf(firstOwner?.user_id) ?? THE_PRODUCT, why: null,
  });

  return entries.sort((a, b) => b.at.localeCompare(a.at) || a.key.localeCompare(b.key));
}

// ── A person's Story ─────────────────────────────────────────────────────────────────────────────────────────────────

const PERSON_ACTIONS: Record<string, { title: string; sub?: string }> = {
  generate_reset_link: { title: 'Reset link made' },
  confirm_email: { title: 'Email confirmed' },
  revoke_sessions: { title: 'Signed out everywhere' },
  ban_user: { title: 'Banned' },
  unban_user: { title: 'Ban lifted' },
  update_user: { title: 'Name or email changed' },
};

/**
 * A person's Story: the account created, staff actions on it (from Stage 2 they name the account id; older ones hold
 * the email or the id as a bare value, so both are matched), staff notes, club invitations, role changes and joins.
 * Sign-in history is not kept — only the last sign-in, which the band shows.
 *
 * ⚖ THE EMAIL ROWS (Stage 5, owner Q6): only for a role holding the `sent_log` power, and only the kinds people ask about
 * (`isStoryKind`: sign-up, sign-in and reset links, the invitations, our feedback replies). The Story is open to every
 * role, so the rows are decided HERE from the role — `emailsAs` — and a role without the power is never asked for them
 * (T14). The CLUB's Story is unchanged.
 */
export type PersonMembership = {
  role: string;
  invited_at: string | null;
  accepted_at: string | null;
  organizations: { name: string } | null;
};

export async function buildPersonStory(
  person: { id: string; email: string; createdAt: string | null },
  memberships: readonly PersonMembership[],
  opts: { emailsAs?: PlatformRole | null } = {},
): Promise<StoryEntry[]> {
  const email = person.email.toLowerCase();
  const emailsAs = opts.emailsAs && hasPlatformPower(opts.emailsAs, 'sent_log') ? opts.emailsAs : null;
  // From Stage 2 an entry names the account (`new_value.userId`); an older one holds the email or the id as a bare value.
  const named = [`new_value->>userId.eq.${person.id}`]
    .concat([person.id, email].flatMap(v => [`new_value.eq.${JSON.stringify(JSON.stringify(v))}`, `old_value.eq.${JSON.stringify(JSON.stringify(v))}`]));
  const [auditRes, notesRes, orgAuditRes, sentRes] = await Promise.all([
    supabaseAdmin.from('platform_audit_log').select('id, actor_email, action, field, old_value, new_value, reason, created_at')
      .is('org_id', null).in('action', Object.keys(PERSON_ACTIONS)).or(named.join(','))
      .order('created_at', { ascending: false }).limit(SOURCE_CAP),
    supabaseAdmin.from('platform_user_notes').select('id, body, created_by_email, created_at')
      .eq('user_id', person.id).order('created_at', { ascending: false }).limit(SOURCE_CAP),
    supabaseAdmin.from('org_audit_log').select('id, org_id, actor_id, action, payload, created_at, organizations(name)')
      .eq('target_id', person.id).in('action', ['member_invited', 'member_removed', 'role_changed', 'member_suspended', 'member_reinstated'])
      .order('created_at', { ascending: false }).limit(SOURCE_CAP),
    // A failed read leaves the rows out; it never fails the Story (the Emails tab says it could not read them).
    emailsAs ? listSentEmails(emailsAs, { to: email, storyOnly: true, limit: 100 }).catch(() => null) : Promise.resolve(null),
  ]);

  const entries: StoryEntry[] = [];
  for (const e of sentRes?.rows ?? []) {
    entries.push({ key: `sentemail:${e.id}`, at: e.sentAt, kind: 'emails', title: `${e.label} sent`, sub: SENT_STATES[e.state].word, who: THE_PRODUCT, why: null });
  }
  for (const r of (auditRes.data ?? []) as AuditRow[]) {
    const def = PERSON_ACTIONS[r.action];
    let sub = def.sub;
    if (r.action === 'update_user') {
      const n = obj(r.new_value);
      const parts = [str(n?.emailFrom) && str(n?.emailTo) ? `Email ${n?.emailFrom} → ${n?.emailTo}` : null,
        str(n?.nameTo) ? `Name ${str(n?.nameFrom) ?? 'none'} → ${n?.nameTo}` : null].filter(Boolean);
      if (parts.length) sub = parts.join(' · ');
    }
    entries.push({ key: `audit:${r.id}`, at: r.created_at, kind: 'staff', title: def.title, sub, who: r.actor_email ?? 'Staff', ...whyFields(r, true) });
  }
  for (const n of (notesRes.data ?? []) as Array<{ id: string; body: string; created_by_email: string | null; created_at: string }>) {
    entries.push({ key: `note:${n.id}`, at: n.created_at, kind: 'notes', title: 'Note', sub: n.body, who: n.created_by_email ?? 'Staff', why: null });
  }
  const orgAudit = (orgAuditRes.data ?? []) as unknown as Array<{ id: string; actor_id: string | null; action: string; payload: unknown; created_at: string; organizations: { name: string } | null }>;
  const actors = await peopleByIds(orgAudit.map(r => r.actor_id).filter((x): x is string => !!x)).catch(() => new Map());
  for (const r of orgAudit) {
    const p = obj(r.payload) ?? {};
    const club = r.organizations?.name ?? 'a club';
    const who = (r.actor_id && actors.get(r.actor_id)?.email) || 'A club member';
    const title = r.action === 'member_invited' ? `Invited to ${club}`
      : r.action === 'member_removed' ? `Removed from ${club}`
      : r.action === 'role_changed' ? `Role changed in ${club}`
      : r.action === 'member_suspended' ? `Suspended in ${club}` : `Reinstated in ${club}`;
    const sub = r.action === 'member_invited' ? `As ${aRole(str(p.role))}` : r.action === 'role_changed' ? `${humanize(str(p.before))} → ${humanize(str(p.after))}` : undefined;
    entries.push({ key: `org:${r.id}`, at: r.created_at, kind: 'people', title, sub, who, why: null });
  }
  for (const m of memberships) {
    if (!m.accepted_at || !m.organizations) continue;
    const owner = m.role === 'owner';
    entries.push({
      key: `joined:${m.organizations.name}:${m.accepted_at}`, at: m.accepted_at, kind: 'people',
      title: owner ? `Became owner of ${m.organizations.name}` : `Joined ${m.organizations.name}`,
      sub: owner ? undefined : `As ${aRole(m.role)}`, who: THE_PRODUCT, why: null,
    });
  }
  if (person.createdAt) {
    entries.push({ key: `created:${person.id}`, at: person.createdAt, kind: 'people', title: 'Account created', who: person.email, why: null });
  }
  return entries.sort((a, b) => b.at.localeCompare(a.at) || a.key.localeCompare(b.key));
}
