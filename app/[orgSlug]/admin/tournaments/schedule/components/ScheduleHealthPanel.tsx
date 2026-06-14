'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Info, ShieldAlert, SlidersHorizontal } from 'lucide-react';
import type { ScheduleIssue, ScheduleMetrics } from '@/lib/schedule-metrics';
import { formatRestMinutes } from '@/lib/schedule-metrics';
import styles from '../schedule-admin.module.css';

type MetricTone = 'good' | 'warning' | 'danger' | 'neutral';

/** Organizer-defined "healthy schedule" thresholds edited inline from the panel. */
export interface ScheduleHealthRulesDraft {
  maxGamesPerDay: number;
  minRestMinutes: number;
  targetGamesPerTeam: number | null;
}

function clampInt(raw: string, min: number, max: number, fallback: number): number {
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

interface ScheduleHealthPanelProps {
  metrics: ScheduleMetrics;
  title?: string;
  subtitle?: string;
  showTeamTable?: boolean;
  defaultOpen?: boolean;
  sticky?: boolean;
  /** When provided and conflicts exist, the summary shows a tappable jump chip. */
  onJumpToConflict?: () => void;
  // ── Organizer-defined rules editor (all optional; omit to hide the editor) ──
  /** Current (draft) rule values — drives the live preview while editing. */
  rules?: ScheduleHealthRulesDraft;
  /** Whether the current user may edit rules (e.g. not on a locked tournament). */
  canEditRules?: boolean;
  /** True when the draft differs from the saved rules (enables Save/Discard). */
  rulesDirty?: boolean;
  savingRules?: boolean;
  onRuleChange?: (patch: Partial<ScheduleHealthRulesDraft>) => void;
  onSaveRules?: () => void;
  /** Discard unsaved edits, back to the last saved rules. */
  onResetRules?: () => void;
  /** Set the rules back to the engine defaults (2 / 15 / no target). */
  onRestoreDefaultRules?: () => void;
}

export default function ScheduleHealthPanel({
  metrics,
  title = 'Schedule Health',
  subtitle,
  showTeamTable = false,
  defaultOpen = true,
  sticky = false,
  onJumpToConflict,
  rules,
  canEditRules = false,
  rulesDirty = false,
  savingRules = false,
  onRuleChange,
  onSaveRules,
  onResetRules,
  onRestoreDefaultRules,
}: ScheduleHealthPanelProps) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const [editing, setEditing] = useState(false);
  const showRulesEditor = canEditRules && !!rules && !!onRuleChange;
  const conflictTotal = metrics.venueConflictCount + metrics.bufferConflictCount;
  const scoreClass = metrics.healthTone === 'good'
    ? styles.healthScoreGood
    : metrics.healthTone === 'warning'
      ? styles.healthScoreWarning
      : styles.healthScoreDanger;

  return (
    <details
      className={`${styles.healthPanel} ${sticky ? styles.healthPanelSticky : ''}`}
      open={expanded}
      onToggle={event => setExpanded(event.currentTarget.open)}
    >
      <summary className={styles.healthSummary} aria-label={`${expanded ? 'Collapse' : 'Expand'} ${title}`}>
        <div className={styles.healthHeader}>
          <div>
            <h4>{title}</h4>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {onJumpToConflict && conflictTotal > 0 && (
            <button
              type="button"
              className={styles.healthJumpChip}
              data-tone={metrics.venueConflictCount > 0 ? 'danger' : 'warning'}
              onClick={event => { event.preventDefault(); event.stopPropagation(); onJumpToConflict(); }}
              title="Jump to the first conflicting game"
            >
              <AlertTriangle size={12} aria-hidden />
              {conflictTotal}
            </button>
          )}
          {showRulesEditor && (
            <button
              type="button"
              className={styles.healthGear}
              aria-label="Adjust health rules"
              aria-pressed={editing}
              title="Adjust health rules"
              onClick={event => { event.preventDefault(); event.stopPropagation(); setExpanded(true); setEditing(value => !value); }}
            >
              <SlidersHorizontal size={14} aria-hidden />
            </button>
          )}
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
        {showRulesEditor && editing && rules && (
          <div className={styles.healthRules}>
            <div className={styles.healthRulesGrid}>
              <label className={styles.healthRule}>
                <span>Max games / day</span>
                <input
                  type="number" min={1} max={10} value={rules.maxGamesPerDay}
                  onChange={event => onRuleChange?.({ maxGamesPerDay: clampInt(event.target.value, 1, 10, rules.maxGamesPerDay) })}
                />
              </label>
              <label className={styles.healthRule}>
                <span>Min rest between games (min)</span>
                <input
                  type="number" min={0} max={600} step={5} value={rules.minRestMinutes}
                  onChange={event => onRuleChange?.({ minRestMinutes: clampInt(event.target.value, 0, 600, rules.minRestMinutes) })}
                />
              </label>
              <label className={styles.healthRule}>
                <span>Target games / team</span>
                <input
                  type="number" min={1} max={99} placeholder="No target"
                  value={rules.targetGamesPerTeam ?? ''}
                  onChange={event => onRuleChange?.({ targetGamesPerTeam: event.target.value === '' ? null : clampInt(event.target.value, 1, 99, rules.targetGamesPerTeam ?? 1) })}
                />
              </label>
            </div>
            <div className={styles.healthRulesFooter}>
              <button type="button" className={styles.healthRulesReset} onClick={onRestoreDefaultRules}>Restore defaults</button>
              <div className={styles.healthRulesActions}>
                {rulesDirty && (
                  <button type="button" className={styles.healthRulesDiscard} onClick={onResetRules}>Discard</button>
                )}
                <button
                  type="button"
                  className={styles.healthRulesSave}
                  disabled={!rulesDirty || savingRules}
                  onClick={onSaveRules}
                >
                  {savingRules ? 'Saving…' : 'Save rules'}
                </button>
              </div>
            </div>
            <p className={styles.healthRulesHint}>The score and warnings below update live as you adjust. Saved per tournament.</p>
          </div>
        )}
        <ScheduleHealthContent metrics={metrics} showTeamTable={showTeamTable} />
      </div>
    </details>
  );
}

/**
 * The KPI grid + top issues (+ optional team table) — shared by the inline panel
 * and the toolbar health chip's popover/bottom-sheet (C4). Carries no chrome of
 * its own so each host wraps it (panel `.healthBody`, sheet body, popover body).
 */
export function ScheduleHealthContent({
  metrics,
  showTeamTable = false,
}: {
  metrics: ScheduleMetrics;
  showTeamTable?: boolean;
}) {
  const topIssues = metrics.issues.slice(0, 2);
  const remainingIssueCount = Math.max(0, metrics.issues.length - topIssues.length);
  const warningCount = metrics.venueConflictCount + metrics.bufferConflictCount + metrics.travelBufferWarningCount;

  return (
    <>
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
          tone={metrics.maxGamesInDay > metrics.maxGamesPerDay ? 'warning' : 'good'}
        />
        <Metric
          label="Warnings"
          value={String(warningCount)}
          detail={metrics.travelBufferWarningCount > 0 ? `${metrics.travelBufferWarningCount} travel buffer` : `${metrics.bufferConflictCount} venue buffer`}
          tone={metrics.venueConflictCount > 0 ? 'danger' : warningCount > 0 ? 'warning' : 'good'}
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
                  <th>Tight moves</th>
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
                    <td>{team.travelBufferWarnings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </>
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
