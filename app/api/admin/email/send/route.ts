/**
 * POST /api/admin/email/send
 *
 * Manual "Send now" trigger for the platform admin email dashboard.
 * Creates a batch, sends to all qualifying recipients, and returns
 * the batch ID + final counts.
 *
 * Body: { emailKey: string }
 *
 * Each campaign's content lives in platform_email_templates (category 'marketing',
 * seeded by migration 179) and is rendered per recipient through the shared resolver —
 * the same render used by the dashboard preview. A missing template row (migration not
 * applied) returns 500 with a clear message.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAreaApi } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { FOUNDING_SEASON_COMP_EXPIRIES } from '@/lib/plan-config';
import { sendMarketingEmail, createEmailBatch, finalizeBatch } from '@/lib/email-sender';
import {
  LIVE_MARKETING_EMAIL_KEYS,
  MARKETING_EMAIL_AUDIENCE,
  MARKETING_EMAIL_DEFAULTS,
} from '@/lib/marketing-email-defaults';
import { resolvePlatformTemplate, renderTemplateEmail } from '@/lib/platform-email-templates';
import type { EmailVars } from '@/lib/email-markup';
import { withObservability } from '@/lib/observability';


const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.fieldlogichq.ca';

// ── Valid marketing campaign keys ─────────────────────────────────────────────
// Content + subject for each of these lives in the operator-editable
// platform_email_templates registry (migration 179, category 'marketing') and is
// rendered — for both send AND preview — through the shared markup resolver. Audience
// routing for each key is handled in the POST handler below.
//
// The SET comes from lib/marketing-email-defaults.ts, which is the one place a campaign is
// declared (Founding Season 2027 Phase 1). A RETIRED campaign is absent from it, so this route
// refuses it even though its template row still exists — which is exactly what "retired" means:
// the copy is kept for revival, the send is not possible.
const CAMPAIGN_KEYS = new Set<string>(LIVE_MARKETING_EMAIL_KEYS);

// ── Audience fetchers ─────────────────────────────────────────────────────────
//
// ⚠ THE FOUNDING POOL IS REAL ORGANIZATIONS ONLY, and it has to be filtered for that explicitly.
//
// A comped standalone Premium Coaches Portal is backed by a SHADOW ORG that carries the very same
// founding-season `comp_period` override a real organization does (lib/team-checkout.ts calls
// ensureFoundingSeasonCompPeriod on the workspace org). So the override query below cannot tell
// the two apart, and without this filter every founding campaign — all of which are written for an
// organization — would have gone to coaches too, telling them "Tournament Plus is free through …",
// quoting them $39/month for a product they never had, and linking them to an org billing page and
// a tournaments dashboard for a workspace that has neither.
//
// It has not happened yet only because no coach workspace has taken the comp on this data. The two
// Coaches Portal spotlights in the current campaign set exist to change exactly that, so the window
// where this was harmless was about to close. Found by /review 2026-09-07.
//
// The predicate is the repo's canonical shadow-org test (isTeamWorkspaceOrgRow,
// lib/team-org-links.ts): account_kind = 'team_workspace' OR plan_id = 'team'. Both columns are
// NOT NULL, so the negated form below has no null-semantics trap.
//
// ⚠ Coaches are therefore NOT reachable by any of these campaigns — deliberate, and a real gap: a
// coach's free season would end with no warning. Closing it needs its own audience AND its own
// copy, because the consequence differs by product (an organization drops to the free Tournament
// plan keeping everything; a coach's portal closes). Copy canon §1 rule 4 forbids putting both on
// one surface. That is Phase 2's work — see FOUNDING_SEASON_2027_PLAN.md §3 Phase 1's open item.

async function getFoundingSeasonRecipients(): Promise<
  Array<{ orgId: string; orgName: string; ownerEmail: string; ownerName: string | null }>
> {
  // Get founding season orgs
  const { data: overrides, error: ovErr } = await supabaseAdmin
    .from('org_overrides')
    .select('org_id')
    .eq('type', 'comp_period')
    .in('expires_at', [...FOUNDING_SEASON_COMP_EXPIRIES])
    .is('revoked_at', null);

  if (ovErr || !overrides?.length) return [];

  const orgIds = overrides.map(o => o.org_id as string);

  // Get org details + opt-out status
  const { data: orgs, error: orgErr } = await supabaseAdmin
    .from('organizations')
    .select('id, name, email_marketing_opt_out')
    .in('id', orgIds)
    .eq('email_marketing_opt_out', false)
    // ⚠ REAL ORGANIZATIONS ONLY — see the note above the fetchers. Found by /review 2026-09-07.
    .eq('account_kind', 'organization')
    .neq('plan_id', 'team');

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
    .in('expires_at', [...FOUNDING_SEASON_COMP_EXPIRIES])
    .is('revoked_at', null);

  if (!overrides?.length) return [];
  const orgIds = overrides.map(o => o.org_id as string);

  const { data: orgs } = await supabaseAdmin
    .from('organizations')
    .select('id, name, email_marketing_opt_out')
    .in('id', orgIds)
    .eq('email_marketing_opt_out', false)
    // Real organizations only — same reason as getFoundingSeasonRecipients above.
    .eq('account_kind', 'organization')
    .not('plan_id', 'in', '(league,club,club_large,team)');

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
// `orgId` is the founding org (used only for send LOGGING). Opt-out + unsubscribe are
// per-person via `userId` (CASL fix) — a coach's choice never touches the org's opt-out.
async function getCoachRecipients(): Promise<
  Array<{ orgId: string; orgName: string; ownerEmail: string; ownerName: string | null; userId: string }>
> {
  const { data: overrides } = await supabaseAdmin
    .from('org_overrides')
    .select('org_id')
    .eq('type', 'comp_period')
    .in('expires_at', [...FOUNDING_SEASON_COMP_EXPIRIES])
    .is('revoked_at', null);

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
          userId: coach.user_id as string,
        };
      })
  );

  return results.filter(Boolean) as Array<{
    orgId: string; orgName: string; ownerEmail: string; ownerName: string | null; userId: string;
  }>;
}

// ── Per-org template variables ────────────────────────────────────────────────
// Build the values filled into a campaign's markup tokens for one recipient. This
// preserves the per-org enrichment the hand-built emails used (weeks active,
// tournament/game counts) so the rendered content matches what shipped before —
// only now the words around these values are edited from the console.
async function buildVars(
  emailKey: string,
  r: { orgId: string; orgName: string; ownerName: string | null },
): Promise<EmailVars> {
  const firstName = r.ownerName ?? 'there';
  const setupUrl = `${SITE_URL}/${r.orgId}/admin/tournaments`;
  const billingUrl = `${SITE_URL}/${r.orgId}/admin/org/billing`;

  switch (emailKey) {
    case 'founding_welcome':
      return { firstName, orgName: r.orgName, setupUrl };

    case 'founding_checkin': {
      const [orgRes, tourneyRes] = await Promise.all([
        supabaseAdmin.from('organizations').select('created_at').eq('id', r.orgId).single(),
        supabaseAdmin.from('tournaments').select('id').eq('organization_id', r.orgId),
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
      return {
        firstName, orgName: r.orgName, setupUrl,
        weeksPhrase: `${weeksActive} week${weeksActive !== 1 ? 's' : ''}`,
        hasActivity: tournamentCount > 0 ? '1' : '',
        tournamentsPhrase: `${tournamentCount} tournament${tournamentCount !== 1 ? 's' : ''}`,
        gamesPhrase: `${gameCount} game${gameCount !== 1 ? 's' : ''}`,
        gameCount,
      };
    }

    case 'founding_renewal': {
      const [activeRes, allRes] = await Promise.all([
        supabaseAdmin.from('tournaments').select('id').eq('organization_id', r.orgId).eq('is_active', true),
        supabaseAdmin.from('tournaments').select('id').eq('organization_id', r.orgId),
      ]);
      const activeTournamentCount = activeRes.data?.length ?? 0;
      const pastTournamentCount = (allRes.data?.length ?? 0) - activeTournamentCount;
      return {
        firstName, orgName: r.orgName, billingUrl,
        planCompareUrl: `${SITE_URL}/pricing`,
        hasHistory: (activeTournamentCount > 0 || pastTournamentCount > 0) ? '1' : '',
        hasActive: activeTournamentCount > 0 ? '1' : '',
        activePhrase: `${activeTournamentCount} active tournament${activeTournamentCount !== 1 ? 's' : ''}`,
        hasPast: pastTournamentCount > 0 ? '1' : '',
        pastPhrase: `${pastTournamentCount} past tournament${pastTournamentCount !== 1 ? 's' : ''}`,
      };
    }

    case 'founding_nudge':
    case 'founding_final':
      // Both summer reminders branch on whether a card is on file. The app does not RECORD that
      // fact yet — it lives only in Stripe — so hasCard stays falsy and the "add a payment
      // method" branch is what sends. Recording it at webhook time is Phase 2's first item
      // (FOUNDING_SEASON_2027_PLAN §3 Phase 2.1); the day it lands, pass it here and both
      // emails improve with no copy change.
      return { firstName, orgName: r.orgName, hasCard: '', billingUrl };

    case 'spotlight_coaches_org':
      return { firstName, coachShareUrl: `${SITE_URL}/for-coaches`, interestUrl: `${SITE_URL}/for-coaches` };

    case 'spotlight_coaches_coach':
      return { firstName, interestUrl: `${SITE_URL}/for-coaches` };

    case 'spotlight_full_picture':
      return { firstName, shareUrl: SITE_URL };

    default:
      return { firstName, orgName: r.orgName };
  }
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

  if (!emailKey || !CAMPAIGN_KEYS.has(emailKey)) {
    return NextResponse.json({ error: `Unknown email key: ${emailKey}` }, { status: 400 });
  }

  // Load the campaign's editable content (subject + body markup). This is the single
  // source for both send and preview; if it's missing the migration hasn't been applied.
  const template = await resolvePlatformTemplate(emailKey);
  if (!template) {
    return NextResponse.json(
      { error: `Campaign content for "${emailKey}" not found. Ensure migration 179 (marketing email templates) has been applied.` },
      { status: 500 },
    );
  }

  // Select the audience the campaign registry declares for this key. Reading it from the
  // registry (rather than re-testing key names here) is what keeps the count the dashboard shows
  // and the recipients this route resolves from ever describing different people.
  type Recipient = { orgId: string; orgName: string; ownerEmail: string; ownerName: string | null; userId?: string };
  let recipients: Recipient[];

  switch (MARKETING_EMAIL_AUDIENCE[emailKey]) {
    case 'coaches':
      recipients = await getCoachRecipients();
      break;
    case 'not_on_club':
      recipients = await getFoundingSeasonRecipientsNotOnClub();
      break;
    default:
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

  // A campaign DECLARES the variables its copy uses; buildVars is what SUPPLIES them, and nothing
  // tied the two together. A token added to a body (with its name added to `variables`, which the
  // registry test does check) but without a matching buildVars case would render as a literal
  // "{{token}}" in real customer mail — or, worse, silently take the wrong ::if branch and state
  // the opposite of the truth about someone's billing. Prove the contract on the first recipient
  // and refuse the WHOLE batch, rather than discovering it one sent email too late.
  const declared = MARKETING_EMAIL_DEFAULTS[emailKey]?.variables ?? [];
  const sampleVars = await buildVars(emailKey, recipients[0]);
  const missing = declared.filter(v => !(v in sampleVars));
  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: `Campaign "${emailKey}" declares variables its send path does not supply: ${missing.join(', ')}. `
          + 'Nothing was sent. Add the missing values to buildVars in this route.',
      },
      { status: 500 },
    );
  }

  const batchId = await createEmailBatch({
    emailKey,
    subject: template.subject,
    triggeredBy: `platform_admin:${auth.user.email}`,
    recipientCount: recipients.length,
  });

  if (!batchId) {
    return NextResponse.json({ error: 'Failed to create email batch' }, { status: 500 });
  }

  let sent = 0, suppressed = 0, failed = 0;

  for (const recipient of recipients) {
    // Fill the campaign's tokens with this org's values, then render subject + branded
    // HTML through the shared resolver — the SAME render used by the preview. The
    // unsubscribe footer is injected downstream by sendMarketingEmail (opt-out path).
    const vars = await buildVars(emailKey, recipient);
    const { subject, html } = renderTemplateEmail(template, vars);

    const result = await sendMarketingEmail({
      emailKey,
      orgId: recipient.orgId,
      toEmail: recipient.ownerEmail,
      toName: recipient.ownerName ?? undefined,
      subject,
      html,
      batchId,
      skipOptOutCheck: false, // Batch sends always check opt-out
      // Coach-audience sends opt out the PERSON, not the org (CASL fix). Non-coach
      // recipients carry no userId, so they stay on the org-scoped path.
      recipientUserId: recipient.userId,
    });

    if (result === 'sent') sent++;
    else if (result === 'suppressed') suppressed++;
    else failed++;
  }

  await finalizeBatch(batchId, failed > 0 && sent === 0 ? 'failed' : 'complete');

  return NextResponse.json({ batchId, sent, suppressed, failed });
}, { route: '/api/admin/email/send' });
