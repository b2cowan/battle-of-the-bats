'use client';
import { useState, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import styles from './AccountForm.module.css';

/** The one account step's classes (buttons, callout, foot row, hint), for the few lines a door adds of its own. */
export { styles as accountForm };

/**
 * THE ONE ACCOUNT STEP (The first look, Stage 1, owner rulings 2026-10-19; hub FIRST_LOOK_SIGNUP_HUB.html, the S1
 * screens). Every door that makes an account wears these pieces: the start column, the heading, the four account
 * fields. A door adds only what it must (plan rule 4) — an invitation drops the email it already knows.
 */

/** The start column on the warm paper: 420px, centred, no card around the form (plan rule 1). */
export function StartColumn({ children }: { children: ReactNode }) {
  return (
    <div className={styles.page}>
      <div className={styles.column}>{children}</div>
    </div>
  );
}

/** The foot row under the form, every link a 44px row (D6); `split` puts two ways out at either end of one row. */
export function StartFoot({ children, split = false }: { children: ReactNode; split?: boolean }) {
  return <div className={split ? styles.footSplit : styles.foot}>{children}</div>;
}

/** The id of a field's hint line, for the input's aria-describedby (the hint is read with the field). */
export const hintId = (fieldId: string) => `${fieldId}-hint`;

/** The heading (the display face, sentence case, one per screen), its one sub line, and the step line when there is one. */
export function StartHead({ title, sub, steps }: { title: ReactNode; sub?: ReactNode; steps?: ReactNode }) {
  return (
    <div className={styles.head}>
      <h1 className={styles.title}>{title}</h1>
      {sub && <p className={styles.sub}>{sub}</p>}
      {steps}
    </div>
  );
}

/** One labelled field with its optional hint line (the hint is read with the field). */
export function Field({ id, label, hint, children }: { id: string; label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>{label}</label>
      {children}
      {hint && <p className={styles.hint} id={hintId(id)}>{hint}</p>}
    </div>
  );
}

export interface AccountValues {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

/**
 * First name, last name, email, password (with the eye), in that order, with the same placeholders and the same hint
 * at every door (plan rule 4). `email={false}` drops the email field for a door that already knows it (an invitation).
 * `afterEmail` is the line a door hangs under the email ("An account already exists…"). `focusEmail` puts the cursor
 * in the email field when the form opens again from "Use a different email".
 */
export function AccountFields({ idPrefix, values, onChange, email = true, afterEmail, disabled = false, focusEmail = false }: {
  idPrefix: string;
  values: AccountValues;
  onChange: (field: keyof AccountValues, value: string) => void;
  email?: boolean;
  afterEmail?: ReactNode;
  disabled?: boolean;
  focusEmail?: boolean;
}) {
  const [showPw, setShowPw] = useState(false);
  const pwId = `${idPrefix}-password`;
  return (
    <>
      <div className={styles.two}>
        <Field id={`${idPrefix}-first-name`} label="First name">
          <input
            id={`${idPrefix}-first-name`}
            type="text"
            className={styles.input}
            value={values.firstName}
            onChange={e => onChange('firstName', e.target.value)}
            placeholder="Jordan"
            required
            autoComplete="given-name"
            disabled={disabled}
          />
        </Field>
        <Field id={`${idPrefix}-last-name`} label="Last name">
          <input
            id={`${idPrefix}-last-name`}
            type="text"
            className={styles.input}
            value={values.lastName}
            onChange={e => onChange('lastName', e.target.value)}
            placeholder="Lee"
            required
            autoComplete="family-name"
            disabled={disabled}
          />
        </Field>
      </div>

      {email && (
        <Field id={`${idPrefix}-email`} label="Email">
          <input
            id={`${idPrefix}-email`}
            type="email"
            className={styles.input}
            value={values.email}
            onChange={e => onChange('email', e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
            disabled={disabled}
            autoFocus={focusEmail}
          />
          {afterEmail}
        </Field>
      )}

      <Field id={pwId} label="Password" hint="At least 8 characters.">
        <div className={styles.pwWrap}>
          <input
            id={pwId}
            type={showPw ? 'text' : 'password'}
            className={styles.input}
            value={values.password}
            onChange={e => onChange('password', e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            aria-describedby={hintId(pwId)}
            disabled={disabled}
          />
          <button
            type="button"
            className={styles.eye}
            onClick={() => setShowPw(s => !s)}
            // One name and a pressed state, so a screen reader hears "Show password, toggle button, pressed".
            aria-label="Show password"
            aria-pressed={showPw}
          >
            {showPw ? <EyeOff size={20} strokeWidth={1.8} aria-hidden /> : <Eye size={20} strokeWidth={1.8} aria-hidden />}
          </button>
        </div>
      </Field>
    </>
  );
}
