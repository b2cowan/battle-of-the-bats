import { notFound } from 'next/navigation';
import { readDeckBySlug } from '@/lib/pitch-deck-store';
import { builtSlides, resolveDeckIds } from '@/lib/walkthrough-content';
import ProspectDeckPage from '@/components/marketing/ProspectDeckPage';
import { marketingMetadata } from '@/lib/marketing-metadata';

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

// Unlisted: the slug is the gate, so the page stays out of search (noindex). The title says what the page is when the
// link is shared (P7); it names no prospect.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return marketingMetadata({ title: 'Your walkthrough', path: '/pitch/' + slug, noindex: true });
}

export default async function PitchLinkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const deck = await readDeckBySlug(slug);
  if (!deck || deck.persona !== null) notFound();
  const { ids } = resolveDeckIds(null, deck.slideIds);
  const slides = builtSlides(ids);
  if (slides.length === 0) notFound();
  return <ProspectDeckPage slides={slides} />;
}
