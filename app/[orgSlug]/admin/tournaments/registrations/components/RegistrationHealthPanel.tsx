'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Info, Lock, ShieldAlert } from 'lucide-react';
import type { RegistrationAttentionKey } from '@/lib/registration-attention';
import type { RegistrationHealthIssue, RegistrationHealthMetrics } from '@/lib/registration-health';
import styles from '../teams-admin.module.css';

type KpiTone = 'good' | 'warning' | 'danger' | 'neutral';

interface RegistrationHealthPanelProps {
  metrics: RegistrationHealthMetrics;
  /** Sum of capacity across divisions that HAVE a capacity set; 0 = no division caps this tournament. */
  capacityTotal: number;
  /** Accepted teams within those same capacity-bearing divisions. */
  capacityAccepted: number;
  defaultOpen?: boolean;
  onJumpToBucket: (key: RegistrationAttentionKey) => void;
  onJumpToCapacity: (divisionId: string) => void;
  onUpgrade: () => void;
}

export default function RegistrationHealthPanel({
  metrics,
  capacityTotal,
  capacityAccepted,
  defaultOpen = true,
  onJumpToBucket,
  onJumpToCapacity,
  onUpgrade,
}: RegistrationHealthPanelProps) {
  const [expanded, setExpanded] = useState(defaultOpen);

  if (!metrics.hasTeams) return null;

  const scoreClass = metrics.tone === 'good' ? styles.regHealthScoreGood
    : metrics.tone === 'warning' ? styles.regHealthScoreWarning
      : metrics.tone === 'danger' ? styles.regHealthScoreDanger
        : styles.regHealthScoreNeutral;

  const hasCapacity = capacityTotal > 0;
  const capacityPct = hasCapacity ? Math.round((capacityAccepted / capacityTotal) * 100) : null;
  const teamsValue = String(metrics.accepted);
  const teamsDetail = hasCapacity
    ? `${capacityAccepted}/${capacityTotal} · ${capacityPct}% filled`
    : metrics.pending > 0 || metrics.waitlist > 0
      ? `${metrics.pending} pending · ${metrics.waitlist} waitlisted`
      : 'accepted';
  const teamsTone: KpiTone = !hasCapacity ? 'neutral'
    : capacityPct === 100 ? 'good'
      : metrics.capacityGaps.length > 0 ? 'warning'
        : 'neutral';

  const paymentsCount = metrics.unpaid + metrics.pastDue;
  const paymentsDetail = metrics.pastDue > 0
    ? `${metrics.pastDue} past due`
    : paymentsCount > 0 ? `${paymentsCount} unpaid` : 'all collected';
  const paymentsTone: KpiTone = metrics.pastDue > 0 ? 'danger' : paymentsCount > 0 ? 'warning' : 'good';

  const needsActionCount = metrics.pending + metrics.unplaced + metrics.missingIntake;

  return (
    <details
      className={styles.regHealthPanel}
      open={expanded}
      onToggle={event => setExpanded(event.currentTarget.open)}
    >
      <summary className={styles.regHealthSummary} aria-label={`${expanded ? 'Collapse' : 'Expand'} Registration Health`}>
        <div className={styles.regHealthHeader}>
          <div>
            <h4>Registration Health</h4>
            <p>{metrics.teamsTotal} team{metrics.teamsTotal === 1 ? '' : 's'} in the pipeline</p>
          </div>
        </div>
        <div className={`${styles.regHealthScore} ${scoreClass}`}>
          <span>{metrics.score}</span>
          <small>/100</small>
        </div>
        <span className={styles.regHealthToggle}>
          <span>{expanded ? 'Hide' : 'Show'}</span>
          <ChevronDown size={14} aria-hidden />
        </span>
      </summary>

      <div className={styles.regHealthBody}>
        <div className={styles.regHealthKpiGrid}>
          <Kpi label="Teams" value={teamsValue} detail={teamsDetail} tone={teamsTone} />
          <Kpi
            label="Missing email"
            value={String(metrics.missingEmail)}
            detail={metrics.missingEmail > 0 ? 'can’t be reached' : 'all reachable'}
            tone={metrics.missingEmail > 0 ? 'danger' : 'good'}
            onClick={metrics.missingEmail > 0 ? () => onJumpToBucket('missing_email') : undefined}
          />
          {metrics.paymentsTracked ? (
            <Kpi
              label="Payments"
              value={String(paymentsCount)}
              detail={paymentsDetail}
              tone={paymentsTone}
              onClick={paymentsCount > 0 ? () => onJumpToBucket(metrics.pastDue > 0 ? 'past_due' : 'unpaid') : undefined}
            />
          ) : (
            <Kpi label="Payments" value="—" detail="Tournament Plus" tone="neutral" locked onClick={onUpgrade} />
          )}
          <Kpi
            label="Needs action"
            value={String(needsActionCount)}
            detail={needsActionCount > 0 ? 'review or placement' : 'nothing pending'}
            tone={needsActionCount > 0 ? 'warning' : 'good'}
            onClick={needsActionCount > 0
              ? () => onJumpToBucket(metrics.unplaced > 0 ? 'unplaced' : metrics.missingIntake > 0 ? 'missing_intake' : 'pending_review')
              : undefined}
          />
        </div>

        {metrics.issues.length > 0 ? (
          <div className={styles.regHealthIssues}>
            {metrics.issues.map(issue => (
              <IssueRow
                key={issue.key}
                issue={issue}
                onClick={() => {
                  if (issue.attentionKey) onJumpToBucket(issue.attentionKey);
                  else if (issue.capacityDivisionId) onJumpToCapacity(issue.capacityDivisionId);
                }}
              />
            ))}
          </div>
        ) : (
          <div className={styles.regHealthGood}>
            <CheckCircle2 size={14} />
            <span>No registration health issues found.</span>
          </div>
        )}
      </div>
    </details>
  );
}

function Kpi({
  label, value, detail, tone, locked, onClick,
}: {
  label: string;
  value: string;
  detail: string;
  tone: KpiTone;
  locked?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.regHealthKpi}
      data-tone={tone === 'neutral' ? undefined : tone}
      onClick={onClick}
      disabled={!onClick}
      style={!onClick ? { cursor: 'default' } : undefined}
    >
      {locked && (
        <span className={styles.regHealthKpiLock}>
          <Lock size={9} style={{ verticalAlign: '-1px', marginRight: '2px' }} aria-hidden />
          Plus
        </span>
      )}
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </button>
  );
}

function IssueRow({ issue, onClick }: { issue: RegistrationHealthIssue; onClick: () => void }) {
  const Icon = issue.tone === 'danger' ? ShieldAlert : issue.tone === 'warning' ? AlertTriangle : Info;
  const clickable = Boolean(issue.attentionKey || issue.capacityDivisionId);
  return (
    <button
      type="button"
      className={styles.regHealthIssue}
      data-tone={issue.tone}
      onClick={onClick}
      disabled={!clickable}
    >
      <Icon size={14} aria-hidden />
      <span><strong>{issue.label}</strong> — {issue.detail}</span>
    </button>
  );
}
