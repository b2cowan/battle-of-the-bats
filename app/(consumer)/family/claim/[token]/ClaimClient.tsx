'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import warm from '@/components/consumer/warmTheme.module.css';
import styles from '../../family.module.css';
import { signIn, signOut } from '@/lib/auth';
import { signInErrorCopy } from '@/lib/auth-errors';
import {
  GUARDIAN_CONSENT_DRAFT_NOTICE, beforeYouJoinWords, namesList,
} from '@/lib/family-guardian-consent';
import { FAMILY_INVITATION_WORDS } from '@/lib/family-invitation-words';
import { useLegalLinks } from '@/components/legal/LegalLinksProvider';
import { TermsSentence, useTermsTick } from '@/components/legal/TermsTickRow';
import { Field, PasswordField, accountForm } from '@/components/auth/AccountForm';
import type { InvitationChild, InvitationViewer } from '@/lib/family-invitation';
import type { InvitationState } from '@/lib/family-invitation-rules';

/**
 * The accept page (Signed-in family accounts Stage 4a, Part 4; drawing tab 2). The server decided the state; this draws it.
 *
 *   open, signed out  — the email box ("Type the email this invitation was sent to"); a match opens "Choose a password" (new
 *                       account) or "Your password" (existing, with Forgot password), then "Before you join" and Join. One fill.
 *   open, A           — signed in as the invited address: the words and Join.
 *   open, C           — signed in as another address: refused, with Sign out (ruling 5).
 *   D / E / F         — expired or replaced (Email me a new invitation) / already joined (Open the team) / no longer works.
 *
 * Deliberately a BUTTON, never an acceptance on page load: the link arrives by email, and email scanners follow URLs.
 */

const W = FAMILY_INVITATION_WORDS.accept;

type Step = 'email' | 'new' | 'existing';

/** A reload keeps the old scroll position, and the page it reloads into (joined, no longer works, signed out) is a short card:
 *  the parent landed on empty space below it. Opt this entry out of restoration, then reload — it starts at the top. */
function reloadFromTop(): void {
  try { window.history.scrollRestoration = 'manual'; } catch { /* a browser without it keeps its default */ }
  window.location.reload();
}

export default function ClaimClient({ token, state, maskedEmail, from, kids, viewer, club, homePath, signedInNeedsTerms = false }: {
  token: string;
  state: InvitationState;
  maskedEmail: string | null;
  from: 'club' | 'coach';
  kids: InvitationChild[];
  viewer: InvitationViewer;
  club: { name: string; contact: string | null; privacyNoticeUrl: string | null } | null;
  homePath: string;
  /** A signed-in viewer who has not agreed to the current Terms yet: the third box shows (step 6.3, §20 (5h)). */
  signedInNeedsTerms?: boolean;
}) {
  // However the page was reached (a reload, Back, a link), the invitation starts at the top of the card.
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const shell = (inner: React.ReactNode) => (
    <div className={warm.warm}>
      <div className={styles.page}>
        <div className={styles.card}>{inner}</div>
      </div>
    </div>
  );

  if (state === 'expired_or_replaced') return shell(<Expired token={token} />);
  if (state === 'joined') {
    return shell(<>
      <h1 className={styles.joinTitle}>{W.joined.title}</h1>
      <div className={styles.acceptActions}>
        <Link href={homePath} className={accountForm.primary}>
          {kids.length === 1 ? W.joined.buttonOne(kids[0].firstName) : W.joined.buttonSeveral}
        </Link>
      </div>
    </>);
  }
  if (state !== 'open' || !club || kids.length === 0 || !maskedEmail) {
    return shell(<>
      <h1 className={styles.joinTitle}>{W.gone.title}</h1>
      <p className={styles.notice}>{W.gone.body(club?.name ?? null, club?.contact ?? null)}</p>
    </>);
  }
  if (viewer.kind === 'other') {
    return shell(<>
      <div className={styles.acceptWarn} role="alert">
        <h1 className={styles.acceptWarnTitle}>{W.another.title}</h1>
        <p className={styles.notice}>{W.another.body(maskedEmail, viewer.maskedEmail, from)}</p>
      </div>
      <div className={styles.acceptActions}>
        <button type="button" className={styles.chipGhost} onClick={async () => { await signOut(); reloadFromTop(); }}>
          {W.another.signOut}
        </button>
      </div>
    </>);
  }
  return shell(<Accept token={token} maskedEmail={maskedEmail} kids={kids} viewer={viewer} club={club} signedInNeedsTerms={signedInNeedsTerms} />);
}

/** D: one answer whether or not anything was sent (ask 9). */
function Expired({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function resend() {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/family/claim/${token}/resend`, { method: 'POST' });
      if (res.status === 429) { setError(W.tooMany); return; }
      if (!res.ok) throw new Error('resend');
      setSent(true);
    } catch {
      setError(W.failed);
    } finally {
      setBusy(false);
    }
  }
  return <>
    <h1 className={styles.joinTitle}>{W.expired.title}</h1>
    {sent ? <p className={styles.notice} role="status">{W.expired.sent}</p> : <>
      <p className={styles.notice}>{W.expired.body}</p>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.acceptActions}>
        <button type="button" className={accountForm.primary} onClick={resend} disabled={busy}>{busy ? W.expired.sending : W.expired.button}</button>
      </div>
    </>}
  </>;
}

/** The open invitation: A (signed in as the address) or the email-first form. */
function Accept({ token, maskedEmail, kids, viewer, club, signedInNeedsTerms }: {
  token: string;
  maskedEmail: string;
  kids: InvitationChild[];
  viewer: Exclude<InvitationViewer, { kind: 'other' }>;
  club: { name: string; contact: string | null; privacyNoticeUrl: string | null };
  signedInNeedsTerms: boolean;
}) {
  const signedIn = viewer.kind === 'same';
  // FieldLogicHQ's own privacy policy: linked only while the legal pages are on (GST/HST Stage 6 step 6.2).
  const legal = useLegalLinks();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [guardianBox, setGuardianBox] = useState(false);
  const [consentBox, setConsentBox] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // THE THIRD BOX (GST/HST Stage 6 step 6.3, §20 (5h)): the Terms box, under the guardian and consent boxes, only for someone
  // who has not agreed yet — a new account always; a signed-in viewer when the server said so; an existing account signing in
  // here once the join answers that it needs to (nobody knows before it signs in). The two boxes above and their consent
  // record are unchanged. Nothing while the legal pages are off.
  const terms = useTermsTick();
  const [termsAsked, setTermsAsked] = useState(false);
  const showTerms = terms.on && ((signedIn && signedInNeedsTerms) || (!signedIn && step === 'new') || termsAsked);

  const names = kids.map(c => c.firstName);
  const words = beforeYouJoinWords(club.name, names);
  const several = kids.length > 1;
  // Children on the same team share one row ("Leo and Ava · Otters · U9 Rookie"), as drawn (state B).
  const rows = [...new Set(kids.map(c => c.teamLine))].map(line => ({
    line, names: namesList(kids.filter(c => c.teamLine === line).map(c => c.firstName)),
  }));

  async function post(url: string, body: unknown) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { res, data: await res.json().catch(() => ({})) as Record<string, unknown> };
  }

  /** A refusal from the join, in the page's words; a dead invitation reloads into its D / E / F state. */
  function refused(status: number, data: Record<string, unknown>): void {
    const termsLine = terms.refusal(data);
    if (termsLine) { setTermsAsked(true); return setError(termsLine); }
    if (status === 429) return setError(W.tooMany);
    if (data.error === 'consent_required') return setError(W.boxesRequired);
    if (data.error === 'password_short') return setError(W.passwordTooShort);
    if (data.error === 'email_mismatch') return setError(W.emailNoMatch(maskedEmail));
    if (data.error === 'account_exists') { setStep('existing'); setPassword(''); return setError(W.accountExists); }
    if (status === 404 || data.error === 'another_email') { reloadFromTop(); return; }
    setError(W.failed);
  }

  async function checkEmail(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !email.trim()) return;
    setBusy(true); setError(null);
    try {
      const { res, data } = await post(`/api/family/claim/${token}/email`, { email });
      if (res.status === 429) return setError(W.tooMany);
      if (!res.ok) return setError(W.failed);
      if (data.match !== true) return setError(W.emailNoMatch(maskedEmail));
      setStep(data.hasAccount === true ? 'existing' : 'new');
    } catch {
      setError(W.failed);
    } finally {
      setBusy(false);
    }
  }

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!guardianBox || !consentBox) return setError(W.boxesRequired);
    if (showTerms && terms.missing) return setError(terms.missing);
    setBusy(true); setError(null);
    try {
      if (!signedIn && step === 'new') {
        if (password.length < 8) return setError(W.passwordTooShort);
        const { res, data } = await post(`/api/family/claim/${token}`, { mode: 'new', email, password, guardianBox, consentBox, ...terms.fields });
        if (!res.ok) return refused(res.status, data);
        // The account exists and has joined; this signs the browser in to it, then opens the family page.
        await signIn(email, password);
        window.location.href = String(data.next ?? '/family');
        return;
      }
      if (!signedIn) {
        const { error: signInError } = await signIn(email, password);
        if (signInError) return setError(signInErrorCopy(signInError));
      }
      const { res, data } = await post(`/api/family/claim/${token}`, { guardianBox, consentBox, ...(showTerms ? terms.fields : {}) });
      if (!res.ok) return refused(res.status, data);
      window.location.href = String(data.next ?? '/family');
    } catch {
      setError(W.failed);
    } finally {
      setBusy(false);
    }
  }

  const heading = several ? W.pageTitleSeveral : W.pageTitleOne(names[0]);
  const forgotHref = `/auth/forgot-password?next=${encodeURIComponent(`/family/claim/${token}`)}`;

  return <>
    <h1 className={styles.joinTitle}>{heading}</h1>
    {!several && !signedIn && <p className={styles.acceptSub}>{[rows[0]?.line, club.name].filter(Boolean).join(' · ')}</p>}
    {signedIn && <p className={styles.notice}>{W.signedInAs(viewer.name, viewer.maskedEmail)}</p>}
    {several && (
      <div className={styles.acceptSection}>
        {rows.map(r => (
          <div key={r.line} className={styles.acceptChild}>
            <div className={styles.acceptChildName}>{r.names}</div>
            {r.line && <div className={styles.acceptChildLine}>{r.line}</div>}
          </div>
        ))}
      </div>
    )}

    {!signedIn && step === 'email' ? (
      <form className={styles.acceptStep} onSubmit={checkEmail} noValidate>
        <Field id="claim-email" label={W.emailLabel} hint={W.emailHint(maskedEmail)}>
          <input id="claim-email" className={accountForm.input} type="email" autoComplete="email" inputMode="email" value={email}
            aria-describedby="claim-email-hint" onChange={e => setEmail(e.target.value)} required />
        </Field>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.acceptActions}>
          <button type="submit" className={accountForm.primary} disabled={busy || !email.trim()}>{W.emailNext}</button>
        </div>
      </form>
    ) : (
      <form className={styles.acceptStep} onSubmit={join} noValidate>
        {!signedIn && <div className={styles.acceptFields}>
          <div>
            <Field id="claim-email-typed" label={W.emailLabel}>
              <input id="claim-email-typed" className={accountForm.input} type="email" value={email} readOnly aria-readonly="true" />
            </Field>
            <button type="button" className={styles.acceptTextLink} onClick={() => { setStep('email'); setPassword(''); setError(null); }}>
              {W.otherEmail}
            </button>
          </div>
          <PasswordField id="claim-password" value={password} onChange={setPassword} showName="password"
            purpose={step === 'new' ? 'create' : 'current'} label={step === 'new' ? W.newPasswordLabel : W.existingPasswordLabel} />
          {step === 'existing' && (
            <div>
              <p className={accountForm.hint}>{W.existingPasswordHint}</p>
              <a className={styles.acceptTextLink} href={forgotHref}>{W.forgotPassword}</a>
            </div>
          )}
        </div>}

        <div className={styles.acceptSection}>
          <p className={styles.placeholderNote}>{GUARDIAN_CONSENT_DRAFT_NOTICE}</p>
          <p className={styles.cardTitle}>{words.title}</p>
          <p>{words.intro}</p>
          <p className={styles.acceptChildName}>{words.whoTitle}</p>
          <ul>
            <li>{words.who.you}</li>
            <li>{words.who.staff}</li>
            <li>{words.who.others}</li>
            <li>
              {words.who.us}{' '}
              {legal
                ? <a className={styles.acceptLink} href={legal.privacyHref} target="_blank" rel="noopener noreferrer">{words.policyLink}</a>
                : null}{' '}
              {club.privacyNoticeUrl
                ? <a className={styles.acceptLink} href={club.privacyNoticeUrl} target="_blank" rel="noopener noreferrer">{words.clubNoticeLink}</a>
                : club.contact ? words.noClubNotice(club.contact) : null}
            </li>
          </ul>
          <p>{words.choice}</p>
          <label className={styles.check}>
            <input type="checkbox" checked={guardianBox} onChange={e => setGuardianBox(e.target.checked)} />
            <span>{words.guardianBox} <strong>{W.required}</strong></span>
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={consentBox} onChange={e => setConsentBox(e.target.checked)} />
            <span>{words.consentBox} <strong>{W.required}</strong></span>
          </label>
          {showTerms && (
            <label className={styles.check}>
              <input type="checkbox" checked={terms.ticked} onChange={e => terms.setTicked(e.target.checked)} />
              <span><TermsSentence /> <strong>{W.required}</strong></span>
            </label>
          )}
        </div>

        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.acceptActions}>
          <button type="submit" className={accountForm.primary} disabled={busy || !guardianBox || !consentBox || (showTerms && !terms.ticked) || (!signedIn && !password)}>
            {busy ? W.joining : words.button}
          </button>
        </div>
      </form>
    )}
  </>;
}
