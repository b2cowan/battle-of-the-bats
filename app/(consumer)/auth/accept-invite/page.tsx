'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';
import { HudSkeleton } from '@/components/ui/HudSkeleton';
import styles from '../auth.module.css';

type PageState = 'waiting' | 'ready' | 'submitting' | 'expired';

type InviteContext = {
  orgSlug: string | null;
  role: string | null;
  status: string | null;
};

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgSlugParam = searchParams.get('org');

  const [pageState, setPageState] = useState<PageState>('waiting');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [inviteContext, setInviteContext] = useState<InviteContext | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function loadInviteContext() {
      const response = await fetch('/api/auth/accept-invite', { cache: 'no-store' });
      if (!response.ok) return;

      const data = await response.json().catch(() => null) as InviteContext | null;
      if (data) setInviteContext(data);
    }

    // The /auth/callback page handles token exchange (PKCE or implicit flow) and
    // redirects here with a clean URL once the session is in cookies. We rely on
    // INITIAL_SESSION firing with the established session rather than checking for
    // raw tokens in the URL.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        void loadInviteContext();
        setPageState('ready');
      }
    });

    // Fallback: if no session arrives within 5s, the link is expired or invalid.
    const timer = setTimeout(() => {
      setPageState(prev => prev === 'waiting' ? 'expired' : prev);
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setErrorMsg('Enter your first and last name.');
      return;
    }
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
      body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim() }),
    });
    const data = await res.json();

    const slug = data.orgSlug ?? orgSlugParam;
    const role = (data.role as string | null) ?? inviteContext?.role ?? null;

    if (slug) {
      const dest = role === 'official' ? `/${slug}/scorekeeper` : `/${slug}/admin`;
      router.push(dest);
      router.refresh();
    } else {
      // Edge case: org slug unknown — fall back to the middleware-resolved /admin redirect.
      router.push('/admin');
      router.refresh();
    }
  }

  const isScorekeeperInvite = inviteContext?.role === 'official';
  const title = isScorekeeperInvite ? 'Set Up Scorekeeper Access' : 'Accept Invitation';
  const subtitle = isScorekeeperInvite ? 'FieldLogicHQ - Scorekeeper App' : 'FieldLogicHQ - Tournament Management Platform';
  const introCopy = isScorekeeperInvite
    ? 'Create a password to open the scorekeeper workspace for assigned tournament games.'
    : 'Create a password to finish setting up your account.';
  const submitCopy = isScorekeeperInvite ? 'Create Password & Open Scorekeeper' : 'Create Password & Continue';

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
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.sub}>{subtitle}</p>
      </div>

      {pageState === 'waiting' && (
        <p style={{ fontFamily: 'var(--font-data)', fontSize: '0.82rem', color: 'var(--data-gray)', textAlign: 'center' }}>
          Verifying invite link…
        </p>
      )}

      {(pageState === 'ready' || pageState === 'submitting') && (
        <>
          <p style={{ fontFamily: 'var(--font-data)', fontSize: '0.78rem', color: 'var(--data-gray)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
            {introCopy}
          </p>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="accept-first-name">First Name</label>
                <input
                  id="accept-first-name"
                  type="text"
                  className="form-input"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="Jordan"
                  maxLength={60}
                  autoComplete="given-name"
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="accept-last-name">Last Name</label>
                <input
                  id="accept-last-name"
                  type="text"
                  className="form-input"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="Lee"
                  maxLength={60}
                  autoComplete="family-name"
                  required
                />
              </div>
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
              {pageState === 'submitting' ? 'Setting up your account...' : submitCopy}
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
