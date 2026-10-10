'use client';
/**
 * PICK A TOURNAMENT'S VENUES — one ticked list (Tournament admin redesign Stage 5, E1 and E5; the /design review's #5:
 * "ONE way to pick, for everyone"). The New tournament window's venue step and Venues & facilities' Add a venue both
 * draw it.
 *
 *   Venue  [ Search your venues        ]      ← the field only NARROWS the list (Club Stage 6's Venue field, its search)
 *   ┌ YOUR VENUES ─────────────────────────┐   ← or THE CLUB'S VENUE LIBRARY (League Plus and Club, A5) — never
 *   │ ☑ Lions Park                         │     another tournament's copies for a club (the library is its one book)
 *   │   3 diamonds · last used for …       │
 *   │ ☐ Cedar Hollow Fields                │
 *   │ ＋ A new venue                     › │   ← opens the New venue sheet; the venue joins the list already ticked
 *   └──────────────────────────────────────┘
 *
 * "Your venues" is each venue a past event used, once, with its diamonds (A51 — the import-from-past route's first
 * door). The list's rows say which book they come from in the band; a row already in this tournament (Add a venue) is
 * ticked and fixed, "Already in this tournament", so a repeat import is never silent.
 */
import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { ClubRow, ClubRowBand, ClubRowFrame, ClubRowList } from '@/components/admin/kit/club/RepKit';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { CheckRow } from '@/components/admin/tournament/ScreenParts';
import styles from './VenueChooser.module.css';

/** One venue in the list. `key` is the caller's ("past:<id>", "library:<id>", "new:<n>"). */
export type ChooserVenue = {
  key: string;
  name: string;
  address: string | null;
  caption: string;
  /** In the tournament already (Add a venue): ticked, fixed, said. */
  alreadyHere?: boolean;
};

const fold = (s: string | null | undefined) => (s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

export default function VenueChooser({
  idPrefix = 'venues',
  heading,
  searchPlaceholder,
  venues,
  added,
  ticked,
  onToggle,
  newLabel,
  newCaption,
  onNew,
  alreadyHereCaption,
  noMatch,
  notice,
}: {
  idPrefix?: string;
  /** The band: "Your venues" / "The club's Venue library". */
  heading: string;
  searchPlaceholder: string;
  /** The book's venues. */
  venues: readonly ChooserVenue[];
  /** New venues typed in this window — listed after the book's, ticked when added. */
  added: readonly ChooserVenue[];
  ticked: ReadonlySet<string>;
  onToggle: (key: string, checked: boolean) => void;
  /** "A new venue" / "A venue that isn't the club's". */
  newLabel: string;
  newCaption: string;
  /** Opens the New venue sheet, with what was typed as its name. */
  onNew: (typed: string) => void;
  /** "Already in this tournament" (Add a venue only). */
  alreadyHereCaption?: string;
  noMatch: (query: string) => string;
  /** A quiet line inside the frame (the book couldn't be read). */
  notice?: string;
}) {
  const [query, setQuery] = useState('');
  const q = fold(query);
  const shown = useMemo(
    () => (q ? venues.filter(v => fold(v.name).includes(q) || fold(v.address).includes(q)) : venues),
    [venues, q],
  );
  const shownAdded = q ? added.filter(v => fold(v.name).includes(q) || fold(v.address).includes(q)) : added;
  const bookRows = shown.length + shownAdded.length;

  return (
    <div className={styles.chooser}>
      <label className={ck.field} htmlFor={`${idPrefix}-search`}>
        <span className={ck.label}>Venue</span>
        <span className={styles.search}>
          <input
            id={`${idPrefix}-search`}
            className={`${ck.input} ${styles.searchInput}`}
            type="search"
            value={query}
            placeholder={searchPlaceholder}
            autoComplete="off"
            onChange={e => setQuery(e.target.value)}
          />
          <Search size={16} aria-hidden className={styles.searchIcon} />
        </span>
      </label>
      <ClubRowFrame>
        <ClubRowList inset label={heading}>
          {(venues.length > 0 || added.length > 0) && <ClubRowBand>{heading}</ClubRowBand>}
          {shown.map(v => (
            <CheckRow
              key={v.key}
              checked={v.alreadyHere || ticked.has(v.key)}
              disabled={v.alreadyHere}
              onChange={checked => onToggle(v.key, checked)}
              title={v.name}
              caption={v.alreadyHere && alreadyHereCaption ? alreadyHereCaption : v.caption}
            />
          ))}
          {shownAdded.map(v => (
            <CheckRow key={v.key} checked={ticked.has(v.key)} onChange={checked => onToggle(v.key, checked)} title={v.name} caption={v.caption} />
          ))}
          {q && bookRows === 0 && <ClubRow title={<span className={styles.quiet}>{noMatch(query.trim())}</span>} />}
          {notice && <ClubRow title={<span className={styles.quiet}>{notice}</span>} />}
          <ClubRow
            as="button"
            aria-haspopup="dialog"
            onClick={() => onNew(query)}
            mark={<Plus size={18} />}
            title={newLabel}
            caption={newCaption}
            chevron
          />
        </ClubRowList>
      </ClubRowFrame>
    </div>
  );
}
