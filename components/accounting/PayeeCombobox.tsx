'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronDown } from 'lucide-react';
import type { OrgPayee } from '@/lib/types';
import styles from './PayeeCombobox.module.css';

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
  /** Label shown on the "save" action button. E.g. "team" → "Save as team payee". Defaults to "org". */
  saveScope?: string;
}

export default function PayeeCombobox({
  payeesApiUrl,
  value,
  onChange,
  placeholder = 'Search or enter payee…',
  disabled,
  saveScope = 'org',
}: Props) {
  const [inputVal, setInputVal]   = useState('');
  const [results, setResults]     = useState<OrgPayee[]>([]);
  const [open, setOpen]           = useState(false);
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState('');
  const containerRef              = useRef<HTMLDivElement>(null);
  const debounceRef               = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    try {
      const res  = await fetch(`${payeesApiUrl}?q=${encodeURIComponent(q)}`);
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

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function openDropdown() {
    if (disabled) return;
    setOpen(true);
    setSaveError('');
    search(inputVal);
  }

  function selectSaved(payee: OrgPayee) {
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

  // Split results into org-wide and team-scoped for labeled sections
  const orgWide    = results.filter(p => p.teamId === null);
  const teamScoped = results.filter(p => p.teamId !== null);

  if (value) {
    return (
      <div className={styles.selectedRow}>
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
    <div className={styles.root} ref={containerRef}>
      <div className={styles.inputWrap}>
        <input
          className={styles.input}
          type="text"
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onFocus={openDropdown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
        />
        <ChevronDown size={14} className={styles.chevron} />
      </div>

      {open && (
        <div className={styles.dropdown}>
          {orgWide.length > 0 && (
            <div className={styles.section}>
              <p className={styles.sectionLabel}>Organization</p>
              {orgWide.map(p => (
                <button key={p.id} type="button" className={styles.option} onMouseDown={() => selectSaved(p)}>
                  {p.name}
                </button>
              ))}
            </div>
          )}

          {teamScoped.length > 0 && (
            <div className={styles.section}>
              <p className={styles.sectionLabel}>This team</p>
              {teamScoped.map(p => (
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
        </div>
      )}
    </div>
  );
}
