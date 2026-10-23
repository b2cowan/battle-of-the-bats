import 'server-only';

/**
 * THE SHARE CARDS' TWO FACES (The public face, warm: S5). The marketing card and the neutral club card are drawn by the
 * image renderer, which needs TrueType; Google Fonts serves it to a request with no browser user agent. Fonts are never
 * copied into the repo (the self-hosting proposal was ruled NO-GO, 2026-10-07).
 *
 * The neutral card is uncached and asked for by crawlers, so the faces are kept in memory once fetched: a crawler burst
 * costs one fetch, not one per request. A failed fetch is not kept as fonts, but it is remembered for a minute, so a slow
 * or down Google Fonts costs one timed-out attempt a minute rather than one per crawler hit. A failed draw falls back to the
 * renderer's own face rather than failing: ⚠ an EMPTY list must not be passed on — next/og reads `fonts || defaultFonts`,
 * so `[]` would replace its default face with none and the draw would throw. Use `cardFonts()` to build the options.
 */

export type CardFont = { name: string; data: ArrayBuffer; weight: 500 | 700; style: 'normal' };

const CSS_URL = 'https://fonts.googleapis.com/css2?family=Inter:wght@500;700&family=Barlow+Condensed:wght@700';
const FETCH_TIMEOUT_MS = 3000;
const RETRY_AFTER_FAILURE_MS = 60_000;

let kept: Promise<CardFont[]> | null = null;
let failedAt = 0;

const get = (url: string) => fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });

/** A font file worth keeping: a 2xx answer from Google's font host that starts with a TrueType/OpenType header. */
async function fontFile(url: string): Promise<ArrayBuffer> {
  if (!url.startsWith('https://fonts.gstatic.com/')) throw new Error('unexpected font host');
  const res = await get(url);
  if (!res.ok) throw new Error('font fetch failed');
  const data = await res.arrayBuffer();
  const tag = new DataView(data).getUint32(0);
  if (tag !== 0x00010000 && tag !== 0x4f54544f) throw new Error('not a TrueType/OpenType font'); // an error page is never a face
  return data;
}

async function fetchFonts(): Promise<CardFont[]> {
  try {
    const css = await (await get(CSS_URL)).text();
    const faces = [...css.matchAll(/font-family:\s*'([^']+)';[^}]*?font-weight:\s*(\d+);[^}]*?src:\s*url\(([^)]+)\)/g)];
    return await Promise.all(faces.map(async ([, name, weight, url]) => ({
      name, weight: Number(weight) as 500 | 700, style: 'normal' as const, data: await fontFile(url),
    })));
  } catch {
    return [];
  }
}

/** The faces, fetched once and kept. An empty result (a failed fetch) is dropped and not retried for a minute. */
export async function loadCardFonts(): Promise<CardFont[]> {
  if (!kept) {
    if (Date.now() - failedAt < RETRY_AFTER_FAILURE_MS) return [];
    kept = fetchFonts().then((fonts) => {
      if (fonts.length === 0) { kept = null; failedAt = Date.now(); }
      return fonts;
    });
  }
  return kept;
}

/** What a card needs from the faces: the names to draw with (the renderer's own face when a fetch failed) and the options. */
export async function cardFonts(): Promise<{ sans: string; display: string; fonts: CardFont[] | undefined }> {
  const fonts = await loadCardFonts();
  const has = (name: string) => fonts.some((f) => f.name === name);
  const sans = has('Inter') ? 'Inter' : 'sans-serif';
  const display = has('Barlow Condensed') ? 'Barlow Condensed' : sans;
  return { sans, display, fonts: fonts.length ? fonts : undefined };
}
