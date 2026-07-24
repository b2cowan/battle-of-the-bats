import Link from 'next/link';
import { resolveFlip, primaryTarget } from '@/lib/flip-twins';
import styles from './FanViewLink.module.css';

/**
 * FanViewLink — the quiet per-event flip door ("The Flip" P3): a coach's in-content
 * `⇄ Fan view` link beneath an event card/row, landing on that event's public side via the
 * shared resolver. ONE component + one stylesheet so the five coach surfaces that render it
 * (both overviews + all three tournaments lists) can't drift in wording, styling, or target —
 * the same discipline FlipPill enforces for the corner pill. Placement rule (rev-3 mockups):
 * the link sits on its own line directly beneath the event surface it belongs to.
 *
 * Server-safe (no client hooks) so both the server-rendered free portal and the client-side
 * premium pages render it directly.
 */
export default function FanViewLink({
  orgSlug,
  tournamentSlug,
  className,
}: {
  orgSlug: string;
  tournamentSlug: string;
  className?: string;
}) {
  const href = primaryTarget(
    resolveFlip({ direction: 'to-public', hat: 'coach', ctx: { orgSlug, tournamentSlug } }),
  ).href;
  return (
    <Link href={href} className={`${styles.fanView} ${className ?? ''}`}>
      <span aria-hidden>⇄</span> Fan view — public schedule &amp; live scores
    </Link>
  );
}
