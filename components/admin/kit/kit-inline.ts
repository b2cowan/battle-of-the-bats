import type { CSSProperties } from 'react';

/**
 * The kit's answers for the admin's HAND-SET inline styles (Admin Design Continuity slice 2).
 *
 * A stylesheet cannot reach an inline `style={{…}}` (it beats every class rule), and the admin sets
 * colours inline in hundreds of places — some as literals that ignore the theme, some as dark-ramp
 * tokens that mean the wrong thing on cream (`--white-8` as a border paints WHITE on a white card;
 * `--white-30` as text is a hairline). `useKitStyle()` (AdminKitProvider) lays one of these patches
 * over the legacy style while the switch is on and returns the legacy style untouched while it is off.
 *
 * ⚠ TOKENS ONLY — each value must resolve in BOTH themes (the warm block and the dark gate).
 * ⚠ The release slice folds each patch into its style and deletes this file.
 */

const body: CSSProperties = { fontFamily: 'var(--font-sans, system-ui, sans-serif)', fontWeight: 650, borderRadius: 'var(--radius-sm)' };

/** The portal's buttons (`coaches.module.css` `.btnPrimary` / `.btnSecondary` / `.btnDanger`). */
export const KIT_BUTTON = {
  primary: { ...body, background: 'var(--home-lime)', color: 'var(--home-lime-ink)', border: 'none' },
  secondary: { ...body, background: 'var(--card-bg)', color: 'var(--text-secondary)', border: '1px solid var(--home-line-strong)' },
  danger: { ...body, background: 'rgba(var(--danger-rgb), 0.08)', color: 'var(--home-live)', border: '1px solid rgba(var(--danger-rgb), 0.3)' },
} satisfies Record<string, CSSProperties>;

/** The kit's card and its quieter cousins. (A status TAG is not inline: the kit swaps it onto the admin's
 *  own `.badge-*` chips, so each tone has one home — the kit layer in app/globals.css.) */
export const KIT_SURFACE = {
  /** A panel that holds content — the kit card. */
  card: { background: 'var(--card-bg)', border: '1px solid var(--home-line)', borderRadius: '8px' },
  /** "Nothing here yet" — the dashed empty card. */
  empty: { background: 'var(--card-bg)', border: '1px dashed var(--home-line-strong)', borderRadius: '8px', color: 'var(--text-tertiary)' },
  /** A good outcome said in a box (a send that went out). */
  good: { background: 'rgba(var(--success-rgb), 0.07)', border: '1px solid rgba(var(--success-rgb), 0.28)', borderRadius: '8px', color: 'var(--text-primary)' },
  /** The chosen option in a list of choices — the kit's olive selection. */
  chosen: { background: 'var(--home-olive-soft)', border: '1px solid var(--home-olive)', borderRadius: '8px' },
  /** An option not chosen. */
  option: { background: 'var(--card-bg)', border: '1px solid var(--home-line-strong)', borderRadius: '8px' },
} satisfies Record<string, CSSProperties>;

/** Ink. */
export const KIT_INK = {
  primary: { color: 'var(--text-primary)' },
  secondary: { color: 'var(--text-secondary)' },
  tertiary: { color: 'var(--text-tertiary)' },
  accent: { color: 'var(--home-olive)' },
  /** A table's column heading — the standard's quiet head. */
  head: { fontFamily: 'var(--font-sans, system-ui, sans-serif)', fontSize: 'var(--type-support)', fontWeight: 650, letterSpacing: 'normal', textTransform: 'none', color: 'var(--text-tertiary)' },
  /** A required field's asterisk: the label's own ink (portal ruling 2026-08-25 — red means something went wrong). */
  asterisk: { color: 'inherit' },
  /** A label over a figure — the kit's eyebrow. */
  eyebrow: { fontFamily: 'var(--font-data)', fontSize: 'var(--type-label)', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-secondary)' },
} satisfies Record<string, CSSProperties>;

/** A hairline in the kit's warm ink (a row rule, a section rule). */
export const KIT_LINE = '1px solid var(--home-line)';
