'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Search } from 'lucide-react';
import { getSportPack, DEFAULT_SPORT, positionLabel } from '@/lib/sports';
import {
  visibleAskQuestions, askReportHref,
  type AskAnswer, type AskQuestionId,
} from '@/lib/coach-ask-questions';
import type { CoachCapabilities } from '@/lib/coach-capabilities';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * Ask the Front Office — the bar (Phase A).
 *
 * ⚠ **This must never look like a text input.** Phase A cannot accept typing, and a bar styled as
 * a search field invites a coach to tap it, type, and get nothing — the one interaction a feature
 * whose whole promise is honesty cannot afford. Hence the explicit "Choose a question" hint and a
 * chevron rather than a caret. Phase B drops the hint and the same bar becomes typeable, so the
 * coach relearns nothing.
 *
 * Collapsed at rest: the questions cost no page real estate until a coach asks for them (owner
 * ruling 2026-08-02). It expands IN PLACE rather than into a panel, because every receipt is a
 * link out to a report — a coach following one is meant to leave, and leaving from inside an
 * overlay returns them to a page they never saw change.
 *
 * Renders NOTHING when this coach's capabilities leave no questions to ask. A door onto an empty
 * room is worse than no door.
 */
export default function CoachAskBar({
  orgSlug, teamId, capabilities, sport,
}: {
  orgSlug: string;
  teamId: string;
  capabilities: CoachCapabilities;
  sport: string | null | undefined;
}) {
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const sportPack = useMemo(() => getSportPack(sport ?? DEFAULT_SPORT), [sport]);

  const questions = useMemo(() => visibleAskQuestions(capabilities, {
    hasPitcherPosition: !!sportPack.pitcherPosition,
    hasFieldPositions: sportPack.fieldPositions.length > 0,
  }), [capabilities, sportPack]);

  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<AskQuestionId | null>(null);
  /** Only a coach's explicit position tap. Kept apart from the server's choice below so echoing
   *  that choice back into state can't retrigger the fetch that produced it. */
  const [requestedPosition, setRequestedPosition] = useState<string | null>(null);
  const [resolvedPosition, setResolvedPosition] = useState<string | null>(null);
  /**
   * ONE status, not three flags. "Looking it up", "that failed" and "here is the answer" are
   * mutually exclusive, and as separate `loading`/`error`/`answer` pieces every call site had to
   * remember to clear the other two — which `pickPosition` didn't, so a failed position tap could
   * have left the previous answer on screen under a stale error.
   */
  const [result, setResult] = useState<
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'done'; answer: AskAnswer }
  >({ status: 'idle' });
  /** The in-flight request, so a fast second tap cancels the first rather than racing it. */
  const inFlight = useRef<AbortController | null>(null);

  /**
   * The selected question, looked up in the CURRENTLY-VISIBLE list — which makes this the
   * revocation guard too, with no effect and no cascading render.
   *
   * If a head coach revokes money access mid-session, the money chips vanish from `questions`,
   * `selected` becomes null, and the answer they produced stops rendering along with them. Without
   * that link the dues figures and family names would have sat on screen indefinitely, with no chip
   * left to replace or explain them — exactly what must not outlive the permission that revealed it.
   */
  const selected = questions.find(q => q.id === selectedId) ?? null;

  // Asking is caused by a TAP, not by state synchronisation, so it lives in the handler rather
  // than in an effect. The only effect is the unmount cleanup an abortable fetch needs.
  useEffect(() => () => inFlight.current?.abort(), []);

  const ask = useCallback((id: AskQuestionId, position: string | null) => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    setResult({ status: 'loading' });
    const qs = new URLSearchParams({ q: id });
    if (position) qs.set('position', position);
    fetch(`/api/coaches/${orgSlug}/teams/${teamId}/ask?${qs}`, { signal: controller.signal })
      .then(async res => {
        if (!res.ok) {
          // A refusal is not a glitch. The route explains WHY a question is off-limits ("ask your
          // head coach"), and telling that coach to "try again" would send them round a loop that
          // can never succeed — so the server's own words are surfaced for a deliberate refusal.
          const body = await res.json().catch(() => null);
          const err = new Error(String(res.status));
          if ((res.status === 403 || res.status === 404) && body?.error) err.message = body.error;
          else err.message = '';
          throw err;
        }
        return res.json();
      })
      .then(data => {
        if (controller.signal.aborted) return;
        if (data.position) setResolvedPosition(data.position);
        setResult(data.answer
          ? { status: 'done', answer: data.answer }
          : { status: 'error', message: 'That answer couldn’t be loaded just now. Try again.' });
      })
      .catch(err => {
        if (controller.signal.aborted || (err as Error)?.name === 'AbortError') return;
        // A failed fetch is an ERROR, never an honest empty — that difference is the whole promise.
        setResult({
          status: 'error',
          message: (err as Error)?.message || 'That answer couldn’t be loaded just now. Try again.',
        });
      });
  }, [orgSlug, teamId]);

  const pick = useCallback((id: AskQuestionId) => {
    setSelectedId(id);
    setRequestedPosition(null);
    setResolvedPosition(null);
    ask(id, null);
  }, [ask]);

  const pickPosition = useCallback((code: string) => {
    if (!selectedId) return;
    setRequestedPosition(code);
    ask(selectedId, code);
  }, [ask, selectedId]);

  if (questions.length === 0) return null;

  const showPositions = !!selected?.needsPosition;

  return (
    <div className={styles.askGroup}>
      <button
        type="button"
        className={styles.askBar}
        aria-expanded={open}
        aria-controls="coach-ask-panel"
        onClick={() => setOpen(o => !o)}
      >
        <Search size={17} className={styles.askBarIcon} aria-hidden />
        <span className={styles.askBarLabel}>Ask about your team</span>
        <span className={styles.askBarHint}>
          <span className={styles.askBarHintText}>Choose a question</span>
          <ChevronDown size={15} className={styles.askBarChev} aria-hidden />
        </span>
      </button>

      <div className={styles.askPanel} id="coach-ask-panel" hidden={!open}>
        <div className={styles.askChips} role="group" aria-label="Questions you can ask">
          {questions.map(q => (
            <button
              key={q.id}
              type="button"
              className={styles.askChip}
              aria-pressed={selectedId === q.id}
              onClick={() => pick(q.id)}
            >
              {q.label}
            </button>
          ))}
        </div>

        {showPositions && (
          <div className={styles.askPosRow} role="group" aria-label="Position">
            <span className={styles.askPosLabel}>Position</span>
            {sportPack.fieldPositions.map(code => (
              <button
                key={code}
                type="button"
                className={styles.askPosChip}
                aria-pressed={(requestedPosition ?? resolvedPosition) === code}
                title={positionLabel(sportPack, code)}
                onClick={() => pickPosition(code)}
              >
                {code}
              </button>
            ))}
          </div>
        )}

        {(!selected || result.status === 'idle') && (
          <p className={styles.askIdle}>
            Tap a question. Every answer is put together from what you’ve recorded, with the records
            it used shown underneath.
          </p>
        )}

        {selected && result.status === 'loading' && <p className={styles.askIdle} role="status">Looking it up…</p>}

        {selected && result.status === 'error' && (
          <p className={styles.askError} role="status">{result.message}</p>
        )}

        {selected && result.status === 'done' && (() => {
          const { answer } = result;
          return (
          // A live region, because the loading text that WAS one gets unmounted when the answer
          // replaces it — without this a screen-reader user hears "Looking it up…" and then
          // silence, with no signal that the answer they asked for has arrived.
          <div className={styles.askAnswer} role="status" aria-live="polite">
            <p className={styles.askSentence}>{answer.sentence}</p>
            <p className={styles.askReceiptsLabel}>{answer.receiptsLabel}</p>
            {answer.receipts.map((r, i) => (
              <div key={i} className={styles.askReceipt}>
                <span className={styles.askReceiptText}>{r.text}</span>
                {r.to ? (
                  <Link className={styles.askReceiptLink} href={askReportHref(base, r.to)}>
                    Go there →
                  </Link>
                ) : (
                  r.meta && <span className={styles.askReceiptMeta}>{r.meta}</span>
                )}
              </div>
            ))}
            <p className={styles.askFoot}>
              Assembled from your own records — never a guess, never outside data.
            </p>
            {!answer.empty && (
              <Link className={styles.askFullReport} href={askReportHref(base, answer.report)}>
                See the full report →
              </Link>
            )}
          </div>
          );
        })()}
      </div>
    </div>
  );
}
