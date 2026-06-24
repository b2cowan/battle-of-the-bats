/**
 * lib/chat-polls.ts — shared types + helpers for in-chat polls (Tournament Chat, Phase 3C).
 *
 * A poll IS a chat message: its question is the message body, and its options + settings ride the
 * message's `metadata.poll` (so create/close reuse the existing message realtime). The only separate
 * live store is the VOTES (`chat_poll_votes`, mig 148). Pure module (no server-only import) so both
 * the client and the server can use it.
 *
 * Owner decisions (2026-06-23): organizers create polls; the creator picks single- vs multiple-choice
 * per poll; voters are VISIBLE (who-voted is shown); the creator can close a poll.
 */

export type PollOption = { id: string; text: string };

/** The poll definition stored on the poll message's metadata.poll. */
export type PollDefinition = {
  options: PollOption[];
  /** creator-chosen: allow each voter to pick several options (else single-choice). */
  multiple: boolean;
  /** ISO timestamp when the creator closed voting; null = still open. */
  closedAt: string | null;
};

/** Live tally for one poll: optionId → { how many voted it, did I }. */
export type PollTally = Record<string, { count: number; mine: boolean }>;

/** Tallies for a set of poll messages, keyed by message id. */
export type PollTalliesMap = Record<string, PollTally>;

export const MIN_POLL_OPTIONS = 2;
export const MAX_POLL_OPTIONS = 8;
export const MAX_POLL_OPTION_LEN = 120;
export const MAX_POLL_QUESTION_LEN = 300;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Pull a typed PollDefinition out of a message's metadata jsonb (defensive — tolerates any shape). */
export function extractPoll(metadata: Record<string, unknown> | null | undefined): PollDefinition | null {
  const p = (metadata?.poll ?? null) as
    | { options?: unknown; multiple?: unknown; closedAt?: unknown }
    | null;
  if (!p || !Array.isArray(p.options)) return null;
  const options: PollOption[] = p.options
    .map((o) => (o && typeof o === 'object' ? (o as { id?: unknown; text?: unknown }) : null))
    .filter((o): o is { id: string; text: string } =>
      !!o && typeof o.id === 'string' && UUID_RE.test(o.id) && typeof o.text === 'string')
    .map((o) => ({ id: o.id, text: o.text }));
  if (options.length < MIN_POLL_OPTIONS) return null;
  return {
    options,
    multiple: p.multiple === true,
    // Only accept a parseable ISO timestamp; a junk string must not silently render the poll "closed".
    closedAt: (typeof p.closedAt === 'string' && !Number.isNaN(Date.parse(p.closedAt))) ? p.closedAt : null,
  };
}

/**
 * Validate + normalize raw poll input from the composer (question text + option texts). Returns the
 * trimmed question and de-blanked options, or an error string. Option IDs are NOT assigned here (the
 * server does that with real uuids); this only checks counts/lengths/emptiness.
 */
export function validatePollInput(
  question: string,
  optionTexts: string[],
): { ok: true; question: string; options: string[] } | { ok: false; error: string } {
  const q = (question ?? '').trim();
  if (!q) return { ok: false, error: 'Add a question for the poll.' };
  if (q.length > MAX_POLL_QUESTION_LEN) return { ok: false, error: 'The poll question is too long.' };
  const opts = (optionTexts ?? []).map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean);
  if (opts.length < MIN_POLL_OPTIONS) return { ok: false, error: 'Add at least two options.' };
  if (opts.length > MAX_POLL_OPTIONS) return { ok: false, error: `A poll can have at most ${MAX_POLL_OPTIONS} options.` };
  if (opts.some((t) => t.length > MAX_POLL_OPTION_LEN)) return { ok: false, error: 'One of the options is too long.' };
  if (new Set(opts.map((t) => t.toLowerCase())).size !== opts.length) return { ok: false, error: 'Poll options must be unique.' };
  return { ok: true, question: q, options: opts };
}
