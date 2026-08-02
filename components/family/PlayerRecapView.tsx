'use client';
import { useState } from 'react';
import type { PlayerSeasonRecapPayload } from '@/lib/rep-player-season-recap';
import { generateKeepsakeCardBlob, awardSummaryLine } from '@/lib/keepsake-card';
import { shareScoreImage } from '@/lib/share-card';
import { shadeHex } from '@/lib/wrapped-share-card';
import { formatShortDate, formatValue } from '@/lib/measurable-format';
import styles from './PlayerRecapView.module.css';

/**
 * The player season recap (S7) — ONE component, rendered on TWO surfaces.
 *
 * The family reads it at /family/teams/[teamId]/recap; the coach previews it from the player
 * page. That is deliberately the same component and not two renderings of one payload: a
 * "preview" drawn by different code is not a preview, it is a second opinion. The coach page
 * wraps this in the consumer warm shell so the tokens below resolve there too, which also
 * means the coach is looking at the family's actual skin, the way an email preview pane shows
 * the recipient's rendering rather than the sender's.
 *
 * ⚠ THE HONESTY RULE IS THE WHOLE DESIGN. Every block below is behind a null check on a field
 * the engine sets to null when the coach never recorded that kind of thing. A null block
 * renders NOTHING — no placeholder, no "not tracked", no encouraging sentence. Two failures
 * are equally bad: telling a family something that did not happen, and implying the coach
 * neglected something because a feature they never used leaves a visible gap.
 *
 * ⚠ NO MEASURABLE IS LABELLED AN IMPROVEMENT. A coach's test type carries a name and a
 * free-text unit and nothing else — the product cannot know whether lower is better for
 * "seconds", "reps" or "mph". First reading → latest reading, stated as a fact, with no arrow
 * and no colour. The family knows the sport; we do not.
 */

const STATUS_LABEL: Record<'working' | 'achieved' | 'parked', string> = {
  working: 'working on it',
  achieved: 'got there',
  parked: 'parked',
};

const BAND_LABEL: Record<'in_band' | 'above_band' | 'below_band', string> = {
  in_band: 'Right in the team’s fair-play band all season',
  above_band: 'Above the team’s middle for time on the field',
  below_band: 'Below the team’s middle for time on the field',
};

export default function PlayerRecapView({ recap, isPreview = false }: {
  recap: PlayerSeasonRecapPayload;
  /** Coach-side framing: this is what the family will read. Changes the surrounding copy
   *  only — never what is shown, which is the entire point of a preview. */
  isPreview?: boolean;
}) {
  const [shareState, setShareState] = useState<'idle' | 'working' | 'done' | 'failed'>('idle');

  const label = recap.playerNumber
    ? `${recap.playerFirstName} #${recap.playerNumber}`
    : recap.playerFirstName;
  const rec = recap.teamRecord;
  const hasRecord = rec.games > 0;

  async function handleShare() {
    setShareState('working');
    try {
      const blob = await generateKeepsakeCardBlob({
        firstName: recap.playerFirstName,
        jerseyNumber: recap.playerNumber,
        teamName: recap.teamName,
        seasonName: recap.seasonName,
        teamColor: recap.teamColor,
        awardNames: recap.awards?.items.map(a => a.name) ?? [],
        attendancePct: recap.attendance?.pct ?? null,
      });
      await shareScoreImage(
        blob,
        `${recap.playerFirstName.toLowerCase()}-${recap.seasonYear}-keepsake.png`,
        `${label} — ${recap.seasonName}`,
      );
      setShareState('done');
    } catch {
      setShareState('failed');
    }
  }

  return (
    <div className={styles.recap}>
      {isPreview && (
        <p className={styles.previewNote}>
          This is exactly what {recap.playerFirstName}’s family reads once you close the season.
          Sections you never recorded anything for simply aren’t here — nothing is invented, and
          nothing says a section is missing.
        </p>
      )}

      {/* Hero — fixed team-colour ground with white ink in both themes, the Wrapped-card recipe. */}
      <div
        className={styles.hero}
        style={{ background: `linear-gradient(160deg, ${shadeHex(recap.teamColor, 0.66)}, ${shadeHex(recap.teamColor, 0.3)})` }}
      >
        <p className={styles.heroEyebrow}>{recap.seasonName} Season Recap</p>
        <h2 className={styles.heroName}>{recap.playerFirstName}’s season</h2>
        <p className={styles.heroSub}>
          {recap.teamName}
          {hasRecord ? ` · ${rec.wins}–${rec.losses}–${rec.ties}` : ''}
        </p>
      </div>

      {recap.isEmpty ? (
        /* Everything below came back null. Said plainly, and without blaming anyone: a coach
           who ran the season out of their head still ran the season. */
        <div className={styles.tile}>
          <p className={styles.emptyText}>
            There isn’t a written record of {recap.playerFirstName}’s season to show here — the
            coach kept this one off the app. The team finished {hasRecord ? `${rec.wins}–${rec.losses}–${rec.ties}` : 'their season'}.
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {recap.attendance && (
            <div className={styles.tile}>
              <span className={styles.tileValue}>{recap.attendance.pct}%</span>
              <span className={styles.tileLabel}>
                Attendance · {recap.attendance.attended} of {recap.attendance.known}
              </span>
              {(recap.attendance.games || recap.attendance.practices) && (
                <span className={styles.tileSub}>
                  {[
                    recap.attendance.games && `${recap.attendance.games.attended}/${recap.attendance.games.known} games`,
                    recap.attendance.practices && `${recap.attendance.practices.attended}/${recap.attendance.practices.known} practices`,
                  ].filter(Boolean).join(' · ')}
                </span>
              )}
            </div>
          )}

          {recap.awards && (
            <div className={styles.tile}>
              <span className={styles.tileValue}>{recap.awards.count}</span>
              <span className={styles.tileLabel}>
                Award{recap.awards.count === 1 ? '' : 's'} earned
              </span>
              <span className={styles.tileSub}>{awardSummaryLine(recap.awards.items.map(a => a.name))}</span>
            </div>
          )}

          {recap.workedOn && (
            <div className={`${styles.tile} ${styles.tileWide}`}>
              <span className={styles.tileLabel}>Worked on this season</span>
              {recap.workedOn.focusAreas.map((f, i) => (
                <span key={`${f.focusArea}-${i}`} className={styles.focusRow}>
                  <b>{f.focusArea}</b>
                  <span className={styles.focusStatus}>{STATUS_LABEL[f.status]}</span>
                </span>
              ))}
              {recap.workedOn.trends.map(t => (
                <span key={t.typeName} className={styles.focusRow}>
                  <b>{t.typeName}</b>
                  {/* `formatValue` is the shared measurable formatter — it strips the float
                      noise a raw coach-entered number carries (7.599999999). Every other
                      surface that renders a reading uses it; a recap that read "7.5999" would
                      look like a bug to the one audience least able to shrug it off. */}
                  <span className={styles.trendValue}>
                    {formatValue(t.firstValue)}{t.unit ? ` ${t.unit}` : ''} → {formatValue(t.latestValue)}{t.unit ? ` ${t.unit}` : ''}
                  </span>
                  <span className={styles.tileSub}>
                    {formatShortDate(t.firstOn)} to {formatShortDate(t.latestOn)} · {t.readings} readings
                  </span>
                </span>
              ))}
              {recap.workedOn.sessionCount > 0 && (
                <span className={styles.tileSub}>
                  Coach’s notes across {recap.workedOn.sessionCount} session
                  {recap.workedOn.sessionCount === 1 ? '' : 's'}
                </span>
              )}
            </div>
          )}

          {recap.playingTime && (
            <div className={`${styles.tile} ${styles.tileWide}`}>
              <span className={styles.tileLabel}>Playing time</span>
              <span className={styles.tileBody}>{BAND_LABEL[recap.playingTime.band]}</span>
              <span className={styles.tileSub}>
                Across {recap.playingTime.gamesWithLineup} game
                {recap.playingTime.gamesWithLineup === 1 ? '' : 's'} with a set lineup
              </span>
            </div>
          )}
        </div>
      )}

      {/* The keepsake (3.3). Family-triggered, drawn on this device, handed to the share sheet.
          No public URL is ever minted; first name + jersey is the whole payload. */}
      <div className={styles.keepsake}>
        <button
          type="button"
          className={styles.keepsakeBtn}
          onClick={handleShare}
          disabled={shareState === 'working'}
        >
          {shareState === 'working' ? 'Preparing…' : shareState === 'done' ? 'Saved' : 'Save keepsake card'}
        </button>
        <p className={styles.keepsakeNote}>
          {shareState === 'failed'
            ? 'That didn’t work on this device — try again, or take a screenshot.'
            : 'A square image for your camera roll. First name and number only, saved on your phone — nothing is posted anywhere.'}
        </p>
      </div>
    </div>
  );
}
