'use client';

import { useId, useRef, useState, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import KitDialog, { DialogCancel } from '@/components/shared/KitDialog';
import { CODE_AGAIN_WORDS as W, type CodeAgainProof, type CodeAgainRefusal } from '@/lib/code-again';
import styles from './CodeAgainWindow.module.css';

/** The check's answer: accepted, or why not (`wrong_password` only for staff's dev account with no authenticator). */
export type CodeAgainCheck = { ok: true } | { ok: false; refusal: CodeAgainRefusal | 'wrong_password' };

/**
 * THE ONE "TYPE YOUR CODE AGAIN" WINDOW (Board Ready · two-step sign-in, Part 2; owner rulings 2026-11-11). Every door
 * that asks for a code opens this: everyone's (components/shared/CodeAgainProvider.tsx, the 15-minute actions and the
 * 30-day re-ask) and staff's "sign in again" (app/platform-admin/SignInAgain.tsx, with its own words and its own check).
 * One window, so the two can never drift.
 *
 * Drawn after tab 8's "Stop requiring it" window (the drawings have no frame of this one): the product's small question
 * window, one field, Cancel and the confirm. The field is the app's six digits (one numeric field with the one-time-code
 * fill, never six boxes) or, by "Use a backup code", one of the person's ten (owner call 6: staff too). A wrong code is
 * a red line under the field with the text selected, so typing again replaces it; a wait or a failed check replaces the
 * lead sentence. While it checks, the window holds. Cancel, Escape or a tap outside means no.
 */
export default function CodeAgainWindow({
  title, lead, confirm, foot, identity, password = false, allowBackup = true, check, onDone,
}: {
  title: string;
  lead: ReactNode;
  confirm: string;
  foot?: ReactNode;
  identity?: string;
  /** Staff's dev account with no authenticator: the window asks for the password instead (no backup codes there). */
  password?: boolean;
  allowBackup?: boolean;
  check: (proof: CodeAgainProof) => Promise<CodeAgainCheck>;
  onDone: (accepted: boolean) => void;
}) {
  const id = useId();
  const fieldRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'code' | 'backup'>('code');
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<CodeAgainRefusal | 'wrong_password' | null>(null);
  const backup = !password && mode === 'backup';

  function switchMode(next: 'code' | 'backup') {
    setMode(next);
    setValue('');
    setRefusal(null);
    window.requestAnimationFrame(() => fieldRef.current?.focus());
  }

  async function submit() {
    if (busy || !value.trim()) return;
    setBusy(true);
    setRefusal(null);
    let outcome: CodeAgainCheck;
    try {
      outcome = await check(password ? { password: value } : backup ? { backupCode: value } : { code: value });
    } catch {
      outcome = { ok: false, refusal: 'not_checked' };
    }
    if (outcome.ok) { onDone(true); return; }
    setBusy(false);
    // No authenticator on the account right now (a lost phone part-way replaced): a backup code is the way.
    if (outcome.refusal === 'no_authenticator' && allowBackup && !password) {
      setMode('backup');
      setValue('');
    }
    setRefusal(outcome.refusal);
    if (outcome.refusal === 'wrong_code' || outcome.refusal === 'wrong_backup_code' || outcome.refusal === 'wrong_password') {
      window.requestAnimationFrame(() => fieldRef.current?.select());
    }
  }

  const wait = refusal === 'too_many_tries' ? W.tooManyTries
    : refusal === 'not_checked' ? W.notChecked
      : refusal === 'no_authenticator' ? W.noAuthenticator
        : null;
  const wrong = refusal === 'wrong_code' || refusal === 'wrong_backup_code' || refusal === 'wrong_password';
  const wrongWords = refusal === 'wrong_backup_code' ? W.wrongBackup
    : refusal === 'wrong_password' ? 'That password didn’t work.'
      : W.wrongCode;
  const fieldId = `${id}-field`;
  const errId = `${id}-wrong`;

  return (
    <KitDialog
      kind="question"
      title={title}
      identity={identity || undefined}
      busy={busy}
      followKeyboard
      onClose={() => onDone(false)}
      footerStart={foot ? <p>{foot}</p> : undefined}
      footer={(
        <>
          <DialogCancel />
          <button type="submit" form={id} className="btn btn-primary" disabled={busy}>{busy ? W.checking : confirm}</button>
        </>
      )}
    >
      <div className={styles.window}>
        {wait
          ? <p className={styles.callout} role="alert">{wait}</p>
          : <p className={styles.lead}>{backup ? W.backupLead : lead}</p>}
        <form id={id} onSubmit={event => { event.preventDefault(); void submit(); }} className={styles.form}>
          <label className={styles.fieldGroup} htmlFor={fieldId}>
            <span className={styles.label}>{password ? 'Password' : backup ? W.backupLabel : W.codeLabel}</span>
            {password ? (
              <span className={styles.pwWrap}>
                <input
                  ref={fieldRef}
                  id={fieldId}
                  type={show ? 'text' : 'password'}
                  className={styles.field}
                  value={value}
                  onChange={event => setValue(event.target.value)}
                  autoComplete="current-password"
                  required
                  autoFocus
                  aria-invalid={wrong || undefined}
                  aria-describedby={wrong ? errId : undefined}
                />
                <button type="button" className={styles.pwToggle} onClick={() => setShow(v => !v)}
                  aria-label="Show password" aria-pressed={show} aria-controls={fieldId} disabled={busy}>
                  {show ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}
                </button>
              </span>
            ) : backup ? (
              <input
                ref={fieldRef}
                id={fieldId}
                className={`${styles.field} ${styles.data}`}
                value={value}
                onChange={event => setValue(event.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder={W.backupPlaceholder}
                required
                autoFocus
                aria-invalid={wrong || undefined}
                aria-describedby={wrong ? errId : undefined}
              />
            ) : (
              <input
                ref={fieldRef}
                id={fieldId}
                className={`${styles.field} ${styles.data}`}
                value={value}
                onChange={event => setValue(event.target.value.replace(/[^\d\s]/g, '').slice(0, 7))}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]*"
                placeholder={W.codePlaceholder}
                required
                autoFocus
                aria-invalid={wrong || undefined}
                aria-describedby={wrong ? errId : undefined}
              />
            )}
            {wrong && <span id={errId} className={styles.fieldError} role="alert">{wrongWords}</span>}
          </label>
          {!password && allowBackup && (
            <button type="button" className={styles.textBtn} disabled={busy} onClick={() => switchMode(backup ? 'code' : 'backup')}>
              {backup ? W.useApp : W.useBackup}
            </button>
          )}
        </form>
      </div>
    </KitDialog>
  );
}
