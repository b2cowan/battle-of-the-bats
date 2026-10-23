/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT A COACH IS TOLD WHEN THEIR CLUB'S CHOICE NEWLY LISTS THEM (mig 352; owner ruling 2026-10-23, A5).
 *
 * One in-app notice per person (event `club_coach_listed`), sent only to a coach a choice newly lists. Nothing is sent when
 * names are hidden or control is given back — nobody needs a bell to learn that less of them is public.
 *
 * ⚠ PURE (words only) so the sentences are unit-tested; `lib/coach-names-notify.ts` sends them.
 * ⚠ COPY IS /marketing's — settled 2026-10-23 in COACH_NAMES_CLUB_POLICY_COPY.md §3. It names no team: one person on two teams
 * still gets ONE notice.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
export function coachListedNotice(p: { clubName: string }): { title: string; body: string } {
  return {
    title: `${p.clubName} now lists you as a coach`,
    body: 'Your name and role show under Coaches on your team’s public page. Your club chose this for every team.',
  };
}
