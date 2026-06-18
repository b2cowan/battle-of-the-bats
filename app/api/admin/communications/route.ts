import { NextResponse } from 'next/server';
import { sendEmail, announcementHtml, resolveCoachRecipient } from '@/lib/email';
import { getAuthContextWithScope, scopeGuard, unauthorized, forbidden, requireTournamentInOrg } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasPlanFeature, requiresTournamentPlusCopy } from '@/lib/plan-features';
import { writePlatformEvent } from '@/lib/platform-events';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { Communication } from '@/lib/types';
import { withObservability } from '@/lib/observability';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stringSet(value: unknown) {
  return new Set(Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []);
}

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
    emailSentAt: a.email_sent_at ?? null,
    sentByEmail: a.sent_by_email ?? null,
    createdAt: a.published_at ?? a.created_at,
    deletedAt: a.deleted_at ?? null,
  };
}

type RecipientTargeting = {
  includeTeams?: boolean;
  includeContacts?: boolean;
  teamStatuses?: string[];
  paymentStatuses?: string[];
  divisionIds?: string[];
  teamIds?: string[];
  contactRoles?: string[];
};

/** Resolve recipient emails from targeting rules. Returns a deduplicated email list. */
async function resolveRecipients(tournamentId: string, targeting: RecipientTargeting | null) {
  const recipientMap = new Map<string, string>();

  if (!targeting || targeting.includeTeams !== false) {
    // Default: include teams
    const teamStatuses  = stringSet(targeting?.teamStatuses);
    const paymentStatuses = stringSet(targeting?.paymentStatuses);
    const divisionIds   = stringSet(targeting?.divisionIds);
    const teamIds       = stringSet(targeting?.teamIds);

    const { data: teams, error: teamsError } = await supabaseAdmin
      .from('teams')
      .select('id, email, coach_email, status, payment_status, division_id')
      .eq('tournament_id', tournamentId);

    if (teamsError) throw teamsError;

    for (const team of teams ?? []) {
      const selectedById = teamIds.size > 0 && teamIds.has(team.id);
      const selectedByFilters =
        teamIds.size === 0 &&
        (teamStatuses.size === 0 || teamStatuses.has(team.status)) &&
        (paymentStatuses.size === 0 || paymentStatuses.has(team.payment_status ?? 'pending')) &&
        (divisionIds.size === 0 || divisionIds.has(team.division_id));

      if (!selectedById && !selectedByFilters) continue;
      // Honor an assigned head-coach contact (teams.coach_email) over the original registration
      // email — mirrors every automatic coach email, so a reassigned coach gets the announcement.
      const email = resolveCoachRecipient({ coach_email: team.coach_email, email: team.email });
      if (email) recipientMap.set(email, email);
    }
  }

  // contacts table removed — includeContacts is a no-op; targeting by org member is not yet implemented

  return Array.from(recipientMap.keys());
}

function usesAdvancedTargeting(targeting: RecipientTargeting | null): boolean {
  if (!targeting) return false;
  const teamStatuses = stringSet(targeting.teamStatuses);
  const ALL_STATUSES = new Set(['accepted', 'pending', 'waitlist', 'rejected']);
  const isAllStatuses = teamStatuses.size === 0 ||
    (teamStatuses.size === ALL_STATUSES.size && Array.from(teamStatuses).every(s => ALL_STATUSES.has(s)));

  return Boolean(
    targeting.includeContacts ||
    stringSet(targeting.divisionIds).size > 0 ||
    stringSet(targeting.teamIds).size > 0 ||
    stringSet(targeting.contactRoles).size > 0 ||
    stringSet(targeting.paymentStatuses).size > 0 ||
    !isAllStatuses,
  );
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

      if (!channelSite && !channelEmail) {
        return NextResponse.json({ error: 'Select at least one channel (post to site or email).' }, { status: 400 });
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

        let recipients: string[] = [];
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

        for (const email of recipients) {
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
        });
      }

      return NextResponse.json({ communication: mapRow(inserted) });
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
