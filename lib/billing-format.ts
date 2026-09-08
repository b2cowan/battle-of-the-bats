/**
 * How billing facts READ — pure, client-safe, no Stripe and no database.
 *
 * It is its own module because the surfaces that show a saved card sit on opposite sides of the
 * server boundary: the Founding Season desk is a client component, and the writer that records the
 * card is server-only (`lib/billing-setup.ts` imports Stripe and the admin client). Putting the
 * label there would make it unimportable from the desk; writing it twice is how the two surfaces
 * start describing one customer's card differently.
 */

/** What we keep about a card on file, for display only. */
export type CardDetails = { brand: string | null; last4: string | null };

/**
 * "Visa ••4242" — the one way a saved card is written, everywhere.
 *
 * Returns null when there is no card, so a caller can use it as the "has a card" test as well as
 * the label. Brand alone ("Visa") is a valid answer: Stripe does not always give us a last4, and a
 * card we cannot fully describe is still a card on file.
 */
export function formatCardOnFile(card: CardDetails | null | undefined): string | null {
  if (!card) return null;
  const brand = card.brand ? card.brand.charAt(0).toUpperCase() + card.brand.slice(1) : 'Card';
  return card.last4 ? `${brand} ••${card.last4}` : brand;
}
