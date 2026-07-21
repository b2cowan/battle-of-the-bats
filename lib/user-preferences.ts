import 'server-only';
import { supabaseAdmin } from './supabase-admin';
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
