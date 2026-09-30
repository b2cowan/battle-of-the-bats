import { NextResponse } from 'next/server';
import { sendEmail, announcementHtml } from '@/lib/email';
import { getAuthContextWithScope, scopeGuard, unauthorized, forbidden, requireTournamentInOrg } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasPlanFeature, requiresTournamentPlusCopy } from '@/lib/plan-features';
import { writePlatformEvent } from '@/lib/platform-events';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { Communication } from '@/lib/types';
import { withObservability } from '@/lib/observability';
import {
  readStoredRecipients, selectAnnouncementRecipients, usesAdvancedTargeting,
  type AnnouncementRecipient, type RecipientTargeting, type RecipientTeamRow,
} from '@/lib/announcement-recipients';
import { notifyFansForAnnouncement } from '@/lib/fan-notify';
import { supersedeScheduleChangeNotices } from '@/lib/schedule-change-notices';
import { notify } from '@/lib/notify';

// Free-tier email volume guard (ratified 2026-06-22). Basic announcements (every accepted team) are
// free, but lightly capped so the free floor can't be used as a bulk mailer. Tournament
// Plus and above are uncapped (they carry the targeted_tournament_announcements feature).
const FREE_EMAIL_RECIPIENT_CAP = 100;
const FREE_EMAIL_SENDS_PER_DAY = 10;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapRow(a: any): Communication {
  return {
    id: a.id,
    tournamentId: a.tournament_id,
    title: a.title,
    body: a.body,
    pinned: a.pinned ?? false,
    divisionIds: a.division_ids ?? null,
    channelSite: a.channel_site ?? true,
    channelEmail: a.channel_email ?? false,
    emailTargeting: a.email_targeting ?? null,
    emailRecipientCount: a.email_recipient_count ?? null,
    emailSuccessCount: a.email_success_count ?? null,
    emailFailedCount: a.email_failed_count ?? null,
    emailFailedAddresses: a.email_failed_addresses ?? null,
    emailRecipients: readStoredRecipients(a.email_recipients),
    emailSentAt: a.email_sent_at ?? null,
    sentByEmail: a.sent_by_email ?? null,
    createdAt: a.published_at ?? a.created_at,
    deletedAt: a.deleted_at ?? null,
  };
}

/**
 * Who an email reaches — the tournament's teams through the ONE rule (`lib/announcement-recipients`):
 * the accepted teams unless the targeting says otherwise (F42, 2026-09-30). The send, the record it
 * writes and the free plan's cap all read this.
 */
async function resolveRecipients(tournamentId: string, targeting: RecipientTargeting | null): Promise<AnnouncementRecipient[]> {
  const { data: teams, error: teamsError } = await supabaseAdmin
    .from('teams')
    .select('id, name, email, coach_email, status, payment_status, division_id')
    .eq('tournament_id', tournamentId);
  if (teamsError) throw teamsError;
  // contacts table removed — includeContacts is a no-op; targeting by org member is not yet implemented
  return selectAnnouncementRecipients((teams ?? []) as RecipientTeamRow[], targeting);
}

// ─── GET — list all communications for a tournament ──────────────────────────

export const GET = withObservability(async (req: Request) => {
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();

  const tournamentId = url.searchParams.get('tournamentId');
  if (!tournamentId) return NextResponse.json([]);

  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;

  const wrongOrg = await requireTournamentInOrg(ctx, tournamentId);
  if (wrongOrg) return wrongOrg;

  const { data, error } = await supabaseAdmin
    .from('announcements')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('published_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data ?? []).map(mapRow));
}, { route: '/api/admin/communications' });

// ─── POST — create, update, delete, toggle-pin ───────────────────────────────

export const POST = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'create_tournaments')) return forbidden();

  try {
    const { action, id, data } = await req.json();

    // ── preview-recipients (A14/A15): the composer's live count — a DRY RUN of the send's own rule
    // with the same targeting and the same gate, so the number the organizer reads and the number the
    // send reaches are one definition. Writes nothing and emails no one.
    if (action === 'preview-recipients') {
      if (!data?.tournamentId) return NextResponse.json({ error: 'Missing tournamentId.' }, { status: 400 });
      const denied = scopeGuard(ctx, data.tournamentId);
      if (denied) return denied;
      const wrongOrg = await requireTournamentInOrg(ctx, data.tournamentId);
      if (wrongOrg) return wrongOrg;
      const targeting = (data.targeting ?? null) as RecipientTargeting | null;
      if (usesAdvancedTargeting(targeting) && !hasPlanFeature(ctx.org.planId, 'targeted_tournament_announcements')) {
        return NextResponse.json({ error: requiresTournamentPlusCopy('targeted_tournament_announcements') }, { status: 403 });
      }
      const recipients = await resolveRecipients(data.tournamentId, targeting);
      return NextResponse.json({ count: recipients.length });
    }

    // ── save (create new communication) ────────────────────────────────────
    if (action === 'save') {
      if (!data?.tournamentId) return NextResponse.json({ error: 'Missing tournamentId.' }, { status: 400 });
      if (!data?.title?.trim()) return NextResponse.json({ error: 'Title is required.' }, { status: 400 });
      if (!data?.body?.trim()) return NextResponse.json({ error: 'Message is required.' }, { status: 400 });

      const denied = scopeGuard(ctx, data.tournamentId);
      if (denied) return denied;

      const wrongOrg = await requireTournamentInOrg(ctx, data.tournamentId);
      if (wrongOrg) return wrongOrg;

      const channelSite  = Boolean(data.channelSite);
      const channelEmail = Boolean(data.channelEmail);
      const channelPush  = Boolean(data.channelPush);

      if (!channelSite && !channelEmail && !channelPush) {
        return NextResponse.json({ error: 'Select at least one channel (post to site, email, or push to fans).' }, { status: 400 });
      }

      // Fan push (anonymous device push to opted-in fans) is the signature Plus fan feature —
      // same gate as fan_score_alerts. Hard-gate here so a free org gets a clear 403 instead of a
      // silent no-op (the fan-out self-gates too, as defense-in-depth).
      if (channelPush && !hasPlanFeature(ctx.org.planId, 'fan_score_alerts')) {
        return NextResponse.json({ error: requiresTournamentPlusCopy('fan_score_alerts') }, { status: 403 });
      }

      // A fan push deep-links to the public News page, so the message must also be posted to the
      // site — otherwise the notification taps through to a page that doesn't show it (email-only
      // posts are hidden publicly). Require the site channel whenever pushing to fans.
      if (channelPush && !channelSite) {
        return NextResponse.json({ error: 'Push to fans also needs “Post to site” on, so the notification has a public page to open.' }, { status: 400 });
      }

      // Division-targeted site posts require T+
      const hasDivisionFilter = Array.isArray(data.divisionIds) && data.divisionIds.length > 0;
      if (hasDivisionFilter && !hasPlanFeature(ctx.org.planId, 'targeted_tournament_announcements')) {
        return NextResponse.json({ error: requiresTournamentPlusCopy('targeted_tournament_announcements') }, { status: 403 });
      }

      // Advanced email targeting requires T+
      const targeting = (data.targeting ?? null) as RecipientTargeting | null;
      const advanced  = usesAdvancedTargeting(targeting);
      if (advanced && !hasPlanFeature(ctx.org.planId, 'targeted_tournament_announcements')) {
        return NextResponse.json({ error: requiresTournamentPlusCopy('targeted_tournament_announcements') }, { status: 403 });
      }

      // Free-tier email volume guard: cap basic announcements so the free floor isn't a
      // bulk mailer. Free orgs only ever send the basic email — every accepted team (advanced
      // targeting is already gated above) — and the cap counts exactly the addresses that send
      // reaches, the same list the send uses (F42). Tournament Plus and above are uncapped.
      if (channelEmail && !hasPlanFeature(ctx.org.planId, 'targeted_tournament_announcements')) {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count: recentEmailSends } = await supabaseAdmin
          .from('announcements')
          .select('id', { count: 'exact', head: true })
          .eq('tournament_id', data.tournamentId)
          .eq('channel_email', true)
          // Count by creation time (published_at), not send-completion (email_sent_at), so
          // concurrent in-flight sends and failed attempts still count toward the daily cap —
          // closes the race where rows pending their email_sent_at stamp read as uncounted.
          .gte('published_at', since);
        if ((recentEmailSends ?? 0) >= FREE_EMAIL_SENDS_PER_DAY) {
          return NextResponse.json(
            { error: `Free plan: up to ${FREE_EMAIL_SENDS_PER_DAY} email announcements per day. Tournament Plus removes the limit.` },
            { status: 429 },
          );
        }
        const freeRecipients = await resolveRecipients(data.tournamentId, targeting);
        if (freeRecipients.length > FREE_EMAIL_RECIPIENT_CAP) {
          return NextResponse.json(
            { error: `Free plan announcements reach up to ${FREE_EMAIL_RECIPIENT_CAP} recipients per send (${freeRecipients.length} selected). Tournament Plus removes the limit.` },
            { status: 400 },
          );
        }
      }

      // Insert the base record
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('announcements')
        .insert({
          tournament_id:  data.tournamentId,
          title:          data.title.trim(),
          body:           data.body.trim(),
          published_at:   new Date().toISOString(),
          pinned:         Boolean(data.pinned),
          division_ids:  hasDivisionFilter ? data.divisionIds : null,
          channel_site:   channelSite,
          channel_email:  channelEmail,
          email_targeting: channelEmail ? (targeting ?? null) : null,
          sent_by_email:  ctx.user.email ?? null,
        })
        .select()
        .single();

      if (insertError || !inserted) throw insertError ?? new Error('Insert failed');

      // Fan push (new channel) — buzz every opted-in fan of the tournament. Independent of the
      // email channel; runs whether or not the post is also emailed. Self-gates to Tournament Plus+
      // and never throws, so it can't break the post. Returns a count for the organizer's toast.
      let pushResult: { sent: number; failed: number } | null = null;
      if (channelPush) {
        pushResult = await notifyFansForAnnouncement(data.tournamentId, {
          title: data.title.trim(),
          body: data.body.trim(),
        });
        await writePlatformEvent({
          eventType: 'tournament_plus_feature_used',
          source: 'app',
          orgId: ctx.org.id,
          actorUserId: ctx.user.id,
          actorEmail: ctx.user.email,
          planId: ctx.org.planId,
          metadata: {
            feature: 'fan_score_alerts',
            action: 'announcement_push',
            tournamentId: data.tournamentId,
            status: pushResult.failed > 0 ? 'partial' : 'completed',
            pushedCount: pushResult.sent,
            failedCount: pushResult.failed,
          },
        });
      }

      // Staff + Coaches-Portal push (org members): fire when the organizer is actively notifying —
      // the fan-push channel is on, OR the day-of "shift the day" hand-off explicitly asks
      // (notifyStaff) so a rain-delay reaches coaches even on a free Tournament (day-of safety comms
      // aren't plan-gated). Uses the existing free staff notify() system with per-user opt-out;
      // external team-contact coaches keep the email channel. Awaited so serverless can't drop it.
      const notifyStaff = Boolean(data.notifyStaff);
      if (channelPush || notifyStaff) {
        const { data: pushTournament } = await supabaseAdmin
          .from('tournaments')
          .select('slug')
          .eq('id', data.tournamentId)
          .maybeSingle();
        await notify({
          orgId: ctx.org.id,
          tournamentId: data.tournamentId,
          eventType: 'tournament_announcement',
          title: data.title.trim(),
          body: data.body.trim(),
          link: pushTournament?.slug ? `/${ctx.org.slug}/${pushTournament.slug}` : undefined,
          excludeUserIds: [ctx.user.id],
        });
      }

      // B2.3 — the rain-delay hand-off passes the notice ids its shift just queued. The
      // organizer has now said it in their own words, so the automatic "your game moved" push
      // for those same games stands down: one buzz for one rain delay, not two. Only ids the
      // reschedule itself created are touched, so an unrelated pending change can't be swallowed.
      // The tournament id is passed so the update is scoped to it: the id list is
      // client-supplied, and only `data.tournamentId` has been scope-checked against this
      // caller's org above. Ids belonging to another org's tournament must not match.
      if (Array.isArray(data.supersedeNoticeIds) && data.supersedeNoticeIds.length > 0) {
        await supersedeScheduleChangeNotices(
          data.tournamentId,
          data.supersedeNoticeIds.filter((v: unknown): v is string => typeof v === 'string'),
        );
      }

      // Send emails if the email channel is selected
      if (channelEmail) {
        await writePlatformEvent({
          eventType: 'tournament_plus_feature_used',
          source: 'app',
          orgId: ctx.org.id,
          actorUserId: ctx.user.id,
          actorEmail: ctx.user.email,
          planId: ctx.org.planId,
          metadata: {
            feature: 'targeted_tournament_announcements',
            action: 'send_tournament_email',
            tournamentId: data.tournamentId,
            status: 'attempted',
            advancedTargeting: advanced,
          },
        });

        let recipients: AnnouncementRecipient[] = [];
        try {
          recipients = await resolveRecipients(data.tournamentId, targeting);
        } catch (resolveErr) {
          console.error('Failed to resolve recipients:', resolveErr);
        }

        // Tournament context for the branded email body (name + organizer contact).
        const { data: tournamentRow } = await supabaseAdmin
          .from('tournaments')
          .select('name, contact_email')
          .eq('id', data.tournamentId)
          .maybeSingle();
        const announcementTournamentName = tournamentRow?.name ?? 'your tournament';
        const announcementContact = tournamentRow?.contact_email ?? undefined;

        const results = { success: 0, failed: 0, failedAddresses: [] as string[] };

        for (const { email } of recipients) {
          try {
            await sendEmail(email, data.title.trim(), announcementHtml({
              title: data.title.trim(),
              body: data.body.trim(),
              tournamentName: announcementTournamentName,
              contactEmail: announcementContact,
              coachEmail: email,
            }));
            results.success++;
          } catch (sendErr) {
            console.error(`Failed to send to ${email}:`, sendErr);
            results.failed++;
            results.failedAddresses.push(email);
          }
        }

        // Update the record with send results
        await supabaseAdmin
          .from('announcements')
          .update({
            email_recipient_count:  recipients.length,
            email_success_count:    results.success,
            email_failed_count:     results.failed,
            email_failed_addresses: results.failedAddresses.length ? results.failedAddresses : null,
            // The record IS the send's list (mig 314): who it went to, named as the teams were now.
            email_recipients:       recipients,
            email_sent_at:          new Date().toISOString(),
          })
          .eq('id', inserted.id);

        await writePlatformEvent({
          eventType: 'tournament_plus_feature_used',
          source: 'app',
          orgId: ctx.org.id,
          actorUserId: ctx.user.id,
          actorEmail: ctx.user.email,
          planId: ctx.org.planId,
          metadata: {
            feature: 'targeted_tournament_announcements',
            action: 'send_tournament_email',
            tournamentId: data.tournamentId,
            status: 'completed',
            advancedTargeting: advanced,
            recipientCount: recipients.length,
          },
        });

        // Return the updated row
        const { data: updated } = await supabaseAdmin
          .from('announcements')
          .select('*')
          .eq('id', inserted.id)
          .single();

        return NextResponse.json({
          communication: mapRow(updated ?? inserted),
          emailResults: { sent: results.success, failed: results.failed },
          pushResults: pushResult ?? undefined,
        });
      }

      return NextResponse.json({ communication: mapRow(inserted), pushResults: pushResult ?? undefined });
    }

    // ── update (edit title/body/pinned of a site post) ──────────────────────
    if (action === 'update') {
      if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });

      const { data: existing, error: fetchErr } = await supabaseAdmin
        .from('announcements')
        .select('tournament_id, channel_site')
        .eq('id', id)
        .single();

      if (fetchErr || !existing) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

      const denied = scopeGuard(ctx, existing.tournament_id);
      if (denied) return denied;

      const wrongOrg = await requireTournamentInOrg(ctx, existing.tournament_id);
      if (wrongOrg) return wrongOrg;

      const updates: Record<string, unknown> = {};
      if (data.title    !== undefined) updates.title          = String(data.title).trim();
      if (data.body     !== undefined) updates.body           = String(data.body).trim();
      if (data.pinned   !== undefined) updates.pinned         = Boolean(data.pinned);
      if (data.divisionIds !== undefined) {
        const hasFilter = Array.isArray(data.divisionIds) && data.divisionIds.length > 0;
        if (hasFilter && !hasPlanFeature(ctx.org.planId, 'targeted_tournament_announcements')) {
          return NextResponse.json({ error: requiresTournamentPlusCopy('targeted_tournament_announcements') }, { status: 403 });
        }
        updates.division_ids = hasFilter ? data.divisionIds : null;
      }

      const { error: updateErr } = await supabaseAdmin
        .from('announcements')
        .update(updates)
        .eq('id', id);

      if (updateErr) throw updateErr;
      return NextResponse.json({ success: true });
    }

    // ── toggle-pin ───────────────────────────────────────────────────────────
    if (action === 'toggle-pin') {
      if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });

      const { data: existing } = await supabaseAdmin
        .from('announcements')
        .select('tournament_id, pinned')
        .eq('id', id)
        .single();

      if (existing) {
        const denied = scopeGuard(ctx, existing.tournament_id);
        if (denied) return denied;
        const wrongOrg = await requireTournamentInOrg(ctx, existing.tournament_id);
        if (wrongOrg) return wrongOrg;
      }

      const { error: updateErr } = await supabaseAdmin
        .from('announcements')
        .update({ pinned: !existing?.pinned })
        .eq('id', id);

      if (updateErr) throw updateErr;
      return NextResponse.json({ success: true });
    }

    // ── delete (soft) — sets deleted_at, removes from public site ────────────
    if (action === 'delete') {
      if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });

      const { data: existing } = await supabaseAdmin
        .from('announcements')
        .select('tournament_id')
        .eq('id', id)
        .single();

      if (existing) {
        const denied = scopeGuard(ctx, existing.tournament_id);
        if (denied) return denied;
        const wrongOrg = await requireTournamentInOrg(ctx, existing.tournament_id);
        if (wrongOrg) return wrongOrg;
      }

      const { error: deleteErr } = await supabaseAdmin
        .from('announcements')
        .update({ deleted_at: new Date().toISOString(), pinned: false })
        .eq('id', id);

      if (deleteErr) throw deleteErr;
      return NextResponse.json({ success: true });
    }

    // ── restore — clears deleted_at, post returns to public site ─────────────
    if (action === 'restore') {
      if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });

      const { data: existing } = await supabaseAdmin
        .from('announcements')
        .select('tournament_id')
        .eq('id', id)
        .single();

      if (existing) {
        const denied = scopeGuard(ctx, existing.tournament_id);
        if (denied) return denied;
        const wrongOrg = await requireTournamentInOrg(ctx, existing.tournament_id);
        if (wrongOrg) return wrongOrg;
      }

      const { error: restoreErr } = await supabaseAdmin
        .from('announcements')
        .update({ deleted_at: null })
        .eq('id', id);

      if (restoreErr) throw restoreErr;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (err: unknown) {
    console.error('Communications API error:', err);
    const message = err instanceof Error ? err.message : 'Unable to process communication.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}, { route: '/api/admin/communications' });
