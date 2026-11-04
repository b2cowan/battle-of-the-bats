/** Render the shipped TSX with React itself; only bundler-only CSS/Link and explicit external boundaries are adapted. */
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { createElement } from 'react';
import ts from 'typescript';

const native = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, '../..');

/**
 * GST/HST Stage 1 Part 2: every paid route asks `requireBillingLocation` before Stripe, and the real one reads the
 * database. A route loaded here sees a buyer with a valid Canadian address on file unless the test passes its own
 * '@/lib/billing-location-server' override (tests/unit/billing-location-checkout-guard.test.ts pins the check itself).
 */
const ADDRESS_ON_FILE = { country: 'CA', regionCode: 'ON', line1: '120 Elm Street', line2: null, city: 'Guelph', postalCode: 'N1H 4H2' };
const billingLocationOnFile = {
  usSalesOpen: () => false,
  billingBuyerOf: (org: { id?: string; name?: string; accountKind?: string; planId?: string }, user: { id?: string }) =>
    org?.accountKind === 'team_workspace' || org?.planId === 'team' ? { kind: 'user', userId: user?.id } : { kind: 'org', orgId: org?.id, name: org?.name },
  readBillingLocation: async () => ({ ...ADDRESS_ON_FILE, confirmedAt: '2026-11-03T12:00:00Z', usDeclarationAt: null, usDeclarationVersion: null }),
  requireBillingLocation: async () => ({ ok: true, location: ADDRESS_ON_FILE }),
  saveBillingLocation: async () => ({ ok: true, location: { ...ADDRESS_ON_FILE, confirmedAt: '2026-11-03T12:00:00Z', usDeclarationAt: null, usDeclarationVersion: null } }),
  saveRefusalResponse: () => Response.json({ code: 'invalid_billing_address' }, { status: 400 }),
  billingAddressFromBody: () => null,
  stampStripeCustomerAddress: async () => {},
  copyBillingLocationToStripe: async () => {},
  recordCardCountry: async () => {},
};

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
      if (specifier === '@/lib/billing-location-server') return billingLocationOnFile;
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
