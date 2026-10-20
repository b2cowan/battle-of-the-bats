'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';
import LoadingState from '@/components/shared/LoadingState';
import { AccountFields, StartColumn, StartFoot, StartHead, accountForm, type AccountValues } from '@/components/auth/AccountForm';

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
  const setField: Record<keyof AccountValues, (value: string) => void> = {
    firstName: setFirstName, lastName: setLastName, email: () => {}, password: setPassword,
  };

  if (pageState === 'expired') {
    return (
      <StartColumn>
        <StartHead title="This invitation link has expired" sub={orgName ?? undefined} />
        <div className={accountForm.form}>
          <p className={accountForm.body}>
            {orgName
              ? `Your invitation from ${orgName} is still waiting. Set a password and it will be on your home page.`
              : 'Your invitation is still waiting. Set a password and it will be on your home page.'}
          </p>
          <Link href="/auth/forgot-password" className={accountForm.primary}>Set a password</Link>
        </div>
        <StartFoot>
          <p>
            I have a password ·{' '}
            <Link href="/auth/login" className={accountForm.footLink}>Sign in</Link>
          </p>
        </StartFoot>
      </StartColumn>
    );
  }

  // One account step (The first look, Stage 1c, 2026-10-19): the heading names the club and the role, the inviter is the
  // one sub line, and the fields are the shared ones without the email the invitation already knows (plan rule 4).
  return (
    <StartColumn>
      <StartHead
        title={title}
        sub={inviter ? `${inviter} invited you. Set a password to finish.` : 'Set a password to finish.'}
      />

      <div className={accountForm.form}>
        {invite?.roleOpens && <p className={accountForm.body}>{invite.roleOpens}</p>}

        {pageState === 'waiting' && <LoadingState label="Loading your invitation…" inline />}

        {(pageState === 'joinFailed' || pageState === 'retrying') && (
          <div className={accountForm.error} role="alert">
            <strong>Your password is saved. We couldn’t add you to {clubWord} just now.</strong>
            <br />
            Try again. If it keeps failing, sign in and accept from your home page.
          </div>
        )}
        {(pageState === 'joinFailed' || pageState === 'retrying') && (
          <button type="button" className={accountForm.secondary} onClick={retryJoin} disabled={pageState === 'retrying'}>
            {pageState === 'retrying' ? 'Trying…' : 'Try again'}
          </button>
        )}

        {pageState === 'joinRefused' && (
          <div className={accountForm.error} role="alert">
            <strong>Your password is saved, but you can’t join {clubWord} in this role.</strong>
            {errorMsg && <><br />{errorMsg}</>}
          </div>
        )}
        {pageState === 'joinRefused' && (
          <Link href="/discover" className={accountForm.secondary}>Go to your home page</Link>
        )}

        {(pageState === 'ready' || pageState === 'submitting') && (
          <form onSubmit={handleSubmit} className={accountForm.form}>
            <AccountFields
              idPrefix="accept"
              values={{ firstName, lastName, email: '', password }}
              onChange={(field, value) => setField[field](value)}
              email={false}
              autoFocus="firstName"
            />

            {errorMsg && <p className={accountForm.error} role="alert">{errorMsg}</p>}

            <button type="submit" className={accountForm.primary} disabled={pageState === 'submitting'}>
              {pageState === 'submitting' ? 'Joining…' : 'Create account and join'}
            </button>
          </form>
        )}
      </div>
    </StartColumn>
  );
}
