/**
 * WHAT THE WEB ADDRESS ROW SHOWS, decided from the connection (Club Tier Stage 4e, Part 3). Pure: the closed row's chip and
 * summary, the page header's address, which of the waiting lines to say, what each record's chip says, and the message the
 * owner copies for whoever holds the sign-in where the address was bought. The words are `own-address-screen-words.ts`.
 */
import type { ClubDomainStatus, RecordSighting } from './club-domain';
import { usesOwnAddress } from './club-domain';
import type { DomainView } from './club-domain-service';
import { OWN_ADDRESS_WORDS as W } from './own-address-screen-words';
import { possessive } from './utils';

export type ChipTone = 'good' | 'warn' | 'bad' | 'info' | 'neutral';
export interface RowChip { tone: ChipTone; label: string }

/** The chip at the closed row's end. A status is said once, by a chip; connected and not connected say nothing. */
export function rowChip(status: ClubDomainStatus | null | undefined): RowChip | null {
  switch (status) {
    case 'waiting': return { tone: 'neutral', label: W.chipWaiting };
    case 'needs_attention': return { tone: 'warn', label: W.chipNeedsAttention };
    case 'not_connected': return { tone: 'warn', label: W.chipNotConnected };
    case 'not_working': return { tone: 'bad', label: W.chipNotWorking };
    default: return null;
  }
}

/** The closed row's summary line: always only an address. */
export function rowSummary(view: DomainView | null, fieldlogicAddress: string): string {
  return view ? view.fullName : fieldlogicAddress;
}

/** The address the page header says families use: the club's own while it is handed out, else the FieldLogicHQ one. */
export function headerAddress(view: DomainView | null, fieldlogicAddress: string): string {
  return view && usesOwnAddress(view.status) ? view.fullName : fieldlogicAddress;
}

/** Is the club's own address one the product hands out right now (the preview strip, the header, the copy-link lines)? */
export function ownAddressInUse(view: DomainView | null): boolean {
  return !!view && usesOwnAddress(view.status);
}

export interface SightingChip { tone: ChipTone; label: string }

/** A record card's chip: what our own lookup last saw. Nothing seen yet is "Not seen yet". `missing` is for a record once live. */
export function recordChip(s: RecordSighting | null | undefined, live: boolean): SightingChip {
  if (!s || s.state === 'not_seen') return live ? { tone: 'bad', label: W.chipMissing } : { tone: 'neutral', label: W.chipNotSeen };
  if (s.state === 'found') return { tone: 'good', label: W.chipFound };
  return { tone: 'warn', label: W.chipPointsElsewhere };
}

/** Which of the two records the gave-up sentence names as the one never found. */
export function gaveUpWhich(view: DomainView): 'record2' | 'record1' | 'both' | 'elsewhere' {
  const a = view.lastCheck?.record1;
  const b = view.lastCheck?.record2;
  if (b?.state === 'points_elsewhere') return 'elsewhere';
  const r1 = a?.state === 'found';
  const r2 = b?.state === 'found';
  if (r1 && !r2) return 'record2';
  if (!r1 && r2) return 'record1';
  return a || b ? 'both' : 'record2';
}

/** The bare name's line on a connected row: only for www; null until the status job has looked. */
export function bareState(view: DomainView): 'forwards' | 'not_forwarding' | 'unknown' | null {
  if (view.prefix !== 'www') return null;
  const f = view.lastCheck?.bare_forwards;
  return f === true ? 'forwards' : f === false ? 'not_forwarding' : 'unknown';
}

const DAY = 24 * 60 * 60 * 1000;

/** Which line the waiting status says. A day in is "still waiting"; record 1 in with record 2 on the old site is named while fixable. */
export function waitingLine(view: DomainView, now: Date): 'start' | 'record2_old' | 'still_waiting' {
  const r1 = view.lastCheck?.record1;
  const r2 = view.lastCheck?.record2;
  if (r1?.state === 'found' && r2?.state === 'points_elsewhere') return 'record2_old';
  if (now.getTime() - new Date(view.waitingSince).getTime() >= DAY) return 'still_waiting';
  return 'start';
}

/** `lakeshorelynx.ca` for `www.lakeshorelynx.ca`: the name the club owns. */

/**
 * The plain-text message the owner pastes into an email or a text to whoever looks after the address. Plain text so it
 * survives any mail program; straight apostrophes on purpose. For a name other than www the forwarding step is left out.
 */
export function registrarMessage(opts: { clubName: string; ownerName: string | null; view: DomainView; helpLink: string }): string {
  const { clubName, ownerName, view, helpLink } = opts;
  const lines = [
    `Hi, could you add two records to ${view.domain} where it is registered?`,
    `${possessive(clubName).replace(/’/g, "'")} website is moving to ${view.fullName}.`,
    '',
    '1. Type CNAME',
    `   Name  ${view.records.padlock.name}`,
    `   Value ${view.records.padlock.value}`,
    "   Keep this one for good. It renews the site's padlock.",
    '',
    '2. Type CNAME',
    `   Name  ${view.records.site.name}`,
    `   Value ${view.records.site.value}`,
    `   If ${view.records.site.name} already has a record, delete that one first.`,
    '',
  ];
  if (view.prefix === 'www') lines.push(`Then set ${view.domain} (without www) to forward to https://${view.fullName}.`);
  lines.push("Please don't change anything else. Email keeps working.", `How-to: ${helpLink}`, '', 'Thanks!');
  if (ownerName) lines.push(ownerName);
  return lines.join('\n');
}

/** Where the how-to lives (the help article is written later by /docs; provisional until it exists). */
export const OWN_ADDRESS_HELP_PATH = 'fieldlogichq.ca/help/own-address';
/** The same article as a link on a screen (Part 7 writes it; the how-to places anchor into it). */
export const OWN_ADDRESS_HELP_HREF = '/help/own-address';
