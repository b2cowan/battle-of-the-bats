'use client';

import { PRIVACY_TITLE, TERMS_TITLE } from '@/lib/legal-words';
import { useLegalLinks } from './LegalLinksProvider';
import styles from './LegalFootLinks.module.css';

/**
 * The two legal links under a sign-in or sign-up form (GST/HST Stage 6 step 6.2). Renders nothing while the legal pages are off.
 * Sits under `StartFoot` on every door the build prompt's census lists; the tick-box doors (6.3) keep it beside the box's own links.
 * `console` is the support console card's 12px line.
 */
export default function LegalFootLinks({ console: isConsole = false }: { console?: boolean }) {
  const links = useLegalLinks();
  if (!links) return null;
  return (
    <div className={`${styles.line} ${isConsole ? styles.console : ''}`}>
      <a className={styles.link} href={links.termsHref}>{TERMS_TITLE}</a>
      <span aria-hidden>·</span>
      <a className={styles.link} href={links.privacyHref}>{PRIVACY_TITLE}</a>
    </div>
  );
}
