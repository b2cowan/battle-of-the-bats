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
    if (!specifier.startsWith('.')) throw err;
    for (const ext of CANDIDATES) {
      try {
        return await nextResolve(specifier + ext, context);
      } catch { /* try the next candidate */ }
    }
    throw err;
  }
}
