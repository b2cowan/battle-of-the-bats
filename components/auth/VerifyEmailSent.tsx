'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import Link from 'next/link';
import ResendLink from './ResendLink';
import { StartFoot, accountForm } from './AccountForm';
import styles from './VerifyEmailSent.module.css';

export { requestVerificationLink } from './ResendLink';

/**
 * THE CHECK-YOUR-EMAIL BLOCK — every sign-up that verifies by link shows it after the form (owner ruling 2026-10-16,
 * "verify every sign-up"; drawings on SIGNUP_EMAIL_VERIFICATION_HUB.html). The door's own words, a statement of where
 * the email went, "Send the link again" (V3), and the two ways out.
 *
 * `tone` picks the host's own ground:
 *  - `start` — the one look every account door shares (The first look, Stage 1, 2026-10-19): the email in one white
 *    callout, the resend as the white secondary, "Use a different email" and "Already confirmed? Sign in" on one
 *    44px row. Each door keeps its own last clause in `lead`.
 *  - `register` — the event's public Register page, which wears the organizer's brand and keeps its own look.
 */
export default function VerifyEmailSent(props: {
  tone: 'start' | 'register';
  email: string;
  lead: ReactNode;
  after?: ReactNode;
  /** Where the resent link returns to (the same place the first link does), and the name it continues. */
  resendNext: string;
  continueName?: string;
  /** "Use a different email": back to the form with its entries kept. Absent where the email is fixed. */
  onChangeEmail?: () => void;
  /** "Already confirmed? Sign in". */
  signInHref?: string;
}) {
  const { tone, email, lead, after, resendNext, continueName, onChangeEmail, signInHref } = props;
  // The start look takes focus when it opens: the button that submitted the form is gone, and a status line inserted
  // with its text already in it is not reliably spoken (The first look, the Stage 1 screen-reader pass).
  const blockRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (tone === 'start') blockRef.current?.focus();
  }, [tone]);

  if (tone === 'start') {
    return (
      // The form this replaces held focus; it moves to the block, so a screen reader reads the sentence and the address.
      <div className={accountForm.waitBlock} tabIndex={-1} ref={blockRef}>
        <p className={accountForm.body}>{lead}</p>
        <p className={accountForm.callout} role="status">Sent to <strong>{email}</strong>.{after && <> {after}</>}</p>
        <ResendLink
          email={email}
          next={resendNext}
          continueName={continueName}
          classes={{ button: accountForm.secondary, sent: accountForm.sentAgain, error: accountForm.errorText }}
        />
        {(onChangeEmail || signInHref) && (
          <StartFoot split>
            {onChangeEmail ? <button type="button" className={accountForm.footLink} onClick={onChangeEmail}>Use a different email</button> : <span />}
            {signInHref && <span>Already confirmed? <Link href={signInHref} className={accountForm.footLink}>Sign in</Link></span>}
          </StartFoot>
        )}
      </div>
    );
  }

  return (
    <div className={`${styles.root} ${styles[tone]}`}>
      <p className={styles.lead}>{lead}</p>
      <p className={styles.sent} role="status">Verification email sent to {email}.</p>
      {after && <p className={styles.after}>{after}</p>}
      <ResendLink
        email={email}
        next={resendNext}
        continueName={continueName}
        classes={{ button: styles.resend, sent: styles.sentAgain, error: styles.error }}
      />
      {(onChangeEmail || signInHref) && (
        <div className={styles.foot}>
          {onChangeEmail ? <button type="button" className={styles.footLink} onClick={onChangeEmail}>Use a different email</button> : <span />}
          {signInHref && <span>Already confirmed? <Link href={signInHref} className={styles.footLink}>Sign in</Link></span>}
        </div>
      )}
    </div>
  );
}
