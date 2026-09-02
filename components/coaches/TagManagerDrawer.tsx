'use client';
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import Link from 'next/link';
import TagManagerList, { type TagManagerListHandle } from '@/components/coaches/TagManagerList';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import type { ComboTag } from '@/components/coaches/TagSearchCombobox';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

const FOCUSABLE = 'a[href], button:not([disabled]), summary, input, select, [tabindex]:not([tabindex="-1"])';

/**
 * The DRAWER frame of the tag manager (One Tag Idiom P1; owner-ratified 2026-09-01 from the
 * clickable prototype in `docs/projects/active/COACH_TAGGING_DRAWER_PROTO.html`, which is the
 * visual spec). The list itself — rename/merge/delete, counts, shared rows, the delete grammar —
 * lives in `TagManagerList`, shared verbatim with the Team settings Tags shelf: ONE manager, two
 * frames, and the behaviour must never fork between them.
 *
 * ⚠⚠ **This is the coach portal's FIRST working-surface side sheet, and it stays its ONLY one
 * without a further owner ruling.** It exists because a coach mid-form (the drawer opens from a
 * picker inside the Add-a-bill modal, among others) must be able to fix a typo without losing
 * their typing — the owner explicitly refused navigate-to-settings from an open form. It is not
 * a general pattern licence.
 *
 * Dismissal is LAYERED and the form underneath never hears it: Escape (the list's handler, with
 * `onFullyDismiss` closing the drawer) and the scrim both back out exactly one layer. Focus
 * follows the platform overlay conventions (the HelpDrawer/BottomSheet pattern): into the panel
 * on open, Tab cycles inside it, and the opener gets focus back on close.
 */
export default function TagManagerDrawer({
  teamId,
  tags,
  title,
  itemNoun,
  basePath,
  countNoun,
  onClose,
  onChanged,
}: {
  teamId: string;
  /** First-paint library — own and org-shared. The list re-fetches `basePath` itself for counts. */
  tags: readonly ComboTag[];
  /** The library's name — "Money tags", "Game tags", "Focus tags" (Q6: the manager is titled by its library). */
  title: string;
  /** Singular noun for the merge sentence — "expense", "game", "drill, template or focus area". */
  itemNoun: string;
  basePath: string;
  /** Formats a nonzero usage count — defaults to "on N records". */
  countNoun?: (n: number) => string;
  onClose: () => void;
  onChanged: () => void;
}) {
  // Parent conditionally mounts this component only while open — one unit for the whole mount.
  useOverlayOpen(true);

  const [entered, setEntered] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const listRef = useRef<TagManagerListHandle>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Slide in, remember and take focus on mount; give focus back on unmount.
  useEffect(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const raf = requestAnimationFrame(() => setEntered(true));
    panelRef.current?.focus();
    return () => {
      cancelAnimationFrame(raf);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      restoreFocusRef.current?.focus?.();
    };
  }, []);

  function close() {
    if (closeTimerRef.current) return; // already closing
    const reduced = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { onClose(); return; }
    setEntered(false);
    closeTimerRef.current = setTimeout(onClose, 200);
  }

  /** The scrim runs the same one-layer grammar as Escape — a stray click outside must never
   *  discard a half-typed rename in one step (the fundraiser board's own rule). */
  function onScrim() {
    if (!listRef.current?.dismissOneLayer()) close();
  }

  /** Tab focus trap (the HelpDrawer/BottomSheet pattern) — focus cycles inside the drawer. */
  function onPanelKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusables.length === 0) {
      e.preventDefault();
      panel.focus();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  /* The shelf link, restored now that P4 built the shelf it points at (the P1 hold is honoured —
     a door to a screen that does not exist is the 404 bug in politer clothes). Derived from
     `basePath` rather than a new prop through ten call sites: every tag route is
     /api/coaches/{org}/teams/{team}/… by construction (the route factory's own shape), and the
     settings section deep-link is the CoachCollapseSection `?section=` contract. */
  const m = basePath.match(/^\/api\/coaches\/([^/]+)\/teams\/([^/]+)\//);
  const settingsHref = m ? `/${m[1]}/coaches/teams/${m[2]}/settings?section=tags` : null;

  return (
    <>
      <div className={styles.tagDrawerScrim} onPointerDown={onScrim} />
      <aside
        ref={panelRef}
        tabIndex={-1}
        className={`${styles.tagDrawer} ${entered ? styles.tagDrawerIn : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={onPanelKeyDown}
      >
        <div className={styles.tagDrawerHead}>
          <h3 className={styles.tagDrawerTitle}>{title}</h3>
          <button type="button" className={styles.tagDrawerClose} aria-label="Close" onClick={close}>
            <X size={18} aria-hidden />
          </button>
        </div>

        <TagManagerList
          ref={listRef}
          teamId={teamId}
          tags={tags}
          itemNoun={itemNoun}
          basePath={basePath}
          countNoun={countNoun}
          onChanged={onChanged}
          onFullyDismiss={close}
        />

        <div className={styles.tagDrawerFoot}>
          {settingsHref && (
            <Link className={styles.tagDrawerFootLink} href={settingsHref}>
              All tag libraries → Team settings
            </Link>
          )}
          <button type="button" className={styles.btnGhost} onClick={close}>Done</button>
        </div>
      </aside>
    </>
  );
}
