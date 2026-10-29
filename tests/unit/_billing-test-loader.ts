/** Render the shipped TSX with React itself; only bundler-only CSS/Link and explicit external boundaries are adapted. */
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { createElement } from 'react';
import ts from 'typescript';

const native = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, '../..');
export function billingTestLoader(overrides: Record<string, unknown> = {}) {
  const cache = new Map<string, { exports: unknown }>();
  function load(file: string): unknown {
    const absolute = resolve(root, file);
    if (cache.has(absolute)) return cache.get(absolute)!.exports;
    const mod = { exports: {} };
    cache.set(absolute, mod);
    const js = ts.transpileModule(readFileSync(absolute, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    }, fileName: absolute }).outputText;
    const req = (specifier: string): unknown => {
      if (Object.hasOwn(overrides, specifier)) return overrides[specifier];
      if (specifier.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
      if (specifier === 'next/link') return { __esModule: true, default: ({ children, ...props }: Record<string, unknown>) => createElement('a', props, children as never) };
      if (specifier === 'server-only') return {};
      if (specifier.startsWith('@/') || specifier.startsWith('.')) {
        const target = specifier.startsWith('@/') ? resolve(root, specifier.slice(2)) : resolve(dirname(absolute), specifier);
        const found = [target, `${target}.ts`, `${target}.tsx`, `${target}/index.ts`, `${target}/index.tsx`].find(p => /\.tsx?$/.test(p) && existsSync(p));
        if (found) return load(found);
      }
      return native(specifier);
    };
    new Function('require', 'module', 'exports', js)(req, mod, mod.exports);
    return mod.exports;
  }
  return load;
}
