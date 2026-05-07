'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';
import { HudSkeleton } from '@/components/ui/HudSkeleton';
import styles from '../auth.module.css';

type PageState = 'waiting' | 'ready' | 'submitting' | 'expired';

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgSlugParam = searchParams.get('org');

  const [pageState, setPageState] = useState<PageState>('waiting');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // If there's no invite code in the URL at all, show expired immediately.
    // PKCE puts the code in query params; implicit flow puts token in the hash.
    const hasCode = searchParams.has('code');
    const hasHashToken = typeof window !== 'undefined' && window.location.hash.includes('access_token');

    if (!hasCode && !hasHashToken) {
      setPageState('expired');
      return;
    }

    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        setPageState('ready');
      }
    });

    // Fallback timeout — if the token exchange stalls or the token is invalid,
    // surface the expired state rather than leaving the user on a blank screen.
    const timer = setTimeout(() => {
      setPageState(prev => prev === 'waiting' ? 'expired' : prev);
    }, 6000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters.');
      return;
    }
    setPageState('submitting');
    setErrorMsg('');

    const supabase = createClient();
    const { error: pwError } = await supabase.auth.updateUser({ password });
    if (pwError) {
      setErrorMsg(pwError.message);
      setPageState('ready');
      return;
    }

    // Mark accepted_at and get the org/role for the final redirect.
    const res = await fetch('/api/auth/accept-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: displayName.trim() || null }),
    });
    const data = await res.json();

    const slug = data.orgSlug ?? orgSlugParam;
    const role = data.role as string | null;

    if (slug) {
      const dest = role === 'official' ? `/${slug}/official` : `/${slug}/admin`;
      router.push(dest);
      router.refresh();
    } else {
      // Edge case: org slug unknown — fall back to the middleware-resolved /admin redirect.
      router.push('/admin');
      router.refresh();
    }
  }

  if (pageState === 'expired') {
    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.iconWrap}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
          </div>
          <h1 className={styles.title}>Invite Link Expired</h1>
          <p className={styles.sub}>FieldLogicHQ — Tournament Management Platform</p>
        </div>
        <p style={{ fontFamily: 'var(--font-data)', fontSize: '0.82rem', color: 'var(--fl-text)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
          This invite link is no longer valid. Ask your organization admin to resend the invitation.
        </p>
        <div className={styles.footer}>
          <p className={styles.footerText}>
            Already have an account?{' '}
            <Link href="/auth/login" className={styles.footerLink}>Sign in</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.iconWrap}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <h1 className={styles.title}>Accept Invitation</h1>
        <p className={styles.sub}>FieldLogicHQ — Tournament Management Platform</p>
      </div>

      {pageState === 'waiting' && (
        <p style={{ fontFamily: 'var(--font-data)', fontSize: '0.82rem', color: 'var(--data-gray)', textAlign: 'center' }}>
          Verifying invite link…
        </p>
      )}

      {(pageState === 'ready' || pageState === 'submitting') && (
        <>
          <p style={{ fontFamily: 'var(--font-data)', fontSize: '0.78rem', color: 'var(--data-gray)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
            Create a password to finish setting up your account.
          </p>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className="form-group">
              <label className="form-label" htmlFor="accept-name">Your Name <span style={{ fontWeight: 400, color: 'var(--data-gray)', fontSize: '0.75em' }}>(optional)</span></label>
              <input
                id="accept-name"
                type="text"
                className="form-input"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="e.g. Alex Smith"
                maxLength={60}
                autoComplete="name"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="accept-password">Password</label>
              <div className={styles.pwWrap}>
                <input
                  id="accept-password"
                  type={showPw ? 'text' : 'password'}
                  className="form-input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
                <button type="button" className={styles.pwToggle} onClick={() => setShowPw(s => !s)}>
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {errorMsg && <div className={styles.error}>{errorMsg}</div>}

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={pageState === 'submitting'}
            >
              {pageState === 'submitting' ? 'Setting up your account…' : 'Create Password & Continue'}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <div className={styles.page}>
      <Suspense fallback={
        <div className={styles.card}>
          <HudSkeleton message="VERIFYING INVITE…" rows={2} />
        </div>
      }>
        <AcceptInviteForm />
      </Suspense>
    </div>
  );
}
