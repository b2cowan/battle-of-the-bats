'use client';
/**
 * THE FINISHED BOARD — Tournament admin redesign Stage 4 (D1, D6; A19–A21, A23, A24), built to hub v24
 * (https://claude.ai/artifact/HQoRuEsKd7i6cAvCrMNzgM, Stage 4 tab), ruled 2026-10-06.
 *
 *   How it finished       a row per division (the champion and the final it won; a division with no final
 *                         says where it finished) · the line of the event's figures · Copy champions link
 *   Next year             one sentence and the board's ONE lime, Reuse this setup (the frame's one reuse step)
 *   Summary               the kit's door card, once
 *
 * At a desk How it finished takes the wide column and Next year + Summary a 330px one; on a phone one
 * column. Today's guidance card (its tasks are in the title band's "?"), the tinted wrap-up card, the
 * "Did you know?" reuse link and the board's Archive all go (F47): Archive lives in the event's record
 * on a plan with unlimited slots, where archiving frees nothing and only takes the results offline.
 *
 * THE TOURNAMENT PLAN (A21, A23): the same How it finished and link (the public pages are on every plan);
 * Next year says the truth about its one slot and offers Archive, asking first; Reuse and Summary are one
 * plain lock line each; the board has no lime — the product never makes a destructive act its main one.
 * AN EXHIBITION (A24) names no winner: the event in numbers, Copy standings link, Next year.
 */
import { useState } from 'react';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import PlanLockLine from '@/components/admin/tournament/PlanLockLine';
import {
  EventInNumbers, HowItFinished, NextYear, ReuseButton, ShareAction, SummaryDoor,
} from '@/components/admin/tournament/AfterEventParts';
import { useSetupWizard } from '@/components/admin/tournament/SetupWizardOpener';
import { AFTER_EVENT_LOCK_PLAN, BOARD_WORDS, NEXT_YEAR_WORDS, SHARE_WORDS } from '@/lib/after-event-words';
import { statusConfirm } from '@/lib/tournament-status-words';
import { tournamentToday } from '@/lib/timezone';
import type { EventRecap } from '@/lib/event-recap';
import styles from './FinishedBoard.module.css';

export default function FinishedBoard({
  recap, tournament, base, planHref, hasSummary, canClone, canArchive, tournamentLimit, slotHolders, archive,
}: {
  recap: EventRecap;
  tournament: { id: string; name: string; year: number | null; status: string; startDate?: string | null };
  /** `/{org}/admin/tournaments` */
  base: string;
  /** Plan & billing with the Tournament Plus panel asked for (every lock line's door, A6). */
  planHref: string;
  hasSummary: boolean;
  /** The plan includes Reuse this setup (Tournament Plus+). */
  canClone: boolean;
  /** This member may change a tournament's status (create_tournaments). */
  canArchive: boolean;
  tournamentLimit: number;
  /** How many events hold a slot (every event not archived), this one included. */
  slotHolders: number;
  /** Archives this event; resolves once the board has moved on, rejects with the route's words. */
  archive: () => Promise<void>;
}) {
  const { openReuse } = useSetupWizard();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const finiteSlots = tournamentLimit < 9999;

  const share = <ShareAction recap={recap} />;
  const hiddenNote = recap.shareHidden ? SHARE_WORDS.hidden : null;
  // An Exhibition has no finishes (A24), and an event nobody played in has none either: its figures instead.
  const result = recap.finishes.length === 0
    ? <EventInNumbers recap={recap} action={share} note={hiddenNote} />
    : <HowItFinished recap={recap} action={share} note={hiddenNote} footLine />;

  const nextYear = canClone ? (
    <NextYear year={tournament.year}>
      <ReuseButton
        primary
        onClick={() => openReuse({ id: tournament.id, name: tournament.name, year: tournament.year, status: tournament.status }, 'finished_board')}
      />
    </NextYear>
  ) : (
    <NextYear>
      {finiteSlots && (
        <p className={styles.slotSentence}>
          {slotHolders > 1 ? NEXT_YEAR_WORDS.slotsHeld(slotHolders) : NEXT_YEAR_WORDS.oneSlotHeld}
        </p>
      )}
      {finiteSlots && canArchive && (
        <button type="button" className={`btn btn-outline btn-data ${styles.archive}`} onClick={() => { setError(''); setAsking(true); }}>
          {NEXT_YEAR_WORDS.archive}
        </button>
      )}
      <PlanLockLine href={planHref} plan={AFTER_EVENT_LOCK_PLAN}>{NEXT_YEAR_WORDS.lockReuse}</PlanLockLine>
    </NextYear>
  );

  const confirm = statusConfirm('archive', {
    name: tournament.name, startDate: tournament.startDate ?? null, today: tournamentToday(), finiteSlots,
  });

  return (
    <div className={styles.board}>
      <div className={styles.main}>{result}</div>
      <div className={styles.side}>
        {nextYear}
        {hasSummary
          ? <SummaryDoor href={`${base}/summary`} />
          : <div className={styles.lockSolo}><PlanLockLine href={planHref} plan={AFTER_EVENT_LOCK_PLAN}>{BOARD_WORDS.lockSummary}</PlanLockLine></div>}
      </div>

      {asking && (
        <KitDialog
          kind="question"
          title={confirm.title}
          onClose={() => { if (!busy) setAsking(false); }}
          busy={busy}
          footer={(
            <>
              <button type="button" className="btn btn-outline" onClick={() => setAsking(false)} disabled={busy}>Cancel</button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError('');
                  try {
                    await archive();
                    setAsking(false);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Couldn’t archive the tournament.');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {confirm.action}
              </button>
            </>
          )}
        >
          <p>{confirm.body}</p>
          {error && <p className={styles.error} role="alert">{error}</p>}
        </KitDialog>
      )}
    </div>
  );
}
