/**
 * A lead's timeline (Support console Stage 7 Part 4; drawing A, words /marketing 2026-10-27). Fixed sentences only — a
 * step moved, a source set, a club linked or unlinked, the form filled again, a note — read from the notes store and
 * the edit log, matched on the exact action and the lead's id. Server only; the lead page asks the growth power first.
 *
 * ⚠ An edit written since Stage 7 Part 0 keeps field names, the step and fixed-list codes, never a value: its sub-line
 * says WHAT changed ("Next action changed"), not to what. An older entry still holds the whole row; its next action and
 * follow-up are read from it (the growth power alone reads this page).
 */
import { supabaseAdmin } from './supabase-admin';
import { consoleDay, consoleWhen } from './console-dates';
import { EARLY_ACCESS_STATUS_LABELS, isEarlyAccessStatus, leadPageLabel } from './early-access-admin';
import { featureWords, lostWords, sourceWords } from './lead-views';
import { LEAD_ACTIONS } from './platform-audit-reason';
import { planName } from './platform-story-view';
import type { OfferedClub } from './lead-book';

export type TimelineEntry = {
  key: string;
  at: string;
  when: string;
  title: string;
  sub?: string;
  /** A note's words, shown as the visitor or staff wrote them (rendered as text, never as markup). */
  body?: string;
  noteId?: string;
  quiet?: boolean;
};

type Audit = { id: string; actor_email: string | null; action: string; old_value: unknown; new_value: unknown; created_at: string };
type Note = { id: string; body: string | null; author_email: string | null; from_old_box: boolean; created_at: string; removed_at: string | null };

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

function stepName(v: unknown): string {
  return typeof v === 'string' && isEarlyAccessStatus(v) ? EARLY_ACCESS_STATUS_LABELS[v] : 'an old step';
}

function changedOf(o: Record<string, unknown>, n: Record<string, unknown>): string[] {
  if (Array.isArray(n.changed)) return n.changed.filter((x): x is string => typeof x === 'string');
  return Object.keys(n).filter(k => k !== 'updated_at' && JSON.stringify(o[k] ?? null) !== JSON.stringify(n[k] ?? null));
}

/** The sub-line of an edit: the next action and follow-up as they became (an older entry), or what changed (Stage 7 on). */
function editSub(changed: string[], n: Record<string, unknown>): string | undefined {
  const parts: string[] = [];
  const legacy = !Array.isArray(n.changed);
  if (changed.includes('next_action')) parts.push(legacy && str(n.next_action) ? `Next action: ${n.next_action}` : 'Next action changed');
  if (changed.includes('follow_up_due_at')) parts.push(legacy && str(n.follow_up_due_at) ? `Follow-up ${consoleDay(`${n.follow_up_due_at}T12:00:00Z`)}` : 'Follow-up changed');
  if (changed.includes('source_words')) parts.push('Source detail changed');
  return parts.length ? parts.join(' · ') : undefined;
}

export async function leadTimeline(lead: {
  id: string; created_at: string; source_path: string | null; features_interested: string[] | null;
  submission_count: number; last_submitted_at: string | null; linked_at: string | null; converted_org_id: string | null;
}, offers: OfferedClub[]): Promise<{ entries: TimelineEntry[]; notRead: boolean }> {
  const [auditRes, notesRes, staffRes] = await Promise.all([
    supabaseAdmin.from('platform_audit_log').select('id, actor_email, action, old_value, new_value, created_at')
      .eq('field', lead.id).in('action', [...LEAD_ACTIONS]).order('created_at', { ascending: false }).limit(500),
    supabaseAdmin.from('early_access_lead_notes').select('id, body, author_email, from_old_box, created_at, removed_at')
      .eq('lead_id', lead.id).order('created_at', { ascending: false }),
    supabaseAdmin.from('platform_users').select('email, display_name'),
  ]);
  const notRead = !!(auditRes.error || notesRes.error);
  const names = new Map(((staffRes.data ?? []) as { email: string; display_name: string | null }[])
    .map(s => [s.email.toLowerCase(), s.display_name?.trim() || null]));
  const who = (email: string | null) => (email ? names.get(email.toLowerCase()) ?? email : 'Staff');

  const audit = (auditRes.data ?? []) as Audit[];
  const orgIds = new Set<string>();
  for (const a of audit) { const id = str(obj(a.new_value).orgId) ?? str(obj(a.old_value).orgId); if (id) orgIds.add(id); }
  if (lead.converted_org_id) orgIds.add(lead.converted_org_id);
  const { data: orgRows } = orgIds.size
    ? await supabaseAdmin.from('organizations').select('id, name').in('id', [...orgIds])
    : { data: [] };
  const orgName = new Map(((orgRows ?? []) as { id: string; name: string }[]).map(o => [o.id, o.name]));
  const club = (id: string | null) => (id ? orgName.get(id) ?? 'a club since deleted' : 'a club');

  const entries: TimelineEntry[] = [];
  const page = leadPageLabel(lead.source_path);
  const thePage = page === 'Other pages' ? 'another page'
    : page.startsWith('Inside the product') ? 'inside the product'
      : page.startsWith('The ') ? `the ${page.slice(4)}` : `the ${page} page`;

  entries.push({
    key: 'form', at: lead.created_at, when: consoleWhen(lead.created_at),
    title: `Filled the early-access form on ${thePage}`,
    sub: featureWords(lead.features_interested ?? []) ? `Asked about ${featureWords(lead.features_interested ?? [])}` : undefined,
  });
  if (lead.submission_count > 1 && lead.last_submitted_at && lead.last_submitted_at !== lead.created_at) {
    entries.push({ key: 'form-again', at: lead.last_submitted_at, when: consoleWhen(lead.last_submitted_at), title: `Filled the form again, on ${thePage}` });
  }

  for (const a of audit) {
    const o = obj(a.old_value);
    const n = obj(a.new_value);
    const actor = who(a.actor_email);
    const base = { key: `audit:${a.id}`, at: a.created_at, when: consoleDay(a.created_at) };
    if (a.action === 'update_early_access_lead') {
      const changed = changedOf(o, n);
      const moved = o.internal_status !== n.internal_status;
      const sourceSet = changed.includes('source') && str(n.source);
      let title: string;
      if (moved && o.internal_status === 'new' && n.internal_status === 'contacted' && sourceSet) {
        title = `${actor} marked it Contacted and set the source: ${sourceWords(str(n.source))}`;
      } else if (moved) {
        title = `${actor} moved it from ${stepName(o.internal_status)} to ${stepName(n.internal_status)}`;
        if (n.internal_status === 'lost' && str(n.lost_reason)) title += `: ${lostWords(str(n.lost_reason))}`;
        if (sourceSet) title += `, and set the source: ${sourceWords(str(n.source))}`;
      } else if (sourceSet) {
        title = `${actor} set the source: ${sourceWords(str(n.source))}`;
      } else if (changed.length > 0 && changed.every(c => c === 'last_contacted_at' || c === 'last_contacted_by')) {
        title = `${actor} marked it contacted`;
      } else {
        title = `${actor} edited the lead`;
      }
      entries.push({ ...base, title, sub: editSub(changed, n) });
    } else if (a.action === 'link_early_access_lead') {
      const id = str(n.orgId);
      entries.push({
        ...base, when: consoleWhen(a.created_at),
        title: str(n.method) === 'offered'
          ? `${actor} linked ${club(id)}, the offered match (same email). Step: Signed up`
          : `${actor} linked ${club(id)} by hand`,
        sub: 'Follow-up and next action cleared',
      });
    } else if (a.action === 'unlink_early_access_lead') {
      entries.push({ ...base, title: `${actor} unlinked ${club(str(o.orgId))}. Step: ${stepName(n.internal_status)}` });
    } else if (a.action === 'dismiss_early_access_offer') {
      entries.push({ ...base, title: `${actor} said ${club(str(n.orgId))} is not this lead’s club`, quiet: true });
    }
  }

  for (const note of (notesRes.data ?? []) as Note[]) {
    const base = { key: `note:${note.id}`, at: note.created_at, when: consoleDay(note.created_at), noteId: note.removed_at ? undefined : note.id };
    if (note.removed_at) entries.push({ ...base, title: 'A note was removed', quiet: true });
    else if (note.from_old_box) entries.push({ ...base, title: 'From the old notes box', body: note.body ?? '' });
    else entries.push({ ...base, title: `${who(note.author_email)} added a note`, body: note.body ?? '' });
  }

  // A club that signed up with this lead's email and is waiting to be confirmed (never linked by itself).
  if (!lead.linked_at) {
    for (const c of offers) {
      const plan = c.status === 'trialing' ? `on a ${planName(c.planId)} trial` : `on ${planName(c.planId)}`;
      entries.push({ key: `offer:${c.orgId}`, at: c.createdAt, when: consoleWhen(c.createdAt), title: `A club signed up with this email: ${c.name}, ${plan}. Not linked yet.` });
    }
  }

  // The linked club's subscription start, from the billing records (recorded since Oct 25, 2026). It fires when a
  // trial starts too, so it says "started a subscription", never "started paying".
  if (lead.linked_at && lead.converted_org_id) {
    const { data: started } = await supabaseAdmin.from('platform_events').select('id, plan_id, occurred_at')
      .eq('org_id', lead.converted_org_id).eq('event_type', 'subscription_started').order('occurred_at', { ascending: false }).limit(3);
    for (const e of (started ?? []) as { id: string; plan_id: string | null; occurred_at: string }[]) {
      entries.push({ key: `event:${e.id}`, at: e.occurred_at, when: consoleWhen(e.occurred_at), title: `The club started a subscription: ${planName(e.plan_id)}` });
    }
  }

  entries.sort((x, y) => y.at.localeCompare(x.at));
  return { entries, notRead };
}
