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
 * Stripe (Stage 3 reads Stripe), account emails such as password resets (Stage 5). Never the trail of records opened.
 *
 * ⚖ PUT IT BACK (R5) is decided HERE and nowhere else — on a plan or limit entry, a section entry and a running override
 * only; never on anything that reached Stripe or an inbox. The Put it back route rebuilds this list and acts on the entry
 * it finds, so the screen and the server cannot disagree about what may be undone. An undone entry is never edited: the
 * new entry names it (`put_back_of`) and the list marks the old one "Put back at …".
 */
import { supabaseAdmin } from './supabase-admin';
import { peopleByIds } from './platform-people-lookup';
import { planLabel } from './platform-metrics';
import { sectionLabel } from './club-record-changes';
import { consoleClock, consoleDay } from './console-dates';
import { humanize } from './platform-labels';
import { possessive } from './utils';

export type StoryKind = 'staff' | 'billing' | 'notes' | 'emails' | 'people' | 'feedback';

export const STORY_KIND_LABELS: Record<StoryKind, string> = {
  staff: 'Staff changes',
  billing: 'Billing',
  notes: 'Notes',
  emails: 'Emails',
  people: 'People',
  feedback: 'Feedback',
};

export type PutBackKind = 'plan' | 'section' | 'override';

export type StoryEntry = {
  /** Stable key — also what a Put it back names (`audit:<id>`, `audit:<id>:<section>`, `override:<id>`, …). */
  key: string;
  at: string;
  kind: StoryKind;
  title: string;
  /** A change between two codes (a web name), drawn in the data face after the title's words. */
  codes?: [string, string];
  sub?: string;
  who: string;
  /** The reason; null when a reason does not apply ("—"). */
  why: string | null;
  /** True for an older change that never kept its reason ("Not recorded"). */
  whyNotRecorded?: boolean;
  /** Offered only on plan/limit, section and running-override entries that can still be undone. */
  putBack?: { kind: PutBackKind; sentence: string; title: string };
  /** When this entry was put back (the door goes; the grey line says when). */
  putBackAt?: string;
};

const SOURCE_CAP = 500;
const THE_PRODUCT = 'The product';

type AuditRow = {
  id: number | string;
  actor_email: string | null;
  action: string;
  field: string | null;
  old_value: unknown;
  new_value: unknown;
  created_at: string;
};

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}
function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null;
}
function reasonOf(v: unknown): string | null {
  return str(obj(v)?.reason);
}
function putBackOf(v: unknown): string | null {
  return str(obj(v)?.put_back_of);
}
function list(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  const o = obj(v);
  if (o && Array.isArray(o.value)) return o.value.filter((x): x is string => typeof x === 'string');
  if (o && Array.isArray(o.enabled_addons)) return o.enabled_addons.filter((x): x is string => typeof x === 'string');
  return [];
}
function whyFields(v: unknown, keptSinceStage2: boolean): Pick<StoryEntry, 'why' | 'whyNotRecorded'> {
  const reason = reasonOf(v);
  if (reason) return { why: reason };
  return keptSinceStage2 ? { why: null, whyNotRecorded: true } : { why: null };
}
function when(iso: string): string {
  return `${consoleDay(iso)} at ${consoleClock(iso)}`;
}
function planName(id: unknown): string {
  return typeof id === 'string' && id ? planLabel(id) : 'no plan';
}
function limitWords(n: unknown): string {
  return typeof n === 'number' ? (n >= 9999 ? 'no limit' : String(n)) : 'no limit';
}

const OVERRIDE_LABELS: Record<string, string> = {
  subscription_status: 'Subscription status',
  comp_period: 'Comp period',
  module_addon: 'Feature access',
  plan_tier: 'Plan tier',
};

const PLAN_MAIN = new Set(['update_org_plan_and_limit', 'bulk_update_org_plan_and_limit']);

/** The club's Story, newest first. */
export async function buildClubStory(orgId: string): Promise<StoryEntry[]> {
  const [orgRes, auditRes, overridesRes, notesRes, eventsRes, orgAuditRes, membersRes, emailsRes, feedbackRes] = await Promise.all([
    supabaseAdmin.from('organizations').select('id, name, plan_id, enabled_addons, created_at').eq('id', orgId).maybeSingle(),
    supabaseAdmin.from('platform_audit_log').select('id, actor_email, action, field, old_value, new_value, created_at')
      .eq('org_id', orgId).order('created_at', { ascending: false }).limit(SOURCE_CAP),
    supabaseAdmin.from('org_overrides').select('id, type, value, target, starts_at, expires_at, reason, created_by, created_at, revoked_at, revoked_by')
      .eq('org_id', orgId).order('created_at', { ascending: false }).limit(SOURCE_CAP),
    supabaseAdmin.from('org_internal_notes').select('id, body, created_by_email, created_at, deleted_at, deleted_by_email')
      .eq('org_id', orgId).order('created_at', { ascending: false }).limit(SOURCE_CAP),
    supabaseAdmin.from('platform_events').select('id, event_type, source, actor_email, previous_plan_id, plan_id, occurred_at')
      .eq('org_id', orgId)
      .in('event_type', ['plan_downgraded', 'subscription_canceled', 'subscription_past_due', 'subscription_recovered'])
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
  ]);
  const org = orgRes.data as { id: string; name: string; plan_id: string | null; enabled_addons: string[] | null; created_at: string } | null;
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

  const entries: StoryEntry[] = [];
  const currentAddons = new Set(org.enabled_addons ?? []);

  // ── Staff changes (platform_audit_log) ─────────────────────────────────────────────────────────────────────────────
  // The newest plan entry is the only one Put it back can undo (an older one would jump over the changes after it).
  const newestPlanId = audit.find(r => PLAN_MAIN.has(r.action) && r.field === 'plan_and_limit')?.id;
  const seenSection = new Set<string>();
  for (const r of audit) {
    const who = r.actor_email ?? 'Staff';
    const key = `audit:${r.id}`;
    const undoing = putBackOf(r.new_value);
    if (PLAN_MAIN.has(r.action) && r.field === 'plan_and_limit') {
      const oldV = obj(r.old_value);
      const newV = obj(r.new_value) ?? {};
      // The per-field rows written by the same change (same person, within a few seconds) fold in as its sub-line.
      const t = Date.parse(r.created_at);
      const siblings = audit.filter(s => s.action === 'update_plan' && s.actor_email === r.actor_email
        && Math.abs(Date.parse(s.created_at) - t) < 10_000);
      const teamRow = siblings.filter(s => s.field === 'team_limit').at(-1);
      const subs: string[] = [];
      if (teamRow) subs.push(teamRow.new_value == null ? 'Team limit back to the plan’s' : `Team limit set to ${limitWords(teamRow.new_value)}`);
      const trial = obj(siblings.find(s => s.field === 'club_trial')?.new_value);
      if (trial && typeof trial.days === 'number') subs.push(`A ${trial.days}-day trial started`);
      const archived = obj(siblings.find(s => s.field === 'archived_over_cap_tournaments')?.new_value);
      if (archived && typeof archived.count === 'number' && archived.count > 0) subs.push(`${archived.count} tournament${archived.count === 1 ? '' : 's'} archived over the limit`);
      if (r.action.startsWith('bulk_')) subs.push('From Bulk changes');
      if (undoing) subs.unshift(`Undoes the ${consoleClock(audit.find(a => `audit:${a.id}` === undoing)?.created_at)} entry`);

      const fromPlan = oldV?.plan_id;
      const toPlan = newV.plan_id;
      const samePlan = fromPlan === toPlan;
      const title = undoing
        ? `Put back: plan back to ${planName(toPlan)}`
        : samePlan
          ? `Tournament limit changed: ${limitWords(oldV?.tournament_limit)} → ${limitWords(newV.tournament_limit)}`
          : `Plan changed: ${planName(fromPlan)} → ${planName(toPlan)}`;
      const entry: StoryEntry = { key, at: r.created_at, kind: 'staff', title, sub: subs.join(' · ') || undefined, who, ...whyFields(r.new_value, false) };
      const done = putBackAt.get(key);
      if (done) entry.putBackAt = done;
      else if (oldV && r.id === newestPlanId && org.plan_id === toPlan && typeof oldV.plan_id === 'string') {
        const teamBack = teamRow ? ` Its team limit goes back to ${teamRow.old_value == null ? 'the plan’s' : limitWords(teamRow.old_value)}.` : '';
        entry.putBack = {
          kind: 'plan',
          title: `Put back the plan for ${org.name}`,
          sentence: samePlan
            ? `${possessive(org.name)} tournament limit goes back from ${limitWords(newV.tournament_limit)} to ${limitWords(oldV.tournament_limit)}, as it was before ${when(r.created_at)}.${teamBack}`
            : `${org.name} goes back from ${planName(toPlan)} to ${planName(oldV.plan_id)}, as it was before ${when(r.created_at)}.${teamBack}`,
        };
      }
      entries.push(entry);
      continue;
    }
    if (r.action === 'update_addons' || r.action === 'bulk_update_addons') {
      const before = new Set(list(r.old_value));
      const after = r.action === 'bulk_update_addons'
        ? (() => {
            const n = obj(r.new_value);
            const s = new Set(before);
            const k = str(n?.module_key);
            if (k) { if (n?.module_operation === 'disable') s.delete(k); else s.add(k); }
            return s;
          })()
        : new Set(list(r.new_value));
      const changed = [...new Set([...before, ...after])].filter(k => before.has(k) !== after.has(k));
      for (const section of changed) {
        const on = after.has(section);
        const sKey = `${key}:${section}`;
        const label = sectionLabel(section);
        const undoRef = undoing;
        const entry: StoryEntry = {
          key: sKey,
          at: r.created_at,
          kind: 'staff',
          title: undoRef ? `Put back: ${label} ${on ? 'on' : 'off'} again` : `Section turned ${on ? 'on' : 'off'}: ${label}`,
          sub: undoRef
            ? `Undoes the ${consoleClock(audit.find(a => undoRef.startsWith(`audit:${a.id}`))?.created_at)} entry`
            : r.action.startsWith('bulk_') ? 'From Bulk changes' : undefined,
          who,
          ...whyFields(r.new_value, true),
        };
        const done = putBackAt.get(sKey);
        if (done) entry.putBackAt = done;
        // Only the newest entry for a section, and only while the club is still as that entry left it.
        else if (!seenSection.has(section) && currentAddons.has(section) === on) {
          entry.putBack = {
            kind: 'section',
            title: `Put back ${label} for ${org.name}`,
            sentence: `${label} turns ${on ? 'off' : 'on'} again for ${org.name}, as it was before ${when(r.created_at)}.`,
          };
        }
        seenSection.add(section);
        entries.push(entry);
      }
      continue;
    }
    if (r.action === 'update_org_identity') {
      const to = str(obj(r.new_value)?.value) ?? '';
      const from = str(r.old_value) ?? '';
      entries.push(r.field === 'slug'
        ? { key, at: r.created_at, kind: 'staff', title: 'Web name changed:', codes: [from, to], who, ...whyFields(r.new_value, false) }
        : { key, at: r.created_at, kind: 'staff', title: `Name changed: ${from} → ${to}`, who, ...whyFields(r.new_value, false) });
      continue;
    }
    if (r.action === 'transfer_org_ownership') {
      const to = emailOf(str(obj(r.new_value)?.newOwnerUserId)) ?? 'another member';
      entries.push({ key, at: r.created_at, kind: 'staff', title: `Owner changed to ${to}`, sub: 'The previous owner became an admin', who, ...whyFields(r.new_value, false) });
      continue;
    }
    if (r.action === 'release_club_web_address') {
      const address = str(obj(r.old_value)?.address) ?? 'its own web address';
      entries.push({ key, at: r.created_at, kind: 'staff', title: `Own web address released: ${address}`, who, ...whyFields(r.new_value, false) });
      continue;
    }
    if (r.action === 'cancel_subscription') {
      const until = str(obj(r.new_value)?.retentionUntil);
      entries.push({ key, at: r.created_at, kind: 'staff', title: 'Subscription cancelled', sub: until ? `Its data is kept until ${consoleDay(until)}` : undefined, who, ...whyFields(r.new_value, true) });
      continue;
    }
    if (r.action === 'cancel_subscription_stripe_failed') {
      entries.push({ key, at: r.created_at, kind: 'staff', title: 'Stripe did not stop the subscription', sub: 'It needs cancelling in Stripe by hand', who, why: null });
      continue;
    }
    if (r.action === 'extend_billing_retention') {
      const days = obj(r.new_value)?.days;
      entries.push({ key, at: r.created_at, kind: 'staff', title: `Retention extended${typeof days === 'number' ? ` by ${days} days` : ''}`, who, ...whyFields(r.new_value, false) });
      continue;
    }
  }

  // ── Overrides (org_overrides; the ending's reason from its revoke entry) ─────────────────────────────────────────
  const revokeReasons = new Map<string, unknown>();
  for (const r of audit) if (r.action === 'revoke_override' && typeof r.old_value === 'string') revokeReasons.set(r.old_value, r.new_value);
  const nowMs = Date.now();
  for (const o of (overridesRes.data ?? []) as Array<{
    id: string; type: string; value: string | null; target: { addons?: string[] } | null; starts_at: string | null; expires_at: string | null;
    reason: string | null; created_by: string | null; created_at: string; revoked_at: string | null; revoked_by: string | null;
  }>) {
    const label = OVERRIDE_LABELS[o.type] ?? humanize(o.type);
    const what = o.type === 'module_addon'
      ? `${label}: ${(o.target?.addons ?? []).map(sectionLabel).join(', ') || 'sections'}`
      : o.value ? `${label}: ${humanize(o.value)}` : label;
    const ends = o.expires_at ? `until ${consoleDay(o.expires_at)}` : 'no end date';
    const running = !o.revoked_at && (!o.starts_at || Date.parse(o.starts_at) <= nowMs) && (!o.expires_at || Date.parse(o.expires_at) > nowMs);
    const key = `override:${o.id}`;
    const entry: StoryEntry = {
      key, at: o.created_at, kind: 'staff', title: `Override applied: ${what}`, sub: running ? `Running, ${ends}` : ends,
      who: o.created_by ?? 'Staff', why: o.reason ?? null, whyNotRecorded: !o.reason,
    };
    const done = putBackAt.get(key);
    if (done) entry.putBackAt = done;
    else if (running) {
      entry.putBack = {
        kind: 'override',
        title: `End the override for ${org.name}`,
        sentence: `The ${what.toLowerCase()} override for ${org.name} ends now instead of ${o.expires_at ? `on ${consoleDay(o.expires_at)}` : 'running with no end date'}.`,
      };
    }
    entries.push(entry);
    if (o.revoked_at) {
      const revoke = revokeReasons.get(o.id);
      entries.push({
        key: `override-ended:${o.id}`, at: o.revoked_at, kind: 'staff',
        title: putBackOf(revoke) ? `Put back: override ended: ${what}` : `Override ended: ${what}`,
        who: o.revoked_by ?? 'Staff', ...whyFields(revoke, true),
      });
    } else if (o.expires_at && Date.parse(o.expires_at) <= nowMs) {
      entries.push({ key: `override-ran-out:${o.id}`, at: o.expires_at, kind: 'staff', title: `Override ran out: ${what}`, who: THE_PRODUCT, why: null });
    }
  }

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
    const who = e.source === 'stripe' ? 'Stripe' : e.actor_email ?? 'The customer';
    const title = e.event_type === 'plan_downgraded' ? `Downgraded: ${planName(e.previous_plan_id)} → ${planName(e.plan_id)}`
      : e.event_type === 'subscription_canceled' ? (e.source === 'stripe' ? 'Subscription ended in Stripe' : 'Subscription cancelled by the customer')
      : e.event_type === 'subscription_past_due' ? 'A payment was missed'
      : 'Payment recovered';
    entries.push({ key: `event:${e.id}`, at: e.occurred_at, kind: 'billing', title, who, why: null });
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
      entries.push({ key, at: r.created_at, kind: 'billing', title: `${r.action === 'plan_moved_up' ? 'Moved up' : 'Plan move scheduled'}: ${planName(p.from)} → ${planName(p.to)}`, who: actor, why: null });
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
  const ownerEmails = new Set(members.filter(m => m.role === 'owner').map(m => emailOf(m.user_id)).filter(Boolean));
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
  const firstPlan = [...audit].reverse().find(r => PLAN_MAIN.has(r.action) && r.field === 'plan_and_limit');
  const startPlan = obj(firstPlan?.old_value)?.plan_id ?? org.plan_id;
  const firstOwner = members.filter(m => m.role === 'owner').sort((a, b) => (a.accepted_at ?? '').localeCompare(b.accepted_at ?? ''))[0];
  entries.push({
    key: `created:${org.id}`, at: org.created_at, kind: 'people',
    title: `Club created on the ${planName(startPlan)} plan`, who: emailOf(firstOwner?.user_id) ?? THE_PRODUCT, why: null,
  });

  return entries.sort((a, b) => b.at.localeCompare(a.at) || a.key.localeCompare(b.key));
}

function aRole(role: string | null): string {
  const r = humanize(role).toLowerCase() || 'a member';
  return /^[aeiou]/.test(r) ? `an ${r}` : `a ${r}`;
}

/** Narrow a Story by type and words (case-insensitive over what each row says). */
export function filterStory(entries: StoryEntry[], opts: { kind?: StoryKind | null; words?: string }): StoryEntry[] {
  const w = (opts.words ?? '').trim().toLowerCase();
  return entries.filter(e => {
    if (opts.kind && e.kind !== opts.kind) return false;
    if (!w) return true;
    return [e.title, e.codes?.join(' '), e.sub, e.who, e.why].some(s => s?.toLowerCase().includes(w));
  });
}

// ── A person's Story ─────────────────────────────────────────────────────────────────────────────────────────────────

const PERSON_ACTIONS: Record<string, { title: string; sub?: string }> = {
  generate_reset_link: { title: 'Reset link made', sub: 'The email itself is not logged yet' },
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
 */
export async function buildPersonStory(person: { id: string; email: string; createdAt: string | null }): Promise<StoryEntry[]> {
  const email = person.email.toLowerCase();
  const [auditRes, notesRes, orgAuditRes, membersRes] = await Promise.all([
    supabaseAdmin.from('platform_audit_log').select('id, actor_email, action, field, old_value, new_value, created_at')
      .is('org_id', null).in('action', Object.keys(PERSON_ACTIONS))
      .order('created_at', { ascending: false }).limit(2000),
    supabaseAdmin.from('platform_user_notes').select('id, body, created_by_email, created_at')
      .eq('user_id', person.id).order('created_at', { ascending: false }).limit(SOURCE_CAP),
    supabaseAdmin.from('org_audit_log').select('id, org_id, actor_id, action, payload, created_at, organizations(name)')
      .eq('target_id', person.id).in('action', ['member_invited', 'member_removed', 'role_changed', 'member_suspended', 'member_reinstated'])
      .order('created_at', { ascending: false }).limit(SOURCE_CAP),
    supabaseAdmin.from('organization_members').select('role, invited_at, accepted_at, organizations(name, created_at)')
      .eq('user_id', person.id).limit(SOURCE_CAP),
  ]);

  const mentions = (v: unknown) => {
    if (typeof v === 'string') return v === person.id || v.toLowerCase() === email;
    const o = obj(v);
    return !!o && (o.userId === person.id || (typeof o.email === 'string' && o.email.toLowerCase() === email));
  };
  const entries: StoryEntry[] = [];
  for (const r of (auditRes.data ?? []) as AuditRow[]) {
    if (!mentions(r.new_value) && !mentions(r.old_value)) continue;
    const def = PERSON_ACTIONS[r.action];
    let sub = def.sub;
    if (r.action === 'update_user') {
      const n = obj(r.new_value);
      const parts = [str(n?.emailFrom) && str(n?.emailTo) ? `Email ${n?.emailFrom} → ${n?.emailTo}` : null,
        str(n?.nameTo) ? `Name ${str(n?.nameFrom) ?? 'none'} → ${n?.nameTo}` : null].filter(Boolean);
      if (parts.length) sub = parts.join(' · ');
    }
    entries.push({ key: `audit:${r.id}`, at: r.created_at, kind: 'staff', title: def.title, sub, who: r.actor_email ?? 'Staff', ...whyFields(r.new_value, true) });
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
  for (const m of (membersRes.data ?? []) as unknown as Array<{ role: string; invited_at: string | null; accepted_at: string | null; organizations: { name: string; created_at: string } | null }>) {
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
