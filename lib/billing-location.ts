import { CANADIAN_PROVINCES } from './canadian-provinces';

/**
 * WHERE A BUYER IS BILLED (GST/HST Stage 1; build prompt docs/projects/active/GST_HST_STAGE1_BUILD_PROMPT.md, owner
 * rulings 2026-11-03). Pure: no I/O, no env. The one place that decides what a valid billing address is, used by the
 * Billing address window, the coach sign-up's Address step, the server's save and checkout check, and platform admin's
 * record. The database CHECKs on billing_locations (migration 433) hold the same
 * shapes, so a row that passed here always stores.
 *
 *   · Countries: Canada and the United States (T1). US sales are CLOSED until the US work is done (T1 follow-up); the
 *     caller passes `usSalesOpen` and a US address is refused while it is false.
 *   · A PO Box on its own is not a billing address.
 *   · A US buyer ticks a declaration (T7), saved with its wording version so later wording never loses what was agreed.
 *   · Review reasons never block a purchase; Stage 2 taxes a flagged buyer as Canadian until it clears.
 */

export type BillingCountry = 'CA' | 'US';

export interface Region { code: string; name: string }

const US_STATES: readonly Region[] = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' }, { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' }, { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' }, { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' }, { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' }, { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' }, { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' }, { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
];

export interface CountryInfo {
  code: BillingCountry;
  name: string;
  regionLabel: string;
  postalLabel: string;
  regions: readonly Region[];
}

/** Canada first: the product's home market, and the default the window opens on. */
export const BILLING_COUNTRIES: readonly CountryInfo[] = [
  { code: 'CA', name: 'Canada', regionLabel: 'Province or territory', postalLabel: 'Postal code', regions: CANADIAN_PROVINCES },
  { code: 'US', name: 'United States', regionLabel: 'State', postalLabel: 'ZIP code', regions: US_STATES },
];

export function countryInfo(code: string | null | undefined): CountryInfo | null {
  return BILLING_COUNTRIES.find((c) => c.code === code) ?? null;
}

export function regionName(country: string | null | undefined, region: string | null | undefined): string | null {
  return countryInfo(country)?.regions.find((r) => r.code === region)?.name ?? null;
}

// ---------------------------------------------------------------------------------------------------------------
// The words (one spelling everywhere; the window, the sign-up step and the server's refusals all read these).

export const BILLING_LOCATION_WORDS = {
  country: 'Choose a country.',
  usClosed: 'We’re not selling in the United States yet.',
  region: { CA: 'Choose a province or territory.', US: 'Choose a state.' } as Record<BillingCountry, string>,
  line1: 'Enter a street address.',
  poBox: 'Enter a street address. A PO Box on its own can’t be a billing address.',
  poBoxHint: 'A PO Box on its own can’t be used.',
  city: 'Enter a city.',
  postal: { CA: 'Enter a postal code like N1H 4H2.', US: 'Enter a ZIP code like 14202.' } as Record<BillingCountry, string>,
  tooLong: 'Keep this shorter.',
  usDeclaration: 'Tick the box to confirm you’re buying from the United States.',
  saveFailed: 'We couldn’t save your address. Try again.',
  /** The server's refusal when a paid checkout is reached with no valid address on file; the screen opens the window instead. */
  required: 'Add a billing address before you pay.',
} as const;

/** The window and the sign-up step (owner drawing 2026-11-03, tabs 2, 4, 5, 6). */
export const BILLING_ADDRESS_FORM_WORDS = {
  title: 'Billing address',
  personTitle: 'Your home address',
  intro: 'Where your club is billed. We use it to work out the sales tax on your plan, and it prints on your invoices.',
  personIntro: 'You buy Premium as yourself, so we ask for your home address. We use it only to work out sales tax, and it prints on your receipts.',
  clubSubhead: 'Club billing address',
  clubPrefilled: 'We filled in your home address. Change it if the club has its own.',
  country: 'Country',
  line1: 'Street address',
  line2: 'Apartment, suite or unit',
  city: 'City',
  continue: 'Continue',
  save: 'Save',
  saving: 'Saving…',
  cancel: 'Cancel',
  change: 'Change',
  saved: 'Billing address saved',
  billedTo: (where: string) => `Billed to ${where}`,
  onFile: (where: string) => `Billing address: ${where}`,
} as const;

/** Platform admin's read-only block on the organization record's Money tab (Part 3). Staff read it; nobody edits it there. */
export const BILLING_LOCATION_CONSOLE_WORDS = {
  heading: 'Billing address',
  club: 'Where the club is billed. Read only: the club changes it on Plan & billing.',
  person: 'A coach buys Premium as a person, so this is the coach’s own home address. It covers every portal they pay for.',
  none: 'No billing address yet. The buyer is asked for one before their first paid checkout.',
  noOwner: 'This portal isn’t billed to a coach, so there is no address to show here.',
  readFailed: 'The billing address couldn’t be read.',
  address: 'Address',
  country: 'Country',
  declaration: 'US declaration',
  declared: (date: string, version: string) => `Ticked ${date} (wording ${version})`,
  review: 'Review',
  needsReview: 'Needs review',
} as const;

/** The stable code every paid path refuses with when the buyer has no valid address (409). */
export const BILLING_ADDRESS_REQUIRED = 'billing_address_required';

/** A buyer's row as the screens read it (GET /api/billing/location). */
export interface StoredBillingLocation extends BillingLocation {
  confirmedAt: string;
  usDeclarationAt: string | null;
  usDeclarationVersion: string | null;
}

/** Provisional wording (owner Ask 2, 2026-11-03; T7: reviewed with the accountant package, not before launch). A new
 *  wording gets a NEW version; the old text stays here so what each buyer saw can still be read. */
export const US_DECLARATION_VERSION = 'us-2026-11-provisional';

export type DeclarationSubject = { kind: 'club'; name: string } | { kind: 'person' };

export function usDeclarationText(subject: DeclarationSubject): string {
  return subject.kind === 'club'
    ? `I confirm that ${subject.name} is located in the United States and is buying this subscription for use in the United States.`
    : 'I confirm that I am located in the United States and am buying this subscription for use in the United States.';
}

// ---------------------------------------------------------------------------------------------------------------
// The check.

export interface BillingLocationInput {
  country?: string | null;
  regionCode?: string | null;
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  postalCode?: string | null;
  /** The US declaration tick-box. Ignored for Canada. */
  usDeclared?: boolean | null;
}

export interface BillingLocation {
  country: BillingCountry;
  regionCode: string;
  line1: string;
  line2: string | null;
  city: string;
  postalCode: string;
}

export type BillingLocationField = 'country' | 'regionCode' | 'line1' | 'line2' | 'city' | 'postalCode' | 'usDeclared';

export type BillingLocationCheck =
  | { ok: true; value: BillingLocation }
  | { ok: false; errors: Partial<Record<BillingLocationField, string>>; usClosed: boolean };

export interface BillingLocationOptions {
  /** False in production until US sales open (owner Ask 5, 2026-11-03). */
  usSalesOpen: boolean;
}

const LINE_MAX = 200;
const CITY_MAX = 100;

// Control characters (a NUL most of all) and lone surrogates cannot be stored in a Postgres text column: strip them here so a
// pasted address is tidied instead of failing the save.
const UNSTORABLE = /[\u0000-\u0008\u000b-\u001f\u007f]|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g;
const tidy = (v: string | null | undefined): string => (v ?? '').replace(UNSTORABLE, '').replace(/\s+/g, ' ').trim();

/** Canada Post: no D, F, I, O, Q or U anywhere; no W or Z as the first letter. Returns "A1A 1A1" or null. */
export function normalizeCanadianPostalCode(raw: string | null | undefined): string | null {
  const s = (raw ?? '').toUpperCase().replace(/[\s-]/g, '');
  if (!/^[ABCEGHJ-NPRSTVXY][0-9][ABCEGHJ-NPRSTV-Z][0-9][ABCEGHJ-NPRSTV-Z][0-9]$/.test(s)) return null;
  return `${s.slice(0, 3)} ${s.slice(3)}`;
}

/** "12345" or "12345-6789" (a space or no separator before the +4 is accepted and normalized). */
export function normalizeZipCode(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim();
  const m = /^(\d{5})(?:[\s-]?(\d{4}))?$/.exec(s);
  if (!m) return null;
  return m[2] ? `${m[1]}-${m[2]}` : m[1];
}

/** A street line that STARTS with a post-office-box designator and a number ("PO Box 412", "P.O. Box 12, Station A",
 *  "Box 3", "CP 34", "Case postale 5", "PMB 9"). "120 Elm Street, Box 3" and "Box Elder Road" are street addresses. */
export function isPoBoxOnly(line1: string | null | undefined): boolean {
  const s = tidy(line1).toLowerCase().replace(/\./g, '');
  return /^(p\s*o\s*box|pob|post\s+office\s+box|box|c\s*p|case\s+postale|bo[iî]te\s+postale|pmb)\s*#?\s*\d+/.test(s);
}

export function checkBillingLocation(input: BillingLocationInput, opts: BillingLocationOptions): BillingLocationCheck {
  const W = BILLING_LOCATION_WORDS;
  const errors: Partial<Record<BillingLocationField, string>> = {};
  const country = countryInfo(tidy(input.country).toUpperCase());
  if (!country) return { ok: false, errors: { country: W.country }, usClosed: false };
  if (country.code === 'US' && !opts.usSalesOpen) return { ok: false, errors: { country: W.usClosed }, usClosed: true };

  const regionCode = tidy(input.regionCode).toUpperCase();
  if (!country.regions.some((r) => r.code === regionCode)) errors.regionCode = W.region[country.code];

  const line1 = tidy(input.line1);
  if (!line1) errors.line1 = W.line1;
  else if (line1.length > LINE_MAX) errors.line1 = W.tooLong;
  else if (isPoBoxOnly(line1)) errors.line1 = W.poBox;

  const line2 = tidy(input.line2);
  if (line2.length > LINE_MAX) errors.line2 = W.tooLong;

  const city = tidy(input.city);
  if (!city) errors.city = W.city;
  else if (city.length > CITY_MAX) errors.city = W.tooLong;

  const postalCode = country.code === 'CA' ? normalizeCanadianPostalCode(input.postalCode) : normalizeZipCode(input.postalCode);
  if (!postalCode) errors.postalCode = W.postal[country.code];

  if (country.code === 'US' && input.usDeclared !== true) errors.usDeclared = W.usDeclaration;

  if (Object.keys(errors).length > 0) return { ok: false, errors, usClosed: false };
  return { ok: true, value: { country: country.code, regionCode, line1, line2: line2 || null, city, postalCode: postalCode as string } };
}

/** A stored address a paid checkout still accepts today, or null: a US one stops being one while US sales are closed,
 *  and a US one without its declaration never was. The server's checkout check and the screens' "on file" both read this. */
export function storedLocationStillValid(location: StoredBillingLocation, usSalesOpen: boolean): BillingLocation | null {
  const checked = checkBillingLocation({ ...location, usDeclared: location.usDeclarationAt !== null }, { usSalesOpen });
  return checked.ok ? checked.value : null;
}

// ---------------------------------------------------------------------------------------------------------------
// Reading it back.

/** "120 Elm Street, Guelph, Ontario N1H 4H2" — the platform-admin record and the plan card's line. */
export function formatBillingAddress(loc: BillingLocation): string {
  const parts = [loc.line1, loc.line2, loc.city].filter(Boolean);
  return `${parts.join(', ')}, ${regionName(loc.country, loc.regionCode) ?? loc.regionCode} ${loc.postalCode}`;
}

/** "120 Elm Street, Guelph, Ontario" — the "Billed to … Change" line. */
export function formatBilledTo(loc: BillingLocation): string {
  return `${loc.line1}, ${loc.city}, ${regionName(loc.country, loc.regionCode) ?? loc.regionCode}`;
}

/** The Stripe customer's address, so invoices and Stripe Tax read the same place we do. ONE WAY ONLY (owner ruling
 *  2026-11-04, GST/HST Stage 1 Part 3): Stripe's billing page no longer edits the address (lib/stripe-portal-settings.ts),
 *  so nothing reads a Stripe customer's address back into our record. */
export function toStripeAddress(loc: BillingLocation): {
  line1: string; line2: string; city: string; state: string; postal_code: string; country: string;
} {
  return { line1: loc.line1, line2: loc.line2 ?? '', city: loc.city, state: loc.regionCode, postal_code: loc.postalCode, country: loc.country };
}

// ---------------------------------------------------------------------------------------------------------------
// Needs review (owner Ask 3, 2026-11-03: stores the flag, shows it to platform admin, never blocks or emails).

export const REVIEW_REASONS = [
  'country_changed_after_paying',
  // RETIRED 2026-11-04 (Part 3: Stripe's page no longer edits the address, so no edit there can be invalid). Kept because
  // migration 433's CHECK still allows it; nothing sets it, and a valid save on our own form still clears it.
  'stripe_edit_invalid',
  // Worked out when read (`currentReview`), never stored since Part 3; the CHECK allows them as migration 433 wrote it.
  'card_country_mismatch',
  'payout_country_mismatch',
] as const;
export type ReviewReason = (typeof REVIEW_REASONS)[number];

/** A country inside a sentence: "the United States", "Canada", or the bare code for any other card country. */
const countryLabel = (code: string | null | undefined): string => {
  const upper = code ? code.toUpperCase() : null;
  if (upper === 'US') return 'the United States';
  return countryInfo(upper)?.name ?? upper ?? 'another country';
};

/** The one sentence platform staff read beside the amber "Needs review" chip. */
export function reviewSentence(
  reason: ReviewReason,
  facts: { country?: string | null; previousCountry?: string | null; cardCountry?: string | null; payoutCountry?: string | null },
): string {
  switch (reason) {
    case 'country_changed_after_paying':
      return `The country changed from ${countryLabel(facts.previousCountry)} to ${countryLabel(facts.country)} after paying.`;
    case 'stripe_edit_invalid':
      return 'An address change on Stripe’s billing page wasn’t a valid billing address, so the one shown was kept.';
    case 'card_country_mismatch':
      return `The address is in ${countryLabel(facts.country)}, but the card was issued in ${countryLabel(facts.cardCountry)}.`;
    case 'payout_country_mismatch':
      return `The address is in ${countryLabel(facts.country)}, but the club’s payouts go to ${countryLabel(facts.payoutCountry)}.`;
  }
}

/** What platform admin's Money tab reads (lib/billing-location-server.ts readBillingLocationForConsole). */
export type ConsoleBillingLocation =
  | { buyer: 'club' | 'person'; location: StoredBillingLocation | null; review: { reason: ReviewReason; note: string | null; setAt: string | null } | null }
  | { buyer: 'none' };

export const REVIEW_CONSEQUENCE = 'Until this is looked at, the buyer is treated as Canadian.';

/** T7's outside-Canada sign, compared: a US address wants a US card and US payouts; a Canadian address with a US card
 *  or US payouts is the reverse disagreement. A missing card or payout country is no evidence either way. The card is
 *  read first. Country codes from Stripe may be lower case. */
export function evidenceReview(facts: {
  country: string; cardCountry?: string | null; payoutCountry?: string | null;
}): ReviewReason | null {
  const card = facts.cardCountry ? facts.cardCountry.toUpperCase() : null;
  const payout = facts.payoutCountry ? facts.payoutCountry.toUpperCase() : null;
  const disagrees = (other: string | null) =>
    other !== null && (facts.country === 'US' ? other !== 'US' : other === 'US');
  if (disagrees(card)) return 'card_country_mismatch';
  if (disagrees(payout)) return 'payout_country_mismatch';
  return null;
}

/**
 * THE "needs review" answer, worked out when it is READ (owner Part 3 Ask 1, 2026-11-04): platform admin's record now, Stage
 * 2's tax decision later (a buyer with an answer here is taxed as Canadian). One reason at a time:
 *   · a STORED flag wins and stays: a Canada↔US change after paying (nothing in Stage 1 answers it; Stage 2's tax-reason
 *     record gives staff the way), or the retired invalid-Stripe-edit flag (until the buyer's own valid save);
 *   · otherwise the card and payout evidence as it stands now, so its flag appears and clears with the facts (a corrected
 *     address, a new card, a payout account in the right country, a disconnected one) and is never stored to go stale.
 */
export function currentReview(facts: {
  country: string; cardCountry?: string | null; payoutCountry?: string | null;
  storedReason?: ReviewReason | null; storedNote?: string | null;
}): { reason: ReviewReason; note: string } | null {
  if (facts.storedReason) return { reason: facts.storedReason, note: facts.storedNote ?? reviewSentence(facts.storedReason, facts) };
  const evidence = evidenceReview(facts);
  return evidence ? { reason: evidence, note: reviewSentence(evidence, facts) } : null;
}

/** Owner Ask 4: a change between Canada and the US after a paid subscription exists is saved AND flagged. */
export function countryChangeReview(previous: string | null | undefined, next: string, hasPaid: boolean): ReviewReason | null {
  return hasPaid && previous && previous !== next ? 'country_changed_after_paying' : null;
}
