'use client';
import { useMemo, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { RepTeamCircuit, RepTeamDrill } from '@/lib/types';
import { circuitLine } from '@/lib/rep-circuits';
import { UNTAGGED_FILTER, collectTags, type Taggable } from '@/lib/rep-drills';
import { templateUseLabel } from '@/lib/rep-plan-templates';
import { mergedTagNames } from '@/lib/rep-practice-plan';
import { formatInOrgZone } from '@/lib/timezone';
import type { PickableTag } from '@/components/coaches/TagPicker';
import MultiSelectDropdown from '@/components/coaches/MultiSelectDropdown';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * ONE library row, TWO faces (practices re-evaluation stage 4, owner ruling L3, 2026-09-16):
 *
 *  · `LibraryTableRow` — a `<tr>` on the portal's list recipe for the three library TABS (Drills ·
 *    Templates · Circuits): the name in the primary ink with its tags beside it, the row's one line
 *    under it in the secondary ink, then the data columns, then the chevron. The row is the door;
 *    there are no actions on a row (Retire lives in the thing itself). `.tableAsCards` reflows it
 *    to a card at ≤640, where the lead cell is the card's title and the chevron pins to its corner.
 *  · `LibraryCard` — the same content as a standalone card for the two places that are never a
 *    table: the docked panel beside the plan (a grip · name · facts · Add; a row opens in place as
 *    the Preview) and the picker sheet's rows. Content-tall by construction.
 *
 * ⚠ THE 267px PHONE ROW is the defect this replaces: `.ppDrillRowMain { flex: 1 1 12rem }` read as
 * a HEIGHT once the old card stacked its columns at ≤640, so every library row — a drill with four
 * lines, a template with nothing in it — was 267px tall. Neither face here carries a flex basis.
 *
 * ⚠ No caption is INVENTED for a row with no words: a drill saved from a station that carried only
 * setup, points and kit reads name · facts and nothing else. Only a template's and a circuit's
 * "Nothing in it yet" is written, in the quiet italic — words, never "0 blocks".
 *
 * ⚠ THE COLUMNS FOLLOW-UP (owner rulings T1–T4, 2026-09-17): the table face carries the count as
 * a figure with its own heading ("8 plans", a dash at zero — `libraryCountCell`) and a Last
 * planned column (`libraryDateCell`; drills compute the date since this), and its headings sort
 * (`LibrarySort.tsx`). Tags were drawn as a column and reconsidered on sight: they STAY beside the
 * name (T1) because the line under it is the browsable fact and the widest thing on the row, and
 * "which of these are hitting" is the Tags filter's question. The card faces keep their written
 * labels ("In 6 plans") — a card has no heading to lean on.
 */

/** Usually · Plans on one line, for the card face ("20 min · Not in a plan yet"). */
export function drillCardFacts(drill: Pick<RepTeamDrill, 'usualMinutes'> & { planCount?: number }): string {
  return [
    drill.usualMinutes ? `${drill.usualMinutes} min` : null,
    drill.planCount == null ? null : drillUseLabel(drill.planCount),
  ].filter(Boolean).join(' · ');
}

/** ⚠ PLANS, never practices — and written out, never a bare 0. The one count the library shows. */
export function drillUseLabel(planCount: number): string {
  return planCount > 0 ? `In ${planCount} plan${planCount === 1 ? '' : 's'}` : 'Not in a plan yet';
}

/** The drill's first line — what you're doing, clamped by CSS; null when unwritten. */
export function drillCardLine(drill: Pick<RepTeamDrill, 'description'>): string | null {
  return drill.description?.trim() || null;
}

/** "45 min · 3 stations · Started 2 plans" for the card face. */
export function circuitCardFacts(circuit: Pick<RepTeamCircuit, 'block'> & { planCount?: number }): string {
  const stations = circuit.block.stations?.length ?? 0;
  return [
    circuit.block.duration.minutes ? `${circuit.block.duration.minutes} min` : null,
    stations > 0 ? `${stations} station${stations === 1 ? '' : 's'}` : null,
    circuit.planCount == null ? null : templateUseLabel(circuit.planCount),
  ].filter(Boolean).join(' · ');
}

/** The stations' names then how it rotates; "Nothing in it yet" when empty (quiet). */
export function circuitCardLine(circuit: Pick<RepTeamCircuit, 'block'>): { text: string; quiet: boolean } {
  const line = circuitLine(circuit.block);
  return line ? { text: line, quiet: false } : { text: 'Nothing in it yet', quiet: true };
}

/** The whole drill, read-only — the Preview's body, wherever a row opens in place. */
export function DrillPreviewBody({ drill, equipmentTags }: { drill: RepTeamDrill; equipmentTags?: PickableTag[] }) {
  const equipment = mergedTagNames(drill.equipment, drill.equipmentTagIds, equipmentTags ?? []);
  return (
    <div className={styles.libCardBody}>
      {drill.description && <p className={styles.ppReadTxt}><b>Doing:</b> {drill.description}</p>}
      {drill.goal && <p className={styles.ppReadTxt}><b>Watching for:</b> {drill.goal}</p>}
      {drill.coachingPoints.length > 0 && (
        <ol className={styles.ppReadPoints}>
          {drill.coachingPoints.map((p, i) => <li key={i}>{p}</li>)}
        </ol>
      )}
      {drill.setup && <p className={styles.ppReadTxt}><b>Setup:</b> {drill.setup}</p>}
      {equipment.length > 0 && <p className={styles.ppReadTxt}><b>Equipment:</b> {equipment.join(' · ')}</p>}
      {!drill.description && !drill.goal && drill.coachingPoints.length === 0 && !drill.setup && equipment.length === 0 && (
        <p className={styles.formHint}>Nothing written on this drill yet.</p>
      )}
    </div>
  );
}

/** The whole circuit, read-only — each station's name and first line, and the rotation. */
export function CircuitPreviewBody({ circuit }: { circuit: RepTeamCircuit }) {
  const stations = circuit.block.stations ?? [];
  const every = circuit.block.rotation?.intervalMinutes;
  return (
    <div className={styles.libCardBody}>
      {circuit.block.description && <p className={styles.ppReadTxt}><b>Doing:</b> {circuit.block.description}</p>}
      {circuit.block.goal && <p className={styles.ppReadTxt}><b>Watching for:</b> {circuit.block.goal}</p>}
      {stations.length > 0 ? (
        <ol className={styles.ppReadPoints}>
          {stations.map((s, i) => (
            <li key={s.id}>
              <b>{s.name.trim() || `Station ${i + 1}`}</b>
              {s.drillId ? <span className={styles.libCardFrom}> · from your drills</span> : null}
              {s.description ? ` — ${s.description}` : ''}
            </li>
          ))}
        </ol>
      ) : <p className={styles.formHint}>Nothing in it yet.</p>}
      {stations.length >= 2 && (circuit.block.rotates ?? true) && (
        <p className={styles.ppReadTxt}><b>Groups rotate</b>{every ? ` · every ${every} min` : ''}</p>
      )}
    </div>
  );
}

/** The name with its chips and tags beside it — the one head both faces wear. */
function LibraryNameTags({ name, tags, shared, retired }: {
  name: string;
  tags?: readonly { id: string; name: string }[];
  shared?: boolean;
  retired?: boolean;
}) {
  return (
    <>
      {name}
      {shared && <span className={styles.ppSharedChip}>Club</span>}
      {retired && <span className={styles.ppSharedChip}>Retired</span>}
      {tags && tags.length > 0 && (
        <span className={styles.tagReadRow}>
          {tags.map(t => <span key={t.id} className={styles.tagRead}>{t.name}</span>)}
        </span>
      )}
    </>
  );
}

/**
 * The card face. `onToggle` makes the name a button that opens the card in place (`open` shows
 * `children` — the Preview's body — under the facts); `actions` sits at the row's right end (the
 * panel's Add, the picker's Add). The chevron is the door's glyph, never a second control.
 */
export function LibraryCard({
  name, tags, shared, retired, facts, line, quietLine, grip, lifted, open, onToggle, actions, children, testId,
}: {
  name: string;
  tags?: readonly { id: string; name: string }[];
  shared?: boolean;
  retired?: boolean;
  facts?: string;
  line?: string | null;
  quietLine?: boolean;
  /** The grip, rendered by the CALLER that holds the drag hook (the docked panel's row) — a ref
   *  and its listeners never travel through a prop object, which the refs lint reads as a ref. */
  grip?: ReactNode;
  lifted?: boolean;
  open?: boolean;
  onToggle?: () => void;
  actions?: ReactNode;
  children?: ReactNode;
  testId?: string;
}) {
  const head = (
    <>
      <span className={styles.libCardName}><LibraryNameTags name={name} tags={tags} shared={shared} retired={retired} /></span>
      {facts && <span className={styles.libCardFacts}>{facts}</span>}
      {line && !open && <span className={quietLine ? styles.libCardQuiet : styles.libCardLine}>{line}</span>}
    </>
  );
  return (
    <div className={styles.libCard} data-retired={retired ? 'retired' : undefined} data-open={open ? 'on' : undefined}
      data-lifted={lifted ? 'on' : undefined} data-testid={testId}>
      <div className={styles.libCardRow}>
        {grip}
        {onToggle ? (
          <button type="button" className={styles.libCardMain} aria-expanded={!!open} onClick={onToggle}>
            {head}
            <span className={styles.libCardChevron} aria-hidden>
              {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            </span>
          </button>
        ) : (
          <span className={styles.libCardMain}>{head}</span>
        )}
        {actions && <span className={styles.libCardActions}>{actions}</span>}
      </div>
      {open && children}
    </div>
  );
}

/** The card list's container — the panel's and the picker's. */
export function LibraryList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`${styles.libList}${className ? ` ${className}` : ''}`}>{children}</div>;
}

/**
 * The table face — a row on the list recipe. `cells` are the data columns between the lead cell
 * and the chevron, each with the `data-label` the card reflow prints. The lead cell is the door
 * (a real button), the row's click the pointer shortcut on top of it.
 */
export function LibraryTableRow({
  name, tags, shared, retired, line, quietLine, facts, cells, onOpen, openLabel,
}: {
  name: string;
  tags?: readonly { id: string; name: string }[];
  shared?: boolean;
  retired?: boolean;
  line?: string | null;
  quietLine?: boolean;
  /** The data columns read as ONE line on a phone card ("20 min · Not in a plan yet"): the cells
   *  hide at ≤640 and this line shows under the title — the `.tableAsCards` family's own
   *  `cardPhoneLine` / `cardDesktopCell` pair. */
  facts: string;
  cells: { label: string; value: ReactNode; shrink?: boolean; data?: boolean }[];
  onOpen: () => void;
  openLabel: string;
}) {
  return (
    <tr className={`${styles.tr} ${styles.rowTappable}${retired ? ` ${styles.devRetiredRow}` : ''}`} onClick={onOpen}>
      <td className={`${styles.td} ${styles.cardStackCell} ${styles.libRowLead}`}>
        <button type="button" className={`${styles.devCellLink} ${styles.libRowName}`} onClick={e => { e.stopPropagation(); onOpen(); }}>
          <LibraryNameTags name={name} tags={tags} shared={shared} retired={retired} />
        </button>
        {facts && <span className={styles.cardPhoneLine}>{facts}</span>}
        {line && <span className={`${styles.listRowSub} ${quietLine ? styles.libRowQuiet : styles.libRowLine}`}>{line}</span>}
      </td>
      {cells.map(cell => (
        <td key={cell.label} className={`${styles.td} ${styles.cardDesktopCell}${cell.shrink ? ` ${styles.tdShrink}` : ''}${cell.data ? ` ${styles.libRowData}` : ''}`} data-label={cell.label}>
          {cell.value}
        </td>
      ))}
      <td className={`${styles.td} ${styles.cardActionCell} ${styles.cardActionCorner}`}>
        <span className={styles.listRowActions}>
          <button type="button" className={`${styles.linkBtn} ${styles.listRowToggle}`} aria-label={openLabel}
            onClick={e => { e.stopPropagation(); onOpen(); }}>
            <ChevronRight size={16} className={styles.listRowChevron} aria-hidden />
          </button>
        </span>
      </td>
    </tr>
  );
}

/**
 * The search box and the tag filter over any library list — the three tabs, the picker sheet and
 * the docked panel — so no two lists can drift on what "tagged" means. A `MultiSelectDropdown`,
 * not a chip row (register reading-order rule: four-plus options, or a list that will grow, is a
 * dropdown — practices re-evaluation follow-up, 2026-09-17). Ticking several tags OR-s them
 * together and "No tags" sits in the same list as a real option, never a mode of its own — the
 * same contract the Ledger's own Tags pill already speaks. The predicate itself is `filterTagged`,
 * the caller's.
 */
export function LibraryFilterBar({ items, noun, query, tagFilter, onQuery, onTagFilter, sort }: {
  items: readonly { tags: readonly { id: string; name: string }[] }[];
  /** "drills" · "templates" · "circuits" — the search box's word. */
  noun: string;
  query: string;
  tagFilter: ReadonlySet<string>;
  onQuery: (q: string) => void;
  onTagFilter: (next: Set<string>) => void;
  /** The tabs' phone Sort menu (`LibrarySortMenu`, T4) — beside the Tags filter, shown by the
   *  card breakpoint alone. The picker and the docked panel have no sort and pass nothing. */
  sort?: ReactNode;
}) {
  /* Memoised on the list: this bar sits inside the docked panel, which re-renders with the plan
     editor on every keystroke under autosave — the tag walk and the per-option counts must not
     repeat for a keystroke typed in a block. */
  const options = useMemo(() => {
    const all = collectTags(items as readonly Taggable[]);
    const counts = new Map(all.map(t => [t.id, items.filter(d => d.tags.some(x => x.id === t.id)).length]));
    const untagged = items.filter(d => d.tags.length === 0).length;
    const opts = all.map(t => ({ id: t.id, label: `${t.name} (${counts.get(t.id) ?? 0})` }));
    if (untagged > 0) opts.push({ id: UNTAGGED_FILTER, label: `No tags (${untagged})` });
    return opts;
  }, [items]);
  return (
    <div className={styles.ppDrillFilters}>
      {/* `.scoutSearch` — the same rounded search field the Scouting Book uses, reused rather than
          restyled (owner ask, 2026-09-17): one search-field look across the portal instead of a
          second recipe living beside it. */}
      <input className={styles.scoutSearch} type="search" value={query} onChange={e => onQuery(e.target.value)}
        placeholder={`Search ${noun}…`} aria-label={`Search ${noun}`} />
      <MultiSelectDropdown label="Tags" options={options} selected={tagFilter} onChange={onTagFilter} restQuiet />
      {sort}
    </div>
  );
}

/**
 * "May 19, 2026" — the Last planned cell on all three tabs, and the card's "last May 19, 2026"
 * (columns follow-up, owner ruling T2, 2026-09-17). ⚠ The date of the practice the plan was
 * written FOR — "last planned", never "last used" (D4).
 */
export function libraryDateLabel(iso: string): string {
  return formatInOrgZone(iso, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * The count cell on all three tabs: the figure and its unit — "8 plans", "1 plan" — and a dash
 * where there is nothing to count (owner, on sight, 2026-09-17: the heading already says the
 * verb — Plans, Started — so the cell does not repeat it, and Length shows a dash for an empty
 * template the same way). ⚠ Still PLANS, never practices; still never a bare 0. The CARD faces
 * keep their written labels (`drillUseLabel` / `templateUseLabel`) — a card has no heading to
 * lean on, and a bare dash on a card would say nothing.
 */
export function libraryCountCell(planCount: number): ReactNode {
  return planCount > 0
    ? `${planCount} plan${planCount === 1 ? '' : 's'}`
    : <span className={styles.devRowDash}>—</span>;
}

/** The Last planned cell: the date, or the dash. */
export function libraryDateCell(iso: string | null): ReactNode {
  return iso ? libraryDateLabel(iso) : <span className={styles.devRowDash}>—</span>;
}

/** The table's frame on the list recipe — the tabs' three tables share it. */
export function LibraryTable({ label, head, children }: { label: string; head: ReactNode; children: ReactNode }) {
  return (
    <div className={`${styles.tableWrap} ${styles.tableAsCards}`}>
      <table className={styles.table} aria-label={label}>
        <thead><tr>{head}<th className={styles.th} aria-label="Open" /></tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
