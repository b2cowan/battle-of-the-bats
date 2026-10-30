'use client';
/**
 * Free time on the customer's Plan & billing page (Support console Stage 4, owner ruling Q8; drawings D1–D3): the band
 * Founding Season already wears — eyebrow, icon box, headline, one sentence — in three tones: olive while it runs, amber
 * in the last 14 days, plain for 30 days after it ends. Both billing pages (the tournament page and Club's) render it from
 * the same words (`lib/free-time-copy.ts`). The page is told only the plan, the last free day and the plan it goes back
 * to (`/api/admin/org/free-time`), never the reason or who gave it.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Flag, Gift } from 'lucide-react';
import type { CustomerFreeTime } from '@/lib/free-time';
import type { FreeTimeCopy } from '@/lib/free-time-copy';
import type { PortalCustomerFreeTime } from '@/lib/portal-free-time';
import styles from './FreeTimeBand.module.css';

export type CustomerFreeTimeState = {
  freeTime: CustomerFreeTime | null;
  overLimitAfter: boolean;
  foundingThrough: string | null;
  /** A Coaches Portal's free time from staff (Stage 4b): its state and last free day only. */
  portal: PortalCustomerFreeTime | null;
  /** This viewer is the portal's own owner, the one person Keep Premium can attach a purchase for. */
  canKeepPremium: boolean;
} | null;

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
            portal: (data.portal ?? null) as PortalCustomerFreeTime | null,
            canKeepPremium: data.canKeepPremium === true,
          });
        }
      })
      .catch(() => {});
    return () => { live = false; };
  }, [orgSlug]);
  return state;
}

/**
 * `action` is the Premium Overview's one door (owner 2026-10-28): outlined, never lime, because that page already has its
 * one lime action. Left off, the band is the plain notice the billing pages show.
 */
export default function FreeTimeBand({ band, action }: { band: FreeTimeCopy['band']; action?: { label: string; href: string } }) {
  const Icon = band.tone === 'amber' ? Flag : band.tone === 'plain' ? Check : Gift;
  const tone = band.tone === 'amber' ? styles.amber : band.tone === 'plain' ? styles.plain : '';
  return (
    <div className={`${styles.band} ${tone} ${action ? styles.withAction : ''}`}>
      <div className={styles.icon}><Icon size={16} aria-hidden /></div>
      <div className={styles.body}>
        <p className={styles.eyebrow}>{band.eyebrow}</p>
        <h2 className={styles.title}>{band.title}</h2>
        <p className={styles.copy}>
          {band.phoneText ? <><span className={styles.desk}>{band.text}</span><span className={styles.phone}>{band.phoneText}</span></> : band.text}
        </p>
      </div>
      {action && <Link href={action.href} className={`btn btn-outline btn-sm ${styles.action}`}>{action.label}</Link>}
    </div>
  );
}
