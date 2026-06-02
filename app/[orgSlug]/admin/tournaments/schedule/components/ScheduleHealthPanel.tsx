'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Info, ShieldAlert } from 'lucide-react';
import type { ScheduleIssue, ScheduleMetrics } from '@/lib/schedule-metrics';
import { formatRestMinutes } from '@/lib/schedule-metrics';
import styles from '../schedule-admin.module.css';

type MetricTone = 'good' | 'warning' | 'danger' | 'neutral';

interface ScheduleHealthPanelProps {
  metrics: ScheduleMetrics;
  title?: string;
  subtitle?: string;
  showTeamTable?: boolean;
  defaultOpen?: boolean;
}

export default function ScheduleHealthPanel({
  metrics,
  title = 'Schedule Health',
  subtitle,
  showTeamTable = false,
  defaultOpen = true,
}: ScheduleHealthPanelProps) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const topIssues = metrics.issues.slice(0, 2);
  const remainingIssueCount = Math.max(0, metrics.issues.length - topIssues.length);
  const scoreClass = metrics.healthTone === 'good'
    ? styles.healthScoreGood
    : metrics.healthTone === 'warning'
      ? styles.healthScoreWarning
      : styles.healthScoreDanger;

  return (
    <details
      className={styles.healthPanel}
      open={expanded}
      onToggle={event => setExpanded(event.currentTarget.open)}
    >
      <summary className={styles.healthSummary} aria-label={`${expanded ? 'Collapse' : 'Expand'} ${title}`}>
        <div className={styles.healthHeader}>
          <div>
            <h4>{title}</h4>
            {subtitle && <p>{subtitle}</p>}
          </div>
        </div>
        <div className={`${styles.healthScore} ${scoreClass}`}>
          <span>{metrics.healthScore}</span>
          <small>/100</small>
        </div>
        <span className={styles.healthToggle}>
          <span>{expanded ? 'Hide' : 'Show'}</span>
          <ChevronDown size={14} aria-hidden />
        </span>
      </summary>

      <div className={styles.healthBody}>
        <div className={styles.healthKpiGrid}>
          <Metric
            label="Teams"
            value={String(metrics.participantCount)}
            detail={formatGameRange(metrics)}
            tone={metrics.expectedGamesPerParticipant && (metrics.teamsUnderTarget > 0 || metrics.teamsOverTarget > 0) ? 'warning' : 'neutral'}
          />
          <Metric
            label="Back-to-back"
            value={String(metrics.backToBackCount)}
            detail={`Rest ${formatRestMinutes(metrics.minRestMinutes)}`}
            tone={metrics.backToBackCount > 0 ? 'warning' : 'good'}
          />
          <Metric
            label="Max/day"
            value={String(metrics.maxGamesInDay)}
            detail={`${metrics.venueChangeCount} venue moves`}
            tone={metrics.maxGamesInDay > 2 ? 'warning' : 'good'}
          />
          <Metric
            label="Conflicts"
            value={String(metrics.venueConflictCount + metrics.bufferConflictCount)}
            detail={`${metrics.bufferConflictCount} buffer`}
            tone={metrics.venueConflictCount > 0 ? 'danger' : metrics.bufferConflictCount > 0 ? 'warning' : 'good'}
          />
        </div>

        {topIssues.length > 0 ? (
          <div className={styles.healthIssues}>
            {topIssues.map(issue => (
              <IssueRow key={`${issue.code}-${issue.severity}`} issue={issue} />
            ))}
            {remainingIssueCount > 0 && (
              <div className={`${styles.healthIssue} ${styles.healthIssueInfo}`}>
                <Info size={14} />
                <span>{remainingIssueCount} more schedule health item{remainingIssueCount === 1 ? '' : 's'} detected.</span>
              </div>
            )}
          </div>
        ) : (
          <div className={`${styles.healthIssue} ${styles.healthIssueGood}`}>
            <CheckCircle2 size={14} />
            <span>No major schedule health issues found.</span>
          </div>
        )}

        {showTeamTable && metrics.teamMetrics.length > 0 && (
          <details className={styles.healthDetails}>
            <summary className={styles.healthDetailsSummary}>Team detail</summary>
            <div className={styles.healthTeamTableWrap}>
              <table className={styles.healthTeamTable}>
                <thead>
                  <tr>
                    <th>Team</th>
                    <th>Games</th>
                    <th>Max/day</th>
                    <th>Back-to-back</th>
                    <th>Rest</th>
                    <th>Venue changes</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.teamMetrics.map(team => (
                    <tr key={team.participantKey}>
                      <td>{team.label}</td>
                      <td>{team.gameCount}</td>
                      <td>{team.maxGamesInDay}</td>
                      <td>{team.backToBackCount}</td>
                      <td>{formatRestMinutes(team.minRestMinutes)}</td>
                      <td>{team.venueChanges}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>
    </details>
  );
}

function Metric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: MetricTone }) {
  return (
    <div className={styles.healthKpi} data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function IssueRow({ issue }: { issue: ScheduleIssue }) {
  const className = issue.severity === 'error'
    ? styles.healthIssueError
    : issue.severity === 'warning'
      ? styles.healthIssueWarning
      : styles.healthIssueInfo;
  const Icon = issue.severity === 'error'
    ? ShieldAlert
    : issue.severity === 'warning'
      ? AlertTriangle
      : Info;

  return (
    <div className={`${styles.healthIssue} ${className}`}>
      <Icon size={14} />
      <span><strong>{issue.title}</strong> {issue.detail}</span>
    </div>
  );
}

function formatGameRange(metrics: ScheduleMetrics): string {
  if (metrics.participantCount === 0) return 'No teams';
  if (metrics.expectedGamesPerParticipant) {
    return `${metrics.teamsAtTarget}/${metrics.participantCount} at target`;
  }
  if (metrics.minGamesPerParticipant === metrics.maxGamesPerParticipant) {
    return `${metrics.minGamesPerParticipant} each`;
  }
  return `${metrics.minGamesPerParticipant}-${metrics.maxGamesPerParticipant} games`;
}
