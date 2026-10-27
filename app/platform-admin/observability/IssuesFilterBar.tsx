'use client';

import { useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import kit from '../console.module.css';
import styles from './observability.module.css';
import { cap } from '../chips';

/**
 * Client filter bar for the Observability issues list. The page is a server component, but a plain
 * <form method=GET> submit does a full browser navigation (page reload + jump to top). This instead
 * does a soft App-Router navigation with { scroll: false }, so filtering updates the list in place
 * and keeps the scroll position. Inputs stay uncontrolled but the form is keyed on the APPLIED
 * filters, so a new result set (incl. Clear) resets the fields to match what's actually filtered.
 */

interface Props {
  windowKey: string;
  severity: string;
  status: string;
  route: string;
  org: string;
  q: string;
  severityOptions: string[];
  statusOptions: string[];
  hasFilters: boolean;
  /** The export dropdown, rendered by the server with the currently-applied filters. */
  children?: ReactNode;
}

function buildUrl(v: { windowKey: string; severity: string; status: string; route: string; org: string; q: string }): string {
  const sp = new URLSearchParams();
  if (v.windowKey && v.windowKey !== '24h') sp.set('window', v.windowKey);
  if (v.severity) sp.set('severity', v.severity);
  if (v.status) sp.set('status', v.status);
  if (v.route) sp.set('route', v.route);
  if (v.org) sp.set('org', v.org);
  if (v.q) sp.set('q', v.q);
  const qs = sp.toString();
  return `/platform-admin/observability${qs ? `?${qs}` : ''}`;
}

export default function IssuesFilterBar({
  windowKey, severity, status, route, org, q,
  severityOptions, statusOptions, hasFilters, children,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function navigate(url: string) {
    // Soft navigation: re-renders the server list without a full reload; scroll stays put.
    startTransition(() => router.push(url, { scroll: false }));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    navigate(buildUrl({
      windowKey,
      severity: String(fd.get('severity') ?? ''),
      status: String(fd.get('status') ?? 'all'),
      route: String(fd.get('route') ?? '').trim(),
      org: String(fd.get('org') ?? '').trim(),
      q: String(fd.get('q') ?? '').trim(),
    }));
  }

  return (
    // Keyed on applied filters so a new result set (including Clear) resets the uncontrolled inputs.
    <form key={`${q}|${severity}|${status}|${route}|${org}`} onSubmit={onSubmit} className={kit.toolbar}>
      <input type="search" name="q" defaultValue={q} placeholder="Search title, error or route" aria-label="Search issues" className={`${kit.search} ${styles.searchField}`} />
      <select name="severity" defaultValue={severity} className={kit.select} aria-label="Severity">
        <option value="">All severities</option>
        {severityOptions.map(s => <option key={s} value={s}>{cap(s)}</option>)}
      </select>
      <select name="status" defaultValue={status} className={kit.select} aria-label="Status">
        <option value="all">All statuses</option>
        {statusOptions.map(s => <option key={s} value={s}>{cap(s)}</option>)}
      </select>
      <input type="text" name="route" defaultValue={route} placeholder="Route…" aria-label="Route" className={`${kit.field} ${styles.shortField}`} />
      <input type="text" name="org" defaultValue={org} placeholder="Org slug…" aria-label="Org slug" className={`${kit.field} ${styles.shortField}`} />
      <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>{pending ? 'Filtering…' : 'Filter'}</button>
      {hasFilters && (
        <button type="button" className={kit.door} onClick={() => navigate(buildUrl({ windowKey, severity: '', status: 'all', route: '', org: '', q: '' }))} disabled={pending}>
          Clear
        </button>
      )}
      <span className={kit.toolbarEnd}>{children}</span>
    </form>
  );
}
