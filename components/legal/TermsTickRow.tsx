'use client';

import { useCallback, useState } from 'react';
import { ACCEPTANCE_BOX_PARTS as P, ACCEPTANCE_WORDS } from '@/lib/legal-acceptance-rules';
import { useLegalLinks } from './LegalLinksProvider';
import styles from './TermsTickRow.module.css';

/**
 * THE TICK ROW (GST/HST Stage 6 step 6.3, Chunk B; drawings tabs 1–4, build notes): §20 (1)'s one box, at every door that makes
 * an account. The house checkbox in a 44px label row (18px box, 9.6px gap), the sentence at the host's body size, both links
 * underlined and opening in a new tab. Renders NOTHING while the legal pages are off — dark means invisible.
 *
 * `useTermsTick()` is the form's half: the tick, the fields to send, the check before sending (Ask 2A: the button stays on;
 * pressing without the tick shows (5b) and sends nothing), and the reading of the server's refusal (the box un-ticks when the
 * Terms moved, and the next tick sends the version now current).
 */

/** §20 (1)'s sentence with its two links — the tick row, the sign-in screen and the family page's third box all say it this way. */
export function TermsSentence() {
  const links = useLegalLinks();
  if (!links) return null;
  return (
    <>
      {P.lead}
      <a className={styles.link} href={links.termsHref} target="_blank" rel="noopener noreferrer">{P.terms}</a>
      {P.middle}
      <a className={styles.link} href={links.privacyHref} target="_blank" rel="noopener noreferrer">{P.privacy}</a>
      {P.end}
    </>
  );
}

/**
 * A Terms sentence held as parts (`WINDOW_WORDS.published`, `PLAN_LINE_WORDS`): each part that is a document's title becomes its
 * link, underlined and opening in a new tab, as the box's own links do. Nothing while the pages are off.
 */
export function LinkedLine({ parts }: { parts: readonly string[] }) {
  const links = useLegalLinks();
  if (!links) return null;
  return (
    <>
      {parts.map((part, i) =>
        part === P.terms ? <a key={i} className={styles.link} href={links.termsHref} target="_blank" rel="noopener noreferrer">{part}</a>
          : part === P.privacy ? <a key={i} className={styles.link} href={links.privacyHref} target="_blank" rel="noopener noreferrer">{part}</a>
          : <span key={i}>{part}</span>)}
    </>
  );
}

export interface TermsTick {
  /** The legal pages are on: the row renders and the fields are sent. */
  on: boolean;
  ticked: boolean;
  setTicked: (v: boolean) => void;
  /** Spread into the request body: `{ acceptTerms, termsVersion }` when on, nothing when off (the production body, unchanged). */
  fields: { acceptTerms?: boolean; termsVersion?: string };
  /** (5b) when the row is on and unticked — the form shows it and sends nothing; null otherwise. */
  missing: string | null;
  /** The form's words for a server refusal of the box, or null when the refusal was about something else. */
  refusal: (data: unknown) => string | null;
}

/** `initialVersion`: a host that already knows the current version (the purchase window — its refusal named it) seeds it here. */
export function useTermsTick(initialVersion?: string): TermsTick {
  const links = useLegalLinks();
  const [ticked, setTicked] = useState(false);
  // The version the next tick agrees to: the one the page rendered, or the one a `terms_changed` refusal said is current now.
  const [version, setVersion] = useState<string | null>(initialVersion ?? null);
  const shown = version ?? links?.termsVersion ?? null;
  const refusal = useCallback((data: unknown): string | null => {
    const d = (data ?? {}) as { code?: unknown; error?: unknown; termsVersion?: unknown };
    const code = d.code ?? d.error;
    if (code === 'terms_changed') {
      setTicked(false);
      if (typeof d.termsVersion === 'string') setVersion(d.termsVersion);
      return ACCEPTANCE_WORDS.refuseChangedPage;
    }
    if (code === 'terms_unticked' || code === 'terms_required') return ACCEPTANCE_WORDS.refuseUnticked;
    return null;
  }, []);
  const on = !!links && shown !== null;
  return {
    on,
    ticked,
    setTicked,
    fields: on ? { acceptTerms: ticked, termsVersion: shown! } : {},
    missing: on && !ticked ? ACCEPTANCE_WORDS.refuseUnticked : null,
    refusal,
  };
}

/** The row. `nudge` is the follow sheet's 13.6px (Ask 10A); everywhere else the sentence takes the host's body size. */
export default function TermsTickRow({ tick, id, size = 'body', disabled = false }: {
  tick: TermsTick;
  id: string;
  size?: 'body' | 'nudge';
  disabled?: boolean;
}) {
  if (!tick.on) return null;
  return (
    <label className={size === 'nudge' ? `${styles.row} ${styles.nudge}` : styles.row} htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        className={styles.box}
        checked={tick.ticked}
        onChange={e => tick.setTicked(e.target.checked)}
        disabled={disabled}
        // aria-required, not `required`: the browser's own "tick this box" bubble would stop the submit before the form could
        // show §20 (5b) in its error callout (Ask 2A).
        aria-required="true"
      />
      <span><TermsSentence /></span>
    </label>
  );
}
