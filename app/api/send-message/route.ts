import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { getAuthContextWithScope, scopeGuard, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasPlanFeature, requiresTournamentPlusCopy } from '@/lib/plan-features';
import { writePlatformEvent } from '@/lib/platform-events';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

type RecipientTargeting = {
  includeTeams?: boolean;
  includeContacts?: boolean;
  teamStatuses?: string[];
  paymentStatuses?: string[];
  divisionIds?: string[];
  teamIds?: string[];
  contactRoles?: string[];
};

function normalizeEmail(email: unknown) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function stringSet(value: unknown) {
  return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);
}

const ALL_TEAM_STATUSES = new Set(['accepted', 'pending', 'waitlist', 'rejected']);

function isAllStatuses(set: Set<string>) {
  return set.size === 0 || (set.size === ALL_TEAM_STATUSES.size && Array.from(set).every(status => ALL_TEAM_STATUSES.has(status)));
}

function usesAdvancedTargeting(target: RecipientTargeting | null) {
  if (!target) return true;
  const teamStatuses = stringSet(target.teamStatuses);
  return Boolean(
    target.includeContacts ||
    stringSet(target.divisionIds).size > 0 ||
    stringSet(target.teamIds).size > 0 ||
    stringSet(target.contactRoles).size > 0 ||
    stringSet(target.paymentStatuses).size > 0 ||
    !isAllStatuses(teamStatuses)
  );
}

async function trackCommunicationEvent(input: {
  orgId: string;
  userId: string;
  userEmail?: string | null;
  planId: string;
  tournamentId: string;
  status: 'attempted' | 'blocked' | 'completed';
  advancedTargeting: boolean;
  recipientCount?: number;
}) {
  await writePlatformEvent({
    eventType: 'tournament_plus_feature_used',
    source: 'app',
    orgId: input.orgId,
    actorUserId: input.userId,
    actorEmail: input.userEmail,
    planId: input.planId,
    metadata: {
      feature: 'targeted_tournament_announcements',
      action: 'send_tournament_email',
      tournamentId: input.tournamentId,
      status: input.status,
      advancedTargeting: input.advancedTargeting,
      recipientCount: input.recipientCount,
    },
  });
}

export const POST = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug });
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'send_communications')) return forbidden();

  try {
    const { tournamentId, recipients, targeting, subject, message } = await req.json();

    if (!tournamentId || typeof tournamentId !== 'string') {
      return NextResponse.json({ error: 'Tournament is required' }, { status: 400 });
    }

    const denied = scopeGuard(ctx, tournamentId);
    if (denied) return denied;

    const { data: tournament, error: tournamentError } = await supabaseAdmin
      .from('tournaments')
      .select('id')
      .eq('id', tournamentId)
      .eq('org_id', ctx.org.id)
      .single();
    if (tournamentError || !tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    if (!subject || !message) {
      return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 });
    }

    const recipientMap = new Map<string, { email: string; source: 'team' | 'contact' | 'direct' }>();
    const target = (targeting ?? null) as RecipientTargeting | null;
    const advancedTargeting = usesAdvancedTargeting(target);

    await trackCommunicationEvent({
      orgId: ctx.org.id,
      userId: ctx.user.id,
      userEmail: ctx.user.email,
      planId: ctx.org.planId,
      tournamentId,
      status: 'attempted',
      advancedTargeting,
    });

    if (advancedTargeting && !hasPlanFeature(ctx.org.planId, 'targeted_tournament_announcements')) {
      await trackCommunicationEvent({
        orgId: ctx.org.id,
        userId: ctx.user.id,
        userEmail: ctx.user.email,
        planId: ctx.org.planId,
        tournamentId,
        status: 'blocked',
        advancedTargeting,
      });
      return NextResponse.json({ error: requiresTournamentPlusCopy('targeted_tournament_announcements') }, { status: 403 });
    }

    if (target) {
      const teamStatuses = stringSet(target.teamStatuses);
      const paymentStatuses = stringSet(target.paymentStatuses);
      const divisionIds = stringSet(target.divisionIds);
      const teamIds = stringSet(target.teamIds);
      const contactRoles = stringSet(target.contactRoles);

      if (target.includeTeams) {
        const { data: teams, error: teamsError } = await supabaseAdmin
          .from('teams')
          .select('id, email, status, payment_status, division_id')
          .eq('tournament_id', tournamentId);
        if (teamsError) return NextResponse.json({ error: teamsError.message }, { status: 500 });

        for (const team of teams ?? []) {
          const selectedById = teamIds.size > 0 && teamIds.has(team.id);
          const selectedByFilters =
            teamIds.size === 0 &&
            (teamStatuses.size === 0 || teamStatuses.has(team.status)) &&
            (paymentStatuses.size === 0 || paymentStatuses.has(team.payment_status ?? 'pending')) &&
            (divisionIds.size === 0 || divisionIds.has(team.division_id));

          if (!selectedById && !selectedByFilters) continue;

          const email = normalizeEmail(team.email);
          if (email) recipientMap.set(email, { email, source: 'team' });
        }
      }

      // contacts table removed — includeContacts is a no-op
    } else {
      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return NextResponse.json({ error: 'No recipients selected' }, { status: 400 });
      }

      const directRecipients = Array.from(new Set(recipients.map(normalizeEmail).filter(Boolean)));
      for (const email of directRecipients) {
        recipientMap.set(email, { email, source: 'direct' });
      }
    }

    const normalizedRecipients = Array.from(recipientMap.keys());
    if (normalizedRecipients.length === 0) {
      return NextResponse.json({ error: 'No valid recipients selected' }, { status: 400 });
    }

    // Iterate through recipients and send emails
    // We send them sequentially to avoid hitting rate limits too fast (Resend free tier is 2 req/sec)
    // For larger volumes, a background job or Resend's batch API would be better.
    const results = { success: 0, failed: 0 };

    for (const email of normalizedRecipients) {
      try {
        await sendEmail(email, subject, message);
        results.success++;
      } catch (err) {
        console.error(`Failed to send to ${email}:`, err);
        results.failed++;
      }
    }

    await trackCommunicationEvent({
      orgId: ctx.org.id,
      userId: ctx.user.id,
      userEmail: ctx.user.email,
      planId: ctx.org.planId,
      tournamentId,
      status: 'completed',
      advancedTargeting,
      recipientCount: normalizedRecipients.length,
    });

    return NextResponse.json({ 
      message: `Finished sending. Success: ${results.success}, Failed: ${results.failed}`,
      results
    });
  } catch (err: unknown) {
    console.error('Send message error:', err);
    const message = err instanceof Error ? err.message : 'Unable to send message';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}, { route: '/api/send-message' });
