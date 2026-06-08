'use client';

/**
 * BracketHealthPanel — playoff-bracket schedule health, the bracket analogue of
 * ScheduleHealthPanel. A bracket's participants are seeds that flow through the
 * tree, so "per-team" rest is undefined until results come in. Instead we report
 * structure-based metrics from the advancement edges (see lib/bracket-schedule-metrics):
 * tightest turnaround, feasibility issues, worst-case games/day, and the longest
 * possible run to the title.
 */
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Info, ShieldAlert } from 'lucide-react';
import type { BracketScheduleMetrics } from '@/lib/bracket-schedule-metrics';
import type { ScheduleIssue } from '@/lib/schedule-metrics';
import { formatRestMinutes } from '@/lib/schedule-metrics';
import styles from '../schedule-admin.module.css';

type MetricTone = 'good' | 'warning' | 'danger' | 'neutral';

export default function BracketHealthPanel({
  metrics,
  title = 'Playoff Draft Health',
  subtitle,
  defaultOpen = true,
}: {
  metrics: BracketScheduleMetrics;
  title?: string;
  subtitle?: string;
  defaultOpen?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const scoreClass = metrics.healthTone === 'good'
    ? styles.healthScoreGood
    : metrics.healthTone === 'warning'
      ? styles.healthScoreWarning
      : styles.healthScoreDanger;

  const hasSchedule = metrics.scheduledEdgeCount > 0;
  const turnaroundTone: MetricTone = metrics.infeasibleCount > 0
    ? 'danger'
    : metrics.tooTightCount > 0
      ? 'warning'
      : hasSchedule ? 'good' : 'neutral';
  const problemEdges = metrics.tooTightCount;

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
            label="Tightest turnaround"
            value={hasSchedule && metrics.tightestTurnaroundMinutes != null ? formatRestMinutes(metrics.tightestTurnaroundMinutes) : '—'}
            detail={hasSchedule
              ? `across ${metrics.scheduledEdgeCount} advancement${metrics.scheduledEdgeCount === 1 ? '' : 's'}`
              : 'schedule games to measure'}
            tone={turnaroundTone}
          />
          <Metric
            label="Turnaround issues"
            value={String(problemEdges)}
            detail={metrics.infeasibleCount > 0
              ? `${metrics.infeasibleCount} impossible`
              : problemEdges > 0 ? `under ${metrics.minRestMinutes}m rest` : 'all clear'}
            tone={metrics.infeasibleCount > 0 ? 'danger' : problemEdges > 0 ? 'warning' : 'good'}
          />
          <Metric
            label="Games/day, worst case"
            value={metrics.worstCaseGamesPerDay > 0 ? String(metrics.worstCaseGamesPerDay) : '—'}
            detail="if a team keeps winning"
            tone={metrics.worstCaseGamesPerDay >= 4 ? 'warning' : 'neutral'}
          />
          <Metric
            label="Longest run"
            value={`${metrics.longestPathGames} game${metrics.longestPathGames === 1 ? '' : 's'}`}
            detail={metrics.longestPathDays
              ? `over ${metrics.longestPathDays} day${metrics.longestPathDays === 1 ? '' : 's'}`
              : 'most a team could play'}
            tone="neutral"
          />
        </div>

        {metrics.issues.length > 0 ? (
          <div className={styles.healthIssues}>
            {metrics.issues.map(issue => (
              <IssueRow key={`${issue.code}-${issue.severity}`} issue={issue} />
            ))}
          </div>
        ) : (
          <div className={`${styles.healthIssue} ${styles.healthIssueGood}`}>
            <CheckCircle2 size={14} />
            <span>No bracket scheduling issues found.</span>
          </div>
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
