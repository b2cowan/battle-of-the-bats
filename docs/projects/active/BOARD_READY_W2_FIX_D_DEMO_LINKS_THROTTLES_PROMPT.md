# Prompt — Board Ready · fix D: demo billing, team pay links, throttles (sweep 3 smalls) · **Sonnet**

> One session, pasted into a fresh chat (`/clear` first). Written 2026-11-10. Report:
> `docs/projects/active/BOARD_READY_ACCESS_SWEEP_3.md` § Small. Index: `BOARD_READY_PROMPTS_INDEX.md`. The owner asked for these
> fix sessions on 2026-11-10.

## The items (re-read each before changing it)
1. **Demo sandbox billing.** The demo write block (`proxy.ts` ~L70, `lib/demo-guard.ts`) matches the demo club in the URL,
   and the billing POSTs (`app/api/billing/{portal,create-checkout,setup-payment-method,choose-next-season,move,cancel/*,
   downgrade/*}`) name it in the body. Only `billing/location` refuses the demo organizer (`isDemoOrganizerEmail`). The fix:
   one shared refusal that every billing route calls. Then extend `tests/unit/demo-sandbox-write-guard.test.ts` so a new
   billing POST fails the build until it refuses. Prove with a "See it live" session on dev. **This touches what the
   product charges, so run `/accounting` before hand-off** (CLAUDE.md), even though the change is a refusal.
2. **Team pay links can't be revoked** (`lib/team-pay-link.ts`; the league link has `link_version`). Give the team link a
   version the same way. **Every link already emailed must keep working:** a token without a version reads as version 0,
   and a new "Send a new link" bumps it. This needs a migration (check the latest number at commit time), a dictionary
   entry, snapshots and a `MANUAL_PROD_STEPS.json` line. If adding a team-side "Send a new link" button needs a drawing,
   **stop and say so**: build only the version and the server side, and leave the button to a `/design` session.
3. **The anonymous feedback form** (`app/api/feedback/route.ts`): the per-source limit keys on a header the caller sets.
   Key it on the trusted proxy hop. Find how other routes resolve the client IP, if one exists. Add a database-backed
   daily cap, so the admin inbox can't be flooded across server instances.
4. **The dev seed guard** (`lib/platform-auth.ts` `requireDevToolPlatformAdmin`, ~L164-195): add the same
   `NODE_ENV === 'production'` refusal that its sibling `requireDevToolUserAuth` has.
5. **Defence in depth, small:** family claim acceptance also checks `email_confirmed_at` (`lib/family-invitation.ts`
   `acceptInvitation`). `payouts/return` builds its redirects with `resolveTrustedAppOrigin`. `expireCheckoutSession`
   (`lib/online-payment-landing.ts` ~L1182) binds the event's account like its siblings. `request-deletion` escapes the
   reason in the operator email (`lib/email.ts` ~L1951).

⚠ Item 1 and item 4 sit near shared automation and dev tools. Change **only** these app guards. Hooks, settings, database
checks and anything that runs by itself are not yours (AGENCY_RULES 2026-09-26).

Before code: present the plain-language **UX summary** (AGENCY_RULES, blocking). The only visible change is the demo
visitor being refused billing actions (say what they see) and, if built, a new pay link.

## Prove, guard, hand off
- A dev probe for items 1 and 2. For item 2, an old token still opens and a bumped one is refused.
- `npm run verify:changed`; `npm run typecheck` if `proxy.ts` or a shared module changes. Restart the dev server before
  hand-off if so.
- `/review`, then `/accounting` for item 1; apply both. `/legal` only if the pay-link email wording changes.
- Record `→ Fixed <hash>` against each item in the report and the 🧹 third-sweep TODO line after the owner's yes.
- **No commit without the owner's yes.** Branch `dev`, explicit paths, TODO.md through a private index. One commit per
  item that has a migration; the rest may share one.
- A product-owner summary.
