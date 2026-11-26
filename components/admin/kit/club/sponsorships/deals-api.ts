'use client';
/**
 * SPONSORSHIPS › DEALS — the screens' reads (Board Ready Stage 6, Part 2). One read for the Deals tab and its Offer window
 * (`useDeals`, a fiscal year at a time), one for a deal's page (`useDeal`); every press goes through `send` (api.ts), so a
 * refusal is always the server's sentence.
 */
import { useCallback, useEffect, useState } from 'react';
import { useOrg } from '@/lib/org-context';
import { moneyFetch, refusalText } from '@/lib/money-fetch';
import { SPONSORSHIPS_WORDS as W } from '@/lib/club-sponsorships-words';
import { DEAL_WORDS } from '@/lib/club-sponsorship-deal-words';
import { holdersOf, type ClubDeal, type DealBand, type DealState, type EmailBar, type OfferReason } from '@/lib/club-sponsorship-deals';
import type { PackageTaken, PlaceTargets, SponsorPlaceKind, SponsorshipPackage } from '@/lib/club-sponsorships';
import type { FiscalYearOption } from '@/lib/club-fiscal-year';
import type { GstHstRate } from '@/lib/gst-hst-rates';
import type { DealPayment, DealRefund } from '@/lib/club-sponsor-invoice';
import type { AgainRow, OfferPrefill } from '@/lib/club-sponsorship-offer-again';
import { sponsorshipsApi } from './api';

export type { OfferPrefill };
export type ListedDeal = ClubDeal & { band: DealBand };
export type Figure = { amount: number; count: number };
export type DealHold = { id: string; state: DealState; placeKind: SponsorPlaceKind; targetId: string | null; businessName: string };
export type OfferSponsor = {
  id: string; name: string; contactName: string | null; email: string | null; province: string | null; bar: EmailBar; caption: string | null;
};
export type OfferPackage = SponsorshipPackage & { taken: PackageTaken; full: boolean };

export interface DealsRead {
  year: { key: string; name: string };
  years: FiscalYearOption[];
  deals: ListedDeal[];
  figures: { deals: Figure; paid: Figure; invoiced: Figure; waiting: Figure };
  packages: OfferPackage[];
  sponsors: OfferSponsor[];
  targets: PlaceTargets;
  holds: DealHold[];
  registered: boolean;
  hasMailingAddress: boolean;
  /** A contact email for sponsors, or the club's public one: an offer email names it (/legal 2026-11-22). */
  hasContact: boolean;
  linksOn: boolean;
  /** Offer again's callout (Part 4a, 11A): on the current year while any of last year's deals can still be offered. */
  again: { lastYear: string; sponsored: number; left: number } | null;
  today: string;
}

/** The Offer again window's read (Part 4a, 2A): last year's deals in their three groups. */
export interface AgainRead {
  thisYear: string;
  lastYear: string;
  rows: AgainRow[];
  holds: DealHold[];
  /** Why nothing can be sent at all (the club's mailing address, a contact, the link secret), or null. */
  blocked: string | null;
  today: string;
}

export interface DealRead {
  deal: ListedDeal;
  /** An earlier year's open offer whose place has gone back (owner 2026-11-25): no link, no email, no invoice. */
  lapsed: boolean;
  business: {
    name: string; contactName: string | null; email: string | null; phone: string | null; website: string | null;
    address: { street: string; city: string; province: string; postal: string } | null; logoUrl: string | null; logoWaiting: boolean;
  } | null;
  offers: { email: string; reason: OfferReason; reasonOn: string; kind: 'offer' | 'again'; sentAt: string; sentByName: string }[];
  /** The payments recorded on its invoice, voided ones included (Part 3a); a card payment carries its card (Part 3b). */
  payments: DealPayment[];
  /** Its refunds to the card, failed ones included (Part 3b). */
  refunds: DealRefund[];
  /** Refunds to the card can be asked now (the launch switch). */
  cardRefundsOn: boolean;
  /** A card payment taken for this deal that could not be recorded on it (the money is in the club's Stripe account). */
  unrecordedCard: { amount: number; reason: string | null } | null;
  answers: { questionId: string; label: string; type: string; display: string | null }[];
  address: string | null;
  bar: EmailBar;
  link: string | null;
  /** "Send the link again" would email the business (B-2): false, and the button reads Make a new link. */
  againEmails: boolean;
  registered: boolean;
  hasMailingAddress: boolean;
  /** A contact email for sponsors, or the club's public one: an offer email names it (/legal 2026-11-22). */
  hasContact: boolean;
  rate: GstHstRate | null;
  targets: PlaceTargets;
  holds: DealHold[];
  /** Offer again on this old deal (12A), or null when it isn't offered: not paid, this year's, held this year, or can't be emailed. */
  offerAgain: OfferPrefill | null;
  today: string;
}

function useRead<T>(path: (slug: string) => string | null) {
  const { currentOrg } = useOrg();
  const slug = currentOrg?.slug ?? '';
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const url = slug ? path(slug) : null;
  const reload = useCallback(async () => {
    if (!url) return;
    const r = await moneyFetch<T>(url);
    if (!r.ok) { setError(refusalText(r.data, W.say.failed)); return; }
    setError(null);
    setData(r.data);
  }, [url]);
  useEffect(() => { void reload(); }, [reload]);
  return { slug, data, error, reload };
}

/** The Deals tab, for one fiscal year (its key; null = the year today falls in). */
export function useDeals(year: string | null) {
  return useRead<DealsRead>(slug => `${sponsorshipsApi(slug, '/deals')}${year ? `&year=${encodeURIComponent(year)}` : ''}`);
}

/** The Offer again window's rows, read when it opens. */
export function useAgain() {
  return useRead<AgainRead>(slug => sponsorshipsApi(slug, '/deals/offer-again'));
}

export function useDeal(dealId: string) {
  return useRead<DealRead>(slug => sponsorshipsApi(slug, `/deals/${dealId}`));
}

const HELD_AS = { offered: 'offered', form_received: 'offered', invoiced: 'invoiced', paid: '', withdrawn: '' } as const;

/** "Taken: Kowalski Plumbing, invoiced" / "Offered to …" under a place in a picker ('' when nobody holds it): the Offer
 *  window's and Offer again's one sentence. It warns, never blocks (ask 6). */
export function takenWords(holds: readonly DealHold[], kind: SponsorPlaceKind, targetId: string): string {
  const h = holdersOf(holds, kind, targetId)[0];
  if (!h) return '';
  return h.state === 'offered' || h.state === 'form_received' ? DEAL_WORDS.offer.offeredTo(h.name) : DEAL_WORDS.offer.taken(h.name, HELD_AS[h.state]);
}

/** "U9 division", "U11 Lions", "Spring Classic 2027", "Your home page" — how a deal's place reads in the list and on its page. */
export function placeLabel(d: Pick<ClubDeal, 'placeKind' | 'targetName'>): string {
  if (d.placeKind === 'club') return DEAL_WORDS.list.theClub;
  if (!d.targetName) return d.placeKind === 'division' ? 'A division' : d.placeKind === 'team' ? 'A team' : 'A tournament';
  return d.placeKind === 'division' ? `${d.targetName} division` : d.targetName;
}
