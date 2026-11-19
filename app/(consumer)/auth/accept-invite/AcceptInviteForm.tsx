'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';
import LoadingState from '@/components/shared/LoadingState';
import TermsTickRow, { useTermsTick } from '@/components/legal/TermsTickRow';
import { AccountFields, StartColumn, StartFoot, StartHead, accountForm, type AccountValues } from '@/components/auth/AccountForm';

type PageState = 'waiting' | 'ready' | 'submitting' | 'joinFailed' | 'retrying' | 'joinRefused' | 'joinLapsed' | 'joinChoose' | 'expired';
/** `terms`: the join refused the Terms box (step 6.3) — back to the form, with the line, to tick it again.
 *  `lapsed`: the invitation ran out (30 days from its last send, P2c) — no retry helps; the club has to send it again. */
type JoinOutcome = 'joined' | 'failed' | 'refused' | 'terms' | 'lapsed' | 'choose';

type InviteContext = {
  orgSlug: string | null;
  orgName: string | null;
  role: string | null;
  roleLabel: string | null;
  roleOpens: string | null;
  inviterName: string | null;
  status: string | null;
  /** Set (with `code: 'choose_club'`) when no club was named and more than one invitation is waiting (leftover call 12). */
  clubs?: InviteClub[];
};
type InviteClub = { slug: string; name: string };

/**
 * Specimen 6, "from the email link": who is asking, what the role opens, and an honest failure.
 *
 *  · The first frame comes from the link (club name resolved by the page, role + inviter carried
 *    in the link — J10-010); the server's answer replaces it once the session lands.
 *  · Setting the password and joining are TWO steps, and the page reads both answers (A13). When
 *    the password is saved but the join fails, it says exactly that and retries ONLY the join —
 *    it never asks for a new password (J10-007) and never moves on as if it had worked.
 *  · Success lands where the role starts, through the server's destination resolver (J10-011).
 *  · An expired LINK is not an expired INVITATION (J10-008): the membership still waits (for 30 days from its last send,
 *    P2c; after that the page says it has run out), so
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
  // ⚖ Leftover call 12 (owner 2026-11-19): with no club in the link and more than one invitation waiting, the page asks which
  // club and the person chooses; nothing picks one for them, and the club not chosen stays waiting on their home page.
  const [clubs, setClubs] = useState<InviteClub[] | null>(null);
  const [chosenSlug, setChosenSlug] = useState<string | null>(null);
  // The Terms box (step 6.3, §20 (1)): nothing while the legal pages are off. The server refuses the JOIN without it (the
  // password is set in the browser before the server sees anything, so the form checks the box before it does either).
  const terms = useTermsTick();
  const { refusal: termsRefusal } = terms;
  const termsFields = terms.fields;

  const orgName = invite?.orgName ?? linkOrgName;
  const roleName = invite?.roleLabel ?? linkRoleLabel;
  const inviter = invite?.inviterName ?? linkInviter;
  const orgSlug = chosenSlug ?? invite?.orgSlug ?? linkOrgSlug;
  const choosing = !chosenSlug && !!clubs && clubs.length > 1;

  // The chosen club, readable inside the auth listener's reads: a read made without a club (the listener re-fires on a tab
  // refocus) never overwrites the chosen club's title once a choice is made.
  const chosenRef = useRef<string | null>(null);
  const [joiningSlug, setJoiningSlug] = useState<string | null>(null);

  const loadInvite = useCallback(async (slug: string | null) => {
    const qs = slug ? `?org=${encodeURIComponent(slug)}` : '';
    const response = await fetch(`/api/auth/accept-invite${qs}`, { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json().catch(() => null) as InviteContext | null;
    if (!data || (!slug && chosenRef.current)) return;
    if (data.clubs && data.clubs.length > 1) setClubs(data.clubs);
    else setInvite(data);
  }, []);

  /** The person chose a club: read that club's invitation (title, role, inviter) and join only it. */
  function chooseClub(slug: string) {
    chosenRef.current = slug;
    setChosenSlug(slug);
    setErrorMsg('');
    void loadInvite(slug);
  }

  useEffect(() => {
    const supabase = createClient();

    // The /auth/callback page exchanges the link's token (PKCE or implicit flow) and lands here
    // with the session already in cookies; INITIAL_SESSION fires with it.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        void loadInvite(linkOrgSlug);
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
  }, [linkOrgSlug, loadInvite]);

  /** Step 2 on its own — the join. Called after the password is set, and again by "Try again". */
  const joinAs = useCallback(async (slug: string | null): Promise<JoinOutcome> => {
    try {
      const res = await fetch('/api/auth/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), orgSlug: slug, ...termsFields }),
      });
      const data = await res.json().catch(() => ({}));
      const termsLine = termsRefusal(data);
      if (termsLine) {
        setErrorMsg(termsLine);
        return 'terms';
      }
      if (!res.ok) {
        // The page's first read didn't answer, so the join was sent without a club: it asks which (call 12).
        if (data?.code === 'choose_club' && Array.isArray(data.clubs)) {
          setClubs(data.clubs as InviteClub[]);
          setErrorMsg('');
          return 'choose';
        }
        setErrorMsg(typeof data?.error === 'string' ? data.error : '');
        // A policy refusal (a scorekeeper keeps one home organization) or a run-out invitation will not change on a
        // retry; anything else is worth one.
        if (data?.code === 'invitation_lapsed') return 'lapsed';
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
  }, [firstName, lastName, router, termsFields, termsRefusal]);
  const join = useCallback(() => joinAs(orgSlug), [joinAs, orgSlug]);

  function settle(outcome: JoinOutcome) {
    if (outcome === 'failed') setPageState('joinFailed');
    if (outcome === 'refused') setPageState('joinRefused');
    if (outcome === 'lapsed') setPageState('joinLapsed');
    if (outcome === 'terms') setPageState('ready');
    if (outcome === 'choose') setPageState('joinChoose');
  }

  /** After the password: the person names the club, and only that join is sent (the password is never asked again). */
  async function chooseAndJoin(slug: string) {
    chooseClub(slug);
    // The question stays on screen with "Joining…" on the chosen club (not the join-failed alert) until the answer lands.
    setJoiningSlug(slug);
    const outcome = await joinAs(slug);
    setJoiningSlug(null);
    settle(outcome);
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
    // Ask 2A: the button stays on; without the tick the form says (5b), and neither the password nor the join is sent.
    if (terms.missing) {
      setErrorMsg(terms.missing);
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
            {/* An invitation stays open 30 days from its last send (P2c), so "still waiting" is no longer always true. */}
            {`An invitation stays open for 30 days. If yours from ${orgName ?? 'the club'} is still open, set a password and it will be on your home page. If it has run out, ask them to send it again.`}
          </p>
          <Link href="/auth/forgot-password" className={accountForm.primary}>Set a password</Link>
        </div>
        <StartFoot legal>
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
  // Leftover call 12: more than one club is waiting and none was named. Before the password, the question is the page; after
  // it (the first read hadn't answered), the password is kept and only the join waits for the answer.
  const asking = (choosing && (pageState === 'ready' || pageState === 'waiting')) || pageState === 'joinChoose';
  if (asking && clubs) {
    const afterPassword = pageState === 'joinChoose';
    return (
      <StartColumn>
        <StartHead
          title="Which club are you joining?"
          sub={afterPassword ? 'Your password is saved. You have invitations from more than one club.' : 'You have invitations from more than one club.'}
        />
        <div className={accountForm.form}>
          <p className={accountForm.body}>Choose one. The other invitations stay open on your home page, to accept or decline there, until they run out.</p>
          {clubs.map(club => (
            <button
              key={club.slug}
              type="button"
              className={accountForm.secondary}
              disabled={joiningSlug !== null}
              onClick={() => (afterPassword ? void chooseAndJoin(club.slug) : chooseClub(club.slug))}
            >
              {joiningSlug === club.slug ? 'Joining…' : club.name}
            </button>
          ))}
        </div>
      </StartColumn>
    );
  }

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
        {pageState === 'joinLapsed' && (
          <div className={accountForm.error} role="alert">
            <strong>Your password is saved, but this invitation has run out.</strong>
            <br />
            Ask {clubWord} to send it again.
          </div>
        )}
        {(pageState === 'joinRefused' || pageState === 'joinLapsed') && (
          <Link href="/discover" className={accountForm.secondary}>Go to your home page</Link>
        )}

        {/* An invitation that ran out before the person got here (P2c): nothing to set up a password for. */}
        {pageState === 'ready' && invite?.status === 'lapsed' && (
          <div className={accountForm.error} role="alert">
            <strong>This invitation has run out.</strong>
            <br />
            Ask {clubWord} to send it again.
          </div>
        )}
        {pageState === 'ready' && invite?.status === 'lapsed' && (
          <Link href="/discover" className={accountForm.secondary}>Go to your home page</Link>
        )}

        {(pageState === 'ready' || pageState === 'submitting') && invite?.status !== 'lapsed' && (
          <form onSubmit={handleSubmit} className={accountForm.form}>
            <AccountFields
              idPrefix="accept"
              values={{ firstName, lastName, email: '', password }}
              onChange={(field, value) => setField[field](value)}
              email={false}
              autoFocus="firstName"
            />
            <TermsTickRow tick={terms} id="accept-terms" />

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
