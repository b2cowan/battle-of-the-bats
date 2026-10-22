import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { resolvePersonNamer } from './db';
import { personDisplayName } from './families-read';
import { CLUB_EMAIL_STOPPED_AFTER_MS } from './families-words';

/**
 * THE EMAILS TAB (Club Tier Stage 7c — Ask 7 A, drawing 5): every email the club sent from Families, newest first. Two
 * sources merged, a page at a time (every Families read is paged):
 *
 *   · Email families — `family_email_sends` (mig 347): the subject, the message, who it went to, and counts. "Reached x
 *     of y"; "Sending…" while it goes; "Stopped at x of y" once a send has sat unfinished past the grace period.
 *   · Message this family — `family_messages` (mig 334): the date and who sent it, NEVER the words and never a count (the
 *     Stage 5a rule, unchanged). Its row says so honestly ("1 family", no x of y) rather than inventing numbers.
 *
 * Nothing here is editable. Gated by the route (`requireFamiliesAccess`).
 */

const EMAILS_PAGE = 50;

export interface EmailLogRow {
  key: string;
  kind: 'club' | 'family';
  id: string;
  sentAt: string;
  /** The subject (a club-wide send), or null (a one-household message keeps no words). */
  subject: string | null;
  /** Who it went to: the audience in words, or the family's name. */
  to: string;
  by: string | null;
  /** A club-wide send's counts; null for a one-household message. */
  counts: { families: number; reached: number; optedOut: number; failed: number; coaches: number } | null;
  state: 'sending' | 'stopped' | 'done';
}

export interface EmailLogPage {
  rows: EmailLogRow[];
  /** Every email the club has sent from Families — read with the first page only (0 on a later page). */
  total: number;
  /** The cursor for the next page (the oldest row's time), or null at the end. */
  next: string | null;
}

const CLUB_COLS = 'id, sent_at, sent_by, subject, audience_label, family_count, reached_count, opted_out_count, failed_count, coach_count, status';

/** One club-wide send's row. "Stopped" is a send still unfinished past the grace period (the server died mid-send). */
function clubRow(r: any, by: string | null, now: number): EmailLogRow {
  return {
    key: `club:${r.id}`, kind: 'club', id: r.id, sentAt: r.sent_at, subject: r.subject, to: r.audience_label, by,
    state: r.status === 'done' ? 'done' : now - new Date(r.sent_at).getTime() > CLUB_EMAIL_STOPPED_AFTER_MS ? 'stopped' : 'sending',
    counts: { families: r.family_count, reached: r.reached_count, optedOut: r.opted_out_count, failed: r.failed_count, coaches: r.coach_count },
  };
}

export async function readEmailLog(orgId: string, before: string | null): Promise<EmailLogPage> {
  const club = supabaseAdmin.from('family_email_sends').select(CLUB_COLS).eq('org_id', orgId);
  const family = supabaseAdmin.from('family_messages').select('id, sent_at, sent_by, person_id').eq('org_id', orgId);
  // The totals are the first page's: a "Show more" page does not re-count.
  const total = (table: 'family_email_sends' | 'family_messages') => before
    ? Promise.resolve({ count: 0, error: null })
    : supabaseAdmin.from(table).select('id', { count: 'exact', head: true }).eq('org_id', orgId);
  const [clubRows, familyRows, clubTotal, familyTotal] = await Promise.all([
    (before ? club.lt('sent_at', before) : club).order('sent_at', { ascending: false }).limit(EMAILS_PAGE),
    (before ? family.lt('sent_at', before) : family).order('sent_at', { ascending: false }).limit(EMAILS_PAGE),
    total('family_email_sends'),
    total('family_messages'),
  ]);
  for (const r of [clubRows, familyRows, clubTotal, familyTotal]) if (r.error) throw r.error;

  type Raw = { kind: 'club'; r: any } | { kind: 'family'; r: any };
  const merged: Raw[] = [
    ...(clubRows.data ?? []).map(r => ({ kind: 'club' as const, r })),
    ...(familyRows.data ?? []).map(r => ({ kind: 'family' as const, r })),
  ].sort((a, b) => String(b.r.sent_at).localeCompare(String(a.r.sent_at))).slice(0, EMAILS_PAGE);

  const personIds = [...new Set(merged.filter(m => m.kind === 'family').map(m => m.r.person_id as string))];
  const [nameOf, people] = await Promise.all([
    resolvePersonNamer(orgId, merged.map(m => m.r.sent_by)),
    personIds.length
      ? supabaseAdmin.from('org_people').select('id, first_name, last_name, email_normalized').eq('org_id', orgId).in('id', personIds)
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);
  if (people.error) throw people.error;
  const familyName = new Map((people.data ?? []).map((p: any) => [p.id as string, personDisplayName(p)]));

  const now = Date.now();
  const rows: EmailLogRow[] = merged.map(m => m.kind === 'club'
    ? clubRow(m.r, nameOf(m.r.sent_by), now)
    : {
      key: `family:${m.r.id}`, kind: 'family', id: m.r.id, sentAt: m.r.sent_at, subject: null,
      to: familyName.get(m.r.person_id) ?? '—', by: nameOf(m.r.sent_by), counts: null, state: 'done',
    });
  // More to read when either source filled its page, or the merge left rows over (they are older than the cursor).
  const clubN = clubRows.data?.length ?? 0;
  const familyN = familyRows.data?.length ?? 0;
  const more = clubN === EMAILS_PAGE || familyN === EMAILS_PAGE || clubN + familyN > rows.length;
  return {
    rows, total: (clubTotal.count ?? 0) + (familyTotal.count ?? 0),
    next: more && rows.length > 0 ? rows[rows.length - 1].sentAt : null,
  };
}

/** One club-wide send, as sent: its words and its counts (never a list of families). */
export async function readClubEmail(orgId: string, sendId: string): Promise<(EmailLogRow & { body: string }) | null> {
  const { data, error } = await supabaseAdmin.from('family_email_sends')
    .select(`${CLUB_COLS}, body`).eq('org_id', orgId).eq('id', sendId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const nameOf = await resolvePersonNamer(orgId, [data.sent_by]);
  return { ...clubRow(data, nameOf(data.sent_by), Date.now()), body: data.body };
}
