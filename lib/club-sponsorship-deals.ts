/**
 * THE CLUB'S SPONSORSHIP DEALS — THE RULES (Board Ready Stage 6, Part 2; mig 526). Pure and client-safe: the Deals tab, one
 * deal's page, the Offer window, the business's page and every route ask these same answers.
 *
 * Rulings (owner 2026-11-22, plan BOARD_READY_PLAN.md §5 Stage 6; Part 2's four calls the same day):
 *   · ask 4 — the state follows the money: offered → form_received → invoiced → paid; delivery is counted beside it;
 *     Delivered = paid AND every item ticked (worked out, never stored). Withdraw until paid. Choosing a cheque or e-transfer
 *     issues the invoice at once, so Form received only waits after an unfinished card payment (Part 3).
 *   · ask 5 — the logo goes up by itself when paid, or earlier when the club ticks the logo line; down after the last day.
 *   · asks 6, 7 — a deal picks which place; a taken place WARNS, never blocks; an open offer holds its place (Full counts
 *     paid, invoiced and offered).
 *   · ask 9 + the hint — the Charge switch shows only to a registered club, off by default; the rate is the province's of
 *     the business's address (lib/gst-hst-rates.ts), never a hard-coded 13%.
 *   · ask 13 + /legal — every offer email carries one of four reasons; an unsubscribed, "Do not offer again" or
 *     family-opted-out address is never emailed an offer.
 *   · call (a) — the invoice number is given when a cheque or e-transfer is chosen: {year}-{seq}, seq printed to 3.
 */
import { gstHstRateOn, type GstHstRate } from './gst-hst-rates';
import { formatInvoiceNumber } from './coach-sponsor-invoice';
import { isUuid } from './utils';
import { checkEmail, checkLink } from './site-field-checks';
import { isCalendarDate, addCalendarDays, addCalendarMonths } from './timezone';
import { parsePrice, type PackageItem, type PackageTaken, type SponsorPlaceKind } from './club-sponsorships';
import { SPONSOR_LINK_WORDS } from './sponsor-link-words';

export type DealState = 'offered' | 'form_received' | 'invoiced' | 'paid' | 'withdrawn';
/** The list's bands, in the drawn order (round 1 tab 5); Delivered and Withdrawn start folded. */
export type DealBand = 'offered' | 'form_received' | 'invoiced' | 'paid' | 'delivered' | 'withdrawn';
export const DEAL_BANDS: readonly DealBand[] = ['offered', 'form_received', 'invoiced', 'paid', 'delivered', 'withdrawn'];

/** The four reasons /legal allows (CASL s.10(9)–(10)); referral is not offered in the first version. */
export type OfferReason = 'paid_recently' | 'asked_recently' | 'gave_address' | 'published_address';
export const OFFER_REASONS: readonly OfferReason[] = ['paid_recently', 'asked_recently', 'gave_address', 'published_address'];

/**
 * How long a reason holds (owner call (e), 2026-11-22, from /legal's re-check): "paid us in the last 2 years" and "asked us in
 * the last 6 months" are true only for a while, so the offer keeps the day each rests on (its When?). A given or published
 * address has no clock and asks no date.
 */
export const REASON_MONTHS: Partial<Record<OfferReason, number>> = { paid_recently: 24, asked_recently: 6 };
export const reasonHasClock = (r: OfferReason | null | undefined): r is OfferReason => !!r && REASON_MONTHS[r] != null;

/** The earliest day a reason with a clock still holds on `today`: the same date that many months back (Aug 31 less 6 = Feb 28). */
export function reasonFloor(reason: OfferReason, today: string): string | null {
  const months = REASON_MONTHS[reason];
  if (months == null) return null;
  return addCalendarMonths(today, -months);
}

/**
 * Whether a reason, resting on `reasonOn`, still lets the club email on `today`. Read again on every later email (Send the
 * link again, Email the offer), so an offer can't keep emailing on a reason that has run out. No clock: always.
 */
export function reasonHolds(reason: OfferReason, reasonOn: string | null, today: string): boolean {
  const floor = reasonFloor(reason, today);
  if (floor == null) return true;
  return !!reasonOn && reasonOn >= floor && reasonOn <= today;
}

/** The logo line's item id on the checklist (a package's own items keep their ids). */
export const LOGO_ITEM = 'logo';

export interface DealInvoice {
  number: string;
  issuedOn: string;
  dueOn: string;
  taxKind: 'GST' | 'HST' | null;
  taxRate: number | null;
  tax: number;
  total: number;
}

/** One deal as the club side reads it. */
export interface ClubDeal {
  id: string;
  sponsorId: string;
  /** The business's name: from its link once sent, else the sponsor record's. */
  businessName: string;
  packageId: string;
  packageName: string;
  items: PackageItem[];
  logoOnSite: boolean;
  placeKind: SponsorPlaceKind;
  targetId: string | null;
  /** The place's name as picked (kept for a division or team deleted since). */
  targetName: string | null;
  endsOn: string | null;
  amount: number;
  chargeTax: boolean;
  state: DealState;
  offeredOn: string;
  offeredAt: string;
  offeredByName: string;
  offeredTo: string | null;
  /** null = made as a link only (call (c)): nothing was emailed. */
  emailedAt: string | null;
  openedAt: string | null;
  /** The last new link made with nothing emailed (owner 3A): the history's "new link made, not emailed". */
  linkUnsentAt: string | null;
  formAt: string | null;
  invoice: DealInvoice | null;
  /** A revised invoice's day (Part 3a): its amount or tax changed after it was issued, the number kept. */
  revisedOn: string | null;
  /** When the invoice (or its latest revision) was emailed; null = shown on the link only (the email failed or predates 3a). */
  invoiceEmailedAt: string | null;
  /** The day the last payment brought the balance to nothing (the Paid callout, the list's "Paid Feb 14 · cheque"). */
  paidOn: string | null;
  /** How the last arrival came, for the list's grey line. */
  paidHow: string | null;
  /** What has arrived so far (live payments only). Money on a deal locks its terms and its Withdraw until it is voided. */
  paidAmount: number;
  withdrawn: { at: string; byName: string; reason: string } | null;
  /** The checklist's ticks: item id → who and when. */
  done: Record<string, { at: string; byName: string }>;
}

// ── Delivery ────────────────────────────────────────────────────────────────────────────────────────

/** The checklist's lines: the logo line first when the package has it on, then the package's own items. */
export function checklistOf(d: Pick<ClubDeal, 'logoOnSite' | 'items'>): { id: string; logo: boolean; text: string | null }[] {
  return [...(d.logoOnSite ? [{ id: LOGO_ITEM, logo: true, text: null }] : []), ...d.items.map(i => ({ id: i.id, logo: false, text: i.text }))];
}

export function deliveryCount(d: Pick<ClubDeal, 'logoOnSite' | 'items' | 'done'>): { done: number; of: number } {
  const lines = checklistOf(d);
  return { done: lines.filter(l => d.done[l.id]).length, of: lines.length };
}

/** What the business gets, as the link, the email and the invoice list it: the logo line first when it is on. */
export function dealBullets(d: Pick<ClubDeal, 'logoOnSite' | 'items' | 'placeKind' | 'targetName'>): string[] {
  const place = d.placeKind === 'club' ? null : d.targetName;
  return [...(d.logoOnSite ? [SPONSOR_LINK_WORDS.logoBullet(d.placeKind, place)] : []), ...d.items.map(i => i.text)];
}

/** Nothing can be delivered on an open offer: the checklist opens once the deal is invoiced ("Items done" is a dash before). */
export const checklistOpen = (d: Pick<ClubDeal, 'state'>): boolean => d.state === 'invoiced' || d.state === 'paid';

/** Delivered = paid and every item ticked (ask 4). A package with no items is delivered when paid. */
export function isDelivered(d: Pick<ClubDeal, 'state' | 'logoOnSite' | 'items' | 'done'>): boolean {
  if (d.state !== 'paid') return false;
  const c = deliveryCount(d);
  return c.done === c.of;
}

export function bandOf(d: Pick<ClubDeal, 'state' | 'logoOnSite' | 'items' | 'done'>): DealBand {
  if (d.state === 'withdrawn') return 'withdrawn';
  return isDelivered(d) ? 'delivered' : d.state;
}

/** Withdraw until paid (ask 4) — and while no money stands on it (a part payment is voided first, Part 3a). */
export const canWithdraw = (d: Pick<ClubDeal, 'state' | 'paidAmount'>): boolean => d.state !== 'paid' && d.state !== 'withdrawn' && d.paidAmount === 0;

/** An issued invoice's amount or tax may change (the revised invoice, Part 3a) only while no payment stands on it. */
export const canRevise = (d: Pick<ClubDeal, 'state' | 'paidAmount'>): boolean => d.state === 'invoiced' && d.paidAmount === 0;

/** Record a payment: on an invoiced deal with something still owing. */
export const canRecordPayment = (d: Pick<ClubDeal, 'state' | 'invoice'>): boolean => d.state === 'invoiced' && !!d.invoice;

/** The link is open to the business while the offer is (offered or form received); after that it shows the invoice. */
export const linkTakesForm = (d: Pick<ClubDeal, 'state'>): boolean => d.state === 'offered' || d.state === 'form_received';

/**
 * Should the deal's place show (ask 5)? Paid, or the club ticked the logo line — and only when the package has the logo on.
 * The last day is the place's own (`placeShowing`), so it comes down by itself.
 */
export const dealPlaceUp = (d: Pick<ClubDeal, 'state' | 'logoOnSite' | 'done'>): boolean =>
  d.logoOnSite && d.state !== 'withdrawn' && (d.state === 'paid' || !!d.done[LOGO_ITEM]);

// ── Packages: what has taken them (ask 7) ───────────────────────────────────────────────────────────

/** Paid, invoiced and offered deals take a place; a withdrawn one frees it; a form received is still an offer. */
export function takenOf(deals: readonly Pick<ClubDeal, 'state' | 'packageId'>[], packageId: string): PackageTaken {
  const t = { paid: 0, invoiced: 0, offered: 0 };
  for (const d of deals) {
    if (d.packageId !== packageId) continue;
    if (d.state === 'paid') t.paid++;
    else if (d.state === 'invoiced') t.invoiced++;
    else if (d.state === 'offered' || d.state === 'form_received') t.offered++;
  }
  return t;
}

/** Who holds a place (the Offer window's "Taken: Kowalski Plumbing, invoiced" — it warns, never blocks, ask 6). */
export function holdersOf(
  deals: readonly Pick<ClubDeal, 'state' | 'placeKind' | 'targetId' | 'businessName' | 'id'>[],
  kind: SponsorPlaceKind, targetId: string | null, exceptDealId?: string,
): { name: string; state: DealState }[] {
  return deals
    .filter(d => d.id !== exceptDealId && d.state !== 'withdrawn' && d.placeKind === kind && (d.targetId ?? null) === (targetId ?? null))
    .map(d => ({ name: d.businessName, state: d.state }));
}

// ── Money ───────────────────────────────────────────────────────────────────────────────────────────

const cents = (n: number) => Math.round(n * 100);

/**
 * A deal's figures. The tax is charged only when the club is registered AND the deal's switch is on, at the rate of the
 * business's invoice province on the issue day; an unknown or missing province charges nothing and says so (`noRate`).
 */
export function dealFigures(input: { amount: number; chargeTax: boolean; registered: boolean; province: string | null; on: string }): {
  rate: GstHstRate | null; tax: number; total: number; noRate: boolean;
} {
  const taxing = input.registered && input.chargeTax;
  const rate = taxing ? gstHstRateOn(input.province, input.on) : null;
  const tax = rate ? Math.round(cents(input.amount) * rate.rate / 100) / 100 : 0;
  return { rate, tax, total: (cents(input.amount) + cents(tax)) / 100, noRate: taxing && !rate };
}

/** "2027-014": the year and the club's count in it, printed to 3 (the coach invoice's scheme). */
export const invoiceNumber = formatInvoiceNumber;

/** The invoice's year is the calendar year of its issue day (club time). */
export const invoiceYearOf = (issuedOn: string): number => Number(issuedOn.slice(0, 4));

export const dueOnFrom = (issuedOn: string, days: number): string => addCalendarDays(issuedOn, days);

/** Past due: the day after its due day, in the club's day. */
export const isOverdue = (inv: Pick<DealInvoice, 'dueOn'> | null, today: string): boolean => !!inv && today > inv.dueOn;

// ── Who may be emailed an offer (ask 13, /legal §1) ─────────────────────────────────────────────────

export type EmailBar =
  | { kind: 'unsubscribed'; on: string }
  | { kind: 'do_not_offer'; on: string }
  | { kind: 'family_opt_out' }
  | null;

/** Why an address can't be emailed an offer, or null. The stop list is read first (it carries a date). */
export function emailBarFor(
  email: string | null, stops: ReadonlyMap<string, { source: 'unsubscribe' | 'club'; on: string }>, familyOptOuts: ReadonlySet<string>,
): EmailBar {
  if (!email) return null;
  const key = email.trim().toLowerCase();
  const stop = stops.get(key);
  if (stop) return stop.source === 'unsubscribe' ? { kind: 'unsubscribed', on: stop.on } : { kind: 'do_not_offer', on: stop.on };
  return familyOptOuts.has(key) ? { kind: 'family_opt_out' } : null;
}

// ── What the Offer window sends ─────────────────────────────────────────────────────────────────────

type Ok<T> = { ok: true; value: T } | { ok: false; error: string; field?: string };

export interface OfferInput {
  /** An existing business, or a new one (name + email). */
  sponsorId: string | null;
  newName: string | null;
  email: string | null;
  packageId: string;
  targetId: string | null;
  amount: number;
  endsOn: string | null;
  chargeTax: boolean;
  /** Required to email; absent for "Make the link only" (nothing is sent, so nothing needs proving). */
  reason: OfferReason | null;
  /** The day the reason rests on: its When? for a reason with a clock, else today (the day the offer went). Null with no reason. */
  reasonOn: string | null;
  note: string | null;
  send: boolean;
}

export const OFFER_NOTE_MAX = 1000;

/** What a reason's errors say: none picked, no When?, a day still to come, a day too long ago (said per reason). */
export interface ReasonErrors { reason: string; when: string; whenFuture: string; whenOld: (reason: OfferReason) => string }

/** Why the club may email them, and the day it rests on (Offer a deal's "The email", and Email the offer on a link made only). */
export function parseReasonInput(b: Record<string, unknown>, today: string, errors: ReasonErrors): Ok<{ reason: OfferReason; reasonOn: string }> {
  const reason = OFFER_REASONS.find(r => r === b.reason) ?? null;
  if (!reason) return { ok: false, error: errors.reason, field: 'reason' };
  if (!reasonHasClock(reason)) return { ok: true, value: { reason, reasonOn: today } };
  const on = typeof b.reasonOn === 'string' ? b.reasonOn.trim() : '';
  if (!on || !isCalendarDate(on)) return { ok: false, error: errors.when, field: 'reasonOn' };
  if (on > today) return { ok: false, error: errors.whenFuture, field: 'reasonOn' };
  if (!reasonHolds(reason, on, today)) return { ok: false, error: errors.whenOld(reason), field: 'reasonOn' };
  return { ok: true, value: { reason, reasonOn: on } };
}

/** The Offer window's fields as typed. Errors name the field; the words are the caller's (`errors` below). */
export function parseOfferInput(b: Record<string, unknown>, today: string, errors: ReasonErrors & {
  business: string; newName: string; email: string; pkg: string; target: string; amount: string; lastDay: string; note: string;
}): Ok<OfferInput> {
  const send = b.send !== false;
  const sponsorId = isUuid(b.sponsorId) ? b.sponsorId : null;
  const newName = typeof b.newName === 'string' && b.newName.trim() ? b.newName.trim() : null;
  if (!sponsorId && !newName) return { ok: false, error: errors.business, field: 'business' };
  if (newName && newName.length > 80) return { ok: false, error: errors.newName, field: 'business' };
  let email: string | null = null;
  if (typeof b.email === 'string' && b.email.trim()) {
    const e = checkEmail(b.email);
    if (!e.ok || !e.value) return { ok: false, error: errors.email, field: 'email' };
    email = e.value.toLowerCase();
  }
  // A new business needs an email only to be emailed; a link handed over in person needs none.
  if (send && !email) return { ok: false, error: errors.email, field: 'email' };
  const packageId = isUuid(b.packageId) ? b.packageId : null;
  if (!packageId) return { ok: false, error: errors.pkg, field: 'package' };
  const targetId = isUuid(b.targetId) ? b.targetId : null;
  const amount = parsePrice(b.amount);
  if (amount == null) return { ok: false, error: errors.amount, field: 'amount' };
  const endsOn = typeof b.endsOn === 'string' && b.endsOn.trim() ? b.endsOn.trim() : null;
  if (endsOn && !isCalendarDate(endsOn)) return { ok: false, error: errors.lastDay, field: 'endsOn' };
  const why = send ? parseReasonInput(b, today, errors) : null;
  if (why && !why.ok) return why;
  const note = typeof b.note === 'string' && b.note.trim() ? b.note.trim() : null;
  if (note && note.length > OFFER_NOTE_MAX) return { ok: false, error: errors.note, field: 'note' };
  return { ok: true, value: { sponsorId, newName, email, packageId, targetId, amount, endsOn, chargeTax: b.chargeTax === true, reason: why?.ok ? why.value.reason : null, reasonOn: why?.ok ? why.value.reasonOn : null, note, send } };
}

// ── What the business sends from its link ───────────────────────────────────────────────────────────

export interface BusinessInput {
  name: string; contactName: string; email: string; phone: string | null; website: string | null;
  /** The business address: all four or none (owner 2026-11-23: required only when the deal charges GST/HST). */
  street: string | null; city: string | null; province: string | null; postal: string | null;
}

export const BUSINESS_FIELDS = ['name', 'contactName', 'email', 'phone', 'website', 'street', 'city', 'province', 'postal'] as const;
export type BusinessField = (typeof BUSINESS_FIELDS)[number];

/**
 * Every fixed field the business is asked (ask 8). Required: name, contact, email; phone, website optional. The business
 * address (owner 2026-11-23) is required only when the deal charges GST/HST — its province sets the rate, and an email
 * address doesn't count as one. Otherwise it only prints on the invoice, so it may be left blank, but not half-typed: a
 * part of an address can't print and can't set a rate, so typing any of it asks for the rest.
 */
export function parseBusinessInput(
  b: Record<string, unknown>, provinces: ReadonlySet<string>, words: Record<BusinessField, string>,
  opts: { addressRequired: boolean },
): { ok: true; value: BusinessInput } | { ok: false; errors: Partial<Record<BusinessField, string>> } {
  const errors: Partial<Record<BusinessField, string>> = {};
  const text = (k: BusinessField, max: number, required: boolean): string | null => {
    const v = typeof b[k] === 'string' ? (b[k] as string).trim() : '';
    if (!v) { if (required) errors[k] = words[k]; return null; }
    if (v.length > max) { errors[k] = words[k]; return null; }
    return v;
  };
  const name = text('name', 80, true);
  const contactName = text('contactName', 120, true);
  const e = checkEmail(b.email);
  const email = e.ok && e.value ? e.value.toLowerCase() : null;
  if (!email) errors.email = words.email;
  const phone = text('phone', 40, false);
  const w = checkLink(typeof b.website === 'string' ? b.website.trim() : b.website);
  if (!w.ok) errors.website = words.website;
  const typed = (k: BusinessField) => typeof b[k] === 'string' && (b[k] as string).trim() !== '';
  const address = opts.addressRequired || (['street', 'city', 'province', 'postal'] as const).some(typed);
  const street = text('street', 200, address);
  const city = text('city', 100, address);
  const provinceRaw = typeof b.province === 'string' ? b.province.trim().toUpperCase() : '';
  if (address && !provinces.has(provinceRaw)) errors.province = words.province;
  const postal = text('postal', 20, address);
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name: name!, contactName: contactName!, email: email!, phone, website: w.ok ? w.value : null,
      street: address ? street : null, city: address ? city : null, province: address ? provinceRaw : null, postal: address ? postal : null,
    },
  };
}
