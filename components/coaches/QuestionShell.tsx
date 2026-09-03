'use client';
import { useRef, type ReactNode } from 'react';
import coach from '@/app/[orgSlug]/coaches/coaches.module.css';
import CoachModalHeader from './CoachModalHeader';
import UnsavedChangesGuard from '@/components/shared/UnsavedChangesGuard';
import { useOverlayOpenIfAvailable } from '@/lib/coaches-overlay';
import { useDialogFloor } from './useDialogFloor';

/**
 * THE QUESTION — the one modal chrome a form stands in (List · Room · Question, owner-ruled
 * 2026-09-02; built with Phase B, 2026-09-02, when the fundraising rooms needed five of them at
 * once). A Question only ever asks: a create or edit form, a compact correction, a named-dollar
 * confirm. It stacks at most once over a list or a room.
 *
 * What it owns, so no consumer hand-rolls it again: the shared overlay (which is a full-screen
 * sheet ≤640 with no opt-in), the portal's modal header, the scroll-lock counter, the
 * accessibility floor (`useDialogFloor`: dialog role, a label, Escape, the Tab trap, focus
 * restore) and — when the form has typing to lose — the ROUTE guard (`UnsavedChangesGuard`) that
 * asks before a link or a reload throws it away. What it does NOT own: the form. The consumer
 * renders its own `<form>` or grid and its own `.modalFooter` as children, because the fields ARE
 * the question.
 *
 * ⚠ CLOSE IS BUSY-GATED, and `onClose` is the consumer's GUARDED closer (`useDiscardGuard`): this
 * shell never decides whether typed work may be lost, and never dismisses while a save is in
 * flight — the club fold's /review lesson, carried to every dismissible container.
 *
 * ⚠ `open` should include the consumer's `tabActive` for a form whose state survives a tab switch
 * (the hub keeps panels mounted, hidden): a floor left armed on a hidden panel answered a bare
 * Escape on whatever tab the coach was on. The portaled Record conversation is the one exception
 * and does not use this shell.
 *
 * `scroll` is the tall-form variant (`modalScrollBody`): the header and footer pin while the
 * fields scroll between them. A compact question leaves it off.
 */
export default function QuestionShell({
  open,
  onClose,
  ariaLabel,
  title,
  subtitle,
  busy = false,
  scroll = false,
  leaveGuard,
  children,
}: {
  open: boolean;
  /** The consumer's guarded closer. Never called while `busy`. */
  onClose: () => void;
  /** Names the question for assistive tech — "Edit the amount Avery Test raised". */
  ariaLabel: string;
  title: ReactNode;
  subtitle?: ReactNode;
  busy?: boolean;
  scroll?: boolean;
  /** Typed work the ROUTE guard protects (a link, a reload) — `dirty` from the consumer's own
   *  baseline, the message in its own words. Link clicks are intercepted only while the tab is on
   *  screen (see UnsavedChangesGuard's `interceptClicks`). */
  leaveGuard?: { dirty: boolean; message: string; tabActive?: boolean };
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useOverlayOpenIfAvailable(open);
  useDialogFloor(open, panelRef, { onClose, busy });

  /* The reload warning stays armed while the form is dirty even if its tab is hidden (the hub
     keeps the panel mounted, typing intact); only the link interception follows the tab, so a
     dirty form on a hidden tab never blocks a click on the tab the coach is actually reading. */
  const guard = leaveGuard ? (
    <UnsavedChangesGuard
      active={leaveGuard.dirty}
      interceptClicks={leaveGuard.dirty && (leaveGuard.tabActive ?? true)}
      message={leaveGuard.message}
    />
  ) : null;

  if (!open) return guard;

  const requestClose = () => { if (!busy) onClose(); };

  return (
    <>
      <div
        className={coach.modalOverlay}
        onPointerDown={event => { if (event.target === event.currentTarget) requestClose(); }}
      >
        <div
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          aria-busy={busy || undefined}
          className={`${coach.modal} ${scroll ? coach.modalScrollBody : ''}`}
          onClick={event => event.stopPropagation()}
        >
          <CoachModalHeader
            title={title}
            subtitle={subtitle}
            onClose={requestClose}
            titleTag="h2"
            closeIconSize={18}
          />
          {children}
        </div>
      </div>
      {guard}
    </>
  );
}
