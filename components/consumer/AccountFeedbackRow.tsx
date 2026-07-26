'use client';
/**
 * components/consumer/AccountFeedbackRow.tsx — "Send feedback" as a warm Account-tab
 * settings row (A2, 2026-07-25: the free coach portal's "More" sheet retired; its account
 * utilities live on the Account tab now). Opens the shared FeedbackWidget in place.
 */
import { useState } from 'react';
import { MessageSquarePlus, ChevronRight } from 'lucide-react';
import FeedbackWidget from '@/components/feedback/FeedbackWidget';
import styles from '@/app/(consumer)/account/account.module.css';

export default function AccountFeedbackRow() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className={styles.row} onClick={() => setOpen(true)}>
        <span className={styles.rowIcon}><MessageSquarePlus size={19} aria-hidden /></span>
        <span className={styles.rowLabel}>Send feedback</span>
        <ChevronRight size={18} className={styles.rowChevron} aria-hidden />
      </button>
      <FeedbackWidget open={open} onClose={() => setOpen(false)} />
    </>
  );
}
