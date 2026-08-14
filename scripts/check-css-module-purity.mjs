#!/usr/bin/env node
/**
 * check-css-module-purity.mjs — catch a CSS Module rule that only the PRODUCTION build rejects.
 *
 * ⚠ WHY THIS EXISTS, and it is not hypothetical. A `*.module.css` rule must contain at least one
 * local class or id ("pure"), because a module's job is to scope what it declares. The two CSS
 * pipelines this repo runs disagree about enforcing that:
 *
 *   dev  — Turbopack / LightningCSS  → compiles a fully global rule silently
 *   prod — `next build --webpack`    → hard error: "Selector ... is not pure"
 *
 * So a global rule inside a module is invisible on localhost, invisible to lint, invisible to
 * `tsc`, and invisible to `verify:changed` — it surfaces only as a red Amplify build minutes after
 * a push. That is exactly what happened on 2026-08-14: `:global(:root)` declaring the Money hub's
 * type-scale variables was written on 08-13, sat on dev for a day, and failed Amplify dev job 255
 * at the first build that saw it. This gate moves that discovery to the keyboard.
 *
 * What counts as a violation: a style rule (at any nesting depth, including inside @media/@supports
 * /@layer) where EVERY selector in the list is global — i.e. none of them carries a `.class` or
 * `#id` outside of `:global(...)`. Bare `:root`, `html`, `body`, and element-only selectors are
 * therefore violations too, which matches webpack.
 *
 * The fix is never to delete the declarations: hang them on the nearest LOCAL ancestor class the
 * consumers share (see the money type scale on `.coachesShell`), or move genuinely app-wide ones
 * into a real global stylesheet.
 *
 * Usage: node scripts/check-css-module-purity.mjs   (exit 1 on any violation)
 *        node scripts/check-css-module-purity.mjs --json
 */
import fs from 'node:fs';
import path from 'node:path';

const JSON_OUT = process.argv.includes('--json');
const SCAN_ROOTS = ['app', 'components', 'lib'].map((d) => path.resolve(d));
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build']);

function collectModuleCss(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const child = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectModuleCss(child));
    else if (entry.name.endsWith('.module.css')) out.push(child);
  }
  return out;
}

/** Blank out /* … *​/ comments in place (keeping newlines) so line numbers stay honest. */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

/** Split a selector list on top-level commas — commas inside (), [], "" belong to the selector. */
function splitSelectorList(prelude) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let current = '';
  for (const c of prelude) {
    if (quote) {
      current += c;
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; current += c; continue; }
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    if (c === ',' && depth === 0) { parts.push(current); current = ''; continue; }
    current += c;
  }
  parts.push(current);
  return parts.map((s) => s.trim()).filter(Boolean);
}

/** Remove every `:global(...)` payload, and everything after a bare `:global` / `:global `. */
function dropGlobalParts(selector) {
  let out = '';
  for (let i = 0; i < selector.length; i++) {
    if (selector.startsWith(':global', i)) {
      let j = i + ':global'.length;
      while (j < selector.length && /\s/.test(selector[j])) j++;
      if (selector[j] === '(') {
        // Balanced-paren skip — the payload is global, so it contributes no local name.
        let depth = 0;
        for (; j < selector.length; j++) {
          if (selector[j] === '(') depth++;
          else if (selector[j] === ')') { depth--; if (depth === 0) { j++; break; } }
        }
        i = j - 1;
        continue;
      }
      // Bare `:global` switches the REST of this selector to global scope.
      break;
    }
    out += selector[i];
  }
  return out;
}

/** True when a single selector carries at least one local class or id. */
function isPureSelector(selector) {
  const local = dropGlobalParts(selector)
    // Attribute values can contain dots/hashes that are not selectors: [href="#x"], [class~=".a"].
    .replace(/\[[^\]]*\]/g, '[]');
  return /[.#][A-Za-z_-]/.test(local);
}

const violations = [];
const files = SCAN_ROOTS.flatMap(collectModuleCss).sort();

for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8');
  const css = stripComments(raw);

  // Walk the stylesheet tracking brace depth, and remember which at-rules we are inside.
  // A prelude is the text between the last block boundary and the `{` that opens a block.
  const stack = []; // one entry per open block: 'style' | 'nested-at' | 'other-at'
  let prelude = '';
  let preludeStart = 0;

  for (let i = 0; i < css.length; i++) {
    const c = css[i];

    if (c === '{') {
      const text = prelude.trim();
      const isAtRule = text.startsWith('@');
      // Inside @keyframes the "selectors" are 0%/from/to — not selectors at all.
      const insideKeyframes = stack.some((k) => k === 'keyframes');

      if (isAtRule) {
        stack.push(/^@keyframes|^@-\w+-keyframes/i.test(text) ? 'keyframes' : 'at');
      } else {
        stack.push('style');
        if (!insideKeyframes && text) {
          const selectors = splitSelectorList(text);
          // webpack's rule is per-RULE: a list needs at least one local selector to survive.
          if (selectors.length > 0 && !selectors.some(isPureSelector)) {
            violations.push({
              file: path.relative(process.cwd(), file).replace(/\\/g, '/'),
              line: css.slice(0, preludeStart).split('\n').length,
              selector: text.replace(/\s+/g, ' '),
            });
          }
        }
      }
      prelude = '';
      preludeStart = i + 1;
      continue;
    }

    if (c === '}' || c === ';') {
      stack.length && c === '}' && stack.pop();
      prelude = '';
      preludeStart = i + 1;
      continue;
    }

    if (!prelude.trim() && /\s/.test(c)) { preludeStart = i + 1; continue; }
    prelude += c;
  }
}

if (JSON_OUT) {
  console.log(JSON.stringify({ filesScanned: files.length, violations }, null, 2));
} else if (violations.length === 0) {
  console.log(`✓ CSS Module purity: ${files.length} module stylesheet(s) clean (every rule is locally scoped).`);
} else {
  console.error(`\n✗ CSS Module purity: ${violations.length} global rule(s) inside a CSS Module — these compile on the dev server and FAIL the production build:\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  ${v.selector}`);
  }
  console.error(`\n  webpack: "Selector ... is not pure (pure selectors must contain at least one local class or id)".`);
  console.error(`  Fix: hang the rule on the nearest LOCAL ancestor class its consumers share, or move a`);
  console.error(`  genuinely app-wide declaration into a real global stylesheet (app/globals.css).\n`);
}

process.exit(violations.length > 0 ? 1 : 0);
