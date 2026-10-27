import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { requirePlatformAreaView } from '@/lib/platform-auth';
import { canViewPlatformArea } from '@/lib/platform-areas';
import { getPreviousPlatformAdminVisit } from '@/lib/platform-admin-visits';
import { getWaitingSnapshot, WAITING_GROUP_LABELS, WAITING_GROUPS, type WaitingQueue } from '@/lib/platform-waiting';
import { consoleDay, consoleClock } from '@/lib/console-dates';
import { readCheapLines } from '@/lib/platform-status';
import { summarize } from '@/lib/platform-status-lines';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import LinkRow from './LinkRow';
import kit from './console.module.css';
import frame from '@/components/admin/kit/AdminKitFrame.module.css';
import styles from './today.module.css';

/**
 * Today — the support console's front door (Support console Stage 2, owner rulings A5 + Q4, 2026-10-25; drawings
 * Ub7fXLh29SC34Zp4oqKUx1, "Today"). It replaced Overview.
 *
 * What is waiting on us, as one table grouped by job: each row a queue, why its items wait, and its count in the amber
 * pill; a row opens the list that clears it. A queue with nothing waiting folds into the quiet "Clear: …" line under its
 * group, and a group with nothing waiting is one quiet line. Above it, the health line (Support console Stage 5): the worst
 * verdict from Status's CHEAP lines only — our own records and our database, read with Today, never Amplify or Supabase,
 * so Today stays as fast as it was — and says plainly that builds and database services are read when Status opens. Its
 * door goes to Status. The business numbers stay, quiet and below, one door away.
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
  const seesStatus = canViewPlatformArea(auth.role, 'status');
  const [{ queues, stats }, cheapLines] = await Promise.all([
    getWaitingSnapshot(auth.role, previous?.visited_at ?? null),
    seesStatus ? readCheapLines() : Promise.resolve([]),
  ]);
  const health = summarize(cheapLines);

  const groups = WAITING_GROUPS
    .map(key => {
      const all = queues.filter(q => q.group === key);
      // A queue that could not be read stays in view with "Not read"; it is never "clear" and never counted.
      const waiting = all.filter(q => q.count > 0 || q.notRead);
      const clear = all.filter(q => q.count === 0 && !q.notRead);
      return { key, label: WAITING_GROUP_LABELS[key], all, waiting, clear, total: waiting.reduce((s, q) => s + q.count, 0), unread: waiting.filter(q => q.notRead).length };
    })
    .filter(g => g.all.length > 0);
  const totalWaiting = groups.reduce((s, g) => s + g.total, 0);
  const queuesWaiting = groups.reduce((s, g) => s + g.waiting.length, 0);
  const queuesUnread = groups.reduce((s, g) => s + g.unread, 0);
  // A queue that could not be read is never 'nothing waiting' — the words say so, here and in every group.
  const waitingWords = (total: number, unread: number) =>
    unread === 0 ? `${total} waiting` : total === 0 ? `${unread} not read` : `${total} waiting · ${unread} not read`;

  const nothingLine = (g: (typeof groups)[number]) =>
    g.all.length === 1 ? `nothing waiting in ${g.all[0].clearLabel}` : 'nothing waiting';
  const clearLine = (clear: WaitingQueue[]) => `Clear: ${clear.map(q => q.clearLabel).join(', ')}`;

  return (
    <div className={kit.page}>
      <AdminPageHeader title="Today" />

      {seesStatus && (
        <div className={styles.health}>
          <span className={`${styles.dot} ${health.tone === 'act' ? styles.dotAct : health.tone === 'look' ? styles.dotLook : styles.dotFine}`} aria-hidden />
          <span className={styles.healthText}>
            <strong>Status: {health.tone === 'fine' ? 'all fine.' : health.lead}</strong>
            {health.tone !== 'fine' && health.headline ? ` ${health.headline}` : ''}
            <span className={styles.healthQuiet}> Builds and database services are read when Status opens.</span>
          </span>
          <Link href="/platform-admin/status" className={`${kit.door} ${styles.healthDoor}`}>Status ›</Link>
        </div>
      )}

      <section className={kit.section}>
        <h2 className={kit.sectionTitle}>Waiting on us</h2>

        {/* The desk: one table. */}
        <div className={`${kit.card} ${styles.desk}`}>
          <div className={kit.toolbar}>
            <span className={kit.count}>
              {totalWaiting === 0 && queuesUnread === 0
                ? 'Nothing waiting'
                : totalWaiting === 0
                  ? `${plural(queuesUnread, 'queue')} could not be read`
                  : `${totalWaiting} waiting in ${plural(queuesWaiting - queuesUnread, 'queue')}${queuesUnread > 0 ? ` · ${queuesUnread} not read` : ''}`}
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
                  <GroupRows key={g.key} label={g.label} words={waitingWords(g.total, g.unread)} waiting={g.waiting}
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
                {g.label} · {g.waiting.length > 0 ? waitingWords(g.total, g.unread) : nothingLine(g)}
              </div>
              {g.waiting.length > 0 && (
                <div className={styles.plist}>
                  {g.waiting.map(q => (
                    <Link key={q.key} href={q.href} className={styles.prow}>
                      <span className={styles.ptext}>
                        <strong>{q.label}</strong>
                        <span>{q.why}</span>
                      </span>
                      <WaitingCount q={q} />
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

function WaitingCount({ q }: { q: WaitingQueue }) {
  if (q.notRead) return <span className={kit.countQuiet}>Not read</span>;
  return <span className={frame.count} aria-label={`${q.count} waiting`}>{q.count}</span>;
}

function GroupRows({ label, words, waiting, clear, nothing }: {
  label: string;
  words: string;
  waiting: WaitingQueue[];
  clear: string | null;
  nothing: string | null;
}) {
  return (
    <>
      <tr className={styles.band}>
        <td colSpan={4}>{label} · {nothing ?? words}</td>
      </tr>
      {waiting.map(q => (
        <LinkRow key={q.key} href={q.href} className={kit.comfortable}>
          <td className={styles.colQueue}><Link href={q.href} className={kit.nameLink}>{q.label}</Link></td>
          <td className={kit.muted}>{q.why}</td>
          <td className={kit.num}><WaitingCount q={q} /></td>
          <td className={kit.rowDoor}>
            <Link href={q.href} className={kit.rowDoorLink} aria-label={`Open ${q.label}`} tabIndex={-1}>›</Link>
          </td>
        </LinkRow>
      ))}
      {clear && (
        <tr className={styles.clear}>
          <td colSpan={4}>{clear}</td>
        </tr>
      )}
    </>
  );
}
