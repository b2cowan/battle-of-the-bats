# Build Prompt — Free Coach Portal Phase A3: Tournament-Record Four-Zone Regroup

Paste everything below this line into a fresh chat.

---

Start Phase A3 (tournament-record page regroup) of the Free Coach Portal Experience
project.

Context to load first, in this order:
- docs/projects/active/FREE_COACH_PORTAL_EXPERIENCE_PLAN.md — the **A3 section** is the
  spec (verified 13-block inventory, the four-zone target, A3.2, A3.3); the **PROCESS
  GATE in the header is binding** (mockups approved before any build code); the **A2
  BUILD RECORD** in the same file describes the chrome this page now lives inside —
  read it before mocking anything.
- docs/projects/active/FREE_COACH_PORTAL_EXPERIENCE_PM_BRIEF.md — product framing.
- memory/design_decisions.md — the 2026-07-25 entries (two-family chrome ruling; Flip
  stays shell-header top-right) are binding.
- Auto-memory: project_free_coach_portal_experience (current state; A1 = 23492301,
  A2 = 6e76c6a5 + 48b79f4e/c4977c02 on dev, NOT on prod).

The task: regroup the coach tournament-record page from ~13 stacked, repeating blocks
into FOUR labeled zones — **Status & Payment** (one authoritative block: status, fee,
due date, how-to-pay, ONE contact line), **Schedule** (one block handling live/empty/
published states — merge today's two Schedule variants), **Your Team** (roster submit +
head-coach editor; merge "Your entry" + "Registration Details"), **From the Organizer**
(announcements + welcome-resource links). Kill the triplication (fee ×3, contact ×3,
schedule ×3); the hero keeps status + countdown only; keep phase-adaptivity (pending /
accepted / game-day / result) WITHIN zones rather than adding/removing whole sections;
one consistent title register. Use the public site's within-page section-header grammar —
explicitly NOT multi-page tabs (decided in the plan). A3.2: give every Team-Overview
block the same header treatment. A3.3 (optional, judgment call at build): consolidate
the three different registration-card styles across the three list routes — this is
also where the record page's back-link target gets rationalized (parked A2 follow-up).

MOCKUPS FIRST — hard gate, no build code before my approval:
- Mobile-first record page in the A2 chrome (sticky team/event header + section tab
  row + global bottom bar) across the key phases: pending, accepted with fee owed,
  game day, and completed/afterglow. Plus the desktop variant.
- Show the mobile quick-jump anchor pills and specifically HOW they sit one level
  below A2's section tab row without competing with it (the plan flags this exact
  question for design time — keep them subtle or fold into a compact sticky sub-nav).
- Label every element NEW vs RESTYLED vs UNCHANGED; warm theme (default) + dark.
- Iterate with me until I approve; approved mockups ARE the visual spec.

Critical constraint — SHARED SURFACE: the record component is shared between the free
and Premium portals (standing rule: tiers differ in season tools, never in tournament
experience). The regroup lands on BOTH tiers automatically. The free portal hides the
in-page title block (the A2 shell header carries identity + Flip there); Premium keeps
its own in-page header above the same content. Mock (or at minimum verify) both shells,
and do not regress Premium's header/Flip.

Test fixtures: flhq.qa.coach@outlook.com / CoachQA-2026! (Halton Hawks U11 Jr, completed
"Live Demo — Game Day", Dev Test Org — the afterglow/result phase). My personal account
has the same team with an upcoming "Purple Classic" (accepted/pre-event phase). For the
pending and game-day phases, use a fresh registration on dev or the seed scripts —
don't skip mocking those phases just because a fixture is missing.

Rules:
- dev branch only; this working copy is SHARED with concurrent agent sessions — re-check
  the branch before committing, stage explicit pathspecs only (use :(literal) for
  [bracketed] route dirs; PowerShell Remove-Item/Test-Path also glob brackets — use
  -LiteralPath), and verify with `git show --stat HEAD` after every commit that ONLY
  your files landed (an index race here has already swept 49 foreign files into a
  commit once — it was caught by exactly this check).
- Never commit without my explicit per-action OK.
- The record component is shared → run `npm run typecheck`, not just verify:changed.
- Full dev-server restart before handing off for browser testing.
- Run /review before calling the build done (adversarial funnel; A2's ran 4 lenses).
- After build: offer /docs — the coaches guide names the current section labels
  ("Payment", "What's next", "How to pay"), so a regroup almost certainly moves help
  copy; and the A2-era guide text describing the record page should be re-checked.
