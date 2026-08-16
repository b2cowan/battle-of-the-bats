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
  /**
   * ⚠ THE ONE DOOR THAT IS ARCHIVE-ONLY (2026-08-15, plan Phase 3). Attendance left both LIVE
   * navs — it is a report, and its parent is the Insights hub. It stays here because the archive
   * points "Insights" at `/history/results`, not at that hub: the hub is live-season-only, and
   * the results archive carries no attendance door. Deleting this line would make a past season's
   * attendance report unreachable — an approved archive door (D-F1) removed by accident while
   * tidying the live nav.
   */
  { label: 'Attendance',   href: '/attendance' },
  { label: 'Lineups',      href: '/lineups' },
  { label: 'Money',        href: '/accounting' },
  { label: 'Documents',    href: '/documents' },
  { label: 'Development',  href: '/development' },
  { label: 'Tryouts',      href: '/tryouts/history' },
  { label: 'Insights',     href: '/history/results' },
  { label: 'Staff',        href: '/staff' },
];

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
     * ⚠ NOT A LIVE NAV ITEM ANY MORE (2026-08-15, plan Phase 3), and this case stays anyway. It is
     * now the shared answer to "may this coach open the attendance report", asked by three callers
     * that are not the sidebar: the ARCHIVE nav (which still lists it, see above), the Insights
     * hub's "Who's showing up?" door, and the Overview's coaching-pair tile
     * (`resolveCoachingPair`). Deleting it would fall through to `default: return true` and hand
     * the report to a helper.
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
