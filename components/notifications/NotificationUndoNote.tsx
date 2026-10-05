'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLatestRef } from '@/components/coaches/useLatestRef';
import type { NotificationFeed } from './useNotificationFeed';
import styles from './NotificationUndoNote.module.css';

/**
 * "Notification deleted · Undo" — the note a delete leaves for a few seconds (owner ruling
 * 2026-10-05, D3: "Undo for a few seconds, no confirmation"; drawn on the hub's screen 6).
 *
 * ⚖ PLACED CENTRED UNDER THE PAGE'S OWN COLUMN, at the window's foot — 12px above the phone's
 * bottom bar, 1rem above the window's edge on a computer (owner, 2026-10-05, Q1 = A on the
 * "Undo Note Placement" drawing; not the save pill's corner: that word is never touched, this one
 * has a button to reach in six seconds). The page column is centred in the space BESIDE the rail,
 * not in the window, so the note measures the column it is rendered in rather than reading one
 * shell's rail width — the club's page wears another shell. The bell's drawer (step 2) puts the
 * same note at the drawer's foot instead.
 *
 * Focus: the trash that was pressed left with its row or its sheet, so focus fell to the page — the
 * note takes it, so a keyboard can Undo at once (a mouse delete shows no ring: focus-visible follows
 * the pointer). When the note goes while it holds focus, focus moves to `returnFocusTo`, never to
 * nowhere. The live region stays mounted so its words are announced when they appear.
 */
export default function NotificationUndoNote({
  feed,
  returnFocusTo,
}: {
  feed: Pick<NotificationFeed, 'pendingDelete' | 'undoDelete'>;
  /** Where focus goes when the note leaves while holding it (the list). */
  returnFocusTo: () => void;
}) {
  const { pendingDelete, undoDelete } = feed;
  const anchorRef = useRef<HTMLDivElement>(null);
  const [centre, setCentre] = useState<number | null>(null);

  const measure = useCallback(() => {
    const host = anchorRef.current?.parentElement;
    if (!host) return;
    const r = host.getBoundingClientRect();
    setCentre(r.left + r.width / 2);
  }, []);

  useLayoutEffect(() => {
    if (!pendingDelete) return;
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [pendingDelete, measure]);

  const count = pendingDelete?.length ?? 0;
  return (
    <>
      <div ref={anchorRef} className={styles.anchor} aria-hidden />
      <div
        className={styles.region}
        style={centre === null ? undefined : { left: `${centre}px` }}
        role="status"
      >
        {pendingDelete && (
          <UndoPill
            key={pendingDelete[0]?.id}
            words={count > 1 ? `${count} notifications deleted` : 'Notification deleted'}
            onUndo={undoDelete}
            returnFocusTo={returnFocusTo}
          />
        )}
      </div>
    </>
  );
}

function UndoPill({ words, onUndo, returnFocusTo }: {
  words: string;
  onUndo: () => void;
  returnFocusTo: () => void;
}) {
  const undoRef = useRef<HTMLButtonElement>(null);
  const returnRef = useLatestRef(returnFocusTo);

  // Focus fell to the page with the trash that was pressed: Undo takes it.
  // ⚠ This holds because a delete takes its OPENER with it in the same commit: the reader's floor
  // returns focus to the row it opened from, and that row is gone, so focus is still on <body> here.
  // A delete entry point whose opener stays connected (a drawer's row trash, step 2) gets focus put
  // back on that opener by its own surface, and this check rightly leaves it there — so that surface
  // must decide for itself whether focus belongs on Undo.
  useEffect(() => {
    const active = document.activeElement;
    if (!active || active === document.body) undoRef.current?.focus();
  }, []);

  // A LAYOUT cleanup on purpose: it runs while the button is still in the document, so it can tell
  // whether the note is leaving WITH focus (a passive cleanup runs after removal, when focus has
  // already fallen to <body> and nothing says where it was). The hand-off waits a microtask, until
  // the commit has finished, and happens only if the button really left: development's Strict Mode
  // unmounts and remounts every effect once WITHOUT removing the DOM, and an unconditional hand-off
  // there would pull focus off Undo the moment it arrived — the owner tests on the dev server.
  useLayoutEffect(() => {
    const undo = undoRef.current;
    const handBack = () => returnRef.current();   // the LATEST target, read when it is called
    return () => {
      if (!undo || document.activeElement !== undo) return;
      queueMicrotask(() => {
        const active = document.activeElement;
        if (!undo.isConnected && (!active || active === document.body)) handBack();
      });
    };
  }, [returnRef]);

  return (
    <span className={styles.note}>
      {words}
      <button ref={undoRef} type="button" className={styles.undo} onClick={onUndo}>Undo</button>
    </span>
  );
}
