# The public face, warm: signed out = warm (build prompt)

> **Written 2026-10-23** at the close of the walk session. **Paste this into a new chat on `dev`.** It is a small **build**:
> one behaviour, shipped **on its own, ahead of S1** (owner, 2026-10-23: "agreed"). The plan is `PUBLIC_FACE_WARM_PLAN.md`
> ("Round 1 rulings", the follow-up row to Ask 5); the walk page is https://claude.ai/artifact/M1ehQVxvLzMiTZfJDMtcft.
> **Model:** Sonnet can build this. Run `/review` before committing.

## The ruling (owner, 2026-10-23, recorded as ruled; build exactly this)

**Every signed-out page is warm. Signing out resets that browser to warm. Someone who chose Dark gets it back when they sign
in**, because the choice is saved to their account. The owner's words: *"people who like dark themes don't need it every second
of every day and surely understand signed out means they don't get to view their theme choices."*

**Why:**
- A signed-out visitor has no Warm / Dark control. The only controls are the account page's Appearance card and the
  signed-in account menu.
- The Dark choice lives in the browser (`fl_user_theme` in localStorage, `lib/user-theme.ts`). Nothing clears it at sign-out.
- So on a shared family computer, the next person's first impression of sign-in, sign-up, Home, Scores and the system
  screens is the previous person's Dark.

**Not affected:** the public tournament pages. Their light or dark is the organizer's per-tournament choice
(`app/[orgSlug]/[tournamentSlug]/layout.tsx` `effectiveColorMode`), not the visitor's. Do not touch it.

**It narrows the 2026-07-23 design-log ruling** ("Auth screens FOLLOW the user theme") to people who are signed in. The
2026-10-23 entry in `memory/design_decisions.md` records that.

## What "done" means (the walk will test each)

1. A signed-in Dark user who signs out lands on a **warm** page with **no dark flash**, by **every** sign-out door. There are
   about eleven callers today. Grep `signOut()` and confirm each goes through the one place you change (`lib/auth.ts`
   `signOut` is the central one). Include the coaches portal, the admin account menu, the volunteer shells, the paused
   screen, the platform-admin nav and the join and invite screens.
2. **A session that ends without the button** (it expires, or the person signs out in another tab) also leaves the browser
   warm. Several modules already react to the auth state change (`lib/follow.ts` handles "SIGNED_OUT, or a signed-out
   INITIAL_SESSION on load"; `lib/push-client.ts`), so follow that pattern.
3. **A browser that already holds Dark from before this ships**, visited signed out, shows warm.
4. **Signing back in** restores Dark from the account on **every** sign-in path, with no flash of warm after the first paint
   that follows sign-in, if you can avoid one. Today the consumer shell's `ConsumerThemeManager` adopts the account theme.
   **Verify** the coaches portal, the admin and the volunteer shells do the same. If one doesn't, that is a finding to
   report: do not invent a new sync.
5. The static offline page (`public/offline.html`, which reads `fl_user_theme` inline) follows the same rule. Signed out,
   its stored value is gone, so it shows warm.
6. Nothing else changes: the Warm / Dark controls, the account's saved choice, and the tournament pages' organizer setting.

## Constraints

- **No flash.** The root no-flash script (`lib/no-flash-script.ts`) paints before hydration and is stringified, so it must
  stay self-contained. Read its header before touching it. If you decide the first paint must know "signed out", argue it
  from the code. Clearing the stored value at every sign-out and session end may make that unnecessary. Prefer the smallest
  mechanism that meets 1–5.
- **Do not make static pages dynamic** by reading the session in the root layout.
- Shared modules are touched (the theme module and maybe the auth module), so run `npm run typecheck`, and restart the dev
  server before the owner tests (AGENTS.md restart rule).
- Concurrent sessions share this working tree. Stage explicit paths only, check the branch is `dev`, and ask before
  committing.

## Before code (AGENCY_RULES)

Give the owner the plain-language UX summary first (what a person sees differently, and who), then build.

## After the build

- `/review`, then commit after the owner says yes.
- Offer `/docs`: any help article that says Dark "stays" on the device needs the signed-out sentence.
- **A checkable QA walk Artifact** (the house walk format: one purpose, checkboxes, paste-back) covering:
  - signing out as Dark from the consumer app, the coaches portal and the admin;
  - a shared-browser case (sign out, then open sign-up as a newcomer);
  - an expired or other-tab sign-out;
  - signing back in on each portal;
  - the offline page;
  - one tournament page set to dark by its organizer (it must stay dark).
- Records: the plan's rulings row ("built, commit `<hash>` <date>"), TODO's public-face line (only if TODO.md has no other
  session's uncommitted edits; otherwise say so), and the auto-memory `project_public_face_warm`.
