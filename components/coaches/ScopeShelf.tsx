import Link from 'next/link';
import { getPlanGatingMap } from '@/lib/plan-gating-server';
import { isFoundingSeasonPromoActive } from '@/lib/plan-config';
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

type ContentSection = 'roster' | 'schedule' | 'fees' | 'announcements';
/** 'overview' (conversion sweep C4) = the team-level catch-all on the Overview page —
 *  one whole-team line instead of a per-section value phrase. Same shelf, same gate. */
type Section = ContentSection | 'overview';

// Per-section value phrase + a whole-team teaser (de-duped per section so nothing repeats).
const COPY: Record<ContentSection, { value: string; teaser: string }> = {
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

const SECTION_LABEL: Record<ContentSection, string> = {
  roster: 'roster',
  schedule: 'schedule',
  fees: 'fees',
  announcements: 'announcements',
};

export default async function ScopeShelf({ basicTeamId, section }: { basicTeamId: string; section: Section }) {
  // The upgrade link follows the SAME server-side checkout gate as /coaches/start: open in dev
  // (team plan ungated) → the real checkout; gated in prod → the info/express-interest explainer.
  // The gate lives in each environment's own DB and fails closed, so a prod deploy can never flip it.
  // Forward the originating free team so the signup can pre-fill it and (Phase 2+) carry its data over.
  const checkoutOpen = !(await getPlanGatingMap()).team;
  const promoActive = isFoundingSeasonPromoActive('team');
  const href = checkoutOpen
    ? `/coaches/start?source=coach_footer_${section}&basicTeamId=${encodeURIComponent(basicTeamId)}`
    : `/for-coaches?source=coach_footer_${section}`;
  const linkLabel = checkoutOpen
    ? (promoActive ? 'Upgrade to Premium — free →' : 'Upgrade to Premium →')
    : 'See everything it includes →';
  return (
    <footer className={styles.footer}>
      <p className={styles.footerEyebrow}>Premium Coaches Portal</p>
      <p className={styles.footerBody}>
        {section === 'overview' ? (
          <>For this team: game lineups, attendance, dues automation, documents &amp; a season budget.</>
        ) : (
          <>On {SECTION_LABEL[section]}: {COPY[section].value} — {COPY[section].teaser}.</>
        )}
        {/* Price stated before the tap on every pitch surface (conversion sweep C3). */}
        {' '}Your free tools stay free. {promoActive
          ? 'Premium is free until Jan 1, 2027 — then $29/month per team.'
          : 'Premium is $29/month per team.'}
      </p>
      <Link href={href} className={styles.footerLink}>{linkLabel}</Link>
    </footer>
  );
}
