/**
 * Reading every row, and asking about many ids — the two loops every money read needs, named once.
 *
 * ⚠ A Supabase select stops at 1,000 rows WITHOUT AN ERROR (Club Tier C14: the ledger summaries
 * silently left out everything after the thousandth line). `fetchAll` pages until a page comes back
 * short. ⚠ A long `.in(…)` list rides in the URL and fails on its length, so `chunked` splits it.
 *
 * Imports nothing from the app, so lib/db.ts and the club money modules can both use it without a
 * cycle. (lib/family-email.ts keeps its own private copy, written first — the same two loops.)
 */

const PAGE_SIZE = 1000;
const IN_CHUNK = 200;

/** Every row a query can return, page by page. `build(from, to)` is the query with `.range(from, to)`. */
export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) return out;
  }
}

/** Split an id list into `.in()`-sized chunks. */
export function chunked<T>(items: readonly T[], size: number = IN_CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Every row for many ids: one paged read per chunk, the chunks in parallel, flattened. */
export async function fetchAllIn<T>(
  ids: readonly string[],
  build: (chunk: string[], from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[]> {
  if (ids.length === 0) return [];
  const parts = await Promise.all(chunked([...new Set(ids)]).map(c => fetchAll<T>((a, b) => build(c, a, b))));
  return parts.flat();
}

/** `fn` over `items`, at most `limit` at a time, results in order. */
export async function inParallel<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
