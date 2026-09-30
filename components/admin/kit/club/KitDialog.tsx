'use client';
/**
 * KitDialog — the admin kit's window, in the two kinds the portal's rulings allow (Club Tier Stage 1,
 * screens session; the modal ruling: "a window is for a question or a form"):
 *
 *   question — a small centred window that asks one thing ("Suspend Sam Okafor?", "Move to Club ·
 *              Association?"). A scrim tap or Escape is "no".
 *   form     — a larger window that collects something (Invite, Manage). On a phone it FILLS the
 *              screen and covers the bar, with ← at the top left — the drawer-layers ruling
 *              (2026-09-23): a FORM covers the nav, a MENU sits on top of it. A scrim tap does not
 *              throw a half-filled form away; Cancel, ← and Escape do.
 *
 * A question can open ON TOP of a form (Suspend asks first, from inside Manage): it stacks one
 * layer higher.
 *
 * ⚠ NOT PORTALLED. The admin kit's tokens (the warm palette, R1's colours) live on a wrapper above
 * the shell; a window portalled to <body> would render outside it, in the wrong palette. It renders
 * where it is mounted, `position: fixed`, above the phone bar's layer.
 * ⚠ Admin only: nothing outside the admin shell mounts it. TOKENS ONLY (the scrim is the one exemption,
 * annotated — the kit's "themed scrim" gap, ADC Phase 0).
 *
 * THE PORTAL'S WINDOW FLOOR (Admin Design Continuity slice 6, owner 2026-09-27: "build it here"). Every
 * window stands on the coaches portal's own `useDialogFloor`: Tab is trapped inside the panel, focus
 * returns to the button that opened it, Escape closes the TOP window only, and the phone's Back closes
 * the top window (one history step per window, the shared Back stack — a question over a form closes
 * alone). All of it holds while `busy`. Before this the club windows hand-rolled Escape and nothing
 * else: a keyboard walked out behind the window, and Back left the page from under it.
 * ⚠ A QUESTION IS role="dialog", as the portal's own questions are (`QuestionShell`). The floor reads an
 * `alertdialog` as a confirmation docked INSIDE a panel and holds Back while one is on screen, so the
 * old role would have made Back do nothing on every club question.
 * ⚠ A BUTTON THAT CLOSES A WINDOW AND NAVIGATES (`router.push`) must navigate with the window still
 * open: the step tidies its history entry one tick after the click, before the router has pushed the
 * new address, and that Back cancels the navigation (`useBackStep`'s header). Settings' "Save your
 * changes?" is the one case today.
 *
 * A RECORD OPENED FROM A LIST (Tournament admin redesign Stage 2, design decisions 2026-09-30 — the
 * coaches portal's own answers, now the admin's; first used by the tournament team record, the club's
 * records when their stages draw them):
 *   - `steps` — the foot names the record before and after it in the list it was opened from, with the
 *     position between ("‹ Previous · Falcons U11 Girls · 3 of 8 · Next › · Ravens U11 Girls"; "3 of 8
 *     in U11 Girls" at a desk). Stepping keeps the window open, starts the next record at its top and
 *     puts the keyboard in the window. At either END of the list that button is ABSENT and the position
 *     keeps its place — the depth chart's player (register F-43) does exactly this. A window with
 *     steps opens with the PANEL focused, never a field: a record is read first, and a phone must not
 *     open its keyboard on the name.
 *   - `KitTitleField` as the `title` — the record's name is its one editor (the bill room's title
 *     slot): a dashed rule at rest and a pencil, NO required marker; the caller refuses an empty name
 *     in words (its save word's held state) and never sends one. Pass `ariaLabel` with it: the window
 *     keeps the record's saved name as its accessible name while the field is being typed in.
 *   - `status` — the record's transient save word, in the head (which never scrolls), beside the name.
 *     The page's floating `SavePill` sits UNDER a window (250 < 400), so a window's word lives here.
 */
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { ArrowLeft, Pencil, X } from 'lucide-react';
import { useDialogFloor } from '@/components/coaches/useDialogFloor';
import styles from './KitDialog.module.css';

// The page stops scrolling while ANY window is open, and scrolls again only when the LAST one closes.
// A count, not a per-window "put back what I found": a question over a form, both unmounted at once
// (Remove confirmed → the form closes with it), would otherwise each restore the value it saw on
// opening — and whichever cleaned up last could leave the page frozen.
let openWindows = 0;
let pageOverflow = '';
function lockPageScroll() {
  if (openWindows === 0) { pageOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
  openWindows += 1;
}
function unlockPageScroll() {
  openWindows = Math.max(0, openWindows - 1);
  if (openWindows === 0) document.body.style.overflow = pageOverflow;
}

/** One neighbour of a record in the list it was opened from. */
export type KitStep = { name: string; onStep: () => void };

export default function KitDialog({
  kind,
  title,
  ariaLabel,
  eyebrow,
  identity,
  status,
  onClose,
  children,
  footer,
  footerStart,
  steps,
  busy = false,
}: {
  kind: 'question' | 'form';
  title: ReactNode;
  /** The window's accessible name when `title` is a control (`KitTitleField`): the record's SAVED name. */
  ariaLabel?: string;
  /** The record the window is about, ABOVE the title ("9U A" over "Start the 2027 Season?"). */
  eyebrow?: ReactNode;
  /** A form's identity line under its title (Manage: "sam@example.com · Admin since August 2026").
   *  Not a page header, so it keeps its second line (hub v8). */
  identity?: ReactNode;
  /** A record's transient save word (`SavePill inline`), in the head beside the name. */
  status?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** The window's own actions, right-aligned: Cancel, then the primary. A record that saves as you go
   *  has none — its foot is its `steps`. */
  footer?: ReactNode;
  /** The far-left of the footer — a destructive door kept away from Save (Manage's Suspend…). */
  footerStart?: ReactNode;
  /** A record opened from a list: its neighbours, named, and where it sits ("3 of 8"; `positionWide`,
   *  "3 of 8 in U11 Girls", above a phone). `noun` names what steps for a screen reader ("team"). */
  steps?: { prev: KitStep | null; next: KitStep | null; position: string; positionWide?: string; noun: string };
  /** While a save runs, Escape and the scrim do nothing. */
  busy?: boolean;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const isRecord = steps != null;
  // Mounted = open. Called BEFORE the focus effect below, so the floor records the opener while it
  // still has focus, then that effect moves the cursor into the first field.
  useDialogFloor(true, panelRef, { onClose, busy });

  useEffect(() => {
    const panel = panelRef.current;
    // Focus the first field (a form) or the panel itself (a question, or a record — read first, and no
    // phone keyboard opening on its name), so the keyboard is inside.
    const first = isRecord ? null : panel?.querySelector<HTMLElement>('[data-autofocus], input:not([type=hidden]), select, textarea');
    (first ?? panel)?.focus();
    lockPageScroll();
    return unlockPageScroll;
    // Mount only: stepping to the next record is not a new window.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Previous / Next: the caller swaps the record; the window stays, starts it at its top, and keeps
   *  the keyboard inside (the depth chart's player). */
  const step = (target: KitStep) => {
    target.onStep();
    bodyRef.current?.scrollTo({ top: 0 });
    panelRef.current?.focus({ preventScroll: true });
  };

  return (
    <div
      className={`${styles.overlay} ${kind === 'question' ? styles.overlayQuestion : styles.overlayForm}`}
      onPointerDown={e => {
        if (kind === 'question' && e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={`${styles.panel} ${kind === 'question' ? styles.question : styles.form}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabel ? undefined : titleId}
        aria-label={ariaLabel}
        tabIndex={-1}
        data-kit-dialog=""
        data-record={isRecord || undefined}
      >
        <div className={styles.head}>
          {kind === 'form' && (
            <button type="button" className={styles.back} onClick={onClose} aria-label="Back" disabled={busy}>
              <ArrowLeft size={20} aria-hidden />
            </button>
          )}
          <div className={styles.titleBlock}>
            {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
            <h2 id={titleId} className={styles.title}>{title}</h2>
            {identity && <p className={styles.identity}>{identity}</p>}
          </div>
          {status != null && <div className={styles.status}>{status}</div>}
          {kind === 'form' && (
            <button type="button" className={styles.close} onClick={onClose} aria-label="Close" disabled={busy}>
              <X size={16} aria-hidden />
            </button>
          )}
        </div>
        <div ref={bodyRef} className={styles.body}>{children}</div>
        {(footer != null || footerStart != null) && (
          <div className={styles.foot}>
            {footerStart && <div className={styles.footStart}>{footerStart}</div>}
            {footer != null && <div className={styles.footEnd}>{footer}</div>}
          </div>
        )}
        {steps && (
          <nav className={`${styles.foot} ${styles.steps}`} aria-label={`Other ${steps.noun}s in this list`}>
            {steps.prev && (
              <button type="button" className={styles.step} onClick={() => step(steps.prev!)} disabled={busy}
                aria-label={`Previous ${steps.noun}, ${steps.prev.name}`}>
                <span className={styles.stepWord} aria-hidden>‹ Previous</span>
                <span className={styles.stepName} aria-hidden>{steps.prev.name}</span>
              </button>
            )}
            <span className={styles.stepPos}>
              <span className={styles.stepPosShort}>{steps.position}</span>
              <span className={styles.stepPosWide}>{steps.positionWide ?? steps.position}</span>
            </span>
            {steps.next && (
              <button type="button" className={`${styles.step} ${styles.stepNext}`} onClick={() => step(steps.next!)} disabled={busy}
                aria-label={`Next ${steps.noun}, ${steps.next.name}`}>
                <span className={styles.stepWord} aria-hidden>Next ›</span>
                <span className={styles.stepName} aria-hidden>{steps.next.name}</span>
              </button>
            )}
          </nav>
        )}
      </div>
    </div>
  );
}

/**
 * A record's NAME AS ITS TITLE, editable in place — the bill room's title slot (the coaches portal's
 * CommitmentView), now the admin kit's. It must READ as the title and BEHAVE as a field: its dashed
 * rule is there at REST with a pencil beside it (owner §114 walk, 2026-08-27: a rule that appeared only
 * on hover was a control nobody on a phone could see). NO required marker — a record's name in the
 * title slot is exempt (2026-09-03/04). The caller holds an empty name back from autosave and says why.
 * Read-only viewers get the plain name instead: pass the text, not this.
 */
export function KitTitleField({ value, onChange, label, placeholder, maxLength = 200 }: {
  value: string;
  onChange: (value: string) => void;
  /** The field's own name ("Team name"). */
  label: string;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <span className={styles.titleField}>
      <input
        className={styles.titleInput}
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label={label}
        placeholder={placeholder}
        maxLength={maxLength}
      />
      <Pencil size={13} aria-hidden className={styles.titlePencil} />
    </span>
  );
}
