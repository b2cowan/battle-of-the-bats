'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { signIn } from '@/lib/auth';
import styles from '../auth.module.css';

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function SignupPage() {
  const router = useRouter();
  const [orgName, setOrgName]   = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');

  const previewSlug = slugify(orgName) || 'your-org';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setError('');
    setLoading(true);

    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, orgName }),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? 'Something went wrong. Please try again.');
      setLoading(false);
      return;
    }

    if (json.requiresEmailVerification) {
      setVerificationEmail(json.email ?? email);
      setLoading(false);
      return;
    }

    const { error: signInErr } = await signIn(email, password);
    if (signInErr) {
      setError(signInErr);
      setLoading(false);
      return;
    }

    const dest = json.orgSlug ? `/${json.orgSlug}/admin/onboarding?choosePlan=1` : '/admin';
    router.push(dest);
    router.refresh();
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.iconWrap}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 21h18M9 21V7l3-3 3 3v14M9 12h6" />
            </svg>
          </div>
          <h1 className={styles.title}>Create Your Organization</h1>
          <p className={styles.sub}>FieldLogicHQ — Sports Organization Management</p>
        </div>

        {verificationEmail ? (
          <>
            <p style={{ fontFamily: 'var(--font-data)', fontSize: '0.82rem', color: 'var(--fl-text)', lineHeight: 1.65, marginBottom: '1rem' }}>
              Your organization has been created. For security, verify your email before choosing a plan and opening onboarding.
            </p>
            <div className={styles.error} style={{ color: 'var(--logic-lime)', borderColor: 'rgba(163,230,53,0.28)', background: 'rgba(163,230,53,0.08)' }}>
              Verification email sent to {verificationEmail}.
            </div>
            <p style={{ fontFamily: 'var(--font-data)', fontSize: '0.72rem', color: 'var(--data-gray)', lineHeight: 1.6, marginTop: '1rem' }}>
              After you confirm, FieldLogicHQ will bring you back to start on the free Tournament plan or choose an upgrade.
            </p>
            <div className={styles.footer}>
              <p className={styles.footerText}>
                Already verified?{' '}
                <Link href="/auth/login" className={styles.footerLink}>Sign in</Link>
              </p>
            </div>
          </>
        ) : (
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className="form-group">
            <label className="form-label" htmlFor="signup-org">Organization Name</label>
            <input
              id="signup-org"
              type="text"
              className="form-input"
              value={orgName}
              onChange={e => setOrgName(e.target.value)}
              placeholder="e.g. Milton Softball Association"
              required
              autoComplete="organization"
            />
            <p style={{ fontFamily: 'var(--font-data)', fontSize: '0.65rem', letterSpacing: '0.06em', color: 'var(--data-gray)', marginTop: '0.35rem' }}>
              Public URL: <span style={{ color: 'var(--logic-lime)' }}>/{previewSlug}</span>
            </p>
          </div>

          <div className={styles.divider}>account credentials</div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
              type="email"
              className="form-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-password">Password</label>
            <div className={styles.pwWrap}>
              <input
                id="signup-password"
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

          {error && <div className={styles.error}>{error}</div>}

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading}
            id="signup-submit"
          >
            {loading ? 'Creating…' : 'Create Organization'}
          </button>

          <p style={{ fontFamily: 'var(--font-data)', fontSize: '0.65rem', letterSpacing: '0.06em', color: 'var(--data-gray)', textAlign: 'center' }}>
            Start on the free Tournament plan. No credit card required.
          </p>
        </form>
        )}

        {!verificationEmail && (
        <div className={styles.footer}>
          <p className={styles.footerText}>
            Already have an account?{' '}
            <Link href="/auth/login" className={styles.footerLink}>Sign in</Link>
          </p>
        </div>
        )}
      </div>
    </div>
  );
}
