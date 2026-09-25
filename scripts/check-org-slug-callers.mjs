#!/usr/bin/env node
/**
 * check-org-slug-callers.mjs — every client call to an org-scoped admin route carries the org.
 *
 * ⚠ WHY THIS EXISTS. On 2026-06-14 the J3-012 hardening made every `app/api/admin/**` route fail
 * CLOSED without an explicit org (`requireOrgSlug: true` — see check-admin-org-context.mjs, which
 * guards the ROUTE side). Nothing guarded the CALLER side, and the club-admin pages were never
 * re-walked. Four controls then answered 401 for three months with nobody noticing: payee search +
 * create on a ledger entry, "Add item" on the Org Budget, the org audit log, and the Upcoming
 * Payables panel on Rep Teams (Club Tier Readiness C01 / C02 / A04, 2026-09-25). Each read as a
 * broken screen, not a missing parameter. This is the other half of that hardening.
 *
 * WHAT IT CHECKS. Every string or template literal in client code (app/, components/, lib/ —
 * never app/api/) that names an `/api/admin/…` or `/api/billing/{cancel,downgrade}/…` route:
 *   · the route is RESOLVED from the literal's path against the real route files, and whether it
 *     requires an org is READ from the route (a `requireOrgSlug: true` in it or in a helper it
 *     imports — families-auth, the tournament import `shared.ts`). Nothing is hand-listed, so a
 *     route that stops requiring the org stops being checked, and a new route is checked the day
 *     it lands. Routes that derive the org themselves (platform email, notification preferences)
 *     drop out on their own.
 *   · a QUERY-sourced route's literal must carry the org: the text `orgSlug`, or a `${…}` whose
 *     identifier is defined in the same file from `orgSlug` (or `.set/.append('orgSlug')`), or is
 *     named as an org QUERY carrier (`orgQuery`, `orgParam`, `seasonOrgQuery`, `orgQs` — a
 *     parameter has no local definition to read). ⚠ Only that shape: a bare "org" in a name
 *     (`orgName`, `orgId`) proves nothing and is not accepted (review 2026-09-25 showed it would
 *     have passed `?id=${organizationId}`).
 *   · a BODY-sourced route (the billing cancel/downgrade confirms) may carry it in the call's
 *     arguments instead.
 *   · COMPONENT URL PROPS: a component that appends `?…` to a URL it was HANDED (`${apiUrl}?days=`)
 *     breaks the day a caller passes a URL that already carries `?orgSlug=` — which the fix above
 *     makes callers do. Append with a separator chosen from the URL instead.
 *
 * ESCAPE HATCH: `org-slug-ok: <reason>` in a comment on the literal's line or up to three lines
 * above — for a URL the org is added to downstream (BudgetItemPicker's `adminOrgSlug`).
 *
 * Parsed with the TypeScript compiler, not grepped: JSX copy is full of apostrophes and URLs are
 * assembled from nested templates, both of which defeat a regex (the sweep's own research found
 * nested-template and ternary URLs a line-grep would have misread).
 *
 * Usage: node scripts/check-org-slug-callers.mjs            (exit 1 on any violation)
 *        node scripts/check-org-slug-callers.mjs --json
 *        node scripts/check-org-slug-callers.mjs --list     (every resolved call, for auditing)
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd();
const JSON_OUT = process.argv.includes('--json');
const LIST = process.argv.includes('--list');
const rel = p => path.relative(ROOT, p).replace(/\\/g, '/');

function walk(dir, pred, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      walk(p, pred, out);
    } else if (pred(p)) out.push(p);
  }
  return out;
}

// ── 1. The routes, and what each one requires ─────────────────────────────────
const ROUTE_ROOTS = ['app/api/admin', 'app/api/billing/cancel', 'app/api/billing/downgrade'];

function resolveImport(fromFile, spec) {
  let base;
  if (spec.startsWith('@/')) base = path.join(ROOT, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec);
  else return null;
  for (const ext of ['.ts', '.tsx', '/index.ts']) if (fs.existsSync(base + ext)) return base + ext;
  return null;
}

/** The route's own source plus any local helper it imports that does the org check for it. */
function routeAuthSource(file) {
  const src = fs.readFileSync(file, 'utf8');
  let combined = src;
  for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    const spec = m[1];
    if (!spec.startsWith('.') && !/^@\/lib\/[\w-]*auth/.test(spec)) continue;
    const dep = resolveImport(file, spec);
    if (dep) combined += '\n' + fs.readFileSync(dep, 'utf8');
  }
  return combined;
}

const routes = ROUTE_ROOTS.flatMap(r => walk(path.join(ROOT, r), p => /[\\/]route\.[tj]s$/.test(p))).map(file => {
  const urlPath = '/' + rel(path.dirname(file)).replace(/^app\//, '')
    .split('/').filter(s => !/^\(.*\)$/.test(s)).join('/');
  const pattern = new RegExp('^' + urlPath.split('/').map(seg =>
    /^\[\.\.\..+\]$/.test(seg) ? '.+' : /^\[.+\]$/.test(seg) ? '[^/]+' : seg.replace(/[.*+?^${}()|\\]/g, '\\$&'),
  ).join('/') + '/?$');
  const auth = routeAuthSource(file);
  // Requires a CLIENT-sent org only when it both fails closed AND reads the org from the request.
  // notification-preferences passes `requireOrgSlug: true` with a slug it derived from the
  // tournament row — its callers correctly send nothing.
  const fromQuery = /searchParams\.get\(\s*['"]orgSlug['"]\s*\)/.test(auth);
  const fromBody = /\bbody\.orgSlug\b|\{[^}]*\borgSlug\b[^}]*\}\s*=\s*(await\s+)?(body|req\.json\(\)|request\.json\(\))/.test(auth);
  const requires = /requireOrgSlug\s*:\s*true/.test(auth) && (fromQuery || fromBody);
  return { file: rel(file), urlPath, pattern, requires, source: fromQuery ? 'query' : 'body' };
});

function matchRoute(skeleton) {
  // Most specific first: a static segment beats a [param] sibling.
  const hits = routes.filter(r => r.pattern.test(skeleton));
  hits.sort((a, b) => (b.urlPath.match(/\[/g) ? 0 : 1) - (a.urlPath.match(/\[/g) ? 0 : 1)
    || b.urlPath.split('/').filter(s => !s.startsWith('[')).length - a.urlPath.split('/').filter(s => !s.startsWith('[')).length);
  return hits[0] ?? null;
}

// ── 2. The client literals ────────────────────────────────────────────────────
const TARGET = /\/api\/(admin\/|billing\/(cancel|downgrade)\b)/;
const CLIENT_ROOTS = ['app', 'components', 'lib'];
const files = CLIENT_ROOTS.flatMap(r => walk(path.join(ROOT, r), p =>
  /\.(tsx?|jsx?)$/.test(p) && !/\.test\.[tj]sx?$/.test(p) && !rel(p).startsWith('app/api/')));

/** The literal's URL path, with `${…}` after a `/` standing for one segment. A `${…}` glued to the
 *  end of a segment is a query carrier (`…/payees${orgQuery}`), so the path stops there. */
function skeletonOf(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text.split(/[?#]/)[0];
  let out = node.head.text;
  for (const span of node.templateSpans) {
    if (!out.endsWith('/')) break;
    out += ':p' + span.literal.text;
  }
  return out.split(/[?#]/)[0];
}

function identifiersIn(node, acc = new Set()) {
  if (ts.isIdentifier(node)) acc.add(node.text);
  // ⚠ The braces matter: forEachChild STOPS at the first callback that returns a truthy value,
  // and a Set is truthy — an arrow returning `identifiersIn(…)` saw only the first child.
  ts.forEachChild(node, c => { identifiersIn(c, acc); });
  return acc;
}

const violations = [];
const listed = [];
let scannedFiles = 0;

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  // A component that is HANDED its URL never names a route itself — it must still be read for the
  // `${apiUrl}?…` shape (UpcomingPayablesPanel was exactly this, and a route-name skip missed it).
  if (!TARGET.test(text) && !rel(file).startsWith('components/')) continue;
  scannedFiles++;
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true,
    /\.[jt]sx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const lines = text.split(/\r?\n/);

  // name → initializer nodes, for carrier lookups; name → every identifier that reads it.
  const defs = new Map();
  const uses = new Map();
  (function collect(n) {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      const list = defs.get(n.name.text) ?? [];
      list.push(n.initializer);
      defs.set(n.name.text, list);
    } else if (ts.isIdentifier(n) && !(ts.isVariableDeclaration(n.parent) && n.parent.name === n)) {
      const list = uses.get(n.text) ?? [];
      list.push(n);
      uses.set(n.text, list);
    }
    ts.forEachChild(n, collect);
  })(sf);

  /** Does this identifier carry the org? Its definition mentions orgSlug or is built from
   *  something that does (`const q = orgQuery ? … : …`), it is `.set('orgSlug')`-ed, or it is
   *  named as an org query carrier (a parameter has no local definition to read). */
  const carries = (ident, depth = 0) =>
    /org\w*(query|param|qs)$/i.test(ident)
    || new RegExp(`\\b${ident}\\.(set|append)\\(\\s*['"]orgSlug['"]`).test(text)
    || (defs.get(ident) ?? []).some(init =>
      /orgSlug/.test(init.getText(sf))
      || (depth < 3 && [...identifiersIn(init)].some(i => i !== ident && carries(i, depth + 1))));

  /** A template that carries the org in its text or through one of its `${…}`. */
  const templateCarries = (tpl) =>
    /orgSlug/.test(tpl.getText(sf))
    || (ts.isTemplateExpression(tpl) && tpl.templateSpans.some(s => [...identifiersIn(s.expression)].some(i => carries(i))));

  /** A base constant is judged where it is USED: every request built from it must add the org.
   *  Only a use that turns the base into a REQUEST is judged (a template, a call argument, a `+`,
   *  a prop); a React dependency list or a comparison is not a request. A template that is itself
   *  another base (`const url = \`${apiBase}/x\``) is followed to ITS uses, a few hops deep —
   *  one hop only once made a correct two-step URL fail the build (review 2026-09-25). */
  const baseCarried = (name, depth = 0) => {
    const requests = (uses.get(name) ?? []).filter(u =>
      ts.isTemplateSpan(u.parent) || ts.isCallExpression(u.parent) || ts.isJsxExpression(u.parent)
      || (ts.isBinaryExpression(u.parent) && u.parent.operatorToken.kind === ts.SyntaxKind.PlusToken));
    return requests.length > 0 && requests.every(u => {
      if (!ts.isTemplateSpan(u.parent) || !ts.isTemplateExpression(u.parent.parent)) return false;
      const tpl = u.parent.parent;
      if (templateCarries(tpl)) return true;
      const decl = tpl.parent;
      return depth < 3 && ts.isVariableDeclaration(decl) && ts.isIdentifier(decl.name) && baseCarried(decl.name.text, depth + 1);
    });
  };

  const marked = (line) => {
    for (let l = Math.max(0, line - 3); l <= line; l++) if (/org-slug-ok:/.test(lines[l] ?? '')) return true;
    return false;
  };

  (function visit(n) {
    const isLiteral = ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n);
    if (isLiteral) {
      const raw = n.getText(sf);
      const line = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line;
      if (TARGET.test(raw)) {
        const skeleton = skeletonOf(n);
        const route = matchRoute(skeleton);
        const where = `${rel(file)}:${line + 1}`;
        if (route && route.requires) {
          let ok = templateCarries(n);
          // A base constant (`const apiBase = \`/api/admin/…/events\``) carries nothing itself —
          // see baseCarried.
          if (!ok && ts.isVariableDeclaration(n.parent) && ts.isIdentifier(n.parent.name)) {
            ok = baseCarried(n.parent.name.text);
          }
          if (!ok && route.source === 'body') {
            // Walk up to the call this literal is an argument of; the org may ride in the body.
            let p = n.parent;
            while (p && !ts.isCallExpression(p) && !ts.isSourceFile(p)) p = p.parent;
            if (p && ts.isCallExpression(p) && p.arguments.some(a => /orgSlug/.test(a.getText(sf)))) ok = true;
          }
          if (!ok && marked(line)) ok = true;
          listed.push({ where, route: route.urlPath, ok });
          if (!ok) violations.push({ where, url: raw.slice(0, 120), reason: `route ${route.urlPath} requires orgSlug (${route.source}) — the call never sends it` });
        } else if (LIST) {
          listed.push({ where, route: route ? `${route.urlPath} (no org required)` : `unresolved: ${skeleton}`, ok: true });
        }
        return; // an outer template already judged its nested ones
      }
      // Component URL props: `${fooUrl}?x=` assumes the handed URL has no query of its own.
      if (ts.isTemplateExpression(n) && rel(file).startsWith('components/')) {
        for (const span of n.templateSpans) {
          // Only a URL the component is HANDED (a prop — no local definition); one it builds
          // itself from a path that already names the org is its own business.
          if (ts.isIdentifier(span.expression) && /(url|endpoint|base)$/i.test(span.expression.text)
              && !defs.has(span.expression.text)
              && span.literal.text.startsWith('?') && !marked(line)) {
            violations.push({
              where: `${rel(file)}:${line + 1}`, url: raw.slice(0, 120),
              reason: `appends "?" to the handed URL \`${span.expression.text}\` — an admin caller's URL already carries ?orgSlug=; choose the separator from the URL`,
            });
          }
        }
      }
    }
    ts.forEachChild(n, visit);
  })(sf);
}

// ── 3. Report ─────────────────────────────────────────────────────────────────
if (JSON_OUT) {
  console.log(JSON.stringify({ routes: routes.length, filesScanned: scannedFiles, violations, ...(LIST ? { listed } : {}) }, null, 2));
  process.exit(violations.length ? 1 : 0);
}
if (LIST) for (const l of listed) console.log(`${l.ok ? '  ' : '✗ '}${l.where}  → ${l.route}`);
const checked = listed.filter(l => !l.route.includes('(no org required)') && !l.route.startsWith('unresolved')).length;
if (violations.length === 0) {
  console.log(`✓ org-slug caller guard: ${checked} calls to org-scoped admin routes carry the org (${routes.length} routes, ${scannedFiles} files).`);
  process.exit(0);
}
console.error(`✗ org-slug caller guard: ${violations.length} call(s) to an org-scoped route without the org:`);
for (const v of violations) console.error(`  ${v.where}  ${v.url}\n      — ${v.reason}`);
console.error('\nFix: carry `?orgSlug=` (or `&orgSlug=`) on the URL — the route answers 401 without it.' +
  '\n     If the org is added downstream, say so: `// org-slug-ok: <reason>` on or above the line.');
process.exit(1);
