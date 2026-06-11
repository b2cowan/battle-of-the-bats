#!/usr/bin/env node
/**
 * wrap-route-observability.mjs — Mechanism B codemod for the Observability Route-Instrumentation
 * Rollout (docs/projects/archive/OBSERVABILITY_ROUTE_INSTRUMENTATION_PLAN.md §7).
 *
 * Transforms exported App-Router route handlers so they record call/error metrics + seed the
 * AsyncLocalStorage request context:
 *
 *   export async function POST(req, ctx) { …body… }
 *   →
 *   export const POST = withObservability(async (req, ctx) => { …body… }, { route: '/api/<derived>' });
 *
 * Behaviour-preserving: withObservability returns the handler's response UNCHANGED and records
 * metrics fire-and-forget (never adds latency, never captures errors itself — onRequestError does
 * that globally). The transform keeps params, return-type annotation, `async`, and the body verbatim
 * — only the export form changes, so Next's route-type validator still sees the same signature.
 *
 * Built on the TypeScript compiler API (already a dependency) — no ts-morph/jscodeshift install.
 *
 * Usage:
 *   node scripts/wrap-route-observability.mjs <path…>           # dry-run report (default, no writes)
 *   node scripts/wrap-route-observability.mjs --write <path…>   # apply edits in place
 *   node scripts/wrap-route-observability.mjs --json <path…>    # machine-readable report
 * Each <path> is a file or a directory (recursed for route.ts / route.js).
 *
 * SKIP-AND-REPORT (never auto-transformed — flagged for hand review):
 *   • already-wrapped exports (`export const GET = withObservability(`)
 *   • arrow/const method exports (`export const GET = …`) — wrap the initializer by hand
 *   • files with `export const runtime = 'edge'` (capture can't run on the edge runtime)
 *   • streaming / ReadableStream responses (the wrap must not buffer a stream)
 * EXCLUDED entirely (never touched): api/dev/**, the public client/error-capture (intentionally minimal).
 *
 * Idempotent: a transformed handler becomes an `export const … = withObservability(` which the next
 * run detects as already-wrapped; the import is only inserted when absent.
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { OBSERVABILITY_EXCLUDE_RE } from './observability-route-exclusions.mjs';

const METHODS = new Set(['GET', 'POST', 'PATCH', 'PUT', 'DELETE']);
const OBSERVABILITY_MODULE = '@/lib/observability';
const IMPORT_LINE = `import { withObservability } from '${OBSERVABILITY_MODULE}';`;
// Paths that must never be wrapped — shared with the coverage tracker so the sets can't drift
// (locked owner decisions §13 + Q2 2026-06-10).
const EXCLUDE_RE = OBSERVABILITY_EXCLUDE_RE;
const EDGE_RE = /export\s+const\s+runtime\s*=\s*['"]edge['"]/;
// Conservative streaming heuristic — a wrap that buffers a stream would change behaviour.
const STREAM_RE = /new\s+ReadableStream|new\s+TransformStream|\.getReader\s*\(|new\s+Response\s*\([^)]*[Ss]tream/;
const ALREADY_IMPORTED_RE = /import\s*(?:type\s+)?\{[^}]*\bwithObservability\b[^}]*\}/;

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const JSON_OUT = args.includes('--json');
const inputs = args.filter((a) => !a.startsWith('--'));

if (inputs.length === 0) {
  console.error('usage: node scripts/wrap-route-observability.mjs [--write] [--json] <path…>');
  process.exit(2);
}

/** Recursively collect route.ts / route.js files from a file or directory path. */
function collectRouteFiles(input) {
  const abs = path.resolve(input);
  let stat;
  try {
    stat = fs.statSync(abs);
  } catch {
    return [];
  }
  // An explicitly-passed path is always processed; deriveRoute/processFile skip non-api files.
  if (stat.isFile()) return [abs];
  const out = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const child = path.join(abs, entry.name);
    if (entry.isDirectory()) {
      if (/[\\/]api[\\/]dev$/.test(child) || entry.name === 'node_modules') continue;
      out.push(...collectRouteFiles(child));
    } else if (/^route\.[tj]sx?$/.test(entry.name)) {
      out.push(child);
    }
  }
  return out;
}

/** Derive the grouping route string from a route-file path: app/api/foo/[id]/route.ts → /api/foo/[id]. */
function deriveRoute(absPath) {
  const norm = absPath.replace(/\\/g, '/');
  const m = norm.match(/\/app\/(api(?:\/.+?)?)\/route\.(?:tsx?|jsx?)$/);
  return m ? '/' + m[1] : null;
}

function hasModifier(node, kind) {
  return Array.isArray(node.modifiers) && node.modifiers.some((m) => m.kind === kind);
}

/** Process one file. Returns { route, handlers: [{method, action, reason}], changed }. */
function processFile(absPath) {
  const route = deriveRoute(absPath);
  const result = { file: absPath, route, handlers: [], changed: false, fileSkip: null };

  if (EXCLUDE_RE.some((re) => re.test(absPath))) {
    result.fileSkip = 'excluded';
    return result;
  }
  if (!route) {
    result.fileSkip = 'not-an-api-route';
    return result;
  }

  const text = fs.readFileSync(absPath, 'utf8');
  // Preserve the file's dominant line ending so inserted lines don't create a mixed-EOL working
  // tree (the repo runs core.autocrlf=true → route files are CRLF on a Windows checkout). The
  // sliced params/body keep their original EOL already; only the inserted import needs this.
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  if (EDGE_RE.test(text)) {
    result.fileSkip = 'edge-runtime';
    return result;
  }
  if (STREAM_RE.test(text)) {
    result.fileSkip = 'streaming-response';
    return result;
  }

  const sf = ts.createSourceFile(absPath, text, ts.ScriptTarget.Latest, /*setParentNodes*/ true, ts.ScriptKind.TS);
  const edits = []; // { start, end, text }
  let needImport = !ALREADY_IMPORTED_RE.test(text);

  for (const stmt of sf.statements) {
    // export async function GET/POST/… (the transformable form)
    if (ts.isFunctionDeclaration(stmt) && stmt.name && METHODS.has(stmt.name.text)) {
      const method = stmt.name.text;
      if (!hasModifier(stmt, ts.SyntaxKind.ExportKeyword) || hasModifier(stmt, ts.SyntaxKind.DefaultKeyword)) {
        result.handlers.push({ method, action: 'skipped', reason: 'not-a-named-export' });
        continue;
      }
      if (!stmt.body) {
        result.handlers.push({ method, action: 'skipped', reason: 'no-body (overload/declaration)' });
        continue;
      }
      const isAsync = hasModifier(stmt, ts.SyntaxKind.AsyncKeyword);
      const params = text.slice(stmt.parameters.pos, stmt.parameters.end).trim();
      const returnType = stmt.type ? ': ' + stmt.type.getText(sf) : '';
      const body = stmt.body.getText(sf); // includes the { … } braces
      const start = stmt.getStart(sf); // skips leading JSDoc/comments by default — they stay above
      const end = stmt.getEnd();
      const replacement =
        `export const ${method} = withObservability(` +
        `${isAsync ? 'async ' : ''}(${params})${returnType} => ${body}, ` +
        `{ route: '${route}' });`;
      edits.push({ start, end, text: replacement });
      result.handlers.push({ method, action: 'transformed', reason: null });
      continue;
    }

    // export const GET/POST/… = … (already-wrapped, or arrow/const form to hand-review)
    if (ts.isVariableStatement(stmt) && hasModifier(stmt, ts.SyntaxKind.ExportKeyword)) {
      for (const decl of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || !METHODS.has(decl.name.text)) continue;
        const method = decl.name.text;
        const init = decl.initializer;
        const isWrapped =
          init &&
          ts.isCallExpression(init) &&
          ts.isIdentifier(init.expression) &&
          init.expression.text === 'withObservability';
        result.handlers.push({
          method,
          action: 'skipped',
          reason: isWrapped ? 'already-wrapped' : 'arrow-const (hand-wrap initializer)',
        });
      }
    }
  }

  const transformed = result.handlers.filter((h) => h.action === 'transformed');
  if (transformed.length === 0) return result;

  if (needImport) {
    // Prefer splicing withObservability into an existing `@/lib/observability` named import (e.g.
    // a file that already imports captureError) so we don't emit a second import line from the
    // same module. Fall back to a fresh import line after the last top-level import; else at top.
    let importPos = 0;
    let spliceInto = null;
    for (const stmt of sf.statements) {
      if (!ts.isImportDeclaration(stmt)) continue;
      importPos = stmt.getEnd();
      if (
        spliceInto === null &&
        ts.isStringLiteral(stmt.moduleSpecifier) &&
        stmt.moduleSpecifier.text === OBSERVABILITY_MODULE &&
        stmt.importClause &&
        stmt.importClause.namedBindings &&
        ts.isNamedImports(stmt.importClause.namedBindings) &&
        stmt.importClause.namedBindings.elements.length > 0
      ) {
        const els = stmt.importClause.namedBindings.elements;
        spliceInto = els[els.length - 1].getEnd();
      }
    }
    if (spliceInto !== null) {
      edits.push({ start: spliceInto, end: spliceInto, text: ', withObservability' });
    } else {
      edits.push({ start: importPos, end: importPos, text: importPos === 0 ? IMPORT_LINE + eol : eol + IMPORT_LINE });
    }
  }

  // Apply edits high→low so earlier offsets stay valid.
  edits.sort((a, b) => b.start - a.start);
  let out = text;
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);

  result.changed = true;
  if (WRITE) fs.writeFileSync(absPath, out, 'utf8');
  return result;
}

// ── run ──────────────────────────────────────────────────────────────────────
const files = [...new Set(inputs.flatMap(collectRouteFiles))].sort();
const results = files.map(processFile);

let total = 0;
let transformed = 0;
const skips = {};
let filesChanged = 0;

for (const r of results) {
  if (r.fileSkip) {
    skips[r.fileSkip] = (skips[r.fileSkip] || 0) + 1;
    continue;
  }
  if (r.changed) filesChanged++;
  for (const h of r.handlers) {
    total++;
    if (h.action === 'transformed') transformed++;
    else skips[h.reason] = (skips[h.reason] || 0) + 1;
  }
}

if (JSON_OUT) {
  console.log(JSON.stringify({ mode: WRITE ? 'write' : 'dry-run', files: results, summary: { total, transformed, filesChanged, skips } }, null, 2));
} else {
  console.log(`\nROUTE INSTRUMENTATION CODEMOD — ${WRITE ? 'WRITE' : 'dry-run (no files written)'}\n`);
  for (const r of results) {
    if (r.fileSkip) {
      console.log(`  ${'[file skip]'.padEnd(26)} ${(r.route || path.basename(r.file)).padEnd(48)} ${r.fileSkip}`);
      continue;
    }
    for (const h of r.handlers) {
      const tag = h.action === 'transformed' ? 'transformed' : `skip: ${h.reason}`;
      console.log(`  ${h.method.padEnd(8)} ${(r.route || '').padEnd(54)} ${tag}`);
    }
  }
  console.log('\n' + '─'.repeat(72));
  console.log(`  files changed: ${filesChanged}   handlers: ${total}   transformed: ${transformed}`);
  const skipLine = Object.entries(skips).map(([k, v]) => `${k}=${v}`).join('  ');
  if (skipLine) console.log(`  skipped: ${skipLine}`);
  console.log('─'.repeat(72) + '\n');
}
