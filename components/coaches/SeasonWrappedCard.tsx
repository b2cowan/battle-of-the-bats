'use client';
import { useState } from 'react';
import { Trophy } from 'lucide-react';
import type { SeasonWrappedPayload } from '@/lib/rep-season-wrapped';
import { generateWrappedCardBlob, shadeHex } from '@/lib/wrapped-share-card';
import { shareScoreImage } from '@/lib/share-card';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * The Season Wrapped highlight card (Batch 3, wow #7 — approved mockups = spec).
 * A FIXED-COLOR artifact: team-color gradient + white ink in both themes, exactly like the
 * share image it generates. Tiles render only the stats the season earned (the sparse-data
 * honesty rule) — never an empty slot, never an apology.
 */
export default function SeasonWrappedCard({ wrapped }: { wrapped: SeasonWrappedPayload }) {
  const [shareState, setShareState] = useState<'idle' | 'working' | 'done' | 'failed'>('idle');

  const rec = wrapped.record;
  const hasRecord = rec.games > 0;
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });

  async function handleShare() {
    setShareState('working');
    try {
      // The generator narrows to the share-safe allow-list itself — the exported PNG leaves
      // the app, and a coach's bench moment is free text about a child.
      const blob = await generateWrappedCardBlob(wrapped);
      await shareScoreImage(
        blob,
        `${wrapped.teamName.replace(/\s+/g, '-').toLowerCase()}-season-wrapped.png`,
        `${wrapped.teamName} — ${wrapped.seasonName} wrapped`,
      );
      setShareState('done');
    } catch {
      setShareState('failed');
    }
  }

  const cg = wrapped.closestGame;

  return (
    <div
      className={styles.wrappedCard}
      style={{ background: `linear-gradient(165deg, ${shadeHex(wrapped.teamColor, 0.62)}, ${shadeHex(wrapped.teamColor, 0.34)})` }}
    >
      <div className={styles.wrappedMedal} aria-hidden><Trophy size={16} /></div>
      <p className={styles.wrappedEyebrow}>Season Wrapped · {wrapped.seasonName}</p>
      <p className={styles.wrappedTeamName}>{wrapped.teamName}</p>
      {hasRecord ? (
        <>
          <p className={styles.wrappedRecord}>
            {rec.wins}–{rec.losses}{rec.ties > 0 ? `–${rec.ties}` : ''}
          </p>
          <p className={styles.wrappedSub}>{rec.games} game{rec.games === 1 ? '' : 's'} · league &amp; tournament play</p>
        </>
      ) : (
        <>
          <p className={styles.wrappedRecord}>That&apos;s a wrap</p>
          <p className={styles.wrappedSub}>A season together — here&apos;s what you built</p>
        </>
      )}

      <div className={styles.wrappedTiles}>
        {wrapped.longestStreak && (
          <div className={styles.wrappedTile}>
            <span className={styles.wrappedTileLabel}>Longest streak</span>
            <span className={styles.wrappedTileValue}>{wrapped.longestStreak.length} wins</span>
            <span className={styles.wrappedTileSub}>{fmtDate(wrapped.longestStreak.startsAt)} – {fmtDate(wrapped.longestStreak.endsAt)}</span>
          </div>
        )}
        {cg && (
          <div className={styles.wrappedTile}>
            <span className={styles.wrappedTileLabel}>Closest game</span>
            <span className={styles.wrappedTileValue}>{cg.teamScore}–{cg.opponentScore} {cg.result === 'win' ? 'W' : 'L'}</span>
            <span className={styles.wrappedTileSub}>
              {cg.opponent ? `${cg.homeAway === 'away' ? '@' : 'vs'} ${cg.opponent} · ` : ''}{fmtDate(cg.startsAt)}
            </span>
          </div>
        )}
        {wrapped.attendanceRate && (
          <div className={styles.wrappedTile}>
            <span className={styles.wrappedTileLabel}>Attendance</span>
            <span className={styles.wrappedTileValue}>{wrapped.attendanceRate.pct}%</span>
            <span className={styles.wrappedTileSub}>game days</span>
          </div>
        )}
        {wrapped.topAward && (
          <div className={styles.wrappedTile}>
            <span className={styles.wrappedTileLabel}>Most awarded</span>
            <span className={styles.wrappedTileValue}>
              {wrapped.topAward.playerLabel}{wrapped.topAward.tiedWith.length > 0 ? ` & ${wrapped.topAward.tiedWith.join(' & ')}` : ''}
            </span>
            <span className={styles.wrappedTileSub}>
              {wrapped.topAward.count} award{wrapped.topAward.count === 1 ? '' : 's'}{wrapped.topAward.topTypeName ? ` · ${wrapped.topAward.topTypeName}` : ''}
            </span>
          </div>
        )}
        {wrapped.lineupFact && (
          <div className={`${styles.wrappedTile} ${styles.wrappedTileWide}`}>
            <span className={styles.wrappedTileLabel}>Lineup fact</span>
            <span className={styles.wrappedTileValue}>
              Your lineup went {wrapped.lineupFact.wins}–{wrapped.lineupFact.losses}{wrapped.lineupFact.ties ? `–${wrapped.lineupFact.ties}` : ''}
            </span>
            <span className={styles.wrappedTileSub}>reused {wrapped.lineupFact.uses}× — never beaten</span>
          </div>
        )}
        {!wrapped.longestStreak && !cg && !wrapped.attendanceRate && !wrapped.topAward && !wrapped.lineupFact && (
          <div className={styles.wrappedTile}>
            <span className={styles.wrappedTileLabel}>Roster</span>
            <span className={styles.wrappedTileValue}>{wrapped.rosterCount} player{wrapped.rosterCount === 1 ? '' : 's'}</span>
            <span className={styles.wrappedTileSub}>a season together</span>
          </div>
        )}
      </div>

      {/* Game-Day P2 — the season's most recent bench moment and the honest count. The smallest
          true version (owner-approved mockup rev 4, frame 18): one line, never a ranking, and
          absent entirely in a season nobody logged one for. It renders ON the card but is
          excluded from the shared image — see `wrappedShareCardData`. */}
      {wrapped.momentSlot && (
        <div className={styles.wrappedMomentLine}>
          <span className={styles.wrappedMomentLabel}>
            From the bench · {wrapped.momentSlot.total} moment{wrapped.momentSlot.total === 1 ? '' : 's'}
          </span>
          <p className={styles.wrappedMomentBody}>&ldquo;{wrapped.momentSlot.body}&rdquo;</p>
          <span className={styles.wrappedMomentMeta}>
            {fmtDate(wrapped.momentSlot.happenedAt)}
            {wrapped.momentSlot.gameLabel ? ` · ${wrapped.momentSlot.gameLabel}` : ''}
          </span>
        </div>
      )}

      <div className={styles.wrappedShareRow}>
        <button type="button" className="btn btn-lime btn-sm" onClick={handleShare} disabled={shareState === 'working'}>
          {shareState === 'working' ? 'Preparing…' : shareState === 'done' ? 'Shared' : 'Share your season'}
        </button>
        {shareState === 'failed' && (
          <p className={styles.wrappedShareNote}>Sharing didn&apos;t work on this device — try again, or screenshot the card.</p>
        )}
      </div>
    </div>
  );
}
