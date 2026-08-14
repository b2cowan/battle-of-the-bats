/**
 * THE dues reminder email — one template, four readers.
 *
 * Three senders used to carry this byte-for-byte (the coach "Send Due Reminders" route, the
 * org-admin wave route, and the nightly sweep), each with a comment promising it matched the
 * others. The fourth reader is why the copies finally merged: the Player Dues screen shows a
 * coach a SAMPLE of this email ("See an example" beside the Automatic Dues Reminders toggle),
 * and a preview rendered from its own copy of the words would drift from the real send the
 * first time anyone edited one of them.
 *
 * The figure quoted is what is still MISSING on the installment, never its face value (owner
 * ruling 6, mig 232), and a part-payment is acknowledged with thanks on the same row.
 *
 * Pure string-building on purpose: the client-side preview imports this, so nothing server-only
 * (db, email transport) may ever be imported here.
 */

export interface DuesReminderEmailItem {
  playerFirstName: string;
  playerLastName: string;
  /** The installment's face value. */
  amount: number;
  /** What is still missing on it after recorded payments — the figure the email asks for. */
  remainingAmount: number;
  dueDate: string;
  installmentNumber: number;
  totalInstallments: number;
  /** Past its due date. Only the coach's ad-hoc send produces these (the automated waves look
   *  forward) — a past-due row must say "was due", never read as upcoming. Optional so the
   *  wave senders, which cannot produce one, say nothing. */
  overdue?: boolean;
}

const fmt = (n: number) =>
  `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (s: string) =>
  new Date(s + 'T00:00:00').toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' });

/** Names and team titles are people-entered text landing in a third party's inbox (and in the
 *  on-screen preview's dangerouslySetInnerHTML) — escape them, always. */
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * `window` is the automatic wave (30 or 7 days ahead); null is the coach's ad-hoc
 * "Send Due Reminders" button, which carries its own subject line.
 */
export function duesReminderEmail(opts: {
  teamName: string;
  window: 30 | 7 | null;
  guardianFirst: string;
  items: DuesReminderEmailItem[];
}): { subject: string; html: string } {
  const { teamName, window, guardianFirst, items } = opts;
  const rows = items
    .map(i => {
      const received = Math.round((i.amount - i.remainingAmount) * 100) / 100;
      const partial = received > 0.005
        ? ` — thank you, ${fmt(received)} of ${fmt(i.amount)} has been received`
        : '';
      return `<li style="margin-bottom:0.5rem;">
              <strong>${esc([i.playerFirstName, i.playerLastName].filter(Boolean).join(' '))}</strong> — ${fmt(i.remainingAmount)} ${i.overdue ? `was due ${fmtDate(i.dueDate)}` : `due ${fmtDate(i.dueDate)}`}
              (Installment ${i.installmentNumber} of ${i.totalInstallments})${partial}
            </li>`;
    })
    .join('');
  const anyOverdue = items.some(i => i.overdue);
  const html = `
<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:2rem;">
  <p>Hi ${esc(guardianFirst)},</p>
  <p>This is a friendly reminder that the following dues installments are ${anyOverdue ? 'due' : 'coming due'} for your player(s) on <strong>${esc(teamName)}</strong>:</p>
  <ul style="padding-left:1.25rem;">${rows}</ul>
  <p>If you've already sent a payment, it may not be recorded yet — just let your coach know. To view your full payment schedule, contact your coach directly.</p>
  <p style="color:rgba(0,0,0,0.5);font-size:0.85rem;margin-top:2rem;">FieldLogicHQ</p>
</div>`;
  const subject = window
    ? `Upcoming dues reminder (${window} days) — ${teamName}`
    : anyOverdue
      ? `Reminder: Player dues outstanding — ${teamName}`
      : `Reminder: Player dues due soon — ${teamName}`;
  return { subject, html };
}
