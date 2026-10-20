'use client';
import { useState, useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { RESET_RETURN_KEY, readResetReturn } from '@/lib/consumer-routes';
import { expiredResetLinkHref } from '@/lib/auth-errors';
import { PasswordField, StartColumn, StartHead, accountForm } from '@/components/auth/AccountForm';
import LoadingState from '@/components/shared/LoadingState';

// A fifth state, 'error', was declared and never set; a save the provider refuses is the ready form with its notice
// (The first look 2c).
type PageState = 'waiting' | 'ready' | 'expired' | 'success';

/** The one loading line while the link is read, and while a link that cannot be used is on its way to the forgot screen. */
const LOADING = <StartColumn><LoadingState label="Loading password reset…" /></StartColumn>;

/** The provider's codes for a reset whose session is gone: the link has to be asked for again, like an expired one. */
const SESSION_GONE = new Set(['session_not_found', 'session_expired', 'bad_jwt', 'refresh_token_not_found', 'refresh_token_already_used']);

/**
 * A save the provider refused, in plain words with the way forward (owner at the 2c gate: the drawings leave these out,
 * and 2b's rule for undrawn failures stands — amber, one sentence). Never the provider's own English.
 */
function saveFailure(code: string | undefined): ReactNode {
  switch (code) {
    case 'same_password':
      return <><strong>That’s your current password.</strong>{' '}Choose a different one.</>;
    case 'weak_password':
      return <><strong>That password is too easy to guess.</strong>{' '}Try a longer one, or mix in numbers and symbols.</>;
    case 'over_request_rate_limit':
      return <><strong>Too many tries.</strong>{' '}Wait a moment and try again.</>;
    default:
      return <><strong>We couldn’t save your password.</strong>{' '}Check your connection and try again.</>;
  }
}

/** CHOOSE A NEW PASSWORD (The first look 2c, U4 screens 5–6). */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>('waiting');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<ReactNode>(null);

  useEffect(() => {
    const supabase = createClient();

    // Keep listening for PKCE-based PASSWORD_RECOVERY in case it fires via exchangeCodeForSession.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setPageState('ready');
    });

    const code = new URLSearchParams(window.location.search).get('code');
    // @supabase/ssr forces flowType:'pkce' on createBrowserClient, so hash-based tokens
    // (from admin.generateLink implicit flow) are never auto-processed. Parse manually.
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const hashError = hash.get('error');
    const accessToken = hash.get('access_token');
    const refreshToken = hash.get('refresh_token');

    if (hashError) {
      // Supabase auth server returned an error (token already used, truly expired, etc.)
      setPageState('expired');
    } else if (code) {
      // PKCE flow — exchange code; PASSWORD_RECOVERY fires via onAuthStateChange above.
      supabase.auth.exchangeCodeForSession(code).then(async ({ error }) => {
        if (!error) return;
        // The client may already have exchanged this code itself (and spent its verifier), so a failure here is not
        // proof the link is dead. "Expired" now leaves the page (2c), where it used to heal on PASSWORD_RECOVERY: ask
        // for the session before giving up on it (/review 2026-10-20).
        const { data } = await supabase.auth.getSession();
        setPageState(data.session ? 'ready' : 'expired');
      });
    } else if (accessToken && refreshToken) {
      // Implicit/admin flow — set session manually since the PKCE client won't process the hash.
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error }) => {
          setPageState(error ? 'expired' : 'ready');
          // Clean up the hash so the token isn't replayed on refresh.
          if (!error) window.history.replaceState(null, '', window.location.pathname);
        });
    } else {
      // No token — direct navigation or stripped URL.
      setPageState('expired');
    }

    return () => subscription.unsubscribe();
  }, []);

  // U4: a link that cannot be used has no screen of its own — the forgot screen with the expired-link notice. A reset
  // started from a registration keeps it: the note moves into the forgot screen's address, which the new link carries
  // and its tap page notes again, so it is cleared here (a stale note must not ride a later, unrelated reset).
  useEffect(() => {
    if (pageState !== 'expired') return;
    let returnTo: string | null = null;
    try {
      returnTo = readResetReturn(sessionStorage.getItem(RESET_RETURN_KEY));
      sessionStorage.removeItem(RESET_RETURN_KEY);
    } catch { /* storage blocked */ }
    router.replace(expiredResetLinkHref(returnTo));
  }, [pageState, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setFailure(<><strong>That password is too short.</strong>{' '}Use at least 8 characters.</>);
      return;
    }
    setLoading(true);
    setFailure(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      if (error.name === 'AuthSessionMissingError' || SESSION_GONE.has(error.code ?? '')) {
        setPageState('expired');
        return;
      }
      setFailure(saveFailure(error.code));
      setLoading(false);
    } else {
      setPageState('success');
      // Determine the role-aware destination before redirecting. Platform admins keep
      // their dedicated check; everyone else goes through the same resolver login uses
      // (/api/auth/destination), which knows every context kind — including org-less
      // basic coaches, whom the old /api/auth/me + '/admin' fallback 404'd.
      let dest = '/discover';
      // A reset started from a registration form goes back to it, signed in (Register Your Existing
      // Team, Stage 1, 2026-10-13) — the confirm page noted it in this tab. Re-checked on read, and
      // read once: a later, unrelated reset in this tab lands as it always has.
      let returnTo: string | null = null;
      try {
        returnTo = readResetReturn(sessionStorage.getItem(RESET_RETURN_KEY));
        sessionStorage.removeItem(RESET_RETURN_KEY);
      } catch { /* storage blocked — land as usual */ }
      try {
        const paRes = await fetch('/api/platform-admin/me');
        if (paRes.ok) {
          dest = '/platform-admin';
        } else if (returnTo) {
          dest = returnTo;
        } else {
          const res = await fetch('/api/auth/destination?flow=password_reset');
          if (res.ok) {
            const { destination } = await res.json();
            if (destination) dest = destination;
          }
        }
      } catch {
        // Non-fatal — fall back to Home
      }
      setTimeout(() => { router.push(dest); router.refresh(); }, 1500);
    }
  }

  if (pageState === 'success') {
    return (
      <StartColumn>
        <div role="status">
          <StartHead title="Password saved" sub="Taking you to your account…" />
        </div>
      </StartColumn>
    );
  }

  if (pageState !== 'ready') return LOADING;

  return (
    <StartColumn>
      <StartHead title="Choose a new password" />
      <form onSubmit={handleSubmit} className={accountForm.form}>
        <PasswordField id="reset-password" label="New password" value={password} onChange={setPassword} autoFocus />

        {failure && <div className={accountForm.noticeWarn} role="alert">{failure}</div>}

        <button type="submit" className={accountForm.primary} disabled={loading}>
          {loading ? 'Saving…' : 'Save password'}
        </button>
      </form>
    </StartColumn>
  );
}
