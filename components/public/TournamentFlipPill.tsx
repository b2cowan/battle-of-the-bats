'use client';

/**
 * components/public/TournamentFlipPill.tsx — "The Flip", Phase 2 (public side).
 *
 * The header corner control for a signed-in hat-holder on a public tournament page: the ONE shared
 * FlipPill, client-resolved from the anonymous tournament-viewer flow (identity never rides the
 * SW-cached HTML). It replaces the retired account chip/sheet. Fans / signed-out / unresolved →
 * nothing renders, so the fan header keeps its corner. Fades in on resolve; the header actions
 * cluster is absolutely positioned, so a late-resolving pill never shifts the page (no CLS).
 */

import FlipPill from '@/components/shared/FlipPill';
import { usePublicFlip } from '@/lib/use-public-flip';
import type { FlipResolution } from '@/lib/flip-twins';
import styles from './TournamentFlipPill.module.css';
import flipStyles from '@/components/shared/FlipPill.module.css';

/** `look="band"` (Public tournament pages Stage 1): the door sits in the organizer's colour band and wears the club bar's
 *  own door, a bare icon in the band's text colour (FlipPill.module.css `.clubLook`), the Flip amendment's neutral tokens.
 *  Omitted: today's header pill. */
export default function TournamentFlipPill({ look }: { look?: 'band' } = {}) {
  const { resolution } = usePublicFlip();
  return <TournamentFlipDoor resolution={resolution} look={look} />;
}

/** The door itself, for a caller that has already resolved the viewer's hats (the band resolves them once and hands the same
 *  answer to the account sheet's Go to block, so the identity read is never paid for twice). */
export function TournamentFlipDoor({ resolution, look }: { resolution: FlipResolution | null; look?: 'band' }) {
  // Nothing until identity resolves; nothing for fans/signed-out (no hat here) — the corner is theirs.
  if (!resolution) return null;
  return <FlipPill resolution={resolution} variant="inline" compact className={`${styles.enter} ${look === 'band' ? flipStyles.clubLook : flipStyles.publicLook}`} />;
}
