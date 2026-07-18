'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Trophy } from 'lucide-react';
import authStyles from '../../(consumer)/auth/auth.module.css';

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Add-another-tournament-org form for a signed-in user. No email/password — the user
 * is already authenticated; this only creates the org + owner membership via
 * /api/org/create (separating workspace creation from auth).
 */
export default function AddOrgForm() {
  const router = useRouter();
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Public URL is auto-generated server-side from the org name (preview only).
  const previewSlug = slugify(orgName) || 'your-org';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgName.trim()) {
      setError('Enter an organization name.');
      return;
    }

    setError('');
    setLoading(true);
    const res = await fetch('/api/org/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgName: orgName.trim() }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? 'Something went wrong. Please try again.');
      setLoading(false);
      return;
    }

    router.push(`/${json.orgSlug}/admin/onboarding?choosePlan=1`);
    router.refresh();
  }

  return (
    <div className={authStyles.page}>
      <div className={authStyles.card}>
        <div className={authStyles.header}>
          <div className={authStyles.iconWrap}>
            <Trophy size={20} strokeWidth={1.6} aria-hidden />
          </div>
          <h1 className={authStyles.title}>New Tournament Organization</h1>
          <p className={authStyles.sub}>Add another free workspace to your account</p>
        </div>

        <form onSubmit={handleSubmit} className={authStyles.form}>
          <div className="form-group">
            <label className="form-label" htmlFor="start-org">Organization Name</label>
            <input
              id="start-org"
              type="text"
              className="form-input"
              value={orgName}
              onChange={e => setOrgName(e.target.value)}
              placeholder="e.g. Milton Softball Association"
              required
              autoComplete="organization"
            />
            <p style={{ fontFamily: 'var(--font-data)', fontSize: '0.65rem', letterSpacing: '0.06em', color: 'var(--data-gray)', marginTop: '0.35rem' }}>
              Your public address: <span style={{ color: 'var(--logic-lime)' }}>fieldlogichq.ca/{previewSlug}</span> — you can change this later.
            </p>
          </div>

          {error && <div className={authStyles.error}>{error}</div>}

          <button type="submit" className={authStyles.submitBtn} disabled={loading}>
            {loading ? 'Creating…' : 'Create Organization'}
          </button>

          <p style={{ fontFamily: 'var(--font-data)', fontSize: '0.65rem', letterSpacing: '0.06em', color: 'var(--data-gray)', textAlign: 'center' }}>
            Starts on the free Tournament plan. No credit card required.
          </p>
        </form>

        <div className={authStyles.footer}>
          <p className={authStyles.footerText}>
            <Link href="/discover" className={authStyles.footerLink}>← Back to your workspaces</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
