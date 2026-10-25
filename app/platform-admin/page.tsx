import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { requirePlatformAreaView } from '@/lib/platform-auth';
import { canViewPlatformArea } from '@/lib/platform-areas';
import { getPreviousPlatformAdminVisit } from '@/lib/platform-admin-visits';
import { countErrorsLastDay, getWaitingSnapshot, WAITING_GROUP_LABELS, WAITING_GROUPS, type WaitingQueue } from '@/lib/platform-waiting';
import { consoleDay, consoleClock } from '@/lib/console-dates';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import kit from './console.module.css';
import frame from '@/components/admin/kit/AdminKitFrame.module.css';
import styles from './today.module.css';

/**
 * Today — the support console's front door (Support console Stage 2, owner rulings A5 + Q4, 2026-10-25; drawings
 * Ub7fXLh29SC34Zp4oqKUx1, "Today"). It replaced Overview.
 *
 * What is waiting on us, as one table grouped by job: each row a queue, why its items wait, and its count in the amber
 * pill; a row opens the list that clears it. A queue with nothing waiting folds into the quiet "Clear: …" line under its
 * group, and a group with nothing waiting is one quiet line. Above it, the health line says only what the console can read
 * today — the product's own errors in 24 hours, a grey dot and no verdict (a green all-clear would vouch for builds and
 * databases nothing checks yet; Stage 5 reads those). The business numbers stay, quiet and below, one door away.
 * Roles trim it: each role sees the queues whose list it can open (`lib/platform-waiting.ts`).
 * On a phone the table becomes one framed list per group (F-41).
 */
export const metadata = { title: 'Today — Support console' };

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export default async function TodayPage() {
  const auth = await requirePlatformAreaView('overview');
  const previous = auth.user.email ? await getPreviousPlatformAdminVisit(auth.user.email) : null;
  const seesErrors = canViewPlatformArea(auth.role, 'observability');
  const [{ queues, stats }, errors24h] = await Promise.all([
    getWaitingSnapshot(auth.role, previous?.visited_at ?? null),
    seesErrors ? countErrorsLastDay() : Promise.resolve(0),
  ]);

  const groups = WAITING_GROUPS
    .map(key => {
      const all = queues.filter(q => q.group === key);
      const waiting = all.filter(q => q.count > 0);
      const clear = all.filter(q => q.count === 0);
      return { key, label: WAITING_GROUP_LABELS[key], all, waiting, clear, total: waiting.reduce((s, q) => s + q.count, 0) };
    })
    .filter(g => g.all.length > 0);
  const totalWaiting = groups.reduce((s, g) => s + g.total, 0);
  const queuesWaiting = groups.reduce((s, g) => s + g.waiting.length, 0);

  const nothingLine = (g: (typeof groups)[number]) =>
    g.all.length === 1 ? `nothing waiting in ${g.all[0].clearLabel}` : 'nothing waiting';
  const clearLine = (clear: WaitingQueue[]) => `Clear: ${clear.map(q => q.clearLabel).join(', ')}`;

  return (
    <div className={kit.page}>
      <AdminPageHeader title="Today" />

      {seesErrors && (
        <div className={styles.health}>
          <span className={styles.dot} aria-hidden />
          <span className={styles.healthText}>
            <strong>{plural(errors24h, 'error')}</strong> in the last 24 hours.
            <span className={styles.healthQuiet}> Builds and the databases are not checked here yet.</span>
          </span>
          <Link href="/platform-admin/observability" className={`${kit.door} ${styles.healthDoor}`}>Errors ›</Link>
        </div>
      )}

      <section className={kit.section}>
        <h2 className={kit.sectionTitle}>Waiting on us</h2>

        {/* The desk: one table. */}
        <div className={`${kit.card} ${styles.desk}`}>
          <div className={kit.toolbar}>
            <span className={kit.count}>
              {totalWaiting === 0 ? 'Nothing waiting' : `${totalWaiting} waiting in ${plural(queuesWaiting, 'queue')}`}
            </span>
            {previous && (
              <span className={`${kit.countQuiet} ${kit.toolbarEnd}`}>
                Since your last visit on {consoleDay(previous.visited_at)} at {consoleClock(previous.visited_at)}
              </span>
            )}
          </div>
          <div className={kit.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.colQueue}>Queue</th>
                  <th>Why it waits</th>
                  <th className={`${kit.num} ${styles.colCount}`}>Waiting</th>
                  <th className={styles.colDoor} aria-label="Open" />
                </tr>
              </thead>
              <tbody>
                {groups.map(g => (
                  <GroupRows key={g.key} label={g.label} total={g.total} waiting={g.waiting}
                    clear={g.waiting.length > 0 && g.clear.length > 0 ? clearLine(g.clear) : null}
                    nothing={g.waiting.length === 0 ? nothingLine(g) : null} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* A phone: one framed list per group. */}
        <div className={styles.phone}>
          {groups.map(g => (
            <div key={g.key} className={styles.phoneGroup}>
              <div className={kit.eye}>
                {g.label} · {g.waiting.length > 0 ? `${g.total} waiting` : nothingLine(g)}
              </div>
              {g.waiting.length > 0 && (
                <div className={styles.plist}>
                  {g.waiting.map(q => (
                    <Link key={q.key} href={q.href} className={styles.prow}>
                      <span className={styles.ptext}>
                        <strong>{q.label}</strong>
                        <span>{q.why}</span>
                      </span>
                      <span className={frame.count} aria-label={`${q.count} waiting`}>{q.count}</span>
                      <ChevronRight size={16} className={styles.pchev} aria-hidden />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className={styles.numbers}>
        <span><strong>{stats.totals.organizations}</strong> clubs and portals</span>
        <span><strong>{stats.totals.users}</strong> people</span>
        <span><strong>{stats.totals.tournaments}</strong> tournaments</span>
        <span><strong>{stats.totals.teams}</strong> teams</span>
        <span>about <strong>${stats.totals.estimatedMrr.toLocaleString('en-CA')}</strong> a month at list price</span>
        <Link href="/platform-admin/business-numbers" className={`${kit.door} ${styles.numbersDoor}`}>
          Business numbers: plan mix, billing, growth and usage ›
        </Link>
      </div>
    </div>
  );
}

function GroupRows({ label, total, waiting, clear, nothing }: {
  label: string;
  total: number;
  waiting: WaitingQueue[];
  clear: string | null;
  nothing: string | null;
}) {
  return (
    <>
      <tr className={styles.band}>
        <td colSpan={4}>{label} · {nothing ?? `${total} waiting`}</td>
      </tr>
      {waiting.map(q => (
        <tr key={q.key} className={kit.comfortable}>
          <td className={styles.colQueue}><Link href={q.href} className={kit.nameLink}>{q.label}</Link></td>
          <td className={kit.muted}>{q.why}</td>
          <td className={kit.num}><span className={frame.count} aria-label={`${q.count} waiting`}>{q.count}</span></td>
          <td className={kit.rowDoor}>
            <Link href={q.href} className={kit.rowDoorLink} aria-label={`Open ${q.label}`} tabIndex={-1}>›</Link>
          </td>
        </tr>
      ))}
      {clear && (
        <tr className={styles.clear}>
          <td colSpan={4}>{clear}</td>
        </tr>
      )}
    </>
  );
}
