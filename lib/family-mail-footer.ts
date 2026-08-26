/**
 * lib/family-mail-footer.ts — the footer every TRANSACTIONAL family notice carries.
 *
 * Some club mail deliberately ignores a family's unsubscribe: dues reminders. That is an owner
 * ruling (2026-08-18) and it is the right call — a family cannot mute a bill by unsubscribing from
 * announcements.
 *
 * ⚠ The tryout offer/waitlist/release mails were the OTHER member of that exemption and no longer
 * exist (owner ruling 2026-08-26 — the platform sends a tryout family nothing on a coach's
 * behalf), so dues reminders are now this footer's only user. Do not re-add a tryout example here.
 *
 * ⚠ THE EXEMPTION IS NOT FREE. It is paid for by this footer, and the ruling has two halves:
 *   1. **Name the sender.** Before this, these notices signed off `FieldLogicHQ` — the software
 *      vendor, the one party in the exchange a parent has no relationship with. Worse, the tryout
 *      mails identified the club only when a caller remembered to pass its name.
 *   2. **Say why the unsubscribe did not stop it.** A parent who opted out and then receives mail
 *      anyway reads that as the unsubscribe being broken. An exempt sender that does not explain
 *      itself is not exempt — it is just unaccountable.
 *
 * Lives in its own module because both importers need it and they cannot import each other:
 * `lib/dues-reminder-email.ts` must stay PURE (the on-screen preview imports it client-side, so it
 * may never reach the email transport), and the tryout templates live in `lib/email.ts`, which is
 * that transport. This file imports nothing, so both sides are safe.
 *
 * The ANNOUNCEMENT side of the rule is enforced elsewhere and differently — `lib/family-email.ts`
 * refuses the send outright. Nothing here should ever be used to justify skipping that guard.
 */

/** Escapes for an HTML text node. Local so this module stays dependency-free (see header). */
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface TransactionalFamilyFooter {
  /** The club. Falls back to the team name — identification is never conditional. */
  orgName?: string | null;
  /** The team, season or program this notice concerns. Always present. */
  teamName: string;
  /** What this kind of mail is, plural, sentence-leading: "Dues reminders", "Tryout updates". */
  noticeKind: string;
  /** What it is about, completing "Sent by {org} about {…} for {team}". */
  about: string;
  /** `dark` matches the near-black tryout/announcement templates; `light` the plain dues notices. */
  tone?: 'light' | 'dark';
}

export function transactionalFamilyFooterHtml(p: TransactionalFamilyFooter): string {
  const sender = esc((p.orgName ?? '').trim() || p.teamName);
  const dark = p.tone === 'dark';
  const ink = dark ? 'rgba(241,245,249,0.45)' : 'rgba(0,0,0,0.55)';
  const rule = dark ? 'rgba(241,245,249,0.14)' : 'rgba(0,0,0,0.1)';
  return `
  <p style="color:${ink};font-size:0.8rem;line-height:1.55;margin-top:2rem;padding-top:1rem;border-top:1px solid ${rule};">
    Sent by <strong>${sender}</strong> about ${esc(p.about)} for ${esc(p.teamName)}.<br>
    ${esc(p.noticeKind)} are account notices rather than announcements, so they are sent even if you
    have unsubscribed from ${sender}'s emails. If you believe you received this in error, please
    speak to your coach.
  </p>`;
}
