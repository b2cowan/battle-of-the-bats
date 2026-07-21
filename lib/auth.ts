import { createClient } from './supabase-browser';

const AUTH_TIMEOUT_MS = 15000;

function timeoutError() {
  return new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error('auth_timeout')), AUTH_TIMEOUT_MS);
  });
}

export async function signIn(
  email: string,
  password: string
): Promise<{ error: string | null }> {
  let error: unknown;

  try {
    const supabase = createClient();
    const result = await Promise.race([
      supabase.auth.signInWithPassword({ email, password }),
      timeoutError(),
    ]);
    error = result.error;
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    return { error: message === 'auth_timeout' ? 'auth_timeout' : 'network_error' };
  }

  if (!error) return { error: null };

  const authError = error as { code?: string; message?: string };
  const message = authError.message ?? '';
  const normalized = message.toLowerCase();
  if (authError.code) return { error: authError.code };
  if (normalized.includes('email not confirmed')) return { error: 'email_not_confirmed' };
  if (normalized.includes('invalid login credentials')) return { error: 'invalid_credentials' };
  return { error: message };
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  // Shared-device follow hygiene (clear account-owned follows + restore parked
  // anonymous pins) runs off the SIGNED_OUT auth event in lib/follow.ts, so every
  // sign-out path is covered without this wrapper depending on the follow layer.
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
export function login(): boolean { return false; }

/** @deprecated Use signOut() instead */
export function logout(): void {}

/** @deprecated Auth is enforced by middleware */
export function isAuthenticated(): boolean { return false; }
