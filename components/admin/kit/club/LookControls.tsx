'use client';
/**
 * THE LOOK'S CONTROLS — one colour control and one type control for both screens that set a look (Public tournament
 * pages Stage 1a, drawing ask 4, ruled 2026-11-02): the club's Public site editor (its Look row) and a tournament's
 * Branding page. They draw and report; the screen holds what is chosen and saves it.
 *
 *   LookSwatches   the nine presets as two-tone circles (the chosen one double-ringed), then Custom (the rainbow), whose
 *                  two pickers open under the row — with a hex code beside each when `hex` is set.
 *   LookPill       a two-tone dot and a name, set before the swatches: the club's "From your logo"; a tournament's
 *                  "The club's look".
 *   LookTypeTiles  the three type looks, each showing the name it will set in its own faces.
 *   HexField       a colour's hex code, typed; held until it is one.
 */
import { useState, type ReactNode } from 'react';
import { PRESETS } from '@/lib/themes';
import { CLUB_LOOKS, type ClubLook } from '@/lib/public-site-builder';
import { PUBLIC_SITE_WORDS as W } from '@/lib/public-site-words';
import { PUBLIC_SITE_WORDS as HEX_WORDS, parseHex } from '@/lib/tournament-settings-words';
import css from './LookControls.module.css';

export type OwnColours = { primary: string; accent: string };

const sameHex = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const twoTone = (primary: string, accent: string) => `linear-gradient(135deg, ${primary} 50%, ${accent} 50%)`;

export function HexField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (hex: string) => void }) {
  const [typed, setTyped] = useState(value.toUpperCase());
  const [seen, setSeen] = useState(value);
  if (!sameHex(seen, value)) { setSeen(value); setTyped(value.toUpperCase()); }
  const bad = typed.trim() !== '' && parseHex(typed) === null;
  return (
    <>
      <input id={id} className={css.hexInput} aria-label={`${label} · ${HEX_WORDS.hexCode}`} value={typed} maxLength={7} spellCheck={false}
        onChange={e => {
          setTyped(e.target.value);
          const hex = parseHex(e.target.value);
          if (hex) { setSeen(hex); onChange(hex); }
        }}
        onBlur={() => { if (parseHex(typed) === null) setTyped(value.toUpperCase()); }} />
      {bad && <p className={css.mistake} role="alert">{HEX_WORDS.hexHeld}</p>}
    </>
  );
}

export function LookPill({ primary, accent, label, on, onClick }: {
  primary: string;
  accent: string;
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`${css.pill}${on ? ` ${css.pillOn}` : ''}`} aria-pressed={on} onClick={onClick}>
      <span className={css.dual} style={{ background: twoTone(primary, accent) }} aria-hidden />
      {label}
    </button>
  );
}

export function LookSwatches({ labelledBy, idPrefix, before, chosenPreset, ownChosen, ownOpen, onPreset, onOwnToggle, own, onOwnChange, hex = false }: {
  labelledBy: string;
  /** Names the hex fields' ids, unique on the page. */
  idPrefix: string;
  /** A pill ahead of the presets (LookPill). */
  before?: ReactNode;
  /** The chosen preset's key; null when Custom or a pill is chosen. */
  chosenPreset: string | null;
  ownChosen: boolean;
  /** Custom's two pickers are open (chosen, or opened to choose). */
  ownOpen: boolean;
  onPreset: (key: string) => void;
  onOwnToggle: () => void;
  own: OwnColours;
  onOwnChange: (next: OwnColours) => void;
  hex?: boolean;
}) {
  const colour = (field: keyof OwnColours, name: string) => {
    const picker = (
      <label className={css.ownColour}>
        <input type="color" value={own[field]} onChange={e => onOwnChange({ ...own, [field]: e.target.value })} />
        <span>{name}</span>
      </label>
    );
    if (!hex) return picker;
    return (
      <div className={css.ownColourHex}>
        {picker}
        <HexField id={`${idPrefix}-${field}-hex`} label={name} value={own[field]} onChange={h => onOwnChange({ ...own, [field]: h })} />
      </div>
    );
  };
  return (
    <>
      <div className={css.swatches} role="group" aria-labelledby={labelledBy}>
        {before}
        {Object.entries(PRESETS).map(([key, p]) => {
          const on = chosenPreset === key;
          return (
            <button key={key} type="button" title={p.name} aria-label={p.name} aria-pressed={on}
              className={`${css.swatch}${on ? ` ${css.swatchOn}` : ''}`}
              style={{ background: twoTone(p.primary, p.accent) }}
              onClick={() => onPreset(key)} />
          );
        })}
        <button type="button" title={W.ownColours} aria-label={W.ownColours} aria-pressed={ownChosen} aria-expanded={ownOpen}
          className={`${css.swatch} ${css.swatchOwn}${ownChosen ? ` ${css.swatchOn}` : ''}`}
          onClick={onOwnToggle} />
      </div>
      {ownOpen && (
        <div className={css.ownColours}>
          {colour('primary', W.mainColour)}
          {colour('accent', W.accentColour)}
        </div>
      )}
    </>
  );
}

export function LookTypeTiles({ labelledBy, name, chosen, onPick }: {
  labelledBy: string;
  /** What each tile sets in its faces: the club's name, or the tournament's. */
  name: string;
  chosen: ClubLook | null;
  onPick: (look: (typeof CLUB_LOOKS)[number]) => void;
}) {
  return (
    <div className={css.tiles} role="group" aria-labelledby={labelledBy}>
      {CLUB_LOOKS.map(l => (
        <button key={l.key} type="button" aria-pressed={chosen === l.key} data-look={l.key}
          className={`${css.tile}${chosen === l.key ? ` ${css.tileOn}` : ''}`} onClick={() => onPick(l)}>
          <span className={css.tileName}>{W.typeLooks[l.key]}</span>
          <span className={css.tileTitle}>{name}</span>
          <span className={css.tileText}>{W.typeSample}</span>
        </button>
      ))}
    </div>
  );
}
