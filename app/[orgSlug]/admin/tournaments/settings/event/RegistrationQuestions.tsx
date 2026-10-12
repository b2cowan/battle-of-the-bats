'use client';
/**
 * REGISTRATION QUESTIONS, IN THEIR CARD — Tournament admin redesign Stage 5 addendum (A74, owner 2026-10-12: "agree
 * with your recommendations"; F113). The questions had a page of their own, reached by "Manage questions →", whose
 * back link opened Settings & access and lit the wrong rail row, with no door back. They live in Event settings'
 * card now, the way Divisions, Venues and Rules & resources already work: the list on the page, each record in a
 * window over it — one layer.
 *
 *   the list    a row per question (its words; its type, choices, required or optional), each a door opening its
 *               record (QuestionRecord: reads first, the pencil edits it with autosave, Archive ends it and asks)
 *   order       the portal's reorder standard (ReorderList, a grip — the questions are not numbered): drag the
 *               handle, hold it on a phone, tap it for Move up · Move down · Cancel; each move saves
 *   adding      Add a question at the right of the card's first line, above the list it fills (the + alone on a
 *               phone); none yet: what every registration already collects, and Add a question
 *
 * The page's one floating pill says the order's save too (`useRegistrationQuestions` hands its state to the page), so
 * two saves never stack two pills in one corner. The plan gate is the page's (`custom_registration_fields`). The page
 * re-keys the list per event (a window open on the last event's question closes with it), and the list is memoized:
 * a closed card stays mounted, so typing elsewhere on the page must not redraw it.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { arrayMove } from '@dnd-kit/sortable';
import { ClubRow, ClubRowList, LoadFailed, useLatestRead } from '@/components/admin/kit/club/RepKit';
import { screenParts } from '@/components/admin/tournament/ScreenParts';
import { ReorderList, ReorderRow } from '@/components/admin/tournament/ReorderList';
import { useSaveQueue } from '@/components/admin/tournament/useSaveQueue';
import LoadingState from '@/components/shared/LoadingState';
import { ORDER_WORDS, QUESTION_WORDS as W, questionCaption } from '@/lib/tournament-settings-words';
import type { TournamentRegistrationField } from '@/lib/types';
import QuestionRecord from './QuestionRecord';
import styles from './questions.module.css';

export type RegistrationQuestions = ReturnType<typeof useRegistrationQuestions>;

/** The event's questions and their order's save — read once the card can show them (the plan includes them). */
export function useRegistrationQuestions(tournamentId: string | undefined, orgQuery: string, enabled: boolean) {
  // org-slug-ok: every call appends orgQuery (?orgSlug=…) to this base, the record's included.
  const apiBase = tournamentId ? `/api/admin/tournaments/${encodeURIComponent(tournamentId)}/registration-fields` : '';
  const [fields, setFields] = useState<TournamentRegistrationField[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  /** Re-reads the questions; false when they didn't load. Only the newest read writes (an event switched mid-read). */
  const begin = useLatestRead();
  const refresh = useCallback(async (): Promise<boolean> => {
    if (!apiBase || !enabled) return false;
    const current = begin();
    try {
      const res = await fetch(`${apiBase}${orgQuery}`, { cache: 'no-store' });
      const data = await res.json().catch(() => null) as { fields?: TournamentRegistrationField[] } | null;
      if (!current()) return false;
      if (!res.ok || !Array.isArray(data?.fields)) throw new Error('load');
      setFields(data.fields);
      setLoadError('');
      return true;
    } catch {
      if (current()) setLoadError(W.loadFailed);
      return false;
    } finally {
      if (current()) setLoading(false);
    }
  }, [apiBase, enabled, orgQuery, begin]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new event reads its own questions
    setLoading(true);
    void refresh();
  }, [refresh]);

  /** A failed read's Try again: the loading line, then the read. */
  const reload = useCallback(() => { setLoading(true); void refresh(); }, [refresh]);

  // Order: each move saves, one at a time (the last order is the one kept); the page's pill says so, Retry replays it.
  // The move reads the list through a ref, so the handle's callback is the same between renders.
  const { saving: orderSaving, error: orderError, run, retry: retryOrder } = useSaveQueue();
  const fieldsRef = useRef(fields);
  useEffect(() => { fieldsRef.current = fields; }, [fields]);
  const move = useCallback((from: number, to: number) => {
    const next = arrayMove(fieldsRef.current, from, to);
    setFields(next);
    const ids = next.map(f => f.id);
    void run(async () => {
      const res = await fetch(`${apiBase}${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reorder', fields: ids.map((id, sortOrder) => ({ id, sortOrder })) }),
      });
      if (!res.ok) throw new Error('reorder');
    }, ORDER_WORDS.saveFailed);
  }, [apiBase, orgQuery, run]);

  /** The card's summary: what it holds. Nothing while the list is still reading or didn't load. */
  const summary = loading || (loadError && fields.length === 0) ? undefined : W.summary(fields.length);

  const order = useMemo(() => ({ saving: orderSaving, error: orderError, retry: retryOrder }), [orderSaving, orderError, retryOrder]);
  return useMemo(
    () => ({ apiBase, fields, loading, loadError, refresh, reload, move, order, summary }),
    [apiBase, fields, loading, loadError, refresh, reload, move, order, summary],
  );
}

/** The card's body: the list, Add a question, and a question's window over Event settings. */
export const RegistrationQuestionsList = memo(function RegistrationQuestionsList({ q, orgQuery }: { q: RegistrationQuestions; orgQuery: string }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (q.loadError && q.fields.length === 0) return <LoadFailed title={q.loadError} onRetry={q.reload} />;
  if (q.loading) return <LoadingState label="Loading the questions…" />;

  const { fields } = q;
  const idx = openId && openId !== 'new' ? fields.findIndex(f => f.id === openId) : -1;
  const caption = (f: TournamentRegistrationField) => questionCaption(f.fieldType, f.options.length, f.required);
  const add = (
    <button type="button" className={`btn btn-outline ${screenParts.headerButton} ${styles.add}`} onClick={() => setOpenId('new')}
      aria-label={W.add} title={W.add} aria-haspopup="dialog">
      <Plus size={15} aria-hidden />
      <span className={screenParts.headerButtonLabel}>{W.add}</span>
    </button>
  );

  return (
    <>
      {fields.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>{W.none}</p>
          <p className={styles.emptyLine}>{W.noneLine}</p>
          <button type="button" className={`btn btn-outline ${styles.add}`} onClick={() => setOpenId('new')} aria-haspopup="dialog">
            <Plus size={15} aria-hidden /> {W.add}
          </button>
        </div>
      ) : (
        <>
          <div className={styles.head}>
            <p className={styles.lede}>{W.lede}</p>
            {add}
          </div>
          {/* Inset: the card paints the ground (one painter); the outline is the list's own. */}
          <div className={styles.outline}>
          <ClubRowList inset label={W.title}>
            <ReorderList ids={fields.map(f => f.id)} names={fields.map(f => f.label)} onMove={q.move} disabled={q.order.saving}>
              {fields.map(f => (
                <ReorderRow key={f.id} id={f.id}>
                  {({ handle, itemRef, itemStyle }) => (
                    <ClubRow as="button" aria-haspopup="dialog" onClick={() => setOpenId(f.id)} chevron
                      title={f.label} caption={caption(f)}
                      grip={handle} itemRef={itemRef} itemStyle={itemStyle} />
                  )}
                </ReorderRow>
              ))}
            </ReorderList>
          </ClubRowList>
          </div>
        </>
      )}

      {openId && (openId === 'new' || idx >= 0) && (
        <QuestionRecord
          question={openId === 'new' ? null : fields[idx]}
          apiBase={q.apiBase}
          orgQuery={orgQuery}
          canWrite
          prev={idx > 0 ? { id: fields[idx - 1].id, name: fields[idx - 1].label } : null}
          next={idx >= 0 && idx < fields.length - 1 ? { id: fields[idx + 1].id, name: fields[idx + 1].label } : null}
          position={`${idx + 1} of ${fields.length}`}
          onStep={setOpenId}
          onClose={() => setOpenId(null)}
          onChanged={q.refresh}
        />
      )}
    </>
  );
});
