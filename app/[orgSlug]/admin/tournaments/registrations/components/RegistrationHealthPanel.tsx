'use client';

/**
 * REGISTRATION HEALTH — the first row of Teams' "At a glance" card (Tournament admin redesign Stage 2,
 * T1; the /design review's D3 and D11). Closed, it is one line of fact: the score WITH ITS SCALE as the
 * row's lead mark ("78/100" — alone, "78" can read as 78 teams), and a caption that says only what no
 * neighbour says: the teams waiting for a decision are the review band's and the division menu's, the
 * money is the Payments row's. It is the only row that covers every division, and says so. Opened (in
 * place), it is today's panel: the four tiles and the issues, each opening the teams behind it.
 */
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Lock, ShieldAlert } from 'lucide-react';
import type { RegistrationAttentionKey } from '@/lib/registration-attention';
import type { RegistrationHealthIssue, RegistrationHealthMetrics } from '@/lib/registration-health';
import { useIsSandbox } from '@/components/sandbox/SandboxProvider';
import { TEAMS_WORDS } from '@/lib/registration-words';
import GlanceRow from './GlanceRow';
import styles from '../teams-admin.module.css';

type KpiTone = 'good' | 'warning' | 'danger' | 'neutral';

interface RegistrationHealthPanelProps {
  metrics: RegistrationHealthMetrics;
  /** Sum of capacity across divisions that HAVE a capacity set; 0 = no division caps this tournament. */
  capacityTotal: number;
  /** Accepted teams within those same capacity-bearing divisions. */
  capacityAccepted: number;
  onJumpToBucket: (key: RegistrationAttentionKey) => void;
  onJumpToCapacity: (divisionId: string) => void;
  onUpgrade: () => void;
}

/** The caption's facts, in the order they cost an organizer: at most two, each said once. */
function healthCaption(m: RegistrationHealthMetrics): string {
  const facts: string[] = [];
  if (m.missingEmail > 0) facts.push(TEAMS_WORDS.missingEmail(m.missingEmail));
  if (m.missingIntake > 0) facts.push(TEAMS_WORDS.missingInfo(m.missingIntake));
  if (m.unplaced > 0) facts.push(TEAMS_WORDS.withoutSpot(m.unplaced));
  if (m.capacityGaps.length > 0) facts.push(TEAMS_WORDS.shortOfTeams(m.capacityGaps.length));
  return [TEAMS_WORDS.healthScope, ...(facts.length > 0 ? facts.slice(0, 2) : [TEAMS_WORDS.healthNothing])].join(' · ');
}

export default function RegistrationHealthPanel({
  metrics,
  capacityTotal,
  capacityAccepted,
  onJumpToBucket,
  onJumpToCapacity,
  onUpgrade,
}: RegistrationHealthPanelProps) {
  // "See it live" sandbox — false for every real org. In the demo this row IS the tour's destination
  // (step 5, "Go back three weeks"), so it opens there, as it always has; whether the tour should still
  // open it is /demos' call (F46), not this build's. A real customer's row opens closed.
  const isSandbox = useIsSandbox();
  const [open, setOpen] = useState(isSandbox);

  if (!metrics.hasTeams) return null;

  const hasCapacity = capacityTotal > 0;
  const capacityPct = hasCapacity ? Math.round((capacityAccepted / capacityTotal) * 100) : null;
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
    // The demo tour's anchor rides the WHOLE row — the closed line and, opened, its tiles — so the
    // tour's ring and the marketing picture (lib/marketing-shots.ts) still frame the panel.
    <div className={styles.glanceItem} data-sandbox-tour="registration-health">
      <GlanceRow
        lead={<>{metrics.score}<small>/100</small></>}
        title={TEAMS_WORDS.health}
        caption={healthCaption(metrics)}
        open={open}
        onToggle={() => setOpen(o => !o)}
      >
        <div className={styles.regHealthKpiGrid}>
          <Kpi label="Teams" value={String(metrics.accepted)} detail={teamsDetail} tone={teamsTone} />
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
            <CheckCircle2 size={14} aria-hidden />
            <span>No registration health issues found.</span>
          </div>
        )}
      </GlanceRow>
    </div>
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
      className={styles.glanceTile}
      data-tone={tone === 'neutral' ? undefined : tone}
      onClick={onClick}
      disabled={!onClick}
    >
      {/* The padlock alone: the tile's own line names the plan in full ("Tournament Plus") — the brand
          never shortens a plan to "Plus". */}
      {locked && <span className={styles.regHealthKpiLock}><Lock size={11} aria-label="Locked" /></span>}
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
