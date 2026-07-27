/**
 * Lets `node --test` load app modules that import each other.
 *
 * The app writes relative imports without an extension (`./timezone`) because the Next.js
 * bundler resolves them. Node's ESM loader does not, so before this hook the unit suite could
 * only cover LEAF modules — anything with a relative import was untestable. That is a real
 * constraint: it excluded exactly the shared logic most worth testing.
 *
 * The hook retries an unresolved relative specifier as `.ts`, then `.tsx`, then `/index.ts`.
 * It only ever runs after normal resolution has already failed, so it cannot shadow a real file.
 *
 *   node --import ./tests/ts-resolver.mjs --test tests/unit/*.test.ts
 */
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register(new URL('./ts-resolver-hooks.mjs', import.meta.url), pathToFileURL('./'));
