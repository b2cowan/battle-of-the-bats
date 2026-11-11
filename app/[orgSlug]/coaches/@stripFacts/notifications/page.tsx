/**
 * The `@stripFacts` slot on the notifications page (navigation Phase 4): nothing, and a REAL page rather than the slot default on purpose.
 * Next keeps a slot's last active state across a soft navigation that lands on its default, so leaving a team for
 * this page and coming back would reuse the team's old facts node and never read them again (a stale record, "Next" line
 * or Game day chip on the strip). A page that matches here replaces the slot's state, so re-entering a team builds it fresh.
 */
export default function StripFactsNone() {
  return null;
}
