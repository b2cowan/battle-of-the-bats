'use client';
import { useState } from 'react';
import styles from '../family.module.css';
import { FAMILY_HOME_WORDS } from '@/lib/family-home-words';
import ConfirmButton from './ConfirmButton';

const W = FAMILY_HOME_WORDS.calendar;

/**
 * "Your calendar" (Signed-in family accounts Stage 4a, Part 7; drawing 6.2): ONE address for every team the parent's children
 * are on. Make my link, then the address with Copy and Stop this calendar (asks once). The address is shown again on every
 * visit (it is signed, lib/family-calendar.ts), so there is no "New link": Stop ends it, and making one later gives a new one.
 * It sits on the family list, or on the team page for a parent with one team.
 */
export default function FamilyCalendarCard({ initialUrl }: { initialUrl: string | null }) {
  const [url, setUrl] = useState(initialUrl);
  const [making, setMaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function call(action: 'make' | 'stop'): Promise<Response> {
    return fetch('/api/family/calendar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
    });
  }

  async function make() {
    if (making) return;
    setMaking(true);
    setError(null);
    try {
      const res = await call('make');
      const data = await res.json().catch(() => ({}));
      if (res.status === 503) throw new Error(W.notSetUp);
      if (!res.ok || typeof data.url !== 'string') throw new Error(W.failed);
      setUrl(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : W.failed);
    } finally {
      setMaking(false);
    }
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>{W.title}</h2>
      {url ? (
        <>
          <p className={styles.notice} style={{ marginTop: 0 }}>{W.leadMade}</p>
          <p className={styles.rowSub}>{W.howTo}</p>
          <div className={styles.calendarUrl}>{url}</div>
          <div className={styles.buttonRow}>
            <button type="button" className={styles.chipGhost} onClick={copy}>{copied ? W.copied : W.copy}</button>
            <ConfirmButton
              label={W.stop}
              title={W.stop}
              body={W.stopAsk}
              confirmLabel={W.stopConfirm}
              cancelLabel={FAMILY_HOME_WORDS.leave.cancel}
              busyLabel={W.stopping}
              failedText={W.failed}
              onConfirm={async () => {
                const res = await call('stop');
                if (res.ok) setUrl(null);
                return res.ok;
              }}
            />
          </div>
          <p className={styles.acceptHint}>{W.keepPrivate}</p>
        </>
      ) : (
        <div className={styles.calendarRow} style={{ paddingTop: 0 }}>
          <span>{W.lead}</span>
          <button type="button" className={styles.calendarButton} onClick={make} disabled={making}>
            {making ? W.making : W.make}
          </button>
        </div>
      )}
      {error && <p className={styles.error} role="alert">{error}</p>}
    </div>
  );
}
