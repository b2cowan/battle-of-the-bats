'use client';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Field, StartColumn, StartHead, accountForm } from '@/components/auth/AccountForm';
import StartSteps from '@/components/auth/StartSteps';
import LoadingState from '@/components/shared/LoadingState';
import { safeNextPath } from '@/lib/safe-redirect';
import { twoStepStepUrl } from '@/lib/two-step-paths';
import { TWO_STEP_FRESH_CODE } from '@/lib/code-again';
import styles from './two-step.module.css';

/**
 * SET UP TWO-STEP SIGN-IN (Board Ready · two-step sign-in, Part 1; drawings tab 2, desktop and phone).
 *
 * Reached by itself at sign-in when a seat requires it (platform staff now; a club's board or coaches once Part 3's
 * switches are on), from "Set up my new phone" after a backup code (`?replace=1`), and from Part 2's Account ›
 * Sign-in & security. `?step=codes` is "Get new backup codes" (one of the five actions that ask for a code).
 *
 *   Scan          desktop: the QR code and the key; phone: "Open in authenticator app", because the app is on this phone
 *   Backup codes  ten, shown once; Done without the tick says why under it (ask B), never a faded button
 *   Done          "Your other devices were signed out" is true: the sign-in service does it when two-step is turned on
 *
 * "Not now" is absent once something requires it (staff; a club past its 14 days).
 *
 * ⚖ A CLUB'S SCREEN FIRST (Part 3; drawings tab 8 "After the password"). Arriving from sign-in (`?why=club`) or from the
 * server's check (`?why=required`), a person a club's switch covers sees the club's screen before the set-up starts:
 *   during the 14 days   "Your club now asks for two-step sign-in" · Set it up now · Remind me next time (N days left)
 *   after them           "Set up two-step sign-in to continue" · Set it up now · Go to my other teams instead (only when
 *                        they have somewhere else to go: `elsewhere` from the status route)
 * Reached from Account › Sign-in & security there is no `why`, so the set-up starts at once, as before.
 */

type Status = {
  signedIn: boolean;
  email?: string | null;
  hasFactor?: boolean;
  passed?: boolean;
  isDemo?: boolean;
  requiredNow?: boolean;
  replacing?: boolean;
  requiredBy?: { kind: 'staff' | 'club'; orgName?: string; role?: string; state?: 'grace' | 'required'; until?: string | null }[];
  elsewhere?: boolean;
};

/** "Milton Minor Ball requires it for treasurers." — the seat in the club's words. */
const ROLE_PLURAL: Record<string, string> = {
  owner: 'its owner', admin: 'admins', treasurer: 'treasurers', league_admin: 'league admins', league_registrar: 'registrars',
  coach: 'coaches',
};

type ClubScreen = { kind: 'club'; past: boolean; orgName: string; who: string; daysLeft: number; elsewhere: boolean };

/** `adding`: a new phone set up beside the old one (the session typed the app's code); verify removes the old one. */
type Enrolment = { factorId: string; qrCode: string; secret: string; uri: string; adding?: boolean };

type Screen =
  | { kind: 'loading' }
  | { kind: 'refused'; title: string; body: string }
  /** "Get new backup codes" asks first: the person's unused codes stop working (/review 2026-11-11). */
  | { kind: 'confirmCodes' }
  | { kind: 'scan'; enrolment: Enrolment }
  | { kind: 'codes'; codes: string[]; fresh: boolean }
  | { kind: 'done' }
  | ClubScreen;

const STEP_LABELS = ['Scan', 'Backup codes', 'Done'] as const;

/** "JBSWY3DPEHPK3PXP" → "JBSW Y3DP EHPK 3PXP", easier to type into an app. */
function groupKey(secret: string): string {
  return secret.replace(/(.{4})/g, '$1 ').trim();
}

/** The club's screen for this person, or null when no club covers them (staff alone, or nothing). */
function clubScreenFor(s: Status, now: number = Date.now()): ClubScreen | null {
  const clubs = (s.requiredBy ?? []).filter(r => r.kind === 'club' && r.orgName);
  if (clubs.length === 0) return null;
  // A club past its 14 days speaks first: it is the one holding the person back.
  const past = clubs.find(r => r.state === 'required');
  // Required by something with no grace (platform staff) while the club is still in its 14 days: "Remind me" would only
  // come straight back here (/review of Part 3), so the set-up starts as it does for staff.
  if (!past && s.requiredNow) return null;
  const r = past ?? clubs.reduce((a, b) => (Date.parse(a.until ?? '') <= Date.parse(b.until ?? '') ? a : b));
  const untilMs = r.until ? Date.parse(r.until) : NaN;
  const daysLeft = Number.isFinite(untilMs) ? Math.max(1, Math.ceil((untilMs - now) / 86_400_000)) : 1;
  return {
    kind: 'club',
    past: Boolean(past),
    orgName: r.orgName ?? 'Your club',
    who: ROLE_PLURAL[r.role ?? ''] ?? 'your role',
    daysLeft,
    elsewhere: s.elsewhere === true,
  };
}

function usePhoneLayout(): boolean {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px), (pointer: coarse)');
    const update = () => setPhone(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return phone;
}

function SetUp() {
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get('next'), null);
  const replace = searchParams.get('replace') === '1';
  const newCodesOnly = searchParams.get('step') === 'codes';
  const why = searchParams.get('why');
  const phone = usePhoneLayout();

  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });
  const [status, setStatus] = useState<Status | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tickHint, setTickHint] = useState(false);
  const [copied, setCopied] = useState<'key' | 'codes' | null>(null);
  // The service let this set-up lapse (left open too long): the way on is to start again.
  const [expired, setExpired] = useState(false);
  const started = useRef(false);

  const goOn = useCallback(async () => {
    // Where the person was going; with no `next`, the same place a sign-in would land them. A full load, so the browser
    // starts fresh on the session the set-up just upgraded.
    // Never back to this page itself (a sign-in that began here would bring the person straight back; /review of Part 3).
    let dest = next && !next.startsWith('/auth/two-step') ? next : null;
    if (!dest) {
      try { dest = (await (await fetch('/api/auth/destination')).json()).destination ?? '/discover'; } catch { dest = '/discover'; }
    }
    window.location.assign(dest ?? '/discover');
  }, [next]);

  /** The set-up itself: a fresh authenticator to scan. */
  const begin = useCallback(async () => {
    setScreen({ kind: 'loading' });
    const res = await fetch('/api/auth/two-step/set-up/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ replace }),
    });
    const data = await res.json().catch(() => ({})) as Partial<Enrolment> & { code?: string };
    // A new phone needs a code from the last 15 minutes: the one window asked (and sent this again). Reaching here with
    // the refusal means the person said no in the window.
    if (res.status === 401 && data.code === TWO_STEP_FRESH_CODE) {
      setScreen({ kind: 'refused', title: 'A code comes first', body: 'Setting up a new phone asks for a code from your authenticator app, or a backup code. Nothing has changed.' });
      return;
    }
    if (!res.ok || !data.factorId) {
      setScreen(data.code === 'already_on'
        ? { kind: 'refused', title: 'Two-step sign-in is already on', body: 'Signing in asks for a code from your app.' }
        : { kind: 'refused', title: 'We couldn’t start the set-up', body: 'Try again in a moment.' });
      return;
    }
    setScreen({ kind: 'scan', enrolment: data as Enrolment });
  }, [replace]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const self = `/auth/two-step${window.location.search}`;
      let s: Status;
      try { s = await (await fetch('/api/auth/two-step/status')).json(); } catch { s = { signedIn: false }; }
      setStatus(s);
      if (!s.signedIn) { window.location.assign(`/auth/login?next=${encodeURIComponent(self)}`); return; }
      if (s.hasFactor && !s.passed) { window.location.assign(twoStepStepUrl('code', self)); return; }
      if (s.isDemo) {
        setScreen({ kind: 'refused', title: 'Not on the demo', body: 'The demo account is shared by everyone trying it, so two-step sign-in can’t be turned on here.' });
        return;
      }

      if (newCodesOnly) {
        setScreen({ kind: 'confirmCodes' });
        return;
      }

      // Already on — unless the person is finishing the replacement of a lost phone.
      if (s.hasFactor && !replace && !s.replacing) {
        setScreen({ kind: 'refused', title: 'Two-step sign-in is already on', body: 'Signing in asks for a code from your app.' });
        return;
      }
      // A club's screen first (tab 8), when sign-in or the server's check sent the person here.
      const club = why && !replace && !s.replacing ? clubScreenFor(s) : null;
      if (club) { setScreen(club); return; }
      await begin();
    })();
  }, [newCodesOnly, replace, why, begin]);


  async function makeNewCodes() {
    setBusy(true);
    const res = await fetch('/api/auth/two-step/backup-codes', { method: 'POST' });
    const data = await res.json().catch(() => ({})) as { backupCodes?: string[]; code?: string };
    setBusy(false);
    // The one window asked for a code (and sent this again); reaching here with the refusal means the person said no.
    if (res.status === 401 && data.code === TWO_STEP_FRESH_CODE) {
      setScreen({ kind: 'refused', title: 'A code comes first', body: 'New backup codes ask for a code from your authenticator app, or a backup code. Your codes haven’t changed.' });
      return;
    }
    if (!res.ok || !data.backupCodes) {
      setScreen({ kind: 'refused', title: 'We couldn’t make new codes', body: 'Try again in a moment.' });
      return;
    }
    setScreen({ kind: 'codes', codes: data.backupCodes, fresh: false });
  }

  async function copy(text: string, what: 'key' | 'codes') {
    try { await navigator.clipboard.writeText(text); setCopied(what); window.setTimeout(() => setCopied(null), 2000); } catch { /* nothing to copy into */ }
  }

  function download(codes: string[]) {
    const body = [
      'FieldLogicHQ backup codes',
      ...(status?.email ? [`Account: ${status.email}`] : []),
      'Each code works once. Keep them somewhere other than your phone.',
      '',
      ...codes,
      '',
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([body], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fieldlogichq-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function turnOn(e: React.FormEvent, enrolment: Enrolment) {
    e.preventDefault();
    setError(null);
    const digits = code.replace(/\s+/g, '');
    if (!/^\d{6}$/.test(digits)) { setError('Type the 6 digits the app shows.'); return; }
    setBusy(true);
    const res = await fetch('/api/auth/two-step/set-up/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ factorId: enrolment.factorId, code: digits, replace: enrolment.adding === true }),
    });
    const data = await res.json().catch(() => ({})) as { backupCodes?: string[]; error?: string; code?: string };
    setBusy(false);
    if (data.code === 'expired') { setExpired(true); return; }
    if (!res.ok || !data.backupCodes) { setError(data.error ?? 'That code didn’t work. Try again.'); return; }
    setScreen({ kind: 'codes', codes: data.backupCodes, fresh: true });
  }

  // Never while replacing a lost phone: the old one is already gone, so the set-up is the way back.
  const notNow = !status?.requiredNow && !replace && !status?.replacing;

  if (screen.kind === 'loading') return <StartColumn><LoadingState label="Loading…" /></StartColumn>;

  if (screen.kind === 'club') {
    return (
      <StartColumn>
        <StartHead
          title={screen.past ? 'Set up two-step sign-in to continue' : 'Your club now asks for two-step sign-in'}
          sub={screen.past
            ? `${screen.orgName} requires it for ${screen.who}. Until it’s set up, the club’s pages wait.`
            : `${screen.orgName} requires it for ${screen.who}. It takes about two minutes.`}
        />
        <div className={accountForm.form}>
          <button type="button" className={accountForm.primary} onClick={() => void begin()} id="two-step-club-set-up">Set it up now</button>
          {screen.past ? (
            screen.elsewhere && (
              <button type="button" className={accountForm.textBtn} onClick={() => window.location.assign('/discover')} id="two-step-club-elsewhere">
                Go to my other teams instead
              </button>
            )
          ) : (
            <button type="button" className={accountForm.textBtn} onClick={goOn} id="two-step-club-later">
              Remind me next time ({screen.daysLeft} {screen.daysLeft === 1 ? 'day' : 'days'} left)
            </button>
          )}
        </div>
      </StartColumn>
    );
  }

  if (screen.kind === 'confirmCodes') {
    return (
      <StartColumn>
        <StartHead title="Get new backup codes" sub="You’ll get ten new codes. The codes you saved before stop working." />
        <div className={accountForm.form}>
          <button type="button" className={accountForm.primary} onClick={makeNewCodes} disabled={busy} id="two-step-new-codes">
            {busy ? 'Making codes…' : 'Make new backup codes'}
          </button>
          <button type="button" className={accountForm.textBtn} onClick={goOn}>Not now</button>
        </div>
      </StartColumn>
    );
  }

  if (screen.kind === 'refused') {
    return (
      <StartColumn>
        <StartHead title={screen.title} sub={screen.body} />
        <div className={accountForm.form}>
          <button type="button" className={accountForm.primary} onClick={goOn}>Continue</button>
        </div>
      </StartColumn>
    );
  }

  if (screen.kind === 'scan') {
    const { enrolment } = screen;
    const qr = (
      <div className={styles.qr}>
        {/* The sign-in service's own QR image (an inline SVG data URI). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={enrolment.qrCode} alt="QR code to scan with your authenticator app" />
      </div>
    );
    const keyRow = (lead: string) => (
      <p className={styles.keyRow}>
        <span>{lead}</span>
        <span className={styles.key}>{groupKey(enrolment.secret)}</span>
        <button type="button" className={styles.copy} onClick={() => copy(enrolment.secret, 'key')}>
          {copied === 'key' ? 'Copied' : 'Copy'}
        </button>
      </p>
    );
    return (
      <StartColumn>
        <StartHead
          title="Set up two-step sign-in"
          sub="When you sign in, you’ll also type a 6-digit code from an app on your phone."
          steps={<StartSteps current={1} labels={STEP_LABELS} ariaLabel="Set-up steps" />}
        />
        <form className={accountForm.form} onSubmit={e => turnOn(e, enrolment)}>
          {phone ? (
            <>
              <ol className={styles.steps}>
                <li><strong>Add FieldLogicHQ to your authenticator app</strong></li>
              </ol>
              <a className={accountForm.secondary} href={enrolment.uri}>Open in authenticator app</a>
              {keyRow('No app opens? Copy this key into it:')}
              {showQr && qr}
            </>
          ) : (
            <>
              <ol className={styles.steps}>
                <li>
                  <strong>Open an authenticator app on your phone</strong>{' '}
                  <span>Any of them works: Google Authenticator, Microsoft Authenticator, 1Password, or the Passwords app on an iPhone.</span>
                </li>
                <li><strong>Scan this code with the app</strong></li>
              </ol>
              {qr}
              {keyRow('Can’t scan? Type this key into the app instead:')}
            </>
          )}
          <Field id="two-step-setup-code" label={phone ? 'The 6-digit code it shows' : 'The 6-digit code the app shows'}>
            <input
              id="two-step-setup-code"
              className={accountForm.input}
              value={code}
              onChange={e => setCode(e.target.value.replace(/[^\d\s]/g, '').slice(0, 7))}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]*"
              placeholder="6-digit code"
              aria-invalid={error ? true : undefined}
            />
          </Field>
          {expired ? (
            <div className={accountForm.noticeWarn} role="alert">
              <strong>This set-up has expired.</strong>{' '}
              Start again to get a fresh code to scan.{' '}
              <button type="button" className={accountForm.textBtn} onClick={() => window.location.reload()}>Start again</button>
            </div>
          ) : error && (
            <div className={accountForm.noticeError} role="alert"><strong>That code didn’t work.</strong>{' '}{error.replace(/^That code didn’t work\.\s*/, '')}</div>
          )}
          <button type="submit" className={accountForm.primary} disabled={busy} id="two-step-turn-on">
            {busy ? 'Turning it on…' : 'Turn on two-step sign-in'}
          </button>
          {phone && !showQr && (
            <button type="button" className={accountForm.textBtn} onClick={() => setShowQr(true)}>Show the QR code</button>
          )}
          {notNow && (
            <button type="button" className={accountForm.textBtn} onClick={goOn}>Not now</button>
          )}
        </form>
      </StartColumn>
    );
  }

  if (screen.kind === 'codes') {
    const { codes, fresh } = screen;
    return (
      <StartColumn>
        <StartHead
          title="Save your backup codes"
          sub={phone ? 'If you lose your phone, one of these gets you in. Each works once.' : 'If you lose your phone, one of these gets you in. Each code works once.'}
          steps={fresh ? <StartSteps current={2} labels={STEP_LABELS} ariaLabel="Set-up steps" /> : undefined}
        />
        <div className={accountForm.form}>
          <ul className={styles.codes} aria-label="Backup codes" id="two-step-backup-codes">
            {codes.map(c => <li key={c}>{c}</li>)}
          </ul>
          <div className={styles.codeActions}>
            <button type="button" className={accountForm.secondary} onClick={() => copy(codes.join('\n'), 'codes')}>
              {copied === 'codes' ? 'Copied' : 'Copy'}
            </button>
            <button type="button" className={accountForm.secondary} onClick={() => download(codes)}>Download</button>
          </div>
          {!phone && (
            <p className={accountForm.hint}>
              Keep them somewhere other than your phone. A password manager, or printed and kept with your club papers. We can’t show them again.
            </p>
          )}
          <label className={styles.tick}>
            <input
              type="checkbox"
              checked={saved}
              onChange={e => { setSaved(e.target.checked); if (e.target.checked) setTickHint(false); }}
              id="two-step-saved"
            />
            <span>I’ve saved my backup codes somewhere other than {phone ? 'this' : 'my'} phone.</span>
          </label>
          {tickHint && <p className={`${accountForm.hint} ${accountForm.hintError}`} role="alert">Tick the box once your codes are saved.</p>}
          <button
            type="button"
            className={accountForm.primary}
            id="two-step-codes-done"
            onClick={() => {
              if (!saved) { setTickHint(true); return; }
              if (fresh) setScreen({ kind: 'done' });
              else void goOn();
            }}
          >
            Done
          </button>
        </div>
      </StartColumn>
    );
  }

  return (
    <StartColumn>
      <StartHead
        title="Two-step sign-in is on"
        sub="From now on, signing in asks for a code from your app."
        steps={<StartSteps current={3} labels={STEP_LABELS} ariaLabel="Set-up steps" />}
      />
      <div className={accountForm.form}>
        <div className={accountForm.callout}>
          <strong>Your other devices were signed out.</strong>{' '}
          Sign in on them again, with a code. That’s how we know a stolen password isn’t still signed in somewhere.
        </div>
        <button type="button" className={accountForm.primary} onClick={goOn} id="two-step-continue">Continue</button>
      </div>
    </StartColumn>
  );
}

export default function TwoStepSetUpPage() {
  return (
    <Suspense fallback={<StartColumn><LoadingState label="Loading…" /></StartColumn>}>
      <SetUp />
    </Suspense>
  );
}
