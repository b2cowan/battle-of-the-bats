'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { safeNextPath } from '@/lib/safe-redirect';
import { expiredLinkSignInHref } from '@/lib/auth-errors';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const supabase = createClient();

    // Open-redirect guard: after a real auth step on our own origin, a raw `next` from the URL
    // could bounce the user to an external phishing target — as an absolute URL, protocol-relative
    // (//evil.com), backslash-smuggled (/\evil.com), or control-char-smuggled (/<tab>//evil.com,
    // which URL parsers strip into //evil.com). safeNextPath resolves the value with real URL
    // semantics and only allows a same-origin relative path.
    const next = safeNextPath(searchParams.get('next'), '/');

    async function handle() {
      // PKCE flow: Supabase redirects with ?code=... (standard OAuth/invite flow)
      const code = searchParams.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          router.replace(next);
          return;
        }
      }

      // Implicit flow: admin-generated magic links redirect with #access_token=...
      // Hash fragments are never sent to the server, so this must be handled client-side.
      const hash = window.location.hash.slice(1);
      if (hash) {
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (!error) {
            router.replace(next);
            return;
          }
        }
      }

      // Nothing above signed the person in, so the link itself could not be used: expired, already used (Supabase puts
      // `error_code=otp_expired` in the hash or the query), a code that will not exchange, or no code at all. Sign-in
      // says so and offers a new one (The first look 2b, F09). The one fall-through that is NOT a broken link is a
      // person who backed out of a sign-in (`error=access_denied` with no code); that keeps the plain sign-in. Where
      // the link was headed rides along, so a new link from there returns to the same place.
      const failure = new URLSearchParams(hash);
      const errorCode = failure.get('error_code') ?? searchParams.get('error_code');
      const errorName = failure.get('error') ?? searchParams.get('error');
      if (errorName === 'access_denied' && !errorCode) {
        router.replace('/auth/login');
        return;
      }
      const headed = safeNextPath(searchParams.get('next'), null);
      // An organization invitation's link goes to its own page, whose expired screen knows the person was invited and
      // has no password yet ("Set a password"; owner, 2b review). Sign-in's "send yourself a new one" would send a
      // confirmation email instead, or nothing. The path is lib/invite-links.ts acceptInvitePath's (server-only there).
      if (headed && headed.split('?')[0] === '/auth/accept-invite') {
        router.replace(headed);
        return;
      }
      router.replace(expiredLinkSignInHref(headed));
    }

    handle();
  }, [router, searchParams]);

  return null;
}

export default function AuthCallbackPage() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: 'sans-serif',
      /* --text-tertiary = --white-40 = rgba(255,255,255,0.4) under dark (value-identical),
         and the auth surface remaps it to legible dim ink under warm — the raw literal
         rendered ~invisible white-on-paper there. */
      color: 'var(--text-tertiary)',
    }}>
      <Suspense fallback={null}>
        <CallbackHandler />
      </Suspense>
      <p>Completing sign in…</p>
    </div>
  );
}
