/**
 * @supabase/ssr names its session cookies `sb-<project-ref>-auth-token`, chunked as `.0`, `.1`, … when large. Stated
 * ONCE here and reused wherever a session cookie is recognised — a second hand-written copy of this match is how one
 * of them ends up clearing three cookies out of four.
 */
export function isSupabaseAuthCookieName(name: string): boolean {
  return name.startsWith('sb-') && name.includes('-auth-token');
}
