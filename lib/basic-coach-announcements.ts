import 'server-only';
import { sendEmail } from './email';
import { supabaseAdmin } from './supabase-admin';

/**
 * One-way announcements for org-less Basic coach teams (free-tier Phase 4c, table mig 117).
 *
 * Scope rules (do not widen):
 * - Coach-authored email announcements to roster contact_email values only.
 *   NO arbitrary recipient entry, parent accounts, chat, replies inbox, SMS/push, payment reminders,
 *   dues automation, or Premium pitch copy.
 * - Recipient emails are recomputed from `basic_coach_team_players` on every send and deduped.
 *   The announcement log stores counts, not recipient addresses, to keep contact PII minimized.
 * - Ownership is enforced by the CALLER (route) via `userOwnsBasicCoachTeam`; every query here
 *   is scoped by `basic_coach_team_id`.
 *
 * All queries use the service-role client (the table is RLS-enabled with no policies).
 */

export type BasicCoachTeamAnnouncementStatus = 'sent' | 'partial' | 'failed';

export type BasicCoachTeamAnnouncement = {
  id: string;
  basicCoachTeamId: string;
  subject: string;
  body: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  status: BasicCoachTeamAnnouncementStatus;
  sentAt: string;
  createdAt: string;
  updatedAt: string;
};

export type BasicCoachTeamAnnouncementInput = {
  subject?: string;
  body?: string;
};

export type BasicCoachTeamAnnouncementRecipientSummary = {
  /** Roster players whose contact email is valid + unique — the actual send list. */
  recipientCount: number;
  /** Total players on the master roster (the denominator: "X of N players"). */
  rosterPlayerCount: number;
  /** Roster players with ANY contact email filled in (valid or not). */
  rosterContactCount: number;
  /**
   * Players whose stored email is malformed. Email format is now validated at
   * roster-save time, so this is only ever > 0 for legacy rows saved before that
   * guard existed; the send path still skips them defensively. Not surfaced in
   * the UI (the roster gap caption uses recipientCount vs rosterPlayerCount).
   */
  skippedInvalidCount: number;
};

type BasicCoachTeamAnnouncementRow = {
  id: string;
  basic_coach_team_id: string;
  subject: string;
  body: string;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  status: BasicCoachTeamAnnouncementStatus;
  sent_at: string;
  created_at: string;
  updated_at: string;
};

type BasicCoachTeamContactRow = {
  contact_email: string | null;
};

type BasicCoachTeamNameRow = {
  name: string;
};

type RecipientLookup = BasicCoachTeamAnnouncementRecipientSummary & {
  emails: string[];
};

const ANNOUNCEMENT_COLUMNS =
  'id, basic_coach_team_id, subject, body, recipient_count, sent_count, failed_count, status, sent_at, created_at, updated_at';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SUBJECT_LENGTH = 160;
const MAX_BODY_LENGTH = 4000;
const MAX_RECIPIENTS_PER_ANNOUNCEMENT = 100;
const MAX_ANNOUNCEMENTS_PER_24_HOURS = 10;

export const BASIC_COACH_ANNOUNCEMENT_NO_RECIPIENTS_ERROR =
  'Add at least one roster contact email before sending an announcement.';
export const BASIC_COACH_ANNOUNCEMENT_RECIPIENT_LIMIT_ERROR =
  `Basic team announcements can send to up to ${MAX_RECIPIENTS_PER_ANNOUNCEMENT} roster contacts at a time.`;
export const BASIC_COACH_ANNOUNCEMENT_RATE_LIMIT_ERROR =
  `Basic team announcements are limited to ${MAX_ANNOUNCEMENTS_PER_24_HOURS} sends per 24 hours.`;

function mapAnnouncement(row: BasicCoachTeamAnnouncementRow): BasicCoachTeamAnnouncement {
  return {
    id: row.id,
    basicCoachTeamId: row.basic_coach_team_id,
    subject: row.subject,
    body: row.body,
    recipientCount: row.recipient_count,
    sentCount: row.sent_count,
    failedCount: row.failed_count,
    status: row.status,
    sentAt: row.sent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function announcementEmailHtml(params: { teamName: string; subject: string; body: string }): string {
  const subject = escapeHtml(params.subject);
  const body = escapeHtml(params.body).replace(/\n/g, '<br>');
  const teamName = escapeHtml(params.teamName);
  return `
<div style="font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;background:#111827;color:#F1F5F9;max-width:600px;margin:0 auto;padding:2rem;border:1px solid rgba(217,249,157,0.2);">
  <div style="margin-bottom:1.25rem;padding-bottom:1rem;border-bottom:1px solid rgba(217,249,157,0.16);">
    <span style="font-size:0.72rem;font-weight:900;color:#D9F99D;letter-spacing:0.14em;text-transform:uppercase;">${teamName}</span>
  </div>
  <h2 style="margin:0 0 1rem;color:#fff;font-size:1.25rem;line-height:1.3;">${subject}</h2>
  <div style="color:rgba(241,245,249,0.82);font-size:0.95rem;line-height:1.7;">${body}</div>
  <p style="margin:1.75rem 0 0;color:rgba(241,245,249,0.45);font-size:0.78rem;line-height:1.5;">
    You are receiving this because your email is listed as a roster contact for ${teamName}.
  </p>
</div>`;
}

function statusFor(sentCount: number, failedCount: number): BasicCoachTeamAnnouncementStatus {
  if (failedCount === 0) return 'sent';
  return sentCount > 0 ? 'partial' : 'failed';
}

function summaryFromLookup(lookup: RecipientLookup): BasicCoachTeamAnnouncementRecipientSummary {
  return {
    recipientCount: lookup.recipientCount,
    rosterPlayerCount: lookup.rosterPlayerCount,
    rosterContactCount: lookup.rosterContactCount,
    skippedInvalidCount: lookup.skippedInvalidCount,
  };
}

/**
 * Normalize a raw request body into an announcement input. Only whitelisted keys are included,
 * strings are trimmed, and direct API callers get the same length caps as the client editor.
 */
export function normalizeBasicCoachTeamAnnouncementBody(
  body: Record<string, unknown>,
): { input: BasicCoachTeamAnnouncementInput; error?: string } {
  const input: BasicCoachTeamAnnouncementInput = {};
  const trimmed = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

  if (body.subject !== undefined) input.subject = trimmed(body.subject).replace(/\s+/g, ' ');
  if (body.body !== undefined) input.body = trimmed(body.body);

  if (input.subject !== undefined && input.subject.length > MAX_SUBJECT_LENGTH) {
    return { input, error: `Subject is too long (max ${MAX_SUBJECT_LENGTH} characters).` };
  }
  if (input.body !== undefined && input.body.length > MAX_BODY_LENGTH) {
    return { input, error: `Message is too long (max ${MAX_BODY_LENGTH} characters).` };
  }

  return { input };
}

async function getRecipientLookup(basicCoachTeamId: string): Promise<RecipientLookup> {
  const { data, error } = await supabaseAdmin
    .from('basic_coach_team_players')
    .select('contact_email')
    .eq('basic_coach_team_id', basicCoachTeamId);

  if (error) throw error;

  const rows = data ?? [];
  const emails = new Set<string>();
  let rosterContactCount = 0;
  let skippedInvalidCount = 0;
  for (const row of rows) {
    const email = normalizeEmail((row as BasicCoachTeamContactRow).contact_email);
    if (!email) continue;
    rosterContactCount++;
    if (!EMAIL_RE.test(email)) {
      skippedInvalidCount++;
      continue;
    }
    emails.add(email);
  }

  return {
    emails: Array.from(emails).sort(),
    recipientCount: emails.size,
    rosterPlayerCount: rows.length,
    rosterContactCount,
    skippedInvalidCount,
  };
}

async function getTeamName(basicCoachTeamId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('basic_coach_teams')
    .select('name')
    .eq('id', basicCoachTeamId)
    .maybeSingle<BasicCoachTeamNameRow>();

  if (error) throw error;
  return data?.name?.trim() || 'Your team';
}

async function assertSendAllowance(basicCoachTeamId: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabaseAdmin
    .from('basic_coach_team_announcements')
    .select('id', { count: 'exact', head: true })
    .eq('basic_coach_team_id', basicCoachTeamId)
    .gte('sent_at', since);

  if (error) throw error;
  if ((count ?? 0) >= MAX_ANNOUNCEMENTS_PER_24_HOURS) {
    throw new Error(BASIC_COACH_ANNOUNCEMENT_RATE_LIMIT_ERROR);
  }
}

/** Count the current deduped roster-contact email recipients for the team. */
export async function getBasicCoachTeamAnnouncementRecipientSummary(
  basicCoachTeamId: string,
): Promise<BasicCoachTeamAnnouncementRecipientSummary> {
  return summaryFromLookup(await getRecipientLookup(basicCoachTeamId));
}

/** Recent one-way announcement log for a Basic coach team. */
export async function getBasicCoachTeamAnnouncements(
  basicCoachTeamId: string,
  limit = 10,
): Promise<BasicCoachTeamAnnouncement[]> {
  const { data, error } = await supabaseAdmin
    .from('basic_coach_team_announcements')
    .select(ANNOUNCEMENT_COLUMNS)
    .eq('basic_coach_team_id', basicCoachTeamId)
    .order('sent_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(limit, 25)));

  if (error) throw error;
  return (data ?? []).map(row => mapAnnouncement(row as BasicCoachTeamAnnouncementRow));
}

/** Send a one-way announcement to current roster contacts, then write the send log. */
export async function sendBasicCoachTeamAnnouncement(params: {
  basicCoachTeamId: string;
  createdByUserId: string;
  input: BasicCoachTeamAnnouncementInput;
}): Promise<{
  announcement: BasicCoachTeamAnnouncement;
  recipientSummary: BasicCoachTeamAnnouncementRecipientSummary;
}> {
  const subject = (params.input.subject ?? '').trim();
  const body = (params.input.body ?? '').trim();
  if (!subject) throw new Error('A subject is required.');
  if (!body) throw new Error('A message is required.');

  const [teamName, lookup] = await Promise.all([
    getTeamName(params.basicCoachTeamId),
    getRecipientLookup(params.basicCoachTeamId),
  ]);
  if (lookup.emails.length === 0) throw new Error(BASIC_COACH_ANNOUNCEMENT_NO_RECIPIENTS_ERROR);
  if (lookup.emails.length > MAX_RECIPIENTS_PER_ANNOUNCEMENT) {
    throw new Error(BASIC_COACH_ANNOUNCEMENT_RECIPIENT_LIMIT_ERROR);
  }
  await assertSendAllowance(params.basicCoachTeamId);

  const html = announcementEmailHtml({ teamName, subject, body });
  let sentCount = 0;
  let failedCount = 0;
  for (const email of lookup.emails) {
    try {
      const result = await sendEmail(email, subject, html);
      if (result.status === 'sent') sentCount++;
      else failedCount++;
    } catch (error) {
      console.error('[basic coach announcements] failed to send one recipient:', error);
      failedCount++;
    }
  }

  const sentAt = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('basic_coach_team_announcements')
    .insert({
      basic_coach_team_id: params.basicCoachTeamId,
      subject,
      body,
      recipient_count: lookup.emails.length,
      sent_count: sentCount,
      failed_count: failedCount,
      status: statusFor(sentCount, failedCount),
      sent_at: sentAt,
      created_by_user_id: params.createdByUserId,
    })
    .select(ANNOUNCEMENT_COLUMNS)
    .single<BasicCoachTeamAnnouncementRow>();

  if (error) throw error;
  return {
    announcement: mapAnnouncement(data),
    recipientSummary: summaryFromLookup(lookup),
  };
}
