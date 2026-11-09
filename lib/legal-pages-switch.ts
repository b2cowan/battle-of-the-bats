/**
 * The switch for the legal pages (GST/HST Stage 6 step 6.2, rulings Q1–Q2): the Terms of Service and the Privacy
 * Policy on FieldLogicHQ's own site. Nothing is published until step 6.7, so the feature has TWO locks, the
 * `lib/online-payments-switch.ts` pattern:
 *
 *  1. `LEGAL_PAGES_PREVIEW` — a server-only env var: absent or anything other than the literal 'true' means OFF.
 *     Deliberately not `NEXT_PUBLIC_`: the browser learns the answer from the server (`LegalLinksProvider`). It opens a
 *     PREVIEW of the drafts (filtered of every owner note, under a "Draft" banner), and ONLY where the Stripe key is a
 *     test key — the same "this is not production" identity the payments switch uses. A live key, or no key at all,
 *     never previews, so a console setting alone cannot put a draft in front of a customer.
 *  2. `LEGAL_PAGES_PUBLISHED` — a code constant, false. Step 6.7 flips it, alone, in its own reviewed commit (the
 *     `CHAT_PAUSED` reasoning: a reversal that matters is a commit, not a toggle). `tests/unit/legal-documents.test.ts`
 *     fails the build if it is flipped while either document lacks a dated published version.
 *
 * "off" means: every legal route answers "not found" and no link to them renders anywhere.
 * `tests/unit/legal-pages-switch.test.ts` proves production is off.
 *
 * No `server-only` import so the unit tests can load it; it is still read on the server only — client components get
 * the answer from the provider, never from env.
 */

import { stripeKeyIsTest } from './stripe-mode.ts'; // .ts: scripts import this module under plain Node (the fixture helper)

export const LEGAL_PAGES_PUBLISHED: boolean = false;

export type LegalPagesMode = 'off' | 'preview' | 'published';

export function legalPagesMode(env: Record<string, string | undefined> = process.env): LegalPagesMode {
  if (LEGAL_PAGES_PUBLISHED) return 'published';
  if (env.LEGAL_PAGES_PREVIEW !== 'true') return 'off';
  return stripeKeyIsTest(env.STRIPE_SECRET_KEY) ? 'preview' : 'off'; // never a preview where the key is live or absent
}

/** The one question every legal door asks: is anything about the legal pages visible at all? */
export const legalPagesOn = (env: Record<string, string | undefined> = process.env): boolean => legalPagesMode(env) !== 'off';
