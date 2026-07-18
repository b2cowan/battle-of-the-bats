'use client';
/**
 * components/public/FollowAccountNudge.tsx
 *
 * Unified-app Phase 2 — the "account moment." After an anonymous fan follows a team, this
 * offers (never forces) a free account so their follows travel across devices. The follow
 * itself already completed in localStorage before this appears (saveFollowedTeam), so this
 * is a non-blocking upsell, not a gate. "Just follow on this device" keeps the anonymous
 * path. Self-gating + layout-mounted, cloning the AlertsNudge pattern; only shows to
 * signed-OUT visitors who just followed and haven't dismissed it recently.
 */
import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { readFollowedTeam, syncFollowToAccount, type FollowedTeam } from '@/lib/follow';
import { getSession, signIn } from '@/lib/auth';
import BottomSheet from '@/components/admin/BottomSheet';
import styles from './FollowAccountNudge.module.css';

interface Props {
  orgSlug: string;
  tournamentSlug: string;
}

const DISMISS_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — offer again occasionally, don't nag
const FALLBACK_RETURN = '/following';

// Scoped per tournament (mirrors AlertsNudge's nudgeKey) — dismissing the offer for
// one tournament must not silently suppress it for every other tournament on this
// device (was a single global key; fixed 2026-07-17).
function dismissKey(orgSlug: string, tournamentSlug: string): string {
  return `fl_follow_account_nudge_dismissed_${orgSlug}_${tournamentSlug}`;
}

// Land back on the page the fan was watching (their intent), not a different tab
// (conversion sweep S4). The sign-in link already honors `next`; this keeps the
// signup path on the same rule. Client-only by construction — the sheet never
// renders during SSR, so window is always available here.
function returnPath(): string {
  try {
    return window.location.pathname + window.location.search;
  } catch {
    return FALLBACK_RETURN;
  }
}

export default function FollowAccountNudge({ orgSlug, tournamentSlug }: Props) {
  const [team, setTeam] = useState<FollowedTeam | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [stage, setStage] = useState<'form' | 'check-email'>('form');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let pendingShow: number | undefined;
    const evaluate = async () => {
      let dismissed = false;
      try {
        const raw = localStorage.getItem(dismissKey(orgSlug, tournamentSlug));
        dismissed = !!raw && Date.now() - parseInt(raw, 10) < DISMISS_MS;
      } catch { /* ignore */ }
      if (dismissed) return;
      const followed = readFollowedTeam(orgSlug, tournamentSlug);
      if (!followed) return;
      // Only offer an account to signed-OUT visitors. Checked LAZILY here (only after a follow
      // fires), so a normal tournament-page view costs no auth call at all — a cheap client
      // cookie-session read, not a server round trip on every render.
      try {
        const session = await getSession();
        if (session?.user) return; // already signed in — their follow syncs automatically
      } catch { /* treat as signed out; the follow already saved locally regardless */ }
      // Let the follow LAND first — the sheet on the same tap read as an instant
      // signup wall (conversion sweep C1). A beat later, the ask feels like a
      // follow-up, not a toll. Timer is cleared if the visitor navigates away;
      // a rapid second follow replaces (never stacks) the pending timer.
      window.clearTimeout(pendingShow);
      pendingShow = window.setTimeout(() => {
        setTeam(followed);
        setOpen(true);
      }, 1600);
    };
    // Only react to a NEW follow, not on mount (avoid popping for someone who followed
    // long ago and returns) — so we listen for the change event, not the initial state.
    window.addEventListener('fl-follow-change', evaluate);
    window.addEventListener('storage', evaluate);
    return () => {
      window.clearTimeout(pendingShow);
      window.removeEventListener('fl-follow-change', evaluate);
      window.removeEventListener('storage', evaluate);
    };
  }, [orgSlug, tournamentSlug]);

  // Just hides the sheet — backdrop tap, Escape, and the post-signup "Done" button
  // all go through here. None of those are the visitor saying "no thanks", so none
  // of them should suppress the offer for 30 days (2026-07-17).
  function close() {
    setOpen(false);
  }

  // The explicit decline — "Just follow on this device" — is the only action that
  // suppresses the offer.
  function dismiss() {
    try { localStorage.setItem(dismissKey(orgSlug, tournamentSlug), String(Date.now())); } catch { /* ignore */ }
    setOpen(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Synchronous re-entrancy guard — the button's disabled={busy} only takes
    // effect after a re-render, so a fast double-Enter could double-POST without it.
    if (busy) return;
    setError(null);
    if (password.length < 8) { setError('Use a password of at least 8 characters.'); return; }
    setBusy(true);
    try {
      const parts = name.trim().split(/\s+/).filter(Boolean);
      const firstName = parts[0] || 'Fan';
      const lastName = parts.slice(1).join(' ') || firstName;
      const next = returnPath();
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // orgName OMITTED → account-only (no org, no role). next → the page they were on.
        body: JSON.stringify({ email: email.trim(), password, firstName, lastName, next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? 'Could not create your account. Please try again.'); return; }
      if (data.requiresEmailVerification) { setStage('check-email'); return; }
      // Dev / no-verification: the account exists but the browser has no session yet — sign in,
      // then land back where they were following along.
      try { await signIn(email.trim(), password); } catch { /* fall through to redirect anyway */ }
      // The nudge promised "keep this follow" — attach the team that triggered it to the
      // fresh account (conversion sweep C2; THIS entry point only, the general claim flow
      // stays explicit). The shared mirror is keepalive'd, so it survives the redirect
      // below; anonymous no-op if sign-in fell through.
      if (team) syncFollowToAccount('follow', { teamId: team.id, orgSlug, tournamentSlug });
      window.location.href = data.next || next;
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!open || !team) return null;

  const loginHref = `/auth/login?next=${encodeURIComponent(returnPath())}`;

  return (
    <BottomSheet open={open} onClose={close} ariaLabel="Create an account to follow across devices">
      {stage === 'check-email' ? (
        <div className={styles.done}>
          <p className={styles.doneTitle}>Check your email</p>
          <p className={styles.doneText}>
            We sent a confirmation link to <strong>{email}</strong>. Open it to finish creating your
            account — your followed teams will be waiting.
          </p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={close}>Done</button>
        </div>
      ) : (
        <>
          <div className={styles.head}>
            <span className={styles.icon}><Star size={18} /></span>
            <div>
              <p className={styles.title}>Following {team.name}</p>
              <p className={styles.sub}>
                Create a free account to get <strong>score alerts</strong> — a push when your teams&rsquo;
                games go live — and keep your follows on every device.
              </p>
            </div>
          </div>

          <form className={styles.form} onSubmit={submit}>
            <label className={styles.field}>
              <span className={styles.label}>Your name</span>
              <input className={styles.input} value={name} onChange={e => setName(e.target.value)}
                autoComplete="name" required />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Email</span>
              <input className={styles.input} type="email" value={email} onChange={e => setEmail(e.target.value)}
                autoComplete="email" required />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Password</span>
              <input className={styles.input} type="password" value={password} onChange={e => setPassword(e.target.value)}
                autoComplete="new-password" minLength={8} required />
            </label>

            {error && <p className={styles.error} role="alert">{error}</p>}

            <button type="submit" className="btn btn-lime" disabled={busy}>
              {busy ? 'Creating…' : 'Create free account'}
            </button>
            <div className={styles.or}>or</div>
            <button type="button" className="btn btn-ghost" onClick={dismiss}>
              Just follow on this device
            </button>
            <p className={styles.fine}>
              No role questions. Browsing never needs an account.{' '}
              Already have one? <a href={loginHref} className={styles.link}>Sign in</a>.
            </p>
          </form>
        </>
      )}
    </BottomSheet>
  );
}
