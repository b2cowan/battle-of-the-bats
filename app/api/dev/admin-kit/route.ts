import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_KIT_COOKIE, isAdminKitAvailable } from '@/lib/admin-kit-preview';
import { safeNextPath } from '@/lib/safe-redirect';

/**
 * THE SWITCH'S DOOR (Admin Design Continuity, Phase 1) — turns the admin's kit on or off for THIS
 * browser, on the dev server and the staging site only. See `lib/admin-kit-preview.ts` for the
 * whole contract.
 *
 *   /api/dev/admin-kit?on=1&next=/uat-rep-club/admin     on, then back to the admin
 *   /api/dev/admin-kit?on=0&next=/uat-rep-club/admin     off
 *
 * ⚠ 404 on the production branch (and on any production build that cannot say it is staging),
 * before it reads anything — `isAdminKitAvailable()` decides. No sign-in is asked for: the cookie
 * changes only what its own browser is shown, and only on the dev server or the staging site.
 * (So a page that makes a browser open this link — it is a plain GET — can at most flip that
 * browser's preview on or off; accepted, reviewed 2026-09-25.)
 */
export async function GET(req: NextRequest) {
  if (!isAdminKitAvailable()) {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }
  const url = new URL(req.url);
  const on = url.searchParams.get('on') !== '0';
  // The platform's own same-origin check, not a prefix test: a TAB or CR smuggled into `next`
  // survives a startsWith('/') guard and then resolves to another origin (lib/safe-redirect.ts).
  const res = NextResponse.redirect(new URL(safeNextPath(url.searchParams.get('next'), '/'), url.origin));
  if (on) {
    res.cookies.set(ADMIN_KIT_COOKIE, '1', {
      path: '/', sameSite: 'lax', httpOnly: true, secure: url.protocol === 'https:', maxAge: 60 * 60 * 24 * 30,
    });
  } else {
    res.cookies.delete(ADMIN_KIT_COOKIE);
  }
  return res;
}
