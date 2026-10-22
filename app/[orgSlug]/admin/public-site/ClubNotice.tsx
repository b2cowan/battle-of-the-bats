'use client';
/**
 * THE CLUB NOTICE — one strip at the top of the editor; Post and Edit open the window (Public site builder A7, ruled
 * 2026-10-21; the notice itself Club Tier Stage 4c-1, Ask 16).
 *
 * The strip is the thing a volunteer opens the editor for on a rain night, so it stands first and says what families see
 * right now: "Showing now", the line, when it ends — with Edit and End now beside it; with none showing, Post a notice.
 * Shown only while the site is online (with the site off there is no one to tell).
 *
 * The window never saves as you type: a notice tells families something, so it waits for Post notice (the 2026-10-09
 * exception to edit-autosaves). Update notice posts an edit in its place; End now takes it down. Ends tonight by default;
 * never "forever". Owner and admin only — the page does not mount it for anyone else.
 */
import { useMemo, useState } from 'react';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { NoticePill } from '@/components/admin/kit/club/RepKit';
import { TextField } from '@/components/admin/kit/club/money/MoneyKit';
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

export default function ClubNoticeStrip({ notice, orgSlug, onChange, open, onOpen, onClose }: {
  notice: ClubNotice | null;
  orgSlug: string;
  onChange: (notice: ClubNotice | null) => void;
  /** The window, held by the page so a click on the notice in the preview can open it (A9). */
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const { showing, smallLine } = useMemo(() => {
    const nowIso = new Date().toISOString();
    const live = notice && noticeIsShowing(notice, nowIso) ? notice : null;
    return { showing: live, smallLine: live ? noticeSmallLine(live, nowIso) : '' };
  }, [notice]);
  const [busy, setBusy] = useState(false);
  const [told, setTold] = useState<string | null>(null);
  const [endError, setEndError] = useState<string | null>(null);
  const query = `?orgSlug=${encodeURIComponent(orgSlug)}`;

  async function endNow() {
    if (busy) return;
    setBusy(true);
    setEndError(null);
    try {
      const res = await fetch(`/api/admin/public-site/notice${query}`, { method: 'DELETE' });
      if (!res.ok) { setEndError(W.endFailed); return; }
      setTold(W.ended);
      onChange(null);
    } catch {
      setEndError(W.endFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`${styles.noticeStrip}${showing ? ` ${styles.noticeStripLive}` : ''}`} aria-labelledby="notice-strip-title" id="notice">
      <div className={styles.noticeStripText}>
        <h2 id="notice-strip-title" className={styles.noticeStripWord}>
          {W.notice}{showing && <> · {W.showingNow}</>}
        </h2>
        {showing ? (
          <>
            <p className={styles.noticeStripLine}>{showing.notice}</p>
            <p className={styles.noticeStripSmall}>{smallLine}</p>
          </>
        ) : (
          <p className={styles.noticeStripSmall}>{W.noticeNone} {W.noticeLead}</p>
        )}
        {endError && <p className={styles.fieldError} role="alert">{endError}</p>}
      </div>
      <div className={styles.noticeStripButtons}>
        {showing ? (
          <>
            <button type="button" className="btn btn-outline btn-data" onClick={onOpen} aria-haspopup="dialog" disabled={busy}>{W.editNotice}</button>
            <button type="button" className="btn btn-outline btn-data" onClick={() => void endNow()} disabled={busy}>{W.endNow}</button>
          </>
        ) : (
          <button type="button" className="btn btn-outline btn-data" onClick={onOpen} aria-haspopup="dialog">{W.postANotice}</button>
        )}
      </div>
      {open && (
        <NoticeWindow
          showing={showing}
          query={query}
          onClose={onClose}
          onPosted={(n, word) => { setTold(word); setEndError(null); onChange(n); onClose(); }}
        />
      )}
      {told && <NoticePill message={told} onDone={() => setTold(null)} />}
    </section>
  );
}

function NoticeWindow({ showing, query, onClose, onPosted }: {
  showing: ClubNotice | null;
  query: string;
  onClose: () => void;
  onPosted: (notice: ClubNotice, word: string) => void;
}) {
  const [today] = useState(() => tournamentToday());
  const [start] = useState(() => currentEnds(showing, new Date().toISOString(), today));
  const [text, setText] = useState(showing?.notice ?? '');
  const [detail, setDetail] = useState(showing?.detail ?? '');
  const [ends, setEnds] = useState<EndsKind>(start.kind);
  const [date, setDate] = useState(start.date);
  const [time, setTime] = useState(start.time);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field: string | null; text: string } | null>(null);

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
      onPosted(data.notice as ClubNotice, showing ? W.updated : W.posted);
    } catch {
      setError({ field: null, text: W.postFailed });
    } finally {
      setBusy(false);
    }
  }

  const fieldError = (field: string) => error?.field === field ? <p className={styles.fieldError} role="alert">{error.text}</p> : null;

  return (
    <KitDialog
      kind="form"
      title={showing ? W.editNoticeTitle : W.postANotice}
      onClose={onClose}
      busy={busy}
      footerStart={error && !error.field ? <span role="alert">{error.text}</span> : undefined}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>{W.cancel}</button>
          <button type="button" className="btn btn-lime" onClick={() => void post()} disabled={busy}>
            {busy ? W.posting : showing ? W.updateNotice : W.postNotice}
          </button>
        </>
      }
    >
      <p className={styles.lead}>{W.noticeLead}</p>
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
    </KitDialog>
  );
}
