import ClubNotFound from '@/components/public/ClubNotFound';

/**
 * The org section's "not found" boundary (Club Tier Stage 4a, S4-01) — decided from the Next 16 docs
 * (`03-file-conventions/not-found.md`): `notFound()` renders the NEAREST boundary, inside its segment's layout, so this
 * renders inside `app/[orgSlug]/layout.tsx`; a not-found file gets no params, so that layout hands the club down through
 * `PublicClubProvider`. Status is a real 404 because nothing above the club pages streams — keep `loading.tsx` out of
 * them (a streamed 404 is a 200 with a noindex tag). A club that does not exist is refused by the layout, above this.
 */
export default function OrgNotFound() {
  return <ClubNotFound />;
}
