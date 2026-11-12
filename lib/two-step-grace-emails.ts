import { supabaseAdmin } from './supabase-admin';
import { roleLabel } from './member-access';
import { switchOfRole } from './two-step-grace';
import { clubTwoStepWaiting, daysLeftUntil, type OrgTwoStepRow } from './two-step-club-status';
import { TWO_STEP_GRACE_DAYS } from './two-step-rule';
import { sendTwoStepEmail, twoStepGraceReminderEmail, twoStepGraceStartedEmail } from './two-step-emails';

/**
 * THE TWO GRACE EMAILS, SENT BY THE HOURLY TWO-STEP JOB (Board Ready · two-step sign-in, Part 4; drawings tab 8; ask 7;
 * owner ruling 2026-11-12: the 3-day email rides the existing hourly job, no new schedule).
 *
 *   - "{Club} now requires two-step sign-in": within the hour of a person's 14 days starting (a switch turned on, or a
 *     covered seat begun in a club that already requires it).
 *   - "N days left": 3 days before the deadline, if it is still off.
 *
 * Both from here, never inside the request that started the 14 days (session call, Part 4): a switch turned on for a
 * club of many coaches would otherwise send one email after another inside the owner's press, past the mail service's
 * per-second limit. Paced here, with a time budget; anyone left over is sent on the next hour.
 *
 * Once only: each email is stamped with the deadline it was sent for (`two_step_grace.start_email_for` /
 * `reminder_sent_for`, mig 475), CLAIMED before it is sent, so two runs never send it twice; a failed send gives the claim
 * back for the next hour. A switch turned off and on again is a new deadline, so its own emails.
 *
 * A person already inside the last 3 days who never got the first email (the switch was on before this shipped, or the
 * job was down) gets only the reminder. Someone past the deadline gets neither: signing in already sends them to set-up.
 */

const DAY_MS = 86_400_000;
export const GRACE_REMINDER_DAYS = 3;
/** The mail service's per-second limit is met by back-to-back single sends: one email at a time, spaced. */
const SEND_GAP_MS = 600;
/**
 * The app's server functions end at about 30 seconds, and the scheduler stops waiting at 27 (mig 183). So the job stops
 * starting sends well before that (/review 2026-11-12: an 80-second budget would have been cut off mid-send), and each
 * send gives up after SEND_TIMEOUT_MS. A big club's emails go out over several hours; nothing is skipped.
 */
export const GRACE_EMAIL_BUDGET_MS = 15_000;
const SEND_TIMEOUT_MS = 6_000;

type Stamps = { user_id: string; start_email_for: string | null; reminder_sent_for: string | null };

export type GraceEmailReport = { started: number; reminders: number; failed: number; leftForNextHour: number };

function sameInstant(a: string | null, b: string): boolean {
  return !!a && Date.parse(a) === Date.parse(b);
}

/** Claim one email for one person: true when this run may send it. The row is created (deadline-neutral) if missing. */
async function claim(orgId: string, userId: string, column: 'start_email_for' | 'reminder_sent_for', deadline: string, startIso: string, also?: 'start_email_for'): Promise<boolean> {
  // A person covered from the switch's own time has no row: one with starts_at = that start changes no deadline
  // (the rule takes the later of the switch and the person's start).
  const { error: rowErr } = await supabaseAdmin
    .from('two_step_grace')
    .upsert({ user_id: userId, organization_id: orgId, starts_at: startIso }, { onConflict: 'user_id,organization_id', ignoreDuplicates: true });
  if (rowErr) { console.error('[two-step grace emails] row not written', rowErr.message); return false; }
  const patch: Record<string, string> = { [column]: deadline };
  if (also) patch[also] = deadline;
  const { data, error } = await supabaseAdmin
    .from('two_step_grace')
    .update(patch)
    .eq('user_id', userId)
    .eq('organization_id', orgId)
    .or(`${column}.is.null,${column}.neq."${deadline}"`)
    .select('user_id');
  return !error && (data?.length ?? 0) > 0;
}

/**
 * A send that did not go: give the claim back so the next hour tries again — only if it still holds THIS deadline (a
 * switch changed meanwhile is a newer deadline, never cleared here). A send that timed out may have gone after all: the
 * retry carries the same once-only key, which the mail service remembers for 24 hours.
 */
async function giveBack(orgId: string, userId: string, column: 'start_email_for' | 'reminder_sent_for', deadline: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('two_step_grace')
    .update({ [column]: null })
    .eq('user_id', userId)
    .eq('organization_id', orgId)
    .eq(column, deadline);
  if (error) console.error('[two-step grace emails] claim not given back', error.message);
}

export async function sendDueGraceEmails(opts: { now?: number; stopAt?: number } = {}): Promise<GraceEmailReport> {
  const now = opts.now ?? Date.now();
  // The caller's own start counts (the resets ran first in the same request).
  const stopAt = opts.stopAt ?? Date.now() + GRACE_EMAIL_BUDGET_MS;
  const report: GraceEmailReport = { started: 0, reminders: 0, failed: 0, leftForNextHour: 0 };
  // No mail key (a local machine, a preview): nothing can be sent, so nothing is claimed and nothing reads as failed.
  if (!process.env.RESEND_API_KEY) return report;

  const { data: orgs, error } = await supabaseAdmin
    .from('organizations')
    .select('id, name, two_step_board_required_since, two_step_coaches_required_since, two_step_prompt_closed_at, is_test_organization, account_kind, plan_id')
    .or('two_step_board_required_since.not.is.null,two_step_coaches_required_since.not.is.null')
    .returns<OrgTwoStepRow[]>();
  if (error) throw error;

  let first = true;
  for (const org of orgs ?? []) {
    const waiting = (await clubTwoStepWaiting(org, now)).filter(p => !p.overdue && p.email);
    if (waiting.length === 0) continue;
    const { data: stampRows } = await supabaseAdmin
      .from('two_step_grace')
      .select('user_id, start_email_for, reminder_sent_for')
      .eq('organization_id', org.id)
      .returns<Stamps[]>();
    const stamps = new Map((stampRows ?? []).map(s => [s.user_id, s]));

    for (const person of waiting) {
      const s = stamps.get(person.userId);
      const msLeft = Date.parse(person.deadline) - now;
      const inLastDays = msLeft <= GRACE_REMINDER_DAYS * DAY_MS;
      const wantReminder = inLastDays && !sameInstant(s?.reminder_sent_for ?? null, person.deadline);
      const wantStarted = !inLastDays && !sameInstant(s?.start_email_for ?? null, person.deadline);
      if (!wantReminder && !wantStarted) continue;
      // Room for the gap and a whole send (its own time limit) before the budget ends, or it waits for the next hour.
      if (Date.now() + SEND_GAP_MS + SEND_TIMEOUT_MS > stopAt) { report.leftForNextHour += 1; continue; }

      const which = switchOfRole(person.role);
      if (!which) continue;
      const startIso = new Date(Date.parse(person.deadline) - TWO_STEP_GRACE_DAYS * DAY_MS).toISOString();
      const column = wantReminder ? 'reminder_sent_for' : 'start_email_for';
      // The reminder also settles the first email (never sent late, after the reminder).
      if (!(await claim(org.id, person.userId, column, person.deadline, startIso, wantReminder ? 'start_email_for' : undefined))) continue;

      if (!first) await new Promise(r => setTimeout(r, SEND_GAP_MS));
      first = false;
      const roleWord = roleLabel(person.role);
      const mail = wantReminder
        ? twoStepGraceReminderEmail({ orgName: org.name, which, roleWord, deadlineIso: person.deadline, daysLeft: daysLeftUntil(Date.parse(person.deadline), now) })
        : twoStepGraceStartedEmail({ orgName: org.name, which, roleWord, deadlineIso: person.deadline });
      const sent = await sendTwoStepEmail(person.email!, mail, wantReminder ? 'two_step_grace_reminder' : 'two_step_grace_started', {
        orgId: org.id,
        askedBy: null,
        idempotencyKey: `two-step-grace:${column}:${org.id}:${person.userId}:${person.deadline}`,
        timeoutMs: SEND_TIMEOUT_MS,
      });
      if (sent) {
        if (wantReminder) report.reminders += 1; else report.started += 1;
      } else {
        report.failed += 1;
        // A failed reminder keeps its first-email stamp on purpose: the first email is never sent after the reminder.
        await giveBack(org.id, person.userId, column, person.deadline);
      }
    }
  }
  return report;
}
