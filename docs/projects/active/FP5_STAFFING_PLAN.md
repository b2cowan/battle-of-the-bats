# FP-5 Cluster 5 — Staffing sub-cluster (Implementation Plan)

**Branch:** `dev`. **Findings:** J1-077 (invite routing), J1-080 (day-of staff kit), J1-078 (seat policy — deferred). **Source:** `JOURNEY_J1_TOURNAMENT_ORGANIZER.md:157-160`.

## Re-verification (2026-06-16, current code)
- **J1-077 PRESENT** — `members/invite/route.ts:80-84` hard-routes `role==='official' → /scorekeeper`; no gate path, no purpose picker. Invite UI (`org/members/page.tsx:189`) offers role `admin|staff|official` only. **Permissions already cover both surfaces** — `ROLE_MATRIX` (members page:32-33): official has BOTH "Submit scores" AND "Check teams in at the gate". So this is routing/discovery, NOT a permissions change.
- **J1-080 PRESENT (missing)** — both shells exist (`scorekeeper/layout.tsx`, `check-in/layout.tsx`) with direct links + PWA prompts; nothing aggregates them into a hand-out screen. No QR lib in the repo.
- **J1-078** — pricing decision; **document & defer to /billing** (owner decision 2026-06-16). Not built here.

## Owner decisions (2026-06-16)
- Build **J1-077 + J1-080** together. J1-078 → documented & deferred.
- J1-077 purpose picker: **Scorekeeping / Gate / Both**.

## Design principle (no new DB role)
`official` already permits scores + gate. Do NOT add a role or migration. The invite "purpose" is a **landing hint** that only affects (a) which screen the invite email/CTA points at and (b) the invite copy. The member can always reach the other screen via the new cross-link, so purpose need not persist on the member row.

## J1-077 — invite purpose-picker + cross-link
1. **Invite UI** (`org/members/page.tsx`): when role = "official", show a purpose segmented control — **Scorekeeping / Gate / Both** (default Both). Post `{ email, role:'official', purpose }`. Update the official invite description to mention both surfaces.
2. **Invite route** (`members/invite/route.ts`): accept `purpose ∈ {scorekeeping,gate,both}` (validate; default `both`). Drive `signInPath`/CTA:
   - `gate` → `/{org}/check-in`, CTA "Open Check-In"
   - `scorekeeping` → `/{org}/scorekeeper`, CTA "Open Scorekeeper"
   - `both` → land on scorekeeper (has the cross-link to gate), CTA "Open Volunteer View"
   Pass through to `orgInviteHtml`/`orgMemberAddedHtml` (extend their CTA-label/next params; the `scorekeeperNote` becomes a generic volunteer note).
3. **Cross-link between shells** (`scorekeeper/layout.tsx` + `check-in/layout.tsx` headers): a small link to the *other* surface, shown only when the user has the other capability (`hasCapability(... 'submit_scores' / gate cap)`). One-tap hop, no texted URL.

## J1-080 — day-of Staff Kit (admin screen)
New admin surface that hands out the two volunteer links as **QR + copy-link**, with a printable one-pager. Lives under the tournament admin (e.g. `tournaments/staff-kit` or a panel on the dashboard / check-in admin).
- Two cards: **Scorekeeper** (`/{org}/scorekeeper`) and **Gate / Check-in** (`/{org}/check-in`), each with a QR code, the URL, and a copy button.
- Printable layout (print stylesheet) for a one-pager taped at the volunteer table.
- **QR generation decision (surface to owner):** add the tiny `qrcode` dependency (well-maintained, ~zero transitive deps) vs. an external QR image service (privacy: leaks the URL to a third party — rejected) vs. hand-rolled SVG (excessive). **Recommend the `qrcode` package**, rendered client-side to a data-URL/SVG.
- Gate access by capability (`manage`/admin) — it only exposes links that already exist; the volunteer still authenticates on landing.

## Verify
- `npm run typecheck` (touches the invite API contract + roles helpers); `npm run lint:focused -- <files>`.
- New file(s) + invite-route change → **restart dev server** before handoff.
- Browser (owner): invite an official as Gate → email/landing points at check-in; as Scorekeeping → scorekeeper; Both → scorekeeper with a visible "Go to Check-In" link. Staff Kit screen renders both QR codes; scanning each lands on the right shell; print layout is clean. Fixture `seed-fp5-cluster5.mjs` already provisions an invited official.

## Guards
- No new permission, no DB role, no migration (J1-077). If a `qrcode` dep is approved for J1-080, it's a client-only addition (note in commit; watch Amplify pnpm build — see `reference_amplify_pnpm_build`).
- Coaches/fans unaffected. `official` seat/billing semantics unchanged (J1-078 deferred).
