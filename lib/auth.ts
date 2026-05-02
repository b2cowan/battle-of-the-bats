import { createClient } from './supabase-browser';

export async function signIn(
  email: string,
  password: string
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error: error?.message ?? null };
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}

export async function getUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getSession() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// ── Legacy stubs — kept so any remaining callers compile during the transition ─
// Auth is now handled by middleware + Supabase session cookies.

/** @deprecated Use signIn() instead */
export function login(_u: string, _p: string): boolean { return false; }

/** @deprecated Use signOut() instead */
export function logout(): void {}

/** @deprecated Auth is enforced by middleware */
export function isAuthenticated(): boolean { return false; }
