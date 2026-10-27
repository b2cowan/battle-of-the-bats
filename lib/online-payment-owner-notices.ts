import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { notify } from './notify';
import { sendEmail, escapeHtml } from './email';
import { warmEmailButton, warmEmailDocument, warmEmailParagraph } from './email-envelope-warm';
import { getOrganizationBySlugForServer } from './server-organizations';
import { payoutsPath } from './online-payment-account';
import { formatStoredDate } from './timezone';
import { LEAVING_WORDS, PAYMENTS_TERMS_VERSION, TERMS_WORDS, termsVersionDate } from './online-payment-words';
import { closePagesIfPaymentsEnded, endingNotice, readOutstanding, upcomingEnding } from './online-payment-endings';
import type { Organization } from './types';
import { PLAN_CONFIG } from './plan-config';

/**
 * WHAT THE DAILY JOB TELLS A CLUB'S OWNER ABOUT ONLINE PAYMENTS (Club Tier Stage 12d-2 Parts 3 and 4; owner ruling 4,
 * 2026-10-27: the drawn emails ride the daily job). Each is decided from the rows and a once-only stamp (mig 401), so a
 * rerun sends nothing twice and a run that stopped part-way finishes on the next.
 *   - THE TERMS CHANGED (words §5.2, ask 6): a club still on an older version gets the owner's item and one email the day
 *     it is found, and one reminder 14 days later while it still hasn't agreed. Payments stay on throughout. Nothing is
 *     sent while the current version is counsel's draft: there is no change to tell.
 *   - AN ENDING THE OWNER DIDN'T CHOOSE (words §4.2): free time running out onto a plan without online payments, seven
 *     days ahead; a failed subscription payment, the day it failed (owner 2026-10-27). An item and one email; the card's
 *     notice is read live. And on the day itself, the club's open pay pages close (ask 11) — an ending with no event of its
 *     own (free time simply runs out) is caught here.
 * FieldLogicHQ's own envelope: it is the platform telling the club's owner. The owners only (Settings is theirs).
 */

const TERMS_REMIND_DAYS = 14;

type AccountRow = {
  org_id: string; terms_version: string | null; terms_notice_version: string | null; terms_notice_at: string | null;
  terms_reminded_at: string | null; ending_warned_for: string | null;
};

async function owners(orgId: string): Promise<{ userIds: string[]; emails: string[] }> {
  const { data, error } = await supabaseAdmin.from('organization_members').select('user_id')
    .eq('organization_id', orgId).eq('role', 'owner').eq('status', 'active'); // organization_id: predates org_id
  if (error) throw error;
  const userIds = [...new Set((data ?? []).map(m => m.user_id as string).filter(Boolean))];
  const emails: string[] = [];
  for (const id of userIds) {
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
    if (u?.user?.email) emails.push(u.user.email);
  }
  return { userIds, emails };
}

async function orgOf(orgId: string): Promise<Organization | null> {
  const { data } = await supabaseAdmin.from('organizations').select('slug').eq('id', orgId).maybeSingle();
  return data?.slug ? getOrganizationBySlugForServer(data.slug as string) : null;
}

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? '';

function termsEmail(org: Organization, changedLong: string, reminder: boolean): { subject: string; html: string } {
  const W = TERMS_WORDS;
  return {
    subject: reminder ? W.reminderSubject(org.name) : W.emailSubject(org.name),
    html: warmEmailDocument([
      warmEmailParagraph(escapeHtml(reminder ? W.reminderLead(org.name) : W.emailLead(changedLong, org.name))),
      warmEmailParagraph(escapeHtml(W.emailBody)),
      warmEmailButton(W.emailButton, `${appUrl()}${payoutsPath(org)}`),
    ].join('\n')),
  };
}

/** Every connected club's account row, in pages (a capped, unordered read would reach the same clubs every day). */
async function connectedAccounts(): Promise<AccountRow[]> {
  const out: AccountRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin.from('org_payment_accounts')
      .select('org_id, terms_version, terms_notice_version, terms_notice_at, terms_reminded_at, ending_warned_for')
      .is('disconnected_at', null).order('org_id').range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as AccountRow[]));
    if ((data ?? []).length < 1000) break;
  }
  return out;
}

/**
 * The terms changed: the item and the email the day a club is found behind, and the one reminder at 14 days.
 * ⚠ ONCE, claimed before it is sent (/review of 12d-2): the stamp is a conditional update that only one run can win, so
 * a run that dies after sending never sends again the next day (Resend's own key lasts a day); a club with no active owner
 * is not stamped, so it is told once it has one.
 */
export async function sendTermsNotices(now: Date = new Date()): Promise<{ told: number; reminded: number } | { skipped: 'draft' }> {
  const current = PAYMENTS_TERMS_VERSION;
  const changedOn = termsVersionDate(current);
  if (!changedOn) return { skipped: 'draft' };
  const changedLong = formatStoredDate(changedOn, { longMonth: true });
  // Behind = any version but the current one, or none recorded at all.
  const behind = (await connectedAccounts()).filter(a => a.terms_version !== current);
  let told = 0;
  let reminded = 0;
  for (const a of behind) {
    try {
      const org = await orgOf(a.org_id);
      if (!org) continue;
      const people = await owners(org.id);
      if (!people.userIds.length) continue;
      if (a.terms_notice_version !== current) {
        const { data: claimed } = await supabaseAdmin.from('org_payment_accounts')
          .update({ terms_notice_version: current, terms_notice_at: now.toISOString(), terms_reminded_at: null })
          .eq('org_id', org.id).or(`terms_notice_version.is.null,terms_notice_version.neq."${current}"`).select('org_id');
        if (!claimed?.length) continue;
        await notify({
          orgId: org.id, userIds: people.userIds, eventType: 'payments_terms_changed',
          title: TERMS_WORDS.itemTitle, body: TERMS_WORDS.itemBody(changedLong), link: payoutsPath(org),
          metadata: { termsVersion: current },
        });
        const mail = termsEmail(org, changedLong, false);
        for (const to of people.emails) {
          await sendEmail(to, mail.subject, mail.html, { kind: 'payments_terms_changed', orgId: org.id, idempotencyKey: `terms-changed:${org.id}:${current}:${to}` });
        }
        told += 1;
      } else if (!a.terms_reminded_at && a.terms_notice_at
        && now.getTime() - new Date(a.terms_notice_at).getTime() >= TERMS_REMIND_DAYS * 86_400_000) {
        const { data: claimed } = await supabaseAdmin.from('org_payment_accounts').update({ terms_reminded_at: now.toISOString() })
          .eq('org_id', org.id).is('terms_reminded_at', null).select('org_id');
        if (!claimed?.length) continue;
        const mail = termsEmail(org, changedLong, true);
        for (const to of people.emails) {
          await sendEmail(to, mail.subject, mail.html, { kind: 'payments_terms_reminder', orgId: org.id, idempotencyKey: `terms-reminder:${org.id}:${current}:${to}` });
        }
        reminded += 1;
      }
    } catch (e) {
      console.error('[online-payment-owner-notices] the terms notice was not sent:', a.org_id, e instanceof Error ? e.message : String(e));
    }
  }
  return { told, reminded };
}

/** An ending the owner didn't choose: the item and one email, once per ending; and pages closed once it has ended. */
export async function sendEndingWarnings(now: Date = new Date()): Promise<{ warned: number; pagesClosed: number }> {
  let warned = 0;
  let pagesClosed = 0;
  for (const a of await connectedAccounts()) {
    try {
      // Free time that ran out has no event of its own: its open pages close here, the day after it ended (ask 11).
      pagesClosed += await closePagesIfPaymentsEnded(a.org_id, 'daily job');
      const ending = await upcomingEnding(a.org_id, now);
      // The same moment, compared as a moment: the column reads back as "+00:00", ours is "Z" (/review).
      if (!ending || (a.ending_warned_for && new Date(a.ending_warned_for).getTime() === new Date(ending.at).getTime())) continue;
      const org = await orgOf(a.org_id);
      if (!org) continue;
      const people = await owners(org.id);
      if (!people.userIds.length) continue;
      // Claimed before it is sent (/review): one run wins the stamp; a run that dies after sending never repeats it.
      const { data: claimed } = await supabaseAdmin.from('org_payment_accounts')
        .update({ ending_warned_for: ending.at, ending_warned_at: now.toISOString() })
        .eq('org_id', org.id).or(`ending_warned_for.is.null,ending_warned_for.neq."${ending.at}"`).select('org_id');
      if (!claimed?.length) continue;
      const outstanding = await readOutstanding(org.id).catch(() => null);
      const notice = endingNotice(ending, org.name, outstanding);
      await notify({
        orgId: org.id, userIds: people.userIds, eventType: 'payments_ending',
        title: notice.title, body: notice.body, link: payoutsPath(org),
        metadata: { endingFor: ending.at, endingKind: ending.kind },
      });
      const owe = outstanding ? LEAVING_WORDS.oweToday(outstanding.familiesOwing, outstanding.teamsOwing) : '';
      const subject = ending.kind === 'comp'
        ? LEAVING_WORDS.ending.emailSubject(org.name, formatStoredDate(ending.firstDayOff, { longMonth: true }))
        : LEAVING_WORDS.ending.failedSubject(org.name);
      // `ending.email.lead` is the ending's own sentence (words §4.2): the billing page's for a comp, ours for a failed payment.
      const lead = ending.kind === 'comp'
        ? LEAVING_WORDS.ending.compSentence(PLAN_CONFIG[ending.targetPlan]?.label ?? ending.targetPlan, formatStoredDate(ending.firstDayOff, { longMonth: true }))
        : LEAVING_WORDS.ending.failedSentence(org.name);
      const html = warmEmailDocument([
        warmEmailParagraph(escapeHtml(lead)),
        warmEmailParagraph(escapeHtml(LEAVING_WORDS.ending.emailBody(owe))),
        warmEmailButton(LEAVING_WORDS.ending.emailButton, `${appUrl()}/${org.slug}/admin/org/billing`),
      ].join('\n'));
      for (const to of people.emails) {
        await sendEmail(to, subject, html, { kind: 'payments_ending_warning', orgId: org.id, idempotencyKey: `payments-ending:${org.id}:${ending.at}:${to}` });
      }
      warned += 1;
    } catch (e) {
      console.error('[online-payment-owner-notices] the ending warning was not sent:', a.org_id, e instanceof Error ? e.message : String(e));
    }
  }
  return { warned, pagesClosed };
}
