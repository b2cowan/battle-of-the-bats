/**
 * POST /api/admin/email/send
 *
 * Manual "Send now" trigger for the platform admin email dashboard.
 * Creates a batch, sends to all qualifying recipients, and returns
 * the batch ID + final counts.
 *
 * Body: { emailKey: string }
 *
 * Currently only founding_welcome has a compiled template.
 * Other email keys return 501 Not Implemented until their templates are built.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAreaApi } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendMarketingEmail, createEmailBatch, finalizeBatch } from '@/lib/email-sender';
import {
  foundingWelcomeHtml,
  foundingCheckinHtml,
  foundingRenewalHtml,
  foundingFinalHtml,
  spotlightClubHtml,
  spotlightLeagueHtml,
  spotlightCoachesOrgHtml,
  spotlightCoachesCoachHtml,
  spotlightClubLastHtml,
  spotlightFullPictureHtml,
} from '@/lib/email';
import { buildUnsubscribeUrl } from '@/lib/unsubscribe-token';
import { withObservability } from '@/lib/observability';

const FOUNDING_SEASON_EXPIRES = '2027-01-01T00:00:00.000Z';
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.fieldlogichq.ca';

// ── Email key → template config ───────────────────────────────────────────────
// Add new entries here as templates are built in follow-up sessions.
const TEMPLATE_REGISTRY: Record<string, { subject: string; built: boolean }> = {
  founding_welcome: { subject: 'Your founding season starts now — Tournament Plus is free through Dec 31', built: true },
  founding_checkin: { subject: 'How\'s your season going? Update from FieldLogicHQ', built: true },
  founding_renewal: { subject: 'Your founding season ends December 31 — here\'s what happens next', built: true },
  founding_final: { subject: '2 weeks left in your founding season', built: true },
  spotlight_club: { subject: 'Before your September season starts — Club is free through December 31', built: true },
  spotlight_league: { subject: 'What running a house league actually looks like on FieldLogicHQ', built: true },
  spotlight_coaches_org: { subject: 'For the coaches on your teams — a workspace that\'s actually theirs', built: true },
  spotlight_coaches_coach: { subject: 'For the coaches on your teams — a workspace that\'s actually theirs', built: true },
  spotlight_club_last: { subject: 'Last reminder — Club is still free through December 31', built: true },
  spotlight_full_picture: { subject: 'Where FieldLogicHQ is headed — a note from the founding season', built: true },
};

// ── Audience fetchers ─────────────────────────────────────────────────────────

async function getFoundingSeasonRecipients(): Promise<
  Array<{ orgId: string; orgName: string; ownerEmail: string; ownerName: string | null }>
> {
  // Get founding season orgs
  const { data: overrides, error: ovErr } = await supabaseAdmin
    .from('org_overrides')
    .select('org_id')
    .eq('type', 'comp_period')
    .eq('expires_at', FOUNDING_SEASON_EXPIRES);

  if (ovErr || !overrides?.length) return [];

  const orgIds = overrides.map(o => o.org_id as string);

  // Get org details + opt-out status
  const { data: orgs, error: orgErr } = await supabaseAdmin
    .from('organizations')
    .select('id, name, email_marketing_opt_out')
    .in('id', orgIds)
    .eq('email_marketing_opt_out', false);

  if (orgErr || !orgs?.length) return [];

  // Get owner email for each org
  const results = await Promise.all(
    orgs.map(async (org) => {
      const { data: member } = await supabaseAdmin
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', org.id)
        .eq('role', 'owner')
        .maybeSingle();

      if (!member?.user_id) return null;

      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(member.user_id);
      const email = authUser?.user?.email;
      const name = authUser?.user?.user_metadata?.full_name as string | null ?? null;

      if (!email) return null;

      return {
        orgId: org.id as string,
        orgName: org.name as string,
        ownerEmail: email,
        ownerName: name,
      };
    })
  );

  return results.filter(Boolean) as Array<{
    orgId: string;
    orgName: string;
    ownerEmail: string;
    ownerName: string | null;
  }>;
}

// Same as getFoundingSeasonRecipients but excludes orgs already on a League/Club tier
// (league, club, AND club_large — Club · Association is a Club tier, don't pitch it Club).
async function getFoundingSeasonRecipientsNotOnClub(): Promise<
  Array<{ orgId: string; orgName: string; ownerEmail: string; ownerName: string | null }>
> {
  const { data: overrides } = await supabaseAdmin
    .from('org_overrides')
    .select('org_id')
    .eq('type', 'comp_period')
    .eq('expires_at', FOUNDING_SEASON_EXPIRES);

  if (!overrides?.length) return [];
  const orgIds = overrides.map(o => o.org_id as string);

  const { data: orgs } = await supabaseAdmin
    .from('organizations')
    .select('id, name, email_marketing_opt_out')
    .in('id', orgIds)
    .eq('email_marketing_opt_out', false)
    .not('plan_id', 'in', '(league,club,club_large)');

  if (!orgs?.length) return [];

  const results = await Promise.all(
    orgs.map(async (org) => {
      const { data: member } = await supabaseAdmin
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', org.id)
        .eq('role', 'owner')
        .maybeSingle();

      if (!member?.user_id) return null;

      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(member.user_id);
      const email = authUser?.user?.email;
      const name = authUser?.user?.user_metadata?.full_name as string | null ?? null;

      if (!email) return null;
      return { orgId: org.id as string, orgName: org.name as string, ownerEmail: email, ownerName: name };
    })
  );

  return results.filter(Boolean) as Array<{
    orgId: string; orgName: string; ownerEmail: string; ownerName: string | null;
  }>;
}

// Coach recipients: coaches who participated in founding season tournaments.
// Uses the founding org's ID for opt-out suppression (V1 simplification).
async function getCoachRecipients(): Promise<
  Array<{ orgId: string; orgName: string; ownerEmail: string; ownerName: string | null }>
> {
  const { data: overrides } = await supabaseAdmin
    .from('org_overrides')
    .select('org_id')
    .eq('type', 'comp_period')
    .eq('expires_at', FOUNDING_SEASON_EXPIRES);

  if (!overrides?.length) return [];
  const orgIds = overrides.map(o => o.org_id as string);

  const { data: orgs } = await supabaseAdmin
    .from('organizations')
    .select('id, name, email_marketing_opt_out')
    .in('id', orgIds)
    .eq('email_marketing_opt_out', false);

  if (!orgs?.length) return [];
  const activeOrgIds = orgs.map(o => o.id as string);
  const orgNameMap = Object.fromEntries(orgs.map(o => [o.id as string, o.name as string]));

  const { data: coaches } = await supabaseAdmin
    .from('organization_members')
    .select('user_id, organization_id')
    .in('organization_id', activeOrgIds)
    .eq('role', 'coach');

  if (!coaches?.length) return [];

  const seen = new Set<string>();
  const results = await Promise.all(
    coaches
      .filter(c => {
        if (seen.has(c.user_id)) return false;
        seen.add(c.user_id);
        return true;
      })
      .map(async (coach) => {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(coach.user_id);
        const email = authUser?.user?.email;
        const name = authUser?.user?.user_metadata?.full_name as string | null ?? null;
        if (!email) return null;
        return {
          orgId: coach.organization_id as string,
          orgName: orgNameMap[coach.organization_id as string] ?? '',
          ownerEmail: email,
          ownerName: name,
        };
      })
  );

  return results.filter(Boolean) as Array<{
    orgId: string; orgName: string; ownerEmail: string; ownerName: string | null;
  }>;
}

export const POST = withObservability(async (request: NextRequest) => {
  const auth = await requirePlatformAreaApi('email', 'write');
  if (auth.response) return auth.response;

  let emailKey: string;
  try {
    const body = await request.json();
    emailKey = body.emailKey;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!emailKey || !TEMPLATE_REGISTRY[emailKey]) {
    return NextResponse.json({ error: `Unknown email key: ${emailKey}` }, { status: 400 });
  }

  const templateConfig = TEMPLATE_REGISTRY[emailKey];

  if (!templateConfig.built) {
    return NextResponse.json(
      { error: `Template for "${emailKey}" is not yet built. Build it in a follow-up session.` },
      { status: 501 }
    );
  }

  // Select audience based on email key
  type Recipient = { orgId: string; orgName: string; ownerEmail: string; ownerName: string | null };
  let recipients: Recipient[];

  if (emailKey === 'spotlight_coaches_coach') {
    recipients = await getCoachRecipients();
  } else if (emailKey === 'spotlight_club_last') {
    recipients = await getFoundingSeasonRecipientsNotOnClub();
  } else {
    recipients = await getFoundingSeasonRecipients();
  }

  if (!recipients.length) {
    return NextResponse.json({
      batchId: null,
      sent: 0,
      suppressed: 0,
      failed: 0,
      message: 'No qualifying recipients found.',
    });
  }

  const batchId = await createEmailBatch({
    emailKey,
    subject: templateConfig.subject,
    triggeredBy: `platform_admin:${auth.user.email}`,
    recipientCount: recipients.length,
  });

  if (!batchId) {
    return NextResponse.json({ error: 'Failed to create email batch' }, { status: 500 });
  }

  let sent = 0, suppressed = 0, failed = 0;

  for (const recipient of recipients) {
    let html: string;

    if (emailKey === 'founding_welcome') {
      const unsubscribeUrl = buildUnsubscribeUrl(recipient.orgId);
      html = foundingWelcomeHtml({
        orgName: recipient.orgName,
        firstName: recipient.ownerName ?? undefined,
        setupUrl: `${SITE_URL}/${recipient.orgId}/admin/tournaments`,
        unsubscribeUrl,
      });

    } else if (emailKey === 'founding_checkin') {
      // Per-org enrichment: weeks active, tournament count, game count
      const [orgRes, tourneyRes] = await Promise.all([
        supabaseAdmin.from('organizations').select('created_at').eq('id', recipient.orgId).single(),
        supabaseAdmin.from('tournaments').select('id').eq('organization_id', recipient.orgId),
      ]);
      const createdAt = orgRes.data?.created_at ? new Date(orgRes.data.created_at as string) : new Date();
      const weeksActive = Math.floor((Date.now() - createdAt.getTime()) / (7 * 24 * 60 * 60 * 1000));
      const tournamentIds = (tourneyRes.data ?? []).map(t => t.id as string);
      const tournamentCount = tournamentIds.length;
      let gameCount = 0;
      if (tournamentIds.length > 0) {
        const { count } = await supabaseAdmin
          .from('games')
          .select('*', { count: 'exact', head: true })
          .in('tournament_id', tournamentIds);
        gameCount = count ?? 0;
      }
      html = foundingCheckinHtml({
        orgName: recipient.orgName,
        firstName: recipient.ownerName ?? undefined,
        weeksActive,
        tournamentCount,
        gameCount,
        setupUrl: `${SITE_URL}/${recipient.orgId}/admin/tournaments`,
      });

    } else if (emailKey === 'founding_renewal') {
      const [activeRes, allRes] = await Promise.all([
        supabaseAdmin.from('tournaments').select('id').eq('organization_id', recipient.orgId).eq('is_active', true),
        supabaseAdmin.from('tournaments').select('id').eq('organization_id', recipient.orgId),
      ]);
      const activeTournamentCount = activeRes.data?.length ?? 0;
      const pastTournamentCount = (allRes.data?.length ?? 0) - activeTournamentCount;
      html = foundingRenewalHtml({
        orgName: recipient.orgName,
        firstName: recipient.ownerName ?? undefined,
        activeTournamentCount,
        pastTournamentCount,
        billingUrl: `${SITE_URL}/${recipient.orgId}/admin/org/billing`,
        planCompareUrl: `${SITE_URL}/pricing`,
      });

    } else if (emailKey === 'founding_final') {
      html = foundingFinalHtml({
        orgName: recipient.orgName,
        firstName: recipient.ownerName ?? undefined,
        hasPaymentMethod: false, // Stripe Phase G not yet live — always no-card branch
        billingUrl: `${SITE_URL}/${recipient.orgId}/admin/org/billing`,
      });

    } else if (emailKey === 'spotlight_club') {
      html = spotlightClubHtml({
        orgName: recipient.orgName,
        firstName: recipient.ownerName ?? undefined,
        setupUrl: `${SITE_URL}/pricing`,
      });

    } else if (emailKey === 'spotlight_league') {
      html = spotlightLeagueHtml({
        orgName: recipient.orgName,
        firstName: recipient.ownerName ?? undefined,
        setupUrl: `${SITE_URL}/pricing`,
      });

    } else if (emailKey === 'spotlight_coaches_org') {
      html = spotlightCoachesOrgHtml({
        orgName: recipient.orgName,
        firstName: recipient.ownerName ?? undefined,
        coachShareUrl: `${SITE_URL}/for-coaches`,
        interestUrl: `${SITE_URL}/for-coaches`,
      });

    } else if (emailKey === 'spotlight_coaches_coach') {
      html = spotlightCoachesCoachHtml({
        firstName: recipient.ownerName ?? undefined,
        interestUrl: `${SITE_URL}/for-coaches`,
      });

    } else if (emailKey === 'spotlight_club_last') {
      html = spotlightClubLastHtml({
        orgName: recipient.orgName,
        firstName: recipient.ownerName ?? undefined,
        setupUrl: `${SITE_URL}/pricing`,
      });

    } else if (emailKey === 'spotlight_full_picture') {
      html = spotlightFullPictureHtml({
        firstName: recipient.ownerName ?? undefined,
        shareUrl: SITE_URL,
        billingUrl: `${SITE_URL}/${recipient.orgId}/admin/org/billing`,
      });

    } else {
      // Safety net — should not reach here given built: true guards above
      failed++;
      continue;
    }

    const result = await sendMarketingEmail({
      emailKey,
      orgId: recipient.orgId,
      toEmail: recipient.ownerEmail,
      toName: recipient.ownerName ?? undefined,
      subject: templateConfig.subject,
      html,
      batchId,
      skipOptOutCheck: false, // Batch sends always check opt-out
    });

    if (result === 'sent') sent++;
    else if (result === 'suppressed') suppressed++;
    else failed++;
  }

  await finalizeBatch(batchId, failed > 0 && sent === 0 ? 'failed' : 'complete');

  return NextResponse.json({ batchId, sent, suppressed, failed });
}, { route: '/api/admin/email/send' });
