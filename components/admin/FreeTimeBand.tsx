'use client';
/**
 * Free time on the customer's Plan & billing page (Support console Stage 4, owner ruling Q8; drawings D1–D3): the band
 * Founding Season already wears — eyebrow, icon box, headline, one sentence — in three tones: olive while it runs, amber
 * in the last 14 days, plain for 30 days after it ends. Both billing pages (the tournament page and Club's) render it from
 * the same words (`lib/free-time-copy.ts`). The page is told only the plan, the last free day and the plan it goes back
 * to (`/api/admin/org/free-time`), never the reason or who gave it.
 */
import { useEffect, useState } from 'react';
import { Check, Flag, Gift } from 'lucide-react';
import type { CustomerFreeTime } from '@/lib/free-time';
import type { FreeTimeCopy } from '@/lib/free-time-copy';
import styles from './FreeTimeBand.module.css';

export type CustomerFreeTimeState = { freeTime: CustomerFreeTime | null; overLimitAfter: boolean; foundingThrough: string | null } | null;

/** The customer's free time for this club, or null (none, or not read yet). */
export function useCustomerFreeTime(orgSlug: string | null | undefined): CustomerFreeTimeState {
  const [state, setState] = useState<CustomerFreeTimeState>(null);
  useEffect(() => {
    if (!orgSlug) return;
    let live = true;
    fetch(`/api/admin/org/free-time?orgSlug=${encodeURIComponent(orgSlug)}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (live && data) {
          setState({
            freeTime: (data.freeTime ?? null) as CustomerFreeTime | null,
            overLimitAfter: data.overLimitAfter === true,
            foundingThrough: typeof data.foundingThrough === 'string' ? data.foundingThrough : null,
          });
        }
      })
      .catch(() => {});
    return () => { live = false; };
  }, [orgSlug]);
  return state;
}

export default function FreeTimeBand({ band }: { band: FreeTimeCopy['band'] }) {
  const Icon = band.tone === 'amber' ? Flag : band.tone === 'plain' ? Check : Gift;
  const tone = band.tone === 'amber' ? styles.amber : band.tone === 'plain' ? styles.plain : '';
  return (
    <div className={`${styles.band} ${tone}`}>
      <div className={styles.icon}><Icon size={16} aria-hidden /></div>
      <div className={styles.body}>
        <p className={styles.eyebrow}>{band.eyebrow}</p>
        <h2 className={styles.title}>{band.title}</h2>
        <p className={styles.copy}>
          {band.phoneText ? <><span className={styles.desk}>{band.text}</span><span className={styles.phone}>{band.phoneText}</span></> : band.text}
        </p>
      </div>
    </div>
  );
}
