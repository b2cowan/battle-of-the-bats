'use client';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { FilterSheetRow, useFilterGroupMember } from './FilterGroup';
import SheetFrame from './SheetFrame';
import useDetailsOutsideClick from './useDetailsOutsideClick';
import styles from '../shared/FilterPill.module.css';

/**
 * PICK ONE — the single-select member of the reporting control family, beside
 * `MultiSelectDropdown` (checkboxes, empty = all) and `DateRangeDropdown` (a window).
 *
 * ⚠⚠ ONE CONTROL SHAPE ACROSS THE REPORTS (owner instruction 2026-08-19, reaffirmed and REWORDED
 * 2026-08-20). Payables' `Group by` and Budget vs. Actual's `View` / `Showing` do the same job —
 * choose how one set of records is laid out — and until now they wore two different looks in one
 * product: a labelled pill on Transactions, a bank of segmented buttons on the report.
 *
 * ⚠ THE REWORDING MATTERS, because the rule it replaces was never the owner's. A plan document had
 * written "two or three fixed, permanent options → pills stay; a dropdown for two things is a click
 * tax" underneath the owner's actual instruction, and it was quoted back at them as their own words
 * (caught 2026-08-20). The standing rule is now: **one shape, and short lists judged case by case,
 * with clutter counted as a real cost** — five pill groups of two options each put ten things on
 * screen where five dropdowns put five. `Group by` has exactly two options and is a dropdown for
 * that reason, not in spite of it.
 *
 * ⚠ `<details>`, NOT A HAND-ROLLED POPOVER (memory: CollapsibleCard primitive) — free keyboard
 * support, no portal or positioning code, and it closes itself on a repeat click. The one thing it
 * does not do natively is close on an outside click: `useDetailsOutsideClick`, shared with both
 * siblings.
 *
 * ⚖ ON A PHONE THE PICKS RISE IN THE PORTAL'S SHEET (owner 2026-10-18: "we have a standard convention"). The
 * floating panel was the pill's only form at every width, so on a phone the Families Show pill, the club's Year,
 * Team, Book and View pills and the coach's report pills opened a 190px box over the search and the first rows.
 * At ≤640 (`useIsPhone`, the Filter and Tools sheets' band) a tap on the pill opens `SheetFrame` in the MENU
 * layer instead — a pick applies at once and loses nothing, so the bar stays live (Sheet Frame D1) — headed by
 * the pill's own label in small capitals (D2), with the same rows, counts and foot as the panel. The `<details>`
 * stays the pill on a phone and simply never opens: its summary's click is taken before it toggles. A pill
 * drawn as a row of a `FilterGroup` sheet is already in a sheet, and a pill in that group's desk box is hidden
 * on a phone, so neither asks.
 */
export default function SingleSelectDropdown({
  label,
  options,
  value,
  onChange,
  lead = false,
  shrink = false,
  fill = false,
  foot,
  restQuiet = false,
  restValue,
  labelSuffix,
}: {
  /** Sits to the left of the chosen value — "Group by", "View", "Showing". */
  label: string;
  /** `detail` is a quiet figure at the option's end (a book's balance — the club's Book pill, Stage 3a). `mark` is a
   *  GLYPH after the label with its own spoken name (the club's Year pill: a lock on a closed year — Stage 3c), drawn
   *  beside the chosen value in the pill too. `pillMark` is drawn ONLY beside the chosen value, never in the row: the
   *  Year pill's dot on the year today falls in, which in the row sat beside the picked row's own dot and read as
   *  two of one thing (owner, §283 walk, 2026-10-08). `rowMark` is the reverse — ONLY in the row, never in the pill:
   *  the club's Team pill's amber waiting count beside each team in its list, where the team on screen already says
   *  its own (Needs you), as the Teams division picker's closed box leaves out the current division's count (the
   *  waiting-count ruling, 2026-10-01). `faceLabel` is the words the PILL's face shows for the chosen option when they differ from the row's (the club's Born in
   *  pill: the row reads "Any year", the face "Born in: any year"). `group` puts the option under a heading in the panel
   *  (below). All opt-in; no
   *  portal strip passes one. */
  options: readonly { id: string; label: string; detail?: string; mark?: ReactNode; pillMark?: ReactNode; rowMark?: ReactNode; faceLabel?: string; group?: string }[];
  value: string;
  onChange: (next: string) => void;
  /**
   * Does this pill choose WHAT IS READ rather than narrow it — the scope (the club's Year, the Ledger's
   * Book) or the arrangement (View)? It leads the strip and takes the accent, so it never reads as
   * another narrowing (plan §7). At most one scope and one arrangement, in that order (the club's Budget
   * and Budget vs. Actual lead Year · View, ruled with the Stage 3b drawings 2026-10-06; /design §271,
   * 2026-10-07). A narrowing is never `lead` — it takes `restQuiet`.
   */
  lead?: boolean;
  /**
   * May the pill give way in a tight row — its chosen value ellipsised rather than the row wrapping? The
   * club Ledger's Book pill, whose book names run long, beside three 44px icons on a phone (Ledger
   * Parity, 2026-10-02). Opt-in: a View or Group by value is always short.
   */
  shrink?: boolean;
  /**
   * Does the pill TAKE its row on a phone — grow to the row's width, its chevron at the far end? The club's Team pill,
   * whose row holds only Export (Club Accounting · Teams' phone drawing: "the Team pill takes the toolbar"). Opt-in; a
   * desk keeps the pill's own width, and every other caller is unchanged.
   */
  fill?: boolean;
  /**
   * The panel's foot, after a divider: doors that act on the LIST rather than pick from it — the club
   * Ledger's Book pill ends with "Add ledger" (Transfer and Payees moved into its Tools, 2026-10-02). Opt-in; no
   * portal strip passes one.
   */
  foot?: ReactNode;
  /**
   * A NARROWING, not an arrangement: quiet at rest (only the label shows while the value is `restValue`), the
   * olive tint and its value once it moves off — `MultiSelectDropdown`'s own rule. Inside a `FilterGroup` it
   * then counts on the phone's Filter button, draws itself as a row of the Filter sheet, and Reset puts it back
   * to `restValue` (Ledger Phone Filter D3/D6). First caller: Coming due's Due window (S3W3, 2026-10-05).
   * ⚠ Never on a `lead` pill: the arrangement stays in the top line and out of the sheet (FilterGroup's rule).
   */
  restQuiet?: boolean;
  restValue?: string;
  /**
   * Does the pill's face READ AS A SENTENCE — "Born in: any year"? `labelSuffix` (":") ends the label beside a chosen value
   * — and only then: a quiet `restQuiet` face at rest shows the label alone, never a dangling "Born in:". The value's
   * words come from the option's own `faceLabel`. Opt-in; first caller is the club's Born in pill (Stage 4c-2, D15/D16).
   * Every other caller renders exactly as before.
   */
  labelSuffix?: string;
}) {
  /* ⚖ OPTION GROUPS (Club Accounting · Teams, Ask 2, owner 2026-10-16): consecutive options sharing a `group` sit under
     one heading in the panel — the club Team pill's teams under their group, in the Teams table's band words and order
     ("No group" last). Options with no `group` render as before, so every other caller's list is unchanged. A heading
     is the table's band type; each group is its own labelled group for a screen reader. */
  const groupId = useId();
  const narrowed = restValue != null && value !== restValue;
  const group = useFilterGroupMember(label, narrowed, () => { if (restValue != null) onChange(restValue); });
  const ref = useDetailsOutsideClick(group?.mode !== 'row');
  const summaryRef = useRef<HTMLElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const isPhone = useIsPhone(group == null);
  const [sheetOpen, setSheetOpen] = useState(false);
  /* Opened from inside a full-screen window (the Payees window's Year pill, a KitDialog form): the window already took
     the bar, so the sheet sits at the screen's foot above it (`SheetFrame`'s `overWindow`), and the window's own foot —
     Previous · Next — is never left lit under it for a tap off the sheet to land on (/review 2026-10-18). Read from the
     pill's place in the page as it opens; it stays a menu, rendered inside the window's own DOM. */
  const [overWindow, setOverWindow] = useState(false);
  /* The sheet belongs to the phone band (FilterGroup's rule): a width that leaves it closes the sheet rather
     than leaving it open, unseen, to reappear on the way back. */
  const [wasPhone, setWasPhone] = useState(isPhone);
  if (wasPhone !== isPhone) {
    setWasPhone(isPhone);
    if (!isPhone) setSheetOpen(false);
  }
  const asSheet = sheetOpen && isPhone;
  // A panel opened at a desk width (or by a tap before hydration) never stays open into the phone band, where the
  // summary only opens the sheet and could no longer close it (/review 2026-10-18).
  useEffect(() => {
    if (isPhone) ref.current?.removeAttribute('open');
  }, [isPhone, ref]);
  // Focus opens on the pick in force, as a native select does (the Tools menu's rule for a menu of choices).
  useEffect(() => {
    if (!asSheet) return;
    const picks = sheetRef.current?.querySelectorAll<HTMLButtonElement>('button[aria-pressed]');
    const on = [...(picks ?? [])].find(b => b.getAttribute('aria-pressed') === 'true');
    (on ?? picks?.[0])?.focus({ preventScroll: true });
  }, [asSheet]);

  /* ⚠⚠ A PICK FROM THE SHEET WAITS FOR THE SHEET'S BACK STEP (/review 2026-10-18, High). The frame stands one history
     entry while the sheet is open, and closing it consumes that entry with `history.back()` once the press settles
     (`useBackStep`). Many callers' `onChange` is a `router.replace` — Families' Show, the club's Team, Book and
     Allocations' View — and a replace still fetching when that Back lands is dropped by the router's traversal: the
     pick does nothing, or leaves a stray entry. So the sheet closes first and the pick is applied once the Back has
     landed (its popstate), or after a short wait when there was no entry to consume. A pill that unmounts in the wait
     applies nothing. */
  const pendingPick = useRef<(() => void) | null>(null);
  useEffect(() => () => pendingPick.current?.(), []);
  const pickFromSheet = (id: string) => {
    pendingPick.current?.();
    setSheetOpen(false);
    let timer = 0;
    const cancel = () => {
      window.removeEventListener('popstate', settle);
      window.clearTimeout(timer);
      pendingPick.current = null;
    };
    // A task after the popstate, so the router has finished answering the traversal before the replace is asked.
    function settle() {
      cancel();
      window.setTimeout(() => onChange(id), 0);
    }
    window.addEventListener('popstate', settle);
    timer = window.setTimeout(settle, 800);
    pendingPick.current = cancel;
  };

  const chosen = options.find(o => o.id === value);
  const shown = chosen ?? options[0];
  /** The words the pill's face shows for the chosen option: its `faceLabel` when it has one, else its label. */
  const chosenLabel = shown?.faceLabel ?? shown?.label ?? '';
  const atRest = restQuiet && !narrowed;

  const choice = (o: (typeof options)[number], inSheet: boolean) => (
    /* A button, not a radio: picking applies instantly and closes the panel, which is what
       `DateRangeDropdown`'s presets already do. A radio list would need a second click to
       dismiss, on a control whose whole job is one decision. In the phone's Filter sheet there is no
       panel to close: the list updates behind the sheet (D7). */
    <button
      key={o.id}
      type="button"
      className={`${styles.multiSelectOption} ${styles.multiSelectPick} ${o.id === value ? styles.multiSelectPickOn : ''}`}
      aria-pressed={o.id === value}
      onClick={inSheet ? () => pickFromSheet(o.id) : ev => {
        onChange(o.id);
        (ev.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open');
      }}
    >
      {o.label}
      {o.mark}
      {o.rowMark}
      {o.detail != null && <span className={styles.multiSelectCount}>{o.detail}</span>}
    </button>
  );
  const sections: { group: string | undefined; items: (typeof options)[number][] }[] = [];
  for (const o of options) {
    const last = sections[sections.length - 1];
    if (last && last.group === o.group) last.items.push(o);
    else sections.push({ group: o.group, items: [o] });
  }
  // The sheet draws its own copy of the rows while the closed panel keeps its own, so a heading's id is spelt per
  // copy — one id, two elements, and the sheet's group would be named by the hidden panel's heading.
  const choicesFor = (inSheet: boolean) => sections.flatMap((sec, i) => (sec.group == null
    ? sec.items.map(o => choice(o, inSheet))
    : [(
      <div key={`group-${i}`} role="group" aria-labelledby={`${groupId}-${inSheet ? 's' : 'p'}${i}`}>
        <div id={`${groupId}-${inSheet ? 's' : 'p'}${i}`} className={styles.multiSelectGroupHead}>{sec.group}</div>
        {sec.items.map(o => choice(o, inSheet))}
      </div>
    )]));
  const choices = choicesFor(false);

  if (group?.mode === 'row') {
    return <FilterSheetRow name={label} value={chosenLabel} lit={narrowed}>{choices}</FilterSheetRow>;
  }

  const footBlock = foot != null && (
    <>
      <div className={styles.multiSelectDivider} />
      {foot}
    </>
  );

  return (
    <>
      <details ref={ref} className={`${styles.multiSelect} ${lead ? styles.multiSelectLead : ''}${shrink ? ` ${styles.multiSelectShrink}` : ''}${fill ? ` ${styles.multiSelectFill}` : ''}`}>
        <summary
          ref={summaryRef}
          data-pill="summary"
          className={`${styles.multiSelectSummary}${restQuiet && !atRest ? ` ${styles.multiSelectActive}` : ''}`}
          aria-haspopup={isPhone ? 'dialog' : undefined}
          aria-expanded={isPhone ? asSheet : undefined}
          onClick={ev => {
            if (!isPhone) return;
            // A phone opens the sheet, never the panel. A second tap closes it: the pill is the frame's opener, so
            // the frame's outside tap leaves it alone.
            ev.preventDefault();
            setOverWindow(ev.currentTarget.closest('[data-kit-dialog], [aria-modal="true"]') != null);
            setSheetOpen(v => !v);
          }}
        >
          <span className={styles.multiSelectLabel}>{atRest ? label : `${label}${labelSuffix ?? ''}`}</span>
          {!atRest && <span className={styles.multiSelectValue}>{chosenLabel}{chosen?.mark}{chosen?.pillMark}</span>}
          <ChevronDown size={14} aria-hidden />
        </summary>
        <div data-pill="panel" className={styles.multiSelectPanel} role="group" aria-label={label}>
          {choices}
          {footBlock}
        </div>
      </details>
      {/* Rendered beside the `<details>`, never inside it: a closed `<details>` hides everything but its summary,
          and on a phone it stays closed. A dialog, not a menu — its rows are pressed buttons, as in the Filter
          sheet. Any button or link inside closes it: a pick (applied once its Back step lands, above), and a foot
          door such as the Ledger's "Add ledger", which opens a window that takes the sheet's entry over in the same
          commit (`useBackStep`'s hand-off). */}
      {asSheet && (
        <SheetFrame
          ref={sheetRef}
          label={label}
          onClose={() => setSheetOpen(false)}
          opener={summaryRef}
          overWindow={overWindow}
          role="dialog"
          aria-label={label}
          onClick={ev => { if ((ev.target as HTMLElement).closest('button, a[href]')) setSheetOpen(false); }}
        >
          <div className={styles.multiSelectSheetList}>
            {choicesFor(true)}
            {footBlock}
          </div>
        </SheetFrame>
      )}
    </>
  );
}
