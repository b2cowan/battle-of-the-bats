import {
  FOUNDING_SEASON_END,
  FOUNDING_SEASON_END_LABEL,
  FOUNDING_SEASON_COMP_EXPIRIES,
  isFoundingSeasonCurrentExpiry,
} from './plan-config';
import { isClubPlan } from './module-entitlements';
import { supabaseAdmin } from './supabase-admin';

/**
 * ⚖ D6 (owner, 2026-09-25): NO Founding Season offer for Club. The Founding comp is written at every
 * signup (every new org starts on the free tier, which may claim it) — so it is PLAN-SCOPED on the
 * read side: an org on a Club band is never "in the Founding Season", whatever rows it carries, and
 * an operator's move to Club revokes the rows (`revokeFoundingSeasonComp`). Before this a Club moved
 * there by an operator kept the comp: its billing page said "Club is free through September 30,
 * 2027" beside a $219 price, hid "Reduce or cancel", and offered a 2028 chooser the API refused (A08).
 */
export function foundingCompAppliesToPlan(planId: string | null | undefined): boolean {
  return !isClubPlan(planId);
}

/**
 * Revokes every live Founding Season comp row an org holds (current or legacy instant). Returns how
 * many were revoked. Idempotent — a second call finds nothing live. The audience and desk queries
 * all filter `revoked_at IS NULL`, so a revoked org leaves every Founding surface at once.
 */
export async function revokeFoundingSeasonComp(orgId: string, revokedBy: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('org_overrides')
    .update({ revoked_at: new Date().toISOString(), revoked_by: revokedBy })
    .eq('org_id', orgId)
    .eq('type', 'comp_period')
    .in('expires_at', [...FOUNDING_SEASON_COMP_EXPIRIES])
    .is('revoked_at', null)
    .select('id');
  if (error) throw error;
  return data?.length ?? 0;
}

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
  reason = `Founding Season - Tournament Plus free through ${FOUNDING_SEASON_END_LABEL}`,
): Promise<void> {
  // Tolerant of the legacy instant (see FOUNDING_SEASON_COMP_EXPIRIES): a row written before the
  // 2026-09-07 date move is the SAME comp, so it is recognised rather than duplicated — and healed
  // to the current instant in passing, so the exact-match audience queries see it even if the
  // bulk backfill (migration 279) has not reached this row yet.
  const { data, error } = await supabaseAdmin
    .from('org_overrides')
    .select('id, expires_at')
    .eq('org_id', orgId)
    .eq('type', 'comp_period')
    .in('expires_at', [...FOUNDING_SEASON_COMP_EXPIRIES])
    .is('revoked_at', null)
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (data) {
    if (!isFoundingSeasonCurrentExpiry(data.expires_at as string)) {
      const { error: healError } = await supabaseAdmin
        .from('org_overrides')
        .update({ expires_at: FOUNDING_SEASON_END })
        .eq('id', data.id);
      if (healError) throw healError;
    }
    return;
  }

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
