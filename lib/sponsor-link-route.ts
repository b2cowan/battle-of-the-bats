import 'server-only';
/**
 * WHAT EVERY ROUTE OF A BUSINESS'S SPONSORSHIP LINK ASKS (Board Ready Stage 6 Part 2). After its throttle (each route
 * throttles FIRST, so a flood never reaches the database): the one door (`dealFromLinkToken`), the club's plan still
 * carrying Sponsorships, and the token's deal — never another. A link that can't act answers the same few words, so
 * nothing about any other deal or business is ever said.
 */
import { NextResponse } from 'next/server';
import { clubForDoor, dealFromLinkToken } from './sponsor-deal-view';
import { readDeal } from './club-sponsorship-deals-server';
import { DEAL_WORDS } from './club-sponsorship-deal-words';
import { offerLapsedNow } from './club-sponsorship-offer-lapsed';
import { refundedAway } from './club-sponsor-invoice';
import type { ClubDeal } from './club-sponsorship-deals';
import type { Organization } from './types';
import { previewWriteRefusal } from './preview-write-refusal';

export type LinkDeal = { org: Organization; deal: ClubDeal & { linkVersion: number } };

export async function dealForLink(token: string, opts: { keepRefunded?: boolean } = {}): Promise<LinkDeal | { failure: Response }> {
  const door = await dealFromLinkToken(token);
  if (!door) return { failure: NextResponse.json({ error: DEAL_WORDS.page.notFound, code: 'not_found' }, { status: 404 }) };
  const org = await clubForDoor(door.orgId);
  if (!org) return { failure: NextResponse.json({ error: DEAL_WORDS.page.notFound, code: 'not_found' }, { status: 404 }) };
  { const previewClosed = previewWriteRefusal(org); if (previewClosed) return { failure: previewClosed }; }
  if (door.kind === 'replaced') return { failure: NextResponse.json({ error: DEAL_WORDS.page.errClosed, code: 'closed' }, { status: 409 }) };
  const deal = await readDeal(org.id, door.dealId);
  if (!deal || (deal.state === 'withdrawn' && !(opts.keepRefunded && refundedAway(deal)))) return { failure: NextResponse.json({ error: DEAL_WORDS.page.errClosed, code: 'closed' }, { status: 409 }) };
  if (await offerLapsedNow(org.id, deal)) return { failure: NextResponse.json({ error: DEAL_WORDS.page.errClosed, code: 'closed' }, { status: 409 }) };
  return { org, deal };
}
