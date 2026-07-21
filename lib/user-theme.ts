/**
 * lib/user-theme.ts — the user-selectable app theme (Theme Toggle Foundation, TH-1/TH-3).
 *
 * Client-safe shared vocabulary for the Dark⇄Warm consumer switcher. NO server-only imports,
 * so both server components (type-only) and client components can import it. All window/document
 * access is call-time guarded.
 *
 * The theme drives a SINGLE attribute — `data-user-theme` on <html> — never the org/tournament
 * `data-color-mode` authority (M2 precedence: org brand always wins on branded surfaces). Absent
 * attribute = each shell's default (consumer shell warm, coaches portal dark), so a non-chooser
 * sees exactly today's surfaces. Only an explicit `dark`/`warm` is ever stored or set.
 */

export type UserTheme = 'dark' | 'warm';

/** localStorage fast-path key (the no-flash script reads this before first paint). */
export const THEME_STORAGE_KEY = 'fl_user_theme';
/** The <html> attribute CSS keys off. */
export const THEME_ATTR = 'data-user-theme';
/** Fired on window whenever the active theme changes, so listeners (e.g. the theme-color meta) react. */
export const THEME_CHANGE_EVENT = 'fl:user-theme-change';

/** OS status-bar / address-bar tint per theme, for the dynamic `theme-color` meta on consumer routes. */
export const THEME_COLORS: Record<UserTheme, string> = {
  dark: '#0a0a0f', // platform near-black (matches the root default + dark shell)
  warm: '#f8f4ed', // warm paper ground (--home-paper)
};

export function isUserTheme(value: unknown): value is UserTheme {
  return value === 'dark' || value === 'warm';
}

/** The device fast-path value, or null when unset / unavailable. */
export function readStoredTheme(): UserTheme | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isUserTheme(v) ? v : null;
  } catch {
    return null; // private mode / blocked storage
  }
}

/** The theme currently applied to <html> (null = default/unset). */
export function getActiveTheme(): UserTheme | null {
  if (typeof document === 'undefined') return null;
  const v = document.documentElement.getAttribute(THEME_ATTR);
  return isUserTheme(v) ? v : null;
}

/** The theme in effect on this device: the applied <html> attribute, else the stored device pref. */
export function getEffectiveTheme(): UserTheme | null {
  return getActiveTheme() ?? readStoredTheme();
}

/**
 * Apply a theme to the document: set (or clear) the <html> attribute, persist to the device
 * fast-path, and notify listeners. Passing `null` clears the preference back to default.
 * Persistence to the ACCOUNT (source of truth) is a separate API call — this is the local layer.
 */
export function applyTheme(theme: UserTheme | null): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme) root.setAttribute(THEME_ATTR, theme);
  else root.removeAttribute(THEME_ATTR);

  try {
    if (theme) window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    else window.localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    /* ignore — the attribute still applies for this session */
  }
  try {
    window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: theme }));
  } catch {
    /* older browsers without CustomEvent constructor — non-fatal */
  }
}
