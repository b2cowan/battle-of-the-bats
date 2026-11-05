import Link from 'next/link';
import type { ReactNode } from 'react';
import kit from './ClubKit.module.css';

/**
 * A link row on the public tournament pages — the club kit's list row (`ClubKit.module.css` `.row`: 60 px, a 16/600
 * name, an optional 12 px dim line, the drawn chevron). Public page layout standard R7 (owner ruling 2026-11-04,
 * docs/agents/design/PUBLIC_PAGE_LAYOUT_STANDARD.md): one look for every row that goes somewhere, shared with the club
 * pages rather than copied, so the two sites cannot drift. A row sits in a framed list — `PublicLinkList` below; a lone
 * row is a list of one (R5). `PublicDisclosure`'s row wears the same look and opens a window instead.
 */
export default function PublicDoorRow({ href, label, sub }: { href: string | null; label: string; sub?: string | null }) {
  const content = <span className={kit.rowMain}>
    <span className={kit.rowName}>{label}</span>
    {sub && <span className={kit.rowSub}>{sub}</span>}
  </span>;
  if (!href) return <div className={kit.row}>{content}</div>;
  return <Link className={kit.row} href={href}>{content}</Link>;
}

/** The framed list link rows sit in (R5: rows of the same kind are one list; a lone row is its own list of one). */
export function PublicLinkList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className ? `${kit.list} ${className}` : kit.list}>{children}</div>;
}
