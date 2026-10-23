'use client';
import { Check, Copy } from 'lucide-react';
import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard';
import kit from './ClubKit.module.css';
import styles from './TryoutPage.module.css';

/** I7 — the club's Copy, named for whose address it is (two identical names on one page can't be told apart). */
export const COPY_CLUB_EMAIL = 'Copy the club’s email address';

/**
 * The address with Copy — an email link does nothing on some phones, so the address is shown and copyable. Built like
 * Directions: labelled at a desk, its symbol alone on a phone (owner 2026-10-21). It flips to a tick and "Copied" for
 * two seconds (a transient word, like "Saved"), announced from its own region. Shared by the status card below and the
 * open tryout page's questions line (`TryoutQuestionsLine`, Club Tier 4c-2 Part B).
 */
export function ContactCopyRow({ email, copyLabel }: { email: string; copyLabel: string }) {
  const { copied, copy } = useCopyToClipboard();
  return (
    <div className={styles.mailRow}>
      <a href={`mailto:${email}`} className={styles.address}>{email}</a>
      <button
        type="button"
        className={`${kit.btn} ${kit.btnSecondary} ${kit.btnSm} ${styles.copy}`}
        onClick={() => copy(email)}
        aria-label={copyLabel}
      >
        {copied ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />}
        <span className={styles.copyLabel}>{copied ? 'Copied' : 'Copy'}</span>
      </button>
      <span className={kit.srOnly} aria-live="polite">{copied ? 'Copied' : ''}</span>
    </div>
  );
}

/**
 * A status page's card (Club Tier Stage 4b-2b; the closed, not-open-yet and finished tryout frames, and the club Tryouts
 * address out of season): what the page has to say, then — under a hairline — "Questions? Email the club" over the
 * club's address with Copy, lined up under Directions above it. It is the page's way on, so it never dead-ends.
 *
 * `lead` / `copyLabel` change only on the team's own tryout page while it is not open yet and a head coach set an
 * address (Club Tier 4c-2 Part B, I3): "Questions about these tryouts? Email the head coach".
 */
export default function ClubContactCard({
  sentence, email, lead = 'Questions? Email the club', copyLabel = COPY_CLUB_EMAIL,
}: { sentence: string; email: string | null; lead?: string; copyLabel?: string }) {
  return (
    <div className={`${kit.list} ${styles.statusCard}`}>
      <p className={styles.statusText}>{sentence}</p>
      {email && (
        <div className={styles.contact}>
          <span>{lead}</span>
          <ContactCopyRow email={email} copyLabel={copyLabel} />
        </div>
      )}
    </div>
  );
}
