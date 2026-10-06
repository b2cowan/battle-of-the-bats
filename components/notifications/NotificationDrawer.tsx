'use client';
import {
  useCallback, useEffect, useId, useMemo, useRef, useState,
  type Dispatch, type KeyboardEvent, type ReactNode, type RefObject, type SetStateAction,
} from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { BellOff, CheckCheck, ChevronRight, Settings, Trash2, X } from 'lucide-react';
import type { AppNotification } from '@/lib/types';
import {
  BUNDLE_NOUN, FEED_CAUGHT_UP, FEED_EMPTY_COPY, entryKey, entryMembers, groupActivityItems, iconFor,
  notificationTime, type ActivityEntry,
} from '@/lib/notification-view';
import { coachWarmAttr } from '@/lib/coach-warm-preview';
import { PortalKitRoot } from '@/components/admin/AdminKitProvider';
import { useDialogFloor } from '@/components/coaches/useDialogFloor';
import { useLatestRef } from '@/components/coaches/useLatestRef';
import NotificationMessage from './NotificationMessage';
import NotificationUndoNote from './NotificationUndoNote';
import { useNotificationFeed } from './useNotificationFeed';
import buttons from './notification-buttons.module.css';
import styles from './notifications.module.css';

/**
 * THE BELL'S DRAWER — notifications on a computer (owner rulings 2026-10-05, "Notifications Open in
 * Place" D1 · D2 · D6 · D7; step 2's undrawn parts ruled 2026-10-06 on hub screen 9). Replaces the
 * bell's 320px panel, whose rows were cut to one line and whose click left for a page it never named.
 *
 *   · The drawer IS the list (D6): 380px on the right, the full height under the top strip, the page
 *     dimmed lightly behind it. Unread / All (opens on Unread — an inbox you empty, step 2 Q3), Mark all
 *     read when anything is unread, Needs attention pinned ("stays until you mark it Done"), the rest by
 *     day with same-type bundles, Load more, the settings gear and × in its head. No "See all": a link
 *     to a page holding the same list would be a second place on a computer to read it.
 *   · A click OPENS a notification (D1, D2): a 440px pane to the LEFT of the list holds the shared
 *     message block (`NotificationMessage`), and opening reads it. The row stays, highlighted
 *     (`aria-current`); another row swaps the message; × on the pane goes back to the list alone. A row
 *     opened during this visit stays in the list until the drawer closes, even under Unread.
 *   · Two panes at every width the drawer exists (D7) — it exists only beside the top strip, above
 *     900px; a window narrowed past that closes it, as the strip and its bell leave.
 *   · Delete (D3): the trash on the row under the pointer or the keyboard, and in the pane; the
 *     "Notification deleted · Undo" note sits centred under the list at its foot (Q1 = A).
 *
 * ⚖ IT STANDS ON THE PORTAL'S WINDOW FLOOR (`useDialogFloor`), as the club's windows and the coach
 * reader do: Tab stays inside, focus goes back to the bell on close, and Escape and the browser's Back
 * go up ONE level — the message first, then the drawer (D2: "Escape closes the message first"). The
 * floor's closer is read fresh on every key, so it is whichever level is on top. A press outside the
 * drawer and the bell closes it; the dim closes it on its own CLICK, inside the boundary, so the click
 * never lands on the page the dim was covering (the scrim-outside-its-boundary trap).
 *
 * ⚖ THE BELL'S COUNT FOLLOWS THE DRAWER: the feed keeps a running unread count (every read, Done, Mark
 * all read, delete and Undo). The drawer hands up the server's own count once, on load, and after that
 * MOVES the bell by what the drawer changed — never overwrites it — so a notification that arrives while
 * the drawer is open keeps the +1 the bell's live listener gave it (/review 2026-10-06: an absolute push
 * erased it). That arrival joins this list only when the drawer is opened again, as with the panel.
 * Mark all read sets the bell to zero outright: the server reads every unread row, arrivals included.
 *
 * ⚠ PORTALED TO <body>, so it carries the shells' theme markers itself: the coaches marker (the warm
 * palette, or the dark one under an explicit Dark), and inside the admin `PortalKitRoot` adds the
 * admin kit's — the bell's panel carried only the first, so in the admin it missed the kit's own
 * rules. A marker on the drawer's own root would not satisfy that root's own `[marker] .x` rules, so
 * both ride on box-less wrappers above it (the admin layout's shape).
 */
export default function NotificationDrawer({
  orgId,
  portal,
  settingsHref,
  bellRef,
  onClose,
  onUnreadChange,
}: {
  orgId: string;
  /** Whose words: the onward button's page names (D4) and the empty list's sentence. */
  portal: 'admin' | 'coach';
  /** Notification settings — the gear in the head. */
  settingsHref?: string;
  /** The bell's own wrapper: a press on it toggles the drawer, so it is inside the boundary. */
  bellRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  /** The bell's count setter — given the server's count once, then a change to apply to its own. */
  onUnreadChange: Dispatch<SetStateAction<number>>;
}) {
  // The rows this visit opened or marked Done — kept in the list under Unread until the drawer closes
  // (D2; Done "stays in your list below, read", hub screen 6). The drawer's own memory of the visit; the
  // feed only honours it. Mark all read adds nothing: reading everything empties Unread to "caught up".
  const [kept, setKept] = useState<ReadonlySet<string>>(() => new Set());
  const keep = useCallback((ids: string[]) => setKept(prev => new Set([...prev, ...ids])), []);
  const feed = useNotificationFeed(orgId, { unreadOnly: true, keep: kept });
  const {
    items, loading, loadingMore, hasMore, error, isEmpty, unreadOnly, setUnreadOnly, reload, loadMore,
    markSeen, markAllRead, clearRow, deleteRows, needsAttention, activityGroups, showNeeds, showActivity,
    groupedAt, anyUnread, unreadCount,
  } = feed;

  const rootRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const headId = useId();
  const messageTitleId = useId();
  // The row focus goes back to when the Undo note leaves holding it: the one that took the deleted row's place.
  const afterDeleteRef = useRef<string | null>(null);

  // ── What is open — kept as a snapshot, read through the LIVE rows ─────────────────────────────
  // Opening reads the row a moment later, and Done's rollback restores the row it is handed: reading
  // through `items` hands every action the row as it is now, never as it was when it was clicked.
  const [opened, setOpened] = useState<ActivityEntry | null>(null);
  const open = useMemo<ActivityEntry | null>(() => {
    if (!opened) return null;
    const live = new Map(items.map(x => [x.id, x]));
    if (opened.kind === 'item') {
      const n = live.get(opened.notification.id);
      return n ? { kind: 'item', notification: n } : null;
    }
    const members = opened.members.flatMap(m => live.get(m.id) ?? []);
    return members.length > 0 ? { ...opened, members } : null;
  }, [opened, items]);
  const openKey = open ? entryKey(open) : null;

  // ── Focus ─────────────────────────────────────────────────────────────────────────────────────
  /** Put the keyboard on a row by its key, once the commit that moved it has landed — Done moves a row
   *  from Needs attention into its day, a new element — falling back to the list. */
  const focusRow = useCallback((key: string | null) => {
    window.requestAnimationFrame(() => {
      const row = key ? drawerRef.current?.querySelector<HTMLElement>(`[data-row-key="${CSS.escape(key)}"]`) : null;
      (row ?? bodyRef.current)?.focus();
    });
  }, []);

  const closePane = useCallback(() => {
    setOpened(null);
    focusRow(openKey);
  }, [focusRow, openKey]);

  // A message that opens takes the keyboard to its title, so it is read from the top.
  useEffect(() => {
    if (openKey) titleRef.current?.focus({ preventScroll: true });
  }, [openKey]);

  // Escape and Back: the message, then the drawer.
  useDialogFloor(true, drawerRef, { onClose: open ? closePane : onClose });

  // ── Outside the drawer and the bell, a press closes it; so does losing the top strip ──────────
  // A local listener rather than `useDismissable`, as the coach reader's: that hook also answers Escape
  // and CLAIMS it, which would take the key from the floor above — and the floor's Escape is the one
  // that closes the message before the drawer. The 900px is the top strip's own breakpoint: the bell
  // lives in the strip, and a window narrowed past it has neither.
  const closeRef = useLatestRef(onClose);
  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || bellRef.current?.contains(target)) return;
      closeRef.current();
    };
    document.addEventListener('pointerdown', onPointer);
    const narrow = window.matchMedia('(max-width: 900px)');
    const onNarrow = () => { if (narrow.matches) closeRef.current(); };
    narrow.addEventListener('change', onNarrow);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      narrow.removeEventListener('change', onNarrow);
    };
  }, [bellRef, closeRef]);

  // ── The bell's count follows the drawer ───────────────────────────────────────────────────────
  // The server's count once, then only what changed (see the header): the bell's own listener may have
  // counted an arrival this list does not hold, and an absolute push would erase it.
  const countRef = useLatestRef(onUnreadChange);
  const pushedRef = useRef<number | null>(null);
  useEffect(() => {
    if (unreadCount === null) return;
    const before = pushedRef.current;
    pushedRef.current = unreadCount;
    if (before === null) countRef.current(unreadCount);
    else if (unreadCount !== before) countRef.current(c => Math.max(0, c + unreadCount - before));
  }, [unreadCount, countRef]);

  /** Mark all read reads every unread row on the server, arrivals included — the bell goes to zero. */
  function readAll() {
    pushedRef.current = 0;
    countRef.current(0);
    void markAllRead();
  }

  // ── Actions ───────────────────────────────────────────────────────────────────────────────────
  function openEntry(entry: ActivityEntry) {
    const members = entryMembers(entry);
    setOpened(entry);
    keep(members.map(m => m.id));
    void markSeen(members);
  }

  /** Done — from the row or the pane. The row moves into its day, read, and stays in view this visit. */
  function markDone(n: AppNotification) {
    keep([n.id]);
    void clearRow(n);
  }

  /** Delete from a row or the pane. The note takes the keyboard (what had it left with the row or the
   *  pane); when the note goes, the keyboard comes back to the row that took the deleted one's place. */
  function deleteEntry(key: string, members: AppNotification[]) {
    const rows = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>('[data-row-key]') ?? []);
    const at = rows.findIndex(r => r.dataset.rowKey === key);
    afterDeleteRef.current = (rows[at + 1] ?? rows[at - 1])?.dataset.rowKey ?? null;
    const gone = new Set(members.map(m => m.id));
    if (open && entryMembers(open).some(m => gone.has(m.id))) setOpened(null);
    deleteRows(members);
  }

  function onRowKey(e: KeyboardEvent<HTMLDivElement>, entry: ActivityEntry) {
    if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    openEntry(entry);
  }

  // ── Rows — the bell's own: one line of title and one of message, Done on a Needs-attention row ──
  /** One row, a notification or a bundle: it opens on a click, Enter or Space, carries the selection,
   *  the unread dot and the trash; `children` is what differs between the two. */
  function row(entry: ActivityEntry, { unread, act = false, label, children }: {
    unread: boolean; act?: boolean; label: string; children: ReactNode;
  }) {
    const key = entryKey(entry);
    const members = entryMembers(entry);
    const selected = openKey === key;
    const className = [
      styles.notifItem,
      unread ? styles.unread : styles.notifRead,
      act ? styles.actItem : '',
      selected ? styles.selected : '',
    ].filter(Boolean).join(' ');
    return (
      <div
        key={key}
        data-row-key={key}
        className={className}
        role="button"
        tabIndex={0}
        aria-current={selected ? 'true' : undefined}
        onClick={() => openEntry(entry)}
        onKeyDown={e => onRowKey(e, entry)}
      >
        <span className={styles.notifIcon} aria-hidden>{iconFor(members[0].eventType)}</span>
        {children}
        {unread && <span className={styles.notifDot} aria-label="Unread" />}
        <button
          type="button"
          className={styles.rowTrash}
          aria-label={`Delete “${label}”`}
          title="Delete"
          onClick={e => { e.stopPropagation(); deleteEntry(key, members); }}
          onKeyDown={e => e.stopPropagation()}
        >
          <Trash2 size={14} aria-hidden />
        </button>
      </div>
    );
  }

  function itemRow(n: AppNotification, isAct: boolean) {
    return row({ kind: 'item', notification: n }, {
      unread: !n.readAt,
      act: isAct,
      label: n.title,
      children: (
        <div className={styles.notifContent}>
          <p className={styles.notifTitle}>{n.title}</p>
          {n.body && <p className={styles.notifBody}>{n.body}</p>}
          {isAct ? (
            /* Done rides the meta line so it costs the title and body no width. It stops propagation:
               the row OPENS the notification, and being finished with one is a different gesture. */
            <div className={styles.notifMeta}>
              <span className={styles.notifTime}>{notificationTime(n.createdAt, groupedAt, { withDay: true })}</span>
              <button
                type="button"
                className={styles.clearBtn}
                aria-label={`Mark “${n.title}” done`}
                onClick={e => { e.stopPropagation(); markDone(n); }}
                onKeyDown={e => e.stopPropagation()}
              >
                Done
              </button>
            </div>
          ) : (
            <p className={styles.notifTime}>{notificationTime(n.createdAt, groupedAt)}</p>
          )}
        </div>
      ),
    });
  }

  function bundleRow(entry: Extract<ActivityEntry, { kind: 'bundle' }>) {
    const title = `${entry.members.length} ${BUNDLE_NOUN[entry.eventType] ?? 'notifications'}`;
    return row(entry, {
      unread: entry.members.some(m => !m.readAt),
      label: title,
      children: (
        <>
          <div className={styles.notifContent}>
            <p className={styles.notifTitle}>{title}</p>
            <p className={styles.notifTime}>{notificationTime(entry.members[0].createdAt, groupedAt)}</p>
          </div>
          <ChevronRight size={14} className={styles.bundleChevron} aria-hidden />
        </>
      ),
    });
  }

  // ── The four quiet states (hub screen 9, Q2: the Notifications page's own words) ──────────────
  function quiet() {
    if (loading) return <p className={styles.loadingRow}>Loading…</p>;
    if (error) {
      return (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}><BellOff size={18} aria-hidden /></span>
          <p className={styles.errorLine} role="alert">
            Couldn’t load your notifications.{' '}
            <button type="button" className={styles.retryBtn} onClick={reload}>Try again</button>
          </p>
          <p className={styles.emptyNote}>Nothing was marked read.</p>
        </div>
      );
    }
    if (items.length === 0) {
      const copy = FEED_EMPTY_COPY[portal];
      return (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}><BellOff size={18} aria-hidden /></span>
          <p className={styles.emptyHeadline}>{copy.headline}</p>
          {copy.description && <p className={styles.emptyDesc}>{copy.description}</p>}
          {copy.note && <p className={styles.emptyNote}>{copy.note}</p>}
        </div>
      );
    }
    if (unreadOnly) {
      return (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}><CheckCheck size={18} aria-hidden /></span>
          <p className={styles.emptyHeadline}>{FEED_CAUGHT_UP.headline}</p>
          <p className={styles.emptyDesc}>{FEED_CAUGHT_UP.lead} <strong>{FEED_CAUGHT_UP.view}</strong> {FEED_CAUGHT_UP.tail}</p>
        </div>
      );
    }
    return (
      <div className={styles.emptyState}>
        <span className={styles.emptyIcon}><BellOff size={18} aria-hidden /></span>
        <p className={styles.emptyHeadline}>Nothing in this view</p>
      </div>
    );
  }

  const layer = (
    <div ref={rootRef} className={styles.layer} data-notification-drawer>
      <div className={styles.scrim} aria-hidden onClick={onClose} />
      <div
        ref={drawerRef}
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headId}
        tabIndex={-1}
      >
        {open && (
          <section className={styles.pane} aria-labelledby={messageTitleId}>
            <button type="button" className={`${styles.iconBtn} ${styles.paneClose}`} aria-label="Close this notification" title="Close this notification" onClick={closePane}>
              <X size={18} aria-hidden />
            </button>
            {/* The message scrolls inside the pane, under the × — a long one never scrolls the way out away. */}
            <div className={styles.paneScroll}>
              <NotificationMessage
                entry={open}
                portal={portal}
                titleId={messageTitleId}
                titleRef={titleRef}
                onDone={n => { markDone(n); closePane(); }}
                onDelete={members => deleteEntry(entryKey(open), members)}
              />
            </div>
          </section>
        )}

        <div className={styles.list}>
          <div className={styles.head}>
            <h2 id={headId} className={styles.headTitle}>Notifications</h2>
            {settingsHref && (
              <Link href={settingsHref} className={styles.iconBtn} aria-label="Notification settings" title="Notification settings" onClick={onClose}>
                <Settings size={18} aria-hidden />
              </Link>
            )}
            <button type="button" className={styles.iconBtn} aria-label="Close notifications" title="Close" onClick={onClose}>
              <X size={18} aria-hidden />
            </button>
          </div>

          <div className={styles.tools}>
            <div className={styles.seg} role="group" aria-label="Read filter">
              <button type="button" aria-pressed={unreadOnly}
                className={`${styles.segBtn}${unreadOnly ? ` ${styles.segBtnActive}` : ''}`}
                onClick={() => setUnreadOnly(true)}>Unread</button>
              <button type="button" aria-pressed={!unreadOnly}
                className={`${styles.segBtn}${!unreadOnly ? ` ${styles.segBtnActive}` : ''}`}
                onClick={() => setUnreadOnly(false)}>All</button>
            </div>
            {anyUnread && (
              <button type="button" className={buttons.btn} onClick={readAll}>
                <CheckCheck size={14} aria-hidden /> Mark all read
              </button>
            )}
          </div>

          <div ref={bodyRef} className={styles.body} tabIndex={-1}>
            {loading || error || isEmpty ? quiet() : (
              <>
                {showNeeds && (
                  <>
                    <div className={`${styles.sectionHeader} ${styles.sectionHeaderAct}`}>
                      <span>Needs attention</span>
                      <span className={styles.sectionCount}>{needsAttention.length}</span>
                      <span className={styles.sectionHint}>stays until you mark it Done</span>
                    </div>
                    {needsAttention.map(n => itemRow(n, true))}
                  </>
                )}
                {showActivity && activityGroups.map(g => (
                  <div key={g.label}>
                    <div className={styles.dateHeader}>{g.label}</div>
                    {groupActivityItems(g.items).map(entry =>
                      entry.kind === 'bundle' ? bundleRow(entry) : itemRow(entry.notification, false),
                    )}
                  </div>
                ))}
              </>
            )}
            {/* Load more whenever there is more — under "caught up" too: the first page can be all read
                with older unread rows behind it, and Unread must still reach them (/review 2026-10-06;
                the page draws its Load more outside its states for the same reason). */}
            {!loading && !error && hasMore && (
              <div className={styles.more}>
                <button type="button" className={buttons.btn} onClick={() => void loadMore()} disabled={loadingMore}>
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </div>

          <NotificationUndoNote feed={feed} placement="drawer" returnFocusTo={() => focusRow(afterDeleteRef.current)} />
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(
    <PortalKitRoot>
      <div style={{ display: 'contents' }} {...coachWarmAttr}>{layer}</div>
    </PortalKitRoot>,
    document.body,
  );
}
