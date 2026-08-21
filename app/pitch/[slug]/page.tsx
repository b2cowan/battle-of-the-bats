import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { readDeckBySlug } from '@/lib/pitch-deck-store';
import { builtSlides, resolveDeckIds } from '@/lib/walkthrough-content';
import ProspectDeckPage from '@/components/marketing/ProspectDeckPage';

/**
 * /pitch/[slug] — an owner-composed deck on its unlisted link (Pitch Deck Studio stage D).
 *
 * PUBLIC and UNLISTED, by owner ruling 2: the slug is unguessable (minted from crypto
 * randomness at deck creation), the page is `noindex`, and there is no login — a prospect on a
 * call cannot be asked to sign in. It renders slides and fixed code copy only; the deck's name
 * (the prospect label) and purpose are internal and never reach the rendering.
 *
 * ⚠ STRICT where the walkthrough pages are lenient — an owner deck has NO code fallback (the
 * stage C stop line), so a missing row, a rotten one, or one with no built slide left answers
 * 404 rather than rendering something the owner never composed. The studio is where "why does
 * my link 404" gets its sentence.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'A FieldLogicHQ walkthrough',
  robots: { index: false, follow: false },
};

export default async function PitchLinkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const deck = await readDeckBySlug(slug);
  if (!deck || deck.persona !== null) notFound();
  const { ids } = resolveDeckIds(null, deck.slideIds);
  const slides = builtSlides(ids);
  if (slides.length === 0) notFound();
  return <ProspectDeckPage slides={slides} />;
}
