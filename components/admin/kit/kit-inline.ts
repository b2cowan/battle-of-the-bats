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
  // The LIGHT red as ink: `--home-live` (Dark: `--danger`) on this tint measured 4.41:1 (slice 3 sweep);
  // `--danger-light` clears it in Dark and is the same `--home-live` in Warm.
  danger: { ...body, background: 'rgba(var(--danger-rgb), 0.08)', color: 'var(--danger-light)', border: '1px solid rgba(var(--danger-rgb), 0.3)' },
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
  /** Something that needs acting on, said in a box (an overdue count). */
  alert: { background: 'rgba(var(--danger-rgb), 0.05)', border: '1px solid rgba(var(--danger-rgb), 0.35)', borderRadius: '8px' },
  /** A door to another screen, set as a tile (Rep Teams' quick links, Accounting's planning tools). */
  door: { background: 'var(--card-bg)', border: '1px solid var(--home-line)', borderRadius: '8px', color: 'var(--text-primary)' },
  /** A menu or popover set by hand (the wizard's venue search) — the portal's popover. */
  menu: { background: 'var(--card-bg)', border: '1px solid var(--home-line)', borderRadius: '8px', boxShadow: 'var(--home-shadow)' },
} satisfies Record<string, CSSProperties>;

/** A numbered step (Allocate to teams, New cost allocation): the one you are on or have passed wears the
 *  portal's primary (ink on lime); one still ahead is quiet. Its label: ink when current, tertiary when not. */
export const KIT_STEP = {
  reached: { background: 'var(--home-lime)', color: 'var(--home-lime-ink)' },
  ahead: { background: 'var(--home-olive-soft)', color: 'var(--text-tertiary)' },
  current: { color: 'var(--text-primary)' },
  other: { color: 'var(--text-tertiary)' },
} satisfies Record<string, CSSProperties>;

/** Ink. */
export const KIT_INK = {
  primary: { color: 'var(--text-primary)' },
  secondary: { color: 'var(--text-secondary)' },
  tertiary: { color: 'var(--text-tertiary)' },
  accent: { color: 'var(--home-olive)' },
  /** A state said in words (an error note, a saved note, a caution) — the LIGHT tier, which clears AA
   *  on the kit's Dark ground where the base hue does not (`--danger` 3.81:1, slice 0), and is the
   *  same warm ink in Warm. */
  danger: { color: 'var(--danger-light)' },
  success: { color: 'var(--success-light)' },
  warning: { color: 'var(--warning-light)' },
  /** A table's column heading — the standard's quiet head. */
  head: { fontFamily: 'var(--font-sans, system-ui, sans-serif)', fontSize: 'var(--type-support)', fontWeight: 650, letterSpacing: 'normal', textTransform: 'none', color: 'var(--text-tertiary)' },
  /** A required field's asterisk: the label's own ink (portal ruling 2026-08-25 — red means something went wrong). */
  asterisk: { color: 'inherit' },
  /** A label over a figure — the kit's eyebrow. */
  eyebrow: { fontFamily: 'var(--font-data)', fontSize: 'var(--type-label)', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-secondary)' },
} satisfies Record<string, CSSProperties>;

/** A hairline in the kit's warm ink (a row rule, a section rule). */
export const KIT_LINE = '1px solid var(--home-line)';
