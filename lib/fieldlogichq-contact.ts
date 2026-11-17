/**
 * The one home for FieldLogicHQ's own contact address (GST/HST Stage 6 step 6.2, ruling Q3). Every place the product
 * shows or uses it — the reply-to on our email, the account page's support row, the organization-closed email, the
 * club-facing address on our invoices — reads this constant; nothing types the address by hand.
 *
 * It is support@fieldlogichq.ca since step 6.7 (2026-11-17), the address the published Terms name: the owner confirmed on walk
 * §533 that support@, hello@ and privacy@ all receive mail (forwarded into the business Gmail). hello@ keeps forwarding
 * forever — emails already sent carry it as their reply-to.
 *
 * Deliberately NOT here: the FROM default in `lib/email-sender.ts` (env `RESEND_FROM`) and `scripts/stack-health.mjs`
 * (a script that runs by itself — shared automation, changed only when the owner asks).
 */
export const FIELDLOGICHQ_CONTACT_EMAIL = 'support@fieldlogichq.ca';

/**
 * The seller's phone and mailing address on a purchase email (GST/HST 6.4, /legal: Ontario's Consumer Protection Act asks a seller
 * to give them). Blank by owner ruling (2026-11-17, email only; Terms §1 lists only support@): a blank line simply drops out of the
 * email. Fill them, with no other change, when the owner adds a phone and address (the first coach buyer, or before any
 * promotional email). A business number or address only, never a personal name (owner ruling O1').
 */
export const FIELDLOGICHQ_SELLER_PHONE = '';
export const FIELDLOGICHQ_SELLER_MAILING_ADDRESS = '';
