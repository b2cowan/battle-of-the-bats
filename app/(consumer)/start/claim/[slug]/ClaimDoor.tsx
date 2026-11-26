'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import StartSteps from '@/components/auth/StartSteps';
import { Field, StartColumn, StartFoot, StartHead, accountForm, hintId } from '@/components/auth/AccountForm';
import { useTermsGate } from '@/components/legal/TermsAcceptWindow';
import { useLegalLinks } from '@/components/legal/LegalLinksProvider';
import { CLUB_START_STEPS } from '@/lib/start-door';
import { CLAIM_WORDS, formatClaimCode, isClaimCodeShape, normaliseClaimCode, previewAddress } from '@/lib/preview-claim';
import type { ClaimClub } from '@/lib/preview-claim-server';
import { StartAccountStep } from '../../StartDoorForm';
import styles from './ClaimDoor.module.css';

export type ClaimFrame =
  | { kind: 'code'; resting: boolean; passGone: boolean }
  | { kind: 'account'; next: string }
  | { kind: 'claim'; pass: string }
  | { kind: 'refused'; message: string; differentEmail: boolean; next: string }
  | { kind: 'claimed' }
  | { kind: 'ended'; removedOn: string | null };

/** Initials that read on the club's colour: dark ink on a light colour, white on a dark one (the room card's rule). */
function inkOn(hex: string | null): string | undefined {
  const m = hex ? /^#([0-9a-f]{6})$/i.exec(hex) : null;
  if (!m) return undefined;
  const n = parseInt(m[1], 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 150 ? 'var(--home-ink)' : undefined;
}

/** The club's own mark on our page: its logo, or its initials on its colours (tab 6.1's "OM" tile). */
function ClubIdentity({ club, slug }: { club: ClaimClub; slug: string }) {
  const initials = club.name.split(/\s+/).filter(w => /^[A-Za-z]/.test(w)).slice(0, 2).map(w => w[0]!.toUpperCase()).join('');
  return (
    <div className={styles.identity}>
      {club.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- the club's own uploaded logo, any aspect
        <img src={club.logoUrl} alt="" className={styles.logo} />
      ) : (
        <span className={styles.tile} style={{ background: club.primary ?? undefined, borderColor: club.accent ?? undefined, color: inkOn(club.primary) }} aria-hidden>
          {initials}
        </span>
      )}
      <span className={styles.identityText}>
        <strong>{club.name}</strong>
        <span className={accountForm.hint}>{previewAddress(slug)}</span>
      </span>
    </div>
  );
}

/**
 * The claim's door pages (Club Website Track P, Session P3; drawing tabs 6 and 8). Start a club's look and parts: the
 * start column, its heading and step line, its fields and buttons. The page decides the frame on the server.
 */
export default function ClaimDoor({ slug, club, frame }: { slug: string; club: ClaimClub; frame: ClaimFrame }) {
  if (frame.kind === 'account') {
    return (
      <StartAccountStep
        door="club"
        pricing={null}
        claim={{ title: CLAIM_WORDS.accountTitle(club.name), sub: CLAIM_WORDS.accountLine, next: frame.next }}
      />
    );
  }
  if (frame.kind === 'claim') return <ClaimStep slug={slug} club={club} pass={frame.pass} />;
  if (frame.kind === 'code') return <CodeStep slug={slug} club={club} resting={frame.resting} passGone={frame.passGone} />;

  if (frame.kind === 'refused') {
    return (
      <StartColumn>
        <StartHead title={CLAIM_WORDS.claimTitle(club.name)} />
        <div className={accountForm.form}>
          <p className={accountForm.noticeError} role="alert">{frame.message}</p>
          {frame.differentEmail && <DifferentEmail next={frame.next} />}
        </div>
        <StartFoot legal>
          <p><Link href={`/${slug}`} className={accountForm.footLink}>{CLAIM_WORDS.backTo(club.name)}</Link></p>
        </StartFoot>
      </StartColumn>
    );
  }
  if (frame.kind === 'claimed') {
    return (
      <StartColumn>
        <StartHead title={CLAIM_WORDS.err.claimedTitle(club.name)} sub={CLAIM_WORDS.err.claimed} />
        <Link href={`/${slug}`} className={accountForm.secondary}>{CLAIM_WORDS.err.openSite}</Link>
      </StartColumn>
    );
  }
  return (
    <StartColumn>
      <StartHead title={CLAIM_WORDS.err.endedTitle} sub={CLAIM_WORDS.err.ended(frame.removedOn)} />
    </StartColumn>
  );
}

/** The authority tick, with "Terms" linked to the Terms (/legal 2026-11-25 P3 review, item 7); the record keeps it as text. */
function AuthoritySentence({ club }: { club: string }) {
  const links = useLegalLinks();
  const text = CLAIM_WORDS.authority(club);
  const at = text.lastIndexOf('Terms');
  if (!links || at < 0) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, at)}
      <a href={links.termsHref} target="_blank" rel="noopener noreferrer" className={styles.termsLink}>Terms</a>
      {text.slice(at + 'Terms'.length)}
    </span>
  );
}

/** "Use a different email" (tab 6.7): sign this account out here, and the claim goes on to the account step. */
function DifferentEmail({ next }: { next: string }) {
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    const { signOut } = await import('@/lib/auth');
    await signOut({ scope: 'local' });
    window.location.assign(next);
  }
  return (
    <button type="button" className={accountForm.secondary} onClick={go} disabled={busy}>
      {CLAIM_WORDS.err.useDifferentEmail}
    </button>
  );
}

/** Tab 6.1 (and tab 8, a forwarded link): the code first, before anyone makes an account. */
function CodeStep({ slug, club, resting: restingAtLoad, passGone }: { slug: string; club: ClaimClub; resting: boolean; passGone: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState(passGone ? CLAIM_WORDS.err.passGone : '');
  const [resting, setResting] = useState(restingAtLoad);
  const [failed, setFailed] = useState('');
  const [busy, setBusy] = useState(false);
  const fieldId = 'claim-code';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError('');
    setFailed('');
    const normal = normaliseClaimCode(code);
    if (!isClaimCodeShape(normal)) { setError(CLAIM_WORDS.err.shape); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/start/claim/check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, code: normal }),
      });
      const data = await res.json().catch(() => ({})) as { pass?: string; state?: string };
      if (data.pass) {
        router.push(`/start/claim/${encodeURIComponent(slug)}?pass=${encodeURIComponent(data.pass)}`);
        return;
      }
      if (data.state === 'wrong') setError(CLAIM_WORDS.err.wrong(club.name));
      else if (data.state === 'shape') setError(CLAIM_WORDS.err.shape);
      else if (data.state === 'resting') setResting(true);
      else if (data.state === 'claimed' || data.state === 'removed') { router.refresh(); return; }
      else setFailed(CLAIM_WORDS.err.didNotFinish);
    } catch {
      setFailed(CLAIM_WORDS.err.didNotFinish);
    }
    setBusy(false);
  }

  return (
    <StartColumn>
      <ClubIdentity club={club} slug={slug} />
      <StartHead title={CLAIM_WORDS.codeTitle} sub={resting ? undefined : CLAIM_WORDS.codeLine} />
      {resting ? (
        <p className={accountForm.noticeError} role="alert">{CLAIM_WORDS.err.resting}</p>
      ) : (
        <form onSubmit={submit} className={accountForm.form} noValidate>
          <Field id={fieldId} label={CLAIM_WORDS.codeLabel}
            hint={error ? <span className={accountForm.hintError} role="alert">{error}</span> : undefined}>
            <input
              id={fieldId}
              className={`${accountForm.input} ${styles.code}`}
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onBlur={() => setCode(c => (isClaimCodeShape(normaliseClaimCode(c)) ? formatClaimCode(c) : c))}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              inputMode="text"
              maxLength={12}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? hintId(fieldId) : undefined}
              autoFocus
            />
          </Field>
          {failed && <p className={accountForm.noticeError} role="alert">{failed}</p>}
          <button type="submit" className={accountForm.primary} disabled={busy}>
            {busy ? CLAIM_WORDS.codeChecking : CLAIM_WORDS.codeContinue}
          </button>
          <p className={accountForm.hint}>{CLAIM_WORDS.lostCard}</p>
        </form>
      )}
      <StartFoot legal>
        <p><Link href={`/${slug}`} className={accountForm.footLink}>{CLAIM_WORDS.backTo(club.name)}</Link></p>
      </StartFoot>
    </StartColumn>
  );
}

/** Tab 6.3: what stays and what is cleared, /legal's paragraph, the authority tick, then the one button (T8, T14, T16). */
function ClaimStep({ slug, club, pass }: { slug: string; club: ClaimClub; pass: string }) {
  const router = useRouter();
  const terms = useTermsGate();
  const [ticked, setTicked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [failed, setFailed] = useState(false);
  const claiming = useRef(false);

  async function claim() {
    if (claiming.current) return;
    setError('');
    setFailed(false);
    if (!ticked) { setError(CLAIM_WORDS.authorityMissing); return; }
    claiming.current = true;
    setBusy(true);
    try {
      const res = await terms.send('/api/start/claim', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, pass, authority: true }),
      });
      if (res === null) { claiming.current = false; setBusy(false); return; } // the Terms window was closed
      const data = await res.json().catch(() => ({})) as { next?: string; error?: string; code?: string; state?: string };
      if (res.ok && data.next) {
        router.push(data.next);
        router.refresh();
        return;
      }
      if (res.status === 410) {
        // Claimed or removed meanwhile, or the pass is no longer good: the page says which.
        router.replace(data.state === 'pass' ? `/start/claim/${encodeURIComponent(slug)}` : `/start/claim/${encodeURIComponent(slug)}?pass=${encodeURIComponent(pass)}`);
        router.refresh();
        return;
      }
      if (data.code === 'did_not_finish' || res.status >= 500) setFailed(true);
      else setError(data.error ?? CLAIM_WORDS.err.didNotFinish);
    } catch {
      setFailed(true);
    }
    claiming.current = false;
    setBusy(false);
  }

  return (
    <StartColumn>
      <StartHead
        title={CLAIM_WORDS.claimTitle(club.name)}
        sub={CLAIM_WORDS.emailConfirmed}
        steps={<StartSteps current={2} labels={CLUB_START_STEPS} />}
      />
      {failed ? (
        <div className={accountForm.form}>
          <p className={accountForm.noticeError} role="alert">{CLAIM_WORDS.err.didNotFinish}</p>
          <button type="button" className={accountForm.primary} onClick={claim} disabled={busy}>
            {busy ? CLAIM_WORDS.claiming : CLAIM_WORDS.err.tryAgain}
          </button>
        </div>
      ) : (
        <div className={accountForm.form}>
          <section className={styles.card} aria-label={club.name}>
            <ClubIdentity club={club} slug={slug} />
            <div className={styles.lists}>
              <div>
                <h2 className={styles.listHead}>{CLAIM_WORDS.stays}</h2>
                <ul className={styles.list}>{CLAIM_WORDS.staysItems.map(i => <li key={i}>{i}</li>)}</ul>
              </div>
              <div>
                <h2 className={styles.listHead}>{CLAIM_WORDS.cleared}</h2>
                <ul className={`${styles.list} ${styles.cleared}`}>{CLAIM_WORDS.clearedItems.map(i => <li key={i}>{i}</li>)}</ul>
              </div>
            </div>
          </section>
          <p className={accountForm.body}>{CLAIM_WORDS.owner}</p>
          <p className={styles.publisher}>{CLAIM_WORDS.publisher}</p>
          <label className={styles.tick}>
            <input type="checkbox" checked={ticked} onChange={e => setTicked(e.target.checked)} />
            <AuthoritySentence club={club.name} />
          </label>
          {error && <p className={`${accountForm.hint} ${accountForm.hintError}`} role="alert">{error}</p>}
          <button type="button" className={accountForm.primary} onClick={claim} disabled={busy}>
            {busy ? CLAIM_WORDS.claiming : CLAIM_WORDS.claimButton}
          </button>
          <p className={accountForm.fine}>{CLAIM_WORDS.notNow}</p>
        </div>
      )}
      {terms.window}
    </StartColumn>
  );
}
