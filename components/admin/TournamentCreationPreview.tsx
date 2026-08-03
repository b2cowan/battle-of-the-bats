'use client';
/**
 * components/admin/TournamentCreationPreview.tsx
 * The setup wizard's live public-page preview — a phone frame beside the form that
 * assembles the tournament's public hero as the organizer types (desktop only; the
 * pane is hidden by CSS below the wizard's two-pane breakpoint).
 *
 * DRIFT CONTRACT — this mimics the pre-event hero of
 * components/public/TournamentHomeContent.tsx. That hero is a server component reading
 * live data, so it cannot re-render per keystroke; this is a purpose-built client mimic
 * and the two must never disagree about what they both show. Everything textual is
 * single-sourced in lib/tournament-hero-copy.ts, and the ticking countdown is the real
 * components/public/Countdown.tsx. When the hero changes, change this file too — or
 * change the shared helper and get both for free.
 *
 * Hero-only by design (badge, title, hosted-by, registration line, CTA, 3-stat row).
 * No schedule, standings, live or finished states: fewer elements, less to drift.
 */
import { Star } from 'lucide-react';
import { useMemo, useSyncExternalStore } from 'react';
import type { Organization } from '@/lib/types';
import { resolvePublicTournamentTheme } from '@/lib/public-tournament-theme';
import { PRESETS } from '@/lib/themes';
import { tournamentToday } from '@/lib/timezone';
import {
  formatHeroDateRange,
  heroCountdownText,
  heroFirstPitchISO,
  tournamentDayCount,
} from '@/lib/tournament-hero-copy';
import Countdown from '@/components/public/Countdown';
import styles from './TournamentCreationPreview.module.css';

/** The org fields the preview needs: identity + the theme its public pages resolve to. */
export type PreviewOrg = Pick<
  Organization,
  'name' | 'slug' | 'planId' | 'themePreset' | 'themePrimary' | 'themeAccent'
>;

/** The host never changes within a session — nothing to subscribe to, just a stable no-op. */
const subscribeToNothing = () => () => {};
const readHost = () => window.location.host;
const readHostOnServer = () => 'fieldlogichq.ca';

/** Branding the new tournament will carry of its own, if any. Null = inherit the org's. */
export type PreviewTournamentTheme = {
  themePreset?: string | null;
  themePrimary?: string | null;
  themeAccent?: string | null;
};

/** Present only when the organizer may actually choose colours (plan + capability). */
export type PreviewThemePicker = {
  /** Preset highlighted now, or null when the effective theme is a custom colour. */
  selected: string | null;
  onSelect: (preset: string) => void;
  /** What the caption reads under the row — the preset's name, or where the colours came from. */
  caption: string;
  /** Present only while an explicit pick is in play: the way back to inheriting. */
  onClear?: (() => void) | null;
  clearLabel?: string;
};

type Props = {
  org: PreviewOrg;
  name: string;
  slug: string;
  startDate: string;
  endDate: string;
  /** Divisions entered so far — null until the organizer reaches the divisions step. */
  divisionCount?: number | null;
  /** Total team capacity across those divisions — null when divisions are not bound yet. */
  teamSpots?: number | null;
  /** The draft's own branding (a chosen swatch, or what a reuse would copy). Null = inherit. */
  tournamentTheme?: PreviewTournamentTheme | null;
  themePicker?: PreviewThemePicker | null;
};

export default function TournamentCreationPreview({
  org,
  name,
  slug,
  startDate,
  endDate,
  divisionCount = null,
  teamSpots = null,
  tournamentTheme = null,
  themePicker = null,
}: Props) {
  // The host is a browser-only value, and this wizard CAN be server-rendered on first paint
  // (`/admin/org/tournaments?create=1` opens it immediately). Reading window.location during
  // render would print the fallback on the server and the real host on the client — a
  // hydration mismatch. useSyncExternalStore renders the server snapshot, then swaps after
  // hydration, which is exactly the sanctioned shape for this.
  const host = useSyncExternalStore(subscribeToNothing, readHost, readHostOnServer);

  // The colours this tournament's public page will actually publish in — the SHARED rule,
  // not a local guess. Passing the draft's own branding through the same helper the live
  // page uses means a plan without advanced branding still previews the platform theme
  // even when a reuse would copy the source event's colours onto the row.
  const themeVars = useMemo(() => {
    const theme = resolvePublicTournamentTheme(org, tournamentTheme);
    return {
      '--primary': theme.primary,
      '--primary-light': theme.primaryLight,
      '--primary-rgb': theme.primaryRgb,
      '--on-primary': theme.onPrimary,
    } as React.CSSProperties;
  }, [org, tournamentTheme]);

  // Resolved once per mount, not per keystroke: it builds an Intl formatter, and "today"
  // must not shift mid-edit anyway.
  const today = useMemo(() => tournamentToday(), []);
  const dateDisplay = formatHeroDateRange(startDate, endDate);
  const countdownText = heroCountdownText(startDate, endDate, today);
  const isPreEvent = Boolean(startDate && endDate && today < startDate);
  const firstPitchISO = isPreEvent ? heroFirstPitchISO(startDate) : null;

  const dayCount = tournamentDayCount(startDate, endDate);
  const trimmedName = name.trim();
  const publicPath = `${host}/${org.slug}/${slug.trim() || '…'}`;

  return (
    <div className={styles.pane}>
      <p className={styles.paneLabel} aria-hidden="true">Live preview</p>

      {/* The swatches are real controls, so they sit OUTSIDE the aria-hidden mock below —
          a decorative picture may be hidden from screen readers; a focusable button may not. */}
      {themePicker && (
        <div className={styles.swatchRow}>
          <div className={styles.swatches} role="group" aria-label="Public page colours">
            {Object.entries(PRESETS).map(([key, preset]) => {
              const isSelected = themePicker.selected === key;
              return (
                <button
                  key={key}
                  type="button"
                  className={`${styles.swatch} ${isSelected ? styles.swatchSelected : ''}`}
                  style={{ background: preset.primary }}
                  aria-pressed={isSelected}
                  title={preset.name}
                  onClick={() => themePicker.onSelect(key)}
                >
                  <span className={styles.swatchAccent} style={{ background: preset.accent }} />
                  <span className={styles.srOnly}>{preset.name}</span>
                </button>
              );
            })}
          </div>
          <p className={styles.swatchCaption}>{themePicker.caption}</p>
          {themePicker.onClear && (
            <button type="button" className={styles.swatchClear} onClick={themePicker.onClear}>
              {themePicker.clearLabel ?? 'Use my organization’s colours'}
            </button>
          )}
        </div>
      )}

      <div className={styles.phone} aria-hidden="true">
        <div className={styles.notch} />
        <div className={styles.screen} style={themeVars}>
          <span className={styles.badge}>
            <Star size={11} fill="currentColor" />
            {dateDisplay}
            {isPreEvent && firstPitchISO ? (
              <>
                <span className={styles.badgeSeparator}>·</span>
                <Countdown target={firstPitchISO} prefix="First pitch in " whenPast={countdownText} />
              </>
            ) : countdownText ? (
              <>
                <span className={styles.badgeSeparator}>·</span>
                {countdownText}
              </>
            ) : null}
          </span>

          <h3 className={`${styles.title} ${trimmedName ? '' : styles.titleGhost}`}>
            {trimmedName || 'Your tournament name'}
          </h3>

          <p className={styles.sub}>
            Hosted by <strong>{org.name}</strong>. View tournament details and updates in one place.
          </p>

          <p className={styles.registration}>
            <b>Registration is open</b>
            <span>Teams can register for available divisions now.</span>
          </p>

          <span className={styles.cta}>Register</span>
          <p className={styles.ctaNote}>
            Registering also sets up your free Coaches Portal — your team&apos;s schedule, status,
            and updates from the organizer in one place.
          </p>

          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statNum}>{divisionCount ? divisionCount : 'TBA'}</span>
              <span className={styles.statLabel}>Divisions</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNum}>{teamSpots ? teamSpots : 'TBA'}</span>
              <span className={styles.statLabel}>Team Spots</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNum}>{dayCount ?? 'TBA'}</span>
              <span className={styles.statLabel}>Days</span>
            </div>
          </div>

          <p className={styles.url}>{publicPath}</p>
        </div>
      </div>
      <p className={styles.paneNote}>
        This is the top of your public page once you activate the tournament. Nothing is
        visible to anyone while it is a draft.
      </p>
    </div>
  );
}
