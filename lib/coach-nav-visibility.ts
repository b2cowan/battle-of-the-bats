import { hasRecordAccess, canConfigureTeam, canWriteMoney, type CoachCapabilities } from './coach-capabilities';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * ⚠⚠ **THE SECOND NAV IS DELETED** (Design A, owner ruling 2026-08-16; P2 of
 * COACH_MEMBERSHIP_HISTORY_IN_PLACE_PLAN.md).
 *
 * `CLOSED_TEAM_NAV_ITEMS`, `CLOSED_SECTION_EXTRAS`, `LIVE_ONLY_ARCHIVE_SECTIONS` and
 * `archiveHasSection` all lived here, and all of them existed to describe a PLACE: a shorter,
 * differently-ordered menu that replaced the coach's own the moment a season ended, plus the two
 * correction lists needed to stop the season switcher reaching pages that menu hid. There is no
 * such place now. There is one nav, in one order, and a team between seasons is a team — every
 * door still opens, records render read-only, and the live instruments behind them say so in
 * their own words (`components/coaches/CoachNotOnTeam.tsx`).
 *
 * ⚠ The two rulings those lists encoded did NOT change, and neither did their teeth:
 *   · Playing-time analytics are live-season-only PERMANENTLY (owner, 2026-08-16) — the figures
 *     are recomputed from saved lineups, so a finished season would be shown as today's code
 *     reads it rather than as the coach read it.
 *   · The opponent scouting book is an INSTRUMENT (owner, 2026-08-04, ratified 2026-08-16) — its
 *     notes are the team's current book, not a snapshot of a year.
 * Both are enforced where enforcement belongs — `tests/unit/coach-history-endpoint-guard.test.ts`
 * fails the build if either route learns to serve a season it was not given — and the Insights hub
 * hides their tiles on a finished season rather than letting them dead-end. What died with the
 * lists is the switcher that could reach them sideways; there is no sideways any more.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** The label the landing slot carries in a live season. */
export const OVERVIEW_LABEL = 'Overview';
/** …and what replaces it once the working season has finished. */
export const SEASON_END_LABEL = "Season's End";

/**
 * Swap the landing slot for Season's End when the team's working season has finished.
 *
 * ⚠ **ONE RULE, ONE HOME** — the same reason `isCoachNavItemVisible` below lives here. The sidebar
 * and the bottom nav are required to stay in step (pinned by `tests/unit/coach-nav-groups.test.ts`),
 * and this was two hand-copied ternaries in two files with separately-named constants, which is the
 * shape those two navs have drifted apart in before.
 *
 * ⚠ Matched on the LABEL, not on object identity. The `===` comparison this replaced worked only
 * because both call sites happened to reference a module-level constant — a nav item rebuilt inline
 * (a `.map` that spreads, a memo that clones) would silently stop swapping, and the coach would
 * land on an Overview describing a season that has ended.
 */
export function withLandingSlot<T extends { label: string }>(
  items: T[],
  seasonFinished: boolean,
  seasonEndItem: T,
): T[] {
  if (!seasonFinished) return items;
  return items.map(item => (item.label === OVERVIEW_LABEL ? seasonEndItem : item));
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
     * ⚠ The post-season landing, and until 2026-08-03 the one door of its kind no grant governed
     * — it fell through to `default: return true`, so a helper kept it. Season's End leads with
     * Season Wrapped, which is the team's whole season; a parent volunteer who ran one station has
     * no claim to it (owner ruling 2026-08-03). Same key as the route behind it.
     *
     * ⚠ It is in the nav ONLY when the working season has finished (P2, 2026-08-16) — the one
     * item whose visibility depends on the season's state rather than on a grant. Mid-season there
     * is no season's end to look back on, and the look-back layer is reached from Insights.
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
