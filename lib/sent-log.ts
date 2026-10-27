/**
 * The sent-email log, read (Support console Stage 5, owner Q3/Q6 2026-10-26; drawing E; threats T14-T17). Server only.
 *
 * ⚠ EVERY CALLER CHECKS THE `sent_log` POWER FIRST (Super admin, Support, Billing; T16). These readers then apply the
 * one rule they own: emails to STAFF accounts read for Super admin only, filtered in the query (T15) — staff = the
 * bootstrap list plus every platform_users row, as Stage 2's people lookups exclude them.
 *
 * ⚠ Nothing here returns a subject, a body or a link: there are none to return (T13). A row is a fixed kind label,
 * the address, the club, times and the mail service's word.
 */
import { supabaseAdmin } from './supabase-admin';
import { getBootstrapAdminEmails, type PlatformRole } from './platform-auth';
import { STORY_EMAIL_KINDS, emailKindLabel } from './email-kinds';
import { SENT_LOG_KEEP_DAYS } from './email-log';
import { isBounceReason, isSentState, type BounceReason, type SentState } from './sent-log-words';
import { isUuid } from './utils';

export const SENT_SEARCHES_PER_DAY = 200;
const SEARCH_KEEP_MS = 2 * 86_400_000;
const PAGE_MAX = 100;

export type SentEmail = {
  id: string;
  kind: string;
  label: string;
  to: string;
  orgId: string | null;
  orgName: string | null;
  state: SentState;
  stateAt: string;
  bounceReason: BounceReason | null;
  sentAt: string;
  /** The mail service said Delayed at some point (a Delivered row then reads "after a delay"). */
  wasDelayed: boolean;
};

export type SentEmailDetail = SentEmail & {
  resendId: string | null;
  askedBy: string | null;
  timeline: { state: SentState; at: string; bounceReason: BounceReason | null }[];
};

const COLUMNS = 'id, kind, recipient_email, org_id, state, state_at, bounce_reason, created_at, organizations(name)';

/** PostgREST returns an embedded organization as one object or a one-item list. */
export type OrgEmbed = { name?: string } | { name?: string }[] | null | undefined;
export const orgNameOf = (org: OrgEmbed): string | null => (Array.isArray(org) ? org[0]?.name : org?.name) ?? null;

type Row = {
  id: string; kind: string; recipient_email: string; org_id: string | null; state: string; state_at: string;
  bounce_reason: string | null; created_at: string; organizations?: OrgEmbed;
};

const reasonOf = (v: unknown): BounceReason | null => (isBounceReason(v) ? v : null);

function toEmail(r: Row): SentEmail {
  return {
    id: r.id,
    kind: r.kind,
    label: emailKindLabel(r.kind),
    to: r.recipient_email,
    orgId: r.org_id,
    orgName: orgNameOf(r.organizations),
    state: isSentState(r.state) ? r.state : 'sent',
    stateAt: r.state_at,
    bounceReason: reasonOf(r.bounce_reason),
    sentAt: r.created_at,
    wasDelayed: false,
  };
}

/** Every staff address, lowercased: the bootstrap list and the staff list (active or not). */
export async function staffEmailList(): Promise<string[]> {
  const out = new Set(getBootstrapAdminEmails());
  const { data } = await supabaseAdmin.from('platform_users').select('email');
  for (const r of data ?? []) if (typeof r.email === 'string') out.add(r.email.trim().toLowerCase());
  return [...out];
}

/** PostgREST's `in` list, each value double-quoted (addresses carry dots, plus signs and at signs). */
function inList(values: string[]): string {
  return `(${values.map(v => `"${v.replace(/["\\]/g, '')}"`).join(',')})`;
}

const readFailed = () => new Error('The sent-email log could not be read.');
const keepCutoff = () => new Date(Date.now() - SENT_LOG_KEEP_DAYS * 86_400_000).toISOString(); // utc-intentional: retention instant

/**
 * Emails newest first, last 90 days. `to` = one exact address (a person's tab, a search); `state` = one state;
 * `storyOnly` = only the kinds the Story shows.
 */
export async function listSentEmails(role: PlatformRole, opts: {
  to?: string | null; state?: SentState | null; storyOnly?: boolean; offset?: number; limit?: number;
} = {}): Promise<{ rows: SentEmail[]; total: number }> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), PAGE_MAX);
  const offset = Math.max(opts.offset ?? 0, 0);
  let q = supabaseAdmin
    .from('platform_account_emails')
    .select(COLUMNS, { count: 'exact' })
    .gte('created_at', keepCutoff())
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (opts.to) q = q.eq('recipient_email', opts.to.trim().toLowerCase());
  if (opts.state) q = q.eq('state', opts.state);
  if (opts.storyOnly) q = q.in('kind', [...STORY_EMAIL_KINDS]);
  if (role !== 'super_admin') {
    const staff = await staffEmailList();
    if (staff.length > 0) q = q.not('recipient_email', 'in', inList(staff));
  }
  const { data, error, count } = await q;
  if (error) throw readFailed();
  const rows = ((data ?? []) as Row[]).map(toEmail);
  await markDelayed(rows);
  return { rows, total: count ?? rows.length };
}

/** Flags the rows whose timeline holds a Delayed event: one read for the whole page, never a row at a time. */
async function markDelayed(rows: SentEmail[]): Promise<void> {
  const ids = rows.filter(r => r.state === 'delivered').map(r => r.id);
  if (ids.length === 0) return;
  const { data } = await supabaseAdmin.from('platform_account_email_events').select('email_id').in('email_id', ids).eq('state', 'delayed');
  const delayed = new Set((data ?? []).map(e => e.email_id as string));
  for (const r of rows) r.wasDelayed = delayed.has(r.id);
}

/** One email with its timeline, or null (missing, older than 90 days, or a staff address for a role that may not see it). */
export async function getSentEmail(role: PlatformRole, id: string): Promise<SentEmailDetail | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await supabaseAdmin
    .from('platform_account_emails')
    .select(`${COLUMNS}, resend_id, asked_by_user_id`)
    .eq('id', id)
    .gte('created_at', keepCutoff())
    .maybeSingle();
  if (error) throw readFailed();
  if (!data) return null;
  const row = data as Row & { resend_id: string | null; asked_by_user_id: string | null };
  if (role !== 'super_admin' && (await staffEmailList()).includes(row.recipient_email)) return null;
  const { data: events } = await supabaseAdmin
    .from('platform_account_email_events')
    .select('state, occurred_at, bounce_reason')
    .eq('email_id', id)
    .order('occurred_at', { ascending: true });
  const timeline = (events ?? [])
    .filter(e => isSentState(e.state))
    .map(e => ({ state: e.state as SentState, at: e.occurred_at as string, bounceReason: reasonOf(e.bounce_reason) }));
  return {
    ...toEmail(row),
    wasDelayed: timeline.some(e => e.state === 'delayed'),
    resendId: row.resend_id,
    askedBy: row.asked_by_user_id,
    timeline,
  };
}

/** When the oldest kept email was sent ("Recording started on …"), or null when nothing is kept yet. */
export async function recordingStartedAt(): Promise<string | null> {
  const { data } = await supabaseAdmin.from('platform_account_emails').select('created_at').order('created_at', { ascending: true }).limit(1);
  return (data?.[0]?.created_at as string | undefined) ?? null;
}

/**
 * One Sent emails search, counted for the daily limit (T17). False when this staff member is past the limit. Never the
 * words typed (A3): the row is who and when.
 */
export async function takeSentEmailSearch(actorUserId: string): Promise<boolean> {
  const since = new Date(Date.now() - 86_400_000).toISOString(); // utc-intentional: an instant comparison
  const { count, error } = await supabaseAdmin
    .from('platform_sent_email_searches')
    .select('id', { count: 'exact', head: true })
    .eq('actor_user_id', actorUserId)
    .gte('searched_at', since);
  // A count that cannot be read fails CLOSED: a lookup tool's brake does not open when it breaks.
  if (error) return false;
  if ((count ?? 0) >= SENT_SEARCHES_PER_DAY) return false;
  await supabaseAdmin.from('platform_sent_email_searches').insert({ actor_user_id: actorUserId });
  await supabaseAdmin.from('platform_sent_email_searches').delete().lt('searched_at', new Date(Date.now() - SEARCH_KEEP_MS).toISOString()); // utc-intentional: retention instant
  return true;
}
