'use client';
import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { RESET_RETURN_KEY, registrationReturnPath, signInHrefFor, stampResetReturn } from '@/lib/consumer-routes';
import { expiredResetLinkHref } from '@/lib/auth-errors';
import { StartColumn, StartFoot, StartHead, accountForm } from '@/components/auth/AccountForm';
import LoadingState from '@/components/shared/LoadingState';

/**
 * The emailed `link` is followed only when it is the auth provider's own verify link — same origin as
 * the project's Supabase URL, over https (http only for a local project). This page navigates to it on
 * a branded "Reset my password" button, so an unchecked value let a crafted URL run `javascript:` on our
 * origin or send a coach to a look-alike page (/review 2026-10-14; the check was missing since the page
 * was written). Anything else reads as an invalid link.
 */
function authActionLink(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const provider = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.origin !== provider.origin) return null;
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** The one loading line while the URL is read, and while a broken link is on its way to the forgot screen. */
const LOADING = <StartColumn><LoadingState label="Loading password reset…" /></StartColumn>;

/** THE RESET TAP PAGE (The first look 2c, U4 screen 4): the Continue page again, for the reset email. */
function ResetConfirmInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const link = authActionLink(searchParams.get('link'));
  // A reset started from a registration form returns there (Register Your Existing Team, Stage 1).
  const returnTo = registrationReturnPath(searchParams.get('next'));

  // U4: a broken link has no screen of its own — the forgot screen with the expired-link notice, keeping the registration.
  useEffect(() => {
    if (!link) router.replace(expiredResetLinkHref(returnTo));
  }, [link, returnTo, router]);

  if (!link) return LOADING;

  return (
    <StartColumn>
      <StartHead title="Reset your password" sub="One tap and you can choose a new password." />
      <div className={accountForm.form}>
        {/* onClick-only navigation — no href — prevents email scanners from pre-consuming the one-time Supabase token */}
        <button
          type="button"
          className={accountForm.primary}
          onClick={() => {
            // Noted in THIS tab before the hop: the auth provider sends the browser back to the
            // set-a-new-password page in the same tab, which reads it after the reset.
            try {
              if (returnTo) sessionStorage.setItem(RESET_RETURN_KEY, stampResetReturn(returnTo));
              else sessionStorage.removeItem(RESET_RETURN_KEY);
            } catch { /* storage blocked — the reset still works, it lands as it always has */ }
            window.location.href = link;
          }}
        >
          Reset my password
        </button>
      </div>
      <StartFoot>
        <p>
          <Link href={signInHrefFor(returnTo ?? '')} className={accountForm.footLink}>Back to sign in</Link>
        </p>
      </StartFoot>
    </StartColumn>
  );
}

export default function ResetConfirmPage() {
  return (
    <Suspense fallback={LOADING}>
      <ResetConfirmInner />
    </Suspense>
  );
}
