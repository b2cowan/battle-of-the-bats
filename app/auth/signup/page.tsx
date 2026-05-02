'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Eye, EyeOff, Sparkles } from 'lucide-react';
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

    // Sign in now that the account exists
    const { error: signInErr } = await signIn(email, password);
    if (signInErr) {
      setError(signInErr);
      setLoading(false);
      return;
    }

    router.push('/admin');
    router.refresh();
  }

  return (
    <div className={styles.page}>
      <div className={styles.bg}>
        <div className={styles.orb1} />
        <div className={styles.orb2} />
      </div>

      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.iconWrap}><Building2 size={28} /></div>
          <h1 className={styles.title}>Create Account</h1>
          <p className={styles.sub}>Set up your organization and first tournament</p>
        </div>

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
            <p style={{ fontSize: '0.75rem', color: 'var(--white-40)', marginTop: '0.35rem' }}>
              Your public URL: <span style={{ color: 'var(--purple-light)' }}>/{previewSlug}</span>
            </p>
          </div>

          <div className={styles.divider}>account details</div>

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
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={loading}
            id="signup-submit"
          >
            {loading ? 'Creating account…' : <><Sparkles size={16} /> Create Organization</>}
          </button>

          <p style={{ fontSize: '0.75rem', color: 'var(--white-40)', textAlign: 'center' }}>
            Starts on the free Starter plan. No credit card required.
          </p>
        </form>

        <div className={styles.footer}>
          <p className={styles.footerText}>
            Already have an account?{' '}
            <Link href="/auth/login" className={styles.footerLink}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
