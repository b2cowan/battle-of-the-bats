'use client';
import { X } from 'lucide-react';
import { duesReminderEmail } from '@/lib/dues-reminder-email';
import { tournamentToday, addCalendarDays } from '@/lib/timezone';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * "See an example" — the reminder schedule and a rendered sample of the email.
 *
 * The sample is built by the SAME template every sender uses, so what a coach reads here is
 * what a family receives; a hand-written sample would drift the first time the wording
 * changed. The two sample rows show both cases: untouched, and part-paid with the thank-you.
 *
 * Shared because the Automatic Dues Reminders switch moved to Team settings → Money while the
 * dues page kept its own door to this explanation. A second copy of the email preview is a
 * second thing to update when the schedule or the template changes.
 */
export default function DuesReminderPreviewModal({
  teamName,
  onClose,
}: {
  teamName: string;
  onClose: () => void;
}) {
  const sampleDue = addCalendarDays(tournamentToday(), 30);
  const sample = duesReminderEmail({
    teamName: teamName || 'your team',
    window: 30,
    guardianFirst: 'Jordan',
    items: [
      { playerFirstName: 'Alex', playerLastName: 'Rivera', amount: 300, remainingAmount: 300, dueDate: sampleDue, installmentNumber: 2, totalInstallments: 4 },
      // One row shows the part-payment thank-you, the other the fundraising line — the
      // two sentences this template exists to get right.
      { playerFirstName: 'Sam', playerLastName: 'Rivera', amount: 300, remainingAmount: 100, creditApplied: 120, creditNote: 'Bottle Drive', dueDate: sampleDue, installmentNumber: 2, totalInstallments: 4 },
    ],
  });

  return (
    <div className={styles.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget) (onClose)?.(); }}>
      <div className={styles.modal} style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span style={{ fontWeight: 700, color: 'var(--home-ink, rgba(255,255,255,0.9))' }}>Dues reminder emails</span>
          <button className={styles.modalCloseBtn} aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div style={{ fontSize: '0.83rem', color: 'var(--home-ink-soft, rgba(255,255,255,0.7))', display: 'flex', flexDirection: 'column', gap: '0.45rem', marginBottom: '1rem' }}>
          <p style={{ margin: 0 }}>
            <strong>When they go out:</strong> with Automatic Dues Reminders on, each family is emailed
            about an unpaid installment <strong>30 days</strong> before its due date and again
            <strong> 7 days</strong> before — one email per family per wave, never twice in the same week.
          </p>
          <p style={{ margin: 0 }}>
            {/* ⚠ These two buttons live on the Dues page, and this modal now opens from Team
                settings as well — so they are named by WHERE they are, not "above the table". */}
            <strong>Send Due Reminders</strong> on the Dues page emails right now about anything past
            due or due in the next 3 days. The <strong>Remind all</strong> button on the chase card is
            separate — it only ever writes to families with no payment recorded at all.
          </p>
          <p style={{ margin: 0 }}>
            Emails ask only for <strong>what&apos;s still owing</strong> — a family part-way through paying
            is thanked for what&apos;s arrived, never billed the full amount again.
          </p>
        </div>

        <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--home-line, rgba(255,255,255,0.12))', background: 'white' }}>
          <div style={{ padding: '0.5rem 0.9rem', borderBottom: '1px solid var(--home-line, rgba(0,0,0,0.08))', fontSize: '0.75rem', color: 'black', opacity: 0.55 }}>
            Subject: {sample.subject}
          </div>
          {/* The template's own inline styles carry the email's look; colours here only
              ground it on the white "email client" card. */}
          <div style={{ color: 'black', fontSize: '0.85rem' }} dangerouslySetInnerHTML={{ __html: sample.html }} />
        </div>
        <p className={styles.muted} style={{ fontSize: '0.72rem', margin: '0.5rem 0 0' }}>
          Sample family and amounts — real emails use your roster&apos;s names, figures and due dates.
        </p>
      </div>
    </div>
  );
}
