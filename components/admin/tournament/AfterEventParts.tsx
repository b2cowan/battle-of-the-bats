'use client';
/**
 * AFTER THE EVENT — the parts the finished board and Summary share (Tournament admin redesign Stage 4,
 * D1 · D3 · D6, built to hub v24). One card per idea, drawn once, read from the ONE recap
 * (`lib/event-recap.ts`) — so "How it finished" can never say one thing on the board and another on
 * Summary, which is the defect Part 0 fixed.
 *
 *   <HowItFinished>   the section card: a row per division (a trophy for a champion, the standings mark
 *                     for a division that played no final — one lead mark, §3.10.7), rows open nothing
 *   <EventInNumbers>  the figures card: teams · games played · collected · still owed (2 × 2, 24px)
 *   <NextYear>        the section card the reuse door sits in (the board's lime, Summary's white)
 *   <SummaryDoor>     the kit's door card to Summary
 *   <ShareAction>     Copy champions link / Copy standings link (P3) — an action: a boxed 44px icon on a
 *                     phone, a white worded button at a desk; its notice is the kit's floating pill
 *
 * The words are /marketing's (`lib/after-event-words.ts`). The kit's parts, never a second recipe:
 * `ClubSection` + `ClubRow` (the admin's row), `CoachDoorCard`, `CoachFigure`, `NoticePill`.
 */
import { useState, type ReactNode } from 'react';
import { Link2, Trophy } from 'lucide-react';
import { CoachDoorCard, CoachEyebrow, CoachFigure } from '@/components/coaches/kit';
import { ClubRow, ClubRowList, ClubSection, NoticePill } from '@/components/admin/kit/club/RepKit';
import { screenParts } from '@/components/admin/tournament/ScreenParts';
import { BOARD_WORDS, FINISH_WORDS, NEXT_YEAR_WORDS, SHARE_WORDS, SUMMARY_WORDS, hasMoney } from '@/lib/after-event-words';
import type { EventRecap } from '@/lib/event-recap';
import styles from './AfterEventParts.module.css';

/** The drawing's standings mark (a podium): lucide has none. */
function PodiumMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 21V11h8v10" /><path d="M2 21v-6h6" /><path d="M16 15h6v6" /><path d="M2 21h20" /><path d="M12 3v4" />
    </svg>
  );
}

/**
 * The copy action (P3): copies the public page the recap names. Absent with no link; when the
 * organizer hid Standings, the host shows `SHARE_WORDS.hidden` instead (`recap.shareHidden`).
 * `onCopied` lets the host count the share (Summary's analytics).
 */
export function ShareAction({ recap, onCopied }: { recap: EventRecap; onCopied?: () => void }) {
  const [notice, setNotice] = useState<{ key: number; message: string } | null>(null);
  if (!recap.shareLink || !recap.sharePath) return null;
  const words = SHARE_WORDS[recap.shareLink];
  const path = recap.sharePath;
  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setNotice({ key: Date.now(), message: words.copied });
      onCopied?.();
    } catch {
      setNotice({ key: Date.now(), message: SHARE_WORDS.failed });
    }
  }
  return (
    <>
      <button
        type="button"
        className={`${screenParts.plainButton} ${screenParts.headerButton} ${styles.boxedIcon}`}
        onClick={() => void copy()}
        aria-label={words.name}
        title={words.name}
      >
        <Link2 size={15} aria-hidden />
        <span className={screenParts.headerButtonLabel}>{words.label}</span>
      </button>
      {notice && <NoticePill key={notice.key} message={notice.message} onDone={() => setNotice(null)} />}
    </>
  );
}

/** How each division finished (D1, D3). `footLine` — the board's line of figures under the rows. A
 *  champion's line carries the final's day at a desk only, as drawn. */
export function HowItFinished({ recap, action, note, footLine = false }: {
  recap: EventRecap;
  /** The section head's action (the board's Copy champions link). */
  action?: ReactNode;
  /** One sentence under the rows (why there is no link to share: `SHARE_WORDS.hidden`). */
  note?: ReactNode;
  footLine?: boolean;
}) {
  const foot = footLine ? FINISH_WORDS.footLine(recap) : null;
  return (
    <ClubSection title={FINISH_WORDS.heading} actions={action} list className={styles.card}>
      <ClubRowList inset label={FINISH_WORDS.heading}>
        {recap.finishes.map(f => (
          <ClubRow
            key={f.divisionId}
            mark={f.kind === 'champion'
              ? <span className={styles.markChampion}><Trophy size={20} aria-hidden /></span>
              : <span className={styles.markStandings}><PodiumMark /></span>}
            title={f.teamName}
            caption={<>{FINISH_WORDS.caption(f)}<span className={styles.finalDay}>{FINISH_WORDS.finalDay(f)}</span></>}
          />
        ))}
      </ClubRowList>
      {note != null && <p className={styles.note}>{note}</p>}
      {foot && (
        <p className={styles.foot}>
          {foot.lead}
          {foot.owed && <>{' · '}<span className={styles.owed}>{foot.owed}</span></>}
        </p>
      )}
    </ClubSection>
  );
}

/** The event in numbers (D3, D6): one card, four figures 2 × 2; no money pair when no fees were charged
 *  and nothing was collected. `note` — the share note, when this card stands in for How it finished. */
export function EventInNumbers({ recap, action, note }: { recap: EventRecap; action?: ReactNode; note?: ReactNode }) {
  const W = SUMMARY_WORDS;
  return (
    <ClubSection title={W.figuresHeading} actions={action} className={styles.card}>
      <div className={styles.figures}>
        <div><CoachFigure>{recap.teamsPlayed}</CoachFigure><span className={styles.figLabel}>{W.teams(recap.teamsPlayed)}</span></div>
        <div><CoachFigure>{recap.gamesPlayed}</CoachFigure><span className={styles.figLabel}>{W.gamesPlayed(recap.gamesPlayed, recap.playoffGamesPlayed)}</span></div>
        {hasMoney(recap) && (
          <>
            <div><CoachFigure>{W.money(recap.money.collected)}</CoachFigure><span className={styles.figLabel}>{W.collected}</span></div>
            <div>
              <CoachFigure className={recap.money.owed > 0 ? styles.owed : undefined}>{W.money(recap.money.owed)}</CoachFigure>
              <span className={styles.figLabel}>{W.stillOwed}</span>
            </div>
          </>
        )}
      </div>
      {note != null && <p className={styles.note}>{note}</p>}
    </ClubSection>
  );
}

/** Next year (D1, D2): the sentence and the door to the one reuse step — or the Tournament plan's own
 *  content (the slot sentence, Archive, the lock line), passed as `children`. */
export function NextYear({ year, children, wide = false }: { year?: number | null; children: ReactNode; wide?: boolean }) {
  return (
    <ClubSection title={NEXT_YEAR_WORDS.heading} className={styles.card}>
      <div className={wide ? styles.nextYearWide : styles.nextYear}>
        {year !== undefined && <p className={styles.sentence}>{NEXT_YEAR_WORDS.sentence(year)}</p>}
        {children}
      </div>
    </ClubSection>
  );
}

/** The reuse door's button: the board's ONE lime, or Summary's white (the board keeps the lime). */
export function ReuseButton({ primary, onClick }: { primary: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`btn ${primary ? 'btn-lime' : 'btn-outline'} btn-data ${styles.reuse}`} onClick={onClick}>
      {NEXT_YEAR_WORDS.reuse}
    </button>
  );
}

/** Summary's door, once (D1): the kit's door card. */
export function SummaryDoor({ href }: { href: string }) {
  return (
    <CoachDoorCard href={href} className={styles.door}>
      <CoachEyebrow arrow>{BOARD_WORDS.doorEyebrow}</CoachEyebrow>
      <span className={styles.doorTitle}>{BOARD_WORDS.doorTitle}</span>
      <span className={styles.doorLine}>{BOARD_WORDS.doorCaption}</span>
    </CoachDoorCard>
  );
}
