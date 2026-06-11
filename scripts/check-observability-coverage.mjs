#!/usr/bin/env node
/**
 * check-observability-coverage.mjs — Mechanism B coverage tracker for the Observability
 * Route-Instrumentation Rollout (docs/projects/archive/OBSERVABILITY_ROUTE_INSTRUMENTATION_PLAN.md §9).
 *
 * Counts how many exported App-Router route handlers (GET/POST/PATCH/PUT/DELETE) are wrapped with
 * withObservability vs the total, and lists the largest still-unwrapped domains so each tranche PR
 * can show the number moving. A "wrapped" handler is an `export const METHOD = withObservability(…)`.
 *
 * api/dev/** is excluded (locked decision §13 — permanently un-instrumented dev/seed routes).
 *
 * Usage:
 *   node scripts/check-observability-coverage.mjs           # human report
 *   node scripts/check-observability-coverage.mjs --json    # machine-readable
 * Always exits 0 — it's a report, not a gate.
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { isObservabilityExcluded } from './observability-route-exclusions.mjs';

const METHODS = new Set(['GET', 'POST', 'PATCH', 'PUT', 'DELETE']);
const API_DIR = path.resolve('app/api');
const JSON_OUT = process.argv.includes('--json');

function collectRouteFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const child = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'dev') continue; // excluded
      out.push(...collectRouteFiles(child));
    } else if (/^route\.[tj]sx?$/.test(entry.name) && !isObservabilityExcluded(child)) {
      // Drop permanently-excluded routes (e.g. client/error-capture) from BOTH numerator and
      // denominator — shared with the codemod so 100% stays reachable after the full rollout.
      out.push(child);
    }
  }
  return out;
}

function hasModifier(node, kind) {
  return Array.isArray(node.modifiers) && node.modifiers.some((m) => m.kind === kind);
}

/** Top-level domain key under app/api (e.g. admin, billing, coaches). */
function domainOf(absPath) {
  const norm = absPath.replace(/\\/g, '/');
  const m = norm.match(/\/app\/api\/([^/]+)/);
  return m ? m[1] : '(root)';
}

const files = fs.existsSync(API_DIR) ? collectRouteFiles(API_DIR).sort() : [];
let total = 0;
let wrapped = 0;
const domains = {}; // domain → { total, wrapped }

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const domain = domainOf(file);
  const d = (domains[domain] ||= { total: 0, wrapped: 0 });

  for (const stmt of sf.statements) {
    // export async function METHOD(…) — unwrapped
    if (
      ts.isFunctionDeclaration(stmt) &&
      stmt.name &&
      METHODS.has(stmt.name.text) &&
      hasModifier(stmt, ts.SyntaxKind.ExportKeyword)
    ) {
      total++;
      d.total++;
      continue;
    }
    // export const METHOD = … — wrapped iff initializer is withObservability(…)
    if (ts.isVariableStatement(stmt) && hasModifier(stmt, ts.SyntaxKind.ExportKeyword)) {
      for (const decl of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || !METHODS.has(decl.name.text)) continue;
        total++;
        d.total++;
        const init = decl.initializer;
        const isWrapped =
          init &&
          ts.isCallExpression(init) &&
          ts.isIdentifier(init.expression) &&
          init.expression.text === 'withObservability';
        if (isWrapped) {
          wrapped++;
          d.wrapped++;
        }
      }
    }
  }
}

const pct = total === 0 ? 0 : (wrapped / total) * 100;
const unwrappedDomains = Object.entries(domains)
  .map(([name, v]) => ({ name, unwrapped: v.total - v.wrapped, total: v.total, wrapped: v.wrapped }))
  .filter((d) => d.unwrapped > 0)
  .sort((a, b) => b.unwrapped - a.unwrapped);

if (JSON_OUT) {
  console.log(JSON.stringify({ total, wrapped, pct: Number(pct.toFixed(1)), files: files.length, domains }, null, 2));
} else {
  console.log(`\nObservability route coverage (excludes api/dev/**)`);
  console.log('─'.repeat(60));
  console.log(`  ${wrapped} / ${total} handlers wrapped  (${pct.toFixed(1)}%)   across ${files.length} route files`);
  console.log('─'.repeat(60));
  console.log('  largest unwrapped domains:');
  for (const d of unwrappedDomains.slice(0, 12)) {
    console.log(`    api/${d.name.padEnd(20)} ${String(d.unwrapped).padStart(4)} unwrapped  (${d.wrapped}/${d.total} done)`);
  }
  console.log('');
}
