import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { getAuthContextWithScope, scopeGuard, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasPlanFeature, requiresTournamentPlusCopy } from '@/lib/plan-features';
import { writePlatformEvent } from '@/lib/platform-events';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { Communication } from '@/lib/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeEmail(email: unknown) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

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
    ageGroupIds: a.age_group_ids ?? null,
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
  };
}

type RecipientTargeting = {
  includeTeams?: boolean;
  includeContacts?: boolean;
  teamStatuses?: string[];
  paymentStatuses?: string[];
  ageGroupIds?: string[];
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
    const ageGroupIds   = stringSet(targeting?.ageGroupIds);
    const teamIds       = stringSet(targeting?.teamIds);

    const { data: teams, error: teamsError } = await supabaseAdmin
      .from('teams')
      .select('id, email, status, payment_status, age_group_id')
      .eq('tournament_id', tournamentId);

    if (teamsError) throw teamsError;

    for (const team of teams ?? []) {
      const selectedById = teamIds.size > 0 && teamIds.has(team.id);
      const selectedByFilters =
        teamIds.size === 0 &&
        (teamStatuses.size === 0 || teamStatuses.has(team.status)) &&
        (paymentStatuses.size === 0 || paymentStatuses.has(team.payment_status ?? 'pending')) &&
        (ageGroupIds.size === 0 || ageGroupIds.has(team.age_group_id));

      if (!selectedById && !selectedByFilters) continue;
      const email = normalizeEmail(team.email);
      if (email) recipientMap.set(email, email);
    }
  }

  if (targeting?.includeContacts) {
    const contactRoles = stringSet(targeting.contactRoles);
    const { data: contacts, error: contactsError } = await supabaseAdmin
      .from('contacts')
      .select('email, role')
      .eq('tournament_id', tournamentId);

    if (contactsError) throw contactsError;

    for (const contact of contacts ?? []) {
      if (contactRoles.size > 0 && !contactRoles.has(contact.role)) continue;
      const email = normalizeEmail(contact.email);
      if (email && !recipientMap.has(email)) recipientMap.set(email, email);
    }
  }

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
    stringSet(targeting.ageGroupIds).size > 0 ||
    stringSet(targeting.teamIds).size > 0 ||
    stringSet(targeting.contactRoles).size > 0 ||
    stringSet(targeting.paymentStatuses).size > 0 ||
    !isAllStatuses,
  );
}

// ─── GET — list all communications for a tournament ──────────────────────────

export async function GET(req: Request) {
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug });
  if (!ctx) return unauthorized();

  const tournamentId = url.searchParams.get('tournamentId');
  if (!tournamentId) return NextResponse.json([]);

  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;

  const { data, error } = await supabaseAdmin
    .from('announcements')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('published_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data ?? []).map(mapRow));
}

// ─── POST — create, update, delete, toggle-pin ───────────────────────────────

export async function POST(req: Request) {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug });
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

      const channelSite  = Boolean(data.channelSite);
      const channelEmail = Boolean(data.channelEmail);

      if (!channelSite && !channelEmail) {
        return NextResponse.json({ error: 'Select at least one channel (post to site or email).' }, { status: 400 });
      }

      // Division-targeted site posts require T+
      const hasAgeGroupFilter = Array.isArray(data.ageGroupIds) && data.ageGroupIds.length > 0;
      if (hasAgeGroupFilter && !hasPlanFeature(ctx.org.planId, 'targeted_tournament_announcements')) {
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
          age_group_ids:  hasAgeGroupFilter ? data.ageGroupIds : null,
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

        const results = { success: 0, failed: 0, failedAddresses: [] as string[] };

        for (const email of recipients) {
          try {
            await sendEmail(email, data.title.trim(), data.body.trim());
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

      const updates: Record<string, unknown> = {};
      if (data.title    !== undefined) updates.title          = String(data.title).trim();
      if (data.body     !== undefined) updates.body           = String(data.body).trim();
      if (data.pinned   !== undefined) updates.pinned         = Boolean(data.pinned);
      if (data.ageGroupIds !== undefined) {
        const hasFilter = Array.isArray(data.ageGroupIds) && data.ageGroupIds.length > 0;
        if (hasFilter && !hasPlanFeature(ctx.org.planId, 'targeted_tournament_announcements')) {
          return NextResponse.json({ error: requiresTournamentPlusCopy('targeted_tournament_announcements') }, { status: 403 });
        }
        updates.age_group_ids = hasFilter ? data.ageGroupIds : null;
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
      }

      const { error: updateErr } = await supabaseAdmin
        .from('announcements')
        .update({ pinned: !existing?.pinned })
        .eq('id', id);

      if (updateErr) throw updateErr;
      return NextResponse.json({ success: true });
    }

    // ── delete ───────────────────────────────────────────────────────────────
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
      }

      const { error: deleteErr } = await supabaseAdmin
        .from('announcements')
        .delete()
        .eq('id', id);

      if (deleteErr) throw deleteErr;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (err: unknown) {
    console.error('Communications API error:', err);
    const message = err instanceof Error ? err.message : 'Unable to process communication.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
