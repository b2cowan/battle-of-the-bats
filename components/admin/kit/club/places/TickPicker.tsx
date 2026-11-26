'use client';
/**
 * A FORM FIELD THAT TAKES SEVERAL TICKS (Club Website Stage 2, Session 2D; rulings M1, M7; the drawing
 * CLUB_WEBSITE_STAGE2_PLACES_DRAWINGS.html notes 2, 9, 11, 13). The Close a place window's Places field and each chosen
 * park's diamond field.
 *
 * ⚠⚠ NOT `MultiSelectDropdown`. That is a REPORT FILTER, where nothing ticked means "All"; here nothing ticked means nothing
 *   is closed (note 2), so a shared component would close every park on an empty pick. This one has no "All" state of its
 *   own: the caller says what each tick means, and a pinned row ("All our fields", "All diamonds") is just another tick.
 * REUSED, NOT REDRAWN: the panel, rows, band heads and divider are the filter family's (`FilterPill.module.css`:
 *   `multiSelectPanel`, `multiSelectOption`, `multiSelectGroupHead`, `multiSelectDivider`); the face is the kit's form field
 *   (`ClubKit.module.css` `.select`); the outside click and the panel's edge fit are `useDetailsOutsideClick`'s.
 * ⚖ ON A PHONE, A DRAWER (M7, note 13; new for a multi-pick field — design log 2026-11-26): the portal's phone sheet
 *   (`SheetFrame overWindow`, as the season window's Start from drawer) with 48px rows and Done; ticks apply as they are
 *   made; Done, a tap on the dim, Escape or Back closes it (the frame's floor, which yields the window's Escape). At a desk
 *   the menu's Escape is CLAIMED (`claimEscape`) so it closes the menu, never the window under it.
 * ⚖ SEARCH ONLY NARROWS (note 9): a ticked row is never hidden by it, and opening the field clears it.
 */
import { useId, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import useDetailsOutsideClick from '@/components/coaches/useDetailsOutsideClick';
import { claimEscape } from '@/components/coaches/escapeOwnership';
import SheetFrame from '@/components/coaches/SheetFrame';
import fp from '@/components/shared/FilterPill.module.css';
import ck from '../ClubKit.module.css';
import s from './ClosePlace.module.css';

export interface TickOption { id: string; label: string; checked: boolean; disabled?: boolean }
export interface TickBand { key: string; label?: string; options: TickOption[] }

export default function TickPicker({ title, face, faceLabel, bands, pinned, foot, onToggle, search, phone, compact, disabled, doneLabel }: {
  /** The drawer's heading and the panel's group name ("Places", "Lions Park"). */
  title: string;
  /** The collapsed field's words ("2 places chosen", "2 of 3 diamonds"). */
  face: string;
  /** The face's own name for a screen reader, when the words alone don't say what it is. */
  faceLabel?: string;
  bands: TickBand[];
  /** Rows under the scrolling list, always in view ("All our fields"). */
  pinned?: TickOption[];
  /** The panel's last line (the limit). */
  foot?: ReactNode;
  onToggle: (id: string, on: boolean) => void;
  /** A search box above the list (note 9): its placeholder. */
  search?: string;
  phone: boolean;
  /** The small face on a chosen park's row (the diamond field), hung from its right edge. */
  compact?: boolean;
  disabled?: boolean;
  doneLabel: string;
}) {
  const [q, setQ] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const ref = useDetailsOutsideClick(!phone);
  const opener = useRef<HTMLButtonElement>(null);
  const headId = useId();

  const needle = q.trim().toLowerCase();
  const shown = (o: TickOption) => !needle || o.checked || o.label.toLowerCase().includes(needle);
  const row = (o: TickOption) => (
    <label key={o.id} className={`${fp.multiSelectOption} ${s.tickRow} ${o.disabled ? s.tickRowOff : ''}`}>
      <input type="checkbox" checked={o.checked} disabled={o.disabled || disabled} onChange={e => onToggle(o.id, e.target.checked)} />
      <span>{o.label}</span>
    </label>
  );
  const body = (
    <>
      {search && (
        <input type="search" className={`${ck.input} ${s.tickSearch}`} placeholder={search} aria-label={search}
          value={q} onChange={e => setQ(e.target.value)} />
      )}
      {/* `multiSelectSheetList`: the first band's head sheds its hairline, at the panel's top or the drawer's. */}
      <div className={`${s.tickList} ${fp.multiSelectSheetList}`}>
        {bands.map(b => {
          const opts = b.options.filter(shown);
          if (!opts.length) return null;
          return (
            <div key={b.key} role="group" aria-label={b.label ?? title}>
              {b.label && <div className={fp.multiSelectGroupHead}>{b.label}</div>}
              {opts.map(row)}
            </div>
          );
        })}
      </div>
      {pinned && pinned.length > 0 && <div className={s.tickPinned}><div className={fp.multiSelectDivider} />{pinned.map(row)}</div>}
      {foot && <p className={s.tickFoot}>{foot}</p>}
    </>
  );

  const faceClass = compact ? s.tickFaceSmall : `${ck.select} ${s.tickFace}`;
  const faceInner = <><span className={s.tickFaceText}>{face}</span><ChevronDown size={16} aria-hidden /></>;

  if (phone) {
    return (
      <>
        <button ref={opener} type="button" className={faceClass} aria-haspopup="dialog" aria-expanded={sheetOpen} aria-label={faceLabel}
          disabled={disabled} onClick={() => { setQ(''); setSheetOpen(true); }}>{faceInner}</button>
        {sheetOpen && (
          // The portal's one phone sheet (`SheetFrame overWindow`, as Start from's drawer over its window): the dim, the
          // screen's foot, Escape, Back and focus are the frame's. A MENU: ticks apply as they are made, nothing is lost.
          // The head is the drawing's, so the frame is given no `label` of its own (it would say the name twice).
          <SheetFrame onClose={() => setSheetOpen(false)} opener={opener} overWindow role="dialog" aria-labelledby={headId}>
            <div className={s.drawer}>
              <div id={headId} className={s.drawerHead}>{title}</div>
              <div className={s.drawerBody}>{body}</div>
              <button type="button" className={`btn btn-outline ${s.drawerDone}`} onClick={() => setSheetOpen(false)}>{doneLabel}</button>
            </div>
          </SheetFrame>
        )}
      </>
    );
  }

  return (
    <details ref={ref} className={`${fp.multiSelect} ${compact ? s.tickSmall : s.tickWide}`}
      onToggle={e => { if ((e.currentTarget as HTMLDetailsElement).open) setQ(''); }}
      // Escape closes the menu and is claimed, so the window's floor leaves the window open.
      onKeyDown={e => {
        if (e.key !== 'Escape' || !ref.current?.open || e.nativeEvent.isComposing) return;
        claimEscape(e);
        ref.current.open = false;
        ref.current.querySelector('summary')?.focus();
      }}>
      <summary className={faceClass} aria-label={faceLabel} aria-disabled={disabled || undefined}
        onClick={e => { if (disabled) e.preventDefault(); }}>{faceInner}</summary>
      {/* Focusable, so a click on a band head or the limit line keeps focus (and so Escape) in the menu. */}
      <div data-pill="panel" tabIndex={-1} className={`${fp.multiSelectPanel} ${s.tickPanel} ${compact ? s.tickPanelSmall : ''}`} role="group" aria-label={title}>
        {body}
      </div>
    </details>
  );
}
