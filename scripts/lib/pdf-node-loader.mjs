/**
 * Lets a plain `node` script load the repo's REAL PDF renderers.
 *
 * Two hooks, both of which already had to exist somewhere:
 *   1. the unit suite's TS resolver — the renderers are `.ts` and import each other without
 *      extensions, exactly as the Next.js bundler expects. Reused rather than re-derived, so
 *      there is one answer in this repo to "how does Node load an app module".
 *   2. the jspdf browser-build redirect — see jspdf-browser-hooks.mjs for why.
 *
 *   node --import ./scripts/lib/pdf-node-loader.mjs scripts/check-pdf-documents.mjs
 */
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

/**
 * ⚠⚠ THE ORDER OF THESE TWO LINES IS LOAD-BEARING. Node chains resolve hooks LIFO — the LAST
 * registered runs FIRST — so the jspdf redirect must be registered SECOND to get first sight of
 * every specifier. Swap them (an "alphabetize the imports" tidy-up is all it would take) and the
 * TS resolver answers `jspdf` first: its `nextResolve` succeeds against Node's default build,
 * the redirect never fires, and the renderers get a module whose `default` is an object rather
 * than the constructor — which is the exact failure jspdf-browser-hooks.mjs exists to prevent.
 * It fails loudly rather than silently, but there is no reason to find out.
 */
register(new URL('../../tests/ts-resolver-hooks.mjs', import.meta.url), pathToFileURL('./'));
register(new URL('./jspdf-browser-hooks.mjs', import.meta.url), pathToFileURL('./'));
