'use client';
/**
 * A table row that opens a record: the row is the pointer/touch shortcut, the name inside it stays the real link
 * (TABLE_AND_LIST_STANDARD §3.6). The click opens `href` unless it landed on something that does its own thing (the name,
 * the chevron, a button, a field) or ended a text selection (a copy gesture). Works from a server component, which is why
 * the "does its own thing" test lives here instead of as a stopPropagation on each link.
 */
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import kit from './console.module.css';

export default function LinkRow({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <tr
      className={className ? `${kit.clickableRow} ${className}` : kit.clickableRow}
      onClick={e => {
        if ((e.target as HTMLElement).closest('a, button, input, select, textarea, label')) return;
        if ((window.getSelection()?.toString() ?? '').length > 0) return;
        router.push(href);
      }}
    >
      {children}
    </tr>
  );
}
