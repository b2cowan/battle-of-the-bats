import Link from 'next/link';
import styles from '../family.module.css';
import { FAMILY_HOME_WORDS as W } from '@/lib/family-home-words';
import { legalPageHref } from '@/lib/legal-links';
import { legalPagesOn } from '@/lib/legal-pages-switch';
import type { FamilySignupRow } from '@/lib/family-home';

/**
 * The rows the family pages share (Signed-in family accounts Stage 4a, Part 6; drawing tab 3): "Your sign-up" (Paid, or what is
 * owed, opening the in-app sign-up) and the foot — /legal draft (b)'s privacy line and "Connected to {child}" with Manage.
 * Server components: no state, no fetch.
 */

export function SignupRow({ row }: { row: FamilySignupRow }) {
  const sub = row.state.kind === 'withdrawn'
    ? W.signupRow.withdrawn(row.seasonName)
    : W.signupRow.sub(row.seasonName, row.reference, row.childCount);
  return (
    <div className={styles.card}>
      <Link href={row.href} className={`${styles.row} ${styles.rowAnchor}`}>
        <div className={styles.rowMain}>
          <div className={styles.rowTitle}>{W.signupRow.title}</div>
          <div className={styles.rowSub}>{sub}</div>
        </div>
        {row.state.kind === 'paid' && <span className={styles.rowChipOk}>{W.signupRow.paid}</span>}
        {row.state.kind === 'owing' && <span className={styles.rowChipDue}>{W.signupRow.toPay(row.state.cents)}</span>}
        {(row.state.kind === 'withdrawn' || row.state.kind === 'waiting') && <span className={styles.rowLink}>{W.family.open}</span>}
      </Link>
    </div>
  );
}

export interface ConnectedLine { child: string; others: string[]; href: string }

/** /legal draft (b), then who is connected to each child (the second parent by address until they join). */
export function FamilyFoot({ kids, club, connected }: { kids: string[]; club: string; connected: ConnectedLine[] }) {
  // The link follows the legal-pages switch (GST/HST Stage 6 step 6.2): none while the pages are off, never a link to nowhere.
  const privacyHref = legalPagesOn() ? legalPageHref('privacy') : null;
  return (
    <div className={styles.familyFoot}>
      <p>
        {W.team.privacy(kids, club)}
        {privacyHref && (
          <> <a className={styles.rowLink} href={privacyHref}>{W.team.privacyLink}</a></>
        )}
      </p>
      {connected.map(c => (
        <div key={c.href} className={styles.row}>
          <div className={styles.rowMain}>
            <div className={styles.rowSub}>{W.team.connected(c.child, c.others)}</div>
          </div>
          <Link href={c.href} className={styles.rowLink}>{W.team.manage}</Link>
        </div>
      ))}
    </div>
  );
}
