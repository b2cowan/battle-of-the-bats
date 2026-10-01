/**
 * Who retires the admin's old look, and which parts keep a scoped kit layer by design — one home for the
 * two gates Admin Design Continuity left behind when it closed (2026-09-30):
 *   • `scripts/check-admin-old-look.mjs` — the old look's code may only shrink, per file;
 *   • `scripts/check-public-tokens.mjs` (the strict admin colour gate) — an admin stylesheet holds no colour
 *     literal unless it is on the debt list, and the debt list only shrinks.
 * Both name the owning stage in their failure, so the fix lands with the program that rebuilds the screen.
 * Stage names are the programs' own: `TOURNAMENT_ADMIN_REDESIGN_PLAN.md` §5 and
 * `CLUB_TIER_PRODUCTION_READINESS_PLAN.md`.
 */

const T = 'Tournament admin redesign';
const DASHBOARD = `${T} Stage 4 — the dashboard before and after the event`;
const VOLUNTEERS = `${T} Stage 6 — the volunteers`;
const CHAT = `${T} — Chat (no stage names it yet)`;

// First match wins, so the specific prefixes come first.
const OWNERS = [
  ['app/[orgSlug]/admin/tournaments/dashboard/', DASHBOARD],
  ['components/admin/LiveEventLog', DASHBOARD],
  ['components/admin/tournament/GuidanceRail', DASHBOARD],
  ['components/admin/tournament/PersonaPanel', DASHBOARD],
  ['app/[orgSlug]/admin/tournaments/archives/', `${T} Stage 4 — Past tournaments`],
  ['app/[orgSlug]/admin/tournaments/summary/', `${T} Stage 4 — Summary`],
  ['app/[orgSlug]/admin/org/tournaments/', `${T} Stage 4 — the Tournaments list`],
  ['app/[orgSlug]/admin/tournaments/registrations/', `${T} Stage 2 — Teams and registration`],
  ['app/[orgSlug]/admin/tournaments/communication/', `${T} Stage 2 — Communications`],
  ['app/[orgSlug]/admin/tournaments/schedule/', `${T} Stage 3 — the schedule`],
  ['components/admin/NumberStepper', `${T} Stage 3 — the schedule`],
  ['app/[orgSlug]/admin/tournaments/settings/', `${T} Stage 5 — the settings screens`],
  ['app/[orgSlug]/admin/tournaments/divisions/', `${T} Stage 5 — Divisions`],
  ['app/[orgSlug]/admin/tournaments/venues/', `${T} Stage 5 — Venues`],
  ['app/[orgSlug]/admin/tournaments/rules/', `${T} Stage 5 — Rules`],
  ['components/admin/TieBreakerEditor', `${T} Stage 5 — Rules`],
  ['app/[orgSlug]/admin/tournaments/branding/', `${T} Stage 5 — Public site`],
  ['app/[orgSlug]/admin/onboarding/', `${T} Stage 5 — the first-run setup (F25)`],
  ['components/admin/TournamentSetupWizard', `${T} Stage 5 — the creation wizards`],
  ['components/admin/TournamentStyleCards', `${T} Stage 5 — the creation wizards`],
  ['app/[orgSlug]/scorekeeper/', VOLUNTEERS],
  ['app/[orgSlug]/check-in/', VOLUNTEERS],
  ['components/volunteer/', VOLUNTEERS],
  ['app/[orgSlug]/admin/tournaments/staff-kit/', `${T} — Staff kit (no stage names it yet)`],
  ['app/[orgSlug]/admin/tournaments/chat/', CHAT],
  // Admin-only, though they live in components/chat: the admin chat page is their one importer.
  ['components/chat/', CHAT],
  ['components/admin/tournament/', `${T} — whichever stage rebuilds the last screen using the shared tournament header and toolbar`],
  ['app/[orgSlug]/admin/admin-common.module.css', 'whichever redesign stage rebuilds its last user (tournament and club screens share it)'],
  ['app/[orgSlug]/admin/accounting/', 'Club Tier Stage 3 — Accounting'],
  ['app/[orgSlug]/admin/public-site/', 'Club Tier Stage 4 — the public site editor'],
  ['app/[orgSlug]/admin/org/venues/', 'Club Tier Stage 6 — the venue library'],
  ['app/[orgSlug]/admin/house-league/', 'Club Tier Stage 9 — house league'],
];

/** The stage that retires a file's old look — or the plain answer that nothing is coming for it. */
export const ownerOf = (file) => OWNERS.find(([p]) => file.startsWith(p))?.[1]
  ?? 'no stage — nothing is coming to rebuild it, so retire it in this change';

/**
 * Parts another surface also wears. Their BASE rules are that surface's look, so their kit layer stays
 * scoped and is never folded (Part B area 1's ruling): the old-look ratchet does not count them, and the
 * strict colour gate holds only their kit rules, never their base rules.
 */
export const SHARED_SURFACE = new Map([
  ['app/globals.css', "the admin's skin over GLOBAL classes (.btn, .badge, .modal, .form-*) the public site, marketing, the platform console and the coaches portal also wear"],
  ['components/admin/BottomSheet.module.css', 'the public follow / unfollow sheets wear its base rules'],
  ['components/admin/ExportMenu.module.css', 'seven platform-console pages wear its base rules'],
  ['components/admin/CollapsibleCard.module.css', 'the platform console wears its base rules'],
  ['components/help/help.module.css', 'the coaches portal and the platform console wear the help guide'],
  ['components/admin/TournamentCreationPreview.module.css', 'a picture of the PUBLIC tournament page inside the creation wizard — the public look by ruling (R2), not the admin\'s'],
]);
