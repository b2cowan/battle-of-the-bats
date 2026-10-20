# Coach Sponsor Invoice — Plan

**PM brief:** [COACH_SPONSOR_INVOICE_PM_BRIEF.md](COACH_SPONSOR_INVOICE_PM_BRIEF.md) ·
**State:** committed `7a50b369` 2026-10-20 (after /review: 4 lenses, 14 fixes; help article updated). Migrations 339 + 340 applied to dev 2026-10-20; prod at the next promote. Owner browser check owed.

**Drawings (ruled):** https://claude.ai/artifact/5XGAZvyBChL2fZxdzqi6Sc (source
[COACH_SPONSOR_INVOICE_MOCKUP.html](COACH_SPONSOR_INVOICE_MOCKUP.html))

A Premium coaches-portal team can hand a sponsor's accounting department a professional, numbered
invoice on the team's own paper (crest, colour band, house footer), straight from the sponsor record.

## 1. Rulings (owner, 2026-10-20)

| # | Ruling |
|---|---|
| R1 | From the coaches portal the invoice is **always from the team** (never the club). |
| R2 | **No tax** of any kind — no field, no line, no wording (no GST/HST). |
| R3 | Titled **"Invoice"**; never a donation/tax receipt. |
| A1 | Once money arrives the same button prints the invoice **paid in full** (received) or with the **balance due** (part received). Same number. |
| A2 | Numbers count **per season year**: `2026-001`, `2026-002` … never reused for the team. |
| A3 | How sponsors pay the team is set **in the invoice window only**, kept for the team, folded to one line once saved. |
| A4 | If the amount changes after issue: **same number**, reprint shows the new amount and "Revised <date>" in the subtitle. |
| A5 | **Anyone who can record the team's money** can make one. |
| A6 | **Download only**; the coach attaches it to their own email. |
| A7 | The `/design` review's 8 drawing changes accepted (plain required stars; 640 window; sentence-case section titles; sponsor name as the eyebrow over "Invoice"; team details fold; plain Amount hint; close ask + refusal; no PAID stamp, no repeated details block, figures = invoiced · paid · balance due; From line respects the team's own line-2 setting). |
| A8 | A deleted sponsorship's invoice **keeps only its number** — the contact details are cleared (owner, 2026-10-20: "it can keep the number"; mig 341). |
| A9 | Staff with read-only money access may see a sponsor's billing contact — **fine as is** (owner, 2026-10-20). |

## 2. What is built

### Data (migration 339)
- `rep_teams.sponsor_payment_details jsonb NOT NULL DEFAULT '{}'` — `{ chequeAddress?, etransferEmail?, questionsTo? }`. Lives on the team (outlasts a season, like `pdf_settings`).
- `rep_sponsor_invoices` — one row per sponsor (`fundraiser_id` UNIQUE, **ON DELETE SET NULL** so a deleted sponsorship never frees its number), `team_id`, `org_id`, `program_year_id`, `season_year`, `seq` (UNIQUE per `team_id, season_year`), bill-to (`bill_to_name` NOT NULL, `bill_to_attention`, `bill_to_email`, `bill_to_address`), `description`, `amount`, `issued_on`, `due_on`, `revised_on`, `created_by`, timestamps. RLS on, service-role only (every read/write goes through the coach API).

### API — `fundraisers/[fundraiserId]/invoice`
- **GET** (`resolveCoachTeamRead`, view-money): the sponsor's invoice (or null), the team's payment details, the next number preview, the season name/year.
- **POST** (`resolveLiveCoachTeamContext`, `canWriteMoney`, plan feature `pdf_exports`): saves bill-to + team payment details, assigns the number on first issue (max+1, retry on the unique index), re-stamps `amount` + `revised_on` when the sponsor's amount moved. Amount is never sent by the client: pledged amount, else what has arrived.
- The fundraisers list GET carries `invoice: { number, issuedOn } | null` per sponsor, for the room's facts line.

### UI
- Sponsor room action row: white secondary **Invoice** between Edit sponsorship and Record — writers only, plans with `pdf_exports`, absent otherwise.
- Facts line: "**Invoice 2026-003** issued Oct 20" after Raising for.
- `SponsorInvoiceWindow` (QuestionShell `wide`, eyebrow = sponsor name, title "Invoice", `dirty` close ask, `QuestionReason` refusals). Sections: Bill to · This invoice · How sponsors pay the team (folded to a line + Change once saved). Foot sentence: "Downloading keeps these details and gives the invoice its number."
- `QuestionShell` gains an `eyebrow` pass-through to KitDialog.

### PDF — `buildSponsorInvoiceDoc` / `downloadSponsorInvoice` (lib/export/pdf.ts)
House recipe (dues statement): accent band, identity band (line 2 = team's own setting, else the cheque address), title "Invoice", subtitle (number · issued · due | paid in full · revised), three figures invoiced · paid · balance due, Bill to, Description/Amount table (no totals row), How to pay (omitted when paid in full), Payments received — thank you (when any), italic closing note, house footer. Registered in `scripts/pdf-documents.mjs` (unpaid + part + paid edge cases) and in `COACH_DOCUMENTS`.

### Shared logic — `lib/coach-sponsor-invoice.ts`
Number format, standing (unpaid / part / paid, paid-on date), default description, team-payment normalizer; unit-tested.

### Migration 340 — the team move carries the invoices
`rep_sponsor_invoices` carries `org_id`, so `move_team_into_club` must say what happens to it
(`tests/unit/team-move-coverage.test.ts`). It is the team's record → added to `c_moves`. 340 re-creates the function
exactly as 313 wrote it plus that one line (diff-verified), and repeats 313's two idempotent statements so the newest
definition stands alone.

### Build notes (2026-10-20)
- **Window section titles use the portal's own `.formSectionTitle` (uppercase display face), not sentence case.** The
  design review's "sentence-case section titles" cited A3 of the 2026-10-19 *admin* lettering ruling; the coaches portal
  is the formatting benchmark and its windows (Payment schedule, Which of our items?) use the uppercase title. Flagged
  to the owner at hand-off — a one-class change if he wants sentence case anyway.
- The description defaults to "Team sponsorship — <season>" and never includes the sponsor's private notes (they are
  the team's remarks, and the invoice goes to the sponsor). The drawing's small note line under the description is
  therefore not printed.
- The Invoice button waits for the room's read (like Edit sponsorship): the paid copy lists the arrivals that read brings.

## 3. Out of scope
Tax; club-issued invoices; invoices for anything but a sponsor; emailing from the product (A6); a closed season (live-season tool — the team gate already routes a closed season to its one page).

## 4. Follow-through
- `DATA_DICTIONARY.md` + `refresh:snapshots` in the same unit of work.
- `/docs`: the "Fundraisers and sponsors" help article gets an Invoice section.
- Prod: migration 339 rides the next promote (additive only).
