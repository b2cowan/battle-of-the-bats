import { redirect } from 'next/navigation';

/**
 * A FAMILY'S ADDRESS (Club Tier Stage 5b, Ask 5): `/families/{personId}` stays the family's address — a copied link, an
 * old bookmark, the layout sweep's `admin-family` — but a family is no longer a page of its own: it is a record OVER the
 * Families list. So this address lands on the list with the family asked for (`?family=`, and the list it was read from
 * when the link carries one, `?show=`); the list opens the record and its window writes this address back into the URL
 * bar through its own Back step (KitDialog `address`, the allocation window's pattern), and takes it away on close.
 */
export default async function FamilyAddress({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string; personId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ orgSlug, personId }, search] = await Promise.all([params, searchParams]);
  const qs = new URLSearchParams();
  const show = typeof search.show === 'string' ? search.show : null;
  if (show) qs.set('show', show);
  qs.set('family', personId);
  // The slug encoded: a decoded "%2F" must never make this a protocol-relative redirect off the site (/review 2026-10-17).
  redirect(`/${encodeURIComponent(orgSlug)}/admin/families?${qs}`);
}
