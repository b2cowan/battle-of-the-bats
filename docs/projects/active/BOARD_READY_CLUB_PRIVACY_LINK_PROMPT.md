# Prompt — Board Ready · Stage 4.P: a club sets its own privacy link

> One session, pasted into a fresh chat on `dev` (`/clear` first) as *"Read and follow
> docs/projects/active/BOARD_READY_CLUB_PRIVACY_LINK_PROMPT.md"*. Written 2026-11-21 from the plan's §5 Stage 4, item 4.P
> (owner ask 2026-11-21). A small build session: one setting, one route, one audit line, two help lines, then a short
> browser walk for the owner. Independent of the other Board Ready work; touches no migration (the column exists).

## Why this session exists
The published Terms §4 tell clubs "you can link your own privacy policy on your forms" and that "your own privacy notice is
the place to tell [families]" their data is stored in the United States. Today **only our staff can set the link** (the column
has no screen and no route), so that promise holds only when we set it by hand. On 2026-11-21 the owner had the fixed notice
above the club's questions removed (`docs/agents/legal/CLUB_FORM_NOTICE_REMOVAL.md`), so the club's own link is now the
**only** way a club tells families about cross-border storage at the point of sign-up, and at the first Québec club it is how
the club gives its Law 25 s. 8 notice. This session gives the club the setting.

## What the club does after this (the UX summary to present first — plain language, before any code)
- In the club's settings, an owner or admin sees one field, **"Your privacy policy"**, with a short helper line. They paste
  the web address of the club's own policy, and can change or clear it. A bad address (not http/https, not a web address) is
  refused with one plain sentence at the field.
- Every family-facing door that already reads the link then shows **"{club}'s privacy policy"**: the house-league sign-up
  form (under Sign up), the tryout sign-up's consent line, and the guardian accept page. Cleared = the link disappears
  everywhere; nothing else changes.
- Seats: only the seats that may edit the club's profile see the field. Everyone else does not see it, and the route refuses
  them. Coaches' own team portals are not touched (a team-level link is not in scope; if the build finds a coaches-only door,
  stop and ask).
- The change is written to the club's audit log (who, when, "set / changed / cleared", never the full text if the log
  convention elsewhere keeps values out).

## Read first (re-read the lines you build on; do not trust this summary)
- **The seam:** `lib/privacy-policy.ts` — `getOrgPrivacyPolicyHref` is the single place the http/https check lives. The new
  route and the new field must use it (or the same function split into a validator), never a second regex. The file's header
  comment still says "operator-only; a future admin UI will let tenants set it" — update it when the UI lands.
- **The column:** `organizations.privacy_policy_url` (mig 164, text, nullable); read in `lib/db.ts` ~L1787 into
  `Organization.privacyPolicyUrl`. Dictionary entry `dict:col:organizations.privacy_policy_url` says "no UI" — the dictionary
  line changes in the same unit of work (`npm run check:dictionary`).
- **The three readers (do not change their behaviour):** `app/[orgSlug]/league/[seasonSlug]/register/page.tsx` (~L124),
  both tryout `register/page.tsx` files (~L41/L43), and `lib/family-invitation.ts` (~L495, reads the column directly — check it
  goes through the seam and not around it).
- **Where the field lives:** find the club's settings screen (look under `app/[orgSlug]/admin/org` and the existing org
  routes `app/api/admin/org/*`, e.g. `coach-settings`, `pdf-settings`, for the nearest pattern: its permission check, how it
  writes `organizations`, how it audits). Reuse that pattern; do not invent a new one. Confirm which permission "may edit the
  club's profile" maps to, and that a treasurer / registrar / coach-seat is refused server-side, not just hidden.
- **The ruling and its law:** plan `BOARD_READY_PLAN.md` §5 Stage 4, item 4.P; `docs/agents/legal/CLUB_FORM_NOTICE_REMOVAL.md`;
  Terms §4 as published (`docs/agents/legal/PUBLISHED_TERMS_AND_PRIVACY_NOTES.md`).
- **A tenant-controlled link is shown to families as an `<a href>`.** Keep the scheme check, open it in a new tab with
  `rel="noopener noreferrer"` where the readers already do, and never render the stored text any other way. State this in the
  review request so `/review` aims at it.

## Build
1. **Present the UX summary** above (blocking step) and confirm the field's exact label, helper line and error sentence
   before building. Draft the words; `/legal` reads them at the end.
2. One field in the club's settings, one route that validates (http/https, trimmed, a sensible length cap, empty = clear),
   saves, and writes the audit line. Server-side permission check. No new table, no migration — if one seems needed, stop and say
   why.
3. The field shows the same value the readers use (via the seam), so a stored `javascript:` value left over from the old
   operator path displays as empty, never as a link.
4. Help: one line in the club settings article and one in the sign-up form article (`lib/help-content/*.tsx`, indexed by the hub
   arrays; include the new words in `keywords` / `searchText`). Offer `/docs` per the repo rule.
5. Dictionary: replace "no UI" on the column's entry; refresh snapshots only if `check:dictionary` asks (no schema change is
   expected).
6. Tests: the route refuses a non-owner/admin seat; accepts https, accepts http, refuses `javascript:` / `data:` / a bare word;
   clearing stores null; the audit line is written; the seam still returns null for a bad stored value. A guard test that the
   three readers still go through the seam.

## Not in this session
- No in-platform privacy page for the club (the seam's header describes that future fallback; leave it).
- No per-team or per-season link. No change to the published Terms, Privacy Policy or Data Terms.
- No notice text above the club's questions (removed 2026-11-21 on purpose).

## Done means
- `npm run verify:changed`; `npm run typecheck` if a shared module changed; focused tests green; the spelling check passes.
- **Reviews before hand-off:** `/legal` (the field's helper text and error sentence), then `/review`. Offer `/docs` and, if the
  diff shows a new abstraction, `/simplify` first.
- A short owner browser walk as a checkable Artifact (20–50 boxes is too many — this is ~12): club owner sets and clears the link
  and sees the three doors change; a bad address is refused; a registrar/treasurer cannot see or save the field; phone width on the
  field. Name the exact logins per role (see the §553 walk for the dev club's seats).
- Branch `dev`, explicit paths only, **no commit without the owner's yes**. Record the hash in the plan's 4.P line (drop "not
  built"), this index's row, the Board Ready board line (same commit), and the ledger row for the walk.
- The `remains` line on the board that says "A club sets its own privacy link… not built" is updated when it ships.
