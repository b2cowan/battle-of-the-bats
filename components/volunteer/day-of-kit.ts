import type { CSSProperties } from 'react';
import { KIT_INK, KIT_SURFACE } from '@/components/admin/kit/kit-inline';

/**
 * The day-of shells' hand-set colours on the kit (Admin Design Continuity slice 5, ruling R3). The two
 * volunteer layouts (`/{org}/scorekeeper`, `/{org}/check-in`) set their header inline — a ruled exception
 * (top-nav audit §3) — so no stylesheet reaches it; both twins lay these patches over it through
 * `kitStyler` while the switch is on, and read nothing from here while it is off. One home, so the twins
 * cannot drift (they did once, on colour — §D9). The kit's own recipes (`kit-inline.ts`) where one fits.
 *
 * ⚠ TOKENS ONLY, and the warm answers are FIXED here: the shells carry `data-guest-kit`, which pins the
 * warm palette whatever the device's Warm/Dark setting. ⚠ The release slice folds these in and deletes
 * this file with the switch.
 */
const body = 'var(--font-sans, system-ui, sans-serif)';

export const DAYOF_KIT = {
  /** The page ground — the portal's paper under white cards. */
  shell: { background: 'var(--home-paper)' },
  /** The header strip — the coaches portal's strip: a white bar over the paper, a hairline under it. */
  header: { borderBottom: '1px solid var(--home-line)', background: 'var(--card-bg)' },
  /** The wordmark's three parts, as the coach strip draws them in warm. */
  markField: KIT_INK.primary,
  markLogic: KIT_INK.accent,
  markHq: KIT_INK.tertiary,
  /** The organization's name under the wordmark (a label — it keeps the console face). */
  orgName: KIT_INK.tertiary,
  /** The desktop hop to the other duty ("Check-in →" / "Scorekeeper →") — a link, in the body face. */
  hop: { ...KIT_INK.accent, fontFamily: body, fontSize: 'var(--type-support)', fontWeight: 650, letterSpacing: 'normal', textTransform: 'none' },
  /** The desktop Sign out, beside it. */
  signOut: { ...KIT_INK.secondary, fontFamily: body, fontSize: 'var(--type-support)', fontWeight: 650, letterSpacing: 'normal', textTransform: 'none' },
  /** "This account does not have … access" — the paper page, the kit card, its eyebrow and its words. */
  refusalPage: { background: 'var(--home-paper)' },
  refusalCard: KIT_SURFACE.card,
  refusalLabel: KIT_INK.eyebrow,
  refusalText: { ...KIT_INK.secondary, fontFamily: body },
} satisfies Record<string, CSSProperties>;
