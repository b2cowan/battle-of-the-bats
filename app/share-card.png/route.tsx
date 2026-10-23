import { ImageResponse } from 'next/og';
import { MARK_BARE_VIEWBOX, MARK_PATH_MAIN, MARK_TILE_NUDGE_X, BRAND_INK, BRAND_OLIVE, BRAND_PAPER } from '@/lib/brand-mark';
import { MARKETING_SHARE_CARD } from '@/lib/marketing-metadata';
import { cardFonts } from '@/lib/share-card-fonts';

/**
 * THE MARKETING SITE'S SHARE CARD (The public face, warm: S4; owner Ask 8 A, 2026-10-23; words `/marketing` item 7).
 * One card for every marketing page: the name, the brand's line, and the mark's tile as the card's one accent. It
 * carries no other sentence, so nothing on it can go stale. Drawn with the renderer the club cards use (next/og), at
 * 1200 × 630, on the paper. Each page's own title and description travel beside it (lib/marketing-metadata.ts).
 *
 * The file-like address keeps it off the org-slug space and out of robots.txt's /api/ rule (a link-preview crawler that
 * honours robots.txt would otherwise be refused the image).
 */

// Re-drawn once a day, so a font fetch that failed while the card was first drawn does not freeze the plain-face card
// until the next deploy.
export const revalidate = 86400;

export async function GET() {
  const { sans, display, fonts } = await cardFonts();
  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative',
        background: BRAND_PAPER, color: BRAND_INK, padding: '72px 80px', fontFamily: sans,
      }}>
        {/* The lockup: the bare olive mark, "FieldLogic" in ink, "HQ" in olive (VISUAL_IDENTITY.md §4). */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <svg width={40} height={40} viewBox={MARK_BARE_VIEWBOX}>
            <path d={MARK_PATH_MAIN} fill={BRAND_OLIVE} />
          </svg>
          <div style={{ display: 'flex', fontSize: 34, fontWeight: 700, letterSpacing: -0.6 }}>
            <span>FieldLogic</span>
            <span style={{ color: BRAND_OLIVE, fontWeight: 500 }}>HQ</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 96, fontFamily: display, fontSize: 124, fontWeight: 700, lineHeight: 1 }}>
          <span>Less admin.</span>
          <span style={{ color: BRAND_OLIVE }}>More sport.</span>
        </div>
        <div style={{
          position: 'absolute', right: 80, bottom: 72, width: 176, height: 176, borderRadius: 36, background: BRAND_OLIVE,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width={176} height={176} viewBox="0 0 64 64">
            <g transform={`translate(${MARK_TILE_NUDGE_X} 0)`}>
              <path d={MARK_PATH_MAIN} fill={BRAND_PAPER} />
            </g>
          </svg>
        </div>
      </div>
    ),
    {
      width: MARKETING_SHARE_CARD.width,
      height: MARKETING_SHARE_CARD.height,
      fonts,
      headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800' },
    },
  );
}
