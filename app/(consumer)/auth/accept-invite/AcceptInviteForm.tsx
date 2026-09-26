'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';
import styles from '../auth.module.css';

type PageState = 'waiting' | 'ready' | 'submitting' | 'joinFailed' | 'retrying' | 'joinRefused' | 'expired';
type JoinOutcome = 'joined' | 'failed' | 'refused';

type InviteContext = {
  orgSlug: string | null;
  orgName: string | null;
  role: string | null;
  roleLabel: string | null;
  roleOpens: string | null;
  inviterName: string | null;
  status: string | null;
};

/**
 * Specimen 6, "from the email link": who is asking, what the role opens, and an honest failure.
 *
 *  · The first frame comes from the link (club name resolved by the page, role + inviter carried
 *    in the link — J10-010); the server's answer replaces it once the session lands.
 *  · Setting the password and joining are TWO steps, and the page reads both answers (A13). When
 *    the password is saved but the join fails, it says exactly that and retries ONLY the join —
 *    it never asks for a new password (J10-007) and never moves on as if it had worked.
 *  · Success lands where the role starts, through the server's destination resolver (J10-011).
 *  · An expired LINK is not an expired INVITATION (J10-008): the membership still waits, so
 *    "Set a password" goes through the existing reset flow and the home-page card takes over.
 */
export default function AcceptInviteForm({
  linkOrgSlug,
  linkOrgName,
  linkRoleLabel,
  linkInviter,
}: {
  linkOrgSlug: string | null;
  linkOrgName: string | null;
  linkRoleLabel: string | null;
  linkInviter: string | null;
}) {
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>('waiting');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [invite, setInvite] = useState<InviteContext | null>(null);

  const orgName = invite?.orgName ?? linkOrgName;
  const roleName = invite?.roleLabel ?? linkRoleLabel;
  const inviter = invite?.inviterName ?? linkInviter;
  const orgSlug = invite?.orgSlug ?? linkOrgSlug;

  useEffect(() => {
    const supabase = createClient();

    async function loadInvite() {
      const qs = linkOrgSlug ? `?org=${encodeURIComponent(linkOrgSlug)}` : '';
      const response = await fetch(`/api/auth/accept-invite${qs}`, { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json().catch(() => null) as InviteContext | null;
      if (data) setInvite(data);
    }

    // The /auth/callback page exchanges the link's token (PKCE or implicit flow) and lands here
    // with the session already in cookies; INITIAL_SESSION fires with it.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        void loadInvite();
        // A session that lands after the 5s wait (a slow network) still wins over "expired".
        setPageState(prev => (prev === 'waiting' || prev === 'expired' ? 'ready' : prev));
      }
    });

    // No session within 5s: the link is expired or was already used.
    const timer = setTimeout(() => {
      setPageState(prev => (prev === 'waiting' ? 'expired' : prev));
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [linkOrgSlug]);

  /** Step 2 on its own — the join. Called after the password is set, and again by "Try again". */
  const join = useCallback(async (): Promise<JoinOutcome> => {
    try {
      const res = await fetch('/api/auth/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), orgSlug }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(typeof data?.error === 'string' ? data.error : '');
        // A policy refusal (a scorekeeper keeps one home organization) will not change on a retry;
        // anything else is worth one.
        return data?.code === 'one_home_org' ? 'refused' : 'failed';
      }
      const destination: string = data.destination
        ?? (data.orgSlug ? `/${data.orgSlug}/admin` : '/discover');
      router.push(destination);
      router.refresh();
      return 'joined';
    } catch {
      setErrorMsg('');
      return 'failed';
    }
  }, [firstName, lastName, orgSlug, router]);

  function settle(outcome: JoinOutcome) {
    if (outcome === 'failed') setPageState('joinFailed');
    if (outcome === 'refused') setPageState('joinRefused');
  }

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

    settle(await join());
  }

  async function retryJoin() {
    setPageState('retrying');
    settle(await join());
  }

  const clubWord = orgName ?? 'the club';
  const title = roleName ? `Join ${clubWord} as ${roleName}` : `Join ${clubWord}`;

  if (pageState === 'expired') {
    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.iconWrap} aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
          </div>
          <h1 className={styles.title}>This invitation link has expired</h1>
          {orgName && <p className={styles.sub}>{orgName}</p>}
        </div>
        <p className={styles.inviteBody} style={{ marginBottom: '1.25rem' }}>
          {orgName
            ? `Your invitation from ${orgName} is still waiting. Set a password and it will be on your home page.`
            : 'Your invitation is still waiting. Set a password and it will be on your home page.'}
        </p>
        <Link href="/auth/forgot-password" className={styles.submitBtn} style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
          Set a password
        </Link>
        <div className={styles.footer}>
          <p className={styles.footerText}>
            I have a password ·{' '}
            <Link href="/auth/login" className={styles.footerLink}>Sign in</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.iconWrap} aria-hidden>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        {orgName && <p className={styles.sub} style={{ marginBottom: '0.4rem' }}>{orgName}</p>}
        <h1 className={styles.title}>{title}</h1>
      </div>

      <p className={styles.inviteBody} style={{ marginBottom: invite?.roleOpens ? '0.5rem' : '1.25rem' }}>
        {inviter ? `${inviter} invited you. Set a password to finish.` : 'Set a password to finish.'}
      </p>
      {invite?.roleOpens && (
        <p className={styles.inviteBody} style={{ marginBottom: '1.25rem' }}>{invite.roleOpens}</p>
      )}

      {pageState === 'waiting' && (
        <p className={styles.inviteBody} style={{ textAlign: 'center' }}>Checking your invitation…</p>
      )}

      {(pageState === 'joinFailed' || pageState === 'retrying') && (
        <div className={styles.confirmBox} role="alert">
          <strong style={{ color: 'var(--fl-text)' }}>
            Your password is saved. We couldn’t add you to {clubWord} just now.
          </strong>
          <span>Try again. If it keeps failing, sign in and accept from your home page.</span>
          <div className={styles.confirmActions}>
            <button type="button" className={styles.btnGhost} onClick={retryJoin} disabled={pageState === 'retrying'}>
              {pageState === 'retrying' ? 'Trying…' : 'Try again'}
            </button>
          </div>
        </div>
      )}

      {pageState === 'joinRefused' && (
        <div className={styles.confirmBox} role="alert">
          <strong style={{ color: 'var(--fl-text)' }}>Your password is saved, but you can’t join {clubWord} in this role.</strong>
          {errorMsg && <span>{errorMsg}</span>}
          <Link href="/discover" className={styles.footerLink}>Go to your home page</Link>
        </div>
      )}

      {(pageState === 'ready' || pageState === 'submitting') && (
        <form onSubmit={handleSubmit} className={styles.form}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="accept-first-name">First name <span aria-hidden>*</span></label>
              <input
                id="accept-first-name"
                type="text"
                className="form-input"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                maxLength={60}
                autoComplete="given-name"
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="accept-last-name">Last name <span aria-hidden>*</span></label>
              <input
                id="accept-last-name"
                type="text"
                className="form-input"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                maxLength={60}
                autoComplete="family-name"
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="accept-password">Password <span aria-hidden>*</span></label>
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
              <button
                type="button"
                className={styles.pwToggle}
                onClick={() => setShowPw(s => !s)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {errorMsg && <div className={styles.error}>{errorMsg}</div>}

          <button type="submit" className={styles.submitBtn} disabled={pageState === 'submitting'}>
            {pageState === 'submitting' ? 'Joining…' : 'Create password and join'}
          </button>
        </form>
      )}
    </div>
  );
}
