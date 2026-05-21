'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { useEffect } from 'react';
import { buildTournamentAcquisitionHref, trackTournamentAcquisition } from './tournament-acquisition';
import styles from './tournament-growth.module.css';

type RegistrationConfirmationCtaProps = {
  orgSlug: string;
  tournamentSlug: string;
  tournamentName: string;
};

export default function RegistrationConfirmationCta({
  orgSlug,
  tournamentSlug,
  tournamentName,
}: RegistrationConfirmationCtaProps) {
  const href = buildTournamentAcquisitionHref({
    source: 'registration_confirmation',
    orgSlug,
    tournamentSlug,
    surface: 'public_home',
  });

  useEffect(() => {
    trackTournamentAcquisition({
      eventType: 'tournament_plus_acquisition_cta_viewed',
      acquisitionSource: 'registration_confirmation',
      surface: 'public_home',
      orgSlug,
      tournamentSlug,
      currentPath: window.location.pathname,
      ctaHref: href,
    });
  }, [href, orgSlug, tournamentSlug]);

  return (
    <div className={styles.confirmationCta}>
      <div className={styles.confirmationIcon}>
        <Sparkles size={18} />
      </div>
      <div className={styles.confirmationBody}>
        <strong>Run a tournament like {tournamentName}</strong>
        <span>FieldLogicHQ helps organizers manage registration, schedules, scores, and public updates.</span>
      </div>
      <Link
        href={href}
        className={styles.confirmationLink}
        onClick={() => trackTournamentAcquisition({
          eventType: 'tournament_plus_acquisition_cta_clicked',
          acquisitionSource: 'registration_confirmation',
          surface: 'public_home',
          orgSlug,
          tournamentSlug,
          currentPath: window.location.pathname,
          ctaHref: href,
        })}
      >
        View plans
      </Link>
    </div>
  );
}
