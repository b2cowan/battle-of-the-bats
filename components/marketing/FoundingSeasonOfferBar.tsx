'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  isFoundingSeasonPromoActive,
  FOUNDING_SEASON_SIGNUP_CLOSE_LABEL,
  FOUNDING_SEASON_YEAR_LABEL,
} from '@/lib/plan-config';
import styles from './FoundingSeasonOfferBar.module.css';

/**
 * The site-wide Founding Season offer bar (Founding Season 2027, owner-approved mockups 2026-09-07,
 * variant A — dark bar, lime type).
 *
 * One line at the very top of every MARKETING page, above the navigation: the promise, the
 * deadline, one link into the pricing page's offer strip. It renders only while the Founding
 * Season SIGNUP window is open and disappears on its own the day it closes — a promo artifact,
 * not permanent chrome (design_decisions 2026-08-08 rule 3).
 *
 * Geometry follows the sandbox banner's mechanism exactly (components/sandbox/SandboxChrome):
 * the bar is `position: fixed`, measures itself, and publishes `--offer-bar-h` + `data-offer-bar`
 * on `<html>`. `app/globals.css` pads the document by that height and the marketing Navbar adds the
 * same var to its own `top`. Off a marketing path the var is never set and every consumer resolves
 * to today's exact geometry.
 *
 * ⚠ Marketing paths ONLY. A customer's public org and tournament pages never carry acquisition
 * chrome (BUSINESS_DECISIONS 2026-08-01), the demo sandbox already owns the top of its viewport,
 * and the consumer / warm-journey / operator shells suppress the marketing Navbar altogether.
 *
 * This allowlist is deliberately a strict SUBSET of the Navbar's own `isMarketingPath` (which
 * also admits /platform, /coaches/join and /my — surfaces that wear the marketing bar but are not
 * acquisition pages). Every segment here is in RESERVED_ORG_SLUGS, so no customer slug can ever
 * collide with it. The subset relationship is what guarantees the bar never renders where the
 * marketing Navbar (which offsets itself by --offer-bar-h) is not the one on screen.
 */
const MARKETING_PATHS = [
  '/',
  '/pricing',
  '/for-tournament-organizers',
  '/for-coaches',
  '/for-leagues',
  '/for-clubs',
  '/demos',
  '/changelog',
] as const;

export function isMarketingSitePath(pathname: string): boolean {
  return MARKETING_PATHS.some(p => pathname === p || (p !== '/' && pathname.startsWith(p + '/')));
}

export default function FoundingSeasonOfferBar() {
  const pathname = usePathname();
  const show = isMarketingSitePath(pathname) && isFoundingSeasonPromoActive('tournament_plus');
  const barRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    const node = barRef.current;
    if (!show || !node) return;
    const root = document.documentElement;
    root.dataset.offerBar = 'true';
    const publish = () => root.style.setProperty('--offer-bar-h', `${node.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(node);
    return () => {
      observer.disconnect();
      delete root.dataset.offerBar;
      root.style.removeProperty('--offer-bar-h');
    };
  }, [show]);

  if (!show) return null;

  return (
    <Link ref={barRef} href="/pricing#founding-season" className={styles.bar} aria-label={`Founding Season: your ${FOUNDING_SEASON_YEAR_LABEL} season, free — sign up by ${FOUNDING_SEASON_SIGNUP_CLOSE_LABEL}. See the offer.`}>
      <span className={styles.eyebrow}>Founding Season</span>
      <span className={styles.sep} aria-hidden="true">·</span>
      <span className={styles.promise}>
        Your {FOUNDING_SEASON_YEAR_LABEL} season, free — sign up by{' '}
        <span className={styles.deadlineFull}>{FOUNDING_SEASON_SIGNUP_CLOSE_LABEL}</span>
        <span className={styles.deadlineShort}>{FOUNDING_SEASON_SIGNUP_CLOSE_LABEL.replace(/,\s*\d{4}$/, '')}</span>
      </span>
      <span className={`${styles.sep} ${styles.sepWide}`} aria-hidden="true">·</span>
      <span className={styles.link}><span className={styles.linkWords}>See the offer </span>→</span>
    </Link>
  );
}
