'use client';
/**
 * REGISTRATION HEALTH'S WINDOW (owner 2026-10-21) — what the Teams header button and the dashboard's health row both
 * open: the product's one form window, the same frame Schedule health's window wears (the wide 800 at a desk, the
 * whole screen with ← on a phone). Its first line is the score with its scale and the verdict, then one joined band of
 * four figures, then every issue with its one door. It has no rules to adjust and nothing to save, so it has no foot
 * and closing it asks nothing.
 *
 * It replaces the Teams page's "At a glance" row, which opened this same content in place under the 15U picker while
 * scoring every division. A figure or a "Show them" door hands the jump to the host, which closes the window first:
 * Teams filters its list in place, the dashboard goes to Teams with the filter in the link.
 */
import { AlertTriangle, CheckCircle2, Info, Lock, ShieldAlert } from 'lucide-react';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { GAME_DAY_WORDS } from '@/lib/game-day-words';
import type { RegistrationAttentionKey } from '@/lib/registration-attention';
import type { RegistrationHealthIssue, RegistrationHealthView } from '@/lib/registration-health';
import { REGISTRATION_HEALTH_WORDS as W } from '@/lib/registration-words';
import styles from './RegistrationHealthWindow.module.css';

type Tone = 'good' | 'warning' | 'danger';

export default function RegistrationHealthWindow({
  eyebrow, health, onJumpToBucket, onJumpToCapacity, onUpgrade, onClose,
}: {
  /** The tournament's name, over the title. */
  eyebrow?: string;
  health: RegistrationHealthView;
  /** A figure or an issue that opens the teams behind it. The host closes the window. */
  onJumpToBucket: (key: RegistrationAttentionKey) => void;
  /** A capacity gap: the division that is short. The host closes the window. */
  onJumpToCapacity: (divisionId: string) => void;
  /** The locked Payments figure: the plan's panel. The host closes the window. */
  onUpgrade: () => void;
  onClose: () => void;
}) {
  const { metrics, capacityTotal, capacityAccepted } = health;
  const tone: Tone = metrics.tone === 'good' || metrics.tone === 'warning' || metrics.tone === 'danger' ? metrics.tone : 'good';

  const hasCapacity = capacityTotal > 0;
  const capacityPct = hasCapacity ? Math.round((capacityAccepted / capacityTotal) * 100) : null;
  const teamsDetail = hasCapacity
    ? W.teamsFilled(capacityAccepted, capacityTotal, capacityPct ?? 0)
    : metrics.pending > 0 || metrics.waitlist > 0
      ? W.teamsPendingWaitlist(metrics.pending, metrics.waitlist)
      : W.teamsAccepted;
  const teamsTone: Tone | undefined = !hasCapacity ? undefined
    : capacityPct === 100 ? 'good'
      : metrics.capacityGaps.length > 0 ? 'warning'
        : undefined;

  const paymentsCount = metrics.unpaid + metrics.pastDue;
  const paymentsDetail = metrics.pastDue > 0 ? W.paymentsPastDue(metrics.pastDue)
    : paymentsCount > 0 ? W.paymentsUnpaid(paymentsCount) : W.paymentsAllIn;
  const paymentsTone: Tone = metrics.pastDue > 0 ? 'danger' : paymentsCount > 0 ? 'warning' : 'good';
  const needsActionCount = metrics.pending + metrics.unplaced + metrics.missingIntake;
  const showPayments = metrics.eventTracksPayments;

  const caption = [GAME_DAY_WORDS.healthCaption(tone, metrics.issues.length), W.scope].join(' · ');

  return (
    <KitDialog kind="form" size="wide" eyebrow={eyebrow} title={W.title} onClose={onClose}>
      <div className={styles.body}>
        <p className={styles.summary}>
          <span className={styles.score} data-tone={tone}>{metrics.score}<small>/100</small></span>
          <span>{caption}</span>
        </p>

        {/* One joined band, as Schedule health's (the connected-figures ruling): a figure with teams behind it is a door. */}
        <div className={styles.strip} data-cells={showPayments ? 4 : 3}>
          <Cell label={W.cellTeams} value={String(metrics.accepted)} detail={teamsDetail} tone={teamsTone} />
          <Cell
            label={W.cellMissingEmail}
            value={String(metrics.missingEmail)}
            detail={metrics.missingEmail > 0 ? W.missingEmailBad : W.missingEmailGood}
            tone={metrics.missingEmail > 0 ? 'danger' : 'good'}
            onClick={metrics.missingEmail > 0 ? () => onJumpToBucket('missing_email') : undefined}
          />
          {showPayments && (metrics.paymentsTracked ? (
            <Cell
              label={W.cellPayments}
              value={String(paymentsCount)}
              detail={paymentsDetail}
              tone={paymentsTone}
              onClick={paymentsCount > 0 ? () => onJumpToBucket(metrics.pastDue > 0 ? 'past_due' : 'unpaid') : undefined}
            />
          ) : (
            <Cell label={W.cellPayments} value="—" detail="Tournament Plus" locked onClick={onUpgrade} />
          ))}
          <Cell
            label={W.cellNeedsAction}
            value={String(needsActionCount)}
            detail={needsActionCount > 0 ? W.needsActionSome : W.needsActionNone}
            tone={needsActionCount > 0 ? 'warning' : 'good'}
            onClick={needsActionCount > 0
              ? () => onJumpToBucket(metrics.unplaced > 0 ? 'unplaced' : metrics.missingIntake > 0 ? 'missing_intake' : 'pending_review')
              : undefined}
          />
        </div>

        {metrics.issues.length > 0 ? (
          <div className={styles.issues}>
            {metrics.issues.map(issue => (
              <Issue
                key={issue.key}
                issue={issue}
                onOpen={() => {
                  if (issue.attentionKey) onJumpToBucket(issue.attentionKey);
                  else if (issue.capacityDivisionId) onJumpToCapacity(issue.capacityDivisionId);
                }}
              />
            ))}
          </div>
        ) : (
          <div className={`${styles.issue} ${styles.issueGood}`}>
            <CheckCircle2 size={14} aria-hidden />
            <span>{W.noIssues}</span>
          </div>
        )}
      </div>
    </KitDialog>
  );
}

function Cell({ label, value, detail, tone, locked, onClick }: {
  label: string; value: string; detail: string; tone?: Tone; locked?: boolean; onClick?: () => void;
}) {
  return (
    <button type="button" className={styles.cell} data-tone={tone} onClick={onClick} disabled={!onClick}>
      {/* The padlock alone: the cell's own line names the plan in full ("Tournament Plus") — the brand never shortens it. */}
      {locked && <span className={styles.lock}><Lock size={11} aria-label="Locked" /></span>}
      <span className={styles.cellLabel}>{label}</span>
      <strong className={styles.cellValue}>{value}</strong>
      <small className={styles.cellDetail}>{detail}</small>
    </button>
  );
}

function Issue({ issue, onOpen }: { issue: RegistrationHealthIssue; onOpen: () => void }) {
  const Icon = issue.tone === 'danger' ? ShieldAlert : issue.tone === 'warning' ? AlertTriangle : Info;
  const toneClass = issue.tone === 'danger' ? styles.issueError : issue.tone === 'warning' ? styles.issueWarning : styles.issueInfo;
  const door = issue.attentionKey ? W.showThem : issue.capacityDivisionId ? W.showIt : null;
  return (
    <div className={`${styles.issue} ${toneClass}`}>
      <Icon size={14} aria-hidden />
      <span className={styles.issueText}><strong>{issue.label}</strong> — {issue.detail}</span>
      {door && <button type="button" className={styles.door} onClick={onOpen}>{door}</button>}
    </div>
  );
}
