import { hasRecordAccess, canConfigureTeam, canWriteMoney, type CoachCapabilities } from './coach-capabilities';

/**
 * The CLOSED-season nav set. Batch 3 shipped this as exactly two doors — everything else a
 * coach built was unreachable the moment the season ended. Chunk F opens it to the full record
 * set, still capability-gated by `isCoachNavItemVisible` against THAT season's grants.
 *
 * What is deliberately absent, and why (owner ruling D-F1/D-F7, 2026-08-01) — records in,
 * instruments out:
 *   • Chat / Email families — a finished season must not offer to message a team that no
 *     longer exists.
 *   • Settings — nothing in a finished season is configurable.
 *   • Tryouts points at `/tryouts/history`, NOT the live hub: the hub runs a tryout
 *     (check-in, evaluator links, decisions, offer emails); the archive records one.
 *   • Money points at the records hub; payment requests and allocations move money and stay
 *     live-season only.
 * Season's End leads because it is the archive's front door (D-F2). Icons resolve per
 * component; a door added here reaches both navs at once.
 */
export const CLOSED_TEAM_NAV_ITEMS: { label: string; href: string }[] = [
  { label: "Season's End", href: '/season-end' },
  { label: 'Roster',       href: '/roster' },
  { label: 'Schedule',     href: '/schedule' },
  { label: 'Lineups',      href: '/lineups' },
  { label: 'Money',        href: '/accounting' },
  { label: 'Documents',    href: '/documents' },
  { label: 'Development',  href: '/development' },
  { label: 'Tryouts',      href: '/tryouts/history' },
  /**
   * ⚠ THE HUB, not the results page (archive rail Phase 2, 2026-08-16). This pointed at
   * `/history/results` for as long as the hub was live-season-only, and that one workaround is
   * what forced Attendance to keep an archive-only nav entry — the results page carries no
   * attendance door, so the menu was the only route to a past season's report. The hub reads its
   * season now, so the door is the hub again and both navs tell one story.
   *
   * ⚠⚠ ORDER MATTERED HERE. Attendance could only leave this list once the hub was genuinely the
   * door; deleting it first would have made a past season's attendance unreachable, which is the
   * exact defect the live-nav tidy-up caught and avoided a day earlier.
   */
  { label: 'Insights',     href: '/history' },
  { label: 'Staff',        href: '/staff' },
];

/**
 * ⚠ SECTIONS THAT EXIST IN AN ARCHIVE WITHOUT A MENU ENTRY — and why this list has to exist.
 *
 * The archive MENU is not the same question as "which sections can a finished season render".
 * Attendance is the case that proves it: it is an approved archive door (D-F1), its page and route
 * are both season-aware, and it is reached through the Insights hub exactly as it is in a live
 * season — it simply has no line of its own in the menu any more.
 *
 * `resolveSeasonSwitchHref` used to answer "does this section exist in an archive?" from
 * `CLOSED_TEAM_NAV_ITEMS` alone. Once Attendance left that list, a coach reading the LIVE
 * attendance report and switching to a past season would have been dumped on Season's End instead
 * of that season's report — a working destination silently replaced by a fallback, because the
 * menu was standing in for a question it does not actually answer.
 */
export const CLOSED_SECTION_EXTRAS: string[] = ['/attendance'];

/**
 * ⚠ THE INVERSE, AND THE SUBTLER HALF: sections UNDER an archive-reachable prefix that do not
 * themselves exist in a finished season.
 *
 * `/history` is now an archive door, and a prefix match on it sweeps in every page beneath it —
 * including the two Insights reports a record deliberately hides. Without this list, switching to a
 * past season from the live playing-time or opponents report would keep the coach on a page the
 * archive hides everywhere else, reached through the one control that bypassed the hiding.
 *
 *   · playing-time — `lineup-analytics` is not on the season-read rail, and was ruled
 *     live-season-only PERMANENTLY (owner, 2026-08-16). It cannot serve a past season at all.
 *   · opponents — the scouting book is an INSTRUMENT (owner ruling 2026-08-04, ratified again
 *     2026-08-16); its notes are the team's current book, not a snapshot of that year.
 *
 * Both fall back to Season's End, the archive's front door, rather than to a page that would
 * quietly answer with the live season.
 */
/**
 * Named so the hub and this list cannot disagree by typo. The Insights hub asks
 * `archiveHasSection(PLAYING_TIME_SECTION)` rather than restating `!isReadOnly`, so reversing
 * either ruling is a one-line edit HERE and the tile follows.
 */
export const PLAYING_TIME_SECTION = '/history/playing-time';
export const OPPONENTS_SECTION = '/history/opponents';

export const LIVE_ONLY_ARCHIVE_SECTIONS: string[] = [
  PLAYING_TIME_SECTION,
  OPPONENTS_SECTION,
  /**
   * ⚠⚠ THESE TWO ARE A PRE-EXISTING DEFECT THIS LIST EXPOSED (`/review` 2026-08-16) — not something
   * Phase 2 introduced, and the switcher reached them before this list existed too.
   *
   * The drill library and the plan-template library are INSTRUMENTS, ruled live-season-only by the
   * owner on 2026-08-01, with a dedicated build-enforced test each in
   * `tests/unit/coach-season-write-guard.test.ts`. Their routes are off the season-read rail, their
   * pages read no `?year=` at all, and the Development hub already hides both doors in a record.
   *
   * But `/development` IS an archive door, so a prefix match sweeps its children in — which left the
   * SEASON SWITCHER as the one control that still reached them. Switching from the live drill
   * library to a past season landed a coach on the LIVE drills under a past-season chip: every row
   * correct, every row the wrong year, no error anywhere.
   *
   * It is fixed here rather than left because this list is now the stated answer to "which
   * live-only sections sit under an archive prefix" — and a list that holds two of the four cases
   * is a guard that reads as complete while being half blind, which is worse than no list.
   */
  '/development/drills',
  '/development/templates',
];

/**
 * ⚠ Matches on a PATH BOUNDARY, not a bare prefix (`/review` 2026-08-16).
 *
 * A plain `startsWith` answers yes for `/rosterNotes` against `/roster` — the two share letters,
 * not a parent. No such collision exists in the tree today, which is exactly why it is worth
 * closing now: the failure would be a future route silently classified as archive-reachable (or
 * silently hidden) with no type error and nothing rendered wrongly enough to notice.
 *
 * A section belongs to an href when it IS that href, or continues it with `/` (a child route) or
 * `?` (the same page with a query — the Money hub's tabs arrive as `/accounting?section=dues`).
 */
function isUnder(section: string, href: string): boolean {
  if (href === '') return false;
  return section === href || section.startsWith(`${href}/`) || section.startsWith(`${href}?`);
}

/**
 * Does a finished season have this section at all? The union of the menu and the hub-reached
 * extras, minus the live-only pages that sit under an archive-reachable prefix.
 *
 * ⚠ The subtraction is checked FIRST and deliberately: `/history/playing-time` is a child of
 * `/history`, so a plain "some item matches" test answers yes for a page the archive hides.
 */
export function archiveHasSection(section: string): boolean {
  if (LIVE_ONLY_ARCHIVE_SECTIONS.some(s => isUnder(section, s))) return false;
  return [...CLOSED_TEAM_NAV_ITEMS.map(i => i.href), ...CLOSED_SECTION_EXTRAS]
    .some(href => isUnder(section, href));
}

/**
 * Whether a coach nav item (keyed by its display label) is visible for the given capabilities.
 *
 * SHARED by CoachesSidebar and CoachesBottomNav so the assistant-coach gate is a SINGLE source of
 * truth — it used to be duplicated in both components, which risked silent drift. Head coaches have
 * full capabilities so nothing hides. Fail-open when caps are absent (still loading) — every coach
 * route enforces the capability server-side regardless.
 *
 * Labels renamed keep their old routes: "Money" → /accounting, "Insights" → /history (Phase-3
 * rebuild renamed History → "Season Review"; the 2026-07-08 Insights consolidation renamed it
 * again and moved it to the Season group — the gate stays the old History gate).
 */
export function isCoachNavItemVisible(caps: CoachCapabilities | undefined, label: string): boolean {
  if (!caps) return true;
  switch (label) {
    // ⚠ A1 (2026-08-03): was `caps.roster !== 'off'`. The roster PAGE is a record surface, so it
    // follows record access; the NAMES on it are baseline and no longer gate anything.
    case 'Roster':        return hasRecordAccess(caps);
    /**
     * ⚠ NOT A NAV ITEM ANYWHERE ANY MORE — live (2026-08-15) or archived (2026-08-16) — and this
     * case stays anyway, which is the whole point. It is the shared answer to "may this coach open
     * the attendance report", asked now by callers that are not a nav at all: the Insights hub's
     * "Who's showing up?" door in BOTH seasons, and the Overview's coaching-pair tile
     * (`resolveCoachingPair`). Deleting it because no menu lists the label would fall through to
     * `default: return true` and hand the report to a helper.
     *
     * ⚠ A1: this needed BOTH grants only because the route gated on roster visibility while the
     * page leads with "take attendance for {next event}". The route gates on `attendance` now, so
     * one grant answers both and the door can no longer 403.
     */
    case 'Attendance':    return caps.attendance;
    case 'Lineups':       return caps.lineups;
    case 'Schedule':      return caps.schedule;
    /**
     * The practice-plans hub (2026-08-15). Keyed on the READ half of the schedule split, not the
     * manage half, because that is exactly what the page behind it needs: the events read it lists
     * from gates on `canViewSchedule`, and the plan itself is readable to anyone who can see the
     * schedule. Writing a plan stays head-coach-only and is enforced by the plan route, not here —
     * an assistant who can see the list but not edit finds a page that says so, which is better
     * than a door that vanishes.
     */
    case 'Practice plans': return caps.schedule;
    case 'Tryouts':       return caps.tryouts;
    // Hidden unless the coach can send (no draft UI yet). When the draft flow ships, switch this to
    // always-visible or a dedicated `canDraftAnnouncements` cap so granted assistants can draft.
    //
    // ⚠ This gate is keyed by DISPLAY LABEL, so a rename that misses this switch falls through to
    // `default: return true` and hands an ungranted assistant the door. Chunk B renamed the door to
    // "Email families" (the old label gave a coach no way to tell it apart from Chat); the old label
    // is kept as a fallthrough deliberately — the portal tour still asks for it by its old name, and
    // any surface a future rename misses keeps gating instead of silently opening.
    case 'Email families':
    case 'Announcements': return caps.announcementsSend;
    case 'Money':         return caps.money !== 'off';
    /**
     * Open to any assigned COACH: the hub shows record / roster size / tryout trend to everyone;
     * the money rows inside stay money-gated server-side (Phase 4 F2 split) and the lineup /
     * attendance sections gate per-section on their own capabilities.
     *
     * ⚠ 2026-08-03: `return true` was the only door in this switch that no grant governed, which
     * made it the one door a HELPER would have kept. A helper holds none of the record grants, so
     * this closes for them and for nobody else — every real assistant carries attendance, lineups
     * and documents from the defaults, and any assistant hand-stripped of all of them is looking at
     * a hub of sections they cannot see the contents of anyway.
     *
     * ⚠ A1 (2026-08-03): the hand-written union here WAS `hasRecordAccess` minus notes/documents/
     * tryouts. Collapsed onto the shared predicate so the archive door, the nav and the Overview
     * cannot drift apart — they were three copies of one idea.
     */
    case 'Insights':      return hasRecordAccess(caps);
    // Player Development (3B): the hub is useful with EITHER goals (notes) or measurables, and both
    // ride record access since A1; all writes stay head-coach-only server-side (D1).
    case 'Development':   return hasRecordAccess(caps);
    case 'Documents':     return caps.documents !== 'off';
    case 'Staff':         return caps.isHeadCoach;
    /**
     * ── The three doors that used to fall through to `true` (closed 2026-08-03) ──────────────
     *
     * `default: return true` is the right posture for a portal whose every member is a coach. The
     * HELPER preset ends that assumption, and an un-gated door is precisely the "door a persona can
     * SEE but not USE" that this portal treats as a bug. Each is keyed on a grant **every existing
     * assistant already holds**, so nothing moves for anyone but a helper:
     *
     *   · Chat — a helper is deliberately not in the staff room, so the door would open on a room
     *     they are not a member of. Keyed on the same grant that decides the seat, so the door and
     *     the room can never disagree.
     *   · Settings + Tournaments — both configure or administer the team, which is a managing act.
     *     `scheduleManage` defaults true for every assistant invited before the split existed.
     *
     * Overview is deliberately NOT here: it is where a helper lands, and it renders their practice.
     */
    /**
     * ⚠ The archive's FRONT DOOR, and until 2026-08-03 the one closed-season door no grant
     * governed — it fell through to `default: return true`, so a helper kept it. Season's End
     * leads with Season Wrapped, which is the team's whole season; a parent volunteer who ran one
     * station has no claim to it (owner ruling 2026-08-03). Same key as the route behind it.
     */
    case "Season's End": return hasRecordAccess(caps);
    case 'Chat':          return caps.staffChat;
    case 'Tournaments':   return canConfigureTeam(caps);
    /**
     * ⚠ Settings used to share the Tournaments gate exactly. It cannot any more: the two dues
     * settings (automatic reminders, how credits reduce) moved onto this page, and money is a
     * SEPARATE grant from managing the schedule. A head coach who set an assistant up as the
     * team's treasurer — money write, nothing else — would otherwise watch both controls
     * disappear from the product entirely the day they moved.
     *
     * This is a door widening, so the PAGE narrows to match: each group renders only for the
     * grant that owns it, and a money-only coach finds a settings page containing Money and
     * nothing else. Every write is still refused server-side by its own route.
     */
    case 'Settings':      return canConfigureTeam(caps) || canWriteMoney(caps);
    default:              return true;
  }
}
