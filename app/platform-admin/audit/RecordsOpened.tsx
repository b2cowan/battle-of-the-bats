import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { listRecordsOpened } from '@/lib/platform-record-opens';
import { peopleByIds } from '@/lib/platform-people-lookup';
import { consoleDate, consoleClock } from '@/lib/console-dates';
import { emailKindLabel } from '@/lib/email-kinds';
import LinkRow from '../LinkRow';
import kit from '../console.module.css';
import styles from './audit.module.css';

export const RECORDS_OPENED = 'records_opened';
const PAGE = 100;

/**
 * "Records opened" — the trail of club and person records, and sent emails, staff opened (Support console Stage 2, owner ruling A3). Super
 * admin only (the `records_opened` power). Who, when, which record, and whether Find opened it — never the words typed.
 * 90 days, pruned on write. Never shown on a customer's Story.
 */
export default async function RecordsOpened({ offset, pageHref }: { offset: number; pageHref: (offset: number) => string }) {
  const { rows, total } = await listRecordsOpened({ offset, limit: PAGE });
  const clubIds = rows.filter(r => r.kind === 'club').map(r => r.recordId);
  const personIds = rows.filter(r => r.kind === 'person').map(r => r.recordId);
  const emailIds = rows.filter(r => r.kind === 'email').map(r => r.recordId);
  const [clubsRes, people, emailsRes] = await Promise.all([
    clubIds.length ? supabaseAdmin.from('organizations').select('id, name').in('id', clubIds) : Promise.resolve({ data: [] }),
    peopleByIds(personIds).catch(() => new Map()),
    // A sent email opened from Sent emails (Stage 5): named by its kind and address, read now; one older than 90 days is gone.
    emailIds.length ? supabaseAdmin.from('platform_account_emails').select('id, kind, recipient_email').in('id', emailIds) : Promise.resolve({ data: [] }),
  ]);
  const emails = new Map(((emailsRes.data ?? []) as Array<{ id: string; kind: string; recipient_email: string }>).map(e => [e.id, e]));
  const clubNames = new Map(((clubsRes.data ?? []) as Array<{ id: string; name: string }>).map(c => [c.id, c.name]));

  return (
    <div className={kit.card}>
      <div className={kit.toolbar}>
        <span className={kit.count}>{total} records opened in the last 90 days</span>
        <span className={`${kit.countQuiet} ${kit.toolbarEnd}`}>Which record, not the words that found it</span>
      </div>
      <div className={`${kit.tableWrap} table-cards`}>
        <table className={kit.comfortable}>
          <thead><tr><th>When</th><th>Who</th><th>Record</th><th>How</th><th aria-label="Open" /></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className={kit.empty}>Nobody has opened a record yet.</td></tr>}
            {rows.map(r => {
              const sent = r.kind === 'email' ? emails.get(r.recordId) : undefined;
              const name = r.kind === 'club' ? clubNames.get(r.recordId) : r.kind === 'email' ? (sent ? emailKindLabel(sent.kind) : undefined) : people.get(r.recordId)?.email;
              const href = r.kind === 'club' ? `/platform-admin/orgs/${r.recordId}`
                : r.kind === 'email' ? `/platform-admin/sent-emails?email=${r.recordId}` : `/platform-admin/customer-users/${r.recordId}`;
              const cells = (
                <>
                  <td className={`${kit.nowrap} table-cards-title`}>{consoleDate(r.openedAt)}<span className={kit.sub}>{consoleClock(r.openedAt)}</span></td>
                  <td data-label="Who">{r.actorEmail}</td>
                  <td data-label="Record">
                    {name ? <Link href={href} className={kit.nameLink}>{name}</Link> : <span className={kit.muted}>Deleted since</span>}
                    <span className={kit.sub}>{r.kind === 'club' ? 'Club record' : r.kind === 'email' ? `Sent email to ${sent?.recipient_email ?? 'an address'}` : 'Person record'}</span>
                  </td>
                  <td data-label="How">{r.viaFind ? 'From Find' : 'From a list or a link'}</td>
                  <td className={kit.rowDoor}>
                    {name && <Link href={href} className={kit.rowDoorLink} tabIndex={-1} aria-hidden>›</Link>}
                  </td>
                </>
              );
              // A record deleted since opens nothing, so its row neither tints nor clicks.
              return name ? <LinkRow key={r.id} href={href}>{cells}</LinkRow> : <tr key={r.id}>{cells}</tr>;
            })}
          </tbody>
        </table>
      </div>
      {total > PAGE && (
        <div className={styles.pagination}>
          {offset > 0
            ? <Link href={pageHref(Math.max(0, offset - PAGE))} className="btn btn-secondary btn-sm">Previous</Link>
            : <button type="button" className="btn btn-secondary btn-sm" disabled>Previous</button>}
          <span className={kit.countQuiet}>Showing {offset + 1}-{offset + rows.length} of {total}</span>
          {offset + PAGE < total
            ? <Link href={pageHref(offset + PAGE)} className="btn btn-secondary btn-sm">Next</Link>
            : <button type="button" className="btn btn-secondary btn-sm" disabled>Next</button>}
        </div>
      )}
    </div>
  );
}
