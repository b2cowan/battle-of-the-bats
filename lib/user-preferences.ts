import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { captureError } from './observability/capture';
import { isUserTheme, type UserTheme } from './user-theme';

/**
 * lib/user-preferences.ts — the ACCOUNT source of truth for per-user UI preferences
 * (Theme Toggle Foundation, TH-1/TH-3). One row per user in `user_preferences`, keyed on
 * user_id alone (identity-scoped, never per-org). Service-role only (RLS-walled, zero
 * policies — same posture as lib/fan-alert-prefs.ts) so always via supabaseAdmin.
 *
 * Absent row / NULL theme = default (each shell's current default), so a non-chooser is
 * unaffected everywhere. Only ever returns / stores 'dark' | 'warm' | null.
 */

/** The account's stored theme, or null when no row / no explicit choice (= default). */
export async function getUserTheme(userId: string): Promise<UserTheme | null> {
  const { data, error } = await supabaseAdmin
    .from('user_preferences')
    .select('theme')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return isUserTheme(data?.theme) ? data.theme : null;
}

/**
 * Upsert the account theme. Passing null clears the choice back to default (row kept, theme
 * NULL — a deliberate reset, distinct from never-chosen but semantically identical). Carries
 * only the theme column + updated_at, so concurrent single-field saves can't clobber each other.
 */
export async function setUserTheme(userId: string, theme: UserTheme | null): Promise<UserTheme | null> {
  const { error } = await supabaseAdmin
    .from('user_preferences')
    .upsert(
      { user_id: userId, theme, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
  if (error) throw error;
  return theme;
}

// ── Coach onboarding preferences (Quiet Mode Phase C2, migration 209) ─────────
/**
 * The two Premium coach-portal onboarding preferences, account-scoped so they follow the coach
 * across every team they hold AND every device they sign in on. Phase A shipped both device-local;
 * the tour one could never stay that way — "skip ends it permanently" is unmeetable when a new
 * device re-offers it.
 *
 * Per-team setup-step SKIPS are NOT here: those are facts about a season, not preferences about a
 * coach, and they stay device-local per the plan.
 */
export interface CoachOnboardingPrefs {
  /** Coach finished or skipped the portal tour ⇒ never offer it again (still reachable on demand). */
  tourDismissed: boolean;
  /** Coach turned off season-setup guidance (the chip's count + the next-action line). */
  hintsOff: boolean;
}

/**
 * Read both preferences. Fails toward SHOWING guidance — the Phase A review fixed exactly this bug
 * device-side (a storage exception defaulted to "already seen", permanently suppressing the tour for
 * anyone in a locked-down browser), so the account path must not reintroduce it. A missing row, a
 * missing column (migration not yet applied to this environment), or a query error all yield the
 * new-coach defaults rather than silently withholding help.
 */
export async function getCoachOnboardingPrefs(userId: string): Promise<CoachOnboardingPrefs> {
  const fallback: CoachOnboardingPrefs = { tourDismissed: false, hintsOff: false };
  // Failing open must not also mean failing SILENT. Because this never throws and its callers
  // always return 200, neither instrumentation's onRequestError net nor withObservability's
  // returned-5xx net ever sees a fault here — so a genuine ongoing problem (broken grants,
  // connection failures, not just the anticipated "migration 209 not applied in this env") would
  // present only as "everyone keeps being offered the tour", with nothing to alert on.
  // captureError (NOT bare console.error) is what reaches the error_groups store and the alert
  // pipeline; it is fire-and-forget and never throws, so it is safe on this path.
  const degrade = (reason: unknown): CoachOnboardingPrefs => {
    void captureError(reason, {
      severity: 'warning',
      route: 'lib/user-preferences.getCoachOnboardingPrefs',
    });
    return fallback;
  };
  try {
    const { data, error } = await supabaseAdmin
      .from('user_preferences')
      .select('coach_tour_dismissed_at, coach_setup_hints_off')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) return degrade(error);
    return {
      tourDismissed: data?.coach_tour_dismissed_at != null,
      hintsOff: data?.coach_setup_hints_off === true,
    };
  } catch (e) {
    // supabase-js resolves {data,error} rather than throwing, so this is belt-and-braces for a
    // client/transport fault — cheap insurance on a path that must never propagate.
    return degrade(e);
  }
}

/**
 * Write either preference. Each field is sent ONLY when the caller asked for it, so the two
 * controls (which live in different places in the UI) can't clobber one another on a concurrent
 * save — same single-field-upsert discipline as `setUserTheme` above.
 *
 * `tourDismissed: false` clears the timestamp, which is what "offer the tour again" would mean;
 * nothing surfaces that today, but storing a timestamp rather than a bool keeps it possible.
 */
export async function setCoachOnboardingPrefs(
  userId: string,
  patch: { tourDismissed?: boolean; hintsOff?: boolean },
): Promise<void> {
  const row: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() };
  if (patch.tourDismissed !== undefined) {
    row.coach_tour_dismissed_at = patch.tourDismissed ? new Date().toISOString() : null;
  }
  if (patch.hintsOff !== undefined) row.coach_setup_hints_off = patch.hintsOff;

  const { error } = await supabaseAdmin
    .from('user_preferences')
    .upsert(row, { onConflict: 'user_id' });
  if (error) throw error;
}
