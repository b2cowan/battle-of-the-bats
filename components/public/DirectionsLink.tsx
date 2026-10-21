import { Navigation } from 'lucide-react';
import kit from './ClubKit.module.css';
import styles from './DirectionsLink.module.css';

/**
 * Directions to a place, from a club's public page (Club Tier Stage 4b-2b: a tryout day). Labelled at a desk; on a phone
 * its symbol alone — no border, no fill, a 44 px tap target, named aloud (the owner's 2026-10-20 ruling, pinned by
 * phone-secondary-actions-guard). `name` says where ("Directions to Lakeshore Dome"), so a list of days does not read
 * "Directions" over and over; it keeps the visible word inside it, so a voice-control user can still say "Directions".
 */
export default function DirectionsLink({ href, name }: { href: string; name: string }) {
  return (
    <a className={`${kit.btn} ${kit.btnSecondary} ${kit.btnSm} ${styles.directions}`} href={href}
      target="_blank" rel="noopener noreferrer" aria-label={name}>
      <Navigation size={18} aria-hidden />
      <span className={styles.directionsLabel}>Directions</span>
    </a>
  );
}
