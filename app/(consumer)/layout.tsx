import ConsumerNav from '@/components/consumer/ConsumerNav';
import styles from '@/components/consumer/ConsumerShell.module.css';

/**
 * Consumer shell layout (unified-app Phase 1). Wraps the logged-out front door —
 * the directory and its Scores / Following / Account siblings — in one app-like
 * shell. The marketing Navbar and Footer are suppressed on these routes (see
 * SiteChrome / Footer, keyed off lib/consumer-routes) so this shell owns the chrome.
 */
export default function ConsumerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <ConsumerNav />
      <div className={styles.content}>{children}</div>
    </div>
  );
}
