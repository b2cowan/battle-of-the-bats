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
import styles from './TournamentFlipPill.module.css';

export default function TournamentFlipPill() {
  const resolution = usePublicFlip();
  // Nothing until identity resolves; nothing for fans/signed-out (no hat here) — the corner is theirs.
  if (!resolution) return null;
  return <FlipPill resolution={resolution} variant="inline" className={styles.enter} />;
}
