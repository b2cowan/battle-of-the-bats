'use client';
/**
 * THE BANNER OF THE FAMILIES NOT YET TOLD (House League team-change emails, TC·2; drawings tab 1 and tab 6). Directly under
 * the published notice: the shipped warn Callout with its two buttons at the right (under the words on a phone, the
 * Callout's own action rule). It stays until someone acts: no timer, no auto-send, no prompt on leaving. It renders nothing
 * at zero, and nothing for anyone who cannot run the division (the registrar never sees it).
 */
import { Callout } from '../../RepKit';
import { TC_BANNER } from '@/lib/house-league-team-changes-words';

export default function TeamChangesBanner({ families, children, canRun, onReview, onSkip }: {
  /** Families not yet told. */
  families: number;
  /** Children in them, for the "new team(s)" in the words. */
  children: number;
  canRun: boolean;
  onReview: () => void;
  onSkip: () => void;
}) {
  if (!canRun || families <= 0) return null;
  return (
    <Callout tone="warn" role="status" action={(
      <>
        <button type="button" className="btn btn-outline" onClick={onSkip}>{TC_BANNER.skip}</button>
        <button type="button" className="btn btn-lime" onClick={onReview}>{TC_BANNER.review}</button>
      </>
    )}>
      <b>{TC_BANNER.title(families)}</b>
      <span>{' '}{TC_BANNER.sub(families, children)}</span>
    </Callout>
  );
}
