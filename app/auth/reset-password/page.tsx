'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';
import styles from '../auth.module.css';

type PageState = 'waiting' | 'ready' | 'expired' | 'success' | 'error';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>('waiting');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPageState('ready');
      }
    });

    // PKCE flow: Supabase sends ?code=XXX in the URL. Exchange it so PASSWORD_RECOVERY fires.
    const code = new URLSearchParams(window.location.search).get('code');
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) setPageState('expired');
        // On success, onAuthStateChange fires PASSWORD_RECOVERY above.
      });
    } else {
      // Implicit flow: Supabase detects the hash fragment automatically.
      // If no PASSWORD_RECOVERY fires within 3 s, the token is missing or expired.
      timer = setTimeout(() => {
        setPageState(prev => prev === 'waiting' ? 'expired' : prev);
      }, 3000);
    }

    return () => {
      subscription.unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
    } else {
      setPageState('success');
      // Determine the role-aware destination before redirecting.
      let dest = '/admin';
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const { orgSlug, role } = await res.json();
          if (orgSlug) {
            dest = role === 'official' ? `/${orgSlug}/official` : `/${orgSlug}/admin`;
          }
        }
      } catch {
        // Non-fatal — fall back to generic /admin
      }
      setTimeout(() => { router.push(dest); router.refresh(); }, 1500);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.iconWrap}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h1 className={styles.title}>Set New Password</h1>
          <p className={styles.sub}>FieldLogicHQ — Tournament Management Platform</p>
        </div>

        {pageState === 'waiting' && (
          <p style={{ fontFamily: 'var(--font-data)', fontSize: '0.82rem', color: 'var(--data-gray)', textAlign: 'center' }}>
            Verifying reset link…
          </p>
        )}

        {pageState === 'expired' && (
          <>
            <p style={{ fontFamily: 'var(--font-data)', fontSize: '0.82rem', color: '#f87171', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              This link has expired or is invalid. Request a new one below.
            </p>
            <div className={styles.footer}>
              <p className={styles.footerText}>
                <Link href="/auth/forgot-password" className={styles.footerLink}>Request a new reset link</Link>
              </p>
            </div>
          </>
        )}

        {pageState === 'ready' && (
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className="form-group">
              <label className="form-label" htmlFor="reset-password">New Password</label>
              <div className={styles.pwWrap}>
                <input
                  id="reset-password"
                  type={showPw ? 'text' : 'password'}
                  className="form-input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  autoFocus
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
              disabled={loading}
            >
              {loading ? 'Saving…' : 'Set New Password'}
            </button>
          </form>
        )}

        {pageState === 'success' && (
          <p style={{ fontFamily: 'var(--font-data)', fontSize: '0.82rem', color: 'var(--logic-lime)', textAlign: 'center', lineHeight: 1.6 }}>
            Password updated. Redirecting…
          </p>
        )}
      </div>
    </div>
  );
}
