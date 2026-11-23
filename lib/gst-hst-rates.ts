/**
 * THE GST/HST RATE FOR A CANADIAN PROVINCE — the one table. Moved here from `lib/console-money-needs-look.ts` (Board Ready
 * Stage 6 Part 2, 2026-11-22) so the owner's console check and a club's sponsorship invoice read the SAME rates (ask 9: the
 * rate comes from the province of the business's invoice address, never a hard-coded 13%). Pure and client-safe.
 *
 * Where the rates come from: the /accounting agent's research (CRA "GST/HST rates by province", the page dated 2025-04-01,
 * accessed 2026-10-31, file last verified 2026-11-05). A guard test names these dates; a rate change is a change to that file
 * first, then here.
 *
 * ⚠ GST/HST only. BC, MB, SK and QC charge their own PST/RST/QST beside it, which this table never answers: a business in
 * one of them is charged the 5% GST and nothing else (a tax professional confirms; QST/PST on a sponsorship is not in Stage 6).
 */
import { orgDayKey } from './timezone';

export const GST_HST_RATES_SOURCE = {
  doc: 'docs/agents/accounting/GST_HST_ON_SUBSCRIPTIONS_CANADA.md',
  ratesAsOf: '2025-04-01',
  verified: '2026-11-05',
} as const;

const HST_RATES: Readonly<Record<string, number>> = { ON: 13, NB: 15, NL: 15, PE: 15, NS: 14 };
/** BC, MB, SK and QC charge their own PST/RST/QST beside it: that is not GST/HST and is never compared here. */
const GST_ONLY = new Set(['AB', 'BC', 'MB', 'SK', 'QC', 'NT', 'NU', 'YT']);
/** Nova Scotia's HST fell from 15% to 14% on this day. */
const NS_CUT = '2025-04-01';

export type GstHstRate = { kind: 'GST' | 'HST'; rate: number };

/** The GST/HST a sale to this Canadian province owed on its issue day; null for a code we do not know. */
export function gstHstRateFor(region: string | null | undefined, issuedAt: string): GstHstRate | null {
  const code = (region ?? '').trim().toUpperCase();
  if (code === 'NS') return { kind: 'HST', rate: orgDayKey(issuedAt) < NS_CUT ? 15 : 14 };
  if (HST_RATES[code] != null) return { kind: 'HST', rate: HST_RATES[code] };
  if (GST_ONLY.has(code)) return { kind: 'GST', rate: 5 };
  return null;
}

/** The same answer for a plain club-time day ("2027-03-09") — what an offer, a deal page and an invoice all hold. */
export function gstHstRateOn(region: string | null | undefined, day: string): GstHstRate | null {
  return gstHstRateFor(region, `${day}T12:00:00.000Z`);
}
