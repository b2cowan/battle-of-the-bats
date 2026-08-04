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
import { useIsSandbox } from '@/components/sandbox/SandboxProvider';
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
  // Inside a "See it live" demo the mark stays — whose product this is, is the whole point — but
  // it stops being a door out to the real platform. Plain text rather than a disabled link: a
  // control that looks pressable and isn't is worse than one that never invited the press.
  // False for every real org, and false by default outside a demo shell, so nothing else moves.
  const inSandbox = useIsSandbox();

  const inner = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny static SVG logo */}
      <img className={styles.brandLogo} src="/favicon.svg" alt="" width={22} height={22} aria-hidden />
      <span className={styles.logoMain}>
        <span className={fieldClassName}>Field</span>
        <span className={logicClassName}>Logic</span>
        <span className={hqClassName}>HQ</span>
      </span>
    </>
  );

  if (inSandbox) return <span className={styles.lockup}>{inner}</span>;

  return (
    <Link href="/discover" className={styles.lockup} aria-label="FieldLogicHQ Home">
      {inner}
    </Link>
  );
}
