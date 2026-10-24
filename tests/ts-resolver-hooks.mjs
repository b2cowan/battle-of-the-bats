/**
 * Resolve hook for `node --test` — see ts-resolver.mjs for why this exists.
 *
 * Runs ONLY after Node's own resolution has failed, and only for relative specifiers, so it
 * can never shadow a real file or a package. Mirrors what the Next.js bundler does for the
 * extensionless relative imports the app is written with.
 */
const CANDIDATES = ['.ts', '.tsx', '/index.ts', '/index.tsx'];

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    // `next/server` and its siblings have no exports map: the bundler adds the extension, plain Node does not (Club Tier 4e's
    // proxy tests build real NextRequest / NextResponse objects). Only for Next's own entry points, only after Node failed.
    if (/^next\/[a-z-]+$/.test(specifier)) {
      try {
        return await nextResolve(`${specifier}.js`, context);
      } catch { /* fall through to the original failure */ }
    }
    if (!specifier.startsWith('.')) throw err;
    for (const ext of CANDIDATES) {
      try {
        return await nextResolve(specifier + ext, context);
      } catch { /* try the next candidate */ }
    }
    throw err;
  }
}
