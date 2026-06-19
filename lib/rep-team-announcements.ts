import 'server-only';
import { sendEmail } from './email';
import { supabaseAdmin } from './supabase-admin';

/**
 * One-way team announcements for the PREMIUM Coaches Portal (rep team workspace, table mig 138).
 *
 * Premium >= Free parity: mirrors lib/basic-coach-announcements.ts (the free Basic floor) on the
 * org-scoped, season-spined Premium model so a Premium coach can email their roster and keep a send
 * log. Scope rules (kept aligned with the Basic floor — do not widen):
 * - Coach-authored email to the active roster's `guardian_email` values only. NO arbitrary recipient
 *   entry, replies inbox, chat, SMS/push, or dues/payment content.
 * - Recipient emails are recomputed from `rep_roster_players` (active, this program year) on every
 *   send and deduped. The log stores COUNTS, not addresses (PII minimization).
 * - Ownership/tenancy is enforced by the CALLER (route `resolveCoachContext`): org + coaching
 *   assignment + active program year. Every query here is scoped by program_year_id / team_id and
 *   inserts org_id/team_id/program_year_id. Service-role client (table is RLS-enabled, no policies).
 */

export type RepTeamAnnouncementStatus = 'sent' | 'partial' | 'failed';

export type RepTeamAnnouncement = {
  id: string;
  orgId: string;
  teamId: string;
  programYearId: string;
  subject: string;
  body: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  status: RepTeamAnnouncementStatus;
  sentAt: string;
  createdAt: string;
  updatedAt: string;
};

export type RepTeamAnnouncementInput = {
  subject?: string;
  body?: string;
};

export type RepTeamAnnouncementRecipientSummary = {
  /** Active roster players whose guardian email is valid + unique — the actual send list. */
  recipientCount: number;
  /** Active players on the roster (the denominator: "X of N players"). */
  rosterPlayerCount: number;
  /** Active players with ANY guardian email filled in (valid or not). */
  rosterContactCount: number;
  /** Active players whose stored guardian email is malformed (skipped defensively). */
  skippedInvalidCount: number;
};

type RepTeamAnnouncementRow = {
  id: string;
  org_id: string;
  team_id: string;
  program_year_id: string;
  subject: string;
  body: string;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  status: RepTeamAnnouncementStatus;
  sent_at: string;
  created_at: string;
  updated_at: string;
};

type RepRosterContactRow = {
  guardian_email: string | null;
};

type RecipientLookup = RepTeamAnnouncementRecipientSummary & {
  emails: string[];
};

const ANNOUNCEMENT_COLUMNS =
  'id, org_id, team_id, program_year_id, subject, body, recipient_count, sent_count, failed_count, status, sent_at, created_at, updated_at';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SUBJECT_LENGTH = 160;
const MAX_BODY_LENGTH = 4000;
const MAX_RECIPIENTS_PER_ANNOUNCEMENT = 100;
const MAX_ANNOUNCEMENTS_PER_24_HOURS = 10;

export const REP_TEAM_ANNOUNCEMENT_NO_RECIPIENTS_ERROR =
  'Add at least one guardian email on your roster before sending an announcement.';
export const REP_TEAM_ANNOUNCEMENT_RECIPIENT_LIMIT_ERROR =
  `Team announcements can send to up to ${MAX_RECIPIENTS_PER_ANNOUNCEMENT} roster contacts at a time.`;
export const REP_TEAM_ANNOUNCEMENT_RATE_LIMIT_ERROR =
  `Team announcements are limited to ${MAX_ANNOUNCEMENTS_PER_24_HOURS} sends per 24 hours.`;

function mapAnnouncement(row: RepTeamAnnouncementRow): RepTeamAnnouncement {
  return {
    id: row.id,
    orgId: row.org_id,
    teamId: row.team_id,
    programYearId: row.program_year_id,
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
<div style="font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;background:#111827;color:#F1F5F9;max-width:600px;margin:0 auto;padding:2rem;border:1px solid rgba(96,165,250,0.25);">
  <div style="margin-bottom:1.25rem;padding-bottom:1rem;border-bottom:1px solid rgba(96,165,250,0.18);">
    <span style="font-size:0.72rem;font-weight:900;color:#60A5FA;letter-spacing:0.14em;text-transform:uppercase;">${teamName}</span>
  </div>
  <h2 style="margin:0 0 1rem;color:#fff;font-size:1.25rem;line-height:1.3;">${subject}</h2>
  <div style="color:rgba(241,245,249,0.82);font-size:0.95rem;line-height:1.7;">${body}</div>
  <p style="margin:1.75rem 0 0;color:rgba(241,245,249,0.45);font-size:0.78rem;line-height:1.5;">
    You are receiving this because your email is listed as a guardian contact for ${teamName}.
  </p>
</div>`;
}

function statusFor(sentCount: number, failedCount: number): RepTeamAnnouncementStatus {
  if (failedCount === 0) return 'sent';
  return sentCount > 0 ? 'partial' : 'failed';
}

function summaryFromLookup(lookup: RecipientLookup): RepTeamAnnouncementRecipientSummary {
  return {
    recipientCount: lookup.recipientCount,
    rosterPlayerCount: lookup.rosterPlayerCount,
    rosterContactCount: lookup.rosterContactCount,
    skippedInvalidCount: lookup.skippedInvalidCount,
  };
}

/**
 * Normalize a raw request body into an announcement input. Whitelisted keys only, trimmed, with the
 * same length caps as the client editor (so direct API callers can't bypass them).
 */
export function normalizeRepTeamAnnouncementBody(
  body: Record<string, unknown>,
): { input: RepTeamAnnouncementInput; error?: string } {
  const input: RepTeamAnnouncementInput = {};
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

async function getRecipientLookup(programYearId: string): Promise<RecipientLookup> {
  const { data, error } = await supabaseAdmin
    .from('rep_roster_players')
    .select('guardian_email')
    .eq('program_year_id', programYearId)
    .eq('status', 'active');

  if (error) throw error;

  const rows = data ?? [];
  const emails = new Set<string>();
  let rosterContactCount = 0;
  let skippedInvalidCount = 0;
  for (const row of rows) {
    const email = normalizeEmail((row as RepRosterContactRow).guardian_email);
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

async function assertSendAllowance(teamId: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabaseAdmin
    .from('rep_team_announcements')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', teamId)
    .gte('sent_at', since);

  if (error) throw error;
  if ((count ?? 0) >= MAX_ANNOUNCEMENTS_PER_24_HOURS) {
    throw new Error(REP_TEAM_ANNOUNCEMENT_RATE_LIMIT_ERROR);
  }
}

/** Count the current deduped active-roster guardian-email recipients for the season. */
export async function getRepTeamAnnouncementRecipientSummary(
  programYearId: string,
): Promise<RepTeamAnnouncementRecipientSummary> {
  return summaryFromLookup(await getRecipientLookup(programYearId));
}

/** Recent one-way announcement log for a Premium rep team season. */
export async function getRepTeamAnnouncements(
  programYearId: string,
  limit = 10,
): Promise<RepTeamAnnouncement[]> {
  const { data, error } = await supabaseAdmin
    .from('rep_team_announcements')
    .select(ANNOUNCEMENT_COLUMNS)
    .eq('program_year_id', programYearId)
    .order('sent_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(limit, 25)));

  if (error) throw error;
  return (data ?? []).map(row => mapAnnouncement(row as RepTeamAnnouncementRow));
}

/** Send a one-way announcement to current active-roster guardian contacts, then write the send log. */
export async function sendRepTeamAnnouncement(params: {
  orgId: string;
  teamId: string;
  programYearId: string;
  teamName: string;
  createdByUserId: string;
  input: RepTeamAnnouncementInput;
}): Promise<{
  announcement: RepTeamAnnouncement;
  recipientSummary: RepTeamAnnouncementRecipientSummary;
}> {
  const subject = (params.input.subject ?? '').trim();
  const body = (params.input.body ?? '').trim();
  if (!subject) throw new Error('A subject is required.');
  if (!body) throw new Error('A message is required.');

  const lookup = await getRecipientLookup(params.programYearId);
  if (lookup.emails.length === 0) throw new Error(REP_TEAM_ANNOUNCEMENT_NO_RECIPIENTS_ERROR);
  if (lookup.emails.length > MAX_RECIPIENTS_PER_ANNOUNCEMENT) {
    throw new Error(REP_TEAM_ANNOUNCEMENT_RECIPIENT_LIMIT_ERROR);
  }
  await assertSendAllowance(params.teamId);

  const teamName = params.teamName?.trim() || 'Your team';
  const html = announcementEmailHtml({ teamName, subject, body });
  let sentCount = 0;
  let failedCount = 0;
  for (const email of lookup.emails) {
    try {
      const result = await sendEmail(email, subject, html);
      if (result.status === 'sent') sentCount++;
      else failedCount++;
    } catch (error) {
      console.error('[rep team announcements] failed to send one recipient:', error);
      failedCount++;
    }
  }

  const sentAt = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('rep_team_announcements')
    .insert({
      org_id: params.orgId,
      team_id: params.teamId,
      program_year_id: params.programYearId,
      subject,
      body,
      recipient_count: lookup.emails.length,
      sent_count: sentCount,
      failed_count: failedCount,
      status: statusFor(sentCount, failedCount),
      sent_at: sentAt,
      created_by: params.createdByUserId,
    })
    .select(ANNOUNCEMENT_COLUMNS)
    .single<RepTeamAnnouncementRow>();

  if (error) throw error;
  return {
    announcement: mapAnnouncement(data),
    recipientSummary: summaryFromLookup(lookup),
  };
}
