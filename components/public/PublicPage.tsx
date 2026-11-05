import type { HTMLAttributes } from 'react';
import parts from './PublicParts.module.css';

/**
 * The one body every public page renders in (Public page layout standard R1–R3, owner ruling 2026-11-04; the club round
 * C2 + C5, 2026-11-05; docs/agents/design/PUBLIC_PAGE_LAYOUT_STANDARD.md). It owns the page's edges, its top, its 960 px
 * column and the 24 px between sections, so a page's own stylesheet never sets them: a page's root passes its own class
 * only for what is its own (a data marker, a role). Every branch a page returns — loading, unavailable, not found —
 * renders in it too, so the content never jumps when the data arrives.
 *
 *   · `frame="club"` — a club public page: the same column, its left edge on the club's logo edge (the tournament's
 *     stands beside its menu instead); its two-column pages split from 1,024 px.
 *   · `width="form"` with `frame="club"` — a club form (a sign-up, Your sign-up): 640 px of content (C2; the tournament's
 *     Register is 640 too, by its own `.formWrap` on the page's left edge).
 *
 * Guarded: tests/unit/public-page-layout-guard.test.ts.
 */
export default function PublicPage({ className, frame, width, ...rest }: HTMLAttributes<HTMLDivElement> & {
  frame?: 'club';
  width?: 'form';
}) {
  const classes = [parts.page, frame === 'club' && parts.club, width === 'form' && parts.form, className].filter(Boolean).join(' ');
  return <div {...rest} className={classes} data-public-page="" />;
}
