'use client';

import { useState } from 'react';
import kit from '@/components/public/ClubKit.module.css';
import form from '@/components/public/ClubForm.module.css';
import { SIGNUP_LINK_WORDS as SW } from '@/lib/league-pay-words';
import css from './EmailMyLinkForm.module.css';

/**
 * "EMAIL ME MY LINK" (Signed-in family accounts Stage 1 Part 4; drawing tabs 2, 3 and 6). The family types the email
 * they signed up with; if it has a sign-up this season, the link goes to THAT inbox — never to the screen. The screen
 * says the same thing either way ("Check your inbox", naming the address typed), so it cannot be used to check who is
 * signed up. Two places draw it: the plain status page (`page`) and a closed link's "This link no longer works" card
 * (`replaced`, ask 5). The route is `email-my-link`, throttled; a throttle's own words are shown as they come.
 */
export default function EmailMyLinkForm({
  orgSlug,
  seasonSlug,
  seasonName,
  clubName,
  variant,
}: {
  orgSlug: string;
  seasonSlug: string;
  seasonName: string;
  clubName: string;
  variant: 'page' | 'replaced';
}) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [sentTo, setSentTo] = useState('');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const to = email.trim();
    if (!to) { setError(SW.errEmail); setState('error'); return; }
    setState('sending');
    setError('');
    try {
      const res = await fetch(`/api/league/${orgSlug}/${seasonSlug}/email-my-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: to }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data?.error === 'string' ? data.error : SW.errGeneric);
        setState('error');
        return;
      }
      setSentTo(to);
      setState('sent');
    } catch {
      setError(SW.errGeneric);
      setState('error');
    }
  }

  if (state === 'sent') {
    const body = SW.sentBody(seasonName);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'flex-start' }}>
        <div className={kit.card} role="status" style={{ alignSelf: 'stretch' }}>
          <h2 className={css.heading}>{SW.sentTitle}</h2>
          <p style={{ margin: 0, color: 'var(--club-text)' }}>{body.before}<strong>{sentTo}</strong>{body.after}</p>
          <p className={css.soft} style={{ marginTop: '0.6rem' }}>{SW.sentNote(clubName)}</p>
        </div>
        <button type="button" className={css.linkButton} onClick={() => { setState('idle'); setEmail(''); }}>
          {SW.tryAgain}
        </button>
      </div>
    );
  }

  const fields = (
    <form onSubmit={submit} noValidate>
      <div style={{ marginBottom: '1rem' }}>
        <label className={form.label} htmlFor={`email-my-link-${variant}`}>{SW.emailLabel}</label>
        <input
          id={`email-my-link-${variant}`}
          type="email"
          inputMode="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder={SW.emailPlaceholder}
          autoComplete="email"
          required
          className={form.input}
          aria-describedby={state === 'error' ? `email-my-link-${variant}-error` : undefined}
        />
      </div>
      {state === 'error' && (
        <p id={`email-my-link-${variant}-error`} role="alert" className={form.errorMsg} style={{ margin: '0 0 0.75rem' }}>{error}</p>
      )}
      <button type="submit" disabled={state === 'sending'} className={`${kit.btn} ${kit.btnPrimary} ${css.button}`}>
        {state === 'sending' ? SW.sending : SW.door}
      </button>
    </form>
  );

  if (variant === 'replaced') {
    return (
      <div className={kit.card}>
        <h2 className={css.heading}>{SW.replacedTitle}</h2>
        <p style={{ margin: '0 0 1rem', color: 'var(--club-text)' }}>{SW.replacedBody}</p>
        {fields}
      </div>
    );
  }
  return (
    <>
      <p className={css.soft} style={{ marginBottom: '1rem' }}>{SW.intro}</p>
      {fields}
    </>
  );
}
