'use client';
import { Archive } from 'lucide-react';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';

/**
 * ⚠ **THE END OF THE ROAD FOR A HELPER** (Practice Plans Phase 4 + the season-review ruling,
 * 2026-08-03).
 *
 * A helper's whole reason to be in the portal was a practice on a live season. With the season
 * closed there is no practice, and the archive is deliberately shut to them — so say that plainly
 * rather than route them into a season review of other people's children, and offer no door,
 * because there genuinely isn't one.
 *
 * ── Why this is a shared component and not two copies ──
 * It renders in TWO places that a helper can arrive at independently: the team page (which they
 * reach by typing a URL) and **Season's End** (where the portal-root sign-in redirect and both team
 * switchers actually send them). Phase 4 shipped only the first, which is why the fix looked done
 * while the door people walk through stayed open. One component means the two can never drift into
 * saying different things about the same dead end.
 *
 * ⚠ **This is an ALTITUDE choice, not a gate.** It grants nothing and hides nothing the server
 * would otherwise serve — the Wrapped route refuses a helper on its own, and the nav hides the
 * door. This just makes the landing honest instead of blank.
 */
export default function CoachSeasonFinishedNotice() {
  return (
    <CoachEmptyState
      quiet
      icon={<Archive size={18} aria-hidden />}
      headline="This season has finished"
      description="Thanks for helping out. There are no more practices to open here — if you help again next season, your coach will invite you back."
    />
  );
}
