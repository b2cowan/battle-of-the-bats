import Link from 'next/link';
import { registrationStatusBadge, registrationStatusLabel } from '@/lib/coaches-status';
import { deriveCoachLifecycleChip, lifecycleChipClassKey } from '@/lib/coach-tournament-lifecycle';
import FanViewLink from '@/components/shared/FanViewLink';
import portalStyles from '@/app/coaches/coaches-portal.module.css';
import styles from './CoachRegistrationCard.module.css';

/**
 * A3.3 — THE registration card. The same list previously rendered three different ways
 * (Overview history row / team-scoped Tournaments card with a tournament-hashed monogram /
 * account-hub card); this consolidates on the hub treatment — lifecycle chip (or the plain
 * status badge as fallback), dot-separated meta, lime-hover card, ⇄ Fan view line beneath —
 * with the monogram dropped (it hashed the TOURNAMENT name through a helper meant for
 * teams). Callers own list grouping/sorting; this card owns one row's anatomy.
 */
/** Date-only (YYYY-MM-DD) values render as the literal calendar day — never bare
 *  `new Date('YYYY-MM-DD')` (UTC-shift gotcha). One format for all three lists. */
function formatCardDate(value: string, options: Intl.DateTimeFormatOptions): string {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  return date.toLocaleDateString('en-CA', options);
}

function formatCardDateRange(start: string | null, end: string | null): string | null {
  if (!start) return null;
  if (end && end !== start) {
    return `${formatCardDate(start, { month: 'short', day: 'numeric' })} - ${formatCardDate(end, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
  return formatCardDate(start, { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function CoachRegistrationCard({
  href,
  title,
  registrationStatus,
  startDate,
  endDate,
  today,
  metaParts,
  fanView,
}: {
  href: string;
  /** The tournament's name (falls back to the registration name at the call sites). */
  title: string;
  registrationStatus: string;
  /** Tournament dates (YYYY-MM-DD) → the lifecycle chip + the meta date range; null-safe. */
  startDate: string | null;
  endDate: string | null;
  today: string;
  /** Meta line fragments in display order (team / org) — falsy entries dropped; the card
   *  appends the date range + (when a chip is showing) the demoted status label itself. */
  metaParts: Array<string | null | undefined>;
  /** Public-site context for the ⇄ Fan view line; null hides it (draft/archived events). */
  fanView: { orgSlug: string; tournamentSlug: string } | null;
}) {
  const chip = deriveCoachLifecycleChip(startDate, endDate, today);
  const chipKey = lifecycleChipClassKey(chip.state);
  const hasChip = chip.state !== 'unknown' && chipKey !== '';
  const isLive = chip.state === 'live';
  const withDot = chip.state === 'live' || chip.state === 'game_day';
  const statusLabel = registrationStatusLabel(registrationStatus);

  // When a lifecycle chip is present, the registration status demotes to trailing meta —
  // and is hidden entirely on LIVE rows (the chip wins). No chip → the badge carries it.
  const parts = metaParts.filter((p): p is string => Boolean(p));
  const dateRange = formatCardDateRange(startDate, endDate);
  if (dateRange) parts.push(dateRange);
  if (hasChip && !isLive) parts.push(statusLabel);

  return (
    <div className={styles.entry}>
      <Link href={href} className={styles.card}>
        <div className={styles.cardMain}>
          <div className={styles.cardTitle}>{title}</div>
          {parts.length > 0 && (
            <div className={styles.cardMeta}>
              {parts.map((p, i) => <span key={i}>{p}</span>)}
            </div>
          )}
        </div>
        <div className={styles.cardStatus}>
          {hasChip ? (
            <span className={`${portalStyles.coachLifecycleChip} ${portalStyles[`coachLifecycleChip${chipKey}`]}`}>
              {withDot && <span className={portalStyles.coachLifecycleChipDot} aria-hidden />}
              {chip.label}
            </span>
          ) : (
            <span className={`badge ${registrationStatusBadge(registrationStatus)}`}>{statusLabel}</span>
          )}
        </div>
      </Link>
      {fanView && <FanViewLink orgSlug={fanView.orgSlug} tournamentSlug={fanView.tournamentSlug} />}
    </div>
  );
}
