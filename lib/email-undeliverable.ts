/**
 * lib/email-undeliverable.ts — the addresses that can never receive mail, so they are never handed to the mail service.
 *
 * Both senders (lib/email.ts, lib/email-sender.ts) ask this before a request leaves: a send to one of these only spends
 * the daily quota and bounces against our sending domain. The names are reserved ones, so no real person can have such an
 * address: `.test`, `.example`, `.invalid`, `.localhost` and `example.com` / `.net` / `.org` (RFC 2606), and `.local`
 * (multicast DNS, RFC 6762). On 2026-11-26 only `.local` was held back, and a walk's `.example.test` families used up
 * the day's quota by 9:30 a.m.
 *
 * A send held back here answers `sent`, so a screen shows the full count a walk or a prospect expects. (A batch that
 * also holds a real address answers with the real request's result, for every address in it.) A made-up address on a name
 * that is NOT reserved (`@club.ca`) is still sent: write fixtures on a reserved one. Pure, so a test can hold it.
 */
const RESERVED = /(?:[@.](?:test|example|invalid|localhost|local)|[@.]example\.(?:com|net|org))$/i;

/** True for `a@b.test`, for `Name <a@b.test>`, and for either with the domain's closing dot. */
export function isUndeliverableAddress(to: string): boolean {
  return RESERVED.test(to.trim().replace(/>$/, '').trim().replace(/\.$/, ''));
}
