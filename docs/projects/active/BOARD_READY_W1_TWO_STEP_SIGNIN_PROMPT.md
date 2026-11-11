# Prompt — Board Ready Wave 1 · C: two-step sign-in (drawing and decisions session)

> One session, pasted into a fresh chat (`/clear` first). Written 2026-11-10. **Drawings, decisions and a build outline
> only, no code.** The build prompt is written after the owner rules. Plan of record:
> `docs/projects/active/BOARD_READY_PLAN.md` (§2 row 1, §5 Stage 0a, §7b step 3). Index: `BOARD_READY_PROMPTS_INDEX.md`.
> Run `/design` for the drawing work.

## Why this exists
A club board asked whether their data is safe with a one-person company. Today **no two-step sign-in exists**
(`docs/agents/legal/LEGAL_FACTS.md`; the draft privacy policy §10 says MFA is not claimed). A stolen treasurer password
opens the club's books, families' contact details and the payout settings.

Business Decisions 2026-11-10 put this on **every plan, never gated**. A security fix sold as an upgrade is a trust defect.

## Facts already established (2026-11-10)
- Supabase Auth on production has **TOTP (authenticator app) enrol and verify switched on**, read from the Management
  API. Nothing in the product uses it. There is no SMS service and no plan to add one.
- Sign-in is email + password. Sign-up, reset and verify emails are built by us and sent through Resend, not Supabase's
  templates.
- **The one-person reality: recovery is the hard part.** When a treasurer loses their phone, the owner is the only
  support desk. A design that makes every lost phone a support ticket fails.

## Read first
1. The sign-in and account surfaces (by helper; return paths and a one-line description each):
   - sign-in, forgot password and the account menu in all three portals (club admin, tournament admin, Coaches Portal);
   - the family app (guardian tier) and platform admin;
   - the support console (memory `project_platform_admin_support_console.md`);
   - `proxy.ts` session checks.
2. **Everything that signs in without a person** must keep working:
   - the demo sandboxes' shared demo users (memory `project_demo_sandbox_self_contained.md`: never sign out a shared demo user);
   - the Milton demo's one-click signed-in windows and scan-to-sign-in phone codes (commit `9c8baf7a1`);
   - the probe sign-in (memory `reference_probe_signin_without_browser.md`);
   - UAT fixtures and seed scripts.

   List each, and the way it stays working (exempt account, or a test factor).
3. Memory, before drawing:
   - `feedback_mockups_as_claude_artifacts.md`, `feedback_draw_controls_from_shipped_component.md`,
     `feedback_portal_is_the_formatting_benchmark.md`, `feedback_always_run_design_on_mockups.md`;
   - the UI conventions index (windows, dialogs, loading).
4. Supabase's MFA docs (authenticator levels, enrol / challenge / verify, unenrol). Read them on supabase.com and cite
   the pages.

## Decisions to recommend (each one an ask with a recommendation)
1. **Who must, and who may.** Which seats are *required*: platform admin (recommend always), owner, admin, treasurer,
   registrar, league admin? Which are *offered*: coaches, staff, officials, families? The strategy brief's suggestion
   (offered to everyone, required for admin and money seats) is a suggestion, not a ruling.
2. **Method.** An authenticator app only, or also emailed one-time codes? (Email codes are weaker, because the email
   account becomes the key, but they are easier for volunteers.)
3. **Recovery, without the owner as the bottleneck:**
   - backup codes at enrolment;
   - a club owner or admin can reset another member's two-step for their own club;
   - who resets a club **owner** (the support console, with what identity check);
   - an audit line for every reset.
4. **Remember this device** for how long (recommend 30 days), and whether money actions ask again.
5. **Turning it on for a club that already has people:** a grace period with a nudge, then required at next sign-in.
6. **What the club sees:** a two-step status column on Members and The board's seats, never anyone's codes.

## Draw (desktop and phone)
- Enrolment: the QR code, the typed code, backup codes to save, and done.
- The sign-in challenge, including "use a backup code" and "lost your phone?".
- The account menu's security section: turn on, turn off (if allowed), new backup codes, signed-in devices.
- Members: the status column, plus "Reset two-step" for an owner or admin, with its confirmation window.
- The support console's reset for a club owner.
- The "your club requires two-step sign-in" nudge and the grace-period end.

## Build outline (for the later build prompt, not built here)
- Enforce on the **server** (the session's assurance level in `proxy.ts` and in API routes for required seats), never
  just by hiding screens.
- How the exempt and test accounts from Read-first §2 stay working.
- Help articles to update (`/docs`) and the privacy policy §10 line to change once built (`/legal`).
- Whether a migration is needed (an organization's "required" setting, the reset audit).

## Before hand-off
- `/design` pass on the drawings.
- `/legal`, light: what the privacy policy and terms will then say about sign-in security, and the identity check for an
  owner reset.
- Put the Artifact URL, the decisions and the build outline into `BOARD_READY_PLAN.md` §5 Stage 0a, and update the
  index row.
- Hand the owner a product-owner summary: what a treasurer, a coach and a family each see, and the decisions.

## Standing rules
- Branch `dev`. Explicit paths only. **No commit without the owner's yes.** Shared files go through a private index.
- No code, no migrations, and **no change to production Auth settings** in this session.
