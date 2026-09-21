'use client';
import { useMemo, useRef, useState } from 'react';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import { claimEscape } from './escapeOwnership';
import { normalizeOpponentName, recordChip, recordTone } from '@/lib/coach-opponents';
import type { OpponentBookEntry } from '@/lib/coach-opponents';
import {
  filterOpponentEntries, filterClubSpellings, resolveOpponentText, resolveClubSpelling,
  opponentMeetingLine, opponentPickedLine, clubPickedLine, type ClubPickerSpelling,
} from '@/lib/coach-opponent-picker';
import { formatInOrgZone } from '@/lib/timezone';

/**
 * THE OPPONENT FIELD READS THE SCOUTING BOOK (Opponent Picker D1–D5, owner 2026-09-21).
 *
 * The Location field's grammar, for one value: type to find one of the opponents the team has met
 * (most recently met first, each row wearing the book's own record chip and last meeting), pick one
 * and the game takes the book's SPELLING. Nothing else is written — no id, no link (D2): two of the
 * three things that write an opponent's name (the league importer, the tournament organizer) can only
 * ever supply a name, and the book already resolves a name. So the "picked" look here is DERIVED —
 * the text resolves in the book, directly or through a merged-away spelling — and typing over the
 * name is the detach, exactly as a place detaches.
 *
 * ⚠ NOT A TAG. A game wears several tags; it has one opponent, and that opponent names a record with
 * its own page and its own merge tool. And, unlike the Location list, NO "＋ Add" row and NO "Manage…"
 * row (D3, D4): an opponent carries nothing but its name (the book mints its page after the game),
 * nothing is minted on the form, and merging lives on the opponent's page — a row that left a
 * half-filled form for another page is the 09-01 refusal.
 *
 * A name the book doesn't know saves as typed; the list says so in one quiet line — the moment a new
 * spelling is about to be born, with the existing names a keystroke above it. An EMPTY book opens no
 * list at all: the field is the text box it was.
 *
 * Reuses the tag combobox's CSS (`.tagCombo*`) and its two hard-won rules: the list flips above the
 * input inside a clipping box, and it owns Escape only while open.
 */
export default function OpponentCombobox({
  id = 'event-opponent',
  value,
  onChange,
  entries,
  clubSpellings = [],
  onOpen,
  disabled = false,
}: {
  id?: string;
  /** The game's opponent text — what is saved, verbatim (trimmed by the host). */
  value: string;
  onChange: (text: string) => void;
  /** The team's book, as the schedule already fetches it for the row chips. */
  entries: readonly OpponentBookEntry[];
  /** Spellings the club's other teams hold notes under (D5) — [] when the club layer is closed. */
  clubSpellings?: readonly ClubPickerSpelling[];
  /** The host's re-read when the list opens (the tag picker's rule) — a merge made elsewhere shows next open. */
  onOpen?: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  /**
   * The highlighted row is remembered by the OPPONENT it points at, never by its row number: the
   * host re-reads the book when the list opens, and a response landing mid-arrow-key would otherwise
   * re-point the highlight (and what Enter picks) at a different team than the one the coach last
   * looked at (/review 2026-09-21).
   */
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // The book's own date format — "Jun 14, 2026" — because the book spans seasons and a bare
  // "Jun 14" for a meeting two summers ago is ambiguous exactly where the coach is trying to
  // remember when they last played this team (/review 2026-09-21).
  const fmtDay = (iso: string) => formatInOrgZone(iso, { month: 'short', day: 'numeric', year: 'numeric' });

  function openDropdown() {
    const el = inputRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      let top = 0, bottom = window.innerHeight;
      for (let n = el.parentElement; n; n = n.parentElement) {
        if (getComputedStyle(n).overflowY === 'visible') continue;
        const r = n.getBoundingClientRect();
        top = Math.max(top, r.top);
        bottom = Math.min(bottom, r.bottom);
      }
      setDropUp(bottom - rect.bottom < 250 && rect.top - top > 260);
    }
    // The host's re-read fires when the list OPENS, not on every keystroke — the prop's contract,
    // and a fetch per character with no sequencing is how a stale response overwrites a fresh one.
    if (!open) onOpen?.();
    setOpen(true);
  }

  const q = value.trim();
  const own = useMemo(() => filterOpponentEntries(entries, q), [entries, q]);
  const club = useMemo(() => filterClubSpellings(clubSpellings, q), [clubSpellings, q]);
  // One flat list of what the keys walk: own rows first, club rows after. A club row's key is
  // prefixed so a spelling the team also holds (it cannot — the combine drops those — but the
  // identity must not depend on that) never collides with its own row.
  const options = useMemo(() => [
    ...own.map(e => ({ key: e.key, displayName: e.displayName })),
    ...club.map(s => ({ key: `club:${s.key}`, displayName: s.displayName })),
  ], [own, club]);
  const optionCount = options.length;
  const activeIdx = activeKey === null ? -1 : options.findIndex(o => o.key === activeKey);
  const hasBook = entries.length > 0 || clubSpellings.length > 0;
  // "New" is judged on the NORMALIZED query — the same test the match uses — so "!!!" (which
  // normalizes to nothing and therefore matches everything) is not called a new team.
  const isNew = normalizeOpponentName(q).length > 0 && optionCount === 0 && hasBook;

  // The line under the field: the team's own book first, then a club spelling the team hasn't met.
  const resolved = useMemo(() => resolveOpponentText(entries, value), [entries, value]);
  const resolvedClub = useMemo(() => (resolved ? null : resolveClubSpelling(clubSpellings, value)), [resolved, clubSpellings, value]);
  const pickedLine = resolved ? opponentPickedLine(resolved, fmtDay) : resolvedClub ? clubPickedLine(resolvedClub) : '';

  function pick(displayName: string) {
    onChange(displayName);
    setOpen(false);
    setActiveKey(null);
  }
  function type(text: string) {
    onChange(text);
    openDropdown();
    setActiveKey(null);
  }
  function moveActive(delta: 1 | -1) {
    if (optionCount === 0) return;
    const next = Math.min(Math.max(activeIdx + delta, 0), optionCount - 1);
    setActiveKey(options[next].key);
  }

  // ⚠ "Open" means VISIBLY open. `open` alone is true after any focus, including on a team whose
  // book is empty and shows no list at all — and a claimed Escape on an invisible list is an Escape
  // the Add Game panel never receives (the coach presses twice). Every key branch and the
  // escape-owner marker read this, never the raw flag (/review 2026-09-21, High).
  const showList = open && !disabled && hasBook && (optionCount > 0 || isNew);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) openDropdown();
      moveActive(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveActive(-1);
    } else if (e.key === 'Enter') {
      if (!showList) return;
      e.preventDefault();
      if (activeIdx >= 0) pick(options[activeIdx].displayName);
      else setOpen(false);
    } else if (e.key === 'Escape' && showList) {
      claimEscape(e);
      setOpen(false);
    }
  }

  return (
    <div className={styles.tagCombo} data-escape-owner={showList ? '' : undefined}>
      <input
        ref={inputRef}
        id={id}
        className={styles.input}
        value={value}
        placeholder="Team name"
        autoComplete="off"
        disabled={disabled}
        onChange={e => type(e.target.value)}
        onFocus={openDropdown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <div className={`${styles.tagComboDropdown} ${dropUp ? styles.tagComboDropdownUp : ''}`}>
          {own.length > 0 && <div className={styles.tagComboGroup}>Your opponents</div>}
          {own.map((e, i) => (
            <button
              type="button"
              key={e.key}
              className={`${styles.tagComboOpt} ${i === activeIdx ? styles.tagComboOptActive : ''}`}
              onMouseDown={ev => ev.preventDefault()}
              onClick={() => pick(e.displayName)}
            >
              <span className={styles.tagComboOptName} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}>
                <span>{e.displayName}</span>
                <span className={styles.tagComboWord}>{opponentMeetingLine(e.lastMeeting, fmtDay)}</span>
              </span>
              {e.record.wins + e.record.losses + e.record.ties > 0 && (
                <span className={styles.scoutRecChip} data-tone={recordTone(e.record)}>{recordChip(e.record)}</span>
              )}
            </button>
          ))}
          {club.length > 0 && <div className={styles.tagComboGroup}>Your club has notes on</div>}
          {club.map((s, i) => (
            <button
              type="button"
              key={s.key}
              className={`${styles.tagComboOpt} ${own.length + i === activeIdx ? styles.tagComboOptActive : ''}`}
              onMouseDown={ev => ev.preventDefault()}
              onClick={() => pick(s.displayName)}
            >
              <span className={styles.tagComboOptName} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}>
                <span>{s.displayName}</span>
                <span className={styles.tagComboWord}>{s.teamNames.join(', ')}</span>
              </span>
              <span className={styles.tagComboCount}>club notes</span>
            </button>
          ))}
          {isNew && (
            <div className={styles.tagComboEmpty}>
              New to your book — saves as typed. “{q}” gets its own page after this game.
            </div>
          )}
        </div>
      )}
      {pickedLine && <p className={styles.formHint}>{pickedLine}</p>}
    </div>
  );
}
