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
 * The password field with the eye. `create` is a new password: the rule as a hint under it (D-F4, never a placeholder)
 * and the browser's new-password fill; `current` is a sign-in, with nothing under it. `label` is "New password" on the
 * reset screen (U4), where the person already has one.
 */
export function PasswordField({ id, value, onChange, purpose = 'create', disabled = false, label = 'Password', autoFocus = false }: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  purpose?: 'create' | 'current';
  disabled?: boolean;
  label?: string;
  autoFocus?: boolean;
}) {
  const [showPw, setShowPw] = useState(false);
  const creating = purpose === 'create';
  return (
    <Field id={id} label={label} hint={creating ? 'At least 8 characters.' : undefined}>
      <div className={styles.pwWrap}>
        <input
          id={id}
          type={showPw ? 'text' : 'password'}
          className={styles.input}
          value={value}
          onChange={e => onChange(e.target.value)}
          required
          minLength={creating ? 8 : undefined}
          autoComplete={creating ? 'new-password' : 'current-password'}
          aria-describedby={creating ? hintId(id) : undefined}
          disabled={disabled}
          autoFocus={autoFocus}
        />
        <button
          type="button"
          className={styles.eye}
          onClick={() => setShowPw(s => !s)}
          // One fixed name that says the action (named for its field: "Show new password" on the reset screen) and a
          // pressed state, so a screen reader hears "Show password, toggle button, pressed" and never a flipping name.
          aria-label={`Show ${label.toLowerCase()}`}
          aria-pressed={showPw}
          aria-controls={id}
        >
          {showPw ? <EyeOff size={20} strokeWidth={1.8} aria-hidden /> : <Eye size={20} strokeWidth={1.8} aria-hidden />}
        </button>
      </div>
    </Field>
  );
}

/** The email field, the same at every door; `locked` when the address is fixed (a tournament claim is reserved for one). */
export function EmailField({ id, value, onChange, locked = false, disabled = false, autoFocus = false, hint, invalid = false }: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  locked?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  /** The line under the field, read with it: why it is locked, or "An account already exists…". */
  hint?: ReactNode;
  /** The field needs the person's attention (sign-in's "Enter your email address first."): a red edge, announced. */
  invalid?: boolean;
}) {
  return (
    <Field id={id} label="Email" hint={hint}>
      <input
        aria-describedby={hint ? hintId(id) : undefined}
        aria-invalid={invalid || undefined}
        id={id}
        type="email"
        className={styles.input}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="you@example.com"
        required
        autoComplete="email"
        readOnly={locked}
        disabled={disabled}
        autoFocus={autoFocus}
      />
    </Field>
  );
}

/**
 * First name, last name, email, password (with the eye), in that order, with the same placeholders and the same hint
 * at every door (plan rule 4). `email={false}` drops the email field for a door that already knows it (an invitation);
 * `emailLocked` shows it fixed (a tournament claim). `emailHint` is the line a door hangs under the email, read with it
 * ("An account already exists…"). `autoFocus` puts the cursor in a field when the form opens: the first name on an
 * invitation, the email when the form opens again (from "Use a different email", or from the sign-in form).
 */
export function AccountFields({ idPrefix, values, onChange, email = true, emailLocked = false, emailHint, disabled = false, autoFocus }: {
  idPrefix: string;
  values: AccountValues;
  onChange: (field: keyof AccountValues, value: string) => void;
  email?: boolean;
  emailLocked?: boolean;
  emailHint?: ReactNode;
  disabled?: boolean;
  autoFocus?: 'firstName' | 'email';
}) {
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
            autoFocus={autoFocus === 'firstName'}
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
        <EmailField
          id={`${idPrefix}-email`}
          value={values.email}
          onChange={value => onChange('email', value)}
          locked={emailLocked}
          disabled={disabled}
          autoFocus={autoFocus === 'email'}
          hint={emailHint}
        />
      )}

      <PasswordField id={`${idPrefix}-password`} value={values.password} onChange={value => onChange('password', value)} disabled={disabled} />
    </>
  );
}
