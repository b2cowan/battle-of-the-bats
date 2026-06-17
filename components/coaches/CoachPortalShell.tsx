'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home, Trophy, Users, CalendarClock, CircleDollarSign, Megaphone,
  Compass, LogOut, LayoutGrid, X, MoreHorizontal, ChevronRight, ChevronDown,
} from 'lucide-react';
import { signOut } from '@/lib/auth';
import { teamColor } from '@/lib/team-color';
import {
  COACHES_HOME_PATH,
  COACHES_TEAM_PATH,
  coachTeamPath,
  isCoachPortalShellPath,
} from '@/lib/coaches-portal-routes';
import FeedbackLauncher from '@/components/feedback/FeedbackLauncher';
import FeedbackRequestIdProvider from '@/components/feedback/FeedbackRequestIdProvider';
import styles from './CoachPortalShell.module.css';

/** Rich per-team context from /api/coaches/basic-teams?context=1 (lib/basic-coach-teams CoachTeamContext). */
type TeamContext = {
  id: string;
  name: string;
  activatedFeatures: string[];
  lifecycle: { state: string; label: string; rank: number } | null;
  registrationIds: string[];
};

/** Tier-1 sections — always visible (tournament participant lens). */
const TIER1 = [
  { key: 'overview', label: 'Overview', icon: Home, sub: '' },
  { key: 'tournaments', label: 'Tournaments', icon: Trophy, sub: '/tournaments' },
] as const;

/** Tier-2 sections — shown only when the coach has turned them on (activatedFeatures). */
const TIER2 = [
  { key: 'roster', label: 'Roster', icon: Users, sub: '/roster' },
  { key: 'schedule', label: 'Schedule', icon: CalendarClock, sub: '/schedule' },
  { key: 'fees', label: 'Fees', icon: CircleDollarSign, sub: '/fees' },
  { key: 'announcements', label: 'Announcements', icon: Megaphone, sub: '/announcements' },
] as const;

/** Lifecycle chip → colour token class (live/game-day = lime accent, else muted). */
function chipClass(state: string | undefined): string {
  if (state === 'live' || state === 'game_day') return styles.teamChipLive;
  return styles.teamChip;
}

/**
 * Persistent shell for the authenticated, org-less tournament Coaches Portal. TEAM-SCOPED:
 * the rail leads with the coach's team (name + lifecycle chip when one; a switcher when >1),
 * and the nav below is that team's sections — Tier-1 (Overview / Tournaments) always, Tier-2
 * (Roster / Schedule / Fees / Announcements) only once the coach activates them (progressive
 * disclosure; see COACH_NAV_REBUILD_PLAN.md). An always-present "Explore" link is the
 * permanent rediscovery door. Team context is client-synced (absent in raw SSR, appears
 * post-hydration). On signup/marketing coach routes the shell passes children through untouched.
 */
export default function CoachPortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const showShell = isCoachPortalShellPath(pathname);

  const [teamContexts, setTeamContexts] = useState<TeamContext[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  // The mobile "More" overflow sheet (team switcher + overflow sections + account utilities).
  const [moreOpen, setMoreOpen] = useState(false);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const moreSheetRef = useRef<HTMLDivElement>(null);
  const [lastPath, setLastPath] = useState(pathname);

  const closeMore = useCallback(() => setMoreOpen(false), []);

  // Close the More sheet on any route change (the shell persists across soft-nav).
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (moreOpen) setMoreOpen(false);
  }

  // Re-sync the team context on mount AND on every shell route change. The shell is a
  // persistent client component (it survives soft-nav), so a one-time fetch would go stale
  // the moment the coach activates a Tier-2 feature — the new section wouldn't appear in the
  // nav until a hard refresh. Re-fetching on pathname change picks up `activated_features`
  // writes immediately (the catalog's "Turn on" navigates the coach, which triggers this).
  // The fetch is lightweight + `no-store`; gated on `showShell` so non-portal routes skip it.
  useEffect(() => {
    if (!showShell) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/coaches/basic-teams?context=1', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { user?: { email?: string }; teamContexts?: TeamContext[] };
        if (cancelled) return;
        setEmail(data.user?.email ?? null);
        setTeamContexts(data.teamContexts ?? []);
      } catch {
        /* shell still renders, just without the team switcher */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showShell, pathname]);

  // More sheet a11y: focus in on open, restore on close, Escape to close.
  useEffect(() => {
    if (!moreOpen) return;
    const btn = moreBtnRef.current;
    moreSheetRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMore();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      btn?.focus();
    };
  }, [moreOpen, closeMore]);

  if (!showShell) return <>{children}</>;

  async function handleSignOut() {
    await signOut();
    router.push('/auth/login');
  }

  // ── Resolve the "current team" from the pathname ──
  //   /coaches/team/{id}[/section]      → that team directly
  //   /coaches/tournaments/{regId}      → the team whose registrationIds includes regId
  //   /coaches, /coaches/tournaments    → no specific team (portal-level)
  let currentTeam: TeamContext | null = null;
  const teamMatch = pathname.match(/^\/coaches\/team\/([^/]+)/);
  if (teamMatch) {
    currentTeam = teamContexts.find(t => t.id === teamMatch[1]) ?? null;
  } else {
    const regMatch = pathname.match(/^\/coaches\/tournaments\/([^/]+)/);
    if (regMatch) {
      currentTeam = teamContexts.find(t => t.registrationIds.includes(regMatch[1])) ?? null;
    }
  }
  // Single-team coaches: the rail always reflects their one team even on portal-level pages.
  if (!currentTeam && teamContexts.length === 1) currentTeam = teamContexts[0];

  const multiTeam = teamContexts.length > 1;

  const brand = (
    <Link href={currentTeam ? coachTeamPath(currentTeam.id) : COACHES_HOME_PATH} className={styles.brand}>
      <span className={styles.brandMark}>FL</span>
      <span className={styles.brandLockup}>
        <span className={styles.brandText}>Coaches Portal</span>
        <span className={styles.brandSub}>Your team, every tournament</span>
      </span>
    </Link>
  );

  // ── Section links for the current team (Tier-1 always; Tier-2 only if activated) ──
  function sectionHref(team: TeamContext, sub: string) {
    return `${COACHES_TEAM_PATH}/${team.id}${sub}`;
  }
  function sectionActive(team: TeamContext, sub: string) {
    const base = `${COACHES_TEAM_PATH}/${team.id}`;
    if (sub === '') {
      // Overview is active on the bare team path AND on a tournament-record page for a
      // registration that belongs to THIS team (not just any /coaches/tournaments/ path —
      // that would wrongly light up Overview for another team's record).
      if (pathname === base) return true;
      const reg = pathname.match(/^\/coaches\/tournaments\/([^/]+)/)?.[1];
      return Boolean(reg && team.registrationIds.includes(reg));
    }
    return pathname.startsWith(`${base}${sub}`);
  }

  // One ordered section list (Tier-1 + activated Tier-2 + Explore). Both the desktop rail
  // and the mobile bottom nav slice from this so they can never disagree on what exists.
  type Section = { key: string; label: string; icon: typeof Home; sub: string };
  const sections: Section[] = currentTeam
    ? [
        ...TIER1.map(s => ({ ...s })),
        ...TIER2.filter(s => currentTeam!.activatedFeatures.includes(s.key)).map(s => ({ ...s })),
        { key: 'explore', label: 'Explore', icon: Compass, sub: '/explore' },
      ]
    : [];

  const sectionNav = currentTeam && (
    <nav className={styles.railNav} aria-label="Team sections">
      {sections
        .filter(s => s.key !== 'explore') // Explore lives in the rail footer, not the section list
        .map(({ key, label, icon: Icon, sub }) => (
          <Link
            key={key}
            href={sectionHref(currentTeam!, sub)}
            className={`${styles.railLink}${sectionActive(currentTeam!, sub) ? ` ${styles.railLinkActive}` : ''}`}
            aria-current={sectionActive(currentTeam!, sub) ? 'page' : undefined}
          >
            <Icon size={16} aria-hidden /><span>{label}</span>
          </Link>
        ))}
    </nav>
  );

  // ── Team context block: name + chip (1 team) or a switcher (>1) ──
  const teamContextBlock = currentTeam && (
    <div className={styles.teamContext}>
      {multiTeam ? (
        <select
          className={styles.teamSelect}
          value={currentTeam.id}
          onChange={e => router.push(coachTeamPath(e.target.value))}
          aria-label="Switch team"
        >
          {teamContexts.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      ) : (
        <div className={styles.teamContextHead}>
          <span className={styles.teamDot} style={{ background: teamColor(currentTeam.name) }} aria-hidden />
          <span className={styles.teamName}>{currentTeam.name}</span>
        </div>
      )}
      {currentTeam.lifecycle && (
        <span className={chipClass(currentTeam.lifecycle.state)}>
          {(currentTeam.lifecycle.state === 'live' || currentTeam.lifecycle.state === 'game_day') && (
            <span className={styles.teamChipDot} aria-hidden />
          )}
          {currentTeam.lifecycle.label}
        </span>
      )}
    </div>
  );

  const exploreActive = Boolean(currentTeam && pathname.startsWith(`${COACHES_TEAM_PATH}/${currentTeam.id}/explore`));

  // Mobile bottom-nav budget: 4 primary section tabs + a 5th "More" tab. Anything past the
  // first 4 sections (incl. Explore) overflows into the More sheet, so every section stays
  // reachable no matter how many Tier-2 features the coach has activated.
  const primarySections = sections.slice(0, 4);
  const overflowSections = sections.slice(4);
  const moreActive = Boolean(currentTeam && overflowSections.some(s => sectionActive(currentTeam!, s.sub)));

  return (
    <div className={styles.shell}>
      <FeedbackRequestIdProvider />
      {/* Desktop left rail (≥1024px) */}
      <aside className={styles.rail} aria-label="Coaches Portal">
        <div className={styles.railHeader}>
          {brand}
          {email && <p className={styles.railEmail} title={email}>{email}</p>}
        </div>

        {teamContextBlock}
        {sectionNav}

        {/* Zero-team coaches: a single CTA instead of an empty switcher/nav. */}
        {teamContexts.length === 0 && (
          <Link href={COACHES_HOME_PATH} className={styles.railLink}>
            <Home size={16} aria-hidden /><span>Get started</span>
          </Link>
        )}

        <div className={styles.railFooter}>
          {currentTeam && (
            <Link
              href={`${COACHES_TEAM_PATH}/${currentTeam.id}/explore`}
              className={`${styles.railFooterLink}${exploreActive ? ` ${styles.railLinkActive}` : ''}`}
            >
              <Compass size={14} aria-hidden /><span>Explore</span>
            </Link>
          )}
          <FeedbackLauncher className={styles.railFooterLink} label="Send feedback" iconSize={14} />
          <Link href="/home?pick=1" className={styles.railFooterLink}>
            <LayoutGrid size={14} aria-hidden /><span>All workspaces</span>
          </Link>
          <button type="button" className={styles.railFooterLink} onClick={handleSignOut}>
            <LogOut size={14} aria-hidden /><span>Sign out</span>
          </button>
          <span className={styles.railLive}>Live on FieldLogicHQ</span>
        </div>
      </aside>

      {/* Mobile top bar (≤1023px) — TEAM-FIRST context strip (no brand wordmark, no account
          chip; account + switcher live in the "More" sheet on the bottom nav). */}
      <header className={styles.topbar}>
        <Link href={currentTeam ? coachTeamPath(currentTeam.id) : COACHES_HOME_PATH} className={styles.topbarMark} aria-label="Coaches Portal home">
          <span className={styles.brandMark}>FL</span>
        </Link>
        {currentTeam ? (
          <div className={styles.topbarTeam}>
            <span className={styles.topbarTeamDot} style={{ background: teamColor(currentTeam.name) }} aria-hidden />
            <span className={styles.topbarTeamName}>{currentTeam.name}</span>
            {currentTeam.lifecycle && (
              <span className={chipClass(currentTeam.lifecycle.state)}>
                {(currentTeam.lifecycle.state === 'live' || currentTeam.lifecycle.state === 'game_day') && (
                  <span className={styles.teamChipDot} aria-hidden />
                )}
                {currentTeam.lifecycle.label}
              </span>
            )}
          </div>
        ) : (
          <span className={styles.topbarTeamName}>Coaches Portal</span>
        )}
      </header>

      <div className={styles.content} inert={moreOpen ? true : undefined}>{children}</div>

      {/* Mobile bottom nav (≤1023px): 4 primary section tabs + a "More" overflow tab that holds
          the team switcher, any overflow sections, and account utilities (mirrors AdminBottomNav). */}
      <nav className={styles.bottomNav} aria-label="Coaches Portal">
        {currentTeam ? (
          <>
            {primarySections.map(({ key, label, icon: Icon, sub }) => {
              const active = sectionActive(currentTeam!, sub);
              return (
                <Link
                  key={key}
                  href={sectionHref(currentTeam!, sub)}
                  className={`${styles.bottomTab}${active ? ` ${styles.bottomTabActive}` : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon size={20} strokeWidth={active ? 2.4 : 1.8} aria-hidden /><span>{label}</span>
                </Link>
              );
            })}

            {/* "More" — overflow home: switcher + overflow sections + account utilities. */}
            <button
              ref={moreBtnRef}
              type="button"
              className={`${styles.bottomTab}${(moreOpen || moreActive) ? ` ${styles.bottomTabActive}` : ''}`}
              onClick={() => setMoreOpen(o => !o)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
            >
              {moreOpen
                ? <X size={20} strokeWidth={2} aria-hidden />
                : <MoreHorizontal size={20} strokeWidth={moreActive ? 2.4 : 1.8} aria-hidden />}
              <span>More</span>
            </button>
          </>
        ) : (
          <Link href={COACHES_HOME_PATH} className={styles.bottomTab}>
            <Home size={20} aria-hidden /><span>Home</span>
          </Link>
        )}
      </nav>

      {/* Mobile "More" sheet (≤1023px) */}
      {moreOpen && currentTeam && (
        <div className={styles.sheetOverlay} role="presentation" onClick={closeMore}>
          <div
            ref={moreSheetRef}
            className={styles.sheet}
            role="dialog"
            aria-modal="true"
            aria-label="More"
            tabIndex={-1}
            onClick={e => e.stopPropagation()}
          >
            {/* Team switcher (>1 team) */}
            {multiTeam && (
              <div className={styles.sheetBlock}>
                <span className={styles.sheetBlockLabel}>Current team</span>
                <div className={styles.sheetSelectShell}>
                  <select
                    className={styles.sheetSelect}
                    value={currentTeam.id}
                    onChange={e => { closeMore(); router.push(coachTeamPath(e.target.value)); }}
                    aria-label="Switch team"
                  >
                    {teamContexts.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <ChevronDown size={16} className={styles.sheetSelectChevron} aria-hidden />
                </div>
              </div>
            )}

            {/* Overflow sections (anything beyond the 4 primary tabs) */}
            {overflowSections.length > 0 && (
              <>
                <span className={styles.sheetBlockLabel}>Sections</span>
                {overflowSections.map(({ key, label, icon: Icon, sub }) => {
                  const active = sectionActive(currentTeam!, sub);
                  return (
                    <Link
                      key={key}
                      href={sectionHref(currentTeam!, sub)}
                      className={`${styles.sheetItem}${active ? ` ${styles.sheetItemActive}` : ''}`}
                      onClick={closeMore}
                    >
                      <Icon size={16} aria-hidden /><span>{label}</span>
                      <ChevronRight size={14} className={styles.sheetItemChevron} aria-hidden />
                    </Link>
                  );
                })}
                <div className={styles.sheetDivider} />
              </>
            )}

            {/* Account utilities */}
            {email && <p className={styles.sheetEmail} title={email}>{email}</p>}
            <Link href="/home?pick=1" className={styles.sheetItem} onClick={closeMore}>
              <LayoutGrid size={16} aria-hidden /><span>All workspaces</span>
            </Link>
            <FeedbackLauncher className={styles.sheetItem} label="Send feedback" iconSize={16} />
            <button
              type="button"
              className={styles.sheetItem}
              onClick={() => { closeMore(); handleSignOut(); }}
            >
              <LogOut size={16} aria-hidden /><span>Sign out</span>
            </button>
            <button type="button" className={styles.sheetItem} onClick={closeMore}>
              <X size={16} aria-hidden /><span>Close</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
