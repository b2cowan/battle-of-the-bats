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
 *     keeps its place — the depth chart's player (register F-43) does exactly this. With NO neighbour at
 *     either end (a list of one) the row is not drawn at all: "1 of 1" on a row of its own said nothing
 *     and took a phone's room (owner, 2026-10-09, §285 W8). It is still a record. A window with
 *     steps opens with the PANEL focused, never a field: a record is read first, and a phone must not
 *     open its keyboard on the name.
 *   - `KitTitleField` as the `title` — the record's name is its one editor (the bill room's title
 *     slot): a dashed rule at rest and a pencil, NO required marker; the caller refuses an empty name
 *     in words (its save word's held state) and never sends one. Pass `ariaLabel` with it: the window
 *     keeps the record's saved name as its accessible name while the field is being typed in.
 *   - `status` — the record's transient save word: the kit's floating pill (`SavePill inline`), pinned to
 *     the bottom-right of the window's scrolling body, just above its foot — the portal's place for the
 *     word (owner, 2026-10-01: "our portal standard … the floating pill in the bottom right"; until then
 *     it sat in the head beside the name). The PAGE's pill sits under a window (250 < 400) and on a
 *     phone would cover Previous / Next, so the window carries its own, as the portal's award sheet does.
 *
 * WHY A BUTTON WAS REFUSED SITS BESIDE IT (owner, Ask 11, 2026-10-08: "when clicking create and I can't the error
 * message is not visible if I have scrolled"). A window with a foot carries a REASON SLOT between its two ends (on a
 * phone, a line above the buttons); the club money kit's window refusal (`FormError`) lands there, so it is seen at
 * any scroll and the window never jumps away from the row being fixed. It quiets on the next change inside the body
 * — a stale reason beside the button would mislead — and speaks again when a foot button is pressed or the reason
 * itself changes. A reason that belongs to ONE field stays under that field (`FormError inPlace`).
 *
 * A LEVEL INSIDE A WINDOW OPENS IN PLACE, BEHIND A NAMED BACK (Club Tier Stage 3d, Asks 2 and 4 — design decisions
 * 2026-10-08; the coaches portal's `RoomShell back`). A payee inside Payees, a team's bill inside its allocation: the
 * level takes the window's place, never a second window over it.
 *   - `back` — "← Payees" at the head's top left, above the eyebrow, on a computer; on a phone the head's own ← (which
 *     otherwise closes the form) goes up instead and names where ("Back to Payees"). The phone's Back gesture goes up
 *     too (the floor's `onBack`), so Back goes up one level before it goes out. × still closes the whole window.
 *   - `levelKey` — the level on screen: when it changes the body starts at its top and the keyboard stays in the window
 *     (the row that opened the level went with the old one).
 *
 * ONE FORM OVER ANOTHER (Stage 3d, Ask 7a — the kit's one exception to "a question over a form, nothing else"): `raised`
 * puts a form window on its own layer between the form layer and the question layer, with its own scrim over the form
 * beneath, so the payee picker's "Manage payees…" opens Payees over the entry being typed and closes back to it with
 * the typing kept.
 *
 * A WINDOW THAT IS A PLACE (Stage 3d — an allocation over Allocations): `address` writes it into the URL bar through the
 * window's own Back step (the floor's `address`, `useBackStep`), so Back and a copied link land on it and closing it
 * takes the address away again. ⚠ NEVER `router.replace` a window's address while it is open: the router's re-stamp of a
 * NEW url strips the step's marker off its entry, and the close then leaves a dead Back press behind (/review 2026-10-08).
 * The address is read when the step opens: a window whose level or record changes in place is re-keyed by its host. Escape, × and Back close the TOP window only (the floor answers the newest), the page-scroll lock is
 * a count, and a question opened from the raised window still lands on top of it. Mount it BESIDE the form it rises
 * over, never inside that form's body.
 */
import { createContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Check, Pencil, X } from 'lucide-react';
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

/** The window's foot slot for why its button was refused (see the header), and a way to speak again. Null outside
 *  a window with a foot: a refusal there stays where it is written. */
export const KitReasonSlot = createContext<{ slot: HTMLElement | null; reveal: () => void } | null>(null);

export default function KitDialog({
  kind,
  title,
  ariaLabel,
  eyebrow,
  identity,
  status,
  edit,
  onClose,
  children,
  footer,
  footerStart,
  steps,
  back,
  levelKey,
  address,
  busy = false,
  wide = false,
  raised = false,
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
  /** A record's transient save word (`SavePill inline`), floating at the body's bottom-right corner. */
  status?: ReactNode;
  /**
   * A record that opens to READ and is edited on purpose (owner, 2026-10-01 — the practice plan's
   * format as the standard: "it goes from full read only to full editing"). ONE borderless button in
   * the head, before ✕: a pencil while reading, a ✓ in its exact spot while editing, so focus and the
   * thumb stay where they were (the portal's award sheet). The caller owns what each mode shows.
   */
  edit?: { editing: boolean; onToggle: () => void; label: string; disabled?: boolean };
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
  /** A level inside this window: the level behind it, named ("Payees"), and the way up to it (see the header). */
  back?: { label: string; onBack: () => void };
  /** Which level is on screen — a change starts the body at its top and keeps the keyboard inside (see the header). */
  levelKey?: string;
  /** The window as a place in the URL bar, written by its Back step (see the header). */
  address?: string | null;
  /** While a save runs, Escape and the scrim do nothing. */
  busy?: boolean;
  /** A form whose body is a TABLE widens to fit it (Club Tier 3c: New allocation’s teams, “the window widens to fit
   *  its table”). A phone fills the screen either way. */
  wide?: boolean;
  /** A form opened from INSIDE another form stands one layer above it (see the header; Stage 3d, Ask 7a). */
  raised?: boolean;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const isRecord = steps != null;
  const hasFoot = footer != null || footerStart != null;
  const [reasonSlot, setReasonSlot] = useState<HTMLDivElement | null>(null);
  const [reasonQuiet, setReasonQuiet] = useState(false);
  const reason = useMemo(() => (hasFoot ? { slot: reasonSlot, reveal: () => setReasonQuiet(false) } : null), [hasFoot, reasonSlot]);
  // Mounted = open. Called BEFORE the focus effect below, so the floor records the opener while it
  // still has focus, then that effect moves the cursor into the first field. A level inside the window
  // gives the phone's Back somewhere to go first (`back`); the floor re-seats focus when the level changes.
  useDialogFloor(true, panelRef, { onClose, onBack: back?.onBack, busy, focusKey: levelKey ?? null, address: address ?? null });

  // A new level starts at its top (Previous / Next do the same through `step` below).
  const shownLevel = useRef(levelKey);
  useEffect(() => {
    if (shownLevel.current === levelKey) return;
    shownLevel.current = levelKey;
    bodyRef.current?.scrollTo({ top: 0 });
  }, [levelKey]);

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
      className={`${styles.overlay} ${kind === 'question' ? styles.overlayQuestion : styles.overlayForm}${raised && kind === 'form' ? ` ${styles.overlayRaised}` : ''}`}
      onPointerDown={e => {
        if (kind === 'question' && e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={`${styles.panel} ${kind === 'question' ? styles.question : styles.form}${wide ? ` ${styles.wide}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabel ? undefined : titleId}
        aria-label={ariaLabel}
        tabIndex={-1}
        data-kit-dialog=""
        data-record={isRecord || undefined}
        data-raised={(raised && kind === 'form') || undefined}
      >
        <div className={styles.head}>
          {kind === 'form' && (
            /* A phone's ← goes up a level when there is one ("Back to Payees"), else it closes the form. */
            <button type="button" className={styles.back} onClick={back ? back.onBack : onClose}
              aria-label={back ? `Back to ${back.label}` : 'Back'} disabled={busy}>
              <ArrowLeft size={20} aria-hidden />
            </button>
          )}
          <div className={styles.titleBlock}>
            {back && kind === 'form' && (
              <button type="button" className={styles.namedBack} onClick={back.onBack} disabled={busy}>
                <ArrowLeft size={14} aria-hidden />{back.label}
              </button>
            )}
            {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
            <h2 id={titleId} className={styles.title}>{title}</h2>
            {identity && <p className={styles.identity}>{identity}</p>}
          </div>
          {edit && (
            <button type="button" className={styles.edit} onClick={edit.onToggle} disabled={edit.disabled || busy}
              aria-label={edit.editing ? 'Done editing' : edit.label} aria-pressed={edit.editing} title={edit.editing ? 'Done' : 'Edit'}>
              {edit.editing ? <Check size={18} aria-hidden /> : <Pencil size={17} aria-hidden />}
            </button>
          )}
          {kind === 'form' && (
            <button type="button" className={styles.close} onClick={onClose} aria-label="Close" disabled={busy}>
              <X size={16} aria-hidden />
            </button>
          )}
        </div>
        <KitReasonSlot.Provider value={reason}>
          <div className={styles.bodyWrap} data-has-status={status != null || undefined}>
            {/* Any change in the body quiets the reason beside the button: it was about what was there before. */}
            <div ref={bodyRef} className={styles.body}
              onInputCapture={hasFoot ? () => setReasonQuiet(true) : undefined}
              onChangeCapture={hasFoot ? () => setReasonQuiet(true) : undefined}
              // A button in the body changes the form too (All, None, a row's chevron, "Use the bill's schedule").
              onClickCapture={hasFoot ? e => { if ((e.target as HTMLElement).closest('button')) setReasonQuiet(true); } : undefined}>{children}</div>
            {status != null && <div className={styles.status}>{status}</div>}
          </div>
          {hasFoot && (
            <div className={styles.foot} onClickCapture={() => setReasonQuiet(false)}>
              {footerStart && <div className={styles.footStart}>{footerStart}</div>}
              <div ref={setReasonSlot} className={`${styles.footReason}${reasonQuiet ? ` ${styles.footReasonQuiet}` : ''}`} />
              {footer != null && <div className={styles.footEnd}>{footer}</div>}
            </div>
          )}
        </KitReasonSlot.Provider>
        {/* A list of ONE has no neighbours: the row would hold only "1 of 1" (owner, 2026-10-09, §285 W8). */}
        {steps && (steps.prev || steps.next) && (
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
 *
 * ⚠ NO SCREEN USES THIS NOW — DO NOT REACH FOR IT (owner, 2026-10-01). Its one user, Teams' team record,
 * now reads first and is edited whole (the practice plan's format, the standard): the window's `edit`
 * pencil turns every section into fields, the record's name among them; the title is the plain name.
 * Kept only until the portal's bill room, the idiom's origin, is judged against the same standard.
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
