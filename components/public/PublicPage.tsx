import type { HTMLAttributes } from 'react';
import parts from './PublicParts.module.css';

/**
 * The one body every public tournament page renders in (Public page layout standard R1–R3, owner ruling 2026-11-04;
 * docs/agents/design/PUBLIC_PAGE_LAYOUT_STANDARD.md). It owns the page's edges, its top, its 960 px column and the
 * 24 px between sections, so a page's own stylesheet never sets them: a page's root passes its own class only for
 * what is its own (a data marker, a role). Every branch a page returns — loading, unavailable, not found — renders in
 * it too, so the content never jumps when the data arrives. Guarded: tests/unit/public-page-layout-guard.test.ts.
 */
export default function PublicPage({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={className ? `${parts.page} ${className}` : parts.page} data-public-page="" />;
}
