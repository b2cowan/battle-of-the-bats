'use client';

/**
 * Discovery & Orientation (help Layer 3, Phase 5b) — "What everyone else sees".
 *
 * A collapsible dashboard panel that shows a first-time organizer the experience
 * their tournament creates for the three audiences it serves. Anti-overwhelm:
 * it auto-opens once on a first-time DRAFT dashboard, then stays collapsed on
 * every later visit (state remembered per tournament). Each card links to the
 * real surface that audience uses.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, ChevronDown, ChevronUp } from 'lucide-react';
import { hasPlanFeature } from '@/lib/plan-features';
import type { OrgPlan } from '@/lib/types';
import styles from './PersonaPanel.module.css';

const NEW_TAB = { target: '_blank', rel: 'noopener noreferrer' } as const;

export default function PersonaPanel({
  orgSlug,
  tournamentSlug,
  tournamentId,
  planId,
  isDraft,
}: {
  orgSlug: string;
  tournamentSlug?: string | null;
  tournamentId: string;
  planId: OrgPlan;
  isDraft: boolean;
}) {
  const storageKey = `flhq-help-persona-${tournamentId}`;
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // SSR-safe: server renders collapsed; after mount, restore the saved state, or
  // auto-open the first time on a draft dashboard.
  useEffect(() => {
    let initial = isDraft;
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
      if (stored === 'open') initial = true;
      else if (stored === 'closed') initial = false;
    } catch {
      /* localStorage blocked — fall back to the first-visit default */
    }
    setOpen(initial);
    setHydrated(true);
  }, [storageKey, isDraft]);

  function toggle() {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(storageKey, next ? 'open' : 'closed');
    } catch {
      /* ignore */
    }
  }

  const base = `/${orgSlug}/admin/tournaments`;
  const previewHref = tournamentSlug
    ? (isDraft ? `${base}/preview/${tournamentSlug}` : `/${orgSlug}/${tournamentSlug}`)
    : undefined;
  const registerHref = tournamentSlug ? `/${orgSlug}/${tournamentSlug}/register` : undefined;
  const staffKitHref = `${base}/staff-kit`;
  const hasFanAlerts = hasPlanFeature(planId, 'fan_score_alerts');

  return (
    <section className={styles.panel} aria-label="What everyone else sees">
      <button type="button" className={styles.head} aria-expanded={open} onClick={toggle}>
        <span className={styles.headLeft}>
          <Users size={15} aria-hidden /> What everyone else sees
        </span>
        {open ? <ChevronUp size={15} aria-hidden /> : <ChevronDown size={15} aria-hidden />}
      </button>

      {hydrated && open && (
        <div className={styles.bodyWrap}>
          <div className={styles.cols}>
            <div className={styles.col}>
              <h3 className={styles.colTitle}>Parents &amp; Fans</h3>
              <p className={styles.colDesc}>
                Your public site with schedule, results, standings, and news
                {hasFanAlerts
                  ? ', plus a fan app with live scores and push alerts.'
                  : ' — plus a fan app with live scores (push alerts on Tournament Plus).'}
              </p>
              <span className={styles.when}>From the moment you activate</span>
              {previewHref && (
                <Link href={previewHref} className={styles.link} {...NEW_TAB}>
                  {isDraft ? 'Preview site' : 'View public site'} →
                </Link>
              )}
            </div>

            <div className={styles.col}>
              <h3 className={styles.colTitle}>Coaches &amp; Teams</h3>
              <p className={styles.colDesc}>The registration form and your public schedule. No admin access.</p>
              <span className={styles.when}>From the moment you activate</span>
              {registerHref && (
                <Link href={registerHref} className={styles.link} {...NEW_TAB}>
                  Preview registration →
                </Link>
              )}
            </div>

            <div className={styles.col}>
              <h3 className={styles.colTitle}>Scorekeepers &amp; Volunteers</h3>
              <p className={styles.colDesc}>
                A phone-friendly scoring screen — today’s games only, nothing else in your admin. Gate volunteers run
                check-in from a separate board.
              </p>
              <span className={styles.when}>When you hand off access</span>
              <Link href={staffKitHref} className={styles.link}>
                See Staff Kit →
              </Link>
            </div>
          </div>
          <p className={styles.foot}>This is the journey your tournament creates for everyone involved.</p>
        </div>
      )}
    </section>
  );
}
