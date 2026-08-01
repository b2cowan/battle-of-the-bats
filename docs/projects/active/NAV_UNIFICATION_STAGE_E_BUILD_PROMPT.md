# Stage E Build Prompt — the org's public page becomes a framed place

> Run this in a FRESH chat. It builds Stage E of `docs/projects/active/NAV_UNIFICATION_PLAN.md`
> (the binding plan — read its Stage E section, §5 "The public line", §6 "Evidence gates", and §7
> D1 before writing code). Project memory: `project_navigation_model.md` (auto-memory). Stages
> A+B+D (`453c3df0`) and C+H.1 (`ae73ae24`) are committed on dev; nothing is on prod.

## What you are building (owner-approved scope — no re-litigating)

On the org's public pages (org home + league + teams + archives — they share ONE navbar component,
so most changes land once and reach all four):

1. **One plain-text "Discover" link** at Pricing's visual weight, grouped with the utility links —
   the fan's door into the app. This is the ONE deliberate anonymous-facing addition in the whole
   navigation program: a static anchor, nothing fetched. Instrument a **fire-and-forget click
   beacon** on it (anonymous-safe: the anchor renders identically for every visitor; the beacon
   fires on click only — §6's CTR gate reads it).
2. **Return ⇄ FlipPill** for signed-in operators **of that org** — closes the one-way org-level
   flip (admin screens already flip TO the org page; nothing flips back). Client-side,
   post-hydration, per the SW-cache invariant; reuse the shared FlipPill; fans and anonymous
   visitors must never see it.
3. **Breadcrumb at depth** — `Org › Season`, `Org › Team`, `Org › Archives` in the identity row;
   the org name self-links to the org root. At the root, today's plain identity, unchanged.
4. **Sitemap entries for org pages** — gated by `isOrgHomeRealDestination` (lib/module-entitlements
   — the ONE statement of the rule; do not restate it) so a redirecting/placeholder page is never
   emitted.
5. **"Built on FieldLogicHQ" credit rollout** to league/team/archive pages — same ratified-subtle
   gate and component the org home + tournament pages already render (BuiltOnCredit); three more
   call sites, no new decision, no wording changes.

## Hard constraints (each has bitten someone already)

- **Anonymous byte-parity is the acceptance bar** (plan §5): anonymous network/DOM/bundle diffs on
  marketing, consumer app, org home, and a tournament page must come back identical except the one
  new Discover anchor on qualifying org pages. The six testable assertions in the superseded
  `NAVIGATION_MODEL_PLAN.md` §Q5 apply verbatim — run the Playwright checks.
- **D1 is OPEN: connectivity, not parity.** No app bar, no bottom bar, no tab row on org pages.
  The section strip is Stage F (/design-gated) — NOT this build.
- **Vocabulary (binding):** "Club" is a tier name only. Generic copy/comments say "org" /
  "organization".
- **Org pages are permanently dark by design today** — don't fight it, don't fix it here (the
  light/dark gap is routed to /design via Stage G's scope note).
- **OrgNavSync restore mechanism exists** (nested-sync unmount restores the ancestor's identity —
  /review find from Stage B). If you touch org-nav context plumbing, keep it working: the
  tournament→org-home SPA trip must keep the org's name and logo.
- **The Footer stays off org/tournament pages** (ratified — the slim credit is the paid-tier
  presence). Do not mount the column footer.
- **The search dead-end** (a searchable org with 0 active events landing on the placeholder) is
  NOT this build — its empty-state copy belongs to /marketing (routed in D3's notes).

## Workflow (house rules)

- PM-brief-style summary in chat BEFORE code (plan + PM brief exist — keep it short and concrete).
- Owner does browser QA; batch the dev-server restart to handoff (new files ⇒ restart required;
  verify the platform-admin login URL returns 200, no Supabase EACCES).
- After the build: offer `/simplify` then `/review` (funnel), then commit only on explicit owner OK.
- **Commit discipline on this shared working copy:** dev branch (re-check HEAD), explicit
  pathspecs only (`:(literal)` for bracketed route dirs), hunk-split any file a concurrent session
  holds, and **stage + commit in ONE atomic shell invocation** — a concurrent session has reset the
  shared index mid-commit once already (2026-07-31). TODO.md + memory/design_decisions.md carry
  multiple chats' entries — leave them for the docs sweep unless told otherwise.
- Check `git status` before starting; concurrent sessions are active in coach-portal files.

## Definition of done

All five items built; anonymous-parity checks green; typecheck + verify:changed green; owner QA
passed; funnel run; committed on dev with the plan's Build-status block updated and the project
memory (`project_navigation_model.md`) appended.
