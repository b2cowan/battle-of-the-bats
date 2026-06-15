'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const supabase = createClient();

    // Open-redirect guard: only navigate to internal, absolute-path destinations. A raw
    // `next` from the URL could be an external URL (https://evil.com), protocol-relative
    // (//evil.com), or a `\`-smuggled target (/\evil.com, /./\evil.com — some URL parsers
    // normalize these to //) — after a real auth step on our own origin, that's a
    // convincing phishing bounce. Require a leading "/" whose next char is NEITHER "/" nor
    // "\": one check that blocks every protocol-relative / backslash variant, and stays
    // safe even if the navigation primitive ever changes from router.replace to location.*.
    const rawNext = searchParams.get('next') ?? '/';
    const next = /^\/(?![/\\])/.test(rawNext) ? rawNext : '/';

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

      router.replace('/auth/login');
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
      color: 'rgba(255,255,255,0.4)',
    }}>
      <Suspense fallback={null}>
        <CallbackHandler />
      </Suspense>
      <p>Completing sign in…</p>
    </div>
  );
}
