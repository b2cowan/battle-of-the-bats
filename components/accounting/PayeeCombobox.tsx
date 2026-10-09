'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronDown } from 'lucide-react';
import type { OrgPayee } from '@/lib/types';
import styles from './PayeeCombobox.module.css';
import { useDismissable } from '@/lib/overlay-hooks';

/**
 * What either search sends: the club's (every club payee) and a team's (`PickerPayee`, lib/team-payees.ts),
 * whose rows carry `scope` — 'club' for a payee the club SHARED, 'team' for the team's own.
 */
type ListedPayee = Pick<OrgPayee, 'id' | 'teamId' | 'name'> & { scope?: 'club' | 'team' };

/**
 * ⚖ THE TEAM PICKER'S WORDS (Ledger Parity D7, owner 2026-10-02): the club's shared payees under the tag
 * legend's own words, in the club's blue, with the one line that tells a coach what sharing means; the
 * team's own under its own heading. One home, so the Payees page and the picker cannot say it two ways.
 */
export const SHARED_PAYEES_HEADING = 'Shared by your club';
export const SHARED_PAYEES_NOTICE = 'Your club sees payments to these payees.';
export const OWN_PAYEES_HEADING = 'Your team’s own';

export interface PayeeSelection {
  payeeId: string | null;
  payeePayer: string | null;
  displayName: string;
}

interface Props {
  payeesApiUrl: string;
  value: PayeeSelection | null;
  onChange: (v: PayeeSelection | null) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Label shown on the "save" action button. E.g. "team" → "Save as team payee". Defaults to "club" — the club's own
   *  pickers (one word, "club", never "org": /marketing 2026-10-02). */
  saveScope?: string;
  /**
   * The list's last row, "Manage payees…" (Club Tier Stage 3a C01; Ledger Parity D6/D7) — a BUTTON that opens the
   * Payees window over the form the picker sits in (Ledger Parity D8 on the coach's, Club Tier Stage 3d Ask 7a on the
   * club's): a link here left an open form, and an entry being added was lost. Opt-in; one spelling for both
   * portals, held here. ⚰ The page link (`manageHref`) retired with the club's Payees page (Stage 3d).
   */
  onManage?: () => void;
  /**
   * Stand at the admin kit's field size beside the kit's own fields (40px, the strong hairline; 44px at
   * touch widths) — the club Ledger's line window (/design 2026-10-01). Opt-in: the coach's forms keep
   * today's field.
   */
  kitField?: boolean;
}

export default function PayeeCombobox({
  payeesApiUrl,
  value,
  onChange,
  placeholder = 'Search or enter payee…',
  disabled,
  saveScope = 'club',
  onManage,
  kitField = false,
}: Props) {
  const [inputVal, setInputVal]   = useState('');
  const [results, setResults]     = useState<ListedPayee[]>([]);
  const [open, setOpen]           = useState(false);
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState('');
  const containerRef              = useRef<HTMLDivElement>(null);
  const debounceRef               = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    try {
      // The admin caller's URL already carries `?orgSlug=` (its route refuses without it); the
      // coach callers' URLs carry the org in the path. Append, never assume the first `?`.
      const sep  = payeesApiUrl.includes('?') ? '&' : '?';
      const res  = await fetch(`${payeesApiUrl}${sep}q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.payees ?? []);
    } catch { setResults([]); }
  }, [payeesApiUrl]);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(inputVal), 220);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [inputVal, open, search]);

  // Gains Escape-to-close, and the listeners now exist only while the dropdown is open — the
  // hand-rolled version attached on mount with `[]` deps, so it handled every click anywhere for as
  // long as the form was mounted, open or not. No page renders two of these at once today, so this
  // retires a latent cost rather than a measured one.
  useDismissable(open, containerRef, () => setOpen(false));

  function openDropdown() {
    if (disabled) return;
    setOpen(true);
    setSaveError('');
    search(inputVal);
  }

  function selectSaved(payee: ListedPayee) {
    onChange({ payeeId: payee.id, payeePayer: null, displayName: payee.name });
    setInputVal('');
    setOpen(false);
  }

  function selectOneTime() {
    const name = inputVal.trim();
    if (!name) return;
    onChange({ payeeId: null, payeePayer: name, displayName: name });
    setInputVal('');
    setOpen(false);
  }

  async function saveAndSelect() {
    const name = inputVal.trim();
    if (!name) return;
    setSaving(true);
    setSaveError('');
    try {
      const res  = await fetch(payeesApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          const match = results.find(p => p.name.toLowerCase() === name.toLowerCase());
          if (match) { selectSaved(match); return; }
        }
        setSaveError(data.error ?? 'Could not save payee');
        return;
      }
      onChange({ payeeId: data.payee.id, payeePayer: null, displayName: data.payee.name });
      setInputVal('');
      setOpen(false);
    } catch {
      setSaveError('Could not save payee');
    } finally {
      setSaving(false);
    }
  }

  function clear() {
    onChange(null);
    setInputVal('');
  }

  const trimmed    = inputVal.trim();
  const exactMatch = results.find(p => p.name.toLowerCase() === trimmed.toLowerCase());

  /* The sections. ⚠ A TEAM'S SEARCH IS GROUPED BY `scope`, NEVER BY `teamId` (Ledger Parity session 1's call
     list): in a standalone team's org every row is the team's own even with `teamId: null`, and grouping
     by teamId would file them under the club. The club's own search carries no scope and keeps its two
     headings unchanged. */
  const scoped     = results.some(p => p.scope);
  const sharedRows = scoped ? results.filter(p => p.scope === 'club') : results.filter(p => p.teamId === null);
  const ownRows    = scoped ? results.filter(p => p.scope !== 'club') : results.filter(p => p.teamId !== null);

  if (value) {
    return (
      <div className={styles.selectedRow} data-kit-field={kitField || undefined}>
        <span className={styles.selectedName}>{value.displayName}</span>
        {value.payeeId === null && (
          <span className={styles.oneTimeLabel}>one-time</span>
        )}
        {!disabled && (
          <button type="button" className={styles.clearBtn} onClick={clear} title="Clear payee">
            <X size={13} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={styles.root} ref={containerRef} data-kit-field={kitField || undefined}>
      <div className={styles.inputWrap}>
        <input
          className={styles.input}
          type="text"
          value={inputVal}
          // Typing REOPENS the list, not just `onFocus`. Escape closes the list but leaves the
          // caret here, and a payee is only committed by picking a listed option — so without this,
          // Escape-then-keep-typing left no keyboard way back to the list and the typed name was
          // silently dropped on submit while the field still looked filled in. Found by `/review`.
          onChange={e => { setInputVal(e.target.value); if (!open) openDropdown(); }}
          onFocus={openDropdown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
        />
        <ChevronDown size={14} className={styles.chevron} />
      </div>

      {open && (
        <div className={styles.dropdown}>
          {sharedRows.length > 0 && (
            <div className={styles.section}>
              <p className={styles.sectionLabel}>{scoped ? SHARED_PAYEES_HEADING : 'Organization'}</p>
              {scoped && <p className={styles.sectionNote}>{SHARED_PAYEES_NOTICE}</p>}
              {sharedRows.map(p => (
                <button key={p.id} type="button" className={`${styles.option}${scoped ? ` ${styles.optionShared}` : ''}`} onMouseDown={() => selectSaved(p)}>
                  {p.name}
                </button>
              ))}
            </div>
          )}

          {ownRows.length > 0 && (
            <div className={styles.section}>
              <p className={styles.sectionLabel}>{scoped ? OWN_PAYEES_HEADING : 'This team'}</p>
              {ownRows.map(p => (
                <button key={p.id} type="button" className={styles.option} onMouseDown={() => selectSaved(p)}>
                  {p.name}
                </button>
              ))}
            </div>
          )}

          {trimmed && !exactMatch && (
            <div className={styles.section}>
              <button type="button" className={`${styles.option} ${styles.optionAction}`} onMouseDown={selectOneTime}>
                Use &ldquo;{trimmed}&rdquo; as one-time
              </button>
              <button
                type="button"
                className={`${styles.option} ${styles.optionSave}`}
                onMouseDown={saveAndSelect}
                disabled={saving}
              >
                {saving ? 'Saving…' : `Save "${trimmed}" as ${saveScope} payee`}
              </button>
              {saveError && <p className={styles.saveError}>{saveError}</p>}
            </div>
          )}

          {!trimmed && results.length === 0 && (
            <p className={styles.empty}>Type to search or enter a new payee name</p>
          )}
          {onManage && (
            <div className={styles.foot}>
              {/* onMouseDown keeps the input from blurring first, as every option above does. */}
              <button type="button" className={`${styles.manage} ${styles.manageBtn}`} onMouseDown={e => e.preventDefault()}
                onClick={() => { setOpen(false); onManage(); }}>Manage payees…</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
