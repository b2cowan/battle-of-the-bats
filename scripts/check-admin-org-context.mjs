#!/usr/bin/env node
/**
 * check-admin-org-context.mjs — fail-closed org-context guard (J3-012 / J4-012).
 *
 * Every route handler under app/api/admin/** resolves org context via
 * getAuthContext / getAuthContextWithRole / getAuthContextWithScope. Because these admin routes
 * are flat (no [orgSlug] path segment), a call that does NOT pass an explicit orgSlug falls back
 * to the caller's FIRST membership row — so a multi-org user's reads/writes can silently land in
 * the wrong org (J3-012). The fix threads `{ orgSlug, requireOrgSlug: true }` through every call;
 * `requireOrgSlug: true` makes a missing orgSlug fail closed (null) instead of falling back.
 *
 * This gate prevents regression: it FAILS (exit 1) if any admin route call to one of the auth
 * helpers omits `requireOrgSlug: true`. Catches both bare calls — getAuthContext() — and calls
 * that pass options without the flag — getAuthContext({ orgSlug }).
 *
 * Coach routes (app/api/coaches/[orgSlug]/**) get orgSlug from path params and are checked too.
 *
 * Usage: node scripts/check-admin-org-context.mjs   (exit 1 on any violation)
 *        node scripts/check-admin-org-context.mjs --json
 */
import fs from 'node:fs';
import path from 'node:path';

const JSON_OUT = process.argv.includes('--json');
const SCOPES = [
  path.resolve('app/api/admin'),
  path.resolve('app/api/coaches'),
];

const AUTH_CALL = /\bgetAuthContext(?:WithRole|WithScope)?\s*\(/g;

function collectRouteFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const child = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectRouteFiles(child));
    else if (/\.[tj]sx?$/.test(entry.name)) out.push(child);
  }
  return out;
}

/**
 * Given the index of a getAuthContext*( call's opening paren, return the substring of the
 * argument list up to the matching close paren. Handles nested braces/parens.
 */
function argListAt(text, openParenIdx) {
  let depth = 0;
  for (let i = openParenIdx; i < text.length; i++) {
    const c = text[i];
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return text.slice(openParenIdx + 1, i);
    }
  }
  return text.slice(openParenIdx + 1); // unbalanced — treat rest as args
}

const violations = [];
const files = SCOPES.flatMap(collectRouteFiles).sort();

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  let m;
  AUTH_CALL.lastIndex = 0;
  while ((m = AUTH_CALL.exec(text)) !== null) {
    const openParen = AUTH_CALL.lastIndex - 1;
    const args = argListAt(text, openParen);
    if (!/requireOrgSlug\s*:\s*true/.test(args)) {
      const line = text.slice(0, m.index).split('\n').length;
      violations.push({
        file: path.relative(process.cwd(), file).replace(/\\/g, '/'),
        line,
        call: m[0].replace(/\($/, ''),
        reason: args.trim() === ''
          ? 'bare call — must pass { orgSlug, requireOrgSlug: true }'
          : 'options missing requireOrgSlug: true',
      });
    }
  }
}

if (JSON_OUT) {
  console.log(JSON.stringify({ filesScanned: files.length, violations }, null, 2));
} else if (violations.length === 0) {
  console.log(`✓ admin/coach org-context guard: ${files.length} route files clean (all auth calls fail closed).`);
} else {
  console.error(`\n✗ admin/coach org-context guard: ${violations.length} fail-OPEN auth call(s) (J3-012 regression):\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  ${v.call}()  — ${v.reason}`);
  }
  console.error(`\n  Fix: pass { orgSlug, requireOrgSlug: true } (admin routes read orgSlug from the`);
  console.error(`  query string; coach routes from path params). See`);
  console.error(`  docs/projects/active/ORG_CONTEXT_FAILCLOSED_SWEEP_SPEC.md\n`);
}

process.exit(violations.length > 0 ? 1 : 0);
