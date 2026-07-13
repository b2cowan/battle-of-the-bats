// ─────────────────────────────────────────────────────────────────────────────
// Dues reminders — platform-wide daily sweep (SCHEDULED_JOBS_WIRING_PLAN.md).
//
// Runs BOTH proximity waves (30-day and 7-day) for every rep team with a current
// program year, across all orgs. Per team it reuses the exact machinery the
// manual buttons use — getDueReminderCandidates' window + 7-day-resend-cooldown
// semantics, the same sent-stamps, the same guardian grouping, and byte-identical
// email copy to the org-admin wave route — so a scheduled run and a human-clicked
// run can never disagree or double-send.
//
// Two deliberate improvements over the org-wave route (flagged in review):
//  • Stamps are written ONLY for installments whose email actually reported
//    'sent' — a skipped/failed send never suppresses the next attempt.
//  • Per-team try/catch — one broken team never stops the platform sweep.
//
// Respects the per-team "Automatic Dues Reminders" coach toggle
// (rep_program_years.auto_reminders_enabled), same as the org-admin wave route.
// The never-paid nudge (remind-unpaid) stays deliberately manual — it has no
// sent-stamp, so automating it would re-email families every day.
//
// Invoked by POST /api/platform-admin/dues-reminders (super-admin or scheduler
// secret); the pg_cron schedule (migration 183) ticks it daily.
// ─────────────────────────────────────────────────────────────────────────────
import {
  getInsightsDigestTeams,
  getDueReminderCandidates,
  markInstallments30ReminderSent,
  markInstallments7ReminderSent,
  type InsightsDigestTeam,
} from './db';
import type { RepDueReminderCandidate } from './types';
import { sendEmail } from './email';

// URGENT WAVE FIRST. The two windows overlap (30-day fires within 32 days, 7-day within 9),
// so an installment due in ~8 days qualifies for both. Running the 7-day wave first and
// skipping any installment it already handled means each installment gets AT MOST its most
// relevant email per run — never a "due in ~30 days" note for something a week away, and
// never two emails in one daily sweep. (The manual org-admin buttons fire one wave at a time,
// so they never hit this; only the combined daily sweep needs the guard.)
const WAVES: { window: 30 | 7; daysAhead: number }[] = [
  // Same daysAhead values as the manual wave buttons (9/32) — candidate parity.
  { window: 7, daysAhead: 9 },
  { window: 30, daysAhead: 32 },
];

export interface DuesRemindersSweepOptions {
  /** Narrow the sweep to one org (manual/test runs). */
  orgId?: string;
  /** Narrow the sweep to one team (manual/test runs). */
  teamId?: string;
  /** Compute everything, send/stamp nothing; returns per-recipient previews. */
  dryRun?: boolean;
}

export interface DuesReminderPreview {
  teamId: string;
  teamName: string;
  orgSlug: string;
  window: 30 | 7;
  guardians: { email: string; players: string[]; installments: number; total: number }[];
}

export interface DuesRemindersSweepResult {
  teamsConsidered: number;
  /** Teams skipped because the coach turned Automatic Dues Reminders off. */
  teamsSkippedToggle: number;
  remindersChecked: number;
  emailsSent: number;
  /** Sends that reported skipped/provider_error OR threw — their installments were NOT stamped. */
  emailsFailed: number;
  /** Installments due but whose player has no guardian email on file — no address to send to,
   *  so they're never stamped and re-appear each run. Surfaced so a silently-unreachable family
   *  is visible in the audit log rather than looking like a healthy zero. */
  noGuardianEmail: number;
  installmentsTagged: number;
  errors: { teamId: string; message: string }[];
  /** Present only on dryRun. */
  previews?: DuesReminderPreview[];
}

function fmtDate(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-CA', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

function fmt(n: number) {
  return `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** The org-admin wave route's email, byte-for-byte (one copy review covers both surfaces).
 *  No proximity phrase in the sentence — the exact due date + installment n-of-m are on each
 *  row below, so the intro is window-agnostic (owner copy call 2026-07-13). */
function reminderEmail(teamName: string, window: 30 | 7, guardianFirst: string, items: RepDueReminderCandidate[]) {
  const rows = items
    .map(
      i =>
        `<li style="margin-bottom:0.5rem;">
              <strong>${[i.playerFirstName, i.playerLastName].filter(Boolean).join(' ')}</strong> — ${fmt(i.amount)} due ${fmtDate(i.dueDate)}
              (Installment ${i.installmentNumber} of ${i.totalInstallments})
            </li>`,
    )
    .join('');
  const html = `
<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:2rem;">
  <p>Hi ${guardianFirst},</p>
  <p>This is a friendly reminder that the following dues installments are coming due for your player(s) on <strong>${teamName}</strong>:</p>
  <ul style="padding-left:1.25rem;">${rows}</ul>
  <p>To view your full payment schedule or if you have already submitted payment, please contact your coach directly.</p>
  <p style="color:rgba(0,0,0,0.5);font-size:0.85rem;margin-top:2rem;">FieldLogicHQ</p>
</div>`;
  return { subject: `Upcoming dues reminder (${window} days) — ${teamName}`, html };
}

async function sweepTeamWave(
  team: InsightsDigestTeam,
  wave: { window: 30 | 7; daysAhead: number },
  dryRun: boolean,
  result: DuesRemindersSweepResult,
  handled: Set<string>,
): Promise<void> {
  const rawCandidates = await getDueReminderCandidates(team.teamId, wave.daysAhead, wave.window);
  // Drop anything a more-urgent wave already claimed this run, then claim the rest so a
  // later (less-urgent) wave can't re-notify the same installment.
  const candidates = rawCandidates.filter(c => !handled.has(c.installmentId));
  for (const c of candidates) handled.add(c.installmentId);
  result.remindersChecked += candidates.length;
  if (candidates.length === 0) return;

  const byGuardian = new Map<string, RepDueReminderCandidate[]>();
  for (const c of candidates) {
    if (!c.guardianEmail) { result.noGuardianEmail += 1; continue; }
    const list = byGuardian.get(c.guardianEmail) ?? [];
    list.push(c);
    byGuardian.set(c.guardianEmail, list);
  }
  if (byGuardian.size === 0) return;

  if (dryRun) {
    result.previews!.push({
      teamId: team.teamId, teamName: team.teamName, orgSlug: team.orgSlug, window: wave.window,
      guardians: [...byGuardian.entries()].map(([email, items]) => ({
        email,
        players: [...new Set(items.map(i => [i.playerFirstName, i.playerLastName].filter(Boolean).join(' ')))],
        installments: items.length,
        total: Math.round(items.reduce((s, i) => s + i.amount, 0) * 100) / 100,
      })),
    });
    return;
  }

  const taggedIds: string[] = [];
  for (const [email, items] of byGuardian) {
    const guardianFirst = items[0].guardianFirstName ?? 'there';
    const { subject, html } = reminderEmail(team.teamName, wave.window, guardianFirst, items);
    // sendEmail's fetch is unguarded and CAN throw (DNS/reset/timeout), distinct from its
    // 'provider_error' return. Contain it per-guardian: one family's network blip must not
    // abort the batch — that would skip the stamp for families ALREADY emailed above and
    // re-send to them tomorrow. A throw is just another failed send (unstamped ⇒ retried).
    let status: string;
    try {
      status = (await sendEmail(email, subject, html)).status;
    } catch {
      status = 'threw';
    }
    if (status === 'sent') {
      result.emailsSent += 1;
      for (const i of items) taggedIds.push(i.installmentId);
    } else {
      result.emailsFailed += 1;
    }
  }

  if (taggedIds.length) {
    if (wave.window === 30) await markInstallments30ReminderSent(taggedIds);
    else await markInstallments7ReminderSent(taggedIds);
    result.installmentsTagged += taggedIds.length;
  }
}

/**
 * Run both dues-reminder waves across every current rep team (or a narrowed set).
 * Per-team failures are contained — one broken team never stops the sweep.
 */
export async function runDuesRemindersSweep(
  opts: DuesRemindersSweepOptions = {},
): Promise<DuesRemindersSweepResult> {
  // Same platform-wide enumerator as the Insights digest (current program year per
  // team, draft|active, newest wins) — one definition of "a team the platform serves".
  const teams = await getInsightsDigestTeams({ orgId: opts.orgId, teamId: opts.teamId });
  const dryRun = !!opts.dryRun;

  const result: DuesRemindersSweepResult = {
    teamsConsidered: teams.length,
    teamsSkippedToggle: 0,
    remindersChecked: 0,
    emailsSent: 0,
    emailsFailed: 0,
    noGuardianEmail: 0,
    installmentsTagged: 0,
    errors: [],
    ...(dryRun ? { previews: [] as DuesReminderPreview[] } : {}),
  };

  for (const team of teams) {
    if (!team.autoRemindersEnabled) {
      result.teamsSkippedToggle += 1;
      continue;
    }
    try {
      // One claim-set per team per run — the 7-day wave claims first, the 30-day wave
      // skips whatever it claimed (see WAVES ordering note).
      const handled = new Set<string>();
      for (const wave of WAVES) {
        await sweepTeamWave(team, wave, dryRun, result, handled);
      }
    } catch (e) {
      result.errors.push({ teamId: team.teamId, message: e instanceof Error ? e.message : String(e) });
    }
  }
  return result;
}
