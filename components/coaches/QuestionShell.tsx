'use client';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import coach from '@/app/[orgSlug]/coaches/coaches.module.css';
import KitDialog, { DialogCancel, DialogReason } from '@/components/admin/kit/club/KitDialog';
import UnsavedChangesGuard from '@/components/shared/UnsavedChangesGuard';

/** A Cancel in a coach form's foot that closes the way ×, Escape and Back do — through the ask when `dirty`. */
export { DialogCancel as QuestionCancel };
/** Why the foot's button was refused, written in the form and shown in the foot's reason slot, at any scroll. */
export { DialogReason as QuestionReason };

/* A coach page's save pill rides just above the TOP coach window's foot on a phone (coaches.module.css, the §227
   rule). The foot is one row of buttons at rest and grows a line while it asks or gives a reason, so the window reports
   its height (KitDialog's `onFootHeight`) and the newest open window's is published as `--coach-window-foot`, written
   only when it changes (a custom property on the root restyles the whole page). */
const openFeet: Array<{ height: number }> = [];
let publishedFoot = '';
function publishFoot() {
  const top = openFeet[openFeet.length - 1];
  // A window with no foot (the lineup's check and inning) publishes nothing: the pill keeps its resting one-row height
  // rather than dropping over the body's last line (/review 2026-10-19).
  const value = top?.height ? `${top.height}px` : '';
  if (value === publishedFoot) return;
  publishedFoot = value;
  const root = document.documentElement.style;
  if (value) root.setProperty('--coach-window-foot', value);
  else root.removeProperty('--coach-window-foot');
}

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
 * its buttons are the window's `footer` (a submit names its form with `form=`, the admin's idiom), its Cancel is
 * `QuestionCancel`, and a refused save's reason is `QuestionReason` (shown in the foot, beside the button).
 *
 * ⚠ CLOSE IS BUSY-GATED: the window never dismisses while a save is in flight (the club fold's /review lesson).
 *
 * ⚠ `open` should include the consumer's `tabActive` for a form whose state survives a tab switch
 * (the hub keeps panels mounted, hidden): a floor left armed on a hidden panel answered a bare
 * Escape on whatever tab the coach was on. The one exception is the Record money form (Money's
 * expenses panel), which is PORTALED into the portal's warm root and so is on screen whenever it is
 * open, whichever tab is showing: its `open` is its own (One Window 2d).
 *
 * ⚖ ITS BUTTONS ARE THE WINDOW'S FOOT (Stage 2b, 2026-10-19): `footer` (buttons only) and `footerStart` (a sentence
 * or a door at the left), KitDialog's own — never a `.modalFooter` in the children (guarded). The window's body
 * scrolls and its head and foot stay. `wide` is the window's 640 (`size="medium"`), `widest` its 800 (`size="wide"`,
 * One Window 2c: a review step that carries a row of fields and a verdict per row).
 *
 * ⚖ IT ALSO DRAWS THE COACHES PORTAL'S ONE "ARE YOU SURE" (`kind="question"`, One Window answer D and Q11/Q12,
 * 2026-10-19 — Close the season, Delete a budget line): KitDialog's small centred question with the coach rules
 * above (no phone keyboard on open, the portal's own type). No ×; Escape, the phone's Back and a tap outside are its
 * "no", through the same closer as its Cancel. A small card in the middle of a phone, never a full-screen sheet. A
 * form's things (`wide`, `widest`, `onBack`, `raised`, `dirty`, the page pill's foot) do not apply to it. ⚠ The name is
 * history: "Question" was this shell's word for a FORM long before the yes/no window joined it.
 */
export default function QuestionShell({
  kind = 'form',
  open,
  onClose,
  onBack,
  levelKey,
  ariaLabel,
  eyebrow,
  title,
  subtitle,
  headerExtra,
  busy = false,
  wide = false,
  widest = false,
  leaveGuard,
  raised = false,
  dirty = false,
  footer,
  footerStart,
  children,
}: {
  /** A form (the default), or the small centred "are you sure" — see the header. */
  kind?: 'form' | 'question';
  open: boolean;
  /** Closes the window. With `dirty`, the window asks first; never called while `busy`. */
  onClose: () => void;
  /** A view BEHIND this one — the phone's back arrow and its Back gesture go there instead of closing. */
  onBack?: () => void;
  /** The screen on show, for a window that swaps its whole body in place (Categories & items' list ↔ fold): when it
   *  changes the body starts at its top and the keyboard stays in the window (KitDialog's `levelKey`). */
  levelKey?: string;
  /** Names the question for assistive tech — "Edit the amount Avery Test raised". */
  ariaLabel: string;
  /** The record the window acts on, over its title ("Halvorsen Plumbing" over "Invoice") — a long name never wraps
   *  the title on a phone (Sponsor Invoice design review, 2026-10-20). KitDialog's own eyebrow. */
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** One mark between the title and the X — the lineup lens's status symbol. Not a slot for controls. */
  headerExtra?: ReactNode;
  busy?: boolean;
  /** The 640px window — for a form with two columns or a control beside a long label. */
  wide?: boolean;
  /** The 800px window — a review table whose rows carry several fields and a reason each (Bring in a schedule). */
  widest?: boolean;
  /** Typed work the ROUTE guard protects (a link, a reload), the message in its own words. Its `dirty` is the window's
   *  own `dirty` unless a caller says otherwise (a form whose state outlives its window). Link clicks are intercepted
   *  only while the tab is on screen (see UnsavedChangesGuard's `interceptClicks`). */
  leaveGuard?: { dirty?: boolean; message: string; tabActive?: boolean };
  /** Asked from a window that is itself raised over another — stand with it (the one window's raised layer). */
  raised?: boolean;
  /** Something is typed that closing would lose: ×, ←, Cancel (`QuestionCancel`), Escape and Back ask in the foot. */
  dirty?: boolean;
  /** The window's buttons, at the foot's right: Cancel (`QuestionCancel`), then the main one. BUTTONS ONLY. */
  footer?: ReactNode;
  /** The foot's far left: a sentence, or a door that shares the main act's row (Remove). */
  footerStart?: ReactNode;
  children: ReactNode;
}) {
  /* The reload warning stays armed while the form is dirty even if its tab is hidden (the hub
     keeps the panel mounted, typing intact); only the link interception follows the tab, so a
     dirty form on a hidden tab never blocks a click on the tab the coach is actually reading. */
  // This window's foot, on the stack while it is open (the window's own effect reports a height first). A FORM's only:
  // the pill's measured rule is a phone form's, and a question is a small card over whatever it asks about.
  const foot = useRef({ height: 0 });
  const isForm = kind === 'form';
  useEffect(() => {
    if (!open || !isForm) return;
    const entry = foot.current;
    openFeet.push(entry);
    publishFoot();
    return () => { openFeet.splice(openFeet.indexOf(entry), 1); publishFoot(); };
  }, [open, isForm]);
  const onFootHeight = useCallback((height: number) => {
    foot.current.height = height;
    if (openFeet[openFeet.length - 1] === foot.current) publishFoot();
  }, []);

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
        kind={kind}
        eyebrow={eyebrow}
        title={title}
        ariaLabel={ariaLabel}
        identity={subtitle}
        headerExtra={headerExtra}
        onClose={onClose}
        back={isForm && onBack ? { onBack } : undefined}
        levelKey={levelKey}
        busy={busy}
        size={!isForm ? undefined : widest ? 'wide' : wide ? 'medium' : undefined}
        raised={raised}
        dirty={isForm && dirty}
        footer={footer}
        footerStart={footerStart}
        openOn="panel"
        ownType
        onFootHeight={isForm ? onFootHeight : undefined}
      >
        <div className={coach.windowBody}>{children}</div>
      </KitDialog>
      {guard}
    </>
  );
}
