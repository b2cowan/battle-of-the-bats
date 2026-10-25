import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { listRecordsOpened } from '@/lib/platform-record-opens';
import { peopleByIds } from '@/lib/platform-people-lookup';
import { consoleDate, consoleClock } from '@/lib/console-dates';
import kit from '../console.module.css';
import styles from './audit.module.css';

export const RECORDS_OPENED = 'records_opened';
const PAGE = 100;

/**
 * "Records opened" — the trail of club and person records staff opened (Support console Stage 2, owner ruling A3). Super
 * admin only (the `records_opened` power). Who, when, which record, and whether Find opened it — never the words typed.
 * 90 days, pruned on write. Never shown on a customer's Story.
 */
export default async function RecordsOpened({ offset, pageHref }: { offset: number; pageHref: (offset: number) => string }) {
  const { rows, total } = await listRecordsOpened({ offset, limit: PAGE });
  const clubIds = rows.filter(r => r.kind === 'club').map(r => r.recordId);
  const personIds = rows.filter(r => r.kind === 'person').map(r => r.recordId);
  const [clubsRes, people] = await Promise.all([
    clubIds.length ? supabaseAdmin.from('organizations').select('id, name').in('id', clubIds) : Promise.resolve({ data: [] }),
    peopleByIds(personIds).catch(() => new Map()),
  ]);
  const clubNames = new Map(((clubsRes.data ?? []) as Array<{ id: string; name: string }>).map(c => [c.id, c.name]));

  return (
    <div className={kit.card}>
      <div className={kit.toolbar}>
        <span className={kit.count}>{total} records opened in the last 90 days</span>
        <span className={`${kit.countQuiet} ${kit.toolbarEnd}`}>Which record, not the words that found it</span>
      </div>
      <div className={`${kit.tableWrap} table-cards`}>
        <table className={kit.comfortable}>
          <thead><tr><th>When</th><th>Who</th><th>Record</th><th>How</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} className={kit.empty}>Nobody has opened a record yet.</td></tr>}
            {rows.map(r => {
              const name = r.kind === 'club' ? clubNames.get(r.recordId) : people.get(r.recordId)?.email;
              const href = r.kind === 'club' ? `/platform-admin/orgs/${r.recordId}` : `/platform-admin/customer-users/${r.recordId}`;
              return (
                <tr key={r.id}>
                  <td className={`${kit.nowrap} table-cards-title`}>{consoleDate(r.openedAt)}<span className={kit.sub}>{consoleClock(r.openedAt)}</span></td>
                  <td data-label="Who">{r.actorEmail}</td>
                  <td data-label="Record">
                    {name ? <Link href={href} className={kit.nameLink}>{name}</Link> : <span className={kit.muted}>Deleted since</span>}
                    <span className={kit.sub}>{r.kind === 'club' ? 'Club record' : 'Person record'}</span>
                  </td>
                  <td data-label="How">{r.viaFind ? 'From Find' : 'From a list or a link'}</td>
                </tr>
              );
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
