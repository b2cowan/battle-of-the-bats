import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './CoachEmptyState.module.css';

/**
 * Shared empty-state for the coach portal (the org-less Basic floor + the
 * tournament-coach experience + the org-attached Premium coach surfaces).
 *
 * Borrowed from the public `PublicTournamentState` pattern (medallion + soft
 * glow) but org-LESS: the accent hue is always `--logic-lime`, never the
 * org-overrideable `--primary`. The medallion is a rounded square (`--radius`),
 * never a circle — circles are banned in the coach portal.
 *
 * Decision rule (COACH_SURFACE_DESIGN_ADDENDUM §iii):
 *   - Full card   → the section IS the content and the coach CAN act
 *                   (roster/schedule/fee empties, first-run banner, premium BvA/schedule).
 *   - Compact card → one of several recoverable empties
 *                   (editor section sub-empties, tournament pending/no-schedule).
 *   - Text-only <p> → the coach CANNOT act from this surface (organizer
 *                   announcements, etc.) — do NOT use this component; keep a <p>.
 *
 * Primary CTA is ALWAYS `btn btn-lime`; secondary → `btn btn-ghost`. Never
 * `btn-outline`, `btn-primary`, a `btn-sm` primary, or a bare hex anchor.
 */

type EmptyAction = {
  /** Internal route → <Link>. Provide href OR onClick, not both. */
  href?: string;
  /** Client handler → <button>. */
  onClick?: () => void;
  label: string;
  icon?: ReactNode;
  /** Defaults: primary action → 'lime', secondary → 'ghost'. */
  variant?: 'lime' | 'ghost';
  disabled?: boolean;
};

type CoachEmptyStateProps = {
  icon?: ReactNode;
  eyebrow?: string;
  headline: string;
  description?: ReactNode;
  /** The ONE most-important action — rendered btn-lime by default. */
  primaryAction?: EmptyAction;
  /** Optional quieter action — rendered btn-ghost by default. */
  secondaryAction?: EmptyAction;
  /** Compact variant: 40px medallion + tighter padding. */
  compact?: boolean;
  /**
   * Tournament-mode glow: the radial wash + medallion tints lean on the team
   * hue (`color-mix` off `--team-color`) instead of lime. The medallion ICON
   * stays `--logic-lime` always. Set `--team-color` inline on an ancestor.
   */
  tournamentGlow?: boolean;
  children?: ReactNode;
};

const DEFAULT_VARIANT: Record<'primary' | 'secondary', NonNullable<EmptyAction['variant']>> = {
  primary: 'lime',
  secondary: 'ghost',
};

function ActionButton({ action, role }: { action: EmptyAction; role: 'primary' | 'secondary' }) {
  const variant = action.variant ?? DEFAULT_VARIANT[role];
  const className = `btn btn-${variant}`;
  const content = (
    <>
      {action.icon}
      {action.label}
    </>
  );
  if (action.href) {
    return (
      <Link href={action.href} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className={className} onClick={action.onClick} disabled={action.disabled}>
      {content}
    </button>
  );
}

export default function CoachEmptyState({
  icon,
  eyebrow,
  headline,
  description,
  primaryAction,
  secondaryAction,
  compact = false,
  tournamentGlow = false,
  children,
}: CoachEmptyStateProps) {
  const stateClass = [
    styles.state,
    compact ? styles.compact : '',
    tournamentGlow ? styles.tournamentGlow : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={stateClass}>
      {icon ? <div className={styles.medallion}>{icon}</div> : null}
      {eyebrow ? <div className={styles.eyebrow}>{eyebrow}</div> : null}
      <h3 className={styles.headline}>{headline}</h3>
      {description ? <p className={styles.description}>{description}</p> : null}
      {primaryAction || secondaryAction || children ? (
        <div className={styles.actions}>
          {primaryAction ? <ActionButton action={primaryAction} role="primary" /> : null}
          {secondaryAction ? <ActionButton action={secondaryAction} role="secondary" /> : null}
          {children}
        </div>
      ) : null}
    </div>
  );
}
