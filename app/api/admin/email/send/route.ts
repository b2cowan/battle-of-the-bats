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
import { getPlatformAdminContext } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendMarketingEmail, createEmailBatch, finalizeBatch } from '@/lib/email-sender';
import { foundingWelcomeHtml } from '@/lib/email';
import { buildUnsubscribeUrl } from '@/lib/unsubscribe-token';

const FOUNDING_SEASON_EXPIRES = '2027-01-01T00:00:00.000Z';
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.fieldlogichq.ca';

// ── Email key → template config ───────────────────────────────────────────────
// Add new entries here as templates are built in follow-up sessions.
const TEMPLATE_REGISTRY: Record<string, { subject: string; built: boolean }> = {
  founding_welcome: { subject: 'Your founding season starts now — Tournament Plus is free through Dec 31', built: true },
  founding_checkin: { subject: 'How\'s your season going? Update from FieldLogicHQ', built: false },
  founding_renewal: { subject: 'Your founding season ends December 31 — here\'s what happens next', built: false },
  founding_final: { subject: '2 weeks left in your founding season', built: false },
  spotlight_club: { subject: 'Before your September season starts — Club is free through December 31', built: false },
  spotlight_league: { subject: 'What running a house league actually looks like on FieldLogicHQ', built: false },
  spotlight_coaches_org: { subject: 'For the coaches on your teams — a workspace that\'s actually theirs', built: false },
  spotlight_coaches_coach: { subject: 'For the coaches on your teams — a workspace that\'s actually theirs', built: false },
  spotlight_club_last: { subject: 'Last reminder — Club is still free through December 31', built: false },
  spotlight_full_picture: { subject: 'Where FieldLogicHQ is headed — a note from the founding season', built: false },
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

export async function POST(request: NextRequest) {
  const auth = await getPlatformAdminContext();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

  // founding_welcome is transactional (triggered per-signup). A manual batch send
  // is supported for backfills but should be used carefully.
  const recipients = await getFoundingSeasonRecipients();

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
    } else {
      // Should not reach here (built: false guards above) but safety net
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
}
