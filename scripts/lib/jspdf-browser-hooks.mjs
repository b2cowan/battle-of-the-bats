/**
 * Resolve `jspdf` to the BROWSER build when the export renderers are loaded under Node.
 *
 * ⚠ WHY THIS EXISTS, and it is not a preference. jspdf's package exports list the `node`
 * condition BEFORE `browser`, and Node always matches `node` — so `--conditions=browser` does
 * NOT change the answer (verified). The node build's `default` export is an object, not the
 * class, so `const { default: jsPDF } = await import('jspdf')` yields something that cannot be
 * constructed. The product's bundler serves the ES build, whose default IS the class.
 *
 * Loading the node build instead would not fail loudly — it would misrepresent the product,
 * which is worse than not running at all.
 */
const BROWSER_BUILD = 'jspdf/dist/jspdf.es.min.js';

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'jspdf') return nextResolve(BROWSER_BUILD, context);
  return nextResolve(specifier, context);
}
