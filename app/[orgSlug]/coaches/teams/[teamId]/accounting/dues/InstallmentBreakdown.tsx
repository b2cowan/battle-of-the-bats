'use client';
/**
 * Player Dues — the "By installment" lens (owner-approved mockup, artifact d7162867, 2026-08-14;
 * headings, lit column and pager per mockup `6bd4c6d9` G1–G3, 2026-09-04; the owner-spotted
 * follow-up the same day: one-line rows, date-only headings, the amount back in every cell).
 *
 * ⚠ THE COLLECTION SCHEDULE BAND THAT USED TO OPEN THIS FILE IS GONE (owner ruling 2026-09-03,
 * D5). It described the season's collection, which is equally true under the Season-totals lens —
 * so it moved up to the panel header as a foldable TIMELINE that renders on both views
 * (./CollectionSchedule.tsx). The same move took the season figures to a MoneySummaryBand; between
 * them they are why this file's own table foot went too.
 *
 * Two pieces, both rendered from the SAME players array the totals view already holds — this
 * file fetches nothing and computes no money of its own (the arithmetic lives in
 * lib/dues-installment-view.ts, unit-tested):
 *
 *   • the player × installment grid (desktop / tablet);
 *   • collapsible per-player cards (phone) — closed, each answers the question coaches most
 *     often come here with: what does this family owe RIGHT NOW (past due + next installment),
 *     not the whole-season balance.
 *
 * ⚠ "Due next" excludes credits ON PURPOSE — credits sit against the season balance, and this
 * figure must equal the remainder the reminder emails chase. The season Balance column beside
 * it is where credits show, exactly as in the totals view.
 *
 * ⚖ THE OWNER'S SECOND LOOK (2026-09-04, on the built grid) — rulings, all built here:
 *   • ONE-LINE ROWS. The Due next cell stacked its caption under the figure and every row stood
 *     84px tall for it.
 *   • ⚠⚠ DUE NEXT IS A DATE, AND ONLY A DATE (the owner's third pass, same day). It had carried a
 *     figure, a date and a status word. The figures are in the instalment cells now and the credit
 *     is in the Balance column one cell over, so the date is the only thing this column says that
 *     nothing else does. "In credit" went with the figure for the same reason: the Balance column
 *     states it. A family with nothing owed reads an em dash — not a nought to be decoded.
 *   • THE HEADING IS THE DATE, ALONE. "Oct 4", or "Varies". The number and the amount left the
 *     heading; the number survives in the cell's accessible name and on the Collection schedule.
 *   • THE AMOUNT IS BACK IN EVERY UNPAID CELL, in quiet ink; a tick means nothing to send;
 *     part-paid keeps the dashed circle and late keeps the warning, each with its figure. This
 *     revises the 2026-08-14 "figure only where money is owed / amount in the heading" ruling —
 *     the heading no longer carries the amount, so the cell must.
 *
 * ⚠ THE COLUMNS ARRIVE BUILT (cleanup 2026-09-04). The panel derives them once from the whole
 * roster and hands the same array to this grid and to the Collection schedule; `players` here may
 * be the Showing filter's subset, and a grid whose headings changed with the filter would
 * re-describe the season every time a coach narrowed the list.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ChevronRight, AlertTriangle, CheckCircle2, CircleDashed } from 'lucide-react';
import CoachScrollX from '@/components/coaches/CoachScrollX';
import { fmt } from '@/lib/coach-money-summary';
import { tournamentToday, formatStoredDate } from '@/lib/timezone';
import { isInstallmentOverdue } from '@/lib/dues-status';
import {
  dueNextForPlayer,
  focusInstallmentColumn,
  installmentToSend,
  type InstallmentColumn,
  type DueNextSummary,
} from '@/lib/dues-installment-view';
import type { InstallmentCoverage } from '@/lib/dues-payments';
import styles from '../../../../coaches.module.css';

/** Structural subset of the panel's PlayerWithDues — declared here so the panel can import this
 *  component without a value-level cycle back into itself. */
export interface BreakdownPlayer {
  player: { id: string; playerFirstName: string | null; playerLastName: string | null };
  schedule: { totalAmount: number } | null;
  installments: {
    id: string;
    installmentNumber: number;
    amount: number;
    dueDate: string;
    paidAt: string | null;
    /** NET remainder (cash − credits applied) — the dues payload field of the same name. */
    remainingAmount?: number;
    creditApplied?: number;
  }[];
  coverage: InstallmentCoverage[];
  rollingBalance: number;
  /**
   * The family's OWN money the team is holding (D6, QA §148). Optional so a caller that cannot
   * see it still builds — but see the caption below: without it this lens says "In credit" for a
   * family the main table calls "Overpaid", which is the two-screens-one-family defect the whole
   * ruling exists to remove.
   */
  ownMoneyHeld?: number;
}

/** What the panel's pager needs to know about the grid's sideways position. */
export interface GridViewport {
  /** The grid is wider than its box — the only time a pager has anywhere to go. */
  overflows: boolean;
  /** Zero-based index of the first installment column fully visible past the pinned zone. */
  first: number;
  /** Zero-based index of the last installment column FULLY visible. */
  last: number;
  total: number;
}

/** The grid's imperative surface, for the pager the panel draws beside View. */
export interface InstallmentGridHandle {
  /** Scroll so column `first + delta` sits first after the pinned zone. */
  stepColumns: (delta: number) => void;
}

/** ⚠ A SETTLED BALANCE IS QUIET, NOT GREEN (Money-hub table pass 2026-08-13, approved render
 *  `14181bd3`). Zero used to be drawn in the same success green as a credit, so a roster where
 *  everyone had paid was a full column of green — the loudest thing on the screen saying nothing.
 *  Colour in these tables means "there is something here": green a credit, amber an amount still
 *  owed, muted a nil. Lives here (with the By-installment view) and is imported by the totals
 *  view so the two lenses can never colour the same balance differently. */
export function balanceColor(b: number): string {
  if (b < -0.005) return 'var(--success-light)'; // in credit (good)
  if (b > 0.005)  return 'var(--warning)'; // still owes
  return 'var(--home-dim, rgba(255,255,255,0.35))'; // fully clear — nothing to flag
}

/* No year — the column heading beside it already carries the season. Shared, because the
   completion date it prints is `completedOn` (a date) falling back to `paidAt` (a timestamp),
   and the local `s + 'T00:00:00'` turned that fallback into "paid Invalid Date". */
function fmtShort(s: string) {
  return formatStoredDate(s, { withYear: false });
}

function playerName(p: BreakdownPlayer) {
  return [p.player.playerFirstName, p.player.playerLastName].filter(Boolean).join(' ');
}

/** The words beside a due-next figure — the PHONE card's, where there is no table of amounts
 *  beside it and the collapsed card is the whole answer. The desktop grid shows a date instead. */
function dueNextCaption(d: DueNextSummary): { text: string; tone: 'warn' | 'dim' | 'good' } {
  if (d.allSettled) return { text: 'All caught up', tone: 'good' };
  if (d.pastDue > 0.005) {
    return {
      text: d.nextAmount > 0.005
        ? `${fmt(d.pastDue)} past due + ${fmt(d.nextAmount)} due ${fmtShort(d.nextDueDate!)}`
        : `${fmt(d.pastDue)} past due`,
      tone: 'warn',
    };
  }
  return { text: d.nextDueDate ? `due ${fmtShort(d.nextDueDate)}` : 'nothing scheduled', tone: 'dim' };
}

/* ⚰ `columnNote()` went with the band it captioned (2026-09-03). It wrote one sentence per
   instalment — "Fully collected — 5 of 7 paid", "$970.80 still to collect · 3 behind" — and on the
   owner's ten-instalment schedule that was ten sentences before the table began. The timeline says
   the same thing with a bar's fill and one shut summary line. Its one rule survives in the new
   shelf: warn ONLY when someone is actually behind, because an unpaid future instalment is a plan,
   not a problem (the chase-card ruling, 2026-08-03). */

/** The heading (owner, 2026-09-04): the date, alone. "Varies" where families have different dates
 *  for one installment. The number lives in the cell's accessible name and on the timeline. */
function headingFor(col: InstallmentColumn): string {
  return col.dueDateVaries ? 'Varies' : col.commonDueDate ? fmtShort(col.commonDueDate) : '—';
}

const InstallmentBreakdown = forwardRef<InstallmentGridHandle, {
  players: BreakdownPlayer[];
  /** The season's instalment columns, built once by the panel from the whole roster. */
  columns: InstallmentColumn[];
  /** Opens the same player drawer a row-tap opens in the totals view. */
  onOpenPlayer: (playerId: string) => void;
  /** False when the DESKTOP lens is Season totals. Phones have no lens toggle (owner call
   *  2026-08-14) — the collapsible cards ARE the phone view, so this component renders in
   *  both lenses and, when the desktop shows the totals table, everything here is
   *  phone-only (`.duesPhoneLens`). */
  desktopActive?: boolean;
  /** The Showing pill's own empty sentence, when the filter leaves nobody. */
  emptyMessage?: string | null;
  /** Reports the grid's sideways position for the panel's pager (owner G3). */
  onViewportChange?: (v: GridViewport) => void;
}>(function InstallmentBreakdown({
  players,
  columns,
  onOpenPlayer,
  desktopActive = true,
  emptyMessage = null,
  onViewportChange,
}, ref) {
  /**
   * THE PIN'S OFFSETS ARE MEASURED, NOT DECLARED — and this is the second attempt, because the
   * first one was wrong in a way only a browser could show.
   *
   * Three columns pin above 1024 (Player · Due next · Balance). `position: sticky` measures `left`
   * from the SCROLLER's edge, so the second column's offset must equal the first's RENDERED width
   * and the third's the sum of the first two. The first cut declared those widths in CSS and reused
   * the same custom properties for the offsets — which reads as airtight and is not: `width` on a
   * table cell is a SUGGESTION to auto table layout, not a rule. Measured live, an 11rem/9rem/6.5rem
   * declaration rendered 129/120/120px, so each pinned column sat short of the offset holding the
   * next one and the scrolled instalment cells showed through a 47px and a 24px window BETWEEN two
   * pinned columns. `table-layout: fixed` would make the widths authoritative but also makes the
   * table exactly its container's width, which removes the overflow the pin exists for.
   *
   * So the browser picks the widths and we read them back. Until that read happens the table carries
   * no `data-pin-ready`, and the stylesheet pins only Player — the behaviour this grid had before,
   * which is the right thing to degrade to.
   */
  const tableRef = useRef<HTMLTableElement | null>(null);
  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    const measure = () => {
      const head = table.querySelector('thead tr');
      const cells = head ? [...head.children] : [];
      if (cells.length < 3) return;
      const w1 = (cells[0] as HTMLElement).getBoundingClientRect().width;
      const w2 = (cells[1] as HTMLElement).getBoundingClientRect().width;
      // Sub-pixel column widths are ordinary; rounding down would re-open a hairline gap, so the
      // offsets keep their fractions and the browser composites them.
      table.style.setProperty('--dues-pin-1', `${w1}px`);
      table.style.setProperty('--dues-pin-2', `${w2}px`);
      table.dataset.pinReady = 'true';
    };
    measure();
    // Column widths move with the viewport, with the roster, and with a name long enough to widen
    // the Player column — all three would silently un-true a one-shot measurement.
    const ro = new ResizeObserver(measure);
    ro.observe(table);
    return () => ro.disconnect();
  });

  const today = tournamentToday();
  /** The lit column — the SAME installment the Collection schedule names (owner G2). */
  const focus = useMemo(() => focusInstallmentColumn(columns), [columns]);
  const focusIndex = focus ? columns.findIndex(c => c.installmentNumber === focus.installmentNumber) : -1;

  const dueNextById = useMemo(() => {
    const m = new Map<string, DueNextSummary | null>();
    for (const p of players) m.set(p.player.id, dueNextForPlayer(p.installments, p.coverage, today));
    return m;
  }, [players, today]);

  /* ── The way sideways (owner G3) ──────────────────────────────────────────────────────────────
     The scroller stays a real scroll region (scrollbar, shift-wheel, swipe all work). What this
     adds is knowledge: which installment columns are in view, reported up so the panel can draw a
     pager beside View, and an imperative `stepColumns` so that pager moves this grid one column at
     a time.

     ⚠ LAYOUT IS MEASURED ON RESIZE, NEVER ON SCROLL. A column's left edge (relative to the
     scroller's content) is scroll-invariant, so the edges are read once into `layout` when the
     grid mounts, resizes or changes its column count; the scroll handler — the highest-frequency
     path here — reads two numbers off the scroller and scans that cache.

     ⚠⚠ THE PINNED ZONE'S WIDTH IS THE FIRST INSTALLMENT COLUMN'S LEFT EDGE — by construction, not
     by inspection. The pinned cells are in normal flow (sticky does not remove them), so at rest
     the first installment column begins exactly where the pin ends. The first cut asked
     `getComputedStyle` which cells were sticky and summed their widths, and read the answer a
     beat before the stylesheet had made the third column sticky: the pin came back one column
     short, the grid opened scrolled one column too far, and Installment 1 sat hidden under the
     Balance column (owner-spotted 2026-09-04). Geometry cannot be early. */
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [overflows, setOverflows] = useState(false);
  const layout = useRef<{ cols: { left: number; right: number }[] }>({ cols: [] });
  const lastViewport = useRef<GridViewport | null>(null);

  const measureLayout = useCallback(() => {
    const table = tableRef.current;
    const scroller = scrollerRef.current;
    if (!table || !scroller) return;
    const origin = scroller.getBoundingClientRect().left - scroller.scrollLeft;
    layout.current = {
      cols: [...table.querySelectorAll<HTMLElement>('thead th[data-col]')].map(th => {
        const r = th.getBoundingClientRect();
        return { left: r.left - origin, right: r.right - origin };
      }),
    };
  }, []);

  const reportViewport = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !onViewportChange) return;
    const { cols } = layout.current;
    const pin = cols[0]?.left ?? 0;
    const viewStart = scroller.scrollLeft + pin;
    const viewEnd = scroller.scrollLeft + scroller.clientWidth;
    let first = -1;
    let last = -1;
    cols.forEach((c, i) => {
      // First: the first column whose left edge clears the pin. Last: the last column WHOLLY
      // inside the box — a column cut at the right edge is not "in view", and calling it so is
      // what disabled the › arrow while the last column was still half hidden (owner-spotted
      // 2026-09-04). A 2px tolerance covers sub-pixel widths at both edges.
      if (first < 0 && c.left >= viewStart - 2) first = i;
      if (c.right <= viewEnd + 2) last = i;
    });
    if (first < 0) first = Math.max(0, cols.length - 1);
    const next: GridViewport = { overflows, first, last: Math.max(last, first), total: cols.length };
    const prev = lastViewport.current;
    if (prev && prev.overflows === next.overflows && prev.first === next.first && prev.last === next.last && prev.total === next.total) return;
    lastViewport.current = next;
    onViewportChange(next);
  }, [onViewportChange, overflows]);

  const scrollToColumn = useCallback((index: number, behavior: ScrollBehavior) => {
    const scroller = scrollerRef.current;
    const { cols } = layout.current;
    if (!scroller || !cols.length) return;
    const i = Math.max(0, Math.min(index, cols.length - 1));
    scroller.scrollTo({ left: Math.max(0, cols[i].left - cols[0].left), behavior });
  }, []);

  useImperativeHandle(ref, () => ({
    stepColumns: (delta: number) => {
      const from = lastViewport.current?.first ?? 0;
      scrollToColumn(from + delta, 'smooth');
    },
  }), [scrollToColumn]);

  // Measure on mount, on resize and when the column set changes; report on every scroll. The
  // comparison in reportViewport keeps the panel quiet between real changes.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    measureLayout();
    reportViewport();
    const onScroll = () => reportViewport();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    const ro = new ResizeObserver(() => { measureLayout(); reportViewport(); });
    ro.observe(scroller);
    // ⚠ AND the table (/review 2026-09-04): the Showing filter can narrow the Player column without
    // the scroller's own box changing, which shifts every column's left edge — an observer on the
    // scroller alone left the pager's range and targets stale until the next window resize.
    if (tableRef.current) ro.observe(tableRef.current);
    return () => { scroller.removeEventListener('scroll', onScroll); ro.disconnect(); };
  }, [measureLayout, reportViewport, columns.length]);

  // Open with the lit column in view (owner G2) — once per focus, and only when there is somewhere
  // to scroll to. A coach who then pages away is not dragged back on the next re-render.
  const positionedFor = useRef<number | null>(null);
  useEffect(() => {
    if (!overflows || focusIndex < 0) return;
    if (positionedFor.current === focusIndex) return;
    positionedFor.current = focusIndex;
    measureLayout();
    scrollToColumn(focusIndex, 'auto');
  }, [overflows, focusIndex, measureLayout, scrollToColumn]);

  /* ⚰ `balanceOwing` and `toCollectNow` went with this grid's table foot (2026-09-03). Balance
     owing is now the panel band's own tile, summed there from the same positive rolling balances —
     one derivation for both lenses instead of one per lens, which is the whole point of moving the
     summary above the view switch. "To collect now" had no seat in a four-tile band and no second
     home: the Collection schedule's shut line answers the same question against the instalment a
     coach can actually act on, rather than as a season aggregate nobody sends. */

  /**
   * ONE CELL OF THE GRID — a mark, and the figure still to send (owner, 2026-09-04).
   *
   * The 2026-08-14 cut printed a figure only where money was owed and moved the common amount
   * into the heading, so a settled row went almost blank. The heading no longer carries the amount
   * (it is the date alone), so the cell carries it again — in quiet ink for an untouched future
   * instalment, with the dashed circle when part-paid, with the warning when late. A tick still
   * means "nothing left to send", by cash, by fundraising, or both.
   *
   * ⚠ SOURCE IS OUT (owner ruling 2026-08-14). Cash and fundraising both mean "nothing left to
   * send" and both draw the same tick; WHERE the money came from is on the player's record.
   *
   * ⚠ It returns a STATE, not a rendering. Two surfaces draw it — the terse desktop grid and the
   * wordier phone card, which has room and no column heading to inherit from — and they must never
   * be able to disagree about WHICH state an instalment is in, only about how loudly to say it.
   */
  const cellFor = useCallback((p: BreakdownPlayer, col: InstallmentColumn) => {
    const inst = p.installments.find(i => i.installmentNumber === col.installmentNumber);
    if (!p.schedule || !inst) {
      return { tone: 'none' as const, started: false, amount: null as string | null, ownDate: null as string | null };
    }
    const cov = p.coverage.find(c => c.installmentId === inst.id);
    const toSend = installmentToSend(inst, cov);
    // Shown in-cell only when it differs from the column heading's — the heading speaks for the
    // team's common date; a hand-edited schedule keeps its own visible.
    const ownDate = inst.dueDate !== col.commonDueDate ? fmtShort(inst.dueDate) : null;

    // Nothing left to send — by cash, by fundraising, or both.
    if (toSend <= 0.005) return { tone: 'paid' as const, started: true, amount: null, ownDate };

    const overdue = isInstallmentOverdue(inst.dueDate, inst.paidAt);
    // Anything already applied (cash allocated OR credits) makes this a PART-paid instalment.
    const started = Math.abs(inst.amount - toSend) > 0.005;

    if (overdue) return { tone: 'over' as const, started, amount: fmt(toSend), ownDate };
    if (started) return { tone: 'part' as const, started, amount: fmt(toSend), ownDate };
    // Untouched and not yet due — the quietest state, and the commonest early in a season.
    return { tone: 'up' as const, started, amount: fmt(toSend), ownDate };
  }, []);

  type CellState = ReturnType<typeof cellFor>;

  /** The grid's mark for a state. An untouched future instalment has no mark — its figure is the
   *  whole cell. */
  const iconFor = (c: CellState): 'check' | 'warn' | 'part' | null =>
    c.tone === 'paid' ? 'check'
    : c.tone === 'over' ? 'warn'
    : c.tone === 'part' ? 'part'
    : null;

  /**
   * The phone card's words for the same state — the card keeps its wording where the grid does not.
   *
   * ⚠ SHORT ON PURPOSE. The first cut said "$625.00 overdue — was due Jul 23" beside a row that
   * ALREADY prints the instalment amount and whose label already reads "Installment 1 · Jul 23";
   * both nowrap, so the rendered sweep caught it spilling 60px off a 361px phone. The date and the
   * face amount are the row's job. This says only what they cannot: is it late, and if the family
   * is part-way, how much is left.
   */
  const cardWords = (c: CellState): string =>
    c.tone === 'none' ? 'Not set'
    : c.tone === 'paid' ? 'settled'
    // `amount` is already `fmt(toSend)` for both of these — formatting it a second time here is
    // what kept `toSend` on the state at all.
    : c.tone === 'over' ? (c.started ? `${c.amount} overdue` : 'overdue')
    : c.tone === 'part' ? `${c.amount} to send`
    : 'upcoming';

  /** ⚠ THE MARK CARRIES THE MEANING, never the colour on its own — the warm palette's amber and
   *  danger sit at ΔE ~1.0 for deutan vision, so a grid that said "late" in red alone would say
   *  nothing to some coaches. Three distinct shapes, one per state that has one. */
  const statusIcon = (icon: 'check' | 'warn' | 'part' | null) =>
    icon === 'check' ? <CheckCircle2 size={13} aria-hidden style={{ verticalAlign: '-2px' }} />
    : icon === 'warn' ? <AlertTriangle size={13} aria-hidden style={{ verticalAlign: '-2px', marginRight: 3 }} />
    : icon === 'part' ? <CircleDashed size={13} aria-hidden style={{ verticalAlign: '-2px', marginRight: 3 }} />
    : null;

  /** The one-line key under the grid. It exists BECAUSE the captions went: three marks a coach has
   *  not seen before need naming once, and once is cheaper than 28 sentences. */
  const legend = (
    <p className={styles.duesLegend}>
      <span data-tone="paid"><CheckCircle2 size={12} aria-hidden /> nothing to send</span>
      <span data-tone="part"><CircleDashed size={12} aria-hidden /> part paid</span>
      <span data-tone="over"><AlertTriangle size={12} aria-hidden /> overdue</span>
      {/* A footnote about the whole grid, not a fourth tone — no `data-tone`, so a future rule
          targeting one cannot silently start styling it. */}
      <span>a figure is what is still to send</span>
    </p>
  );

  /**
   * THE GRID'S "DUE NEXT" IS A DATE, ALONE (owner, 2026-09-04). It carried the figure and the date
   * and a status word; the figures are in the instalment cells now and the credit is in the Balance
   * column one cell over, so the date is the only thing this column says that nothing else does —
   * WHEN this family is next wanted. Null means nothing is owed at all (settled, in credit, or no
   * schedule): the cell prints an em dash rather than a nought that has to be read.
   *
   * ⚠ FOR A FAMILY WHO IS BEHIND IT IS THE OLDEST DATE THEY OWE, not the next one coming — the
   * same "late outranks future" rule the lit column and the Collection schedule follow, so the
   * three cannot point at different instalments.
   */
  const dueNextDate = (p: BreakdownPlayer): { date: string; late: boolean } | null => {
    const d = dueNextById.get(p.player.id) ?? null;
    if (!p.schedule || !d || d.allSettled) return null;
    if (d.pastDue > 0.005 && d.pastDueDate) return { date: fmtShort(d.pastDueDate), late: true };
    return d.nextDueDate ? { date: fmtShort(d.nextDueDate), late: false } : null;
  };

  /** The PHONE card's summary — it keeps the figure: a collapsed card has no table beside it. */
  const dueNextFigure = (p: BreakdownPlayer) => {
    const d = dueNextById.get(p.player.id) ?? null;
    if (!p.schedule || !d) {
      return { value: '—', valueColor: 'var(--home-dim, rgba(255,255,255,0.3))', caption: 'Not set', tone: 'dim' as const };
    }
    // A family in credit is due nothing (owner, 2026-09-04): the credit itself is the Balance
    // column's fact, one cell over; printing it here twice answered a different question.
    if (d.allSettled && p.rollingBalance < -0.005) {
      /* ⚠ THE SAME TWO WORDS THE MAIN TABLE USES (QA §148). This lens hardcoded "In credit" and
         never asked whose money it was, so a family the table called "Overpaid" read "In credit"
         here — one family, one screen, two vocabularies. The distinction is not decoration: a
         coach can hand back the money in the first case and can do nothing in the second. */
      const caption = (p.ownMoneyHeld ?? 0) > 0.005 ? 'Overpaid' : 'In credit';
      return { value: fmt(0), valueColor: 'var(--home-dim, rgba(255,255,255,0.35))', caption, tone: 'good' as const };
    }
    const cap = dueNextCaption(d);
    return {
      value: fmt(d.amount),
      // The settled-is-quiet ruling: a $0 due-next is muted, only real amounts carry colour.
      valueColor: d.amount > 0.005
        ? (d.pastDue > 0.005 ? 'var(--warning)' : 'var(--home-ink, rgba(255,255,255,0.85))')
        : 'var(--home-dim, rgba(255,255,255,0.35))',
      caption: cap.text,
      tone: cap.tone,
    };
  };

  const filteredOut = players.length === 0 && !!emptyMessage;

  return (
    <div className={desktopActive ? undefined : styles.duesPhoneLens}>
      {/* ── Desktop / tablet: the player × installment grid ───────────────────────────────────
          Wrapped in CoachScrollX with an EXTERNAL affordance: the grid scrolls sideways with the
          Player column pinned (the Budget-vs-Actual month-grid pattern) the moment its columns
          genuinely overflow — measured, never counted — and the panel's ColumnPager beside View is
          the visible way there. No swipe chip (owner G3, 2026-09-04). */}
      <CoachScrollX
        sticky
        hint="Later installments"
        affordance="external"
        scrollerRef={scrollerRef}
        onOverflowChange={setOverflows}
        className={styles.duesMatrixWrap}
        scrollerClassName={`${styles.duesMatrixScroller} ${styles.duesMatrixPin}`}
      >
        <table className={styles.table} ref={tableRef}>
          <thead>
            <tr>
              {/* ⚠⚠ DUE NEXT AND BALANCE LEAD THE GRID NOW (owner ruling 2026-09-03, D5). They used
                  to close it, past every instalment column — so on a schedule long enough to scroll,
                  the two figures a coach came for were the two the swipe took away first, while
                  eight cells of ticks stayed. Leading, they are what the pin holds (`.duesMatrixPin`,
                  ≥1024) and the last thing to leave at any width. The instalments read left to right
                  after them, which is also the order a season happens in. */}
              <th className={styles.th}>Player</th>
              <th className={`${styles.th} ${styles.thNum}`}>Due next</th>
              <th className={`${styles.th} ${styles.thNum}`}>Balance</th>
              {columns.map((col, i) => {
                const lit = i === focusIndex;
                const heading = headingFor(col);
                return (
                  <th
                    key={col.installmentNumber}
                    className={`${styles.th} ${styles.thNum} ${lit ? styles.gridColNow : ''}`}
                    data-col={i}
                    data-focus={lit ? 'true' : undefined}
                    /* The number is still the column's name for anyone reading it aloud. */
                    aria-label={`Installment ${col.installmentNumber}, ${heading === 'Varies' ? 'dates vary' : `due ${heading}`}`}
                  >
                    <span className={styles.duesThDate}>{heading}</span>
                  </th>
                );
              })}
              <th className={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {players.map(p => {
              const due = dueNextDate(p);
              return (
                <tr
                  key={p.player.id}
                  className={styles.tr}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onOpenPlayer(p.player.id)}
                >
                  <td className={`${styles.td} ${styles.duesPlayerCell}`}>{playerName(p)}</td>
                  {/* The date, alone — see `dueNextDate`. */}
                  <td className={`${styles.td} ${styles.tdNum} ${styles.duesDueNextCell}`}>
                    {due ? (
                      <span
                        className={styles.duesCellAmt}
                        style={{ color: due.late ? 'var(--warning)' : 'var(--home-ink, rgba(255,255,255,0.85))' }}
                      >
                        {due.late && <AlertTriangle size={11} aria-hidden style={{ verticalAlign: '-1px', marginRight: 3 }} />}
                        {due.date}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--home-dim, rgba(255,255,255,0.3))' }}>—</span>
                    )}
                  </td>
                  <td className={`${styles.td} ${styles.tdNum}`} style={{ color: balanceColor(p.rollingBalance), fontWeight: 600 }}>
                    {p.schedule ? fmt(p.rollingBalance) : '—'}
                  </td>
                  {/* The mark, then the figure still to send. A player with no schedule at all keeps
                      an em dash — a blank cell and a "nothing due yet" cell are different facts. */}
                  {columns.map((col, i) => {
                    const cell = cellFor(p, col);
                    return (
                      <td key={col.installmentNumber} className={`${styles.td} ${styles.tdNum} ${i === focusIndex ? styles.gridColNow : ''}`}>
                        <span className={styles.duesCell} data-tone={cell.tone}>
                          {cell.tone === 'none' ? '—' : statusIcon(iconFor(cell))}
                          {cell.amount && <span className={styles.duesCellAmt}>{cell.amount}</span>}
                          {cell.ownDate && cell.tone !== 'paid' && <span className={styles.duesCellWhen}>{cell.ownDate}</span>}
                        </span>
                      </td>
                    );
                  })}
                  <td className={styles.td}>
                    <ChevronRight size={14} style={{ color: 'var(--home-dim, rgba(255,255,255,0.3))' }} />
                  </td>
                </tr>
              );
            })}
            {filteredOut && (
              <tr>
                <td className={styles.td} colSpan={columns.length + 4}>
                  <span className={styles.mutedInline}>{emptyMessage}</span>
                </td>
              </tr>
            )}
          </tbody>
          {/* ⚰ THIS GRID'S TABLE FOOT IS RETIRED (owner ruling 2026-09-03, D4) — the season figures
              open the tab as a MoneySummaryBand above the view switch, so both lenses summarise the
              list with the same four words instead of one row each. The per-instalment totals went
              first (2026-08-14) because the Collection schedule states each instalment's
              collected-of-assessed a few inches above, and a number printed twice on one screen only
              invites the question of why the two might disagree. */}
        </table>
      </CoachScrollX>
      {legend}

      {/* ── Phone: collapsible per-player cards, closed on the "due next" figure ─────────────── */}
      <div className={styles.duesCards}>
        {filteredOut && <p className={styles.muted} style={{ margin: '0.5rem 0' }}>{emptyMessage}</p>}
        {players.map(p => {
          const due = dueNextFigure(p);
          const d = dueNextById.get(p.player.id);
          if (!p.schedule || !d) {
            // No schedule ⇒ nothing to expand — the whole card is the door to setting one,
            // exactly what a row-tap does in the totals view.
            return (
              <button key={p.player.id} type="button" className={styles.duesCardStatic} onClick={() => onOpenPlayer(p.player.id)}>
                <span className={styles.duesCardName}>{playerName(p)}</span>
                <span className={styles.duesCardSum}>
                  <span className={styles.duesCardDue} style={{ color: due.valueColor }}>{due.value}</span>
                  <span className={styles.duesCardCap}>{due.caption}</span>
                </span>
              </button>
            );
          }
          return (
            <details key={p.player.id} className={styles.duesCard}>
              <summary className={styles.duesCardHead}>
                <ChevronRight size={14} className={styles.duesCardTwist} aria-hidden />
                <span className={styles.duesCardName}>{playerName(p)}</span>
                <span className={styles.duesCardSum}>
                  <span className={styles.duesCardDue} style={{ color: due.valueColor }}>{due.value}</span>
                  <span className={styles.duesCardCap} data-tone={due.tone}>
                    {due.tone === 'warn' && <AlertTriangle size={10} aria-hidden style={{ verticalAlign: '-1px', marginRight: 2 }} />}
                    {due.caption}
                  </span>
                </span>
              </summary>
              <div className={styles.duesCardBody}>
                {p.installments.map(inst => {
                  const col = columns.find(c => c.installmentNumber === inst.installmentNumber);
                  const cell = col ? cellFor(p, col) : null;
                  return (
                    /* ⚠ The CARD keeps its words. It has room, it has no column heading above it
                       to inherit the amount and date from, and it is the whole story for a phone
                       user — so it prints the instalment amount and a sentence, both derived from
                       the same state the terse grid cell uses. */
                    <div key={inst.id} className={styles.duesCardRow}>
                      <span className={styles.duesCardRowLab}>Installment {inst.installmentNumber} · {fmtShort(inst.dueDate)}</span>
                      <span className={styles.duesCardRowVal}>
                        <span className={styles.duesCellAmt}>{fmt(inst.amount)}</span>{' '}
                        {cell && (
                          <span className={styles.duesCellSt} data-tone={cell.tone} style={{ display: 'inline' }}>
                            {statusIcon(iconFor(cell))}
                            {cardWords(cell)}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
                <div className={styles.duesCardFoot}>
                  <span>
                    Season balance{' '}
                    <strong style={{ color: balanceColor(p.rollingBalance), fontVariantNumeric: 'tabular-nums' }}>
                      {fmt(p.rollingBalance)}
                    </strong>
                  </span>
                  {/* The header tap toggles the card, so the drawer needs its own door here. */}
                  <button type="button" className={styles.duesCardFootLink} onClick={() => onOpenPlayer(p.player.id)}>
                    Full record ›
                  </button>
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
});

export default InstallmentBreakdown;
