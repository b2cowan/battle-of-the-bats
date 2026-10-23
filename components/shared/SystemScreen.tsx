import type { ReactNode } from 'react';
import Link from 'next/link';
import BrandLockup from '@/components/shared/BrandLockup';
import styles from './SystemScreen.module.css';

/**
 * THE SYSTEM-SCREEN FAMILY (The public face, warm: S5). One small line-icon tile, a plain headline, one sentence, one
 * obvious next step and the name at the foot. The 404, the page crash, the unsubscribe confirmation and the suspended
 * page wear it. The root-layout crash (`app/global-error.tsx`) and the offline page (`public/offline.html`) draw the same
 * look by hand, because a dead layout and a page with no network cannot import it.
 *
 * `surface` is the ground: `follow` is the account's Warm / Dark setting (warm for everyone signed out), `warm` is paper
 * always, `inline` has no ground and no name at the foot (it sits inside a shell that already has both). The wording is the caller's; this file
 * holds no sentence.
 */

export type SystemIcon = 'broken' | 'alert' | 'mail' | 'pause';

// The line icons, on the 24 grid (the offline page's tile is the origin; it and the root crash draw their own).
const ICONS: Record<SystemIcon, ReactNode> = {
  broken: (
    <>
      <path d="M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.71 1.72" />
      <path d="M5.17 11.75l-1.71 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      <line x1="8" y1="2" x2="8" y2="5" />
      <line x1="2" y1="8" x2="5" y2="8" />
      <line x1="16" y1="19" x2="16" y2="22" />
      <line x1="19" y1="16" x2="22" y2="16" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </>
  ),
  mail: (
    <>
      <path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      <path d="m16 19 2 2 4-4" />
    </>
  ),
  pause: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </>
  ),
};

export default function SystemScreen({
  icon,
  eyebrow,
  title,
  children,
  notes,
  actions,
  afterActions,
  devDetail,
  surface = 'follow',
  legal,
  wide = false,
}: {
  icon: SystemIcon;
  eyebrow?: string;
  title: string;
  /** The one sentence. */
  children: ReactNode;
  /** Quieter lines under it, one paragraph each. */
  notes?: ReactNode[];
  /** The buttons: at most one `SystemAction kind="primary"`. */
  actions?: ReactNode;
  /** A quiet line under the buttons (the suspended page's "Signed in as"). */
  afterActions?: ReactNode;
  /** The raw error message, shown in development only. */
  devDetail?: string;
  surface?: 'follow' | 'warm' | 'inline';
  /** A quiet line at the very bottom of the page (never beside the name). */
  legal?: ReactNode;
  /** A wider measure for a long sentence. */
  wide?: boolean;
}) {
  const ground = surface === 'follow' ? styles.pageFollow : surface === 'warm' ? styles.pageWarm : styles.inline;
  return (
    <div className={ground}>
      <div className={styles.stack}>
        <div className={styles.tile} aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">{ICONS[icon]}</svg>
        </div>
        {eyebrow && <div className={styles.eyebrow}>{eyebrow}</div>}
        <h1 className={styles.title}>{title}</h1>
        <p className={`${styles.body} ${wide ? styles.bodyWide : ''}`}>{children}</p>
        {notes?.map((n, i) => <p key={i} className={styles.note}>{n}</p>)}
        {devDetail && <pre className={styles.dev}>{devDetail}</pre>}
        {actions && <div className={styles.actions}>{actions}</div>}
        {afterActions && <p className={styles.note}>{afterActions}</p>}
        {surface !== 'inline' && (
          <div className={styles.foot}>
            <BrandLockup href={null} size={15} tone={surface === 'warm' ? 'warm' : 'follow'} />
          </div>
        )}
      </div>
      {legal && <p className={styles.legal}>{legal}</p>}
    </div>
  );
}

/** A button or a link in the family's face. `primary` is the view's one lime button; `secondary` is the quiet one. */
export function SystemAction({
  kind,
  href,
  onClick,
  disabled,
  children,
}: {
  kind: 'primary' | 'secondary';
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  const cls = `${styles.btn} ${kind === 'primary' ? styles.primary : styles.secondary}`;
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return <button type="button" className={cls} onClick={onClick} disabled={disabled}>{children}</button>;
}
