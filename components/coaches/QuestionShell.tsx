'use client';
import type { ReactNode } from 'react';
import coach from '@/app/[orgSlug]/coaches/coaches.module.css';
import KitDialog, { DialogCancel } from '@/components/admin/kit/club/KitDialog';
import UnsavedChangesGuard from '@/components/shared/UnsavedChangesGuard';

/** A Cancel inside a coach form that closes the way ×, Escape and Back do — through the ask when `dirty`. */
export { DialogCancel as QuestionCancel };

/**
 * THE QUESTION — the one modal chrome a form stands in (List · Room · Question, owner-ruled
 * 2026-09-02; built with Phase B, 2026-09-02, when the fundraising rooms needed five of them at
 * once). A Question only ever asks: a create or edit form, a compact correction, a named-dollar
 * confirm. It stacks at most once over a list or a room.
 *
 * ⚖ SINCE ONE WINDOW STAGE 2 (owner rulings Q1–Q16 2026-10-18, A–D 2026-10-19) IT IS A THIN WRAPPER OVER THE ONE
 * WINDOW, `KitDialog` (kind "form"), which owns everything this shell used to: the overlay (a full-screen sheet on
 * a phone, ← at its top left), the head, the window floor (`useDialogFloor`: Escape, the Tab trap, focus home, the
 * phone's Back), registering with the portal's overlay counter (the phone bars step aside, the page stops
 * scrolling), and closing with words typed (`dirty`: the foot asks "Close without saving?" — Keep writing ·
 * Discard — in the window, never in a second one). A tap outside does nothing, typed or not (answer B).
 * What it keeps: its name and props, the ROUTE guard (`UnsavedChangesGuard`, which stays armed while the form is
 * dirty even when `open` is false — the hub keeps hidden panels mounted, typing intact), and the coach forms' own
 * type (`ownType`). What it does NOT own: the form. The consumer renders its own `<form>` and fields as children;
 * its Cancel is `QuestionCancel`.
 *
 * ⚠ CLOSE IS BUSY-GATED: the window never dismisses while a save is in flight (the club fold's /review lesson).
 *
 * ⚠ `open` should include the consumer's `tabActive` for a form whose state survives a tab switch
 * (the hub keeps panels mounted, hidden): a floor left armed on a hidden panel answered a bare
 * Escape on whatever tab the coach was on. The portaled Record conversation is the one exception
 * and does not use this shell.
 *
 * ⚖ STAGE 2a SHIM: a consumer's own `.modalFooter` inside its children is laid out as the window's foot by the
 * `.windowBody` rules in `coaches.module.css`, and stands down while the window asks. Sub-part 2b moves every
 * consumer's buttons into the window's foot, and the shim goes. `scroll` is a no-op now (the window's body
 * scrolls, its head stays) and leaves with it. `wide` is the window's 640 (`size="medium"`).
 */
export default function QuestionShell({
  open,
  onClose,
  onBack,
  ariaLabel,
  title,
  subtitle,
  headerExtra,
  busy = false,
  wide = false,
  leaveGuard,
  raised = false,
  dirty = false,
  children,
}: {
  open: boolean;
  /** Closes the window. With `dirty`, the window asks first; never called while `busy`. */
  onClose: () => void;
  /** A view BEHIND this one — the phone's back arrow and its Back gesture go there instead of closing. */
  onBack?: () => void;
  /** Names the question for assistive tech — "Edit the amount Avery Test raised". */
  ariaLabel: string;
  title: ReactNode;
  subtitle?: ReactNode;
  /** One mark between the title and the X — the lineup lens's status symbol. Not a slot for controls. */
  headerExtra?: ReactNode;
  busy?: boolean;
  /** A no-op since Stage 2a (the window's body scrolls); callers drop it in 2b. */
  scroll?: boolean;
  /** The 640px window — for a form with two columns or a control beside a long label. */
  wide?: boolean;
  /** Typed work the ROUTE guard protects (a link, a reload), the message in its own words. Its `dirty` is the window's
   *  own `dirty` unless a caller says otherwise (a form whose state outlives its window). Link clicks are intercepted
   *  only while the tab is on screen (see UnsavedChangesGuard's `interceptClicks`). */
  leaveGuard?: { dirty?: boolean; message: string; tabActive?: boolean };
  /** Asked from a window that is itself raised over another — stand with it (the one window's raised layer). */
  raised?: boolean;
  /** Something is typed that closing would lose: ×, ←, Cancel (`QuestionCancel`), Escape and Back ask in the foot. */
  dirty?: boolean;
  children: ReactNode;
}) {
  /* The reload warning stays armed while the form is dirty even if its tab is hidden (the hub
     keeps the panel mounted, typing intact); only the link interception follows the tab, so a
     dirty form on a hidden tab never blocks a click on the tab the coach is actually reading. */
  const guardDirty = leaveGuard?.dirty ?? dirty;
  const guard = leaveGuard ? (
    <UnsavedChangesGuard
      active={guardDirty}
      interceptClicks={guardDirty && (leaveGuard.tabActive ?? true)}
      message={leaveGuard.message}
    />
  ) : null;

  if (!open) return guard;

  return (
    <>
      <KitDialog
        kind="form"
        title={title}
        ariaLabel={ariaLabel}
        identity={subtitle}
        headerExtra={headerExtra}
        onClose={onClose}
        back={onBack ? { onBack } : undefined}
        busy={busy}
        size={wide ? 'medium' : undefined}
        raised={raised}
        dirty={dirty}
        openOn="panel"
        ownType
      >
        <div className={coach.windowBody}>{children}</div>
      </KitDialog>
      {guard}
    </>
  );
}
