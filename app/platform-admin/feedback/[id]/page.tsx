import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hasPlatformPower, requirePlatformAreaView } from '@/lib/platform-auth';
import { consoleClock, consoleDay, consoleWhen } from '@/lib/console-dates';
import { ADMIN_EMAIL, SENDING_ADDRESS } from '@/lib/email';
import {
  NO_REPLY_WORDS, REPLY_FROM_NAME, REPLY_MAX_CHARS, replySubject, replyTarget, signedFirstName, stateAfterReply,
} from '@/lib/feedback-reply';
import { personHref } from '@/lib/observability/sample-who';
import { SENT_STATES, isSentState, type SentState } from '@/lib/sent-log-words';
import { isUuid } from '@/lib/utils';
import FeedbackRecord, { type ConversationTurn, type FeedbackRecordProps } from './FeedbackRecord';

/**
 * A feedback item's record (Support console Stage 5, Part 6; drawing D2). New: a feedback row used to open nothing — its
 * message hid behind a disclosure arrow and every row carried a status dropdown. The record reads first: who sent it, from
 * which club, the issue it hit, and the CONVERSATION — their message, then everything we sent about it (the automatic
 * "Feedback received" email and each staff reply), each with what the mail service says happened to it.
 *
 * The Reply door is for the roles that hold the `reply` power; for one of them whose item cannot be answered (anonymous,
 * the account gone, the address changed, too old) the door is replaced by one line of words. The address is decided here
 * on the server (`replyTarget`) and again by the reply route — the browser never names one.
 */
export const metadata = { title: 'Feedback — Support console' };

type FeedbackRow = {
  id: string;
  org_id: string | null;
  user_id: string | null;
  user_email: string | null;
  submitter_name: string | null;
  type: string;
  category: string | null;
  title: string | null;
  body: string;
  status: string;
  severity: string | null;
  context: Record<string, unknown> | null;
  escalated_at: string | null;
  triaged_by: string | null;
  triaged_at: string | null;
  created_at: string;
  organizations: { id: string; name: string } | { id: string; name: string }[] | null;
};
type ReplyRow = {
  id: string; staff_email: string; signed_name: string; body: string; status: string;
  account_email_id: string | null; created_at: string;
};
type EmailRow = { id: string; kind: string; state: string; state_at: string; created_at: string };

function requestIdOf(context: FeedbackRow['context']): string | null {
  const v = context && typeof context === 'object' ? (context as Record<string, unknown>).requestId : null;
  return typeof v === 'string' && v ? v : null;
}

/** "19 times · 2 orgs · last Oct 26 at 9:12 a.m." */
function issueLine(count: number, orgs: number, lastSeen: string | null): string {
  const parts = [`${count.toLocaleString('en-CA')} ${count === 1 ? 'time' : 'times'}`, `${orgs.toLocaleString('en-CA')} ${orgs === 1 ? 'org' : 'orgs'}`];
  if (lastSeen) parts.push(`last ${consoleDay(lastSeen)} at ${consoleClock(lastSeen)}`);
  return parts.join(' · ');
}

/** A state's word and tone, with its time when the mail service gave one. */
const stateWord = (state: SentState, at: string | null = null): ConversationTurn['state'] =>
  ({ word: SENT_STATES[state].word, tone: SENT_STATES[state].tone, at: at ? consoleClock(at) : null });

/** The mail service's word for an email, with its time. */
const stateOf = (email: EmailRow | undefined): ConversationTurn['state'] =>
  email && isSentState(email.state) ? stateWord(email.state, email.state_at) : stateWord('sent');

export default async function FeedbackRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAreaView('feedback');
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const { data: fb } = await supabaseAdmin
    .from('feedback_submissions')
    .select(
      'id, org_id, user_id, user_email, submitter_name, type, category, title, body, status, severity, context, escalated_at, triaged_by, triaged_at, created_at, organizations(id, name)',
    )
    .eq('id', id)
    .maybeSingle<FeedbackRow>();
  if (!fb) notFound();

  const canReply = hasPlatformPower(auth.role, 'reply');
  const canTriage = hasPlatformPower(auth.role, 'feedback_triage');
  const staffEmail = (auth.user.email ?? '').toLowerCase();

  const [repliesRes, emailsRes, issue, target, staffRes] = await Promise.all([
    supabaseAdmin
      .from('platform_feedback_replies')
      .select('id, staff_email, signed_name, body, status, account_email_id, created_at')
      .eq('feedback_id', id)
      .order('created_at', { ascending: true })
      .limit(200),
    supabaseAdmin
      .from('platform_account_emails')
      .select('id, kind, state, state_at, created_at')
      .eq('feedback_id', id)
      .order('created_at', { ascending: true })
      .limit(200),
    readIssue(requestIdOf(fb.context)),
    canReply ? replyTarget(fb) : Promise.resolve(null),
    canReply && staffEmail
      ? supabaseAdmin.from('platform_users').select('display_name').eq('email', staffEmail).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const replies = (repliesRes.data ?? []) as ReplyRow[];
  const emails = (emailsRes.data ?? []) as EmailRow[];
  const emailById = new Map(emails.map(e => [e.id, e]));
  const org = Array.isArray(fb.organizations) ? fb.organizations[0] ?? null : fb.organizations;
  const senderName = fb.submitter_name || fb.user_email || 'Not signed in';

  // ── The conversation: their message, then everything we sent about it, oldest first ──
  const turns: Array<ConversationTurn & { at: string }> = [{
    key: 'message', at: fb.created_at, when: consoleWhen(fb.created_at), who: senderName, body: fb.body,
  }];
  const receipt = emails.filter(e => e.kind === 'feedback_receipt').at(-1);
  if (receipt) {
    turns.push({
      key: `receipt-${receipt.id}`, at: receipt.created_at, when: consoleWhen(receipt.created_at),
      who: 'Feedback received', tag: 'sent by the product', state: stateOf(receipt),
      body: 'The automatic thank-you every sender gets.', quiet: true,
    });
  }
  for (const r of replies) {
    if (r.status === 'draft') continue; // never pressed: nothing was started
    const who = `${r.signed_name || REPLY_FROM_NAME} replied`;
    const linked = r.account_email_id ? emailById.get(r.account_email_id) : undefined;
    const state: ConversationTurn['state'] =
      r.status === 'sent' ? stateOf(linked)
      : r.status === 'unknown' ? stateWord('unconfirmed')
      : r.status === 'failed' ? { word: 'Not sent: the mail service refused it', tone: 'bad', at: null }
      : { word: 'Sending', tone: 'plain', at: null };
    turns.push({ key: `reply-${r.id}`, at: r.created_at, when: consoleWhen(r.created_at), who, state, body: r.body });
  }
  turns.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  // ── The Reply door ──
  let reply: FeedbackRecordProps['reply'] = null;
  if (canReply && target) {
    if (!target.ok) {
      reply = { kind: 'none', words: NO_REPLY_WORDS[target.reason] };
    } else {
      const latestSeenAt = replies
        .filter(r => ['sending', 'sent', 'unknown'].includes(r.status))
        .map(r => r.created_at)
        .sort()
        .at(-1) ?? null;
      const staffFirst = signedFirstName((staffRes.data as { display_name: string | null } | null)?.display_name);
      reply = {
        kind: 'door',
        window: {
          feedbackId: fb.id,
          name: target.name || fb.submitter_name || target.to,
          to: target.to,
          subject: replySubject(fb.title),
          fromLine: `${REPLY_FROM_NAME} · ${SENDING_ADDRESS}`,
          repliesGoTo: ADMIN_EMAIL,
          signedName: staffFirst,
          signedFrom: REPLY_FROM_NAME,
          moves: stateAfterReply(fb.status).next !== null,
          latestSeenAt,
          maxChars: REPLY_MAX_CHARS,
        },
      };
    }
  }

  const props: FeedbackRecordProps = {
    id: fb.id,
    title: fb.title || fb.body.slice(0, 80),
    type: fb.type,
    status: fb.status,
    severity: fb.severity,
    escalated: !!fb.escalated_at,
    from: fb.user_id ? { name: senderName, href: personHref(fb.user_id) } : null,
    club: fb.org_id && org ? { id: fb.org_id, name: org.name } : null,
    when: consoleWhen(fb.created_at),
    category: fb.category,
    conversation: turns.map(t => ({ key: t.key, when: t.when, who: t.who, tag: t.tag, state: t.state, body: t.body, quiet: t.quiet })),
    issue,
    triagedBy: fb.triaged_by ? { by: fb.triaged_by, at: fb.triaged_at ? consoleWhen(fb.triaged_at) : null } : null,
    canTriage,
    reply,
  };
  return <FeedbackRecord {...props} />;
}

/** The error issue this feedback hit: its last-seen request id → an event → its group. Null when there is none. */
async function readIssue(requestId: string | null): Promise<FeedbackRecordProps['issue']> {
  if (!requestId) return null;
  const { data: event } = await supabaseAdmin
    .from('error_events')
    .select('group_id')
    .eq('request_id', requestId)
    .not('group_id', 'is', null)
    .limit(1)
    .maybeSingle<{ group_id: string }>();
  if (!event?.group_id) return null;
  const { data: group } = await supabaseAdmin
    .from('error_groups')
    .select('id, title, occurrence_count, distinct_org_count, last_seen_at')
    .eq('id', event.group_id)
    .maybeSingle<{ id: string; title: string; occurrence_count: number; distinct_org_count: number; last_seen_at: string | null }>();
  if (!group) return null;
  return { id: group.id, title: group.title, line: issueLine(group.occurrence_count, group.distinct_org_count, group.last_seen_at) };
}
