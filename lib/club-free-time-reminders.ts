import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { fetchAll } from './supabase-paging';
import { sendEmail, escapeHtml, SITE_URL } from './email';
import { warmEmailButton, warmEmailDocument, warmEmailParagraph } from './email-envelope-warm';
import { grantsEnabled } from './entitlement-grants';
import { orgOwnerEmails } from './notify-recipients';
import { getBillingHref, billingUrlOrgFromRow } from './billing-urls';
import { getPlanGatingMap } from './plan-gating-server';
import { PLAN_CONFIG, getEffectiveTournamentLimit } from './plan-config';
import { PLAN_RANK } from './plan-features';
import { sectionLabel } from './platform-labels';
import { SLOT_STATUSES } from './tournament-slot';
import { isTeamWorkspaceOrg } from './team-workspace-kind';
import {
  FREE_TIME_ENDING_DAYS, FREE_TIME_KINDS, GIVABLE_SECTIONS, REOPENED_ENDED_CLUB, daysLeft, foldGrants, isGrantRunning, isGrantablePlan,
  lastDayOfInstant, ownFactsOf, type EffectiveFacts, type GrantRow as DoorGrantRow,
} from './free-time';
import { clubEndingEmailWords, clubEndingReminderDue, type ClubEndingEmailInput } from './club-free-time-reminders-words';
import type { OrgPlan } from './types';

/**
 * THE DAILY JOB'S CLUB FREE-TIME REMINDERS (Free time, the same rules for clubs and coaches; owner rulings 2026-11-19, ask A,
 * and the build go of 2026-11-20: all three kinds). Every running club grant with an end date — a whole plan, sections, or a
 * billing status — in its last 14 days is emailed at 14 days and at 3 days before its last free day, to every active owner,
 * once each per end. A grant with no end date never is. The coach's twin is `lib/portal-free-time-reminders.ts`, whose
 * shape this follows line for line.
 *
 * ONLY WHEN SOMETHING CHANGES AT THE END: a plan grant the club has since bought (or overtaken), sections the club holds on
 * its own, and a billing status on a club whose own status is active are skipped — nothing would change, so there is
 * nothing to tell. Coaches Portals (their own job), suspended clubs, and a server with grants switched off (a grant there
 * does nothing) are skipped too.
 *
 * ⚠ ONCE, CLAIMED BEFORE IT IS SENT: the stamp (mig 512, on the grant row) is a conditional update only one run can win, and
 * it is refused if the grant was ended or its end moved since the read. It is given back only when no owner's email went
 * and every one definitely did not go; an unknown outcome keeps it (sending again could mail an owner twice) and is logged.
 */

type GrantRow = {
  id: string;
  org_id: string;
  type: 'plan_tier' | 'module_addon' | 'subscription_status';
  target: Record<string, unknown> | null;
  starts_at: string | null;
  expires_at: string;
  revoked_at: string | null;
  ending_reminded_14_for: string | null;
  ending_reminded_3_for: string | null;
};

type OrgRow = {
  id: string;
  slug: string | null;
  name: string | null;
  plan_id: string | null;
  account_kind: string | null;
  subscription_status: string | null;
  enabled_addons: string[] | null;
  tournament_limit: number | null;
  billing_suspended_at: string | null;
};

const STAMPS = ['ending_reminded_14_for', 'ending_reminded_3_for'] as const;

/** Running club grants with an end date that falls inside the next 15 days (the day count is decided per grant). */
const endingGrants = (now: Date) => fetchAll<GrantRow>((from, to) => supabaseAdmin
  .from('org_overrides')
  .select('id, org_id, type, target, starts_at, expires_at, revoked_at, ending_reminded_14_for, ending_reminded_3_for')
  .in('type', ['plan_tier', 'module_addon', 'subscription_status'])
  .is('revoked_at', null)
  .not('expires_at', 'is', null)
  .gt('expires_at', now.toISOString())
  .lte('expires_at', new Date(now.getTime() + (FREE_TIME_ENDING_DAYS + 2) * 86_400_000).toISOString())
  .order('id')
  .range(from, to));

/**
 * What the club is the moment before this grant's end and the moment after, folded from ALL its grants the way the door
 * folds them (`foldGrants`). Judged against the club's own facts alone, a grant that overlaps another (a section a running
 * plan grant also carries, an older billing status under a newer one) would be told "it turns off" when nothing does
 * (/review 2026-11-20).
 */
async function aroundTheEnd(org: OrgRow, end: string): Promise<{ before: EffectiveFacts; after: EffectiveFacts }> {
  const { data, error } = await supabaseAdmin.from('org_overrides')
    .select('type, value, target, starts_at, expires_at, revoked_at')
    .eq('org_id', org.id)
    .in('type', [...FREE_TIME_KINDS])
    .order('created_at', { ascending: false }); // newest first, as the door reads them
  if (error) throw error;
  const rows = (data ?? []) as DoorGrantRow[];
  const own = ownFactsOf(org);
  const at = new Date(end);
  return { before: foldGrants(own, rows, new Date(at.getTime() - 1)), after: foldGrants(own, rows, at) };
}

/** Whether the club can use this section with these facts: switched on for it, or carried by its plan. */
const holdsSection = (facts: EffectiveFacts, section: string) =>
  facts.enabledAddons.includes(section) || ((PLAN_CONFIG[facts.planId]?.moduleEntitlements ?? []) as string[]).includes(section);

/** What the email says for this grant, or null when nothing changes for the club at its end. */
async function wordsInputOf(
  g: GrantRow, org: OrgRow, lastDay: string, left: number, gating: () => Promise<Partial<Record<OrgPlan, boolean>>>,
): Promise<ClubEndingEmailInput | null> {
  const clubName = org.name ?? 'Your organization';
  const { before, after } = await aroundTheEnd(org, g.expires_at);
  if (g.type === 'plan_tier') {
    const plan = g.target?.plan;
    // This grant is what lifts the club, and the lift goes with it (a plan bought since, or overtaken, changes nothing).
    if (!isGrantablePlan(plan) || before.planId !== plan || after.planId === plan || PLAN_RANK[plan] <= (PLAN_RANK[after.planId] ?? 0)) return null;
    const backTo = after.planId;
    let overLimitAfter = false;
    const limitAfter = getEffectiveTournamentLimit(backTo, org.tournament_limit);
    if (limitAfter < 9999) {
      const { count, error } = await supabaseAdmin.from('tournaments').select('id', { count: 'exact', head: true })
        .eq('org_id', org.id).in('status', [...SLOT_STATUSES]);
      if (error) throw error;
      overLimitAfter = (count ?? 0) > limitAfter;
    }
    return { kind: 'plan_tier', clubName, plan, ownPlan: backTo, lastDay, daysLeft: left, givenOnSale: (await gating())[plan] === false, overLimitAfter };
  }
  if (g.type === 'module_addon') {
    const given = Array.isArray(g.target?.addons) ? (g.target!.addons as unknown[]).filter((a): a is string => typeof a === 'string') : [];
    // Only the sections that are on just before the end and off just after it: another grant or the plan may keep one on.
    const ending = given.filter(a => (GIVABLE_SECTIONS as readonly string[]).includes(a) && holdsSection(before, a) && !holdsSection(after, a));
    if (ending.length === 0) return null;
    return { kind: 'module_addon', clubName, sections: ending.map(sectionLabel), lastDay, daysLeft: left };
  }
  // A billing status: only when the status the door reads actually changes (a newer grant, or the club's own, may hold it).
  if (before.subscriptionStatus === after.subscriptionStatus) return null;
  const reopenedEndedClub = g.target?.[REOPENED_ENDED_CLUB] === true && after.subscriptionStatus === 'canceled';
  return { kind: 'subscription_status', clubName, lastDay, daysLeft: left, reopenedEndedClub };
}

export async function sendClubFreeTimeReminders(now: Date = new Date()): Promise<{ sent: number; skipped: number; failed: number }> {
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  // Switched off, a grant does nothing: the club keeps what it holds, so its end changes nothing either.
  if (!grantsEnabled()) return { sent, skipped, failed };

  let gatingMap: Partial<Record<OrgPlan, boolean>> | null = null;
  const gating = async () => (gatingMap ??= await getPlanGatingMap());

  for (const g of await endingGrants(now)) {
    try {
      if (!isGrantRunning(g, now)) continue;
      const lastDay = lastDayOfInstant(g.expires_at);
      const left = daysLeft(lastDay, now);
      const wave = clubEndingReminderDue(left, lastDay, { at14: g.ending_reminded_14_for, at3: g.ending_reminded_3_for });
      if (!wave) continue;

      const { data: org, error: orgError } = await supabaseAdmin.from('organizations')
        .select('id, slug, name, plan_id, account_kind, subscription_status, enabled_addons, tournament_limit, billing_suspended_at')
        .eq('id', g.org_id).maybeSingle<OrgRow>();
      if (orgError) throw orgError;
      // A Coaches Portal's free time has its own reminders (lib/portal-free-time-reminders.ts).
      if (!org?.slug || isTeamWorkspaceOrg({ accountKind: org.account_kind, planId: org.plan_id }) || org.billing_suspended_at) continue;

      const input = await wordsInputOf(g, org, lastDay, left, gating);
      if (!input) continue;
      const owners = await orgOwnerEmails(org.id);
      if (owners.length === 0) { skipped += 1; continue; }

      // Everything the email needs is built BEFORE the claim: a throw after it would spend the stamp on an email never sent.
      const words = clubEndingEmailWords(input);
      const billingUrl = `${SITE_URL}${getBillingHref(billingUrlOrgFromRow({
        slug: org.slug, plan_id: org.plan_id, account_kind: org.account_kind, name: org.name,
      }), { purpose: 'return' })}`;
      const html = warmEmailDocument([
        warmEmailParagraph(escapeHtml(words.lead)),
        warmEmailParagraph(escapeHtml(words.body)),
        warmEmailButton(words.button, billingUrl),
      ].join('\n'));

      // The 3-day reminder also stamps the 14-day one: a job that was down never sends both on one day.
      const stampColumn = `ending_reminded_${wave}_for` as const;
      const columns = wave === 3 ? STAMPS : (['ending_reminded_14_for'] as const);
      const { data: claimed, error: claimError } = await supabaseAdmin.from('org_overrides')
        .update(Object.fromEntries(columns.map(c => [c, lastDay])))
        .eq('id', g.id)
        .is('revoked_at', null) // ended early since the read: nothing is ending
        .eq('expires_at', g.expires_at) // its end moved since the read: the next run reads the new one
        .or(`${stampColumn}.is.null,${stampColumn}.neq.${lastDay}`).select('id');
      // A claim that failed is a failure, never "someone else claimed it": silently skipped, it would never be sent.
      if (claimError) throw claimError;
      if (!claimed?.length) continue;

      // A send that never got an answer may still have gone: the stamp is given back ONLY when no owner's email went and
      // every one definitely did not; an unknown outcome keeps it and is logged for a person.
      let anySent = false;
      let allDefinitelyUnsent = true;
      let unsent = 0;
      for (const owner of owners) {
        const result = await sendEmail(owner.email, words.subject, html, {
          kind: 'club_free_time_ending', orgId: org.id,
          idempotencyKey: `club-free-time-ending:${g.id}:${lastDay}:${wave}:${owner.userId}`,
          timeoutMs: 15_000,
        }).catch((e: unknown) => {
          console.error('[club-free-time-reminders] the mail service did not answer:', org.id, e instanceof Error ? e.message : String(e));
          return null;
        });
        if (result?.status === 'sent') { anySent = true; continue; }
        unsent += 1;
        const definitelyUnsent = result?.status === 'skipped' || (result?.status === 'provider_error' && result.refused === true);
        if (!definitelyUnsent) {
          allDefinitelyUnsent = false;
          console.error('[club-free-time-reminders] the reminder may or may not have gone; not sent again:', org.id, g.id, lastDay, wave, result?.status ?? 'threw');
        }
      }
      if (anySent) {
        if (unsent > 0) console.error('[club-free-time-reminders] some owners were not emailed; the others were, so it is not sent again:', org.id, g.id, wave, unsent);
        sent += 1;
        continue;
      }
      skipped += 1;
      if (!allDefinitelyUnsent) continue;
      // Nothing went out: give the stamp back so the next run tries again.
      const { error: releaseError } = await supabaseAdmin.from('org_overrides')
        .update(Object.fromEntries(columns.map(c => [c, g[c]])))
        .eq('id', g.id)
        .eq(stampColumn, lastDay); // only our own stamp: never undo a run that stamped after us
      if (releaseError) console.error('[club-free-time-reminders] the stamp could not be given back; the reminder is lost:', g.id, lastDay, wave, releaseError.message);
    } catch (e) {
      failed += 1;
      console.error('[club-free-time-reminders] the reminder was not sent:', g.org_id, g.id, e instanceof Error ? e.message : String(e));
    }
  }
  return { sent, skipped, failed };
}
