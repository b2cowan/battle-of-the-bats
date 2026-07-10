'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import type { RepTeamEvent, RepEventType } from '@/lib/types';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

// Season-record categories + their default inclusion. Owner-decided default = League + Tournament
// count, Scrimmage excluded; the coach can toggle each and the choice is remembered per team.
const WLT_CATS: { key: RepEventType; label: string }[] = [
  { key: 'league_game', label: 'League' },
  { key: 'tournament_game', label: 'Tournament' },
  { key: 'scrimmage', label: 'Scrimmage' },
];
const GAME_EVENT_TYPES: RepEventType[] = ['league_game', 'tournament_game', 'scrimmage'];
const WLT_DEFAULT: Record<string, boolean> = { league_game: true, tournament_game: true, scrimmage: false };

function tallyResults(list: RepTeamEvent[]) {
  return {
    w: list.filter(e => e.result === 'win').length,
    l: list.filter(e => e.result === 'loss').length,
    t: list.filter(e => e.result === 'tie').length,
  };
}

function resultLetter(r?: string | null) { return r === 'win' ? 'W' : r === 'loss' ? 'L' : 'T'; }

// "W 7–4 vs Lions" style label for a finalized game (score + matchup when available).
function formLabel(e: RepTeamEvent): string {
  const score = e.teamScore != null && e.opponentScore != null ? ` ${e.teamScore}–${e.opponentScore}` : '';
  const opp = e.opponent ? ` ${e.homeAway === 'away' ? '@' : 'vs'} ${e.opponent}` : '';
  return `${resultLetter(e.result)}${score}${opp}`;
}

/**
 * Season W–L–T record with per-category include toggles (remembered per team) + a breakdown.
 * Lives on the team Overview (moved off the Schedule 2026-06-29). Renders nothing until at
 * least one finalized game exists.
 */
export default function SeasonRecordWidget({ events, teamId, insightsHref }: { events: RepTeamEvent[]; teamId: string; insightsHref?: string }) {
  const storageKey = `flhq.coachWlt.${teamId}`;
  const [included, setIncluded] = useState<Record<string, boolean>>(WLT_DEFAULT);
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  // Remembered choice loads after mount (avoids an SSR/hydration mismatch); defaults stand until then.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setIncluded({ ...WLT_DEFAULT, ...JSON.parse(raw) });
    } catch { /* ignore unreadable storage */ }
  }, [storageKey]);

  function toggle(key: string) {
    setIncluded(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  // Any finalized, non-cancelled game across the three game types is a candidate; the widget only
  // appears once at least one exists (so the toggles are discoverable even if a category is off).
  const candidates = events.filter(e => GAME_EVENT_TYPES.includes(e.eventType) && e.result && e.status !== 'cancelled');
  if (!candidates.length) return null;

  const { w, l, t } = tallyResults(candidates.filter(e => included[e.eventType]));

  // Scope caption — states exactly what the number counts, so a "0–0" beside a visible WIN
  // (e.g. a scrimmage that's excluded by default) never reads as broken.
  const activeLabels = WLT_CATS.filter(c => included[c.key]).map(c => c.label);
  const scope = activeLabels.length === 0
    ? 'No categories selected'
    : activeLabels.length === WLT_CATS.length
      ? 'All games'
      : activeLabels.join(' + ');

  // Recent form (last 5) + last result, scoped to the same included categories as the W–L count.
  const scoped = candidates
    .filter(e => included[e.eventType])
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  const recent = [...scoped.slice(0, 5)].reverse(); // oldest → newest, left to right
  const last = scoped[0];

  // Scoring totals (sport-neutral "Scored / Allowed") + current streak, scoped to the same set.
  const scoredFor = scoped.reduce((s, e) => s + (e.teamScore ?? 0), 0);
  const scoredAgainst = scoped.reduce((s, e) => s + (e.opponentScore ?? 0), 0);
  const diff = scoredFor - scoredAgainst;
  const hasScores = scoped.some(e => e.teamScore != null && e.opponentScore != null);
  const streakType = scoped[0]?.result ?? null;
  let streakCount = 0;
  for (const g of scoped) { if (g.result === streakType) streakCount += 1; else break; }
  const streakLabel = streakType && streakCount > 0
    ? `${streakType === 'win' ? 'Won' : streakType === 'loss' ? 'Lost' : 'Tied'} ${streakCount}`
    : '';

  return (
    <div className={styles.wltWidget}>
      <span className={styles.wltLabel}>Season Record</span>
      <div className={styles.wltMain}>
        <div className={styles.wltRow}>
          <span className={styles.wltW}>{w}<small>W</small></span>
          <span className={styles.wltSep}>–</span>
          <span className={styles.wltL}>{l}<small>L</small></span>
          {t > 0 && <><span className={styles.wltSep}>–</span><span className={styles.wltT}>{t}<small>T</small></span></>}
        </div>
        <span className={styles.wltScope}>{scope}</span>
      </div>
      {recent.length > 0 && (
        <div className={styles.wltForm}>
          <span className={styles.wltFormPips} aria-label="Recent form, oldest to newest">
            {recent.map((g, i) => (
              <span key={i} className={styles.wltPip} data-r={g.result ?? undefined} title={formLabel(g)}>
                {resultLetter(g.result)}
              </span>
            ))}
          </span>
          {last && <span className={styles.wltLast}>Last: {formLabel(last)}</span>}
        </div>
      )}
      {(streakLabel || hasScores) && (
        <div className={styles.wltStats}>
          {streakLabel && <span className={styles.wltStreak} data-r={streakType ?? undefined}>{streakLabel}</span>}
          {hasScores && (
            <span className={styles.wltScoring}>
              Scored <strong>{scoredFor}</strong> · Allowed <strong>{scoredAgainst}</strong>
              <span className={styles.wltDiff} data-pos={diff >= 0 ? 'true' : 'false'}>{diff >= 0 ? `+${diff}` : diff}</span>
            </span>
          )}
        </div>
      )}
      <div className={styles.wltControls}>
        <span className={styles.wltCountLabel}>Counting:</span>
        <div className={styles.wltToggles} role="group" aria-label="Include in season record">
          {WLT_CATS.map(c => (
            <button
              key={c.key}
              type="button"
              aria-pressed={!!included[c.key]}
              className={`${styles.wltToggle} ${included[c.key] ? styles.wltToggleActive : ''}`}
              onClick={() => toggle(c.key)}
            >
              {included[c.key] && <Check size={12} aria-hidden />}
              {c.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={styles.wltBreakdownToggle}
          onClick={() => setBreakdownOpen(o => !o)}
          aria-expanded={breakdownOpen}
        >
          {breakdownOpen ? 'Hide breakdown' : 'Breakdown'}
        </button>
      </div>
      {breakdownOpen && (
        <div className={styles.wltBreakdown}>
          {WLT_CATS.map(c => {
            const cat = tallyResults(candidates.filter(e => e.eventType === c.key));
            const total = cat.w + cat.l + cat.t;
            const on = !!included[c.key];
            return (
              <div key={c.key} className={styles.wltBreakdownRow} data-on={on ? 'true' : 'false'}>
                <span className={styles.wltBreakdownLabel}>
                  <span className={styles.wltBreakdownDot} aria-hidden />
                  {c.label}
                </span>
                <span className={styles.wltBreakdownVal}>
                  {total === 0 ? '—' : `${cat.w}–${cat.l}${cat.t > 0 ? `–${cat.t}` : ''}`}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {insightsHref && (
        <Link href={insightsHref} className={styles.wltInsightsLink}>Season insights →</Link>
      )}
    </div>
  );
}
