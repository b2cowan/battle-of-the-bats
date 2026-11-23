/**
 * THE BUSINESS'S SPONSORSHIP PAGE — the words DEAL_WORDS.page does not carry (Board Ready Stage 6 Part 2). All DRAFT for
 * the /marketing pass unless marked drawn. Pure and client-safe. Never "donation", "gift", "tax receipt" or "advertising".
 */
import type { SponsorPlaceKind } from './club-sponsorships';
import { possessive } from './utils';

export const SPONSOR_LINK_WORDS = {
  /** The package box's logo bullet (round 1 tab 4: "Your logo on the U9 division’s pages on our website"). */
  logoBullet: (kind: SponsorPlaceKind, place: string | null) => {
    if (kind === 'club') return 'Your logo on our website’s home page';
    if (kind === 'division') return place ? `Your logo on the ${place} division’s pages on our website` : 'Your logo on the division’s pages on our website';
    if (kind === 'team') return place ? `Your logo with ${place} on our website’s About page` : 'Your logo on our website’s About page';
    return place ? `Your logo on ${possessive(place)} pages on our website` : 'Your logo on the tournament’s pages on our website';
  },
  pickProvince: 'Choose…',
  /** The thank-you page once an invoice is out but no logo has come yet. */
  logoLaterTitle: 'Your logo',
  /** "Questions about…" foot when the club named no contact for sponsors. */
  // /legal 2026-11-22 (finding 5): a link made only had no email to reply to. DRAFT.
  footNoContact: (club: string) => `Ask ${club} for their contact details.`,
  /** Tab title. */
  pageTitle: 'Sponsorship',
  /** The error box when a fixed field is the first error (the family form's words name it). */
  fieldName: {
    name: 'Business name', contactName: 'Contact name', email: 'Email', phone: 'Phone', website: 'Website',
    street: 'Street', city: 'Town or city', province: 'Province', postal: 'Postal code',
  },
  changed: (club: string) => `${club} changed its questions while you were filling this in. Check them, then send again.`,
  docMissing: (name: string, pdf: boolean) => (pdf ? `Open ${name} and tick it to send.` : `Tick ${name} to send.`),
  docNotOpened: (name: string) => `Open ${name} and tick it to send.`,
  fileTooMany: (max: number) => `You can attach ${max} files. Remove one to attach another.`,
} as const;
