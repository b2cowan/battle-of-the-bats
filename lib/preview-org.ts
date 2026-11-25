/**
 * lib/preview-org.ts — THE ONE "this club is a preview" rule (Club Website Track P, owner ruling T1, 2026-11-25).
 *
 * A preview is a prospect's own club site that we build before a meeting: their name, web address, logo and colours over a
 * fixed made-up sample, on production, with NO people in it (T3: no owner, no member, nobody signs in). The club either
 * claims it in the room (it becomes theirs and a customer from that day, T10) or it removes itself 30 days after the
 * meeting (T11).
 *
 * The marker is ONE column, `organizations.is_preview`, kept in step with the open row of `organization_previews` by the database
 * (migration 535): app code never writes it. Every count, list, search and send that reads organizations reads it, and
 * `tests/unit/preview-org-guard.test.ts` fails the build when a new one does not.
 *
 * What a preview IS, everywhere:
 *   - **Not a customer.** Never counted (Business numbers, Today, Renewals, Plans & pricing impact, retention), never
 *     listed (Clubs & portals, Bulk changes, People, Leads, Free time, Online payments, Stripe watch, the email opt-out
 *     list), never written to by an operator tool (Bulk changes, Free time, a lead's club). Find still finds one by name,
 *     labelled, so the owner can open it.
 *   - **Silent.** No email, bell, push or fan alert: the main sender refuses a preview's mail, and refuses when it cannot
 *     tell (fail closed). No platform event is written for one.
 *   - **Unindexed and unlisted.** "Don't index" on every page and in the response header; no sitemap entry; never a
 *     robots.txt line (that file is public and would list our prospects). The directory and "discoverable" read false
 *     whatever is stored.
 *   - **Watched.** Error alerts stay ON: a preview is in front of a prospect, so a fault there matters more, not less.
 *
 * ⚠ Why this is NOT the demo list (`lib/demo-org.ts`). The demo list means two things at once: "not a customer, silent,
 * unindexed" (a preview needs all of it) and "a read-only shared sandbox with a banner and a no-login door" (a preview
 * must have none of it: the club claims it, and the room's live score is written into it). Adding a preview to the demo
 * list would hand it the write block, the sandbox chrome and the silenced error alerts. Keep the two apart.
 *
 * Client-safe: no server imports. The id lookups are in `lib/preview-org-server.ts`.
 */

/**
 * The sections a preview's public site shows, folded in at the entitlement door (`/billing`, 2026-11-25): the club site,
 * the house league season and the rep teams (the tournament is in every plan). `plan_id` stays at the free start; a
 * preview is never `club` + `active` and never free time (a whole-plan grant refuses checkout, and any grant is a
 * customer grant). Nobody signs in to a preview, so these open its public pages only. The claim clears the marker in its
 * own write, and with it these.
 */
export const PREVIEW_SECTIONS: readonly string[] = ['module_public_site', 'module_house_league', 'module_rep_teams'];

/** The org row's marker, read off a `select('*')` or an explicit `is_preview` column. A missing column reads false. */
export function isPreviewRow(row: { is_preview?: boolean | null } | null | undefined): boolean {
  return row?.is_preview === true;
}
