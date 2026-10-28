import Link from 'next/link';
import styles from './PublicParts.module.css';

/**
 * A section's heading on the public tournament pages (Public tournament pages Stage 2, hub "The end state"): its name,
 * an optional count ("Live now 2"), and an optional door on the right ("Full schedule", "All results") — in the drawing
 * these are the heading's own link, not a row under the list. 44 px tall link, 16 px heading.
 */
export default function PublicSectionHead({ title, count, link, id }: {
  title: string;
  count?: number;
  link?: { href: string; label: string };
  /** The heading's id, for a section's `aria-labelledby`. */
  id?: string;
}) {
  return (
    <div className={styles.head}>
      <h2 className={styles.headTitle} id={id}>
        {title}
        {count != null && <span className={styles.count}>{count}</span>}
      </h2>
      {link && <Link className={styles.headLink} href={link.href}>{link.label}</Link>}
    </div>
  );
}
