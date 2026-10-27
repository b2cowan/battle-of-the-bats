'use client';
/**
 * Health > Sent emails: every account email we sent and what happened to it (Support console Stage 5, drawing E3).
 *
 * The home for an address with no account (an invite that never arrived) and for "what bounced today?". It opens on the
 * newest emails; a search is a WHOLE address, sent in a POST body and never put in the page address (A3), and each one is
 * counted against the staff member's daily limit by the server. The address is never kept anywhere on this screen's way:
 * a row, an email window, and that is all. A row opens the same window as a person's Emails tab.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { consoleWhen } from '@/lib/console-dates';
import type { SentLogRow } from '@/lib/sent-log-view';
import {
  NO_EMAILS_IN_STATE, NO_EMAILS_TO_ADDRESS, NO_EMAILS_TO_ADDRESS_HINT, NO_EMAILS_YET, SENT_LOG_FAILED, SENT_LOG_FOOT,
  SENT_STATES, SENT_STATE_ORDER, looksLikeEmailAddress, type SentState,
} from '@/lib/sent-log-words';
import kit from '../console.module.css';
import { SentEmailWindow, SentWhat } from './SentParts';
import styles from './sent-emails.module.css';

type Props = { initialRows: SentLogRow[]; initialTotal: number; initialFailed: boolean; pageSize: number; openEmailId: string | null };

export default function SentEmailsClient({ initialRows, initialTotal, initialFailed, pageSize, openEmailId }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [words, setWords] = useState('');
  const [applied, setApplied] = useState('');
  const [state, setState] = useState<SentState | ''>('');
  const [offset, setOffset] = useState(0);
  const [failed, setFailed] = useState<string | null>(initialFailed ? SENT_LOG_FAILED : null);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(openEmailId);
  const first = useRef(true);
  const openedByLink = useRef(openEmailId !== null);
  // Only the newest read may land: an answer to older words that arrives late is dropped, never shown over the new one.
  const latest = useRef(0);

  const read = useCallback(async (to: string, s: SentState | '', o: number) => {
    const mine = ++latest.current;
    setLoading(true);
    try {
      const res = await fetch('/api/platform-admin/sent-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: to || null, state: s || null, offset: o }),
        cache: 'no-store',
      }).catch(() => null);
      const body = res ? await res.json().catch(() => null) : null;
      if (mine !== latest.current) return;
      if (!res || !res.ok || !body) {
        setFailed(typeof body?.error === 'string' ? body.error : SENT_LOG_FAILED);
        return;
      }
      setFailed(null);
      setApplied(to);
      setRows(body.rows);
      setTotal(body.total);
    } finally {
      if (mine === latest.current) setLoading(false);
    }
  }, []);

  // Only a WHOLE address is a search (and counts against the daily limit); half an address waits, and an empty box goes
  // back to the newest emails.
  const typed = words.trim().toLowerCase();
  const to = looksLikeEmailAddress(typed) ? typed : '';
  const waiting = typed !== '' && to === '';
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (waiting) return;
    const timer = window.setTimeout(() => { void read(to, state, offset); }, 450);
    return () => window.clearTimeout(timer);
  }, [to, waiting, state, offset, read]);

  const close = () => {
    setOpenId(null);
    // The window was opened by a link from Find: take its id out of the address again.
    if (openedByLink.current) { openedByLink.current = false; router.replace('/platform-admin/sent-emails'); }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.floor(offset / pageSize) + 1;

  return (
    <div className={kit.page}>
      <AdminPageHeader title="Sent emails" />

      <section className={kit.section}>
        <div className={kit.card}>
          <div className={kit.toolbar}>
            <span className={kit.count}>{total} {total === 1 ? 'email' : 'emails'}</span>
            <input
              type="text"
              inputMode="email"
              className={kit.search}
              value={words}
              onChange={e => { setWords(e.target.value); setOffset(0); }}
              placeholder="Search by whole email address"
              aria-label="Search by email address"
              maxLength={320}
              autoComplete="off"
              spellCheck={false}
            />
            <select
              className={kit.select}
              aria-label="Filter by what happened"
              value={state}
              onChange={e => { setState(e.target.value as SentState | ''); setOffset(0); }}
            >
              <option value="">Anything that happened</option>
              {SENT_STATE_ORDER.map(s => <option key={s} value={s}>{SENT_STATES[s].word}</option>)}
            </select>
            <span className={`${kit.chip} ${kit.chipQuiet}`}>Last 90 days</span>
          </div>

          {failed && <div className={`${kit.notice} ${kit.noticeBad}`} role="alert">{failed}</div>}

          <div className="table-cards">
            <table className={kit.comfortable} aria-busy={loading}>
              <thead>
                <tr><th>Sent</th><th>To</th><th>Email</th><th>Club</th><th>What happened</th><th aria-label="Open" /></tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className={kit.empty}>
                      {applied ? (
                        <>
                          <strong className={styles.emptyBold}>{NO_EMAILS_TO_ADDRESS}</strong>
                          <span className={styles.emptyHint}>{NO_EMAILS_TO_ADDRESS_HINT}</span>
                        </>
                      ) : state ? NO_EMAILS_IN_STATE : NO_EMAILS_YET}
                    </td>
                  </tr>
                )}
                {rows.map(r => (
                  <tr key={r.id} className={kit.clickableRow} onClick={() => setOpenId(r.id)}>
                    <td className={`${styles.when} table-cards-title`}>{consoleWhen(r.sentAt)}</td>
                    <td data-label="To">
                      {r.to}
                      {r.noAccount && <span className={kit.sub}>no account</span>}
                    </td>
                    <td data-label="Email">
                      <button type="button" className={styles.labelButton} onClick={e => { e.stopPropagation(); setOpenId(r.id); }}>{r.label}</button>
                    </td>
                    <td data-label="Club">{r.orgName ?? <span className={kit.muted}>None</span>}</td>
                    <td data-label="What happened"><SentWhat row={r} /></td>
                    <td className={kit.rowDoor} aria-hidden><ChevronRight size={14} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {total > pageSize && (
            <div className={styles.pager}>
              <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1 || loading} onClick={() => setOffset(o => Math.max(0, o - pageSize))}>← Prev</button>
              <span className={kit.countQuiet}>Page {page} of {totalPages}</span>
              <button type="button" className="btn btn-secondary btn-sm" disabled={page >= totalPages || loading} onClick={() => setOffset(o => o + pageSize)}>Next →</button>
            </div>
          )}
          <div className={kit.foot}><span className={kit.caption}>{SENT_LOG_FOOT}</span></div>
        </div>
      </section>

      {openId && <SentEmailWindow key={openId} id={openId} from="log" onClose={close} />}
    </div>
  );
}
