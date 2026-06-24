/**
 * lib/chat-reactions.ts — the canonical FIXED reaction set for Tournament Chat (Phase 3C).
 *
 * Owner decision (2026-06-22): a fixed seven-emoji set, NOT a full picker. This list is the single
 * source of truth shared by the composer's reaction button (client), the toggle route + service
 * (server), and it mirrors the DB CHECK constraint in migration 147 (chat_message_reactions_emoji_check).
 * Pure module (no server-only import) so the client can import it too.
 *
 * IMPORTANT: keep these glyphs byte-for-byte in sync with the migration's CHECK (note ❤️ carries the
 * U+FE0F variation selector). Changing the set is a migration + this file in the same unit of work.
 */

export const REACTION_EMOJI = ['👍', '👎', '❤️', '✅', '😂', '🎉', '🙏'] as const;

export type ReactionEmoji = (typeof REACTION_EMOJI)[number];

const REACTION_SET: ReadonlySet<string> = new Set(REACTION_EMOJI);

/** True if `value` is exactly one of the seven allowed reaction emojis. */
export function isReactionEmoji(value: unknown): value is ReactionEmoji {
  return typeof value === 'string' && REACTION_SET.has(value);
}

/** Per-message reaction roll-up the client renders: emoji → { how many reacted, did I }. */
export type ReactionSummary = Record<string, { count: number; mine: boolean }>;

/** Reactions for a set of messages, keyed by message id (only messages with ≥1 active reaction appear). */
export type MessageReactionsMap = Record<string, ReactionSummary>;
