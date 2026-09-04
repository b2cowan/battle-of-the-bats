'use client';
import { X } from 'lucide-react';
import { duesReminderEmail } from '@/lib/dues-reminder-email';
import { tournamentToday, addCalendarDays } from '@/lib/timezone';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * "See an example" / "See what they'll receive" — the reminder schedule and a rendered sample of
 * the email.
 *
 * The sample is built by the SAME template every sender uses, so what a coach reads here is
 * what a family receives; a hand-written sample would drift the first time the wording
 * changed. The two sample rows show both cases: untouched, and part-paid with the thank-you.
 *
 * Shared because the Automatic Dues Reminders switch moved to Team settings → Money while the
 * dues page kept its own door to this explanation. A second copy of the email preview is a
 * second thing to update when the schedule or the template changes.
 *
 * ⚠ TWO VARIANTS, ONE TEMPLATE (owner D3, 2026-09-04). The template writes a different subject
 * line and a different sentence for the coach's on-demand send ("Player dues outstanding", "was
 * due September 1") than for the automatic 30/7-day waves ("Upcoming dues reminder (30 days)",
 * "due September 1"). The Send-due-reminders confirmation opens this modal to show a coach what
 * THAT send says, so it must render the on-demand variant — a family reading a "was due" email
 * after the coach previewed a "coming due" one has been shown the wrong letter.
 */
export default function DuesReminderPreviewModal({
  teamName,
  variant = 'wave',
  onClose,
}: {
  teamName: string;
  /** `'wave'` — the automatic 30-day notice (Team settings' "See an example"). `'onDemand'` —
   *  the coach's Send-due-reminders email, with an overdue row and its own subject line. */
  variant?: 'wave' | 'onDemand';
  onClose: () => void;
}) {
  const today = tournamentToday();
  const onDemand = variant === 'onDemand';
  // One call to the one template; only the window and the two sample rows differ by variant.
  const sample = duesReminderEmail({
    teamName: teamName || 'your team',
    guardianFirst: 'Jordan',
    window: onDemand ? null : 30,
    items: onDemand
      ? [
        // One overdue row, one part-paid row due inside the 3-day window — the two sentences the
        // on-demand send exists to get right: "was due", and the thank-you for what arrived.
        { playerFirstName: 'Alex', playerLastName: 'Rivera', amount: 300, remainingAmount: 300, dueDate: addCalendarDays(today, -5), installmentNumber: 2, totalInstallments: 4, overdue: true },
        { playerFirstName: 'Sam', playerLastName: 'Rivera', amount: 300, remainingAmount: 100, creditApplied: 120, creditNote: 'Bottle Drive', dueDate: addCalendarDays(today, 2), installmentNumber: 2, totalInstallments: 4 },
      ]
      : [
        { playerFirstName: 'Alex', playerLastName: 'Rivera', amount: 300, remainingAmount: 300, dueDate: addCalendarDays(today, 30), installmentNumber: 2, totalInstallments: 4 },
        // One row shows the part-payment thank-you, the other the fundraising line — the
        // two sentences this template exists to get right.
        { playerFirstName: 'Sam', playerLastName: 'Rivera', amount: 300, remainingAmount: 100, creditApplied: 120, creditNote: 'Bottle Drive', dueDate: addCalendarDays(today, 30), installmentNumber: 2, totalInstallments: 4 },
      ],
  });

  return (
    <div className={styles.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget) (onClose)?.(); }}>
      <div className={styles.modal} style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span style={{ fontWeight: 700, color: 'var(--home-ink, rgba(255,255,255,0.9))' }}>
            {onDemand ? 'What families will receive' : 'Dues reminder emails'}
          </span>
          <button className={styles.modalCloseBtn} aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div style={{ fontSize: '0.83rem', color: 'var(--home-ink-soft, rgba(255,255,255,0.7))', display: 'flex', flexDirection: 'column', gap: '0.45rem', marginBottom: '1rem' }}>
          {onDemand ? (
            <p style={{ margin: 0 }}>
              <strong>Send due reminders</strong> emails every family with an installment that is past
              due or due in the next 3 days — one email per family, listing only those installments.
              Anything already past its date is marked <strong>was due</strong>.
            </p>
          ) : (
            <>
              <p style={{ margin: 0 }}>
                <strong>When they go out:</strong> with Automatic Dues Reminders on, each family is emailed
                about an unpaid installment <strong>30 days</strong> before its due date and again
                <strong> 7 days</strong> before — one email per family per wave, never twice in the same week.
              </p>
              <p style={{ margin: 0 }}>
                {/* ⚠ These sends live on the Dues page and this modal now opens from Team settings
                    as well — so they are named by WHERE they are, not "above the table". The bulk
                    "Remind all" went with the chase card (owner call 2026-09-03); the single-family
                    door widened to any late family (owner E4, 2026-09-04), and this sentence says so. */}
                <strong>Send due reminders</strong> on the Dues page emails right now about anything past
                due or due in the next 3 days. To nudge one family, open that player from the dues
                table and use <strong>Remind this family</strong> in their panel.
              </p>
            </>
          )}
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
