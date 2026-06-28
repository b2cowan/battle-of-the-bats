'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutGrid, Calendar, Users, DollarSign, FileText,
  History, MoreHorizontal, X, ChevronRight, LogOut,
  HelpCircle, Settings, MessageSquare, Trophy,
} from 'lucide-react';
import { signOut } from '@/lib/auth';
import { useOrg } from '@/lib/org-context';
import { useChatUnread } from '@/lib/use-chat-unread';
import styles from './CoachesBottomNav.module.css';

const TEAM_MORE = [
  { key: '/roster',      icon: Users,      label: 'Roster'      },
  { key: '/tournaments', icon: Trophy,     label: 'Tournaments' },
  { key: '/accounting',  icon: DollarSign, label: 'Accounting'  },
  { key: '/documents',   icon: FileText,   label: 'Documents'   },
  { key: '/history',     icon: History,    label: 'History'     },
  { key: '/settings',    icon: Settings,   label: 'Settings'    },
];

export default function CoachesBottomNav() {
  const pathname = usePathname();
  const router   = useRouter();
  const { currentOrg } = useOrg();
  const orgSlug  = currentOrg?.slug ?? '';
  const base     = `/${orgSlug}/coaches`;

  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const teamMatch    = pathname.match(/\/coaches\/teams\/([^/]+)/);
  const currentTeamId = teamMatch?.[1] ?? null;
  const teamBase     = currentTeamId ? `${base}/teams/${currentTeamId}` : null;

  const isOnTeamMore = currentTeamId
    ? TEAM_MORE.some(({ key }) => pathname.startsWith(`${base}/teams/${currentTeamId}${key}`))
    : false;
  const isOnSchedule = currentTeamId
    ? pathname.startsWith(`${base}/teams/${currentTeamId}/schedule`)
    : false;
  const isOnChat = currentTeamId
    ? pathname.startsWith(`${base}/teams/${currentTeamId}/chat`)
    : false;
  const chatUnread = useChatUnread();
  const isHubActive  = !isOnTeamMore && !isOnSchedule && !isOnChat;

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
      {/* My Teams */}
      <Link
        href={base}
        className={`${styles.tab} ${isHubActive ? styles.active : ''}`}
        id="coaches-mob-hub"
      >
        <span className={styles.iconWrap}>
          <LayoutGrid size={22} strokeWidth={isHubActive ? 2.5 : 1.8} />
          {isHubActive && <span className={styles.activeDot} />}
        </span>
        <span className={styles.label}>My Teams</span>
      </Link>

      {/* Schedule — only when inside a specific team */}
      {teamBase && (
        <Link
          href={`${teamBase}/schedule`}
          className={`${styles.tab} ${isOnSchedule ? styles.active : ''}`}
          id="coaches-mob-schedule"
        >
          <span className={styles.iconWrap}>
            <Calendar size={22} strokeWidth={isOnSchedule ? 2.5 : 1.8} />
            {isOnSchedule && <span className={styles.activeDot} />}
          </span>
          <span className={styles.label}>Schedule</span>
        </Link>
      )}

      {/* Chat — only when inside a specific team */}
      {teamBase && (
        <Link
          href={`${teamBase}/chat`}
          className={`${styles.tab} ${isOnChat ? styles.active : ''}`}
          id="coaches-mob-chat"
          aria-label={chatUnread > 0 ? `Chat, ${chatUnread > 9 ? '9+' : chatUnread} unread` : undefined}
        >
          <span className={styles.iconWrap}>
            <MessageSquare size={22} strokeWidth={isOnChat ? 2.5 : 1.8} />
            {isOnChat && <span className={styles.activeDot} />}
            {chatUnread > 0 && (
              <span
                aria-hidden
                style={{ position: 'absolute', top: -2, right: 2, background: 'var(--logic-lime)', color: 'var(--pitch-black)', fontSize: '0.55rem', fontWeight: 800, borderRadius: 999, padding: '0 4px', minWidth: 14, height: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {chatUnread > 9 ? '9+' : chatUnread}
              </span>
            )}
          </span>
          <span className={styles.label}>Chat</span>
        </Link>
      )}

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
            {currentTeamId && teamBase && (
              <>
                <div className={styles.dropSectionLabel}>Team</div>
                {TEAM_MORE.map(({ key, icon: Icon, label }) => {
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
