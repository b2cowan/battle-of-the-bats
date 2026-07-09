/**
 * GET /api/admin/email/preview?emailKey=<key>
 *
 * Returns the branded HTML + subject for a marketing campaign, rendered with SAMPLE
 * org values through the exact same resolver the send path uses. The Email Dashboard's
 * preview modal renders this, so "what you preview" is guaranteed to equal "what is
 * sent" — retiring the old client-side preview mirror (SoT register SOT-6/-14).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAreaApi } from '@/lib/platform-auth';
import { resolvePlatformTemplate, renderTemplateEmail } from '@/lib/platform-email-templates';
import type { EmailVars } from '@/lib/email-markup';
import { withObservability } from '@/lib/observability';

// Placeholder values so a preview reads naturally without a real recipient. These mirror
// the demo figures the previous static previews used.
const SAMPLE_VARS: EmailVars = {
  firstName: 'Demo User',
  orgName: 'Demo Org',
  setupUrl: '#',
  billingUrl: '#',
  planCompareUrl: '#',
  coachShareUrl: '#',
  interestUrl: '#',
  shareUrl: '#',
  weeksPhrase: '8 weeks',
  hasActivity: '1',
  tournamentsPhrase: '2 tournaments',
  gamesPhrase: '47 games',
  gameCount: 47,
  hasHistory: '1',
  hasActive: '1',
  activePhrase: '1 active tournament',
  hasPast: '1',
  pastPhrase: '3 past tournaments',
  hasCard: '',
};

// The CASL unsubscribe footer is injected at send time by lib/email-sender.ts; show a
// sample copy here so the preview looks like the delivered email.
const SAMPLE_FOOTER =
  `<div style="margin-top:2rem;padding-top:1.25rem;border-top:1px solid rgba(217,249,157,0.1);">` +
  `<p style="margin:0;color:rgba(241,245,249,0.3);font-size:0.72rem;line-height:1.55;">` +
  `You're receiving this because you signed up for FieldLogicHQ.&nbsp;` +
  `<a href="#" style="color:rgba(217,249,157,0.5);text-decoration:underline;">Unsubscribe</a>` +
  `&nbsp;·&nbsp; FieldLogicHQ · Canada</p></div>`;

export const GET = withObservability(async (request: NextRequest) => {
  const auth = await requirePlatformAreaApi('email', 'view');
  if (auth.response) return auth.response;

  const emailKey = request.nextUrl.searchParams.get('emailKey') ?? '';
  if (!emailKey) {
    return NextResponse.json({ error: 'emailKey is required' }, { status: 400 });
  }

  const template = await resolvePlatformTemplate(emailKey);
  if (!template) {
    return NextResponse.json(
      { error: `Campaign content for "${emailKey}" not found. Ensure migration 179 (marketing email templates) has been applied.` },
      { status: 404 },
    );
  }

  const { subject, html } = renderTemplateEmail(template, SAMPLE_VARS, { footerHtml: SAMPLE_FOOTER });
  return NextResponse.json({ subject, html, isCustomised: template.is_customised });
}, { route: '/api/admin/email/preview' });
