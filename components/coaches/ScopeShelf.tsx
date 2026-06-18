import Link from 'next/link';
import { getPlanGatingMap } from '@/lib/plan-gating-server';
import styles from './ScopeShelf.module.css';

/**
 * Per-page feature-education PAGE FOOTER for the FREE Coaches Portal (COACH_PORTAL_GROWTH Phase 1).
 *
 * A quiet, always-present, divider-separated footer zone at the bottom of a Tier-2 section page —
 * never a card, never a dismiss, never a CTA. It names what the paid Premium Coaches Portal adds
 * on THIS surface (+ a whole-team teaser), reassures the free tools stay free, and links to the
 * public explainer (info-first — the "express interest" ask lives on /for-coaches, not here).
 *
 * Owner direction (2026-06-17): a page-footer "tied to the bottom", richer than one line, but
 * non-intrusive. Naming canon (brand Unification Addendum): "Premium Coaches Portal" / "Basic
 * Coaches Portal" — never "Coaches Portal Premium" / "Coach Portal". Only render when the section
 * has real content (the caller gates it).
 */

type Section = 'roster' | 'schedule' | 'fees' | 'announcements';

// Per-section value phrase + a whole-team teaser (de-duped per section so nothing repeats).
const COPY: Record<Section, { value: string; teaser: string }> = {
  roster: {
    value: 'positions, availability, attendance & game lineups',
    teaser: 'plus a season budget and documents for your whole team',
  },
  schedule: {
    value: 'recurring events, attendance & calendar sync',
    teaser: 'plus lineups, a season budget and documents for your whole team',
  },
  fees: {
    value: 'dues schedules with due dates, email reminders & a season budget',
    teaser: 'plus lineups, attendance and documents for your whole team',
  },
  announcements: {
    value: 'scheduled sends, automatic reminders & delivery tracking',
    teaser: 'plus lineups, attendance, a season budget and documents for your whole team',
  },
};

const SECTION_LABEL: Record<Section, string> = {
  roster: 'roster',
  schedule: 'schedule',
  fees: 'fees',
  announcements: 'announcements',
};

export default async function ScopeShelf({ section }: { basicTeamId: string; section: Section }) {
  const copy = COPY[section];
  // The upgrade link follows the SAME server-side checkout gate as /coaches/start: open in dev
  // (team plan ungated) → the real checkout; gated in prod → the info/express-interest explainer.
  // The gate lives in each environment's own DB and fails closed, so a prod deploy can never flip it.
  const checkoutOpen = !(await getPlanGatingMap()).team;
  const href = checkoutOpen
    ? `/coaches/start?source=coach_footer_${section}`
    : `/for-coaches?source=coach_footer_${section}`;
  const linkLabel = checkoutOpen ? 'Upgrade to Premium →' : 'See everything it includes →';
  return (
    <footer className={styles.footer}>
      <p className={styles.footerEyebrow}>Premium Coaches Portal</p>
      <p className={styles.footerBody}>
        On {SECTION_LABEL[section]}: {copy.value} — {copy.teaser}. Your free tools stay free.
      </p>
      <Link href={href} className={styles.footerLink}>{linkLabel}</Link>
    </footer>
  );
}
