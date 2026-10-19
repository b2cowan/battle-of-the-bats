'use client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import ResendLink from './ResendLink';
import styles from './VerifyEmailSent.module.css';

export { requestVerificationLink } from './ResendLink';

/**
 * THE CHECK-YOUR-EMAIL BLOCK — every sign-up that verifies by link shows it after the form (owner ruling 2026-10-16,
 * "verify every sign-up"; drawings on SIGNUP_EMAIL_VERIFICATION_HUB.html). The org sign-up's own words, a statement
 * of where the email went, "Send the link again" (V3), and the two ways out.
 *
 * `tone` picks the host's own ground: the /start forms, the sign-in card, or the event's public Register page.
 */
export default function VerifyEmailSent(props: {
  tone: 'start' | 'auth' | 'register';
  email: string;
  lead: ReactNode;
  after?: ReactNode;
  /** Where the resent link returns to (the same place the first link does), and the name it continues. */
  resendNext: string;
  continueName?: string;
  /** "Use a different email": back to the form with its entries kept. Absent where the email is fixed. */
  onChangeEmail?: () => void;
  /** "Already verified? Sign in". */
  signInHref?: string;
}) {
  const { tone, email, lead, after, resendNext, continueName, onChangeEmail, signInHref } = props;

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
          {signInHref && <span>Already verified? <Link href={signInHref} className={styles.footLink}>Sign in</Link></span>}
        </div>
      )}
    </div>
  );
}
