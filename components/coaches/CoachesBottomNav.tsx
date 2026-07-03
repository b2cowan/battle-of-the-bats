'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Calendar, MessageSquare, Trophy,
  Users, UserCog, Megaphone, DollarSign, FileText, History,
  MoreHorizontal, X, ChevronRight, LogOut, HelpCircle, Settings, ClipboardList,
} from 'lucide-react';
import { signOut } from '@/lib/auth';
import { useOrg } from '@/lib/org-context';
import { useCoaches } from '@/lib/coaches-context';
import { useChatUnread } from '@/lib/use-chat-unread';
import styles from './CoachesBottomNav.module.css';

// The four primary tabs (owner-picked 2026-06-29). Everything else lives in More.
const TEAM_TABS = [
  { key: '',          icon: LayoutDashboard, label: 'Overview' },
  { key: '/schedule', icon: Calendar,        label: 'Schedule' },
  { key: '/chat',     icon: MessageSquare,   label: 'Chat'     },
  { key: '/roster',   icon: Users,           label: 'Roster'   },
];

// Remaining team sections — surfaced under More.
const MORE_TEAM = [
  { key: '/tryouts',       icon: ClipboardList, label: 'Tryouts'    },
  { key: '/tournaments',   icon: Trophy,     label: 'Tournaments'   },
  { key: '/announcements', icon: Megaphone,  label: 'Announcements' },
  { key: '/accounting',    icon: DollarSign, label: 'Accounting'    },
  { key: '/documents',     icon: FileText,   label: 'Documents'     },
  { key: '/history',       icon: History,    label: 'History'       },
  { key: '/staff',         icon: UserCog,    label: 'Staff'         },
  { key: '/settings',      icon: Settings,   label: 'Settings'      },
];

export default function CoachesBottomNav() {
  const pathname = usePathname();
  const router   = useRouter();
  const { currentOrg } = useOrg();
  const { assignments } = useCoaches();
  const orgSlug  = currentOrg?.slug ?? '';
  const base     = `/${orgSlug}/coaches`;

  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const chatUnread = useChatUnread();

  // The portal is team-scoped: use the team in the URL, otherwise default to the
  // coach's (only / first) team so the bar always points somewhere sensible. The
  // team switcher in More lets multi-team coaches change it.
  const teamMatch     = pathname.match(/\/coaches\/teams\/([^/]+)/);
  const urlTeamId     = teamMatch?.[1] ?? null;
  const currentTeamId = urlTeamId ?? assignments[0]?.teamId ?? null;
  const teamBase      = currentTeamId ? `${base}/teams/${currentTeamId}` : null;

  // Assistant Coaches: hide nav areas the current coach isn't cleared for (head coaches see all).
  const caps = (currentTeamId ? assignments.find(a => a.teamId === currentTeamId) : null)?.capabilities;
  const navVisible = (label: string): boolean => {
    if (!caps) return true;
    switch (label) {
      case 'Roster':        return caps.roster !== 'off';
      case 'Schedule':      return caps.schedule;
      case 'Tryouts':       return caps.tryouts;
      case 'Announcements': return caps.announcementsSend;
      case 'Accounting':    return caps.money !== 'off';
      case 'History':       return caps.money !== 'off';
      case 'Documents':     return caps.documents !== 'off';
      case 'Staff':         return caps.isHeadCoach;
      default:              return true;
    }
  };

  const isOnTeamMore = teamBase
    ? MORE_TEAM.some(({ key }) => pathname.startsWith(`${teamBase}${key}`))
    : false;

  function tabIsActive(key: string): boolean {
    if (!teamBase) return false;
    return key === '' ? pathname === teamBase : pathname.startsWith(`${teamBase}${key}`);
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    if (moreOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [moreOpen]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMoreOpen(false));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  async function handleLogout() {
    await signOut();
    router.push('/auth/login');
  }

  return (
    <nav className={styles.bottomNav} aria-label="Coaches mobile navigation">
      {/* Four primary team tabs */}
      {teamBase && TEAM_TABS.filter(({ label }) => navVisible(label)).map(({ key, icon: Icon, label }) => {
        const active = tabIsActive(key);
        const isChat = key === '/chat';
        return (
          <Link
            key={key || 'overview'}
            href={`${teamBase}${key}`}
            className={`${styles.tab} ${active ? styles.active : ''}`}
            id={`coaches-mob-${label.toLowerCase()}`}
            aria-label={isChat && chatUnread > 0 ? `Chat, ${chatUnread > 9 ? '9+' : chatUnread} unread` : undefined}
          >
            <span className={styles.iconWrap}>
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              {active && <span className={styles.activeDot} />}
              {isChat && chatUnread > 0 && (
                <span
                  aria-hidden
                  style={{ position: 'absolute', top: -2, right: 2, background: 'var(--logic-lime)', color: 'var(--pitch-black)', fontSize: '0.55rem', fontWeight: 800, borderRadius: 999, padding: '0 4px', minWidth: 14, height: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {chatUnread > 9 ? '9+' : chatUnread}
                </span>
              )}
            </span>
            <span className={styles.label}>{label}</span>
          </Link>
        );
      })}

      {/* More */}
      <div ref={moreRef} className={styles.moreWrap}>
        <button
          className={`${styles.tab} ${(moreOpen || isOnTeamMore) ? styles.active : ''}`}
          onClick={() => setMoreOpen(o => !o)}
          id="coaches-mob-more"
          aria-haspopup="true"
          aria-expanded={moreOpen}
        >
          <span className={styles.iconWrap}>
            {moreOpen
              ? <X size={22} strokeWidth={2} />
              : <MoreHorizontal size={22} strokeWidth={(moreOpen || isOnTeamMore) ? 2.5 : 1.8} />
            }
            {isOnTeamMore && !moreOpen && <span className={styles.activeDot} />}
          </span>
          <span className={styles.label}>More</span>
        </button>

        {moreOpen && (
          <div className={styles.dropdown} role="menu">
            {/* Team switcher — only earns its place with 2+ teams (mirrors the tournament switcher) */}
            {assignments.length > 1 && (
              <>
                <div className={styles.dropSectionLabel}>Your teams</div>
                {assignments.map(a => {
                  const active = currentTeamId === a.teamId;
                  return (
                    <Link
                      key={a.teamId}
                      href={`${base}/teams/${a.teamId}`}
                      className={`${styles.dropItem} ${active ? styles.dropActive : ''}`}
                      role="menuitem"
                    >
                      {a.teamColor && (
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: a.teamColor, flexShrink: 0 }} />
                      )}
                      <span>{a.teamName}</span>
                      <ChevronRight size={14} className={styles.dropChevron} />
                    </Link>
                  );
                })}
                <div className={styles.dropDivider} />
              </>
            )}

            {/* Remaining team sections */}
            {teamBase && (
              <>
                <div className={styles.dropSectionLabel}>Team</div>
                {MORE_TEAM.filter(({ label }) => navVisible(label)).map(({ key, icon: Icon, label }) => {
                  const href   = `${teamBase}${key}`;
                  const active = pathname.startsWith(href);
                  return (
                    <Link
                      key={key}
                      href={href}
                      className={`${styles.dropItem} ${active ? styles.dropActive : ''}`}
                      role="menuitem"
                    >
                      <Icon size={17} />
                      <span>{label}</span>
                      <ChevronRight size={14} className={styles.dropChevron} />
                    </Link>
                  );
                })}
                <div className={styles.dropDivider} />
              </>
            )}

            <Link
              href={`${base}/help`}
              className={styles.dropItem}
              role="menuitem"
              target="_blank"
              rel="noopener noreferrer"
            >
              <HelpCircle size={17} />
              <span>Help</span>
              <ChevronRight size={14} className={styles.dropChevron} />
            </Link>
            <button
              className={`${styles.dropItem} ${styles.dropLogout}`}
              onClick={handleLogout}
              role="menuitem"
              id="coaches-mob-logout"
            >
              <LogOut size={17} />
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
