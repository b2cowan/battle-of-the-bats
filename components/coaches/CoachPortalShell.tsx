'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home, Trophy, Users, CalendarClock, CircleDollarSign, Megaphone,
  Compass, ChevronDown, Check,
} from 'lucide-react';
import {
  COACHES_HOME_PATH,
  COACHES_HELP_PATH,
  COACHES_TEAM_PATH,
  COACHES_TOURNAMENTS_PATH,
  coachTeamPath,
  isCoachPortalShellPath,
} from '@/lib/coaches-portal-routes';
import { resolveFlip } from '@/lib/flip-twins';
import FlipPill from '@/components/shared/FlipPill';
import ConsumerNav from '@/components/consumer/ConsumerNav';
import FeedbackRequestIdProvider from '@/components/feedback/FeedbackRequestIdProvider';
import { coachWarmAttr } from '@/lib/coach-warm-preview';
import CoachThemeColor from '@/components/coaches/CoachThemeColor';
import { SkeletonBlock } from '@/components/admin/AdminSkeleton';
import styles from './CoachPortalShell.module.css';

/** Rich per-team context from /api/coaches/basic-teams?context=1 (lib/basic-coach-teams CoachTeamContext). */
type TeamContextRegistration = {
  id: string;
  tournamentId: string | null;
  tournamentName: string | null;
  tournamentSlug: string | null;
  tournamentIsPublic: boolean;
  orgName: string | null;
  orgSlug: string | null;
  startDate: string | null;
  endDate: string | null;
  chip: { state: string; label: string; rank: number } | null;
};

type TeamContext = {
  id: string;
  name: string;
  activatedFeatures: string[];
  lifecycle: { state: string; label: string; rank: number } | null;
  registrationIds: string[];
  registrations: TeamContextRegistration[];
  nextEvent: { registrationId: string; name: string | null; startDate: string | null; endDate: string | null } | null;
};

/** Tier-1 sections — always visible. Chat is NOT a section anymore (A2): team chat lives in
 *  the global consumer Chat tab + the Overview doorway (owner-approved mockups 2026-07-25). */
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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseDateOnly(value: string | null | undefined): { y: number; m: number; d: number } | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

/** "Aug 14–16" / "Aug 30 – Sep 1" / single-day "Aug 14" (+ ", 2026" when withYear).
 *  A range crossing a year boundary always shows BOTH years ("Dec 30, 2026 – Jan 2, 2027")
 *  so the start year is never silently dropped. Manual YYYY-MM-DD parse — never
 *  `new Date('YYYY-MM-DD')` (UTC shift gotcha). */
function formatEventRange(start: string | null, end: string | null, withYear: boolean): string | null {
  const s = parseDateOnly(start);
  if (!s) return null;
  const e = parseDateOnly(end);
  const year = withYear ? `, ${(e ?? s).y}` : '';
  const sTxt = `${MONTHS[s.m - 1]} ${s.d}`;
  if (!e || (e.y === s.y && e.m === s.m && e.d === s.d)) return `${sTxt}${year}`;
  if (e.y !== s.y) return `${sTxt}, ${s.y} – ${MONTHS[e.m - 1]} ${e.d}, ${e.y}`;
  if (e.m === s.m) return `${MONTHS[s.m - 1]} ${s.d}–${e.d}${year}`;
  return `${sTxt} – ${MONTHS[e.m - 1]} ${e.d}${year}`;
}

/** Lifecycle chip → pill class. live/game-day = true-lime fill; everything else info-tinted.
 *  ('complete' never renders — gated at the call sites, per the shipped A1 rule.) */
function chipClass(state: string): string {
  return state === 'live' || state === 'game_day'
    ? `${styles.chip} ${styles.chipLive}`
    : `${styles.chip} ${styles.chipInfo}`;
}

function LifecycleChip({ chip }: { chip: { state: string; label: string } }) {
  return (
    <span className={chipClass(chip.state)}>
      {(chip.state === 'live' || chip.state === 'game_day') && <span className={styles.chipDot} aria-hidden />}
      {chip.label}
    </span>
  );
}

/**
 * Persistent shell for the authenticated, org-less tournament Coaches Portal — A2 consumer
 * chrome (two-family ruling 2026-07-25; owner-approved mockups are the visual spec):
 *   • the GLOBAL consumer nav (Home · Scores · Chat · Account bottom bar ≤900px; the wordmark
 *     top bar ≥901px) via ConsumerNav variant="coach" — no coach-only nav vocabulary remains;
 *   • a sticky team/event header: team identity always, tournament identity + lifecycle chip
 *     in event context, the Flip top-right (shell-level — per-page placement retired), and the
 *     multi-team switcher on the team name;
 *   • a scrolling section tab row ≤900px (Overview · Tournaments · activated Tier-2 · Explore
 *     last); ≥901px a left rail carries the same list.
 * Team context is client-synced (absent in raw SSR, appears post-hydration). On signup/
 * marketing coach routes the shell passes children through untouched.
 */
export default function CoachPortalShell({
  children,
  signedIn = false,
  isCoach = false,
}: {
  children: React.ReactNode;
  /** SSR'd by app/coaches/layout.tsx for the global ConsumerNav (labels only — never gates content). */
  signedIn?: boolean;
  isCoach?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const showShell = isCoachPortalShellPath(pathname);
  // The help guide is a shell path (so the global marketing nav + footer are suppressed),
  // but it renders as a FOCUSED full-page guide — no rail / bottom-nav — matching how admin
  // help renders without the admin sidebar. (Owner feedback: help must not keep an app side nav.)
  const isHelp = pathname === COACHES_HELP_PATH;

  const [teamContexts, setTeamContexts] = useState<TeamContext[]>([]);
  // True only until the FIRST context fetch settles — the header + tab row show a skeleton
  // (the global bottom bar needs no context, so navigation is usable immediately).
  const [contextsLoading, setContextsLoading] = useState(true);
  const [switchOpen, setSwitchOpen] = useState(false);
  const switchBtnRef = useRef<HTMLButtonElement>(null);

  const [lastPath, setLastPath] = useState(pathname);
  const closeSwitch = useCallback(() => setSwitchOpen(false), []);

  // Close the switcher on any route change (the shell persists across soft-nav). React's
  // endorsed "adjust state during render" pattern (guarded by the path-changed check).
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (switchOpen) setSwitchOpen(false);
  }

  // Re-sync the team context on mount AND on every shell route change. The shell is a
  // persistent client component (it survives soft-nav), so a one-time fetch would go stale
  // the moment the coach activates a Tier-2 feature — the new section wouldn't appear in the
  // nav until a hard refresh. Re-fetching on pathname change picks up `activated_features`
  // writes immediately (the catalog's "Turn on" navigates the coach, which triggers this).
  // The fetch is lightweight + `no-store`; gated on `showShell` so non-portal routes skip it.
  useEffect(() => {
    if (!showShell || isHelp) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/coaches/basic-teams?context=1', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { teamContexts?: TeamContext[] };
        if (cancelled) return;
        setTeamContexts(data.teamContexts ?? []);
      } catch {
        /* shell still renders, just without the team header context */
      } finally {
        if (!cancelled) setContextsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showShell, pathname, isHelp]);

  // Switcher dismissal: Escape (with focus restore) + outside-click — the light-popover
  // idiom (FlipPill's pattern). No scrim: the fixed bottom bar (z-200) and rail (z-110)
  // stack above anything the header's own z-context could host, so a dimmer would read
  // as an incomplete modal it can't actually be.
  const switchWrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!switchOpen) return;
    const btn = switchBtnRef.current;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSwitch();
    };
    const onDown = (e: MouseEvent) => {
      if (switchWrapRef.current && !switchWrapRef.current.contains(e.target as Node)) closeSwitch();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onDown);
      btn?.focus();
    };
  }, [switchOpen, closeSwitch]);

  // ── Resolve the "current team" from the pathname ──
  //   /coaches/team/{id}[/section]      → that team directly
  //   /coaches/tournaments/{regId}      → the team whose registrationIds includes regId
  //   /coaches, /coaches/tournaments    → no specific team (portal-level)
  let currentTeam: TeamContext | null = null;
  const teamMatch = pathname.match(/^\/coaches\/team\/([^/]+)/);
  const regMatchId = pathname.match(/^\/coaches\/tournaments\/([^/]+)/)?.[1] ?? null;
  if (teamMatch) {
    currentTeam = teamContexts.find(t => t.id === teamMatch[1]) ?? null;
  } else if (regMatchId) {
    currentTeam = teamContexts.find(t => t.registrationIds.includes(regMatchId)) ?? null;
  }
  // Single-team coaches: the shell always reflects their one team even on portal-level pages.
  if (!currentTeam && teamContexts.length === 1) currentTeam = teamContexts[0];

  const multiTeam = teamContexts.length > 1;

  // ── Event context (a tournament-record page): tournament identity owns the header eyebrow,
  //    the registration's own chip + dates own the meta line, and the Flip targets its public
  //    page. Everywhere else the header is team-only (eyebrow "Coaches Portal" + next event).
  const currentReg = regMatchId && currentTeam
    ? currentTeam.registrations.find(r => r.id === regMatchId) ?? null
    : null;

  // ── Section list + active-state ownership (Tier-1 + activated Tier-2 + Explore last) ──
  function sectionHref(team: TeamContext, sub: string) {
    return `${COACHES_TEAM_PATH}/${team.id}${sub}`;
  }
  function sectionActive(team: TeamContext, sub: string) {
    const base = `${COACHES_TEAM_PATH}/${team.id}`;
    if (sub === '') return pathname === base;
    if (sub === '/tournaments') {
      // Tournaments owns the whole tournament surface (owner call 2026-07-25 — it used
      // to be claimed by Overview, which read as a mis-highlight): the team-scoped list,
      // the account-wide records hub, and a record page for a registration that belongs
      // to THIS team (not just any /coaches/tournaments/ path — that would wrongly
      // light up for another team's record).
      if (pathname.startsWith(`${base}${sub}`)) return true;
      if (pathname === COACHES_TOURNAMENTS_PATH) return true;
      const reg = pathname.match(/^\/coaches\/tournaments\/([^/]+)/)?.[1];
      return Boolean(reg && team.registrationIds.includes(reg));
    }
    return pathname.startsWith(`${base}${sub}`);
  }

  type Section = { key: string; label: string; icon: typeof Home; sub: string };
  const sections: Section[] = currentTeam
    ? [
        ...TIER1.map(s => ({ ...s })),
        ...TIER2.filter(s => currentTeam!.activatedFeatures.includes(s.key)).map(s => ({ ...s })),
        // Explore is ALWAYS the last tab — the permanent "add more" door (approved mockups).
        { key: 'explore', label: 'Explore', icon: Compass, sub: '/explore' },
      ]
    : [];

  // Auto-center the active tab in the scroll row (the TournamentTopTabs mechanism).
  const tabScrollerRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLAnchorElement>(null);
  const sectionsKey = sections.map(s => s.key).join(',');
  useEffect(() => {
    const scroller = tabScrollerRef.current;
    const active = activeTabRef.current;
    if (!scroller || !active) return;
    const target = active.offsetLeft - (scroller.clientWidth - active.offsetWidth) / 2;
    scroller.scrollTo({ left: Math.max(0, target), behavior: 'auto' });
  }, [pathname, sectionsKey]);

  if (!showShell) return <>{children}</>;

  // Focused full-page help guide: no header/rail/tabs — just the guide, padded so the
  // shared HelpPageLayout gets the breathing room it relies on (mirrors admin focused help).
  // The focused help page returns BEFORE the shell div that carries the warm marker —
  // it needs its own {...coachWarmAttr} or it stays dark under a warm preference.
  if (isHelp) return <main className={styles.helpFocused} {...coachWarmAttr}>{children}</main>;

  // ── Header composition (both states, per the approved mockups) ──
  //   Team-only:  eyebrow "Coaches Portal" · title = team name · meta = team chip + next event.
  //   Event ctx:  eyebrow "{tournament} · {org}" · title = team name · meta = reg chip + dates
  //               (full, with year) · Flip top-right when the tournament is public.
  const eyebrow = currentReg
    ? [currentReg.tournamentName, currentReg.orgName].filter(Boolean).join(' · ') || 'Coaches Portal'
    : 'Coaches Portal';
  const headerChip = currentReg ? currentReg.chip : currentTeam?.lifecycle ?? null;
  // Chip earns header space only while it says something current (live / game day / upcoming /
  // future date). A finished event showing "Complete" forever read as stale noise (A1 rule).
  const showChip = Boolean(headerChip && headerChip.state !== 'complete');
  const metaDates = currentReg
    ? formatEventRange(currentReg.startDate, currentReg.endDate, true)
    : null;
  const nextEventLine = !currentReg && currentTeam?.nextEvent
    ? [currentTeam.nextEvent.name, formatEventRange(currentTeam.nextEvent.startDate, currentTeam.nextEvent.endDate, false)]
        .filter(Boolean)
        .join(' · ')
    : null;
  const flipCtx = currentReg?.tournamentIsPublic && currentReg.orgSlug && currentReg.tournamentSlug
    ? { orgSlug: currentReg.orgSlug, tournamentSlug: currentReg.tournamentSlug }
    : null;

  const titleText = currentTeam?.name ?? 'Coaches Portal';
  const titleNode = currentTeam && multiTeam ? (
    <button
      ref={switchBtnRef}
      type="button"
      className={styles.mhSwitchBtn}
      onClick={() => setSwitchOpen(o => !o)}
      aria-haspopup="menu"
      aria-expanded={switchOpen}
      aria-label={`Switch team — current team ${currentTeam.name}`}
    >
      <span className={styles.mhTitleText}>{currentTeam.name}</span>
      <ChevronDown size={16} aria-hidden />
    </button>
  ) : (
    <span className={styles.mhTitleText}>{titleText}</span>
  );

  const showHeaderSkeleton = contextsLoading && !currentTeam;

  const header = (
    <header
      className={`${styles.mhead}${currentReg ? '' : ` ${styles.mheadTeamOnly}`}`}
      aria-label="Team header"
    >
      <div className={styles.mhTop}>
        {showHeaderSkeleton ? (
          <div className={`${styles.mhText} ${styles.skelText}`} aria-hidden>
            <SkeletonBlock w="110px" h="9px" />
            <SkeletonBlock w="220px" h="18px" />
            <SkeletonBlock w="150px" h="10px" />
          </div>
        ) : (
          <div className={`${styles.mhText}${multiTeam ? ` ${styles.switchWrap}` : ''}`} ref={switchWrapRef}>
            {/* No-team states title themselves "Coaches Portal" — an identical eyebrow above
                that would just stutter. */}
            {currentTeam && <p className={styles.mhEyebrow}>{eyebrow}</p>}
            <div className={styles.mhTitle}>{titleNode}</div>
            {(showChip || metaDates || nextEventLine) && (
              <div className={styles.mhMeta}>
                {showChip && headerChip && <LifecycleChip chip={headerChip} />}
                {metaDates && <span>{metaDates}</span>}
                {nextEventLine && <span>{nextEventLine}</span>}
              </div>
            )}
            {/* Multi-team switcher menu — anchored under the title (the name IS the trigger). */}
            {switchOpen && multiTeam && currentTeam && (
              <div className={styles.switchMenu} role="menu" aria-label="Your teams">
                <p className={styles.switchLabel}>Your teams</p>
                {teamContexts.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    role="menuitem"
                    className={`${styles.switchRow}${t.id === currentTeam!.id ? ` ${styles.switchRowCurrent}` : ` ${styles.switchRowPad}`}`}
                    onClick={() => {
                      closeSwitch();
                      if (t.id !== currentTeam!.id) router.push(coachTeamPath(t.id));
                    }}
                  >
                    {t.id === currentTeam!.id && <Check size={16} aria-hidden />}
                    <span>{t.name}</span>
                  </button>
                ))}
                <p className={styles.switchFoot}>All your workspaces live on Home</p>
              </div>
            )}
          </div>
        )}
        {/* The Flip stays header-right at every width (owner-ratified 2026-07-25) — event
            context only; a basic team has no public page outside a tournament. */}
        {flipCtx && (
          <div className={styles.mhFlip}>
            <FlipPill resolution={resolveFlip({ direction: 'to-public', hat: 'coach', ctx: flipCtx })} />
          </div>
        )}
      </div>

      {/* Section tab row (≤900px): Overview · Tournaments · activated Tier-2 · Explore last. */}
      {showHeaderSkeleton ? (
        <div className={styles.skelTabs} aria-hidden>
          <SkeletonBlock w="84px" h="22px" />
          <SkeletonBlock w="104px" h="22px" />
          <SkeletonBlock w="72px" h="22px" />
          <SkeletonBlock w="86px" h="22px" />
        </div>
      ) : !currentTeam && !contextsLoading && teamContexts.length === 0 ? (
        /* Zero-team coaches: the rail's "Get started" door is desktop-only, so the mobile
           chrome keeps one here (the old bottom nav's bare Home tab did this job). */
        <nav className={styles.tabRow} aria-label="Team sections">
          <Link href={COACHES_HOME_PATH} className={styles.tabPill}>
            <Home size={15} strokeWidth={1.9} aria-hidden />
            <span>Get started</span>
          </Link>
        </nav>
      ) : currentTeam && (
        <nav className={styles.tabRow} aria-label="Team sections" ref={tabScrollerRef}>
          {sections.map(({ key, label, icon: Icon, sub }) => {
            const active = sectionActive(currentTeam!, sub);
            return (
              <Link
                key={key}
                href={sectionHref(currentTeam!, sub)}
                ref={active ? activeTabRef : undefined}
                className={`${styles.tabPill}${active ? ` ${styles.tabPillActive}` : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={15} strokeWidth={active ? 2.4 : 1.9} aria-hidden />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );

  return (
    // {...coachWarmAttr} adds the [data-coach-warm-enabled] marker (always, post-release); the
    // shell root wraps the global nav, header, rail and content, so the warm token flip in
    // globals.css reaches the whole basic portal.
    <div className={styles.shell} {...coachWarmAttr}>
      <CoachThemeColor />
      <FeedbackRequestIdProvider />

      {/* The GLOBAL consumer nav: bottom bar ≤900px (Home · Scores · Chat · Account — no tab
          lights up inside the team space; the header says where you are), wordmark top bar
          ≥901px. Renders instantly — it needs no team context. */}
      <ConsumerNav variant="coach" signedIn={signedIn} isCoach={isCoach} />

      {/* Desktop left rail (≥901px) — team identity + the same section list as the tab row. */}
      <aside className={styles.rail} aria-label="Coaches Portal">
        <div className={styles.railHeader}>
          <p className={styles.railEyebrow}>Coaches Portal</p>
          {currentTeam ? (
            <>
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
                <p className={styles.railTeamName}>{currentTeam.name}</p>
              )}
              {(() => {
                // Event context names the tournament BEING VIEWED — never the team's
                // unrelated "next event" (that would mislabel the rail on record pages).
                const railEventName = currentReg
                  ? currentReg.tournamentName
                  : currentTeam.nextEvent?.name ?? null;
                if (!showChip && !railEventName) return null;
                return (
                  <div className={styles.railMeta}>
                    {showChip && headerChip && <LifecycleChip chip={headerChip} />}
                    {railEventName && <span>{railEventName}</span>}
                  </div>
                );
              })()}
            </>
          ) : (
            <p className={styles.railTeamName}>Your teams</p>
          )}
        </div>

        {currentTeam && (
          <nav className={styles.railNav} aria-label="Team sections">
            {sections
              .filter(s => s.key !== 'explore')
              .map(({ key, label, icon: Icon, sub }) => (
                <Link
                  key={key}
                  href={sectionHref(currentTeam!, sub)}
                  className={`${styles.railLink}${sectionActive(currentTeam!, sub) ? ` ${styles.railLinkActive}` : ''}`}
                  aria-current={sectionActive(currentTeam!, sub) ? 'page' : undefined}
                >
                  <Icon size={17} aria-hidden /><span>{label}</span>
                </Link>
              ))}
            <div className={styles.railDivider} role="presentation" />
            {(() => {
              const explore = sections.find(s => s.key === 'explore')!;
              const active = sectionActive(currentTeam!, explore.sub);
              return (
                <Link
                  href={sectionHref(currentTeam!, explore.sub)}
                  className={`${styles.railLink}${active ? ` ${styles.railLinkActive}` : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <Compass size={17} aria-hidden /><span>{explore.label}</span>
                </Link>
              );
            })()}
          </nav>
        )}

        {/* Zero-team coaches: a single CTA instead of an empty nav. */}
        {!contextsLoading && teamContexts.length === 0 && (
          <Link href={COACHES_HOME_PATH} className={styles.railLink}>
            <Home size={17} aria-hidden /><span>Get started</span>
          </Link>
        )}

        <div className={styles.railFooter}>
          <span className={styles.railLive}>Live on FieldLogicHQ</span>
        </div>
      </aside>

      {header}

      <div className={styles.content}>{children}</div>
    </div>
  );
}
