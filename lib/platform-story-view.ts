/**
 * A Story's shape and its filter — plain, with no database client, so the record screen filters on screen and the
 * builder (`lib/platform-story.ts`) and the Put it back route share one type.
 */
import type { StoryKind } from './platform-labels';

export type { StoryKind } from './platform-labels';

/**
 * What Put it back would do, decided once by the Story (R5): the exact target, so the route applies it rather than
 * working it out again.
 */
export type PutBack =
  | { kind: 'plan'; title: string; sentence: string; planId: string; tournamentLimit: number; teamLimit?: number | null }
  | { kind: 'section'; title: string; sentence: string; section: string; on: boolean }
  | { kind: 'override'; title: string; sentence: string; overrideId: string };

export type PutBackKind = PutBack['kind'];

export type StoryEntry = {
  /** Stable key — also what a Put it back names (`audit:<id>`, `audit:<id>:<section>`, `override:<id>`, …). */
  key: string;
  at: string;
  kind: StoryKind;
  title: string;
  /** A change between two codes (a web name), drawn in the data face after the title's words. */
  codes?: [string, string];
  sub?: string;
  who: string;
  /** The reason; null when a reason does not apply ("—"). */
  why: string | null;
  /** True for an older change that never kept its reason ("Not recorded"). */
  whyNotRecorded?: boolean;
  /** Offered only on plan/limit, section and running-override entries that can still be undone. */
  putBack?: PutBack;
  /** When this entry was put back (the door goes; the grey line says when). */
  putBackAt?: string;
};

/** Narrow a Story by type and words (case-insensitive over what each row says). */
export function filterStory(entries: readonly StoryEntry[], opts: { kind?: StoryKind | null; words?: string }): StoryEntry[] {
  const w = (opts.words ?? '').trim().toLowerCase();
  return entries.filter(e => {
    if (opts.kind && e.kind !== opts.kind) return false;
    if (!w) return true;
    return [e.title, e.codes?.join(' '), e.sub, e.who, e.why].some(s => s?.toLowerCase().includes(w));
  });
}
