import styles from './ChatUnreadBadge.module.css';

/**
 * Shared unread-count pill for the "Chat" nav entries (admin sidebar + both coach portals), so the
 * three surfaces can't drift on colour/shape. Inline (sits at the end of a nav row). Lime on near-
 * black, capped at 9+. Returns nothing when there's nothing unread.
 */
export default function ChatUnreadBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  const label = count > 9 ? '9+' : String(count);
  return (
    <span className={`${styles.badge}${className ? ` ${className}` : ''}`} aria-label={`${label} unread`}>
      {label}
    </span>
  );
}
