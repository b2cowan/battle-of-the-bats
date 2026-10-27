'use client';
/**
 * The Feedback list's table (Support console Stage 5, Part 6; drawing D1). Date · Type · Category · Org · From · Title ·
 * Status · Replied. Each row loses the old status dropdown and Escalate button: the whole row opens the item's own record
 * (a record reads first, and triage happens there), with the title and the row's chevron as real links so the keyboard
 * has a way in. The rows arrive ready to draw — times already in the house clock — so the browser builds no time.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cap, feedbackStatusChip, feedbackTypeChip } from '../chips';
import kit from '../console.module.css';
import styles from './feedback.module.css';

export interface FeedbackListRow {
  id: string;
  /** "Oct 26, 9:15 a.m." */
  when: string;
  type: string;
  category: string | null;
  org: { id: string; name: string } | null;
  /** A signed-in sender's name (or address), linked to their record; null = "Not signed in". */
  from: { name: string; href: string } | null;
  title: string;
  status: string;
  escalated: boolean;
  /** The latest sent reply's time ("Oct 26, 9:50 a.m."), "Not yet", or "No address". */
  replied: { text: string; quiet: boolean };
}

/** Someone dragging to copy a title ends the drag inside the row: that is not a request to open it. */
function selectingText(): boolean {
  return (window.getSelection()?.toString() ?? '').length > 0;
}

export default function FeedbackTable({ rows }: { rows: FeedbackListRow[] }) {
  const router = useRouter();
  const open = (id: string) => router.push(`/platform-admin/feedback/${id}`);
  return (
    <div className={`${kit.tableWrap} table-cards`}>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Category</th>
            <th>Org</th>
            <th>From</th>
            <th>Title</th>
            <th>Status</th>
            <th>Replied</th>
            <th aria-label="Open" />
          </tr>
        </thead>
        <tbody className={kit.comfortable}>
          {rows.length === 0 && (
            <tr><td colSpan={9} className={kit.empty}>No feedback found.</td></tr>
          )}
          {rows.map(row => (
            <tr key={row.id} className={kit.clickableRow} onClick={() => { if (!selectingText()) open(row.id); }}>
              <td data-label="Date" className={kit.nowrap}>{row.when}</td>
              <td data-label="Type">
                <span className={`${kit.chip} ${feedbackTypeChip(row.type)}`}>{cap(row.type)}</span>
              </td>
              <td data-label="Category" className={kit.muted}>{row.category ?? '—'}</td>
              <td data-label="Org">
                {row.org ? (
                  <Link href={`/platform-admin/orgs/${row.org.id}`} className={kit.nameLink} onClick={e => e.stopPropagation()}>{row.org.name}</Link>
                ) : (
                  <span className={kit.muted}>None</span>
                )}
              </td>
              <td data-label="From" className={styles.fromCell}>
                {row.from ? (
                  <Link href={row.from.href} className={kit.nameLink} onClick={e => e.stopPropagation()}>{row.from.name}</Link>
                ) : (
                  <span className={kit.muted}>Not signed in</span>
                )}
              </td>
              <td className={`table-cards-title ${styles.titleCell}`}>
                <Link href={`/platform-admin/feedback/${row.id}`} className={kit.nameLink} onClick={e => e.stopPropagation()}>{row.title}</Link>
                {row.escalated && (
                  <span className={`${kit.chip} ${kit.chipBad} ${styles.escalatedChip}`} title="Flagged for the product team">Escalated</span>
                )}
              </td>
              <td data-label="Status">
                <span className={`${kit.chip} ${feedbackStatusChip(row.status)}`}>{cap(row.status)}</span>
              </td>
              <td data-label="Replied" className={`${kit.nowrap}${row.replied.quiet ? ` ${kit.muted}` : ''}`}>{row.replied.text}</td>
              <td className={kit.rowDoor}>
                <Link href={`/platform-admin/feedback/${row.id}`} className={kit.rowDoorLink} tabIndex={-1} aria-hidden onClick={e => e.stopPropagation()}>›</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
