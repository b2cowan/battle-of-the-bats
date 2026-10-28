import { NextResponse, type NextRequest } from 'next/server';
import { PUBLIC_FRAME_COOKIE, safePublicFrameReturn } from '@/lib/public-frame';
import { resolveSameHostOrigin } from '@/lib/app-origin';

/**
 * The public tournament pages' preview link and its twin (Stage 1; the switch is lib/public-frame.ts).
 *
 *   /api/public-frame?frame=on&to=/riverdale-minor-ball/summer-classic   → this browser sees the new frame
 *   /api/public-frame?frame=off&to=/riverdale-minor-ball/summer-classic  → this browser sees today's pages
 *
 * A first-party cookie, then straight back to the page. Nothing else changes for anyone else. `to` is a path on this
 * site only (lib/public-frame.ts safePublicFrameReturn), so the link can never be made to send someone elsewhere.
 */
export function GET(request: NextRequest) {
  const frame = request.nextUrl.searchParams.get('frame') === 'off' ? 'off' : 'on';
  const to = safePublicFrameReturn(request.nextUrl.searchParams.get('to'));
  const res = NextResponse.redirect(new URL(to, resolveSameHostOrigin(request)), 303);
  res.cookies.set(PUBLIC_FRAME_COOKIE, frame, {
    path: '/',
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 90,
  });
  // The redirect is per-browser by nature; never let a cache keep one person's answer for the next.
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
