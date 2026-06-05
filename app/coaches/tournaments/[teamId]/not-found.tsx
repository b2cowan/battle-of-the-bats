import Link from 'next/link';
import { COACHES_TOURNAMENTS_PATH } from '@/lib/coaches-portal-routes';
import styles from './detail.module.css';

export default function CoachTournamentRecordNotFound() {
  return (
    <div className={styles.page}>
      <div className={`card ${styles.statusCard}`}>
        <h1 className={styles.title}>Tournament record not found</h1>
        <p className={styles.statusDesc}>
          This record is not linked to your signed-in coach account, or it no longer exists.
        </p>
        <Link href={COACHES_TOURNAMENTS_PATH} className="btn btn-primary btn-sm">
          Back to Coaches Portal
        </Link>
      </div>
    </div>
  );
}
