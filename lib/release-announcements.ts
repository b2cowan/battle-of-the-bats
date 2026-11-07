/**
 * Announced releases — the ONLY thing that lights the account menu's "New" tag and the Overview's one-line note
 * (owner ruling 2026-11-07, `docs/projects/active/WHATS_NEW_HOME_PLAN.md`).
 *
 * Every release appears in the What's new list (`lib/release-notes.ts`); a release is ANNOUNCED only when the owner
 * answered yes to the release agent's proposal (`.claude/commands/release.md` step 1d-3). The agent then adds one entry
 * here, newest first. Never add one the owner has not approved.
 *
 * Kept apart from `RELEASE_ENTRIES` on purpose: this file is a few lines, so the account menu on every public page can
 * read it without carrying the whole changelog in its bundle.
 *
 *   { date: '2026-11-12', line: 'New: a Rainout button on the house league schedule.' }
 *
 * `date` is the release's own date (the one on its changelog entry). `line` is ONE plain customer sentence, no markup.
 */
export interface Announcement {
  date: string;
  line: string;
}

export const ANNOUNCEMENTS: Announcement[] = [];

/** The newest announced release, or null. */
export const LATEST_ANNOUNCED: Announcement | null = ANNOUNCEMENTS[0] ?? null;

/** An announcement is news for a month, then it goes quiet on its own — so a brand-new device, or one whose storage was
 *  cleared, is never shown an announcement from long ago as if it were new. */
export const ANNOUNCE_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The rule, pure: an announcement is unread when it is within the window AND this device has not stored a date at or
 * after it. A missing marker ('') is older than any date, so a fresh device sees a RECENT announcement and no old one.
 */
export function isAnnouncementUnread(announced: Announcement | null, seen: string, nowMs: number): boolean {
  if (!announced) return false;
  const announcedAt = Date.parse(`${announced.date}T00:00:00Z`);
  if (Number.isNaN(announcedAt) || nowMs - announcedAt > ANNOUNCE_WINDOW_DAYS * DAY_MS) return false;
  return seen < announced.date;
}
