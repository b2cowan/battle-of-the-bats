'use client';
/**
 * THE TOURNAMENT TOOLBAR'S SEARCH — the one field (`SearchField`, Toolbar Rules Rule 5, owner 2026-10-17) at a desk,
 * and on a phone the 44px square that opens it full-width under the line (2026-10-12). Until 2026-10-17 each
 * tournament toolbar drew its own copy, and the copies had drifted (two clear labels, two ✕ sizes). The three nodes
 * share one open state but land in three places, which is why this is a hook and not one component:
 *
 *   field  — the desk field; the host puts it in the line (inside `.deskFilters`, which a phone hides).
 *   toggle — the phone square; lit while the field holds text.
 *   row    — the open field, for the host to place under the toolbar line. It stays while it holds text or is being
 *            typed in (deleting the last letter never shuts it under the thumb); its ✕ empties and closes it and
 *            hands focus back to the square.
 */
import { useRef, useState } from 'react';
import { Search } from 'lucide-react';
import SearchField from '@/components/shared/SearchField';
import tb from './AdminToolbar.module.css';

export function useToolbarSearch({ value, onChange, label }: {
  value: string;
  onChange: (next: string) => void;
  /** The accessible name, no dots ("Search teams"); the field adds them to its hint. */
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const square = useRef<HTMLButtonElement>(null);
  const shown = open || value !== '';
  return {
    field: <SearchField value={value} onChange={onChange} label={label} />,
    toggle: (
      <button ref={square} type="button" className={`${tb.tool} ${tb.phoneTool}`} onClick={() => setOpen(o => !o)}
        aria-expanded={shown} aria-label={label} data-on={value !== '' || undefined}>
        <Search size={18} aria-hidden />
      </button>
    ),
    row: shown && (
      <div className={tb.phoneSearchRow}>
        <SearchField value={value} label={label} layout="fill" autoFocus
          onChange={next => { setOpen(true); onChange(next); }}
          onClear={() => { setOpen(false); square.current?.focus(); }} />
      </div>
    ),
  };
}
