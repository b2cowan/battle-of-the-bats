import Link from 'next/link';
import { COACHES_HOME_PATH } from '@/lib/coaches-portal-routes';
import styles from '../../coaches-portal.module.css';

export default function CoachTeamNotFound() {
  return (
    <div className={styles.page}>
      <div className={styles.empty}>
        <p>This team isn&apos;t linked to your signed-in coach account, or it no longer exists.</p>
        <Link href={COACHES_HOME_PATH} className="btn btn-outline btn-sm">
          Back to Coaches Portal
        </Link>
      </div>
    </div>
  );
}
