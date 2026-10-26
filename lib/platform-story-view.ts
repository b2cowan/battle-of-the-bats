/**
 * A Story's shape and its filter — plain, with no database client, so the record screen filters on screen and the
 * builder (`lib/platform-story.ts`) and the Put it back route share one type.
 */
import { planLabel, type StoryKind } from './platform-labels';

export type { StoryKind } from './platform-labels';

/**
 * What Put it back would do, decided once by the Story (R5): the exact target, so the route applies it rather than
 * working it out again.
 */
export type PutBack =
  | { kind: 'plan'; title: string; sentence: string; planId: string; tournamentLimit: number; teamLimit?: number | null }
  | { kind: 'section'; title: string; sentence: string; section: string; on: boolean }
  | { kind: 'override'; title: string; sentence: string; overrideId: string }
  /** Free time's newest change, undone: back to the last free day before it (ended now if that day has passed). */
  | { kind: 'override_end'; title: string; sentence: string; overrideId: string; expectedExpiresAt: string; lastDay: string };

export type PutBackKind = PutBack['kind'];

/** A `platform_audit_log` row as the Story reads it. */
export type AuditRow = {
  id: number | string;
  actor_email: string | null;
  action: string;
  field: string | null;
  old_value: unknown;
  new_value: unknown;
  /** Its own column since mig 380 (R4, owner Q6 2026-10-26). */
  reason?: string | null;
  created_at: string;
};

export function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}
export function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null;
}
/**
 * An entry's reason: the column, else the copy kept inside `new_value`. The fallback is not history alone: production
 * takes the migration before this code, and a row written in between keeps its reason only inside the value (the
 * migration's one-time copy has already run).
 */
export function reasonOfRow(r: Pick<AuditRow, 'reason' | 'new_value'> | null | undefined): string | null {
  if (!r) return null;
  const v = obj(r.new_value);
  return str(r.reason) ?? str(v?.reason) ?? str(v?.change_note) ?? str(v?.changeNote);
}
export function putBackOf(v: unknown): string | null {
  return str(obj(v)?.put_back_of);
}
/** An entry's Why: the reason kept, else "Not recorded" for a staff change (owner Q6), else "—". */
export function whyFields(r: Pick<AuditRow, 'reason' | 'new_value'> | null | undefined, staffChange: boolean): Pick<StoryEntry, 'why' | 'whyNotRecorded'> {
  const reason = reasonOfRow(r);
  if (reason) return { why: reason };
  return staffChange ? { why: null, whyNotRecorded: true } : { why: null };
}
export function planName(id: unknown): string {
  return typeof id === 'string' && id ? planLabel(id) : 'no plan';
}

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
  /** A console refund's Stripe charge: the screen names it by its moment once Stripe has been read (Stage 3). */
  chargeId?: string;
  /** A billing fact Stripe's charges attach to when the screen merges them in (Stage 3): matched on this, never the words. */
  moneyEvent?: 'bought' | 'missed' | 'recovered' | 'moved';
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
