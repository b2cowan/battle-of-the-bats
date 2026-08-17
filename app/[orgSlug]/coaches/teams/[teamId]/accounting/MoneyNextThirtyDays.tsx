'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import type { PayableItem, PayableLane } from '@/components/accounting/UpcomingPayablesPanel';
import styles from './overview-dashboard.module.css';

/* One chronological money timeline for the Overview dashboard — dues, team
 * payables and org allocations interleaved by date instead of three fixed
 * columns (two of which are usually empty sentences holding a third of the
 * width each). Overview-only by design: the shared UpcomingPayablesPanel
 * keeps its other two callers (coach Expenses tab, admin rep-teams) as-is. */

interface Props {
  apiUrl: string;
  hrefs: {
    dues: string;
    /**
     * ⚠ PAYABLES, NOT TRANSACTIONS (Money split P1, 2026-08-16). Every row in this panel is money
     * that has NOT moved yet — that is what "next 30 days" means — so a row's View has to open the
     * tab that manages what is owed. It used to open the combined screen, where the coach landed
     * on the list of what had already been spent and had to find the payables sub-tab themselves.
     */
    payables: string;
    allocations?: string;
    /** The full, unwindowed commitment list (Payables, schedule view). */
    fullSchedule: string;
  };
}

type LaneKind = 'dues' | 'payable' | 'org';

interface LedgerRow {
  key: string;
  lane: LaneKind;
  overdue: boolean;
  dueDate: string | null;
  daysUntilDue: number | null;
  title: string;
  sub: string | null;
  amount: number;
}

/* Direction is a property of the lane, never stored per-row: dues are money
 * coming in; every other lane is money going out. */
const LANE_KIND_BY_ID: Record<string, LaneKind> = {
  collections_due: 'dues',
  team_payables: 'payable',
  org_payables: 'org',
};
const isIn = (lane: LaneKind) => lane === 'dues';

function fmt(n: number) {
  return `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

function buildRows(lanes: PayableLane[]): LedgerRow[] {
  const rows: LedgerRow[] = [];

  // Iterate whatever lanes the API returns — a lane id this component doesn't
  // recognize still renders (as money out) rather than silently vanishing. The
  // same endpoint feeds the shared three-column panel, which iterates lanes
  // generically, so a lane added there must not disappear from this ledger.
  for (const l of lanes) {
    const kind = LANE_KIND_BY_ID[l.id] ?? 'payable';

    if (kind !== 'dues') {
      for (const i of l.items) {
        rows.push({
          key: `${l.id}-${i.id}`, lane: kind, overdue: i.overdue, dueDate: i.dueDate,
          daysUntilDue: i.daysUntilDue, title: i.description,
          sub: i.category ?? i.label ?? null, amount: i.amount,
        });
      }
      continue;
    }

    // Overdue dues never group — a coach acts on a specific family, not a batch.
    // `||` not `??` on the title: an empty-string player name must fall back to
    // the installment name too, or the row renders with a blank title.
    for (const i of l.items.filter(d => d.overdue)) {
      rows.push({
        key: `${l.id}-${i.id}`, lane: kind, overdue: true, dueDate: i.dueDate,
        daysUntilDue: i.daysUntilDue, title: i.label || i.description,
        sub: i.label ? `${i.description}${i.dueDate ? ` · was due ${fmtDate(i.dueDate)}` : ''}` : null,
        amount: i.amount,
      });
    }

    // Upcoming dues: installments sharing name, date and amount collapse into one
    // row ("Installment #2 — 12 players") — the single biggest scroll saving on
    // this panel, and pure presentation (the payload is already per-player).
    const groups = new Map<string, PayableItem[]>();
    for (const i of l.items.filter(d => !d.overdue)) {
      const k = `${i.description}|${i.dueDate ?? ''}|${i.amount}`;
      const g = groups.get(k);
      if (g) g.push(i); else groups.set(k, [i]);
    }
    for (const members of groups.values()) {
      const first = members[0];
      if (members.length === 1) {
        rows.push({
          key: `${l.id}-${first.id}`, lane: kind, overdue: false, dueDate: first.dueDate,
          daysUntilDue: first.daysUntilDue, title: first.label || first.description,
          sub: first.label ? first.description : null, amount: first.amount,
        });
      } else {
        const names = members.map(m => m.label).filter(Boolean) as string[];
        const shown = names.slice(0, 3);
        // "+N more" counts MEMBERS beyond the names shown, not surviving names —
        // a member with a blank name must still be counted, or the sub-line
        // contradicts the player count in the title.
        const remainder = members.length - shown.length;
        rows.push({
          key: `${l.id}-grp-${first.id}`, lane: kind, overdue: false, dueDate: first.dueDate,
          daysUntilDue: first.daysUntilDue,
          title: `${first.description} — ${members.length} players`,
          sub: shown.length === 0 ? null
            : remainder > 0 ? `${shown.join(', ')} +${remainder} more` : shown.join(', '),
          amount: members.reduce((s, m) => s + m.amount, 0),
        });
      }
    }
  }

  // Overdue first (oldest debt on top), then everything upcoming by date; a
  // dateless row ("action needed") sorts to the end of its block.
  const dateKey = (r: LedgerRow) => r.dueDate ?? '9999-12-31';
  rows.sort((a, b) =>
    (a.overdue === b.overdue ? 0 : a.overdue ? -1 : 1)
    || dateKey(a).localeCompare(dateKey(b))
    || a.title.localeCompare(b.title));
  return rows;
}

export default function MoneyNextThirtyDays({ apiUrl, hrefs }: Props) {
  const [days, setDays] = useState<30 | 60 | 90>(30);
  const [lanes, setLanes] = useState<PayableLane[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Monotonic request sequence: rapid 30d→90d clicks leave two fetches in
  // flight, and without this guard the FIRST response to land wins — showing
  // the old window's rows under a toggle that already says the new one.
  const reqSeq = useRef(0);
  const load = useCallback(async () => {
    const seq = ++reqSeq.current;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiUrl}?days=${days}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load');
      const data = await res.json();
      if (seq !== reqSeq.current) return;
      setLanes(data.lanes ?? []);
    } catch (e: unknown) {
      if (seq !== reqSeq.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load payables.');
    } finally {
      if (seq === reqSeq.current) setLoading(false);
    }
  }, [apiUrl, days]);

  useEffect(() => { load(); }, [load]);

  const { rows, overdueAmt, inAmt, outAmt, hasInRows, hasOutRows } = useMemo(() => {
    const rows = buildRows(lanes);
    let overdueAmt = 0, inAmt = 0, outAmt = 0, hasInRows = false, hasOutRows = false;
    for (const r of rows) {
      if (isIn(r.lane)) hasInRows = true; else hasOutRows = true;
      if (r.overdue) overdueAmt += r.amount;
      else if (isIn(r.lane)) inAmt += r.amount;
      else outAmt += r.amount;
    }
    return { rows, overdueAmt, inAmt, outAmt, hasInRows, hasOutRows };
  }, [lanes]);

  function actionFor(row: LedgerRow): { href: string; label: string } | null {
    if (row.lane === 'dues') return { href: hrefs.dues, label: row.overdue ? 'Remind' : 'View' };
    if (row.lane === 'payable') return { href: hrefs.payables, label: 'View' };
    return hrefs.allocations ? { href: hrefs.allocations, label: 'View' } : null;
  }

  return (
    <div className={styles.card}>
      <div className={styles.ledgerHead}>
        <span className={styles.eye}>Next {days} days</span>
        {!loading && !error && rows.length > 0 && (
          <span className={styles.ledgerSummary}>
            {overdueAmt > 0 && <><b className={styles.amtBad}>{fmt(overdueAmt)}</b> overdue · </>}
            {inAmt > 0 ? <><b className={styles.amtIn}>{fmt(inAmt)}</b> coming in</> : 'nothing coming in'}
            {' · '}
            {outAmt > 0 ? <><b>{fmt(outAmt)}</b> going out</> : 'nothing going out'}
          </span>
        )}
        <div className={styles.daysToggle}>
          {([30, 60, 90] as const).map(d => (
            <button
              key={d}
              type="button"
              className={`${styles.daysBtn} ${days === d ? styles.daysBtnActive : ''}`}
              onClick={() => setDays(d)}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div>
          <div className={styles.skeleton} />
          <div className={styles.skeleton} style={{ width: '70%' }} />
          <div className={styles.skeleton} style={{ width: '55%' }} />
        </div>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : rows.length === 0 ? (
        <p className={styles.ledgerAllClear}>Nothing due in the next {days} days.</p>
      ) : (
        <div className={styles.ledgerRows}>
          {rows.map(row => {
            const action = actionFor(row);
            return (
              <div key={row.key} className={styles.ledgerRow}>
                <span className={styles.ledgerWhen}>
                  <span className={`${styles.ledgerDate} ${row.overdue ? styles.ledgerDateDue : ''}`}>
                    {row.dueDate ? fmtDate(row.dueDate) : '—'}
                  </span>
                  {row.overdue && row.daysUntilDue !== null ? (
                    <span className={`${styles.badge} ${styles.badgeLate}`}>{Math.abs(row.daysUntilDue)}d late</span>
                  ) : (
                    <span className={`${styles.badge} ${isIn(row.lane) ? styles.badgeDues : styles.badgeOut}`}>
                      {row.lane}
                    </span>
                  )}
                </span>
                <span className={styles.ledgerMain}>
                  <p className={styles.ledgerTitle}>{row.title}</p>
                  {row.sub && <p className={styles.ledgerSub}>{row.sub}</p>}
                </span>
                <span className={styles.ledgerEnd}>
                  <span className={`${styles.ledgerAmt} ${row.overdue ? styles.amtBad : isIn(row.lane) ? styles.amtIn : ''}`}>
                    {isIn(row.lane) && !row.overdue ? '+' : ''}{fmt(row.amount)}
                  </span>
                  {action && <Link href={action.href} className={styles.ledgerAct}>{action.label}</Link>}
                </span>
              </div>
            );
          })}
          {!hasOutRows && (
            <p className={styles.ledgerEmptyLine}>No team payables or org payments fall due in this window.</p>
          )}
          {!hasInRows && (
            <p className={styles.ledgerEmptyLine}>No player dues fall due in this window.</p>
          )}
        </div>
      )}

      <div className={styles.foot}>
        <Link href={hrefs.fullSchedule} className={styles.footLink}>
          See the full payment schedule →
        </Link>
      </div>
    </div>
  );
}