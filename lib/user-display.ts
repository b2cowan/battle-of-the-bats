import type { User } from '@supabase/supabase-js';

/**
 * lib/user-display.ts — one place to turn a Supabase user into presentable
 * name/initials. Signup flows write different metadata shapes (account-only
 * signup sets first_name/last_name; some older flows set full_name/display_name),
 * so derivation must try all of them before falling back to the email.
 * NB: app/api/coaches/teams + basic-teams routes and app/coaches/start each
 * carry an older inline copy of the name derivation — converge them here when touched.
 */

function metaString(user: User, key: string): string {
  const value = user.user_metadata?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

export function getUserDisplayName(user: User): string {
  const full = metaString(user, 'full_name') || metaString(user, 'display_name');
  if (full) return full;
  const parts = [metaString(user, 'first_name'), metaString(user, 'last_name')].filter(Boolean);
  return parts.join(' ') || user.email || '';
}

export function getUserInitials(user: User): string {
  const first = metaString(user, 'first_name');
  const last = metaString(user, 'last_name');
  if (first || last) return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  const full = metaString(user, 'full_name') || metaString(user, 'display_name');
  if (full) {
    const words = full.split(/\s+/).filter(Boolean);
    return words.slice(0, 2).map(w => w.charAt(0)).join('').toUpperCase();
  }
  return (user.email ?? '').slice(0, 2).toUpperCase();
}
