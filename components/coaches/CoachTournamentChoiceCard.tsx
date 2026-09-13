'use client';
import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { Trophy } from 'lucide-react';
import styles from './CoachTournamentChoiceCard.module.css';

/**
 * The merged "nothing recorded yet, in either direction" state for the Tournaments page (owner
 * ruling 2026-09-13, replacing two stacked CoachEmptyState illustrations that pushed the second
 * door below the fold on anything but a tall screen). Renders ONLY when both halves of the
 * season are simultaneously empty — a team with real entries, or a real hosted tournament,
 * never reaches this; those render actual content instead of a second onboarding block.
 */

type TileAction = { label: string; href?: string; onClick?: () => void };

type JoinTile = {
  kicker: string;
  title: string;
  body: ReactNode;
  primaryAction: TileAction;
  secondaryAction?: TileAction;
  blocker?: ReactNode;
};

type HostTile = {
  title: string;
  body: ReactNode;
  action: TileAction;
  onView: () => void;
};

function TileButton({ action, variant }: { action: TileAction; variant: 'lime' | 'ghost' }) {
  const className = `btn btn-${variant}`;
  if (action.href) {
    return <Link href={action.href} onClick={action.onClick} className={className}>{action.label}</Link>;
  }
  return <button type="button" className={className} onClick={action.onClick}>{action.label}</button>;
}

export default function CoachTournamentChoiceCard({
  headline,
  intro,
  join,
  host,
  payoff,
}: {
  headline: string;
  intro: ReactNode;
  join: JoinTile;
  host: HostTile;
  payoff: ReactNode;
}) {
  // The host tile is always visible whenever this card mounts, so mounting IS the acquisition
  // CTA's "viewed" moment — same event SetupCard fired once per mount before this replaced it.
  useEffect(() => { host.onView(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={styles.card}>
      <div className={styles.medallion}><Trophy size={22} aria-hidden /></div>
      <h3 className={styles.headline}>{headline}</h3>
      <p className={styles.intro}>{intro}</p>

      <div className={styles.tiles}>
        <div className={styles.tile}>
          <div className={styles.tileKicker}>{join.kicker}</div>
          <div className={styles.tileTitle}>{join.title}</div>
          <p className={styles.tileBody}>{join.body}</p>
          <div className={styles.tileActions}>
            <TileButton action={join.primaryAction} variant="lime" />
            {join.secondaryAction ? <TileButton action={join.secondaryAction} variant="ghost" /> : null}
          </div>
          {join.blocker ? <p className={styles.tileBlocker}>{join.blocker}</p> : null}
        </div>

        <div className={styles.tile}>
          <div className={styles.tileKicker}>Host your own</div>
          <div className={styles.tileTitle}>{host.title}</div>
          <p className={styles.tileBody}>{host.body}</p>
          <div className={styles.tileActions}>
            <TileButton action={host.action} variant="lime" />
          </div>
        </div>
      </div>

      <p className={styles.payoff}>{payoff}</p>
    </div>
  );
}
