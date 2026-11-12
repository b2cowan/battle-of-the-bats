import { supabaseAdmin } from './supabase-admin';
import { sendEmail } from './email';
import { warmEmailButton, warmEmailDocument, warmEmailHeading, warmEmailParagraph, warmEmailSmall } from './email-envelope-warm';
import { FIELDLOGICHQ_CONTACT_EMAIL } from './fieldlogichq-contact';
import { possessive } from './utils';
import { getUserDisplayName } from './user-display';
import { NO_LINK, esc, whenWords } from './two-step-email-words';

export { whenWords };
export {
  passwordChangedEmail, twoStepGraceReminderEmail, twoStepGraceStartedEmail, twoStepTurnedOffEmail, twoStepTurnedOnEmail,
} from './two-step-email-words';

/**
 * THE TWO-STEP EMAILS OF PART 3 (Board Ready · two-step sign-in; drawings tabs 6, 7, 8). The words are drafts for Part 4's
 * copy pass. Every one is a security / account fact (CASL: non-commercial), so none carries an offer, and all but the
 * owner's own confirmation say "This email has no link on purpose" (/legal): an email about two-step that asks you to click
 * a link to fix something isn't from us.
 *
 *   two_step_reset                the person whose two-step was reset (by their club, or by support after the wait)
 *   two_step_requirement_off      the club's other owners, admins and treasurer, when the owner turns a requirement off
 *   two_step_owner_reset_confirm  the owner, from support's record: the ONE link, "Confirm the reset"
 *   two_step_owner_reset_notice   the club's other owners, admins and treasurer, once the owner confirmed (no reason given)
 */

export type BoardRecipient = { userId: string; email: string; name: string | null };

/** The club's owners, admins and treasurers with an active seat, except `exceptUserId`, with the address to write to. */
export async function boardRecipients(orgId: string, exceptUserId: string | null): Promise<BoardRecipient[]> {
  const { data } = await supabaseAdmin
    .from('organization_members')
    .select('user_id, display_name')
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .in('role', ['owner', 'admin', 'treasurer']);
  const rows = (data ?? []).filter(r => r.user_id && r.user_id !== exceptUserId);
  const out: BoardRecipient[] = [];
  await Promise.all(rows.map(async r => {
    try {
      const { data: got } = await supabaseAdmin.auth.admin.getUserById(r.user_id as string);
      const email = got?.user?.email;
      if (!email) return;
      const given = (r.display_name as string | null)?.trim();
      out.push({ userId: r.user_id as string, email, name: given || (got.user ? getUserDisplayName(got.user) || null : null) });
    } catch { /* one unreadable account never stops the others */ }
  }));
  return out;
}

// ── two_step_reset ────────────────────────────────────────────────────────────────────────────────────────────────

export function twoStepResetEmail(p: {
  /** The club in the sentences; null for a person support reset who owns no club. */
  orgName: string | null;
  /** Who did it: a club admin's name, or null for support's owner reset. */
  byName: string | null;
  /** Their seat still requires it: the next sign-in goes straight to setting it up. */
  required: boolean;
}): { subject: string; html: string } {
  const org = p.orgName ? esc(p.orgName) : null;
  const who = p.byName && org
    ? `${esc(p.byName)} at <strong>${org}</strong> reset your two-step sign-in on FieldLogicHQ.`
    : `FieldLogicHQ support reset your two-step sign-in, as you asked and confirmed.`;
  const next = p.required
    ? `Next time you sign in with your password, you’ll set it up again on your new phone. ${org ?? 'A club you belong to'} requires it, so signing in takes you straight there.`
    : `Two-step sign-in is now off. To turn it back on, sign in with your password and open Account, then Sign-in &amp; security.`;
  return {
    subject: 'Your two-step sign-in was reset',
    html: warmEmailDocument([
      warmEmailHeading('Your two-step sign-in was reset'),
      warmEmailParagraph(who),
      warmEmailParagraph('Your authenticator app and backup codes no longer work, and you were signed out everywhere.'),
      warmEmailParagraph(next),
      warmEmailParagraph(`If you didn’t ask for this, reset your password from the sign-in page (“Forgot your password?”) and write to ${esc(FIELDLOGICHQ_CONTACT_EMAIL)}.`),
      warmEmailSmall(NO_LINK),
    ].join('')),
  };
}

// ── two_step_requirement_off ──────────────────────────────────────────────────────────────────────────────────────

export function twoStepRequirementOffEmail(p: {
  orgName: string;
  ownerName: string;
  which: 'board' | 'coaches';
  atIso: string;
}): { subject: string; html: string } {
  const org = esc(p.orgName);
  const owner = esc(p.ownerName);
  const whom = p.which === 'board' ? 'the board' : 'coaches';
  return {
    subject: `${p.orgName} no longer requires two-step sign-in for ${whom}`,
    html: warmEmailDocument([
      warmEmailHeading(`${org} no longer requires two-step sign-in for ${whom}`),
      warmEmailParagraph(`${owner} turned off ${esc(possessive(p.orgName))} requirement on ${esc(whenWords(p.atIso))}. People who already have two-step sign-in on keep it. New ${p.which === 'board' ? 'board members' : 'coaches'} won’t be asked to set it up.`),
      warmEmailParagraph(`If you didn’t expect this, check with ${owner}. If you think someone else is using the owner’s account, write to ${esc(FIELDLOGICHQ_CONTACT_EMAIL)}.`),
      warmEmailSmall(NO_LINK),
    ].join('')),
  };
}

// ── two_step_owner_reset_confirm ──────────────────────────────────────────────────────────────────────────────────

/** `orgName`: the club the person owns, whose other admins are told; null for a person who owns no club. */
export function twoStepOwnerResetConfirmEmail(p: { orgName: string | null; confirmUrl: string; expiresIso: string }): { subject: string; html: string } {
  const tell = p.orgName ? `we tell ${esc(possessive(p.orgName))} other owners, admins and treasurer, and ` : '';
  return {
    subject: 'Confirm the reset of your two-step sign-in',
    html: warmEmailDocument([
      warmEmailHeading('Confirm the reset of your two-step sign-in'),
      warmEmailParagraph('You asked FieldLogicHQ support to reset two-step sign-in on your account. Press the button to confirm.'),
      warmEmailButton('Confirm the reset', p.confirmUrl),
      warmEmailParagraph(`Once you confirm, ${tell}the reset happens 24 hours later. Signing in with a code from your authenticator app, or a backup code, during that time cancels it.`),
      warmEmailParagraph(`If you didn’t ask for this, don’t press the button: nothing changes. Write to ${esc(FIELDLOGICHQ_CONTACT_EMAIL)} so we know.`),
      warmEmailSmall(`The button works until ${esc(whenWords(p.expiresIso))}.`),
    ].join('')),
  };
}

// ── two_step_owner_reset_notice ───────────────────────────────────────────────────────────────────────────────────

export function twoStepOwnerResetNoticeEmail(p: { orgName: string; ownerName: string; runsIso: string }): { subject: string; html: string } {
  const org = esc(p.orgName);
  const owner = esc(p.ownerName);
  return {
    subject: `Two-step sign-in for ${possessive(p.orgName)} owner will be reset`,
    html: warmEmailDocument([
      warmEmailHeading(`Two-step sign-in for ${esc(possessive(p.orgName))} owner will be reset`),
      warmEmailParagraph(`${owner} asked FieldLogicHQ support to reset their two-step sign-in. It will be reset on ${esc(whenWords(p.runsIso))}.`),
      warmEmailParagraph(`If you think this isn’t right, reply to this email or write to ${esc(FIELDLOGICHQ_CONTACT_EMAIL)} before then. We’ll hold the reset until we’ve checked with ${owner}.`),
      warmEmailSmall(NO_LINK),
    ].join('')),
  };
}

export type TwoStepEmailKind =
  | 'two_step_reset' | 'two_step_requirement_off' | 'two_step_owner_reset_confirm' | 'two_step_owner_reset_notice'
  | 'two_step_grace_started' | 'two_step_grace_reminder'
  | 'two_step_turned_on' | 'two_step_turned_off' | 'password_changed';

/** Send one of these; best effort (a failed send never undoes the change it reports). */
export async function sendTwoStepEmail(
  to: string,
  mail: { subject: string; html: string },
  kind: TwoStepEmailKind,
  opts: { orgId: string | null; askedBy: string | null; replyTo?: string; idempotencyKey?: string; timeoutMs?: number },
): Promise<boolean> {
  try {
    const res = await sendEmail(to, mail.subject, mail.html, {
      kind,
      orgId: opts.orgId ?? undefined,
      askedBy: opts.askedBy ?? undefined,
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
      ...(opts.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : {}),
      ...(opts.timeoutMs ? { timeoutMs: opts.timeoutMs } : {}),
    });
    return res.status === 'sent';
  } catch {
    return false;
  }
}
