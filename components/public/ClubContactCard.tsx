'use client';
import { Check, Copy } from 'lucide-react';
import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard';
import kit from './ClubKit.module.css';
import styles from './TryoutPage.module.css';

/**
 * A status page's card (Club Tier Stage 4b-2b; the closed, not-open-yet and finished tryout frames, and the club Tryouts
 * address out of season): what the page has to say, then — under a hairline — "Questions? Email the club" over the
 * club's address with Copy (an email link does nothing on some phones, so the address is shown and copyable) — built
 * like Directions above it and lined up under them: labelled at a desk, its symbol alone on a phone (owner 2026-10-21).
 * It is the page's way on, so it never dead-ends. It flips to a tick and "Copied" for two seconds (a transient word,
 * like "Saved"), announced from its own region.
 */
export default function ClubContactCard({ sentence, email }: { sentence: string; email: string | null }) {
  const { copied, copy } = useCopyToClipboard();
  return (
    <div className={`${kit.list} ${styles.statusCard}`}>
      <p className={styles.statusText}>{sentence}</p>
      {email && (
        <div className={styles.contact}>
          <span>Questions? Email the club</span>
          <div className={styles.mailRow}>
            <a href={`mailto:${email}`} className={styles.address}>{email}</a>
            <button
              type="button"
              className={`${kit.btn} ${kit.btnSecondary} ${kit.btnSm} ${styles.copy}`}
              onClick={() => copy(email)}
              aria-label="Copy email address"
            >
              {copied ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />}
              <span className={styles.copyLabel}>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <span className={kit.srOnly} aria-live="polite">{copied ? 'Copied' : ''}</span>
          </div>
        </div>
      )}
    </div>
  );
}
