/**
 * WHICH DOCUMENTS EXIST — read out of the code, never out of a hand-kept list.
 *
 * ⚠ WHY THIS IS NOT THE EXPORT CATALOG. `lib/export/catalog.ts` looked like the obvious source
 * and is the wrong one: it registers table EXPORT MENUS, and has no entry for the practice run
 * sheet, the lineup poster, the batting-order card, the playoff bracket or the development
 * summary — five documents, two of which are exactly the ones the last two passes fixed.
 * (It IS the right cross-check for whether a surface *offers* PDF — see `offersPdf` in the
 * checker, and the false finding that taught us the difference.)
 *
 * ⚠ AND IT IS NOT ONE GREP EITHER. Six coach money screens reach a renderer through
 * `lib/coach-money-exports.ts`, so a plain search for `downloadPDF` under app/ finds none.
 *
 * So: seed with the renderer modules, then flood along IMPORT EDGES carrying the PDF capability
 * with it, until the set stops growing. Files under app/ or components/ are screens.
 *
 * ══ THE RULES THAT MAKE THE FLOOD HONEST ═══════════════════════════════════════════════════
 *
 * ⚠ THE EDGE IS THE MODULE, NOT THE SYMBOL. A guard that matches imported NAMES dies the day
 * someone writes an aliased import (learned on the page-actions guard). Every edge is decided
 * by which FILE a specifier resolves to; names decide only whether the capability travelled
 * along it — and aliases are followed, in both directions, because a renamed door is a door.
 *
 * ⚠ FORWARDING IS NOT CONSUMING, and this replaced a `isBarrel()` heuristic that was WRONG on
 * real files. That helper tried to spot a pure re-export module by shape, and adversarial
 * review reproduced it calling `lib/coach-money-summary.ts` — and an ordinary one-function hook
 * — a "barrel", because its brace-depth check went blind the moment a top-level function body
 * opened. A misclassified wrapper forwards only the names it imported and DROPS ITS OWN, so
 * every screen importing that wrapper's door vanished from the flood silently.
 *   The distinction is not a shape, it is what the module DOES with the capability:
 *     · it only RE-EXPORTS it (`export … from`) → it forwards exactly those names;
 *     · it IMPORTS and USES it → any export it offers may be a door of its own naming.
 *   That is already known per-edge, so nothing has to be guessed from the file's layout.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/** Where the renderers live. Every module in here that draws is found; none is named by hand. */
const RENDERER_DIR = 'lib/export';

/** Where a person can click. Anything outside these is plumbing, not a screen. */
const SCREEN_ROOTS = ['app', 'components'];
const WALK_ROOTS = ['app', 'components', 'lib'];
const CODE = /\.tsx?$/;

/** A module that offers a document-producing entry point. */
const HAS_ENTRY_POINT = /^export\s+(?:async\s+)?(?:function\s+(download[A-Za-z0-9_]*)\s*\(|const\s+(download[A-Za-z0-9_]*)\s*(?::[^=]+)?=\s*async)/m;
const ENTRY_POINTS = /^export\s+(?:async\s+)?(?:function\s+(download[A-Za-z0-9_]*)\s*\(|const\s+(download[A-Za-z0-9_]*)\s*(?::[^=]+)?=\s*async)/gm;
const LOADS_JSPDF = /['"]jspdf['"]/;

/**
 * The modules that actually put marks on a page.
 *
 * ⚠ THIS USED TO BE A HAND-KEPT TWO-ITEM LIST inside a file whose premise is "never a hand-kept
 * list", so a new sibling renderer was invisible while every docstring promised otherwise.
 *
 * ⚠ AND THE FIRST DERIVATION WAS STILL WRONG TWICE OVER. Matching `download*` alone dragged in
 * `ics.ts` and `xlsx.ts` (they export `downloadICS`/`downloadXLSX`), which doubled the entry
 * points and pulled every spreadsheet-only screen back into the flood. Then requiring the
 * literal string `jspdf` IN THE SAME FILE went the other way: `lib/export/pdf.ts` already
 * separates its builders (which take `jsPDFClass` by injection) from the thin `download*`
 * wrappers that load jsPDF, so the obvious "split this 2,600-line file per document" refactor
 * would strand a real renderer in a file that never says `jspdf` — and it would vanish from the
 * seed entirely, taking every screen that only reaches it. jsPDF reachability is therefore
 * followed THROUGH the export layer's own imports rather than read off one file's text.
 */
export function rendererModules(root) {
  const dir = path.join(root, RENDERER_DIR);
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => `${RENDERER_DIR}/${f}`);
  const src = new Map(files.map((f) => [f, readFileSync(path.join(root, f), 'utf8')]));

  /** Which modules in the export layer can reach jsPDF, directly or through a sibling. */
  const reaches = new Set(files.filter((f) => LOADS_JSPDF.test(src.get(f))));
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of files) {
      if (reaches.has(f)) continue;
      const hits = importsOf(src.get(f))
        .map((imp) => resolveSpecifier(imp.spec, f, root))
        .some((t) => t && reaches.has(t));
      if (hits) { reaches.add(f); grew = true; }
    }
  }
  return files.filter((f) => reaches.has(f) && HAS_ENTRY_POINT.test(src.get(f))).sort();
}

/** Every static import/export-from in a file, with the clause that preceded the specifier. */
function importsOf(src) {
  const out = [];
  const re = /(?:^|\n)\s*(import|export)\b([\s\S]*?)from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src))) out.push({ kind: m[1], clause: m[2], spec: m[3], at: m.index });
  /* ⚠ A DYNAMIC IMPORT HAS NO CLAUSE, AND THE MONEY HUB IS BUILT OUT OF THEM. Every coach money
   * panel is code-split — `dynamic(() => import('./dues/panel').then(m => m.DuesPanel))` — so
   * there is no import clause to parse and the names arrive through the `.then`. Losing this
   * case dropped the Money page out of the flood entirely, which is precisely the silent
   * coverage hole this module exists to prevent. Marked, and handled as "takes everything". */
  for (const d of src.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    out.push({ kind: 'import', clause: '', spec: d[1], at: d.index, dynamic: true });
  }
  return out;
}

/**
 * Parse an import clause into what it takes and what it calls each thing LOCALLY.
 *
 * ⚠ THE LOCAL NAME IS THE POINT. The first version collapsed `import Foo from 'x'` and
 * `import * as Foo from 'x'` into the same "takes everything" case and then tested the file
 * body for the TARGET's export name rather than the name the importer actually wrote. A screen
 * that renamed a default import on the way in (`import RosterExport from './use-roster'`) was
 * searched for the word `default`, never found it, and dropped out of the flood silently.
 */
export function bindings(clause) {
  const brace = clause.match(/\{([\s\S]*?)\}/);
  // `import type { X }` is erased at runtime and carries no capability; the keyword sits
  // outside the braces, so without this it read as a namespace import that takes everything.
  const bare = clause.replace(/\{[\s\S]*?\}/, '').replace(/\btype\b/g, '').replace(/[,\s]/g, '');
  const typeOnly = /^\s*type\b/.test(clause);
  const namespace = clause.match(/\*\s+as\s+([A-Za-z0-9_$]+)/);

  const names = brace
    ? brace[1].split(',').map((s) => s.replace(/\btype\b/g, '').trim()).filter(Boolean).map((s) => {
      const parts = s.split(/\s+as\s+/).map((x) => x.trim());
      return { source: parts[0], local: parts[1] || parts[0] };
    })
    : [];

  return {
    typeOnly,
    /** `import * as ns` — usage reads `ns.whatever`, so the local namespace name is the tell. */
    namespaceLocal: namespace ? namespace[1] : null,
    /** `import Foo` — Foo IS the target's default export, under the importer's own name. */
    defaultLocal: !namespace && bare ? bare : null,
    names,
  };
}

/**
 * Every top-level exported name in a file — any of which may be the door that makes the PDF.
 *
 * ⚠ INCLUDES `export { local as Public };` WITH NO `from`. That form matches neither a
 * declaration nor a re-export, so it was invisible to BOTH halves of this module — and it is
 * already idiomatic here (`lib/coach-money-exports.ts` does exactly it). The day a wrapper
 * publishes its door that way, the name would silently stop carrying.
 */
export function exportedNames(src) {
  const names = new Set();
  for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:function|const|class|let|var)\s+([A-Za-z0-9_$]+)/gm)) names.add(m[1]);
  for (const m of src.matchAll(/^export\s+default\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/gm)) names.add(m[1]);
  // A local export list: `export { a, b as c };` — no `from`, so importsOf never sees it.
  for (const m of src.matchAll(/^export\s*\{([^}]*)\}\s*;/gm)) {
    for (const part of m[1].split(',')) {
      const bits = part.replace(/\btype\b/g, '').trim().split(/\s+as\s+/);
      const local = (bits[1] || bits[0] || '').trim();
      if (local) names.add(local);
    }
  }
  if (/^export\s+default\b/m.test(src)) names.add('default');
  return names;
}

/** Resolve an import specifier to a repo-relative file, the way the bundler would. */
function resolveSpecifier(spec, fromFile, root) {
  let base;
  if (spec.startsWith('@/')) base = path.join(root, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(root, path.dirname(fromFile), spec);
  else return null; // a package, not our code
  for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
    const cand = base + ext;
    try {
      if (statSync(cand).isFile()) return path.relative(root, cand).split(path.sep).join('/');
    } catch { /* try the next candidate */ }
  }
  return null;
}

function walkFiles(root, rel, acc) {
  for (const name of readdirSync(path.join(root, rel))) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const r = rel ? `${rel}/${name}` : name;
    if (statSync(path.join(root, r)).isDirectory()) walkFiles(root, r, acc);
    else if (CODE.test(name)) acc.push(r);
  }
  return acc;
}

/**
 * The PDF entry points the export layer offers — one per document family.
 * A NEW document means a new one of these, which is what makes "somebody added an export and
 * forgot" a build failure rather than a silent hole.
 */
export function discoverEntryPoints(root) {
  const found = [];
  for (const mod of rendererModules(root)) {
    const src = readFileSync(path.join(root, mod), 'utf8');
    for (const m of src.matchAll(ENTRY_POINTS)) found.push({ name: m[1] ?? m[2], module: mod });
  }
  return found.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Every screen that can reach a renderer, however many modules it goes through.
 * Returns repo-relative paths under app/ or components/, each with the module it came through.
 *
 * @param entryPoints optional, already computed by the caller — see discoverEntryPoints.
 */
export function discoverScreens(root, entryPoints = discoverEntryPoints(root)) {
  const files = WALK_ROOTS.flatMap((r) => walkFiles(root, r, []));

  /**
   * ⚠ EVERY FILE IS PARSED AND EVERY SPECIFIER RESOLVED EXACTLY ONCE, before the fixed-point
   * loop. Doing it inside the loop re-scanned ~1,650 files with a multi-line regex and
   * re-resolved every specifier with up to five statSync calls on every pass, and the loop needs
   * one pass per hop in the longest import chain (renderer → barrel → assembler → panel is
   * already four). The import list cannot change between passes.
   */
  const edges = new Map();
  for (const f of files) {
    const text = readFileSync(path.join(root, f), 'utf8');
    const parsed = [];
    for (const imp of importsOf(text)) {
      const target = resolveSpecifier(imp.spec, f, root);
      if (!target) continue;
      const b = bindings(imp.clause);
      b.dynamic = imp.dynamic === true;
      if (b.typeOnly) continue; // erased at runtime; carries nothing
      // Which names are USED cannot change between passes either, so decide it here.
      const body = text.slice(imp.at + imp.clause.length);
      parsed.push({
        target,
        kind: imp.kind,
        ...b,
        uses: (local) => new RegExp(`\\b${local}\\b`).test(body),
      });
    }
    edges.set(f, { imports: parsed, exports: exportedNames(text) });
  }

  /** file -> the PDF-capable names it hands to its importers */
  const carries = new Map();
  /** file -> the module it first got the capability from, for a readable failure message */
  const via = new Map();
  for (const { name, module } of entryPoints) {
    if (!carries.has(module)) carries.set(module, new Set());
    carries.get(module).add(name);
  }

  let grew = true;
  while (grew) {
    grew = false;
    for (const f of files) {
      if (carries.has(f)) continue;
      const { imports, exports } = edges.get(f);
      const forwarded = new Set();
      let consumes = false;
      let from = null;

      for (const imp of imports) {
        const offered = carries.get(imp.target);
        if (!offered) continue;

        /* What this import takes, and what the IMPORTER calls each thing. */
        let taken = imp.names.filter((n) => offered.has(n.source));
        if (imp.dynamic) {
          // No clause to read: the names arrive through the `.then(m => m.Thing)`, so what the
          // body mentions is the target's OWN export name.
          taken = [...offered].map((n) => ({ source: n, local: n }));
        } else if (imp.namespaceLocal) {
          // `import * as ns` — every offered name arrives, and usage reads `ns.something`.
          taken = [...offered].map((n) => ({ source: n, local: imp.namespaceLocal }));
        } else if (imp.defaultLocal && offered.has('default')) {
          taken = [...taken, { source: 'default', local: imp.defaultLocal }];
        }
        if (taken.length === 0) continue;
        from = from ?? imp.target;

        if (imp.kind === 'export') {
          // A re-export FORWARDS, under whatever name it chose. It is not a door of its own.
          for (const t of taken) forwarded.add(t.local);
        } else if (taken.some((t) => imp.uses(t.local))) {
          // It IMPORTED and USED the capability — so any export it offers may wrap it.
          consumes = true;
          for (const t of taken) forwarded.add(t.local);
        }
      }

      if (forwarded.size === 0) continue;
      carries.set(f, consumes ? new Set([...forwarded, ...exports]) : forwarded);
      via.set(f, from);
      grew = true;
    }
  }

  return [...carries.keys()]
    .filter((f) => SCREEN_ROOTS.includes(f.split('/')[0]))
    .sort()
    .map((f) => ({ file: f, via: via.get(f) ?? null }));
}
