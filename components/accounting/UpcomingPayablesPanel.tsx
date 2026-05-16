'use client';
import { useState, useEffect, useCallback } from 'react';
import styles from './UpcomingPayablesPanel.module.css';

export interface PayableItem {
  id: string;
  description: string;
  amount: number;
  dueDate: string | null;
  daysUntilDue: number | null;
  overdue: boolean;
  label: string | null;
  requestType?: string;
}

export interface PayableLane {
  id: string;
  title: string;
  emptyMessage: string;
  items: PayableItem[];
}

interface Props {
  apiUrl: string;
  reviewQueueUrl?: string;
}

function fmt(n: number) {
  return `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

function DaysBadge({ days, overdue }: { days: number | null; overdue: boolean }) {
  if (days === null) {
    return (
      <span className={styles.badgeAction}>Action needed</span>
    );
  }
  if (overdue) {
    return (
      <span className={styles.badgeOverdue}>
        {Math.abs(days)}d overdue
      </span>
    );
  }
  const urgency = days <= 7 ? styles.badgeUrgent : days <= 14 ? styles.badgeWarning : styles.badgeSafe;
  return <span className={`${styles.badge} ${urgency}`}>{days}d</span>;
}

function LaneItem({ item }: { item: PayableItem }) {
  const isOverdue = item.overdue;
  return (
    <div className={`${styles.item} ${isOverdue ? styles.itemOverdue : ''}`}>
      <div className={styles.itemMain}>
        {item.label && (
          <span className={styles.itemLabel}>{item.label}</span>
        )}
        <span className={styles.itemDesc}>{item.description}</span>
      </div>
      <div className={styles.itemRight}>
        <span className={styles.itemAmount}>{fmt(item.amount)}</span>
        <div className={styles.itemMeta}>
          {item.dueDate && (
            <span className={styles.itemDate}>{fmtDate(item.dueDate)}</span>
          )}
          <DaysBadge days={item.daysUntilDue} overdue={isOverdue} />
        </div>
      </div>
    </div>
  );
}

function Lane({ lane, reviewQueueUrl }: { lane: PayableLane; reviewQueueUrl?: string }) {
  const overdueItems  = lane.items.filter(i => i.overdue);
  const upcomingItems = lane.items.filter(i => !i.overdue);
  const totalAmount   = lane.items.reduce((s, i) => s + i.amount, 0);

  return (
    <div className={styles.lane}>
      <div className={styles.laneHeader}>
        <span className={styles.laneTitle}>{lane.title}</span>
        {lane.items.length > 0 && (
          <span className={styles.laneCount}>
            {lane.items.length} · {fmt(totalAmount)}
          </span>
        )}
      </div>

      <div className={styles.laneBody}>
        {lane.items.length === 0 ? (
          <p className={styles.emptyMsg}>{lane.emptyMessage}</p>
        ) : (
          <>
            {overdueItems.length > 0 && (
              <div className={styles.overdueGroup}>
                {overdueItems.map(item => <LaneItem key={item.id} item={item} />)}
              </div>
            )}
            {upcomingItems.map(item => <LaneItem key={item.id} item={item} />)}
          </>
        )}
      </div>

      {reviewQueueUrl && lane.id === 'org_payables' && lane.items.length > 0 && (
        <a href={reviewQueueUrl} className={styles.reviewLink}>
          Review queue →
        </a>
      )}
    </div>
  );
}

export default function UpcomingPayablesPanel({ apiUrl, reviewQueueUrl }: Props) {
  const [days, setDays]   = useState<30 | 60 | 90>(30);
  const [lanes, setLanes] = useState<PayableLane[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [activeTab, setActiveTab] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiUrl}?days=${days}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load');
      const data = await res.json();
      setLanes(data.lanes ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load payables.');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, days]);

  useEffect(() => { load(); }, [load]);

  const totalOverdue = lanes.reduce((s, l) => s + l.items.filter(i => i.overdue).length, 0);
  const totalItems   = lanes.reduce((s, l) => s + l.items.length, 0);

  return (
    <div className={styles.root}>
      {/* Header row */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.panelTitle}>Upcoming Payables</span>
          {!loading && totalOverdue > 0 && (
            <span className={styles.overduePill}>{totalOverdue} overdue</span>
          )}
        </div>
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
        <div className={styles.loadingRow}>
          <div className={styles.skeleton} />
          <div className={styles.skeleton} style={{ width: '70%' }} />
          <div className={styles.skeleton} style={{ width: '55%' }} />
        </div>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : totalItems === 0 ? (
        <p className={styles.allClear}>
          Nothing due in the next {days} days.
        </p>
      ) : (
        <>
          {/* Desktop: columns */}
          <div className={styles.lanesDesktop}>
            {lanes.map(lane => (
              <Lane key={lane.id} lane={lane} reviewQueueUrl={reviewQueueUrl} />
            ))}
          </div>

          {/* Mobile: tabs */}
          <div className={styles.lanesMobile}>
            <div className={styles.tabBar}>
              {lanes.map((lane, i) => {
                const overdue = lane.items.filter(l => l.overdue).length;
                return (
                  <button
                    key={lane.id}
                    type="button"
                    className={`${styles.tab} ${activeTab === i ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab(i)}
                  >
                    {lane.title}
                    {overdue > 0 && (
                      <span className={styles.tabOverdueDot}>{overdue}</span>
                    )}
                  </button>
                );
              })}
            </div>
            {lanes[activeTab] && (
              <Lane lane={lanes[activeTab]} reviewQueueUrl={reviewQueueUrl} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
