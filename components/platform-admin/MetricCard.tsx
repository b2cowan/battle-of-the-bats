import type { ComponentType } from 'react';
import styles from './MetricCard.module.css';

/**
 * Shared platform-admin metric card. Extracted from app/platform-admin/page.tsx so
 * the Overview dashboard and the Observability dashboard render identical cards from
 * one component (no duplication). Visuals match the original overview.module.css card.
 */
export default function MetricCard({
  label,
  value,
  sub,
  Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  Icon: ComponentType<{ size?: number }>;
}) {
  return (
    <div className={styles.metricCard}>
      <div className={styles.iconWrap}><Icon size={18} /></div>
      <div>
        <div className={styles.metricValue}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
        <div className={styles.metricLabel}>{label}</div>
        {sub && <div className={styles.metricSub}>{sub}</div>}
      </div>
    </div>
  );
}
