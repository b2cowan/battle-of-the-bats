import ConsumerNav from '@/components/consumer/ConsumerNav';
import styles from '@/components/consumer/ConsumerShell.module.css';
import { createClient } from '@/lib/supabase-server';

/**
 * Consumer shell layout (unified-app Phase 1). Wraps the logged-out front door —
 * the directory and its Scores / Following / Account siblings — in one app-like
 * shell. The marketing Navbar and Footer are suppressed on these routes (see
 * SiteChrome / Footer, keyed off lib/consumer-routes) so this shell owns the chrome.
 *
 * We resolve sign-in state here only to label the desktop header's utility link
 * ("Sign in" vs "Your workspaces"); anonymous visitors (and crawlers) render the
 * public front door exactly the same either way.
 */
export default async function ConsumerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className={styles.shell}>
      <ConsumerNav signedIn={!!user?.email} />
      <div className={styles.content}>{children}</div>
    </div>
  );
}
