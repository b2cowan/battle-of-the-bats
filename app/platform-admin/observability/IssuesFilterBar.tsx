'use client';

import { useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import styles from './observability.module.css';

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
    <form key={`${q}|${severity}|${status}|${route}|${org}`} onSubmit={onSubmit} className={styles.filterBar}>
      <input type="search" name="q" defaultValue={q} placeholder="Search title / error / route…" className={styles.filterInput} />
      <select name="severity" defaultValue={severity} className={styles.filterSelect} aria-label="Severity">
        <option value="">All severities</option>
        {severityOptions.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <select name="status" defaultValue={status} className={styles.filterSelect} aria-label="Status">
        <option value="all">All statuses</option>
        {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <input type="text" name="route" defaultValue={route} placeholder="Route…" className={styles.filterInput} style={{ maxWidth: 160 }} />
      <input type="text" name="org" defaultValue={org} placeholder="Org slug…" className={styles.filterInput} style={{ maxWidth: 140 }} />
      <button type="submit" className={styles.filterBtn} disabled={pending}>{pending ? 'Filtering…' : 'Filter'}</button>
      {children}
      {hasFilters && (
        <button type="button" className={styles.filterClear} onClick={() => navigate(buildUrl({ windowKey, severity: '', status: 'all', route: '', org: '', q: '' }))} disabled={pending}>
          Clear
        </button>
      )}
    </form>
  );
}
