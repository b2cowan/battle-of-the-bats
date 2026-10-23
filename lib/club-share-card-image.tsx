import 'server-only';
import { ImageResponse } from 'next/og';
import { clubColourRoles } from './club-colour-roles';
import { deriveLogoDataUrl } from './export/resolve-pdf-settings';
import { clubInitials } from './club-site';
import type { ShareCardText } from './club-share';
import type { Organization } from './types';
import { cardFonts } from './share-card-fonts';
import { BRAND_INK, BRAND_NAME, BRAND_NAME_HQ, BRAND_OLIVE, BRAND_PAPER, MARK_BARE_VIEWBOX, MARK_PATH_MAIN, MARK_TILE_NUDGE_X } from './brand-mark';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A CLUB PAGE'S PREVIEW CARD, DRAWN (Club Tier Stage 4b-2b; End state 8, Ask 7A, S4-02). One 1200 × 630 image per club
 * home, team and tryout: the club's colour as the ground (the site's one derivation, `clubColourRoles`, so the card is
 * the same colour as the bar a family lands on), its logo — or its initials on the logo tile — the page's words, and the
 * accent as the bottom edge. Never a player: the words are `ShareCardText`, built from names alone (lib/club-share.ts).
 *
 * A club whose site is off gets the neutral card, never its name (the refusal names no club either).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export const SHARE_CARD_SIZE = { width: 1200, height: 630 };
export const SHARE_CARD_TYPE = 'image/png';

/**
 * How long a card is kept (Stage 4b-2b review). Next's image response says "immutable, one year" unless told otherwise —
 * a club that changed its colours, or switched its site off, would keep its old card in every cache for a year. A club's
 * card is kept ten minutes; the neutral card (a closed club, or a read that failed) is never kept.
 */
const CARD_CACHE = { 'Cache-Control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=3600' };
const NEUTRAL_CACHE = { 'Cache-Control': 'no-store' };

/** The card for this club and these words. A club the one rule refuses gets `neutralShareCard()` instead. */
export async function clubShareCard(org: Organization, text: ShareCardText): Promise<ImageResponse> {
  const c = clubColourRoles(org.themePreset, org.themePrimary, org.themeAccent);
  // The exports' logo read (lib/export/resolve-pdf-settings.ts): only this project's storage or a stock logo is fetched,
  // and the image is decoded under a pixel ceiling and re-drawn as a small PNG — any format, never a decompression bomb.
  const logo = org.logoUrl ? await deriveLogoDataUrl(org.logoUrl) : null;
  const long = text.title.length > 22;

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        background: c.fill, color: c.onFill, padding: '72px 80px 64px', borderBottom: `16px solid ${c.accent}`,
        fontFamily: 'sans-serif',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 28 }}>
          {logo
            // eslint-disable-next-line @next/next/no-img-element -- the image renderer draws a plain img, never next/image
            ? <img src={logo} width={128} height={128} alt="" style={{ borderRadius: 24, objectFit: 'contain', background: '#FFFFFF' }} />
            : (
              <div style={{
                width: 128, height: 128, borderRadius: 24, background: c.tile, color: c.tileInk, display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 52, fontWeight: 700, letterSpacing: 2,
              }}>
                {clubInitials(org.name)}
              </div>
            )}
          {text.badge && (
            // The one green status chip for Tryouts open (the club site's --club-ok pair); plain white for the other states.
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14, borderRadius: 999, padding: '14px 28px', fontSize: 34, fontWeight: 700,
              ...(text.badgeTone === 'ok' ? { background: '#E6F0E2', color: '#2C6A2A' } : { background: '#FFFFFF', color: '#1F1B16' }),
            }}>
              {text.badge}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: long ? 76 : 104, fontWeight: 800, lineHeight: 1.02, letterSpacing: -1 }}>{text.title}</div>
          {text.sub && <div style={{ fontSize: 42, fontWeight: 500, opacity: 0.92, lineHeight: 1.2 }}>{text.sub}</div>}
        </div>
      </div>
    ),
    { ...SHARE_CARD_SIZE, headers: CARD_CACHE },
  );
}

/**
 * A club whose site is off shares a plain card: never its name (the refusal names no club either). Card A of The public
 * face, warm: S5 — the paper, the mark's olive tile, and the FieldLogicHQ name beneath it, no sentence. The tile and the
 * name sit inside the middle 600 px, so a squarer chat preview that crops the sides still shows both. Drawn from
 * lib/brand-mark.ts only.
 */
export async function neutralShareCard(): Promise<ImageResponse> {
  const { sans, fonts } = await cardFonts();
  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 44, background: BRAND_PAPER, color: BRAND_INK, fontFamily: sans,
      }}>
        <div style={{ width: 220, height: 220, borderRadius: 44, background: BRAND_OLIVE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width={220} height={220} viewBox="0 0 64 64">
            <g transform={`translate(${MARK_TILE_NUDGE_X} 0)`}>
              <path d={MARK_PATH_MAIN} fill={BRAND_PAPER} />
            </g>
          </svg>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 29 }}>
          <svg width={70} height={70} viewBox={MARK_BARE_VIEWBOX}>
            <path d={MARK_PATH_MAIN} fill={BRAND_OLIVE} />
          </svg>
          <div style={{ display: 'flex', fontSize: 64, lineHeight: 1, letterSpacing: -1.2 }}>
            <span style={{ fontWeight: 700 }}>{BRAND_NAME}</span>
            <span style={{ fontWeight: 500, color: BRAND_OLIVE }}>{BRAND_NAME_HQ}</span>
          </div>
        </div>
      </div>
    ),
    { ...SHARE_CARD_SIZE, fonts, headers: NEUTRAL_CACHE },
  );
}
