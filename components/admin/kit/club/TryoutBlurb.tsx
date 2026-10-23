'use client';
/**
 * "From the club" — the tryout blurb's editor, in the admin Tryouts page's Sign-ups section (Club Tier Stage 4c-2, Asks 8–11;
 * words CLUB_TIER_STAGE4C2_COPY.md E1–E10).
 *
 * It AUTOSAVES with the house floating pill and sends nothing: the blurb is read when a parent opens the page, like the About
 * text (decision "edit autosaves, create asks"; the one held exception is a change that tells families). A four-line box that
 * grows, 500 characters, the counter at the left under it, the amber past-year hint above the counter (birth years are never
 * flagged). The hint line says when families read it — the tryout page shows the blurb while open AND while not open yet,
 * never once finished or closed. A new season starts blank, with one door under the empty box when last season had words.
 *
 * On a laptop-wide row it also draws "How families see it" beside the box (TryoutBlurbPreview): the public page itself, fed
 * the words as typed. Where that preview already says when families read the words, this sentence steps aside.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { SavePill, repKit } from './RepKit';
import ck from './ClubKit.module.css';
import styles from './BornYears.module.css';
import pv from './TryoutBlurbPreview.module.css';
import TryoutBlurbPreview, { type BlurbPreviewFacts } from './TryoutBlurbPreview';
import { previewStateOf } from '@/lib/tryout-blurb-preview';
import { PastYearLine } from './BornYears';
import { useRecordAutosave } from '@/components/coaches/useRecordAutosave';
import { pastYearHint } from '@/lib/past-year-hint';
import { TRYOUT_BLURB_MAX } from '@/lib/program-year-patch';

/** Characters as the server and Postgres count them: code points, so an emoji is one, not two. */
const countChars = (t: string) => Array.from(t).length;
const clampChars = (t: string, max: number) => (countChars(t) > max ? Array.from(t).slice(0, max).join('') : t);

const PLACEHOLDER = 'What it costs, who can try out, what to bring and when families hear back.';

/** When families read the words (E4, E5): the sentence follows the page's three states. */
export function blurbReadHint(open: boolean, daysAhead: number | null): string | null {
  if (open) return 'Families read this on the tryout page, above Sign up for tryouts, before and while sign-ups are open.';
  if (daysAhead == null) return null; // not known yet: say nothing rather than the wrong sentence
  return daysAhead > 0
    ? 'Families read this on the tryout page now, with your tryout days. Sign-ups aren’t open yet.'
    : 'Families read this once a tryout day is coming up, and while sign-ups are open. Right now the page doesn’t show it.';
}

export default function TryoutBlurb({ yearApi, orgSlug, saved, open, previous, canWrite, onSaved, preview }: {
  /** `/api/admin/rep-teams/teams/{id}/program-years/{seasonId}` — the season's own route. */
  yearApi: string;
  orgSlug: string;
  /** What the season holds now. */
  saved: string | null;
  /** Sign-ups are open. */
  open: boolean;
  /** The previous season's blurb, or null when it had none (the door is then absent). */
  previous: string | null;
  canWrite: boolean;
  onSaved: (text: string | null) => void;
  /** What the preview beside the box needs of the team and its season; omitted, there is no preview. */
  preview?: BlurbPreviewFacts;
}) {
  const q = `orgSlug=${encodeURIComponent(orgSlug)}`;
  const [text, setText] = useState(saved ?? '');
  const [daysAhead, setDaysAhead] = useState<number | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const sig = text.trim();

  // Tryout days still to come — the closed-state hint's two honest sentences (E5). Read from the season's own summary.
  useEffect(() => {
    let cancelled = false;
    void fetch(`${yearApi}?${q}&include=tryoutDays`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled && d?.summary) setDaysAhead(Number(d.summary.tryoutDaysAhead) || 0); })
      .catch(() => { /* the hint stays quiet */ });
    return () => { cancelled = true; };
  }, [yearApi, q]);

  const write = useCallback(async (signal: AbortSignal) => {
    const body = text.trim() || null;
    const res = await fetch(`${yearApi}?${q}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tryoutDescription: body }), signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? 'Couldn’t save');
    onSaved(body);
  }, [text, yearApi, q, onSaved]);

  const { saving, dirty, saveError, touch, handleSave } = useRecordAutosave({
    enabled: canWrite, loading: false, sig, blocked: null, write, failText: 'Couldn’t save',
  });

  // Leaving inside the 0.9 s debounce sends what is pending, as Team details does.
  const pending = useRef({ dirty, handleSave });
  useEffect(() => { pending.current = { dirty, handleSave }; }, [dirty, handleSave]);
  useEffect(() => () => { if (pending.current.dirty) void pending.current.handleSave(); }, []);

  // A four-line box that grows with its words.
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  // The cap is enforced here by code points (not the textarea's UTF-16 maxLength): typing and pasting stop quietly at the limit (E3).
  const change = (v: string) => { setText(clampChars(v, TRYOUT_BLURB_MAX)); touch(); };
  const yearHint = pastYearHint(text, new Date().getFullYear());
  const readHint = blurbReadHint(open, daysAhead);
  const n = countChars(text);
  const previewState = preview ? previewStateOf(open, daysAhead) : null;
  // The preview says "when" for the open and the closed page; only "not open yet" has a sentence the picture cannot show.
  const hintYields = previewState != null && previewState !== 'notOpenYet';

  return (
    <>
      <div className={pv.host}>
        <div className={pv.row}>
          <div className={`${ck.field} ${styles.blurbField}`}>
            <label htmlFor="tryout-blurb" className={ck.label}>From the club</label>
            <textarea
              id="tryout-blurb"
              ref={areaRef}
              className={`${ck.textarea} ${styles.blurbBox}`}
              rows={4}
              value={text}
              placeholder={PLACEHOLDER}
              disabled={!canWrite}
              aria-describedby="tryout-blurb-hint"
              onChange={e => change(e.target.value)}
            />
            {canWrite && !text && previous && (
              <button type="button" className={styles.door} onClick={() => change(previous)}>Start from last season’s words</button>
            )}
            <div id="tryout-blurb-hint" className={styles.stack}>
              {readHint && <p className={`${ck.hint}${hintYields ? ` ${pv.hideWithPreview}` : ''}`}>{readHint}</p>}
              {yearHint && <PastYearLine>{yearHint}</PastYearLine>}
              <p className={styles.counter}>
                <span aria-hidden>{n} / {TRYOUT_BLURB_MAX}</span>
                <span className={repKit.srOnly} aria-live="polite" aria-atomic>{n} of {TRYOUT_BLURB_MAX} characters</span>
              </p>
            </div>
          </div>
          {preview && previewState && <TryoutBlurbPreview state={previewState} text={text} {...preview} />}
        </div>
      </div>
      {canWrite && <SavePill saving={saving} dirty={dirty} error={saveError || null} onRetry={() => void handleSave()} />}
    </>
  );
}
