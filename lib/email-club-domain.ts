/**
 * THE FOUR EMAILS TO A CLUB'S OWNER ABOUT ITS OWN WEB ADDRESS (Club Tier Stage 4e, Part 6; ruling 6). The words are
 * docs/projects/active/CLUB_TIER_STAGE4E_COPY.md §11; keep the two in step. Warm envelope, Arial, one button that says what it does.
 * To the OWNER only: an admin reads the row and is never emailed. No code, no system word, nothing promised beyond what happened.
 *
 * Pure (an HTML string and a subject from facts), so a plain Node test reads it. The facts arrive already formatted.
 */
import { possessive } from './utils';
import { warmEmailButton, warmEmailDocument, warmEmailHeading, warmEmailParagraph, warmEmailSmall } from './email-envelope-warm';

export type DomainEmailKind = 'live' | 'padlock_missing' | 'padlock_reminder' | 'gave_up' | 'not_working';

export interface DomainEmailFacts {
  clubName: string;
  /** `www.lakeshorelynx.ca` */
  address: string;
  /** `lakeshorelynx.ca` */
  bare: string;
  /** `fieldlogichq.ca/lakeshore-lynx` */
  oldAddress: string;
  /** The Public site page, where the Web address row is: the one button. */
  rowUrl: string;
  ownerFirstName?: string | null;
  /** "May 9, 2027": the date the padlock must be back by. */
  padlockDate?: string | null;
  /** "March 30, 2027" and "9:14 a.m.": when we noticed. */
  noticedDate?: string | null;
  noticedTime?: string | null;
  /** The bare name does not forward to www yet (only said in the "live" email). */
  bareNotForwarding?: boolean;
  /** What was never found when checking gave up: "either record", "record 1" or "record 2". */
  whichMissing?: string;
}

export interface DomainEmail { subject: string; html: string }

/** Escape a club's own words before they go into HTML (the same five replacements lib/email.ts makes). */
const e = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hi = (f: DomainEmailFacts) => (f.ownerFirstName ? `Hi ${e(f.ownerFirstName)},` : 'Hi,');

export function clubDomainEmail(kind: DomainEmailKind, f: DomainEmailFacts): DomainEmail {
  const address = `<strong>${e(f.address)}</strong>`;
  const note = (...lines: string[]) => lines.map(l => warmEmailParagraph(l)).join('');
  const doc = (heading: string, body: string, button: string) =>
    warmEmailDocument(warmEmailHeading(heading) + body + warmEmailButton(button, f.rowUrl) + warmEmailSmall(`You are getting this because you are the owner of ${e(f.clubName)} on FieldLogicHQ.`));

  switch (kind) {
    case 'live':
      return {
        subject: `${f.address} is live`,
        html: doc(`${e(f.address)} is live`, note(
          hi(f),
          `${e(possessive(f.clubName))} site now answers at ${address}.`,
          `Every link we hand out uses it. ${e(f.oldAddress)} forwards there, so posters and old links keep working.`,
          `Keep both records where you bought ${e(f.bare)} for as long as you use this address. The padlock check record matters most: the padlock renews only while it is there. We keep checking both and will write to you if one goes missing.`,
          ...(f.bareNotForwarding
            ? [`One thing is left. ${e(f.bare)} on its own does not forward to ${e(f.address)} yet, so anyone who types it without www will not find you. How to forward it is on the same page.`]
            : []),
        ), 'Open Web address'),
      };
    case 'padlock_missing':
      return {
        subject: `The padlock check record for ${f.address} is missing`,
        html: doc('The padlock check record is missing', note(
          hi(f),
          `Today we could not find the padlock check record for ${address}.`,
          `Your site still works today, but its padlock cannot renew without that record. Put it back where you bought ${e(f.bare)}${f.padlockDate ? ` before <strong>${e(f.padlockDate)}</strong>` : ' soon'}, or visitors will see a security warning instead of your site.`,
          `This happens most often when someone tidies up the settings where the address was bought and removes an odd-looking record. The record, and what it is for, are on the Web address row. If someone else looks after ${e(f.bare)}, you can copy both records as a message to send them.`,
          'This clears by itself once the record is back.',
        ), 'See the record'),
      };
    case 'padlock_reminder':
      return {
        subject: `Two weeks left: put the padlock check record back for ${f.address}`,
        html: doc('Two weeks left', note(
          hi(f),
          `The padlock check record for ${address} is still missing${f.padlockDate ? `, and the padlock runs out on <strong>${e(f.padlockDate)}</strong>, two weeks from now` : ''}.`,
          `After that date, visitors will see a security warning instead of ${e(possessive(f.clubName))} site. Putting the record back where you bought ${e(f.bare)} fixes it, and the row clears by itself once it is there.`,
          'If you no longer want this address, you can stop using it from the Web address row instead.',
        ), 'See the record'),
      };
    case 'gave_up':
      return {
        subject: 'We stopped checking for your records',
        html: doc('We stopped checking for your records', note(
          hi(f),
          `We looked for the two records for ${address} for two days and did not find ${e(f.whichMissing ?? 'either record')}.`,
          `Nothing has changed on your site. It still works at ${e(f.oldAddress)}, and every link we hand out still uses that address.`,
          `Check that the records are saved exactly as shown where you bought ${e(f.bare)}, then press Try again on the Web address row. The records stay the same.`,
        ), 'Open Web address'),
      };
    case 'not_working':
      return {
        subject: `${f.address} is not reaching your site`,
        html: doc(`${e(f.address)} is not reaching your site`, note(
          hi(f),
          `${f.noticedDate ? `On ${e(f.noticedDate)}${f.noticedTime ? ` at ${e(f.noticedTime)}` : ''} we found` : 'We found'} that record 2 for ${address} was changed or removed where you bought ${e(f.bare)}.`,
          `Anyone who uses ${e(f.address)} sees an error until it is back. Until then, every link we hand out uses ${e(f.oldAddress)}, which works, and the old address has stopped forwarding so nobody lands on the error.`,
          'Put record 2 back as shown on the Web address row and this clears by itself. If you meant to stop using the address, you can do that from the same row.',
        ), 'See the record'),
      };
  }
}
