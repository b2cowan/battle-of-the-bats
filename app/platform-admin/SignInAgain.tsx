'use client';

import { useCallback, useId, useRef, useState, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import KitDialog, { DialogCancel } from '@/components/shared/KitDialog';
import { SIGN_IN_AGAIN_CODE, SIGN_IN_AGAIN_WORDS as W, type SignInAgainRefusal } from '@/lib/sign-in-again';
import kit from './console.module.css';
import styles from './sign-in-again.module.css';

/** What the window says for one door (tabs 3 and 4): its title, the sentence naming the change, the button, the foot. */
export type SignInAgainAsk = { title: string; lead: string; confirm: string; foot: string };

const REFUSALS = new Set<SignInAgainRefusal>(['wrong_password', 'too_many_tries', 'not_checked']);

/** Whether a gated route answered "sign in again" (401 with the code), read from a copy so the caller can still read it. */
async function asksToSignInAgain(res: Response): Promise<boolean> {
  if (res.status !== 401) return false;
  const body = await res.clone().json().catch(() => null) as { code?: unknown } | null;
  return body?.code === SIGN_IN_AGAIN_CODE;
}

/**
 * SIGN IN AGAIN (Stage 0, Part 10, tab 2): the product's small question window with one password field. It opens only
 * when the server answers "sign in again" to the press; once the password is accepted it closes and the same request goes
 * again once, with no second press (Ask 4). Cancel, Escape or a tap outside means no, and nothing runs. While it checks,
 * the window holds. A wrong password keeps it open with the text selected, so typing again replaces it.
 */
function SignInAgainWindow({ ask, email, onDone }: { ask: SignInAgainAsk; email: string; onDone: (accepted: boolean) => void }) {
  const id = useId();
  const fieldRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<SignInAgainRefusal | null>(null);

  async function check() {
    if (busy || !password) return;
    setBusy(true);
    setRefusal(null);
    let outcome: SignInAgainRefusal | null = 'not_checked';
    try {
      const res = await fetch('/api/platform-admin/sign-in-again', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) outcome = null;
      else {
        const code = (await res.json().catch(() => null) as { code?: SignInAgainRefusal } | null)?.code;
        if (code && REFUSALS.has(code)) outcome = code;
      }
    } catch { /* a dropped connection: the password could not be checked */ }
    if (outcome === null) { onDone(true); return; }
    setBusy(false);
    setRefusal(outcome);
    if (outcome === 'wrong_password') window.requestAnimationFrame(() => fieldRef.current?.select());
  }

  // A wait or a failed check replaces the sentence (tab 2, frames 3 and 4); a wrong password is a red line under the field.
  const wait = refusal === 'too_many_tries' ? W.tooManyTries : refusal === 'not_checked' ? W.notChecked : null;
  return (
    <KitDialog
      kind="question"
      title={ask.title}
      identity={email || undefined}
      busy={busy}
      followKeyboard
      onClose={() => onDone(false)}
      footerStart={<p>{ask.foot}</p>}
      footer={(
        <>
          <DialogCancel />
          <button type="submit" form={id} className="btn btn-primary" disabled={busy}>{busy ? W.checking : ask.confirm}</button>
        </>
      )}
    >
      <div className={styles.window}>
        {wait ? <p className={`${kit.callout} ${kit.calloutWarn}`} role="alert">{wait}</p> : <p className={styles.lead}>{ask.lead}</p>}
        <form id={id} onSubmit={event => { event.preventDefault(); void check(); }}>
          <label className={kit.fieldGroup} htmlFor={`${id}-pw`}>
            <span className={kit.label}>{W.password}<span className={kit.req} aria-hidden="true"> *</span></span>
            <span className={styles.pwWrap}>
              <input
                ref={fieldRef}
                id={`${id}-pw`}
                type={show ? 'text' : 'password'}
                className={kit.field}
                value={password}
                onChange={event => setPassword(event.target.value)}
                // The current password, so a password manager offers it (tab 7, the honest limit).
                autoComplete="current-password"
                required
                aria-invalid={refusal === 'wrong_password' || undefined}
                aria-describedby={refusal === 'wrong_password' ? `${id}-wrong` : undefined}
              />
              {/* The product's eye (`components/auth/PasswordInput`): one name, pressed or not. That field wears the
                  public pages' tokens, so the console keeps its own look here. */}
              <button type="button" className={styles.pwToggle} onClick={() => setShow(value => !value)}
                aria-label="Show password" aria-pressed={show} aria-controls={`${id}-pw`} disabled={busy}>
                {show ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}
              </button>
            </span>
            {refusal === 'wrong_password' && <span id={`${id}-wrong`} className={kit.fieldError} role="alert">{W.wrongPassword}</span>}
          </label>
        </form>
      </div>
    </KitDialog>
  );
}

/**
 * A screen's door to a gated route: `send(run, ask)` makes the request; when the server answers "sign in again" it opens
 * the window, and once the password is accepted makes the same request again, once. It resolves to the final answer, or
 * null when the person said no (the screen is then exactly as it was). Render `window` anywhere on the screen.
 */
export function useSignInAgain(email: string): {
  send: (run: () => Promise<Response>, ask: SignInAgainAsk) => Promise<Response | null>;
  window: ReactNode;
  /** Reads the route's `ownerEmailed` (Ask 9): the finish notice's last sentence, and whether `ownerNotice` shows. */
  ownerEmailed: (answer: { ownerEmailed?: boolean | null }) => string;
  /** "The email to the owner could not be sent…": render it under the finish notice. */
  ownerNotice: ReactNode;
} {
  const [pending, setPending] = useState<{ ask: SignInAgainAsk; resolve: (accepted: boolean) => void } | null>(null);
  const [ownerNotEmailed, setOwnerNotEmailed] = useState(false);
  // One question at a time: a second ask answers the first one "no", so no caller waits forever.
  const answerRef = useRef<((accepted: boolean) => void) | null>(null);
  const send = useCallback(async (run: () => Promise<Response>, ask: SignInAgainAsk) => {
    setOwnerNotEmailed(false);
    const first = await run();
    if (!(await asksToSignInAgain(first))) return first;
    answerRef.current?.(false);
    let answer: ((accepted: boolean) => void) | null = null;
    const accepted = await new Promise<boolean>(resolve => {
      answer = resolve;
      answerRef.current = resolve;
      setPending({ ask, resolve });
    });
    // Only this ask's own window closes: a newer one, which answered this "no", stays open.
    if (answerRef.current === answer) {
      answerRef.current = null;
      setPending(null);
    }
    return accepted ? run() : null;
  }, []);
  const ownerEmailed = useCallback((answer: { ownerEmailed?: boolean | null }) => {
    setOwnerNotEmailed(answer.ownerEmailed === false);
    return answer.ownerEmailed === true ? ` ${W.ownerEmailed}` : '';
  }, []);
  const window = pending ? <SignInAgainWindow ask={pending.ask} email={email} onDone={pending.resolve} /> : null;
  const ownerNotice = ownerNotEmailed
    ? <div className={`${kit.callout} ${kit.calloutWarn}`} role="status">{W.ownerNotEmailed}</div>
    : null;
  return { send, window, ownerEmailed, ownerNotice };
}
