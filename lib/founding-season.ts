import { FOUNDING_SEASON_END } from './plan-config';
import { supabaseAdmin } from './supabase-admin';

/**
 * Ensures an org has a Founding Season `comp_period` override expiring at FOUNDING_SEASON_END.
 * This is the row the founding-season status + January-cohort/marketing-audience queries MATCH on
 * (see the operational caveat at FOUNDING_SEASON_END in plan-config.ts), so both the org checkout
 * comp path and the Premium Coaches Portal comp path must write it identically. Idempotent: a second
 * call with an existing non-revoked row at the same expiry is a no-op.
 *
 * `reason` is free text (the cohort queries key on type + expires_at, not this string), so the org
 * and team paths can carry their own human-readable reason.
 */
export async function ensureFoundingSeasonCompPeriod(
  orgId: string,
  createdBy: string | null | undefined,
  reason = 'Founding Season - Tournament Plus free through December 31, 2026',
): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('org_overrides')
    .select('id')
    .eq('org_id', orgId)
    .eq('type', 'comp_period')
    .eq('expires_at', FOUNDING_SEASON_END)
    .is('revoked_at', null)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (data) return;

  const { error: insertError } = await supabaseAdmin
    .from('org_overrides')
    .insert({
      org_id: orgId,
      type: 'comp_period',
      value: null,
      expires_at: FOUNDING_SEASON_END,
      reason,
      created_by: createdBy ?? 'system',
    });

  if (insertError) throw insertError;
}
