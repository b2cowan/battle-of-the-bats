'use client';

/**
 * BrandLockup — the ONE FieldLogicHQ mark + wordmark lockup, exiting to Home (grammar
 * Zone 1). Per the ratified cross-shell ruling, the logo is the one device that stays
 * IDENTICAL across shells (exempt from dialect rules) — so its markup and geometry live
 * here exactly once; hosts supply only the three wordmark COLORS via classNames (each
 * shell's skin owns those). Used by the operator strips (admin + premium coach);
 * ConsumerNav's text-only wordmark is a deliberate separate variant (no mark image).
 */

import Link from 'next/link';
import styles from './BrandLockup.module.css';

export default function BrandLockup({
  fieldClassName,
  logicClassName,
  hqClassName,
}: {
  fieldClassName?: string;
  logicClassName?: string;
  hqClassName?: string;
}) {
  return (
    <Link href="/discover" className={styles.lockup} aria-label="FieldLogicHQ Home">
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny static SVG logo */}
      <img className={styles.brandLogo} src="/favicon.svg" alt="" width={22} height={22} aria-hidden />
      <span className={styles.logoMain}>
        <span className={fieldClassName}>Field</span>
        <span className={logicClassName}>Logic</span>
        <span className={hqClassName}>HQ</span>
      </span>
    </Link>
  );
}
