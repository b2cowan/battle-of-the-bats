import {
  FOUNDING_SEASON_END,
  FOUNDING_SEASON_END_LABEL,
  FOUNDING_SEASON_COMP_EXPIRIES,
  isFoundingSeasonActive,
  isFoundingSeasonCurrentExpiry,
  isFoundingSeasonOpenFor,
  isFoundingSeasonSignupOpen,
} from './plan-config';
import { isClubPlan } from './module-entitlements';
import { hasSavedSetupWork } from './first-run-plan';
import { supabaseAdmin } from './supabase-admin';

/**
 * THE LOCKED START DOOR (edge (a), ratified by the owner 2026-10-19). A start sign-up whose creation can carry the
 * offer — Run a tournament (organization), Start a league (league), Coach Premium (premium) — saves its door a second
 * time, on the auth user's `app_metadata`, which only the service role can write. The remembered door on
 * `user_metadata.start` (lib/start-door.ts) steers screens and its owner can edit it; this copy is the one the offer
 * reads after the sign-up window closes. Cleared with the remembered door when the creation it names is made.
 */
const OFFER_DOORS = ['organization', 'league', 'premium'] as const;
export type OfferDoor = (typeof OFFER_DOORS)[number];
export const START_DOOR_LOCK_KEY = 'start_door';

/** The locked door on an auth user's `app_metadata`, or none. */
export function lockedStartDoorOf(appMetadata: unknown): OfferDoor | null {
  const value = (appMetadata as Record<string, unknown> | null | undefined)?.[START_DOOR_LOCK_KEY];
  return typeof value === 'string' && (OFFER_DOORS as readonly string[]).includes(value) ? value as OfferDoor : null;
}

/**
 * Lock a new account's door at sign-up, from every sign-up route that makes a start door's account. A door that carries
 * no offer (a free team) locks nothing. When the write fails the account is deleted and this answers `false`: an
 * account must not be left without the offer it signed up for, so the sign-up fails and can simply be tried again.
 */
export async function lockStartDoorOrUndo(userId: string, door: string | null): Promise<boolean> {
  if (!door || !(OFFER_DOORS as readonly string[]).includes(door)) return true;
  let failure: unknown = null;
  try {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { app_metadata: { [START_DOOR_LOCK_KEY]: door } });
    failure = error;
  } catch (err) {
    failure = err;
  }
  if (!failure) return true;
  console.error('[founding-season] start door lock failed; undoing the account:', failure);
  try {
    const { error: undoError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (undoError) console.error('[founding-season] undo after a failed door lock:', undoError);
  } catch (err) {
    console.error('[founding-season] undo after a failed door lock:', err);
  }
  return false;
}

/**
 * May this creation get the Founding Season comp? The rule is `isFoundingSeasonOpenFor` (lib/plan-config.ts); this
 * reads its two server facts off the signed-in auth user. Every creation path that grants the comp asks here, and so
 * does every screen that shows the offer (signed out is the window alone), so the price shown is the price charged.
 */
export function foundingSeasonOfferFor(user: { created_at?: string | null; app_metadata?: unknown } | null, creates: OfferDoor): boolean {
  return isFoundingSeasonOpenFor(user?.created_at, lockedStartDoorOf(user?.app_metadata) === creates);
}

/**
 * THE PLAN STEP AFTER THE CLOSE (owner 2026-10-19). While the window is open, a free organization picks Tournament
 * Plus at no charge, as before. After it closes, an organization that holds the Founding comp (given when it was made,
 * by the rule above) still does — but only while its plan is still the FIRST-RUN choice (lib/first-run-plan.ts: no
 * tournament, no saved setup work, onboarding not finished). Once setup has started, a free organization that upgrades
 * pays the list price, as "the free season is yours if you upgrade by December 31" has always said.
 *
 * ⚠ Read from server facts only. The plan task the plan step marks complete is written by the browser and wiped by every
 * first-run plan change (the free-plan route, an abandoned checkout), so keying on it let an owner reopen the $0 choice
 * by starting a checkout and walking away (/review 2026-10-19). Read by the checkout (which applies it) and the plan
 * step's cards (which show $0). Fails closed: a read error is the list price.
 */
export async function foundingSeasonOfferOnPlanChoice(org: { id: string; planId?: string | null; ownPlanId?: string | null }): Promise<boolean> {
  // The plan the club HOLDS (Support console Stage 4): free Club time must not switch a billing offer off.
  if (!foundingCompAppliesToPlan(org.ownPlanId ?? org.planId)) return false;
  if (isFoundingSeasonSignupOpen()) return true;
  if (!isFoundingSeasonActive()) return false;
  const [comp, tournaments, row] = await Promise.all([
    liveFoundingCompRow(org.id),
    supabaseAdmin
      .from('tournaments')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', org.id)
      .neq('status', 'archived'),
    supabaseAdmin.from('organizations').select('startup_tasks, onboarding_completed_at').eq('id', org.id).maybeSingle(),
  ]);
  if (comp.error || tournaments.error || row.error || !row.data) return false;
  return !!comp.data
    && (tournaments.count ?? 0) === 0
    && !row.data.onboarding_completed_at
    && !hasSavedSetupWork(row.data.startup_tasks);
}

/** An org's live Founding Season comp row (current or legacy instant, not revoked), or none: what "holds the comp" reads. */
function liveFoundingCompRow(orgId: string) {
  return supabaseAdmin
    .from('org_overrides')
    .select('id')
    .eq('org_id', orgId)
    .eq('type', 'comp_period')
    .in('expires_at', [...FOUNDING_SEASON_COMP_EXPIRIES])
    .is('revoked_at', null)
    .limit(1)
    .maybeSingle();
}

/**
 * THE PREMIUM WELCOME'S DATES (The first look G1, 2026-10-20). The welcome says "Free through September 30, 2027…"
 * only when the coach's workspace HOLDS the comp, read from its record: never the sign-up window (a coach who qualifies
 * after the close holds the comp all the same), never a URL flag, and never for a paid coach. Fails closed: a read
 * error is no dates sentence, because a date the page could not read must not be promised.
 */
export async function workspaceHoldsFoundingComp(workspaceOrgId: string): Promise<boolean> {
  if (!isFoundingSeasonActive()) return false;
  const { data, error } = await liveFoundingCompRow(workspaceOrgId);
  return !error && !!data;
}

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
