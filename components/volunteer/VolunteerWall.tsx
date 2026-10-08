import Link from 'next/link';
import { VOLUNTEER_WALL } from '@/lib/volunteer-words';
import shell from './DayOfShell.module.css';

/**
 * The wrong-job wall both volunteer shells show (Tournament admin redesign Stage 6, A26): a one-job
 * volunteer on the other job's address — a gate volunteer who scanned the scorekeeper's code. It says
 * why, and offers the job they DO hold through the header's own hop, so the two doors say one thing.
 * The caller wraps it in `GuestKitRoot` (the marker's one door).
 */
export default function VolunteerWall({ message, hop }: {
  message: string;
  /** The job they hold, when they hold one. */
  hop?: { href: string; label: string } | null;
}) {
  return (
    <div className={shell.wall}>
      <div className={shell.wallCard}>
        <p className={shell.wallLabel}>{VOLUNTEER_WALL.label}</p>
        <p className={shell.wallText}>{message}</p>
        {hop && <Link href={hop.href} className={shell.hop}>{hop.label}</Link>}
      </div>
    </div>
  );
}
