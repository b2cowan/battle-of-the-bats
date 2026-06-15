'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Trophy, Users, LogOut, LayoutGrid, X } from 'lucide-react';
import { signOut } from '@/lib/auth';
import { teamColor } from '@/lib/team-color';
import {
  COACHES_HOME_PATH,
  COACHES_TOURNAMENTS_PATH,
  COACHES_TEAMS_PATH,
  COACHES_TEAM_PATH,
  coachTeamPath,
  isCoachPortalShellPath,
} from '@/lib/coaches-portal-routes';
import FeedbackLauncher from '@/components/feedback/FeedbackLauncher';
import FeedbackRequestIdProvider from '@/components/feedback/FeedbackRequestIdProvider';
import styles from './CoachPortalShell.module.css';

type BasicTeam = { id: string; name: string };

const NAV: Array<{ label: string; href: string; icon: typeof Home; match: (p: string) => boolean }> = [
  { label: 'Home',        href: COACHES_HOME_PATH,        icon: Home,   match: p => p === COACHES_HOME_PATH },
  { label: 'Tournaments', href: COACHES_TOURNAMENTS_PATH, icon: Trophy, match: p => p.startsWith(COACHES_TOURNAMENTS_PATH) },
  {
    label: 'My Teams',
    href: COACHES_TEAMS_PATH,
    icon: Users,
    match: p =>
      p.startsWith(COACHES_TEAMS_PATH) ||
      p === COACHES_TEAM_PATH ||
      p.startsWith(`${COACHES_TEAM_PATH}/`),
  },
];

/**
 * Persistent shell for the authenticated tournament coach portal. On portal routes
 * it renders a desktop left rail (≥1024px) + a mobile top bar and bottom nav; on the
 * signup/marketing coach routes it passes children through untouched (those keep the
 * global marketing chrome). The team list powers the multi-team switcher and is
 * client-synced (absent in raw SSR, appears post-hydration), mirroring the public rail.
 */
export default function CoachPortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const showShell = isCoachPortalShellPath(pathname);

  const [teams, setTeams] = useState<BasicTeam[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [acctOpen, setAcctOpen] = useState(false);
  const acctChipRef = useRef<HTMLButtonElement>(null);
  const acctSheetRef = useRef<HTMLDivElement>(null);
  const [lastPath, setLastPath] = useState(pathname);

  const closeAcct = useCallback(() => setAcctOpen(false), []);

  // Close the account sheet on any route change (the shell persists across soft-nav, so a
  // Back-button / out-of-sheet navigation would otherwise leave it open). Adjusting state
  // during render — React's endorsed pattern for resetting state when a value changes —
  // avoids the cascading re-render of a setState-in-effect.
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (acctOpen) setAcctOpen(false);
  }

  useEffect(() => {
    if (!showShell) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/coaches/basic-teams', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { user?: { email?: string }; teams?: BasicTeam[] };
        if (cancelled) return;
        setEmail(data.user?.email ?? null);
        setTeams(data.teams ?? []);
      } catch {
        /* shell still renders, just without the switcher */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showShell]);

  // Account sheet a11y: move focus into the dialog on open, restore it to the chip on
  // close, and close on Escape. Sibling content is marked `inert` while open (below),
  // which keeps focus trapped inside the modal.
  useEffect(() => {
    if (!acctOpen) return;
    const chip = acctChipRef.current;
    acctSheetRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAcct();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      chip?.focus();
    };
  }, [acctOpen, closeAcct]);

  if (!showShell) return <>{children}</>;

  async function handleSignOut() {
    await signOut();
    router.push('/auth/login');
  }

  const brand = (
    <Link href={COACHES_HOME_PATH} className={styles.brand}>
      <span className={styles.brandMark}>FL</span>
      <span className={styles.brandText}>Coaches Portal</span>
    </Link>
  );

  return (
    <div className={styles.shell}>
      <FeedbackRequestIdProvider />
      {/* Desktop left rail (≥1024px) */}
      <aside className={styles.rail} aria-label="Coaches Portal">
        <div className={styles.railHeader}>
          {brand}
          {email && <p className={styles.railEmail} title={email}>{email}</p>}
        </div>

        <nav className={styles.railNav} aria-label="Coaches Portal sections">
          {NAV.map(({ label, href, icon: Icon, match }) => (
            <Link
              key={href}
              href={href}
              className={`${styles.railLink}${match(pathname) ? ` ${styles.railLinkActive}` : ''}`}
              aria-current={match(pathname) ? 'page' : undefined}
            >
              <Icon size={16} aria-hidden />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        {teams.length > 0 && (
          <div className={styles.railTeams}>
            <p className={styles.railTeamsLabel}>My Teams</p>
            {teams.map(team => (
              <Link key={team.id} href={coachTeamPath(team.id)} className={styles.railTeam}>
                <span className={styles.railTeamDot} style={{ background: teamColor(team.name) }} aria-hidden />
                <span className={styles.railTeamName}>{team.name}</span>
              </Link>
            ))}
          </div>
        )}

        <div className={styles.railFooter}>
          <FeedbackLauncher className={styles.railSignOut} label="Send feedback" iconSize={14} />
          <Link href="/home" className={styles.railSignOut}>
            <LayoutGrid size={14} aria-hidden />
            <span>All workspaces</span>
          </Link>
          <button type="button" className={styles.railSignOut} onClick={handleSignOut}>
            <LogOut size={14} aria-hidden />
            <span>Sign out</span>
          </button>
          <span className={styles.railLive}>Live on FieldLogicHQ</span>
        </div>
      </aside>

      {/* Mobile top bar (≤1023px) */}
      <header className={styles.topbar}>
        {brand}
        <button
          ref={acctChipRef}
          type="button"
          className={styles.acctChip}
          style={{ marginLeft: 'auto' }}
          onClick={() => setAcctOpen(true)}
          aria-label="Account menu"
          aria-haspopup="dialog"
          aria-expanded={acctOpen}
        >
          {(email?.trim()[0] ?? '?').toUpperCase()}
        </button>
      </header>

      {/* Mobile account bottom-sheet (≤1023px) */}
      {acctOpen && (
        <div
          className={styles.sheetOverlay}
          role="presentation"
          onClick={closeAcct}
        >
          <div
            ref={acctSheetRef}
            className={styles.sheet}
            role="dialog"
            aria-modal="true"
            aria-label="Account"
            tabIndex={-1}
            onClick={e => e.stopPropagation()}
          >
            {email && (
              <p className={styles.sheetEmail} title={email}>{email}</p>
            )}
            <Link href="/home" className={styles.sheetItem} onClick={closeAcct}>
              <LayoutGrid size={16} aria-hidden />
              <span>All workspaces</span>
            </Link>
            <FeedbackLauncher className={styles.sheetItem} label="Send feedback" iconSize={16} />
            <button
              type="button"
              className={styles.sheetItem}
              onClick={() => {
                closeAcct();
                handleSignOut();
              }}
            >
              <LogOut size={16} aria-hidden />
              <span>Sign out</span>
            </button>
            <button
              type="button"
              className={styles.sheetItem}
              onClick={closeAcct}
            >
              <X size={16} aria-hidden />
              <span>Close</span>
            </button>
          </div>
        </div>
      )}

      <div className={styles.content} inert={acctOpen ? true : undefined}>{children}</div>

      {/* Mobile bottom nav (≤1023px) */}
      <nav className={styles.bottomNav} aria-label="Coaches Portal" inert={acctOpen ? true : undefined}>
        {NAV.map(({ label, href, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              className={`${styles.bottomTab}${active ? ` ${styles.bottomTabActive}` : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 1.8} aria-hidden />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
