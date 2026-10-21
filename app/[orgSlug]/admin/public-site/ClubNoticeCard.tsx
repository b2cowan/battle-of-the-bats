'use client';
/**
 * THE CLUB NOTICE, POSTED (Club Tier Stage 4c-1, Ask 16; drawings ~L1956–1972; words CLUB_TIER_STAGE4C1_COPY.md §F).
 *
 * Unlike the rest of the editor it never saves as you type: it tells families something, so it waits for Post notice
 * (the 2026-10-09 exception to edit-autosaves — a change that tells families is held until confirmed). One at a time:
 * while one is showing, the card says so ("Showing now" and the line families read), Update notice posts the edit in its
 * place, End now takes it down. Ends tonight by default; never "forever".
 */
import { useMemo, useState } from 'react';
import { ClubSection, NoticePill } from '@/components/admin/kit/club/RepKit';
import { FormError, TextField } from '@/components/admin/kit/club/money/MoneyKit';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { NOTICE_DETAIL_MAX, NOTICE_MAX, noticeEndsAt, noticeIsShowing, noticeSmallLine, type NoticeEnds } from '@/lib/club-notice';
import { tournamentToday, utcToZonedInputs } from '@/lib/timezone';
import { PUBLIC_SITE_WORDS as W } from '@/lib/public-site-words';
import type { ClubNotice } from '@/lib/types';
import styles from './public-site.module.css';

type EndsKind = NoticeEnds['kind'];

/** The "Ends" a showing notice already has, so Update notice keeps it unless the club changes it. */
function currentEnds(n: ClubNotice | null, nowIso: string, today: string): { kind: EndsKind; date: string; time: string } {
  const fresh = { kind: 'tonight' as EndsKind, date: today, time: '20:00' };
  const same = (at: string | null) => !!at && Date.parse(at) === Date.parse(n?.endsAt ?? '');
  if (!n || same(noticeEndsAt({ kind: 'tonight' }, nowIso))) return fresh;
  if (same(noticeEndsAt({ kind: 'tomorrow' }, nowIso))) return { ...fresh, kind: 'tomorrow' };
  const at = utcToZonedInputs(n.endsAt);
  return { kind: 'at', date: at.date, time: at.time };
}

/** Owner and admin only: the page does not mount it for anyone else (copy table F). */
export default function ClubNoticeCard({ notice, orgSlug, onChange }: {
  notice: ClubNotice | null;
  orgSlug: string;
  onChange: (notice: ClubNotice | null) => void;
}) {
  // The club's today and the showing notice, read once per notice (not on every keystroke in the card).
  const { today, showing, smallLine } = useMemo(() => {
    const nowIso = new Date().toISOString();
    const live = notice && noticeIsShowing(notice, nowIso) ? notice : null;
    return { today: tournamentToday(), showing: live, smallLine: live ? noticeSmallLine(live, nowIso) : '' };
  }, [notice]);
  const [text, setText] = useState(showing?.notice ?? '');
  const [detail, setDetail] = useState(showing?.detail ?? '');
  const [start] = useState(() => currentEnds(showing, new Date().toISOString(), today));
  const [ends, setEnds] = useState<EndsKind>(start.kind);
  const [date, setDate] = useState(start.date);
  const [time, setTime] = useState(start.time);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field: string | null; text: string } | null>(null);
  const [told, setTold] = useState<string | null>(null);
  const query = `?orgSlug=${encodeURIComponent(orgSlug)}`;

  async function post() {
    if (busy) return;
    if (!text.trim()) { setError({ field: 'notice', text: W.noticeEmpty }); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/public-site/notice${query}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notice: text, detail, ends: ends === 'at' ? { kind: 'at', date, time } : { kind: ends } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError({ field: data.field ?? null, text: data.error ?? W.postFailed }); return; }
      setTold(showing ? W.updated : W.posted);
      onChange(data.notice as ClubNotice);
    } catch {
      setError({ field: null, text: W.postFailed });
    } finally {
      setBusy(false);
    }
  }

  async function endNow() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/public-site/notice${query}`, { method: 'DELETE' });
      if (!res.ok) { setError({ field: null, text: W.endFailed }); return; }
      setTold(W.ended);
      setText('');
      setDetail('');
      setEnds('tonight');
      onChange(null);
    } catch {
      setError({ field: null, text: W.endFailed });
    } finally {
      setBusy(false);
    }
  }

  const fieldError = (field: string) => error?.field === field ? <p className={styles.fieldError} role="alert">{error.text}</p> : null;

  return (
    <ClubSection id="notice" title={W.notice}>
      <p className={styles.lead}>{W.noticeLead}</p>
      {showing && (
        <div className={styles.noticeLive} role="status">
          <span className={styles.noticeLiveWord}>{W.showingNow}</span>
          <span className={styles.noticeLiveLine}>{showing.notice}</span>
          <span className={styles.noticeLiveSmall}>{smallLine}</span>
        </div>
      )}
      <TextField id="notice-text" label={W.noticeField} required value={text} maxLength={NOTICE_MAX} placeholder={W.noticePlaceholder}
        hint={`${text.length} / ${NOTICE_MAX}`} onChange={v => { setText(v); setError(null); }} />
      {fieldError('notice')}
      <label className={ck.field} htmlFor="notice-detail">
        <span className={ck.label}>{W.detailField}</span>
        <textarea id="notice-detail" className={ck.textarea} rows={2} value={detail} maxLength={NOTICE_DETAIL_MAX} placeholder={W.detailPlaceholder}
          onChange={e => { setDetail(e.target.value); setError(null); }} />
        <p className={ck.hint}>{detail.length} / {NOTICE_DETAIL_MAX}</p>
        {fieldError('detail')}
      </label>
      <label className={ck.field} htmlFor="notice-ends">
        <span className={ck.label}>{W.ends}</span>
        <select id="notice-ends" className={ck.select} value={ends} onChange={e => { setEnds(e.target.value as EndsKind); setError(null); }}>
          <option value="tonight">{W.endsTonight}</option>
          <option value="tomorrow">{W.endsTomorrow}</option>
          <option value="at">{W.endsPick}</option>
        </select>
      </label>
      {ends === 'at' && (
        <div className={styles.endsPick}>
          <label className={ck.field} htmlFor="notice-date">
            <span className={ck.label}>{W.endsDate}</span>
            <input id="notice-date" type="date" className={ck.input} value={date} min={today} onChange={e => { setDate(e.target.value); setError(null); }} />
          </label>
          <label className={ck.field} htmlFor="notice-time">
            <span className={ck.label}>{W.endsTime}</span>
            <input id="notice-time" type="time" className={ck.input} value={time} onChange={e => { setTime(e.target.value); setError(null); }} />
          </label>
        </div>
      )}
      {fieldError('ends')}
      {error && !error.field && <FormError inPlace>{error.text}</FormError>}
      <div className={styles.noticeButtons}>
        <button type="button" className="btn btn-lime" onClick={() => void post()} disabled={busy}>
          {busy ? W.posting : showing ? W.updateNotice : W.postNotice}
        </button>
        {showing && <button type="button" className="btn btn-outline" onClick={() => void endNow()} disabled={busy}>{W.endNow}</button>}
      </div>
      {told && <NoticePill message={told} onDone={() => setTold(null)} />}
    </ClubSection>
  );
}
