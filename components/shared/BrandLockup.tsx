'use client';

/**
 * BrandLockup — THE ONE FieldLogicHQ NAME (The public face, warm: S4 Part B; owner ruling W, 2026-10-23: the refined
 * Joined FL, olive leading, lime kept for actions; spec `docs/agents/brand/VISUAL_IDENTITY.md` §4, P9).
 *
 * The bare olive mark + "FieldLogic" in Inter 700 ink + "HQ" in Inter olive (600 below 18 px, 500 above). The mark is
 * about 1.1 em, centred on the capitals, 0.45 em from the name. One mark at every size. Lime is not in it anywhere.
 *
 * ⚖ EVERY SCREEN DRAWS THE NAME WITH THIS COMPONENT. There used to be ~10 hand-drawn copies of FIELD·LOGIC·HQ (the
 * marketing bar, the footer, the consumer bar and its tournament strip, the admin and coach strips, the two volunteer
 * shells, the platform-admin sign-in, the unsubscribe page), each a little different. The three places that cannot
 * import a component draw the same pieces from `lib/brand-mark.ts` (the offline page, the email name line, the share
 * card); `tests/unit/public-face-s4-identity.test.ts` fails on a second hand-drawn copy or a copy that drifts.
 *
 * The three DOM shapes it absorbs:
 *   • a link home (`href`, default `/discover`, the grammar's Zone 1) — the bars and strips;
 *   • inert text (`href={null}`) — the footer, the volunteer shells, the sign-in and system pages;
 *   • inside a "See it live" demo the link goes inert by itself: whose product this is stays the point, but the
 *     mark stops being a door out to the real platform.
 *
 * `tone` says which ground it sits on: `warm` (paper, always — the marketing set, the volunteer shells), `follow` (the
 * account's Warm / Dark choice — the admin and coach strips, the consumer app's bar), or `mono` (the one-colour lockup
 * in the surface's own text colour, HQ a little dimmer — a dark page, and the public tournament pages' strip, whose
 * light or dark is the organizer's). On Dark the mark and the name take the text colour: olive on the Dark ground fails
 * (about 3:1), so Dark never shows an olive mark.
 */

import Link from 'next/link';
import { useIsSandbox } from '@/components/sandbox/SandboxProvider';
import { BRAND_NAME, BRAND_NAME_HQ, MARK_BARE_VIEWBOX, MARK_PATH_MAIN } from '@/lib/brand-mark';
import styles from './BrandLockup.module.css';

export type BrandLockupTone = 'warm' | 'follow' | 'mono';

export default function BrandLockup({
  href = '/discover',
  size,
  tone = 'follow',
  label = 'FieldLogicHQ home',
  className,
}: {
  /** Where the name leads; `null` draws it as inert text. */
  href?: string | null;
  /** The name's font size in px; the mark and the gap follow it. Omitted, the host's own font-size rule decides (a bar
   *  whose name steps down on a phone), and HQ takes the small-size weight. */
  size?: number;
  tone?: BrandLockupTone;
  /** The link's accessible name. */
  label?: string;
  className?: string;
}) {
  const inSandbox = useIsSandbox();
  const cls = `${styles.lockup} ${styles[tone]} ${className ?? ''}`;
  const inner = (
    <>
      <svg className={styles.mark} viewBox={MARK_BARE_VIEWBOX} aria-hidden="true" focusable="false">
        <path d={MARK_PATH_MAIN} />
      </svg>
      <span className={styles.name}>
        {BRAND_NAME}
        <span className={size !== undefined && size >= 18 ? styles.hq : styles.hqSmall}>{BRAND_NAME_HQ}</span>
      </span>
    </>
  );
  const style = size !== undefined ? { fontSize: `${size}px` } : undefined;

  if (href === null || inSandbox) {
    return <span className={cls} style={style}>{inner}</span>;
  }
  return (
    <Link href={href} className={cls} style={style} aria-label={label}>
      {inner}
    </Link>
  );
}
