import { cookies } from 'next/headers';
import { withObservability } from '@/lib/observability';
import { forwardToOwnAddress } from '@/lib/club-forward';
import { getOrganizationBySlug, getPublicTournamentBySlug, getRules, getResources, getDivisions } from '@/lib/db';
import { isPublicPageEnabled } from '@/lib/public-pages';
import { shapePublicRules } from '@/lib/public-rules-shape';
import { publicFrameBand, publicFrameHost } from '@/lib/public-frame';
import { resolveOrgHomeHref } from '@/lib/module-entitlements';
import { formatEventDateRange, tournamentToday } from '@/lib/timezone';
import { orgLinks } from '@/lib/org-links';
import { requestHost } from '@/lib/request-host';
import { siteOriginForHost } from '@/lib/own-hosts';
import { resolveSameHostOrigin } from '@/lib/app-origin';
import { FixedWindowRateLimiter, clientIpFrom } from '@/lib/rate-limit';
import { resourceKeyFromUrl } from '@/lib/resource-file-storage';
import { deriveLogoDataUrl } from '@/lib/export/resolve-pdf-settings';
import { DEFAULT_PDF_SETTINGS } from '@/lib/export/pdf';
import { buildRulesPdfDoc, rulesPdfFilename } from '@/lib/export/rules-pdf';
import { rulesQrDataUrl, rulesViewAllUrl } from '@/lib/export/rules-qr';

export const dynamic = 'force-dynamic';

/**
 * THE PRINTABLE RULES (Public tournament pages Stage 10) — `/{org}/{tournament}/rules/pdf`, the Rules page's own address
 * with /pdf on the end. Made here, on the server, because the page's gates, the narrowing cookie and the logo all live on
 * the server (build prompt, "the technical choice").
 *
 * ⚠ A ROUTE HANDLER RUNS NO LAYOUT, so it repeats every refusal on the page's path (Stage 0's D1 lesson: a new public
 * read is never a side door) — the org layout's (no such club), the tournament layout's (a cancelled organization; a
 * tournament that is not active or completed), the page's (its own-address forward; the Rules page switched off), and
 * the page's content rule: sections from `shapePublicRules` only, which drops a section aimed at a held-back division
 * and narrows exactly as the page does (the same function draws the page). No sections to show → no file (A-settled).
 * The site switch does NOT gate tournament pages (lib/public-club-access.ts), so it does not gate this either.
 *
 * Every refusal is the same 404. `no-store`: the stamp says "Rules as of" this moment, so a cached copy would lie.
 * Behind a per-visitor limit backed by a global one (a file is heavier than a page).
 */
const perVisitor = new FixedWindowRateLimiter(60_000, 30);
const everyone = new FixedWindowRateLimiter(60_000, 600);

/** The event's logo as a PNG data URL, derived once per logo per server (sharp; jsPDF draws neither SVG nor webp).
 *  `deriveLogoDataUrl` never throws: a logo that fails to derive is null and prints no logo, never a failed download.
 *  ⚠ A failure is kept for a MINUTE only: a slow fetch or storage blip must not print that event's file without its
 *  logo until the server restarts, and a logo that can never derive (undecodable, too large) must not be re-fetched
 *  and re-decoded on every download. */
const LOGO_FAILURE_MS = 60_000;
const logoCache = new Map<string, Promise<string | null>>();
function logoDataUrl(url: string): Promise<string | null> {
  let hit = logoCache.get(url);
  if (!hit) {
    hit = deriveLogoDataUrl(url);
    logoCache.set(url, hit);
    const mine = hit;
    void mine.then(v => {
      if (v !== null) return;
      setTimeout(() => { if (logoCache.get(url) === mine) logoCache.delete(url); }, LOGO_FAILURE_MS).unref?.();
    });
    if (logoCache.size > 100) logoCache.delete(logoCache.keys().next().value!);
  }
  return hit;
}

const HEADERS = { 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store' };
const notFound = () => new Response('Not found', { status: 404, headers: { ...HEADERS, 'Content-Type': 'text/plain; charset=utf-8' } });

export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; tournamentSlug: string }> }) => {
  const { orgSlug, tournamentSlug } = await params;
  const view = new URL(req.url).searchParams.get('view');
  // The page's first call: a club with its own address is read there (and its code and stamp name that address).
  await forwardToOwnAddress(orgSlug, `/${tournamentSlug}/rules/pdf${view ? `?view=${encodeURIComponent(view)}` : ''}`);

  if (!perVisitor.take(clientIpFrom(req)) || !everyone.take('all')) {
    return new Response('Too many requests. Try again in a minute.', {
      status: 429, headers: { ...HEADERS, 'Retry-After': '60', 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const org = await getOrganizationBySlug(orgSlug);
  // A preview club (Track P) serves no files: only its pages, each marked.
  if (!org || org.subscriptionStatus === 'canceled' || org.isPreview) return notFound();
  const tournament = await getPublicTournamentBySlug(org.id, tournamentSlug);
  if (!tournament || !isPublicPageEnabled(tournament, 'rules')) return notFound();

  // ⚠ Strict reads: a failed divisions read must not turn into "no divisions" (every tag would read as stale and a
  // held-back division's section would print into a file that outlives the page). A failure is a 503, never a file.
  let rules, resources, divisions;
  try {
    [rules, resources, divisions] = await Promise.all([
      getRules(tournament.id, { admin: true, strict: true }),
      getResources(tournament.id, { admin: true, strict: true }),
      getDivisions(tournament.id, { admin: true, strict: true }),
    ]);
  } catch (e) {
    console.error('rules pdf: a read failed', e);
    return new Response('The rules could not be prepared. Try again in a minute.', {
      status: 503, headers: { ...HEADERS, 'Retry-After': '30', 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
  const prefName = (await cookies()).get(`fl_agpref_${orgSlug}`)?.value ?? null;
  const shape = shapePublicRules({ rules, resources, allDivisions: divisions, prefName, view });
  if (shape.sections.length === 0) return notFound();

  // Whose look prints is the band's rule (Stage 1a): the colour is the band's fill, the logo the band's (none on a plan
  // without tournament branding — the free look's near-black bar, ink headings, no logo).
  const band = publicFrameBand(org, tournament, tournamentToday(), false);
  const host = publicFrameHost(org.name, tournament.name, await resolveOrgHomeHref(org).catch(() => null));
  const href = await orgLinks(orgSlug);
  const origin = siteOriginForHost(await requestHost(), resolveSameHostOrigin(req)).replace(/\/$/, '');
  const rulesPage = `${origin}${href(`/${tournamentSlug}/rules`)}`;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const [logo, qr, { default: jsPDF }] = await Promise.all([
    band.logoUrl ? logoDataUrl(band.logoUrl) : Promise.resolve(null),
    rulesQrDataUrl(rulesViewAllUrl(rulesPage)),
    import('jspdf'),
  ]);

  const doc = buildRulesPdfDoc(jsPDF, {
    eventName: tournament.name,
    // The band's spelling, but always with the year: the band drops this year's, and paper outlives the year.
    dates: tournament.startDate ? formatEventDateRange(tournament.startDate, tournament.endDate, true) : null,
    // The band's own rule: "Hosted by" only when the organizer's home is a real door (a "Run by" org prints nothing).
    hostedBy: host?.kind === 'hosted' ? host.name : null,
    narrowedTo: shape.narrowedTo?.name ?? null,
    sections: shape.sections,
    resources: shape.resources.map(r => ({ ...r, isFile: !!supabaseUrl && resourceKeyFromUrl(r.url, supabaseUrl) !== null })),
    stampedAt: new Date().toISOString(),
    liveAddress: rulesPage.replace(/^https?:\/\//, ''),
    qrDataUrl: qr,
    // The kit's footer as every plan prints it (A11): the export date, the FieldLogicHQ line, the page numbers. The
    // organization's PDF template is its own paper's, not this public copy's.
    settings: { ...DEFAULT_PDF_SETTINGS, accentColor: band.roles.fill, logoDataUrl: logo ?? undefined },
  });
  const bytes = doc.output('arraybuffer') as ArrayBuffer;

  const filename = rulesPdfFilename(tournament.name);
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, "'");
  return new Response(bytes, {
    status: 200,
    headers: {
      ...HEADERS,
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}, { route: '/[orgSlug]/[tournamentSlug]/rules/pdf' });
