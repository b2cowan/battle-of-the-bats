import Link from 'next/link';
import styles from './PublicParts.module.css';

/**
 * A door on the public tournament pages (Public tournament pages Stage 2; the club kit's `row` family, restyled as the
 * hub's `.door`): a label, an optional sub-line, a chevron; 56 px tall, one tap opens it. The after-event Overview's
 * "Final standings" first; later stages' pages reuse it.
 */
export default function PublicDoorRow({ href, label, sub }: { href: string; label: string; sub?: string | null }) {
  return (
    <Link className={styles.door} href={href}>
      <span>
        {label}
        {sub && <span className={styles.doorSub}>{sub}</span>}
      </span>
      <span className={styles.chevron} aria-hidden>›</span>
    </Link>
  );
}
