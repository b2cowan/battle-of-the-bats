import { supabaseAdmin } from './supabase-admin';
import { generateNoLoginToken, hashNoLoginToken } from './no-login-token';
import { writeAuditBeforeChange, writePlatformAuditLog, AuditFirstError } from './platform-audit';
import { resetTwoStep } from './two-step-reset';
import { twoStepRequirementsFor } from './two-step-requirements';
import {
  boardRecipients, sendTwoStepEmail, twoStepOwnerResetConfirmEmail, twoStepOwnerResetNoticeEmail, twoStepResetEmail,
} from './two-step-emails';
import { getUserDisplayName } from './user-display';
import { resetWaitMs } from './two-step-reset-wait';
import { isTeamWorkspaceOrg } from './team-workspace-kind';
import { FIELDLOGICHQ_CONTACT_EMAIL } from './fieldlogichq-contact';

/**
 * SUPPORT RESETS SOMEONE'S TWO-STEP (Board Ready · two-step sign-in, Part 3; drawings tab 7; ask 3). The owner is the one
 * person no one in the club can reset, and an email alone is the weakest identity check (the inbox is also where a
 * password reset goes). So the reset gets two more guards:
 *
 *   1. support writes the record (how they asked, why) — the platform audit line FIRST — and the person gets a
 *      confirmation link at the account's address; nothing changes until they press it;
 *   2. on confirm, the club's other owners, admins and treasurer are told (no link, no reason given) and can stop it by
 *      replying (support then holds it), and nothing happens for 24 hours;
 *   3. signing in with a real code (the app's, or a backup code) during that time cancels it;
 *   4. the hourly job (migration 470) runs it when due: the platform audit line FIRST, then signed out everywhere and every
 *      authenticator and backup code removed (lib/two-step-reset.ts), then the person is emailed. Idempotent; a held or
 *      cancelled reset is never run.
 *
 * A sole owner has no one to tell: the record says no club notice was sent (the known gap; support phones the owner on a
 * number from the club's records first, a runbook line). A person who owns no club gets the same confirmation and wait
 * without the club notice: "Lost your phone?" promises the support version that much (Part 2).
 */

const HOUR_MS = 3_600_000;
export const CONFIRM_LINK_MS = 3 * 24 * HOUR_MS;

export type ResetRow = {
  id: string;
  organization_id: string | null;
  user_id: string;
  asked_by: string;
  asked_how: string;
  reason: string;
  requested_at: string;
  confirmed_at: string | null;
  runs_at: string | null;
  held_at: string | null;
  held_by: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  completed_at: string | null;
  confirm_expires_at: string | null;
  club_notice_count: number | null;
};
const ROW = 'id, organization_id, user_id, asked_by, asked_how, reason, requested_at, confirmed_at, runs_at, held_at, held_by, cancelled_at, cancelled_by, completed_at, confirm_expires_at, club_notice_count';

/** How support was asked (the record window's select). */
export const ASKED_HOW = {
  email_from_account: 'Email from this account’s address',
  phone_verified: 'Phone call, number from the club’s records',
  other: 'Something else (say in Why)',
} as const;
export type AskedHow = keyof typeof ASKED_HOW;

export type OwnedClub = { id: string; name: string };

/** The clubs this person owns (an active owner seat), oldest first. */
export async function ownedClubs(userId: string): Promise<OwnedClub[]> {
  const { data } = await supabaseAdmin
    .from('organization_members')
    .select('organization_id, created_at, organizations(id, name, account_kind, plan_id)')
    .eq('user_id', userId)
    .eq('role', 'owner')
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .returns<{ organization_id: string; organizations: { id: string; name: string; account_kind: string | null; plan_id: string | null } | null }[]>();
  // A coach's own team workspace has no one else to tell, and is not a club the email can name.
  return (data ?? []).flatMap(r => (r.organizations && !isTeamWorkspaceOrg({ accountKind: r.organizations.account_kind, planId: r.organizations.plan_id })
    ? [{ id: r.organizations.id, name: r.organizations.name }] : []));
}

/** The one reset that is not done or cancelled, if any. */
export async function openReset(userId: string): Promise<ResetRow | null> {
  const { data } = await supabaseAdmin
    .from('two_step_owner_resets')
    .select(ROW)
    .eq('user_id', userId)
    .is('completed_at', null)
    .is('cancelled_at', null)
    .maybeSingle<ResetRow>();
  return data ?? null;
}

/** The last reset that finished or was cancelled (the record says so), if any. */
export async function lastClosedReset(userId: string): Promise<ResetRow | null> {
  const { data } = await supabaseAdmin
    .from('two_step_owner_resets')
    .select(ROW)
    .eq('user_id', userId)
    .or('completed_at.not.is.null,cancelled_at.not.is.null')
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle<ResetRow>();
  return data ?? null;
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.fieldlogichq.ca').replace(/\/$/, '');
}

export type Outcome<T = undefined> = { ok: true; value: T } | { ok: false; status: number; error: string; code?: string };

// ── 1. support asks ───────────────────────────────────────────────────────────────────────────────────────────────

export async function startSupportReset(args: {
  staffEmail: string;
  person: { id: string; email: string };
  askedHow: AskedHow;
  reason: string;
  now?: number;
}): Promise<Outcome<ResetRow>> {
  const { staffEmail, person, askedHow, reason } = args;
  const now = args.now ?? Date.now();
  // A request whose link expired before the person confirmed it waits on nothing: it is closed, so support can ask again
  // (/review of Part 3: it held the one-open-reset index forever).
  await supabaseAdmin.from('two_step_owner_resets')
    .update({ cancelled_at: new Date(now).toISOString(), cancelled_by: 'link_expired' })
    .eq('user_id', person.id).is('confirmed_at', null).is('completed_at', null).is('cancelled_at', null)
    .lt('confirm_expires_at', new Date(now).toISOString());
  if (await openReset(person.id)) return { ok: false, status: 409, error: 'A reset is already waiting for this person.', code: 'already_waiting' };
  const clubs = await ownedClubs(person.id);
  const token = generateNoLoginToken();
  const expires = new Date(now + CONFIRM_LINK_MS).toISOString();

  // Audit FIRST (the console's rule for a change support cannot take back once it runs): no record, no reset.
  let failed: (e: unknown) => Promise<void>;
  try {
    failed = await writeAuditBeforeChange(staffEmail, null, 'two_step_reset_requested', 'user_id', null,
      { userId: person.id, email: person.email, askedHow, clubs: clubs.map(c => c.id) }, { reason });
  } catch (err) {
    if (err instanceof AuditFirstError) return { ok: false, status: 503, error: err.message };
    throw err;
  }

  const { data: row, error } = await supabaseAdmin
    .from('two_step_owner_resets')
    .insert({
      organization_id: clubs[0]?.id ?? null,
      user_id: person.id,
      asked_by: staffEmail,
      asked_how: askedHow,
      reason,
      requested_at: new Date(now).toISOString(),
      confirm_token_hash: hashNoLoginToken(token),
      confirm_expires_at: expires,
    })
    .select(ROW)
    .single<ResetRow>();
  if (error || !row) {
    await failed(error ?? new Error('no row'));
    // The partial unique index: two staff pressed at once, and the other's row stands.
    if (error?.code === '23505') return { ok: false, status: 409, error: 'A reset is already waiting for this person.', code: 'already_waiting' };
    return { ok: false, status: 500, error: 'The reset wasn’t recorded. Nothing changed. Try again.' };
  }

  const mail = twoStepOwnerResetConfirmEmail({
    orgName: clubs[0]?.name ?? null,
    confirmUrl: `${appUrl()}/auth/two-step/confirm-reset?token=${encodeURIComponent(token)}`,
    expiresIso: expires,
  });
  const sent = await sendTwoStepEmail(person.email, mail, 'two_step_owner_reset_confirm', {
    orgId: clubs[0]?.id ?? null,
    askedBy: null,
    idempotencyKey: `two-step-reset-confirm:${row.id}`,
  });
  if (!sent) {
    // Nothing waits on an email that never left: the row is cancelled, and support is told to try again.
    await supabaseAdmin.from('two_step_owner_resets').update({ cancelled_at: new Date().toISOString(), cancelled_by: 'email_not_sent' }).eq('id', row.id);
    await failed(new Error('the confirmation email was not sent'));
    return { ok: false, status: 502, error: 'The confirmation email didn’t send, so nothing is waiting. Try again.' };
  }
  return { ok: true, value: row };
}

// ── 2. the person confirms ────────────────────────────────────────────────────────────────────────────────────────

export async function confirmSupportReset(token: string, now: number = Date.now()): Promise<Outcome<{ runsAt: string }>> {
  const hash = hashNoLoginToken(token);
  const { data: row } = await supabaseAdmin
    .from('two_step_owner_resets')
    .select(`${ROW}, confirm_token_hash`)
    .eq('confirm_token_hash', hash)
    .maybeSingle<ResetRow>();
  const gone = { ok: false as const, status: 410, error: 'This link no longer works. If you still need the reset, write to support again.', code: 'link_gone' };
  if (!row || row.cancelled_at || row.completed_at) return gone;
  if (row.confirmed_at && row.runs_at) {
    // A second press: already confirmed. If the club notice never finished (the first press failed part-way), it is sent
    // now; each email's once-only key keeps anyone from getting it twice (/review of Part 3).
    if (row.club_notice_count === null) await tellTheClubs(row, row.runs_at);
    return { ok: true, value: { runsAt: row.runs_at } };
  }
  if (!row.confirm_expires_at || Date.parse(row.confirm_expires_at) < now) return gone;

  const runsAt = new Date(now + resetWaitMs()).toISOString();
  const { data: claimed } = await supabaseAdmin
    .from('two_step_owner_resets')
    .update({ confirmed_at: new Date(now).toISOString(), runs_at: runsAt })
    .eq('id', row.id)
    .is('confirmed_at', null)
    .is('cancelled_at', null)
    .select('id');
  if (!claimed?.length) {
    const again = await openReset(row.user_id);
    return again?.runs_at ? { ok: true, value: { runsAt: again.runs_at } } : gone;
  }

  const told = await tellTheClubs(row, runsAt);
  const { data: got } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
  await writePlatformAuditLog(got?.user?.email ?? row.user_id, null, 'two_step_reset_confirmed', 'user_id', null,
    { resetId: row.id, userId: row.user_id, clubId: row.organization_id, runsAt, clubNoticeCount: told });
  return { ok: true, value: { runsAt } };
}

/**
 * The club is told: every club the person owns, its other owners, admins and treasurer. No link, no reason. Records how
 * many were told (0 = no club notice was sent, the sole-owner gap).
 */
async function tellTheClubs(row: ResetRow, runsAt: string): Promise<number> {
  const { data: got } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
  const person = got?.user ?? null;
  const clubs = await ownedClubs(row.user_id);
  let told = 0;
  for (const club of clubs) {
    const { data: me } = await supabaseAdmin.from('organization_members').select('display_name')
      .eq('organization_id', club.id).eq('user_id', row.user_id).maybeSingle<{ display_name: string | null }>();
    const ownerName = me?.display_name?.trim() || (person ? getUserDisplayName(person) : '') || 'The owner';
    const mail = twoStepOwnerResetNoticeEmail({ orgName: club.name, ownerName, runsIso: runsAt });
    const to = await boardRecipients(club.id, row.user_id);
    const results = await Promise.all(to.map(r => sendTwoStepEmail(r.email, mail, 'two_step_owner_reset_notice', {
      orgId: club.id,
      askedBy: null,
      // "Reply to this email" must reach someone (/legal, Part 3): replies go to the address the email names.
      replyTo: FIELDLOGICHQ_CONTACT_EMAIL,
      idempotencyKey: `two-step-reset-notice:${row.id}:${r.userId}`,
    })));
    told += results.filter(Boolean).length;
  }
  await supabaseAdmin.from('two_step_owner_resets').update({ club_notice_count: told }).eq('id', row.id);
  return told;
}

// ── 3. support holds, releases or cancels ─────────────────────────────────────────────────────────────────────────

export async function changeSupportReset(args: {
  staffEmail: string;
  userId: string;
  action: 'hold' | 'release' | 'cancel';
  reason: string;
}): Promise<Outcome<ResetRow | null>> {
  const row = await openReset(args.userId);
  if (!row) return { ok: false, status: 409, error: 'No reset is waiting for this person.', code: 'none_waiting' };
  const nowIso = new Date().toISOString();
  const patch = args.action === 'hold'
    ? { held_at: nowIso, held_by: args.staffEmail }
    : args.action === 'release'
      ? { held_at: null, held_by: null }
      : { cancelled_at: nowIso, cancelled_by: args.staffEmail };
  if (args.action === 'hold' && row.held_at) return { ok: true, value: row };
  if (args.action === 'release' && !row.held_at) return { ok: true, value: row };
  const { data, error } = await supabaseAdmin.from('two_step_owner_resets').update(patch).eq('id', row.id)
    .is('completed_at', null).is('cancelled_at', null).select(ROW).maybeSingle<ResetRow>();
  if (error) return { ok: false, status: 500, error: 'That didn’t save. Try again.' };
  if (!data) return { ok: false, status: 409, error: 'The reset has already run or been cancelled.', code: 'closed' };
  await writePlatformAuditLog(args.staffEmail, null, `two_step_reset_${args.action === 'hold' ? 'held' : args.action === 'release' ? 'released' : 'cancelled'}`,
    'user_id', null, { resetId: row.id, userId: row.user_id, clubId: row.organization_id }, { reason: args.reason });
  return { ok: true, value: args.action === 'cancel' ? null : data };
}

// ── 3b. the person signs in with a real code ──────────────────────────────────────────────────────────────────────

/** A code (the app's, or a backup code) proved this person: any reset waiting for them is cancelled. */
export async function cancelResetsOnProof(userId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from('two_step_owner_resets')
    .update({ cancelled_at: new Date().toISOString(), cancelled_by: 'signed_in_with_code' })
    .eq('user_id', userId)
    .is('completed_at', null)
    .is('cancelled_at', null)
    .select('id, organization_id');
  for (const r of data ?? []) {
    await writePlatformAuditLog('system', null, 'two_step_reset_cancelled', 'user_id', null,
      { resetId: r.id, userId, clubId: (r.organization_id as string | null) ?? null, why: 'signed_in_with_code' });
  }
  return data?.length ?? 0;
}

// ── 4. the hourly job ─────────────────────────────────────────────────────────────────────────────────────────────

export type RunReport = { due: number; done: number; failed: number; skipped: number };

/**
 * Every due reset (the hourly job), or only `onlyUserId`'s (the person record's "Run it now"). Each row is CLAIMED with a
 * conditional write before anything destructive (/review of Part 3): two runs at once, or a hold or a cancel landing
 * mid-run, can never reset twice or reset a held or cancelled one. A failed reset gives its claim back for the next hour.
 */
export async function runDueResets(actor: string, now: number = Date.now(), onlyUserId?: string): Promise<RunReport> {
  const report: RunReport = { due: 0, done: 0, failed: 0, skipped: 0 };
  let list = supabaseAdmin
    .from('two_step_owner_resets')
    .select(ROW)
    .not('confirmed_at', 'is', null)
    .lte('runs_at', new Date(now).toISOString())
    .is('held_at', null)
    .is('cancelled_at', null)
    .is('completed_at', null);
  if (onlyUserId) list = list.eq('user_id', onlyUserId);
  const { data: due } = await list.returns<ResetRow[]>();
  for (const row of due ?? []) {
    report.due += 1;
    let failed: (e: unknown) => Promise<void>;
    try {
      failed = await writeAuditBeforeChange(actor, null, 'two_step_reset_run', 'user_id', null,
        { resetId: row.id, userId: row.user_id, clubId: row.organization_id }, { reason: row.reason });
    } catch (err) {
      if (err instanceof AuditFirstError) { report.skipped += 1; continue; } // no record, no reset: the next hour tries again
      throw err;
    }
    // The CLAIM: completed_at is written first, and only while the row is still not held, cancelled or done. A hold or a
    // cancel (a sign-in with a code) that landed since the list was read wins; one landing after the claim is refused.
    const claimedAt = new Date().toISOString();
    const { data: claim } = await supabaseAdmin.from('two_step_owner_resets')
      .update({ completed_at: claimedAt })
      .eq('id', row.id).is('held_at', null).is('cancelled_at', null).is('completed_at', null)
      .select('id');
    if (!claim?.length) {
      await failed(new Error('held, cancelled or done before it ran'));
      report.skipped += 1;
      continue;
    }
    const outcome = await resetTwoStep(row.user_id);
    if (outcome !== 'done') {
      // Given back: the next hour tries again (only this run's own claim is released).
      await supabaseAdmin.from('two_step_owner_resets').update({ completed_at: null }).eq('id', row.id).eq('completed_at', claimedAt);
      await failed(new Error(outcome));
      report.failed += 1;
      continue;
    }
    report.done += 1;

    const { data: got } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
    const email = got?.user?.email;
    if (email) {
      let required = false;
      try { required = (await twoStepRequirementsFor({ id: row.user_id, email })).requiredNow; } catch { required = false; }
      const clubs = await ownedClubs(row.user_id);
      await sendTwoStepEmail(email, twoStepResetEmail({ orgName: clubs[0]?.name ?? null, byName: null, required }), 'two_step_reset', {
        orgId: row.organization_id,
        askedBy: null,
        idempotencyKey: `two-step-reset-done:${row.id}`,
      });
    }
  }
  return report;
}
