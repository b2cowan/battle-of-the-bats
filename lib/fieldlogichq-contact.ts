/**
 * The one home for FieldLogicHQ's own contact address (GST/HST Stage 6 step 6.2, ruling Q3). Every place the product
 * shows or uses it — the reply-to on our email, the account page's support row, the organization-closed email, the
 * club-facing address on our invoices — reads this constant; nothing types the address by hand.
 *
 * Today it is hello@fieldlogichq.ca, because support@fieldlogichq.ca does not receive mail yet (an owner step is owed).
 * At step 6.7, once the owner confirms support@ works, ONE edit here makes support@ the one public address (reply-to
 * included). hello@ keeps forwarding forever — emails already sent carry it.
 *
 * Deliberately NOT here: the FROM default in `lib/email-sender.ts` (env `RESEND_FROM`) and `scripts/stack-health.mjs`
 * (a script that runs by itself — shared automation, changed only when the owner asks).
 */
export const FIELDLOGICHQ_CONTACT_EMAIL = 'hello@fieldlogichq.ca';
