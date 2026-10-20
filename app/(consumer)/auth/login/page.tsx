'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signIn, getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase-browser';
import { isDemoOrganizerEmail } from '@/lib/demo-org';
import { forgetSandboxMarkerCookie } from '@/lib/sandbox-exit-rule';
import { safeNextPath } from '@/lib/safe-redirect';
import { SIGN_IN_ERROR_COPY, SIGN_IN_REASON } from '@/lib/auth-errors';
import ResendLink from '@/components/auth/ResendLink';
import { EmailField, PasswordField, StartColumn, StartFoot, StartHead, accountForm } from '@/components/auth/AccountForm';
import LoadingState from '@/components/shared/LoadingState';

/**
 * Resolve the post-login destination. Honors `next` ONLY when it is a same-origin
 * path (safeNextPath — CWE-601, the same hardening signup/callback got in 696bc794)
 * AND the resolver reports the user has real workspace access (`hasWorkspace`) — a
 * recovery/fallback destination (/auth/suspended, or Home for a fan/zero-context
 * account) always wins over a `next` the session can't reach. Shared by the submit
 * handler and the already-authenticated guard so both break the J8-018 / J10-019
 * login loops the same way.
 *
 * `hasWorkspace` replaces the old "destination === '/home'" sentinel: the Unified
 * Home fast-path now returns concrete workspace URLs for solo users, so the
 * next-is-safe signal has to be explicit (see getAuthDestinationDetail).
 */
/**
 * Loop breaker: on the already-authenticated path, refuse to chase the same `next` twice IN
 * QUICK SUCCESSION. A signed-in user bounced here by a layout they cannot reach (e.g. a member
 * of some other org following a link into this one) would otherwise be forwarded back forever,
 * with the form never rendering and no door on screen. `hasWorkspace` cannot catch it: it says
 * "you have A workspace", not "you can reach THIS one".
 *
 * ⚠ The WINDOW is the point, not the marker. A bare "seen this next before" flag survives the
 * successful forward that clears the loop, so the coach who is LATER granted access to the very
 * team they were blocked from would have their first legitimate attempt in that tab silently
 * dropped at Home (/review 2026-08-07). A real loop re-arrives in milliseconds; a genuine return
 * visit is minutes or hours later — so recency, not recurrence, is what distinguishes them.
 */
const NEXT_ONCE_KEY = 'flhq-login-next-consumed';
const NEXT_LOOP_WINDOW_MS = 10_000;
function consumeNextOnce(next: string | null): string | null {
  if (!next) return null;
  try {
    const raw = sessionStorage.getItem(NEXT_ONCE_KEY);
    if (raw) {
      const sep = raw.indexOf('|');
      const at = Number(raw.slice(0, sep));
      // Same destination, moments ago ⇒ we are mid-bounce. Give up and let the caller fall
      // through to the resolved destination. Clearing here also keeps the entry self-expiring.
      if (raw.slice(sep + 1) === next && Number.isFinite(at) && Date.now() - at < NEXT_LOOP_WINDOW_MS) {
        sessionStorage.removeItem(NEXT_ONCE_KEY);
        return null;
      }
    }
    sessionStorage.setItem(NEXT_ONCE_KEY, `${Date.now()}|${next}`);
  } catch { /* storage blocked — behave as before */ }
  return next;
}

async function resolveLoginDestination(next: string | null): Promise<string> {
  let destination = '/discover';
  let hasWorkspace = false;
  try {
    const data = await (await fetch('/api/auth/destination')).json();
    destination = data.destination ?? '/discover';
    hasWorkspace = !!data.hasWorkspace;
  } catch {
    destination = '/discover';
  }
  const safeNext = safeNextPath(next, null);
  return safeNext && hasWorkspace ? safeNext : destination;
}

/** The one loading line while the page checks who is signed in (and while the URL is read). */
const LOADING = <StartColumn><LoadingState label="Loading sign-in…" /></StartColumn>;

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail]       = useState(searchParams.get('email') ?? '');
  const [password, setPassword] = useState('');
  // The failure's code from signIn (the notice is chosen by it; its words come from SIGN_IN_ERROR_COPY).
  const [error, setError]       = useState('');
  // "Email me a new link" with the field empty asks for the address under the field (U7), never an alert.
  const [missingEmail, setMissingEmail] = useState(false);
  // A waiting account (signed up, never opened the email) is told to verify — and, since Account-First Sign-up (owner
  // A7, 2026-10-18), can get the link again right in that box, with every resend's limit. Sign-in only reports a waiting
  // account once the password matched, so this never tells a stranger which addresses have accounts. The account's
  // remembered start door, when it has one, decides where the link lands (step 2) — the resend route reads it — unless
  // this sign-in was opened with a destination of its own.
  const [waitingEmail, setWaitingEmail] = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // J8-018: already-authenticated guard. If a signed-in user lands on /auth/login (e.g. a layout
  // redirected them here with a `next` they can't access), forward them to a safe destination
  // instead of leaving them to re-enter credentials into a loop. Recovery destinations
  // (/auth/suspended, /start) win over an unreachable `next`.
  useEffect(() => {
    let active = true;
    (async () => {
      const user = await getUser();
      if (!active) return;
      if (user) {
        // A "See it live" visit leaves a REAL session for a shared fictional account behind, and
        // following it dropped a visitor back inside the demo instead of showing this form
        // (reported 2026-08-25). An ordinary navigation here no longer reaches this branch: the
        // request layer ends the demo before the page is served (lib/sandbox-exit.ts).
        //
        // ⚠ Kept as defence in depth, not because a specific case is known to need it: this
        // effect runs on MOUNT only (no pageshow listener, unlike lib/use-client-signed-in.ts),
        // so it cannot catch a bfcache Back onto this screen — an earlier draft of this comment
        // claimed it could, and that was wrong. What it does catch is a route the request layer
        // has not run on. Reaching this screen is unambiguous — the visitor is asking to sign in
        // as THEMSELVES, and a sandbox org has no login to forward anyone to.
        //
        // ⚠ scope:'local' is LOAD-BEARING (full reasoning in lib/use-client-signed-in.ts): every
        // demo visitor shares ONE auth user, and supabase-js defaults to scope 'global' — which
        // would end the demo for every other prospect inside it at that moment.
        if (isDemoOrganizerEmail(user.email)) {
          await createClient().auth.signOut({ scope: 'local' });
          forgetSandboxMarkerCookie(); // and the marker the server-side rule keys off

          if (active) setCheckingAuth(false);
          return;
        }
        const dest = await resolveLoginDestination(consumeNextOnce(searchParams.get('next')));
        if (active) router.replace(dest);
        return;
      }
      setCheckingAuth(false);
    })();
    return () => { active = false; };
  }, [router, searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setWaitingEmail(null);
    setLoading(true);
    const { error: err } = await signIn(email, password);
    if (err) {
      setError(err);
      if (err === 'email_not_confirmed') setWaitingEmail(email.trim().toLowerCase());
      setLoading(false);
    } else {
      // J8-018 / J10-019: resolve a safe destination — never blindly push `next` (a URL the
      // session may not be able to access → redirect back to login → loop). See
      // resolveLoginDestination.
      const dest = await resolveLoginDestination(searchParams.get('next'));
      try { sessionStorage.removeItem(NEXT_ONCE_KEY); } catch { /* ignore */ }
      router.push(dest);
      router.refresh();
    }
  }

  const next = searchParams.get('next');
  const reason = searchParams.get('reason');
  const expiredLink = reason === SIGN_IN_REASON.expiredLink;
  // "New here?" keeps where the person was headed (owner, Stage 2b gate): with a destination it opens the plain account
  // sign-up, which returns them there once confirmed; with none, the start page and its doors.
  const safeNext = safeNextPath(next, null);
  const getStartedHref = safeNext ? `/auth/signup?account=1&next=${encodeURIComponent(safeNext)}` : '/start';
  const forgotHref = next ? `/auth/forgot-password?next=${encodeURIComponent(next)}` : '/auth/forgot-password';

  if (checkingAuth) {
    return LOADING;
  }

  return (
    <StartColumn>
      <StartHead title="Sign in" sub="Welcome back." />

      <form onSubmit={handleSubmit} className={accountForm.form}>
        {/* Above the fields: why the person is here. A link that failed (the callback passes the reason, U3 included),
            or the hand-off from a sign-up whose address already has an account (U2). A plain redirect here has no
            reason and no notice. */}
        {expiredLink ? (
          <div className={accountForm.noticeWarn} role="status">
            <strong>That link has expired or was already used.</strong>{' '}
            Sign in, or send yourself a new one.
          </div>
        ) : reason === SIGN_IN_REASON.accountExists && !error && !loading ? (
          <div className={accountForm.notice} role="status">
            <strong>You already have an account with that email.</strong>{' '}
            Sign in below.
          </div>
        ) : null}

        <EmailField
          id="login-email"
          value={email}
          onChange={value => { setEmail(value); if (missingEmail) setMissingEmail(false); }}
          invalid={missingEmail}
          hint={missingEmail && <span className={accountForm.hintError} role="alert">Enter your email address first.</span>}
        />
        <PasswordField id="login-password" purpose="current" value={password} onChange={setPassword} />

        {/* Below the fields: what the sign-in said. A waiting account is amber (nothing went wrong) and its resend
            follows it (D12); the wrong password alone is red (D-F9); anything else is amber, in its own sentence. */}
        {error === 'invalid_credentials' ? (
          <div className={accountForm.noticeError} role="alert">
            <strong>That email and password don’t match.</strong>{' '}
            Try again, or use “Forgot your password?” below.
          </div>
        ) : waitingEmail ? (
          <>
            <div className={accountForm.noticeWarn} role="alert">
              <strong>Confirm your email first.</strong>{' '}
              We sent a link to {waitingEmail} when you signed up.
            </div>
            <ResendLink
              email={waitingEmail}
              next={next ?? undefined}
              classes={{ button: accountForm.secondary, sent: accountForm.sentAgain, error: accountForm.errorText }}
            />
          </>
        ) : error ? (
          <div className={accountForm.noticeWarn} role="alert">{SIGN_IN_ERROR_COPY[error] ?? error}</div>
        ) : null}

        {/* The password matched for a waiting account, so the way back to it is noise there (owner, Stage 2b gate). */}
        {!waitingEmail && (
          <div className={accountForm.forgotRow}>
            <Link href={forgotHref} className={accountForm.footLink}>Forgot your password?</Link>
          </div>
        )}

        <button type="submit" className={accountForm.primary} disabled={loading} id="login-submit">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        {/* U7: a fresh link for the address typed above, the same resend as "Send the link again", worded with "if"
            because the server answers the same for every address (a used link is a confirmed account: nothing comes). */}
        {expiredLink && !waitingEmail && (
          <ResendLink
            // A different address is a different send: changing the field clears "Check your email." and any refusal,
            // so a mistyped address can be fixed at once (the server's per-address limit still holds).
            key={email.trim().toLowerCase()}
            email={email.trim().toLowerCase()}
            next={next ?? undefined}
            label="Email me a new link"
            onMissingEmail={() => setMissingEmail(true)}
            sentNotice={<><strong>Check your email.</strong>{' '}If that address is waiting to be confirmed, a new link is on its way. Check your spam folder too.</>}
            classes={{ button: accountForm.secondary, sent: accountForm.noticeSent, error: accountForm.errorText }}
          />
        )}
      </form>

      <StartFoot>
        <p>
          New here?{' '}
          <Link href={getStartedHref} className={accountForm.footLink}>Get started</Link>
        </p>
      </StartFoot>
    </StartColumn>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={LOADING}>
      <LoginForm />
    </Suspense>
  );
}
