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
import { FOUNDING_SEASON_END } from '@/lib/plan-config';
import { withObservability } from '@/lib/observability';

// ── Founding season audience query ────────────────────────────────────────────
// Orgs with a founding-season comp_period override (expires_at = Jan 1 2027)
// that have NOT opted out of marketing emails.


async function getFoundingSeasonRecipientCount(): Promise<number> {
  // Step 1: get founding season org IDs
  const { data: overrides, error: ovErr } = await supabaseAdmin
    .from('org_overrides')
    .select('org_id')
    .eq('type', 'comp_period')
    .eq('expires_at', FOUNDING_SEASON_END);

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
      recipientCounts: {
        // All batch-type founding season emails share this audience
        founding_welcome: null, // transactional — no batch audience
        founding_checkin: foundingCount,
        founding_renewal: foundingCount,
        founding_final: foundingCount,
        spotlight_club: foundingCount,
        spotlight_league: foundingCount,
        spotlight_coaches_org: foundingCount,
        spotlight_coaches_coach: foundingCount, // TODO: count coach accounts separately
        spotlight_club_last: foundingCount, // TODO: filter out Club-plan orgs
        spotlight_full_picture: foundingCount,
      },
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
