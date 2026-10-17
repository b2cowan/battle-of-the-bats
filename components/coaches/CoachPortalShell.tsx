'use client';
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Trophy, Compass, ChevronDown, Check, MessageSquare, HelpCircle } from 'lucide-react';
import {
  COACHES_HOME_PATH,
  COACHES_HELP_PATH,
  COACHES_NOTIFICATIONS_PATH,
  COACHES_TEAM_PATH,
  coachTeamPath,
  isCoachPortalShellPath,
} from '@/lib/coaches-portal-routes';
import { COACH_TEAM_TOOLS, coachTeamToolSub } from '@/lib/coach-team-tools';
import { freeRecordId, freeSectionActive, pathNamesFreeTeam, resolveCurrentFreeTeam, resolveFreeBarTeam } from '@/lib/coach-free-nav';
import { COACH_SETUP_SKIPPED_ATTR } from './useCoachNudgeDismiss';
import { resolveFlip } from '@/lib/flip-twins';
import FlipPill from '@/components/shared/FlipPill';
import ConsumerNav from '@/components/consumer/ConsumerNav';
import CoachTopStrip from '@/components/coaches/CoachTopStrip';
import CoachFreeBottomNav from '@/components/coaches/CoachFreeBottomNav';
import ChatUnreadBadge from '@/components/chat/ChatUnreadBadge';
import ReleaseDot from '@/components/whats-new/ReleaseDot';
import { useChatDoor } from '@/lib/use-chat-door';
import type { WorkspaceDoor } from '@/lib/user-contexts';
import FeedbackRequestIdProvider from '@/components/feedback/FeedbackRequestIdProvider';
import { coachWarmAttr } from '@/lib/coach-warm-preview';
import CoachThemeColor from '@/components/coaches/CoachThemeColor';
import { SkeletonBlock } from '@/components/admin/AdminSkeleton';
import {
  CollapseSidebarRow, SidebarStripMenu, SidebarStripTile, SidebarStripTip, StripMenuLink, useStripMenu,
} from '@/components/shared/SidebarStrip';
import strip from '@/components/shared/SidebarStrip.module.css';
import { formatEventDateRange } from '@/lib/timezone';
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

/** Tier-1 sections — always in the computer's left menu. Chat is not one: it sits under Tournaments only
 *  when the coach has a chat or one is coming (owner A1, 2026-10-13). The phone bar carries its own fixed
 *  four (CoachFreeBottomNav). */
const TIER1 = [
  { key: 'overview', label: 'Overview', icon: Home, sub: '' },
  { key: 'tournaments', label: 'Tournaments', icon: Trophy, sub: '/tournaments' },
] as const;

/** Tier-2 sections — shown only when the coach has turned them on (activatedFeatures).
 *  Names/icons/paths come from the ONE shared tool catalog (lib/coach-team-tools.ts) so the rail,
 *  the phone bar's More, the Explore catalog and the Overview setup panel can't drift on what a
 *  section is called. */
const TIER2 = COACH_TEAM_TOOLS.map(({ key, label, Icon }) => ({
  key,
  label,
  icon: Icon,
  sub: coachTeamToolSub(key),
}));

/** Moved to lib/timezone.ts (2026-07-27) so the record page's hero renders the SAME range
 *  as this header — it hand-rolled a `new Date(dateOnly)` version that printed a day early. */
const formatEventRange = formatEventDateRange;

/** The team the phone bar falls back to on Notifications (B3, 2026-10-15): the last team the coach opened,
 *  remembered on this device. A per-device convenience — blocked storage falls back to the first team. */
const LAST_TEAM_KEY = 'flhq:coach-free-last-team';
const noSubscribe = () => () => {};
function readStoredTeamId(): string | null {
  try {
    return window.localStorage.getItem(LAST_TEAM_KEY);
  } catch {
    return null;
  }
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
 * Persistent shell for the authenticated, org-less free Coaches Portal — the PAID portal's shape at every
 * width (Free coach header parity: the computer 2026-10-13, the phone 2026-10-15; owner-approved hub
 * drawings are the visual spec):
 *   • ≥901px the PAID portal's strip (CoachTopStrip free) — wordmark · Coaches Portal · bell · account
 *     menu ("the account dropdown and notifications bell should be the same for free tier coaches") — and
 *     a 248px left rail of the team's sections;
 *   • ≤900px the TEAM BAR (CoachFreeBottomNav) — Overview · Tournaments · Chat · More, the paid bar's
 *     look; the team's tools, Notifications, Home, Scores and Account live in More (owner, 2026-10-15:
 *     "more like the premium portal with using the nav at the bottom and not the main page nav"). Where a
 *     page has no team — the front page for a coach with several teams or none, the all-tournaments list
 *     reached from it — the fan app's bar instead (ConsumerNav variant="coach"; owner B3, 2026-10-15);
 *   • a sticky team/event header: team identity always, tournament identity + lifecycle chip in event
 *     context, the Flip top-right (shell-level), and the multi-team switcher on the team name. Its phone
 *     section-tab row retired with the team bar; Notifications shows no header (its list covers every team).
 *   • ⚖ the left rail folds to the 64 icon strip, by choice, per device — the paid sidebar's strip and its ONE
 *     setting (Sidebar Strip & Grid Width Stage 2; owner at the build, 2026-10-16: "yes, same strip"; the
 *     coach drawing, hub screen 9, is its spec). The rail is where a computer reads the team's name on a
 *     team page, so while it is a strip the team header band shows on every page whose ADDRESS names a team
 *     (owner, same day) — decided from the address, so the band is there from the first paint.
 * Team context is client-synced (absent in raw SSR, appears post-hydration). On signup/
 * marketing coach routes the shell passes children through untouched.
 */
export default function CoachPortalShell({
  children,
  signedIn = false,
  isCoach = false,
  adminHref = null,
  workspaces = [],
  startMenu,
}: {
  children: React.ReactNode;
  /** SSR'd by app/coaches/layout.tsx for the global ConsumerNav (labels only — never gates content). */
  signedIn?: boolean;
  isCoach?: boolean;
  /** WI-3: keeps a dual-role (admin + coach) account's Admin Area door inside the portal. */
  adminHref?: string | null;
  /** Stage D.2: the account's places, for the nav's Workspaces popover (2+ only). */
  workspaces?: WorkspaceDoor[];
  /** WI-2: persona-menu gating resolved by the layout (already dynamic). */
  startMenu?: { coachHref: string; showLeague: boolean };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const showShell = isCoachPortalShellPath(pathname);
  // The help guide is a shell path (so the global marketing nav + footer are suppressed),
  // but it renders as a FOCUSED full-page guide — no rail / bottom-nav — matching how admin
  // help renders without the admin sidebar. (Owner feedback: help must not keep an app side nav.)
  const isHelp = pathname === COACHES_HELP_PATH;
  // Notifications lists every team's notices, so it wears no team header (design check RDC1, 2026-10-15).
  const isNotifications = pathname === COACHES_NOTIFICATIONS_PATH;

  const [teamContexts, setTeamContexts] = useState<TeamContext[]>([]);
  // True only until the FIRST context fetch settles — the header shows a skeleton and the phone bar its
  // empty band until then.
  const [contextsLoading, setContextsLoading] = useState(true);
  const [switchOpen, setSwitchOpen] = useState(false);
  const switchBtnRef = useRef<HTMLButtonElement>(null);

  const [lastPath, setLastPath] = useState(pathname);
  const closeSwitch = useCallback(() => setSwitchOpen(false), []);

  // The no-flash script stamps [data-coach-setup-skipped] on <html> for the team in the URL at hard
  // load, to keep a skipped Overview setup card from painting. It must not outlive that first paint:
  // this shell survives client navigation, and a stale flag would hide the card on the NEXT team the
  // coach opens. Cleared here (not in the panel) because the panel doesn't mount on every page.
  useEffect(() => {
    document.documentElement.removeAttribute(COACH_SETUP_SKIPPED_ATTR);
  }, [pathname]);

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

  // Chat — the left menu's row and the phone bar's tab, one answer (owner A1, 2026-10-13; P2, 2026-10-15):
  // only when the coach has a chat, or one is coming.
  const chatDoorEnabled = showShell && !isHelp && signedIn;
  const { show: showChat, unread: chatUnread, ready: chatDoorReady } = useChatDoor(chatDoorEnabled);
  // The phone bar holds its tabs until the team context is in AND the chat answer is (or its short wait is
  // over — useChatDoor caps it), so they arrive together rather than shifting when Chat lands.
  const barReady = !contextsLoading && (!chatDoorEnabled || chatDoorReady);

  // Switcher dismissal: Escape (with focus restore) + outside-click — the light-popover
  // idiom (FlipPill's pattern). No scrim: the fixed bottom bar (z-300) and rail (z-110)
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

  // ── The "current team": the one in the address, else the coach's only team (lib/coach-free-nav.ts) ──
  const currentTeam = resolveCurrentFreeTeam(pathname, teamContexts);
  const multiTeam = teamContexts.length > 1;

  // The last team the coach opened — the phone bar's team on Notifications (B3), kept on this device so a
  // fresh load straight onto Notifications finds it too. Only a team PAGE or a team's RECORD counts — the
  // team that page shows (for a coach with one team, always that team); the portal's own pages (the front
  // page, the all-tournaments list) say nothing about which team the coach chose. The store is read on every render
  // (no subscription needed): the write lands after the team page's render, before any later page's.
  const addressTeamId = pathNamesFreeTeam(pathname) ? currentTeam?.id ?? null : null;
  useEffect(() => {
    if (!addressTeamId) return;
    try {
      window.localStorage.setItem(LAST_TEAM_KEY, addressTeamId);
    } catch {
      /* storage blocked: Notifications falls back to the first team */
    }
  }, [addressTeamId]);
  const rememberedTeamId = useSyncExternalStore(noSubscribe, readStoredTeamId, () => null);
  const barTeam = resolveFreeBarTeam(pathname, teamContexts, rememberedTeamId);

  // The strip: the name bubble and the team tile's list hang beside the rail.
  const railRef = useRef<HTMLElement>(null);
  const { openKey: stripMenuKey, anchorRef: stripAnchorRef, toggle: toggleStripMenu, close: closeStripMenu } = useStripMenu(pathname);

  // ── Event context (a tournament-record page): tournament identity owns the header eyebrow,
  //    the registration's own chip + dates own the meta line, and the Flip targets its public
  //    page. Everywhere else the header is team-only (eyebrow "Coaches Portal" + next event).
  const regMatchId = freeRecordId(pathname);
  const currentReg = regMatchId && currentTeam
    ? currentTeam.registrations.find(r => r.id === regMatchId) ?? null
    : null;

  // ── Section list (Tier-1 + activated Tier-2 + Explore last) — the computer's left menu ──
  function sectionHref(team: TeamContext, sub: string) {
    return `${COACHES_TEAM_PATH}/${team.id}${sub}`;
  }
  const sectionActive = (team: TeamContext, sub: string) => freeSectionActive(pathname, team, sub);

  type Section = { key: string; label: string; icon: typeof Home; sub: string };
  const sections: Section[] = currentTeam
    ? [
        ...TIER1.map(s => ({ ...s })),
        ...TIER2.filter(s => currentTeam.activatedFeatures.includes(s.key)).map(s => ({ ...s })),
        // Explore is ALWAYS last — the permanent "add more" door (approved mockups).
        { key: 'explore', label: 'Explore', icon: Compass, sub: '/explore' },
      ]
    : [];

  // A3: publish the sticky header's measured height as --coach-mhead-h on the shell root
  // so page-level sticky chrome (the record page's quick-jump row) can stack directly
  // beneath it and anchors can offset against the whole stack. ResizeObserver keeps it
  // honest when the title wraps, the meta line grows, or the header hides (it measures 0
  // then — the element stays mounted for exactly that reason).
  // Layout effect (not useEffect): on a scroll-restored paint (browser Back) the var's
  // 0px fallback would put the quick-jump row BEHIND the header for a frame — measure
  // before first paint instead (house pattern: OrgNavSync / ChatPanel).
  const shellRef = useRef<HTMLDivElement>(null);
  const mheadRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = mheadRef.current;
    const root = shellRef.current;
    if (!el || !root) return;
    const set = () => root.style.setProperty('--coach-mhead-h', `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, [showShell, isHelp]);

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
      ref={mheadRef}
      className={`${styles.mhead}${currentReg ? '' : ` ${styles.mheadTeamOnly}`}${pathNamesFreeTeam(pathname) ? ` ${styles.mheadTeamPage}` : ''}`}
      aria-label="Team header"
      hidden={isNotifications || undefined}
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
                    className={`${styles.switchRow}${t.id === currentTeam.id ? ` ${styles.switchRowCurrent}` : ` ${styles.switchRowPad}`}`}
                    onClick={() => {
                      closeSwitch();
                      if (t.id !== currentTeam.id) router.push(coachTeamPath(t.id));
                    }}
                  >
                    {t.id === currentTeam.id && <Check size={16} aria-hidden />}
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

      {/* The phone's section-tab row RETIRED with the team bar (owner, 2026-10-15): the bar carries
          Overview · Tournaments · Chat, and the team's tools are tiles in More. What stays is the one door a
          coach with NO team has back to the portal's front page — the fan app's bar has none (B3). */}
      {!contextsLoading && teamContexts.length === 0 && (
        <nav className={styles.tabRow} aria-label="Team sections">
          <Link href={COACHES_HOME_PATH} className={styles.tabPill}>
            <Home size={15} strokeWidth={1.9} aria-hidden />
            <span>Get started</span>
          </Link>
        </nav>
      )}
    </header>
  );

  // ── The phone bar (≤900px; both bars hide themselves above) ──
  //   · the TEAM BAR wherever the page has a team, and on Notifications (resolveFreeBarTeam); its tabs wait
  //     for the team context AND the chat answer, so they arrive together — the band shows until then;
  //   · the fan app's bar where it has none (the front page for a coach with several teams or none, the
  //     all-tournaments list reached from it). chatBackPath (A3 QA): its Chat tab carries the page the
  //     coach left, so /chat can offer the way back.
  const phoneBar = !contextsLoading && !barTeam
    ? (
      <ConsumerNav
        variant="coach"
        signedIn={signedIn}
        isCoach={isCoach}
        adminHref={adminHref}
        workspaces={workspaces}
        startMenu={startMenu}
        chatBackPath={pathname}
      />
    )
    : <CoachFreeBottomNav team={barReady ? barTeam : null} showChat={showChat} chatUnread={chatUnread} />;

  return (
    // {...coachWarmAttr} adds the [data-coach-warm-enabled] marker (always, post-release); the
    // shell root wraps the strip, the bar, the header, the rail and the content, so the warm token
    // flip in globals.css reaches the whole basic portal.
    <div className={styles.shell} ref={shellRef} {...coachWarmAttr}>
      <CoachThemeColor />
      <FeedbackRequestIdProvider />

      {/* On a computer: the PAID portal's strip — the same component, so the two cannot drift (owner
          ruling 2026-10-13). Its bell is the coach's own notices from every host club. Desktop only
          (its own CSS hides it ≤900px). */}
      {signedIn && <CoachTopStrip free />}

      {phoneBar}

      {/* Desktop left rail (≥901px) — team identity + the team's sections. */}
      <aside className={styles.rail} aria-label="Coaches Portal" ref={railRef}>
        {/* The strip's team tile (hub screen 9): the team picker's list, only where the picker shows. */}
        {currentTeam && multiTeam && (
          <SidebarStripTile
            name={currentTeam.name}
            label={`${currentTeam.name} · switch team`}
            open={stripMenuKey === 'team'}
            onToggle={el => toggleStripMenu('team', el)}
          />
        )}
        {/* No "Coaches Portal" eyebrow (owner A2, 2026-10-13): the strip says it, two inches above. The
            identity block is the full rail's; in the strip the header band carries it (above). */}
        <div className={`${styles.railHeader} ${strip.fullOnly}`}>
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
                <Fragment key={key}>
                  <Link
                    href={sectionHref(currentTeam, sub)}
                    className={`${styles.railLink}${sectionActive(currentTeam, sub) ? ` ${styles.railLinkActive}` : ''}`}
                    aria-current={sectionActive(currentTeam, sub) ? 'page' : undefined}
                  >
                    <Icon size={17} aria-hidden /><span className={strip.rowLabel}>{label}</span>
                  </Link>
                  {/* Chat under Tournaments, as in the paid sidebar, with its unread count (DC1). It opens
                      INSIDE the portal — the paid portal's chat screen (owner A1). */}
                  {key === 'tournaments' && showChat && (
                    <Link
                      href={sectionHref(currentTeam, '/chat')}
                      className={`${styles.railLink}${sectionActive(currentTeam, '/chat') ? ` ${styles.railLinkActive}` : ''}`}
                      aria-current={sectionActive(currentTeam, '/chat') ? 'page' : undefined}
                    >
                      <MessageSquare size={17} aria-hidden /><span className={strip.rowLabel}>Chat</span>
                      <ChatUnreadBadge count={chatUnread} className={strip.cornerCount} />
                    </Link>
                  )}
                </Fragment>
              ))}
            <div className={styles.railDivider} role="presentation" />
            {(() => {
              const explore = sections.find(s => s.key === 'explore')!;
              const active = sectionActive(currentTeam, explore.sub);
              return (
                <Link
                  href={sectionHref(currentTeam, explore.sub)}
                  className={`${styles.railLink}${active ? ` ${styles.railLinkActive}` : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <Compass size={17} aria-hidden /><span className={strip.rowLabel}>{explore.label}</span>
                </Link>
              );
            })()}
          </nav>
        )}

        {/* Zero-team coaches: a single CTA instead of an empty nav. */}
        {!contextsLoading && teamContexts.length === 0 && (
          <Link href={COACHES_HOME_PATH} className={styles.railLink}>
            <Home size={17} aria-hidden /><span className={strip.rowLabel}>Get started</span>
          </Link>
        )}

        <div className={styles.railFooter}>
          {/* Help at the foot, as in the paid sidebar (owner A3): the coaches guide in a new tab, with the
              what's-new dot, in this menu's own link style (DC3). */}
          <Link href={COACHES_HELP_PATH} className={styles.railLink} target="_blank" rel="noopener noreferrer">
            <HelpCircle size={17} aria-hidden /><span className={strip.rowLabel}>Help</span>
            <ReleaseDot className={strip.cornerDot} />
          </Link>
          <span className={`${styles.railLive} ${strip.fullOnly}`}>Live on FieldLogicHQ</span>
          {/* ⚖ The last row (Sidebar Strip Ask 2): a rare door ends the body. */}
          <CollapseSidebarRow className={styles.railLink} iconSize={17} />
        </div>

        <SidebarStripTip scopeRef={railRef} />
        <SidebarStripMenu
          key={stripMenuKey ?? 'closed'}
          open={stripMenuKey === 'team'}
          anchorRef={stripAnchorRef}
          title="Your teams"
          onClose={closeStripMenu}
        >
          {teamContexts.map(t => (
            <StripMenuLink key={t.id} href={coachTeamPath(t.id)} current={t.id === currentTeam?.id}>{t.name}</StripMenuLink>
          ))}
        </SidebarStripMenu>
      </aside>

      {header}

      <div className={styles.content}>{children}</div>
    </div>
  );
}
