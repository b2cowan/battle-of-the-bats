'use client';
/**
 * AdminKitRail — the admin's desktop rail on the coaches portal's kit (Admin Design Continuity
 * slice 1). Renders ONLY with the switch on (`AdminChrome` picks it over `AdminSidebar`); the release
 * slice deletes the legacy rail and keeps this one.
 *
 * ⚠ ONE RAIL, ALWAYS POPULATED (ratified club Stage 1 specimen 3). Today's rail is a set of MODES —
 * empty at the hub, a different rail inside each program, "All Sections" to get out. This is one
 * object: Overview pinned, then the programs, then Organization, and the program you are in opens
 * onto its pages. Inside a TOURNAMENT the middle swaps for today's tournament rail (switcher,
 * Operations / Setup / Admin), restyled only, with Overview still pinned above it, so there is always
 * a way back to the club. A tournament-only organization (the Tournament plans have no club hub)
 * sees the tournament rail alone, as it does today.
 *
 * ⚠ The programs, their pages and the Organization links come from `lib/admin-kit-nav.ts`, which the
 * phone bar reads too. Every gate is today's gate — read that file's header before adding a row.
 */
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ElementType } from 'react';
import {
  LayoutGrid, ChevronRight, Plus, Home, Users2, HelpCircle, LogOut, DollarSign, Trophy,
} from 'lucide-react';
import TournamentSetupWizard from '@/components/admin/TournamentSetupWizard';
import FeedbackLauncher from '@/components/feedback/FeedbackLauncher';
import ReleaseDot from '@/components/whats-new/ReleaseDot';
import ChatUnreadBadge from '@/components/chat/ChatUnreadBadge';
import { signOut } from '@/lib/auth';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import { hasCapability } from '@/lib/roles';
import { hasPlanFeature, requiresTournamentPlusCopy } from '@/lib/plan-features';
import { getBillingHref } from '@/lib/billing-urls';
import { useAdminWorklist } from '@/lib/admin-worklist';
import { useChatUnread } from '@/lib/use-chat-unread';
import { TOUR_GROUPS } from '@/components/admin/admin-nav-config';
import { isKitLinkActive, kitTournamentLabel, ORGANIZATION_ICON, type KitLink } from '@/lib/admin-kit-nav';
import { useAdminKitNav } from './useAdminKitNav';
import styles from './AdminKitFrame.module.css';

type SeasonOption = { id: string; name: string };

/** One rail door — the coach rail's row, with the admin's worklist count and chat badge. */
function RailRow({ href, label, active, icon: Icon, sub, count = 0, chatUnread }: {
  href: string; label: string; active: boolean; icon?: ElementType; sub?: boolean;
  count?: number; chatUnread?: number;
}) {
  return (
    <Link
      href={href}
      className={`${styles.item}${sub ? ` ${styles.sub}` : ''}${active ? ` ${styles.itemActive}` : ''}`}
      aria-current={active ? 'page' : undefined}
    >
      {Icon && <Icon size={14} aria-hidden />}
      <span>{label}</span>
      {count > 0 && <span className={styles.count} aria-label={`${count} need attention`}>{count > 9 ? '9+' : count}</span>}
      {chatUnread !== undefined && <ChatUnreadBadge count={chatUnread} />}
    </Link>
  );
}

/** A program (or Organization) row: the door to its first screen, open while you are inside it. */
function ProgramRow({ href, label, icon: Icon, open, hasPages }: {
  href: string; label: string; icon: ElementType; open: boolean; hasPages: boolean;
}) {
  return (
    <Link href={href} className={`${styles.item}${open ? ` ${styles.programOpen}` : ''}`}>
      <Icon size={14} aria-hidden />
      <span>{label}</span>
      {hasPages && <ChevronRight size={13} className={`${styles.chevron}${open ? ` ${styles.chevronOpen}` : ''}`} aria-hidden />}
    </Link>
  );
}

export default function AdminKitRail() {
  const pathname = usePathname();
  const router = useRouter();
  const nav = useAdminKitNav();
  const { base, orgSlug, programs, orgLinks, section, tournamentOnly, isCanceled, onTournaments, coachDoor } = nav;
  const repMatch = pathname.match(/\/rep-teams\/teams\/([^/]+)\/program-years\/([^/]+)/);
  const seasonId = pathname.match(/\/house-league\/seasons\/([^/]+)/)?.[1] ?? null;
  const [creating, setCreating] = useState(false);

  const helpHref = onTournaments ? `${base}/help/tournaments`
    : section === 'house-league' ? `${base}/help/house-league`
    : section === 'rep-teams' ? `${base}/help/rep-teams`
    : section === 'accounting' ? `${base}/help/accounting`
    : section === 'org' ? `${base}/help/org`
    : `${base}/help`;

  async function handleSignOut() {
    await signOut();
    router.push('/auth/login');
  }

  const pageRow = (link: KitLink) => (
    <RailRow key={link.key} href={link.href} label={link.label} active={isKitLinkActive(pathname, link)} sub />
  );

  return (
    <>
    <aside className={styles.rail}>
      <nav className={styles.railScroll} aria-label="Admin navigation">
        {!tournamentOnly && !isCanceled && (
          <RailRow href={base} label="Overview" active={pathname === base} icon={LayoutGrid} />
        )}

        {onTournaments ? (
          <TournamentRail labelled={!tournamentOnly} onCreate={() => setCreating(true)} />
        ) : (
          <>
            {!tournamentOnly && !isCanceled && programs.length > 0 && (
              <>
                <div className={styles.label}>Programs</div>
                {programs.map(p => {
                  const open = section === p.key;
                  return (
                    <div key={p.key}>
                      <ProgramRow href={p.href} label={p.label} icon={p.icon} open={open} hasPages={p.pages.length > 0} />
                      {open && p.pages.map(pageRow)}
                      {open && p.key === 'rep-teams' && repMatch && (
                        <RepTeamBlock y={`${base}/rep-teams/teams/${repMatch[1]}/program-years/${repMatch[2]}`} />
                      )}
                      {open && p.key === 'house-league' && seasonId && <SeasonBlock seasonId={seasonId} />}
                    </div>
                  );
                })}
              </>
            )}
            {tournamentOnly && !isCanceled && (
              <RailRow href={`${base}/tournaments`} label="Tournaments" active={false} icon={Trophy} />
            )}
            {orgLinks.length > 0 && (
              <>
                <div className={styles.label}>{tournamentOnly ? 'Account' : 'Organization'}</div>
                {tournamentOnly || isCanceled
                  ? orgLinks.map(link => (
                      <RailRow key={link.key} href={link.href} label={link.label} active={isKitLinkActive(pathname, link)} />
                    ))
                  : (
                    <>
                      <ProgramRow href={`${base}/org`} label="Organization" icon={ORGANIZATION_ICON} open={section === 'org'} hasPages />
                      {section === 'org' && orgLinks.map(pageRow)}
                    </>
                  )}
              </>
            )}
          </>
        )}

        <div className={styles.spacer} />

        <div className={styles.foot}>
          {/* Today's rail shows the org's public-site door everywhere but tournaments (the header's
              flip pill owns that door there) and org admin. Kept exactly. */}
          {!onTournaments && section !== 'org' && (
            <Link href={`/${orgSlug}`} className={`${styles.item} ${styles.footItem}`}>
              <Home size={14} aria-hidden /> <span>Public site</span>
            </Link>
          )}
          {coachDoor.show && (
            <Link href={coachDoor.href} className={`${styles.item} ${styles.footItem}`}>
              <Users2 size={14} aria-hidden /> <span>Coaches Portal</span>
            </Link>
          )}
          <Link href={helpHref} className={`${styles.item} ${styles.footItem}`} target="_blank" rel="noopener noreferrer">
            <HelpCircle size={14} aria-hidden /> <span>Help</span> <ReleaseDot />
          </Link>
          <FeedbackLauncher className={`${styles.item} ${styles.footItem}`} label="Send feedback" />
          {/* "Sign out", not "Logout": one name for one action everywhere a customer reads it — the
              coaches portal, the account menu and the account page settled it 2026-09-01. */}
          <button type="button" onClick={handleSignOut} className={`${styles.item} ${styles.footItem} ${styles.footSignOut}`}>
            <LogOut size={14} aria-hidden /> <span>Sign out</span>
          </button>
        </div>
      </nav>
    </aside>
    {creating && <CreateTournamentWizard onClose={() => setCreating(false)} />}
    </>
  );
}

/** Inside one rep team's season — today's "Team" block, unchanged in content (Stage 2 redraws it). */
function RepTeamBlock({ y }: { y: string }) {
  const pathname = usePathname();
  return (
    <>
      <div className={styles.subLabel}>Team</div>
      <RailRow href={`${y}/tryouts`} label="Tryouts" active={pathname.startsWith(`${y}/tryouts`)} sub />
      <RailRow href={`${y}#roster`} label="Roster" active={pathname === y} sub />
      <RailRow href={`${y}/schedule`} label="Schedule" active={pathname.startsWith(`${y}/schedule`)} sub />
      <RailRow href={`${y}/coaches`} label="Coaches" active={pathname.startsWith(`${y}/coaches`)} sub />
    </>
  );
}

/** Inside one house-league season — today's "Season" block: the switcher and five pages. */
function SeasonBlock({ seasonId }: { seasonId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentOrg } = useOrg();
  const base = `/${currentOrg?.slug ?? ''}/admin`;
  const [seasons, setSeasons] = useState<SeasonOption[]>([]);
  useEffect(() => {
    if (!currentOrg?.slug) return;
    // A late answer for the org you just left must not overwrite this one's list (/review, slice 1 —
    // today's rail has the same unguarded fetch; this copy does not repeat it).
    let stale = false;
    fetch(`/api/admin/house-league/seasons?orgSlug=${encodeURIComponent(currentOrg.slug)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (stale) return;
        const list: unknown[] = Array.isArray(d?.seasons) ? d.seasons : [];
        setSeasons(list
          .filter((s): s is SeasonOption & { status?: string } =>
            !!s && typeof (s as SeasonOption).id === 'string' && typeof (s as SeasonOption).name === 'string')
          .filter(s => s.status !== 'archived')
          .map(s => ({ id: s.id, name: s.name })));
      })
      .catch(() => {});
    return () => { stale = true; };
  }, [currentOrg?.slug]);
  const s = `${base}/house-league/seasons/${seasonId}`;
  const page = (key: string, label: string) => (
    <RailRow href={`${s}/${key}`} label={label} active={pathname.startsWith(`${s}/${key}`)} sub />
  );
  return (
    <>
      <div className={styles.subLabel}>Season</div>
      {seasons.length > 1 && (
        <div className={styles.switcher}>
          <select
            className={styles.switcherSelect}
            value={seasonId}
            aria-label="Switch season"
            id="hl-season-select"
            onChange={e => {
              const subPath = pathname.match(/\/seasons\/[^/]+\/([^/]+)/)?.[1] ?? 'registrations';
              router.push(`${base}/house-league/seasons/${e.target.value}/${subPath}`);
            }}
          >
            {seasons.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
      )}
      {page('registrations', 'Registrations')}
      {page('teams', 'Teams & draft')}
      {page('schedule', 'Schedule')}
      {page('standings', 'Standings')}
      {page('notifications', 'Notifications')}
    </>
  );
}

/** Today's tournament rail, restyled: switcher, Operations / Setup / Admin, Accounting. */
function TournamentRail({ labelled, onCreate }: { labelled: boolean; onCreate: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentOrg, userRole } = useOrg();
  const { tournaments, currentTournament, setCurrentTournament } = useTournament();
  const worklist = useAdminWorklist();
  const chatUnread = useChatUnread(true);
  const { base, canUse, tournamentGroups: groups } = useAdminKitNav();
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set<string>());
  const [groupsReady, setGroupsReady] = useState(false);

  // The same stored preference, key and defaults as today's rail: a restyle must not reset an
  // organizer's open groups.
  useEffect(() => {
    if (groupsReady) return;
    const frame = window.requestAnimationFrame(() => {
      try {
        const parsed: unknown = JSON.parse(localStorage.getItem('fl_nav_groups') ?? 'null');
        if (Array.isArray(parsed) && parsed.every(v => typeof v === 'string')) {
          setOpenGroups(new Set(parsed as string[]));
          setGroupsReady(true);
          return;
        }
      } catch { /* fall through to the defaults */ }
      const status = currentTournament?.status ?? 'draft';
      setOpenGroups(new Set(TOUR_GROUPS.filter(g => g.defaultOpenFor.includes(status)).map(g => g.key)));
      setGroupsReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [groupsReady, currentTournament?.status]);

  function toggle(key: string) {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      try { localStorage.setItem('fl_nav_groups', JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }

  const allKeys = groups.flatMap(g => g.items.map(i => i.key));
  const itemActive = (key: string) => pathname.startsWith(`${base}/tournaments/${key}`)
    && !allKeys.some(k => k !== key && k.length > key.length && pathname.startsWith(`${base}/tournaments/${k}`));

  const slotLimit = currentOrg?.tournamentLimit ?? 9999;
  const atLimit = tournaments.length >= slotLimit;
  const billingHref = currentOrg ? getBillingHref(currentOrg.slug, currentOrg.planId) : `${base}/org/billing`;

  return (
    <>
      {labelled && <div className={styles.label}>Tournament</div>}
      {tournaments.length > 0 && (
        <div className={styles.switcher}>
          {tournaments.length > 1 ? (
            <select
              className={styles.switcherSelect}
              value={currentTournament?.id ?? ''}
              onChange={e => { const t = tournaments.find(x => x.id === e.target.value); if (t) setCurrentTournament(t); }}
              aria-label="Editing tournament"
              id="admin-tournament-select"
            >
              {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          ) : (
            <span className={styles.switcherName}>{currentTournament?.name}</span>
          )}
          {(userRole === 'owner' || userRole === 'admin') && (
            <button
              type="button"
              className={styles.switcherAdd}
              onClick={() => (atLimit && userRole === 'owner' ? router.push(billingHref) : atLimit ? undefined : onCreate())}
              disabled={atLimit && userRole !== 'owner'}
              title={atLimit && userRole === 'owner'
                ? `All ${slotLimit} tournament slot${slotLimit === 1 ? '' : 's'} used. Upgrade your plan to add more.`
                : atLimit ? 'Tournament slot limit reached. Ask your org owner to upgrade.' : 'Create a new tournament'}
              aria-label="Create new tournament"
            >
              <Plus size={14} aria-hidden />
            </button>
          )}
        </div>
      )}
      {groups.map(g => {
        const hasActive = g.items.some(i => itemActive(i.key));
        const open = openGroups.has(g.key) || hasActive;
        return (
          <div key={g.key}>
            <button
              type="button"
              className={`${styles.groupHeader}${hasActive ? ` ${styles.groupHeaderActive}` : ''}`}
              onClick={() => toggle(g.key)}
              aria-expanded={open}
            >
              <span className={styles.groupHeaderText}>{g.label}</span>
              <ChevronRight size={12} className={`${styles.chevron}${open ? ` ${styles.chevronOpen}` : ''}`} aria-hidden />
            </button>
            {open && g.items.map(i => (
              <RailRow
                key={i.key}
                href={`${base}/tournaments/${i.key}`}
                label={kitTournamentLabel(i.label)}
                active={itemActive(i.key)}
                icon={i.icon}
                count={worklist[i.key] ?? 0}
                chatUnread={i.key === 'chat' ? chatUnread : undefined}
              />
            ))}
          </div>
        );
      })}
      {canUse('module_accounting') && (
        <RailRow
          href={currentTournament ? `${base}/accounting?tournamentId=${currentTournament.id}` : `${base}/accounting`}
          label="Accounting"
          active={false}
          icon={DollarSign}
        />
      )}
    </>
  );
}

/**
 * The new-tournament wizard, mounted OUTSIDE the rail: the rail is `position: sticky`, which makes it
 * a stacking context, and a modal inside it would sit under the page it is meant to cover (today's
 * rail renders it outside its `<aside>` for the same reason).
 */
function CreateTournamentWizard({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { currentOrg, userRole, userCapabilities } = useOrg();
  const { tournaments, refresh } = useTournament();
  if (!currentOrg) return null;
  return (
    <TournamentSetupWizard
      isOpen
      orgSlug={currentOrg.slug}
      orgContactEmail={currentOrg.contactEmail ?? null}
      existingTournaments={tournaments.map(t => ({ id: t.id, name: t.name, year: t.year ?? null, status: t.status ?? null }))}
      sourceSurface="sidebar_create"
      previewOrg={currentOrg}
      canManageBranding={Boolean(userRole && hasCapability(userRole, userCapabilities, 'manage_branding'))}
      canClone={hasPlanFeature(currentOrg.planId, 'tournament_cloning')}
      upgradeCopy={requiresTournamentPlusCopy('tournament_cloning')}
      onClose={onClose}
      onCreated={async () => {
        onClose();
        await refresh();
        router.push(`/${currentOrg.slug}/admin/tournaments/dashboard`);
      }}
    />
  );
}
