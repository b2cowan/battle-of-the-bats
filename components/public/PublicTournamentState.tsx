import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './PublicTournamentState.module.css';

type StateAction = {
  href: string;
  label: string;
  variant?: 'lime' | 'primary' | 'outline' | 'ghost';
};

type PublicTournamentStateProps = {
  icon?: ReactNode;
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  contactEmail?: string | null;
  actions?: StateAction[];
  compact?: boolean;
  children?: ReactNode;
};

const buttonClassByVariant: Record<NonNullable<StateAction['variant']>, string> = {
  lime: 'btn btn-lime btn-sm',
  primary: 'btn btn-primary btn-sm',
  outline: 'btn btn-outline btn-sm',
  ghost: 'btn btn-ghost btn-sm',
};

export default function PublicTournamentState({
  icon,
  eyebrow,
  title,
  description,
  contactEmail,
  actions = [],
  compact = false,
  children,
}: PublicTournamentStateProps) {
  return (
    <div className={`${styles.state}${compact ? ` ${styles.compact}` : ''}`}>
      {icon ? <div className={styles.icon}>{icon}</div> : null}
      {eyebrow ? <div className={styles.eyebrow}>{eyebrow}</div> : null}
      <h2 className={styles.title}>{title}</h2>
      {description ? <p className={styles.description}>{description}</p> : null}
      {contactEmail ? (
        <p className={styles.contact}>
          Questions? Contact <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
        </p>
      ) : null}
      {actions.length > 0 ? (
        <div className={styles.actions}>
          {actions.map(action => (
            <Link
              key={`${action.href}-${action.label}`}
              href={action.href}
              className={buttonClassByVariant[action.variant ?? 'ghost']}
            >
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}
      {children ? <div className={styles.actions}>{children}</div> : null}
    </div>
  );
}
