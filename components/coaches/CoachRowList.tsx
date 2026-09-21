'use client';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { ReactNode, MouseEventHandler } from 'react';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * THE ROW LIST — one recipe for every stack of records in the coach portal that is not a <table>
 * (standard §3.10; register F-17 → F-26–F-40; owner-ruled "as drawn" 2026-09-16).
 *
 * Measured on 2026-09-16, the portal's row lists were two species with a ground problem: seven
 * gapped card stacks floating on the blueprint grid (the phone's card shape drawn at 1440) and
 * nine hairlined lists, eight already on a card. This component is the one shape both take:
 *
 *   <CoachRowList label="Coming up">            — the frame (the table's own) on the card, or
 *   <CoachRowList inset>                         — no frame, because the card or shelf around it
 *                                                  already paints the ground (never zero, never two)
 *   <CoachRowList phoneFrame>                    — keeps its frame at ≤640 instead of breaking into
 *                                                  the phone's row-cards (S.7 — see the prop)
 *     <CoachRowBand>April 2026</CoachRowBand>    — a label row INSIDE the frame (the feed's day header)
 *     <CoachRow as="link" href … mark lead title caption trail door />
 *
 * A row is a link, a button (`aria-expanded` for a fold) or a static record; the WHOLE row is the
 * target and it tints on hover — nothing lifts, nothing grows a shadow. The stylesheet block at
 * the foot of `coaches.module.css` carries the recipe; the `data-row-list` / `data-row-list-row`
 * attributes are what the rendered sweep's `list-ground` and `type-ladder` rules key on, whatever
 * the hashed class names are.
 *
 * ⚠ Do not write a second row class beside this. A list that needs a different row composes a
 * different `mark`, `lead` or `trail` — the component is the unit (owner ruling: a shared
 * component beats a shared class).
 */

export function CoachRowList({
  children,
  inset = false,
  phoneFrame = false,
  label,
  labelledBy,
  className,
  'data-sandbox-tour': tourAnchor,
}: {
  children: ReactNode;
  /** Inside a card or a shelf that already paints the ground: no frame of its own. */
  inset?: boolean;
  /** At ≤640 the recipe breaks a list into row-cards (the table's phone form — for a table whose
   *  columns do NOT fit a phone). A list whose columns fit stays a framed list at every width
   *  (phone walk rule S.7, "a table whose columns fit stays a table"; first consumer the Overview's
   *  six-row board, owner ruling B5 2026-09-20 — six row-cards under a white hero card read as six
   *  grey slabs, and the approved drawing was one white frame). Declared, never inferred: the
   *  rendered sweep's `list-ground` rule reads `data-row-list-phone` and holds the list to the
   *  framed form at ≤640 (the list paints the card, the rows paint nothing); without it a framed
   *  phone list is the stand-down FAILING and is reported as such. Meaningless with `inset`. */
  phoneFrame?: boolean;
  /** What the list is, for the accessibility tree (§1: a list with no heading row must say). */
  label?: string;
  labelledBy?: string;
  className?: string;
  /** The demo tour anchors on a LIST, never on a row. Written as the literal attribute at the call
   *  site (`data-sandbox-tour="…"`), which is what the tour-anchor guard's static scan reads. */
  'data-sandbox-tour'?: string;
}) {
  return (
    <ul
      className={`${inset ? styles.rowListInset : styles.rowList}${phoneFrame ? ` ${styles.rowListPhoneFrame}` : ''}${className ? ` ${className}` : ''}`}
      data-row-list={inset ? 'inset' : 'frame'}
      data-row-list-phone={phoneFrame ? 'frame' : undefined}
      aria-label={label}
      aria-labelledby={labelledBy}
      data-sandbox-tour={tourAnchor}
    >
      {children}
    </ul>
  );
}

/**
 * The label row inside a frame — a month, a day, "Coming up". A HEADING to assistive tech, not
 * a list item: the <li> is presentational so it does not count as a record, and the words are a
 * level-3 heading a screen reader can jump to — the two hubs used to give each half a named
 * <section>, and this is what replaces that landmark inside the one frame.
 */
export function CoachRowBand({ children, id, level = 3 }: { children: ReactNode; id?: string; level?: 2 | 3 | 4 }) {
  return (
    <li className={styles.rowListBand} data-row-band role="presentation">
      <span role="heading" aria-level={level} id={id}>{children}</span>
    </li>
  );
}

export type CoachRowDoor =
  | 'chevron'
  /** The words a ruling gave the action ("Open the plan", "Edit access") — K-19's shape. */
  | { label: string; quiet?: boolean; icon?: ReactNode };

type RowBase = {
  /** ONE lead mark — a type icon, a status dot. Never a colour rail (K-21 keeps those in a calendar cell). */
  mark?: ReactNode;
  /** The date column beside the mark — formatted by the caller, in the org's zone. */
  lead?: ReactNode;
  leadKind?: 'date' | 'date-time' | 'text';
  title: ReactNode;
  /** 400 for a record that is read, 600 (the default) when the row names a record and opens. */
  titleWeight?: 'plain';
  caption?: ReactNode;
  /** A second caption that carries the row's meaning — a recap, a note; reads a step up, italic. */
  note?: ReactNode;
  trail?: ReactNode;
  door?: CoachRowDoor | null;
  className?: string;
  'aria-label'?: string;
  /** A placeholder row (the Overview's pending "…" slots) leaves the accessibility tree whole —
   *  the <li>, not just its text — as the grid's placeholder cards do. */
  'aria-hidden'?: boolean;
  tooltip?: string;
  /** A control that sits BESIDE the row (a sibling inside the <li>, never nested in the row's own
   *  link or button — the schedule's Game day pill). */
  beside?: ReactNode;
};

export type CoachRowProps =
  | (RowBase & { as: 'link'; href: string })
  | (RowBase & { as: 'button'; onClick: MouseEventHandler<HTMLButtonElement>; 'aria-expanded'?: boolean; disabled?: boolean })
  | (RowBase & { as?: 'static' });

export function CoachRow(props: CoachRowProps) {
  const { mark, lead, leadKind = 'date', title, titleWeight, caption, note, trail, door, className, beside } = props;
  const opens = props.as === 'link' || props.as === 'button';
  const rowClass = `${styles.rowListRow}${opens ? ` ${styles.rowListDoor}` : ''}${className ? ` ${className}` : ''}`;
  const inner = (
    <>
      {mark != null && <span className={styles.rowListMark} aria-hidden>{mark}</span>}
      {lead != null && <span className={styles.rowListLead} data-lead={leadKind}>{lead}</span>}
      <span className={styles.rowListMain}>
        <span className={styles.rowListTitle} data-weight={titleWeight}>{title}</span>
        {caption != null && <span className={styles.rowListCaption}>{caption}</span>}
        {note != null && <span className={styles.rowListCaption} data-meaning>{note}</span>}
      </span>
      {(trail != null || door) && (
        <span className={styles.rowListTrail}>
          {trail}
          {door && door !== 'chevron' && (
            <span className={styles.rowListGo} data-quiet={door.quiet || undefined}>
              {door.label}{door.icon ?? <ChevronRight size={15} aria-hidden />}
            </span>
          )}
          {/* The chevron: the door itself, or — beside a worded door — the corner the phone
              shows once the words hide (K-09), which is what `data-phone` marks. */}
          {door && (
            <span className={styles.rowListChevron} data-phone={door !== 'chevron' || undefined}>
              <ChevronRight size={16} aria-hidden />
            </span>
          )}
        </span>
      )}
    </>
  );
  const ariaLabel = props['aria-label'];
  return (
    <li className={styles.rowListItem} data-row-list-row aria-hidden={props['aria-hidden'] || undefined}>
      {props.as === 'link' ? (
        <Link href={props.href} className={rowClass} aria-label={ariaLabel} title={props.tooltip}>{inner}</Link>
      ) : props.as === 'button' ? (
        <button
          type="button"
          className={rowClass}
          onClick={props.onClick}
          aria-expanded={props['aria-expanded']}
          aria-label={ariaLabel}
          disabled={props.disabled}
          title={props.tooltip}
        >
          {inner}
        </button>
      ) : (
        // ⚠ No aria-label on the static row: a plain <div> has no role that takes a name, so the
        // attribute would be a silent no-op — the row's words are its name.
        <div className={rowClass} title={props.tooltip}>{inner}</div>
      )}
      {beside != null && <span className={styles.rowListBeside}>{beside}</span>}
    </li>
  );
}

/** The one line under a framed list — a door in words, never a count (§3.5). */
export function CoachRowListFoot({ children }: { children: ReactNode }) {
  return <p className={styles.rowListFoot}>{children}</p>;
}
