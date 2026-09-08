/**
 * GET /api/admin/email
 *
 * Returns data for the platform admin email dashboard:
 *  - Recent email batches (sent history)
 *  - Opt-out org list
 *  - Live recipient counts per email key
 *
 * Protected: requires view access to the `email` platform area (super_admin / product / growth).
 */

import { NextResponse } from 'next/server';
import { requirePlatformAreaApi } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { FOUNDING_SEASON_COMP_EXPIRIES } from '@/lib/plan-config';
import { LIVE_MARKETING_CAMPAIGNS } from '@/lib/marketing-email-defaults';
import { withObservability } from '@/lib/observability';

// ── Founding season audience query ────────────────────────────────────────────
// Orgs with a founding-season comp_period override that have NOT opted out of marketing emails.
// The expiry is matched against FOUNDING_SEASON_COMP_EXPIRIES — the CURRENT instant and the
// legacy one, because the 2026 cohort's rows are moved to the new date by a data-only backfill
// that no gate can prove has run (see lib/plan-config.ts). Never hardcode the date here.


async function getFoundingSeasonRecipientCount(): Promise<number> {
  // Step 1: get founding season org IDs
  const { data: overrides, error: ovErr } = await supabaseAdmin
    .from('org_overrides')
    .select('org_id')
    .eq('type', 'comp_period')
    .in('expires_at', [...FOUNDING_SEASON_COMP_EXPIRIES])
    .is('revoked_at', null);

  if (ovErr || !overrides?.length) return 0;
  const orgIds = overrides.map(o => o.org_id as string);

  // Step 2: count orgs in that set that have not opted out
  const { count, error } = await supabaseAdmin
    .from('organizations')
    .select('id', { count: 'exact', head: true })
    .eq('email_marketing_opt_out', false)
    .in('id', orgIds);

  if (error) {
    console.error('[email/route] recipient count error:', error);
    return 0;
  }
  return count ?? 0;
}

async function getOptOutCount(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('organizations')
    .select('id', { count: 'exact', head: true })
    .eq('email_marketing_opt_out', true);

  if (error) return 0;
  return count ?? 0;
}

export const GET = withObservability(async () => {
  const auth = await requirePlatformAreaApi('email', 'view');
  if (auth.response) return auth.response;

  try {
    // Fetch in parallel
    const [
      batchesResult,
      optOutsResult,
      foundingCount,
      optOutCount,
    ] = await Promise.all([
      // Recent batches — last 50
      supabaseAdmin
        .from('email_batches')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50),

      // Opt-out orgs — joined with owner email via org_members
      supabaseAdmin
        .from('organizations')
        .select(`
          id,
          name,
          email_marketing_opt_out,
          email_opt_out_at
        `)
        .eq('email_marketing_opt_out', true)
        .order('email_opt_out_at', { ascending: false })
        .limit(100),

      getFoundingSeasonRecipientCount(),
      getOptOutCount(),
    ]);

    // Enrich opt-out orgs with owner email
    const optOutOrgs = optOutsResult.data ?? [];
    const enrichedOptOuts = await Promise.all(
      optOutOrgs.map(async (org) => {
        const { data: member } = await supabaseAdmin
          .from('organization_members')
          .select('user_id')
          .eq('organization_id', org.id)
          .eq('role', 'owner')
          .maybeSingle();

        let ownerEmail: string | null = null;
        if (member?.user_id) {
          const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(member.user_id);
          ownerEmail = authUser?.user?.email ?? null;
        }

        return {
          orgId: org.id,
          orgName: org.name,
          ownerEmail,
          optedOutAt: org.email_opt_out_at,
        };
      })
    );

    return NextResponse.json({
      batches: batchesResult.data ?? [],
      optOuts: enrichedOptOuts,
      // One entry per LIVE campaign, built from the registry so a campaign added or retired in
      // lib/marketing-email-defaults.ts cannot leave a stale key behind here.
      // A transactional campaign has no batch audience, so it reports null.
      //
      // ⚠ NOTHING CURRENTLY READS THIS (found by /review 2026-09-07, pre-existing). The dashboard's
      // only use of this endpoint's response applies `batches` and discards the rest; the counts it
      // actually renders are computed server-side in app/platform-admin/email/page.tsx from
      // getMarketingAudienceCounts(), which segments per audience instead of reporting the flat
      // founding-org count below. Deriving it is still right — a dead field that lies is worse than
      // a dead field that does not — but do not treat this as the source of any displayed number,
      // and prefer deleting it to "fixing" it if a cleanup pass reaches here.
      recipientCounts: Object.fromEntries(
        LIVE_MARKETING_CAMPAIGNS.map(c => [c.key, c.isTransactional ? null : foundingCount]),
      ),
      stats: {
        totalFoundingOrgs: foundingCount + optOutCount,
        activeRecipients: foundingCount,
        optedOut: optOutCount,
      },
    });
  } catch (err) {
    console.error('[email/route] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}, { route: '/api/admin/email' });
