'use client';
import { useRef, useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard';
import { publicHref, useClubPublicOrigin } from '@/lib/use-club-public-origin';
import ClubSiteOffNotice from '@/components/coaches/ClubSiteOffNotice';
import SaveStatusPill from '@/components/coaches/SaveStatusPill';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import styles from './CoachPublicPageDoor.module.css';
import type { ScheduleVisibility } from '@/lib/family-access';
import { coachNameRowWords } from '@/lib/coach-names-words';
import type { CoachNamesPolicy } from '@/lib/coach-names-policy';

/**
 * Team settings › Sharing — "Your team's public page" and the coach's own name switch (Club Tier Stage 4c-2 Part B,
 * Stage 4 End state › 7; words CLUB_TIER_STAGE4C2_COPY.md §F).
 *
 * The door: the page's address, Copy link and Open (44 px on a phone), and one sentence saying what anyone with the
 * link sees. The public page shows GAMES only (owner ruling 2026-10-20), never practices, so the sentence says "your
 * games". The site-off notice lives inside the door; with the site off only Copy link shows (Open would land on a
 * closed page).
 *
 * The switch is the CALLER's own (every coach can open Settings since Part B, owner ruling 2026-10-22): name and role
 * only, off by default, and a removal turns it off. It autosaves with the portal's pill.
 *
 * Where the CLUB has decided for this coach's role (mig 352) the switch is replaced by one sentence and plain text — no
 * tag, pill or greyed switch. The server decides who is listed (`ownSwitchApplies`, `listedByClub`); this only reads them,
 * and the coach's own stored switch is never touched by the club's choice.
 */

/** The three words a coach reads on Schedule visibility — the same three the retired card used, so a coach who set this
 *  last month finds the setting they remember. ONE table: the control (Team settings) and this door's sentence. */
export const VISIBILITY_LABEL: Record<ScheduleVisibility, string> = {
  staff: 'Staff only',
  families: 'Families',
  public_link: 'Public',
};

/** F4 / F8 — what the page shows, by the team's Schedule visibility. F8's last sentence only for a coach who can act on it. */
export function publicPageSentence(visibility: ScheduleVisibility | null, canChangeVisibility: boolean): string {
  const base = 'Anyone with the link sees the team’s name, its about text and open tryouts (your club edits those)';
  if (visibility === 'public_link') return `${base}, and your games, because you chose Public.`;
  const off = `${base}.`;
  if (!visibility) return off;
  const why = ` Your games stay off it because you chose ${VISIBILITY_LABEL[visibility]}.`;
  return off + why + (canChangeVisibility ? ' Choose Public in Schedule visibility to show them.' : '');
}

export default function CoachPublicPageDoor({
  path, siteOff, visibility, canChangeVisibility, showMyName, namesPolicy, ownSwitchApplies, listedByClub, onSaveName,
}: {
  path: string;
  siteOff: boolean;
  visibility: ScheduleVisibility | null;
  canChangeVisibility: boolean;
  showMyName: boolean;
  /** The club's choice and what it means for THIS coach, computed on the server (mig 352). */
  namesPolicy: CoachNamesPolicy;
  ownSwitchApplies: boolean;
  listedByClub: boolean;
  /** Saves the caller's own switch (the page then holds the saved value), or throws. */
  onSaveName: (show: boolean) => Promise<void>;
}) {
  const { copied, copy } = useCopyToClipboard();
  // `path` is `/{club}/teams/{team}`. The page is handed out at the club's own web address when it has one (Club Tier 4e),
  // else at the address this page is on. The Settings page renders this only after its client read lands, so the window is there.
  const orgSlug = path.split('/')[1] ?? '';
  const origin = useClubPublicOrigin(orgSlug);
  const url = origin ? publicHref(origin, orgSlug, path.slice(orgSlug.length + 1)) : path;

  // The switch shows the SAVED value (the page re-reads the server's answer on a failure); while a save is open it shows
  // what the coach asked for.
  const [pending, setPending] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  // What the coach last asked for — Retry sends it again.
  const wanted = useRef(showMyName);
  const name = pending ?? showMyName;
  const saving = pending !== null;
  const row = coachNameRowWords({ policy: namesPolicy, ownSwitchApplies, listedByClub });

  async function save(next: boolean) {
    wanted.current = next;
    setPending(next);
    setError(null);
    try {
      await onSaveName(next);
    } catch {
      setError('Couldn’t save');
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      <div className={shared.settingRow}>
        <div className={shared.settingRowMain}>
          <span className={shared.settingRowLabel}>Your team&rsquo;s public page</span>
          <span className={styles.address}>{url}</span>
        </div>
        {/* The drawn order: the address, then Copy link · Open (a full-width pair on a phone, both labelled — the
            phone's symbol-alone rule has a named exception here: "Open" is no familiar symbol, F3), then the sentence. */}
        <div className={`${shared.settingRowCtl} ${shared.settingRowCtlWide} ${styles.doors}`}>
          <button type="button" className={`${shared.btnSecondary} ${styles.door}`} onClick={() => copy(url)} disabled={!origin}>
            {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
            {copied ? 'Copied' : 'Copy link'}
          </button>
          <span className={shared.srOnly} aria-live="polite">{copied ? 'Copied' : ''}</span>
          {!siteOff && (
            <a href={origin ? url : path} target="_blank" rel="noopener noreferrer" className={`${shared.btnSecondary} ${styles.door}`}>
              <ExternalLink size={16} aria-hidden />
              Open
            </a>
          )}
        </div>
        <div className={styles.after}>
          <span className={shared.settingRowDesc}>{publicPageSentence(visibility, canChangeVisibility)}</span>
          {siteOff && <ClubSiteOffNotice />}
        </div>
      </div>
      <div className={shared.settingRow}>
        <div className={shared.settingRowMain}>
          <span className={shared.settingRowLabel} id="show-my-name-label">Show my name on the team&rsquo;s public page</span>
          <span className={shared.settingRowDesc}>{row.description}</span>
        </div>
        <div className={shared.settingRowCtl}>
          {/* A switch, not a checkbox: the whole 44 px button is the target (the rendered check measured a bare checkbox
              at 16 px), and a screen reader hears "on" / "off". Where the club has decided, plain text takes its place. */}
          {row.controlText ? (
            <span className={shared.settingRowDesc}>{row.controlText}</span>
          ) : (
          <button
            type="button"
            role="switch"
            aria-checked={name}
            aria-labelledby="show-my-name-label"
            className={`${styles.switch}${name ? ` ${styles.switchOn}` : ''}`}
            onClick={() => save(!name)}
            disabled={saving}
          >
            <span className={styles.track} aria-hidden><span className={styles.knob} /></span>
          </button>
          )}
        </div>
      </div>
      <SaveStatusPill saving={saving} dirty={false} error={error} onRetry={() => save(wanted.current)} />
    </>
  );
}
