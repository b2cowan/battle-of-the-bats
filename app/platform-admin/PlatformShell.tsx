'use client';
/**
 * The support console's frame — the product's top strip, its rail and the page's ground (Support console Stage 1,
 * owner 2026-10-24; `docs/agents/design/NAV_STANDARD.md`). Everything a console screen sits inside, drawn once.
 *
 * ⚖ What the strip carries, and what it deliberately does not:
 *   • the FieldLogicHQ name (`BrandLockup`, the colour that follows Warm / Dark), the portal's name, and the account menu
 *     with Appearance — the same three the club admin's strip carries, from the same parts;
 *   • NO bell: the console has no notifications behind it, and absent beats disabled;
 *   • FIND in the middle (Stage 2, `FindBox`): one box, opened with /, searching every club and person on the server — and
 *     Stripe numbers for the roles that hold `find_stripe`. Below 900 it is its glyph, beside the account menu;
 *   • the wordmark leads to the console's own front door, never out to the customer product (the console is a different
 *     product for a different audience).
 * Below 900 the rail gives way to a menu button in the strip that opens the SAME menu as a panel over the page. The panel
 * stands on the repo's dialog floor (`useDialogFloor`): Escape closes it, Tab stays inside, focus returns to the menu button,
 * and the phone's Back gesture closes it instead of leaving the page.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import AccountMenu from '@/components/shared/AccountMenu';
import BrandLockup from '@/components/shared/BrandLockup';
import { useDialogFloor } from '@/components/coaches/useDialogFloor';
import { PLATFORM_PORTAL_LABEL } from '@/lib/workspace-labels';
import type { PlatformRole } from '@/lib/platform-auth';
import PlatformAdminNav, { PlatformNavBody, useWaitingCounts } from './PlatformAdminNav';
import FindBox from './FindBox';
import { hasPlatformPower } from '@/lib/platform-areas';
import stripStyles from '@/components/coaches/CoachTopStrip.module.css';
import styles from './platform-admin.module.css';

export default function PlatformShell({ role, canBookkeep, children }: {
  role: PlatformRole;
  canBookkeep: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeMenu = () => setMenuOpen(false);
  // One reader of the menu's waiting counts for both menus (the rail and the narrow-width panel).
  const counts = useWaitingCounts();
  useDialogFloor(menuOpen, drawerRef, { onClose: closeMenu, opener: menuBtnRef });

  // The panel closes on any route change — persistent chrome, so Back / Forward would otherwise leave it over the new page
  // (the account menu's own lastPath pattern, never setState-in-effect).
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMenuOpen(false);
  }

  // The panel is a narrow-window piece (the rail takes over above 900): crossing that line with it open closes it, so the floor's
  // Tab trap and Back step never outlive a panel the stylesheet has hidden.
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 901px)');
    const onChange = (e: MediaQueryListEvent) => { if (e.matches) setMenuOpen(false); };
    wide.addEventListener('change', onChange);
    return () => wide.removeEventListener('change', onChange);
  }, []);

  return (
    <div className={styles.shell}>
      <header className={styles.strip}>
        <button
          type="button"
          className={styles.menuBtn}
          onClick={() => setMenuOpen(true)}
          aria-label="Menu"
          aria-expanded={menuOpen}
          ref={menuBtnRef}
        >
          <Menu size={20} aria-hidden />
        </button>
        <BrandLockup href="/platform-admin" tone="follow" size={15} label={`${PLATFORM_PORTAL_LABEL} home`} />
        <span className={stripStyles.stripDivider} aria-hidden />
        <span className={stripStyles.stripLabel}>{PLATFORM_PORTAL_LABEL}</span>
        <FindBox searchesStripe={hasPlatformPower(role, 'find_stripe')} />
        <div className={stripStyles.doors}>
          <AccountMenu
            className={stripStyles.iconDoor}
            warm
            showTheme
            showFeedback={false}
            showAccount={false}
            signOutTo="platform"
          />
        </div>
      </header>
      <PlatformAdminNav role={role} canBookkeep={canBookkeep} counts={counts} />
      {menuOpen && (
        <>
          <div className={styles.scrim} onClick={closeMenu} aria-hidden />
          <div className={styles.drawer} ref={drawerRef} role="dialog" aria-modal="true" aria-label="Support console menu" tabIndex={-1}>
            <div className={styles.drawerHead}>
              <BrandLockup href={null} tone="follow" size={15} />
              <button type="button" className={styles.drawerClose} onClick={closeMenu} aria-label="Close menu">
                <X size={20} aria-hidden />
              </button>
            </div>
            <nav className={styles.drawerScroll} aria-label="Support console navigation">
              <PlatformNavBody role={role} canBookkeep={canBookkeep} counts={counts} variant="drawer" onNavigate={closeMenu} />
            </nav>
          </div>
        </>
      )}
      <main className={styles.main}>
        <div className={styles.mainPad}>
          <div className={styles.content}>{children}</div>
        </div>
      </main>
    </div>
  );
}
