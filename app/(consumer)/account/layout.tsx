import { getAuthUserCached } from '@/lib/supabase-server';
import warm from '@/components/consumer/warmTheme.module.css';
import AccountRail from './AccountRail';
import AccountReturnBar from './AccountReturnBar';
import styles from './account.module.css';

/**
 * Account settings shell (Desktop Phase 2). One wrapper for every /account/* route:
 * on desktop (≥1024px) it renders the "Account" heading plus the two-column frame —
 * section rail left, the route's content right. Below 1024px the rail and heading
 * don't exist and each route renders its stacked page exactly as before.
 *
 * This layout is the ONE owner of the warm paper ground for the whole /account
 * space (the routes' own wrappers came off in the same change) — the full-bleed
 * `.warmTab` ancestor is what keeps the dark shell from ever showing beside a
 * width-capped column, the recurring Phase 1 seam bug.
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUserCached();

  return (
    <div className={`${warm.warmTab} ${styles.accountFill}`}>
      {/* Way home for a coach/admin who arrived through the strip's account menu — renders
          nothing for everyone else (COACH_ACCOUNT_MENU_PLAN.md). */}
      <AccountReturnBar />
      <div className={styles.settingsCol}>
        <h1 className={styles.desktopTitle}>Account</h1>
        <div className={styles.settingsGrid}>
          <AccountRail signedIn={!!user?.email} />
          <div className={styles.paneCol}>{children}</div>
        </div>
      </div>
    </div>
  );
}
