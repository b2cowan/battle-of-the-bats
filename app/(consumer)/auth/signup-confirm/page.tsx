'use client';
import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { expiredLinkSignInHref } from '@/lib/auth-errors';
import { StartColumn, StartFoot, StartHead, accountForm } from '@/components/auth/AccountForm';
import LoadingState from '@/components/shared/LoadingState';

// Every sign-up's email lands here, so the page follows only a link to our own Supabase project's verify step —
// never an address the link parameter was crafted to carry (a `javascript:` URL would run on this origin; any other
// site would turn a trusted page into a bounce). Verify every sign-up review, 2026-10-16.
function verifyLink(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const project = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');
    return url.protocol === project.protocol && url.host === project.host ? url.href : null;
  } catch {
    return null;
  }
}

/** The one loading line while the URL is read, and while a broken link is on its way to sign-in. */
const LOADING = <StartColumn><LoadingState label="Loading confirmation…" /></StartColumn>;

/**
 * THE CONTINUE PAGE (The first look 2c, F11): the confirmation email's button opens this one tap, which stays so a mail
 * scanner that opens links cannot spend the one-time link before the person does.
 */
function SignupConfirmInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const link = verifyLink(searchParams.get('link'));

  // U3: a broken or missing link has no screen of its own. It opens sign-in with the expired-link notice and "Email me a
  // new link", the one place a failed link is answered. This link carries no destination of its own to keep.
  useEffect(() => {
    if (!link) router.replace(expiredLinkSignInHref(null));
  }, [link, router]);

  if (!link) return LOADING;

  return (
    <StartColumn>
      <StartHead title="Confirm your email" sub="One tap and you’re back to finish setting up." />
      <div className={accountForm.form}>
        <button
          type="button"
          className={accountForm.primary}
          onClick={() => { window.location.href = link; }}
        >
          Confirm my email
        </button>
      </div>
      <StartFoot>
        <p>
          Already confirmed?{' '}
          <Link href="/auth/login" className={accountForm.footLink}>Sign in</Link>
        </p>
      </StartFoot>
    </StartColumn>
  );
}

export default function SignupConfirmPage() {
  return (
    <Suspense fallback={LOADING}>
      <SignupConfirmInner />
    </Suspense>
  );
}
