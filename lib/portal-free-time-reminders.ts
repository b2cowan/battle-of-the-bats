import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { fetchAll } from './supabase-paging';
import { sendEmail, escapeHtml } from './email';
import { warmEmailButton, warmEmailDocument, warmEmailParagraph } from './email-envelope-warm';
import { isDemoOrganizerEmail } from './demo-org';
import { teamWorkspaceReactivatePath } from './coaches-portal-routes';
import { customerPortalFreeTime } from './portal-free-time-server';
import { portalEndingEmailWords, portalEndingReminderDue } from './portal-free-time';

/**
 * THE DAILY JOB'S FREE-TIME REMINDERS (Support console Stage 4b, owner 2026-10-28: a coach who loses track of the date
 * must not find out afterwards; this reverses Q7's "no email"). Every Coaches Portal staff gave free time and nobody pays
 * for is read the way the coach's own screens read it (`customerPortalFreeTime`); one in its last 14 days is emailed at
 * 14 days and at 3 days before it runs out, the portal's owner only, once each per end.
 *
 * ⚠ ONCE, CLAIMED BEFORE IT IS SENT (the online-payments owner notices' rule): the stamp is a conditional update only one
 * run can win, so a run that dies after sending never sends again. The stamp is released if nothing went out (no mail key,
 * the provider refused), so tomorrow's run tries again. Keep Premium turns the portal `team_direct`, which drops it out of
 * the read; ending free time early (End it now) leaves nothing "ending", so neither sends. Demo coaches are skipped.
 */

type WorkspaceRow = {
  workspace_org_id: string;
  primary_owner_user_id: string | null;
  free_time_reminded_14_for: string | null;
  free_time_reminded_3_for: string | null;
};

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? '';

/** Every given portal that has an owner to tell (one with none is never emailed, so it costs no reads). */
const givenPortals = () => fetchAll<WorkspaceRow>((from, to) => supabaseAdmin
  .from('team_workspaces')
  .select('workspace_org_id, primary_owner_user_id, free_time_reminded_14_for, free_time_reminded_3_for')
  .not('free_time_given_at', 'is', null)
  .not('primary_owner_user_id', 'is', null)
  .eq('billing_mode', 'platform_override')
  .order('workspace_org_id')
  .range(from, to));

export async function sendPortalFreeTimeReminders(now: Date = new Date()): Promise<{ sent: number; skipped: number; failed: number }> {
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const ws of await givenPortals()) {
    try {
      const ft = await customerPortalFreeTime(ws.workspace_org_id, now);
      // 'running' is read too: the page's "ending" window starts at 13 days left, and the first reminder is at 14.
      if (!ft || ft.state === 'ended') continue;
      const wave = portalEndingReminderDue(ft.daysLeft, ft.lastDay, { at14: ws.free_time_reminded_14_for, at3: ws.free_time_reminded_3_for });
      if (!wave || !ws.primary_owner_user_id) continue;

      const { data: u } = await supabaseAdmin.auth.admin.getUserById(ws.primary_owner_user_id);
      const to = u?.user?.email;
      if (!to || isDemoOrganizerEmail(to)) { skipped += 1; continue; }
      const { data: org } = await supabaseAdmin.from('organizations').select('slug, name').eq('id', ws.workspace_org_id).maybeSingle();
      if (!org?.slug) continue;

      // The 3-day reminder also stamps the 14-day one: a job that was down never sends both on one day.
      const stampColumn = `free_time_reminded_${wave}_for` as const;
      const columns = wave === 3 ? ['free_time_reminded_3_for', 'free_time_reminded_14_for'] as const : ['free_time_reminded_14_for'] as const;
      const { data: claimed } = await supabaseAdmin.from('team_workspaces')
        .update(Object.fromEntries(columns.map(c => [c, ft.lastDay])))
        .eq('workspace_org_id', ws.workspace_org_id)
        .eq('billing_mode', 'platform_override') // a coach who chose Premium since the read is no longer "ending"
        .or(`${stampColumn}.is.null,${stampColumn}.neq.${ft.lastDay}`).select('workspace_org_id');
      if (!claimed?.length) continue;

      const words = portalEndingEmailWords(ft.lastDay, ft.daysLeft);
      const html = warmEmailDocument([
        warmEmailParagraph(escapeHtml(words.lead)),
        warmEmailParagraph(escapeHtml(words.body)),
        warmEmailButton(words.button, `${appUrl()}${teamWorkspaceReactivatePath({ slug: org.slug as string, name: org.name as string | null })}&keep=1`),
      ].join('\n'));
      // A send that never got an answer may still have gone (the mail service's 5xx, a 429, a dropped connection, a timeout):
      // sending again could mail the coach twice, and the mail service's once-only key lasts only a day. So the stamp is
      // given back ONLY when the email definitely did not go; an unknown outcome keeps it and is logged for a person.
      const result = await sendEmail(to, words.subject, html, {
        kind: 'portal_free_time_ending', orgId: ws.workspace_org_id,
        idempotencyKey: `portal-free-time-ending:${ws.workspace_org_id}:${ft.lastDay}:${wave}`,
        timeoutMs: 15_000,
      }).catch((e: unknown) => {
        console.error('[portal-free-time-reminders] the mail service did not answer:', ws.workspace_org_id, e instanceof Error ? e.message : String(e));
        return null;
      });
      if (result?.status === 'sent') { sent += 1; continue; }
      const definitelyUnsent = result?.status === 'skipped' || (result?.status === 'provider_error' && result.refused === true);
      if (!definitelyUnsent) {
        console.error('[portal-free-time-reminders] the reminder may or may not have gone; not sent again:', ws.workspace_org_id, ft.lastDay, wave, result?.status ?? 'threw');
        skipped += 1;
        continue;
      }
      // Nothing went out: give the stamp back so the next run tries again.
      const { error: releaseError } = await supabaseAdmin.from('team_workspaces')
        .update(Object.fromEntries(columns.map(c => [c, ws[c]])))
        .eq('workspace_org_id', ws.workspace_org_id)
        .eq(stampColumn, ft.lastDay); // only our own stamp: never undo a run that stamped after us
      if (releaseError) console.error('[portal-free-time-reminders] the stamp could not be given back; the reminder is lost:', ws.workspace_org_id, ft.lastDay, wave, releaseError.message);
      skipped += 1;
    } catch (e) {
      failed += 1;
      console.error('[portal-free-time-reminders] the reminder was not sent:', ws.workspace_org_id, e instanceof Error ? e.message : String(e));
    }
  }
  return { sent, skipped, failed };
}
