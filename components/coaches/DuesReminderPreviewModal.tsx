'use client';
import { useRef } from 'react';
import { X } from 'lucide-react';
import { useDialogFloor } from '@/components/coaches/useDialogFloor';
import { duesReminderEmail, GUARDIAN_FIRST_NAME_PLACEHOLDER } from '@/lib/dues-reminder-email';
import { tournamentToday, addCalendarDays } from '@/lib/timezone';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * "See an example" / "See what they'll receive" / "Preview this email" — a rendered sample (or
 * the real thing) of the dues reminder a coach is about to send.
 *
 * The sample is built by the SAME template every sender uses, so what a coach reads here is
 * what a family receives; a hand-written sample would drift the first time the wording changed.
 *
 * ⚠ THREE VARIANTS, ONE TEMPLATE (owner D3, 2026-09-04; `family` redefined 2026-09-21). `wave` is
 * the automatic 30/7-day notice (Team settings' "See an example"). `bulk` is the team-wide
 * "Send due reminders" button — past due or due within 3 days, possibly several installments in
 * one letter. `family` is the per-family "Remind this family" button: ALWAYS exactly one
 * installment — this player's own next unpaid bill, however far off its due date is (no window,
 * unlike `bulk`). Each confirmation opens this modal to show what THAT send says, so the variant
 * passed in must match the letter the button actually sends.
 *
 * ⚠ `real`, WHEN GIVEN, REPLACES THE SAMPLE WITH THE ACTUAL LETTER (owner follow-up, 2026-09-21).
 * The `family` variant knows exactly who this is — so showing "Alex Rivera" instead of the real
 * player and balance would answer a different question than the one the coach asked. The caller
 * fetches it from the SAME route that would send the email (`preview: true`, sends and stamps
 * nothing) rather than reconstructing the figures here, so this component stays pure and the
 * wording can never drift from the real send. `wave` and `bulk` have no single family to name, so
 * they leave `real` unset and keep the sample.
 */
export default function DuesReminderPreviewModal({
  teamName,
  variant = 'wave',
  real,
  onClose,
}: {
  teamName: string;
  /** `'wave'` — the automatic 30-day notice. `'bulk'` — Send-due-reminders' own 3-day-window
   *  preview. `'family'` — Remind-this-family's per-player next-installment preview. */
  variant?: 'wave' | 'bulk' | 'family';
  /** The real letter for one specific family, fetched by the caller (the `family` variant only).
   *  `'loading'` while the fetch is in flight, `'failed'` on a network error, `{ empty: true,
   *  reason }` when the send route says there is genuinely nothing to send right now — the reason
   *  is carried through rather than flattened, so THIS modal can say why. A letter with
   *  `missingEmail` still RENDERS (owner, 2026-09-21) — with placeholders for the guardian, and
   *  a warning that it cannot send until the Roster has an address; `guardianHidden` means the
   *  coach lacks the roster-PII grant, so the same placeholders stand in for details they may
   *  not read, and `to` is withheld. Omit entirely for `wave`/`bulk`, which keep the sample. */
  real?:
    | 'loading'
    | 'failed'
    | { empty: true; reason: 'skippedRecent' | 'settled' }
    | { subject: string; html: string; to: string | null; missingEmail: boolean; guardianHidden: boolean };
  onClose: () => void;
}) {
  /* The accessibility floor (D7): Escape closes, Tab stays inside, focus returns to the "See an
     example" link that opened this. Both callers mount this only while it is open, so the floor
     is armed for its whole life. No busy gate and no discard guard — nothing here is typed and
     nothing here is saved. */
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFloor(true, panelRef, { onClose });

  const today = tournamentToday();
  const bulk = variant === 'bulk';
  const family = variant === 'family';
  const realLetter = real && typeof real === 'object' && 'subject' in real ? real : null;
  const realEmpty = real && typeof real === 'object' && 'empty' in real ? real : null;
  // One call to the template; only the window and the sample rows differ by variant. Built even
  // when `real` will be shown instead — it's a few strings, and the fallback on a failed fetch
  // needs it ready rather than computed mid-render.
  const sample = duesReminderEmail({
    teamName: teamName || 'your team',
    guardianFirst: 'Jordan',
    window: bulk || family ? null : 30,
    items: family
      // The shape the real send always sends: ONE installment, this player's own next unpaid
      // bill — never a bundle, whatever the wave/bulk samples below show.
      ? [{ playerFirstName: 'Alex', playerLastName: 'Rivera', amount: 300, remainingAmount: 300, dueDate: addCalendarDays(today, 30), installmentNumber: 2, totalInstallments: 4 }]
      : bulk
        ? [
          // One overdue row, one part-paid row due inside the 3-day window — the two sentences the
          // bulk send exists to get right: "was due", and the thank-you for what arrived.
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

  const title = family ? 'What this family will receive' : bulk ? 'What families will receive' : 'Dues reminder emails';

  /* A blank the coach can SEE as a blank. The template escapes the greeting, so the placeholder
     arrives in the HTML as plain bracketed text; it is dressed here, on the token the template
     module itself exports — the only string this replace can ever touch. Literal colours on
     purpose, like the card's own white and black: this is a mock of the FAMILY's inbox, and it
     must look the same under either portal theme. */
  const blank = { background: '#fff3cd', border: '1px dashed #b58a00', borderRadius: 3, padding: '0 .3em', color: '#6b5300' } as const; /* token-exempt: a highlight inside the white email-client mock, theme-independent like its card */
  const placeholderSpan = (text: string) =>
    `<span style="background:${blank.background};border:${blank.border};border-radius:${blank.borderRadius}px;padding:${blank.padding};color:${blank.color};">${text}</span>`;
  const shownHtml = realLetter
    ? realLetter.html.split(GUARDIAN_FIRST_NAME_PLACEHOLDER).join(placeholderSpan(GUARDIAN_FIRST_NAME_PLACEHOLDER))
    : sample.html;

  return (
    <div className={styles.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget) (onClose)?.(); }}>
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={styles.modal}
        style={{ maxWidth: 600 }}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <span style={{ fontWeight: 700, color: 'var(--home-ink, rgba(255,255,255,0.9))' }}>{title}</span>
          <button className={styles.modalCloseBtn} aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div style={{ fontSize: '0.83rem', color: 'var(--home-ink-soft, rgba(255,255,255,0.7))', display: 'flex', flexDirection: 'column', gap: '0.45rem', marginBottom: '1rem' }}>
          {family ? (
            <p style={{ margin: 0 }}>
              <strong>Remind this family</strong> emails about this player&apos;s own <strong>next
              unpaid installment</strong> — the earliest one still owed, however far off its due
              date is. Nothing sends once that installment is paid.
            </p>
          ) : bulk ? (
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

        {real === 'loading' ? (
          <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--home-ink-soft, rgba(255,255,255,0.7))' }}>
            Loading the actual email…
          </p>
        ) : realEmpty ? (
          <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--home-ink-soft, rgba(255,255,255,0.7))' }}>
            {realEmpty.reason === 'skippedRecent'
              ? 'This family was reminded in the last 7 days — nothing sends again until that week is up.'
              : 'This installment is already paid — there is nothing left to remind them about.'}
          </p>
        ) : (
          <>
            <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--home-line, rgba(255,255,255,0.12))', background: 'white' }}>
              {/* The "To:" line exists only for the real letter — the samples have nobody to
                  address. ⚠ THE MODAL CAN SAY "NONE ON FILE" FOR CERTAIN; THE CONFIRMATION CANNOT
                  (/review 2026-09-05's rule, still true). The confirmation hedges because a blank
                  address there might just be redacted from THIS coach's view — this answer came
                  from the route's own read of the real column, with `guardianHidden` telling the
                  two apart. */}
              {realLetter && (
                <div style={{ padding: '0.5rem 0.9rem 0', fontSize: '0.75rem', color: 'black', opacity: 0.55 }}>
                  To:{' '}
                  {realLetter.to
                    ? realLetter.to
                    : realLetter.missingEmail
                      ? <span style={blank}>[guardian’s email — none on file yet]</span>
                      : 'the guardian email on file (hidden from your view)'}
                </div>
              )}
              <div style={{ padding: '0.5rem 0.9rem', borderBottom: '1px solid var(--home-line, rgba(0,0,0,0.08))', fontSize: '0.75rem', color: 'black', opacity: 0.55 }}>
                Subject: {(realLetter ?? sample).subject}
              </div>
              {/* The template's own inline styles carry the email's look; colours here only
                  ground it on the white "email client" card. */}
              <div style={{ color: 'black', fontSize: '0.85rem' }} dangerouslySetInnerHTML={{ __html: shownHtml }} />
            </div>
            {realLetter?.missingEmail ? (
              // The one caption that is a WARNING, in the same ink as the confirmation's courtesy
              // hold: the letter above is what will go — once somebody gives it somewhere to go.
              <p role="status" style={{ fontSize: '0.78rem', margin: '0.5rem 0 0', color: 'var(--warning-light)' }}>
                This can&rsquo;t be sent yet — there&rsquo;s no guardian email on file for this player. Add one
                on the Roster and the highlighted blanks fill in with their details.
              </p>
            ) : (
              <p className={styles.muted} style={{ fontSize: '0.72rem', margin: '0.5rem 0 0' }}>
                {realLetter
                  ? realLetter.guardianHidden
                    ? 'The exact email, except the guardian’s name and address — those are hidden from your view, and the real email uses them.'
                    : 'The exact email — this player’s real name, balance and guardian.'
                  : real === 'failed'
                    ? 'Couldn’t load the real email, showing a sample instead — real emails use your roster’s names, figures and due dates.'
                    : 'Sample family and amounts — real emails use your roster’s names, figures and due dates.'}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
