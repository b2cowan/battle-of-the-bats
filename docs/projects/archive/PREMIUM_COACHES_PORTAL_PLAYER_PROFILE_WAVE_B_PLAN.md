# Player Profile — Wave B (new fields + attendance/dues)

**Status:** BUILT on dev 2026-06-28 (⚠ mig 157 PROD-PENDING; browser-verify pending). Decisions locked 2026-06-27.

**Build notes:** mig 157 applied to dev (snapshots refreshed #157, dictionary updated). New fields
on `rep_roster_players`: medical_notes, emergency_contact_name/phone, bats, throws, jersey_size
(app-validated via `lib/rep-roster-options.ts`, no DB CHECK). Profile gained a Safety section,
handedness/jersey selects, a "Medical info" flag, a read-only Attendance snapshot (season counts +
last 10) and a real Dues summary (assessed/paid/credits/balance/overdue/next-due) via two new db
helpers (`getRepPlayerAttendanceSummary`, `getRepPlayerDuesSummary`) returned from the player GET.
**Season rollover carry:** DONE 2026-06-28 — the new player-intrinsic fields (medical, emergency
contact, bats/throws, jersey size) now persist when a coach starts a new season. (Free→Premium
upgrade has no source data for these, so nothing to carry there.)
**Parent:** `PREMIUM_COACHES_PORTAL_WALKTHROUGH_PLAN.md` (finding #42)
**Companion brief:** `PREMIUM_COACHES_PORTAL_PLAYER_PROFILE_WAVE_B_PM_BRIEF.md`

## Why
Wave A polished the existing player profile. Wave B adds the information a coach
actually reaches for at the field and on game day, and surfaces money/attendance
that already exists elsewhere in the portal directly on the player.

## Scope

### 1. New stored player fields (requires a migration)
On the rep roster player record:
- **Medical / allergies** — free text (safety-critical; shown prominently)
- **Emergency contact name** + **emergency contact phone**
- **Throws** (L/R) and **Bats** (L/R/S) — handedness, drives lineups/uniforms
- **Jersey size** — youth/adult size label

Same unit of work: migration file + `DATA_DICTIONARY.md` + dev/prod snapshot
refresh + `check:dictionary`. Apply to **dev only**; prod at release time.
New fields are optional/nullable; carried on season rollover and upgrade migration.

### 2. New profile sections (UI)
- **Player details** gains Throws / Bats / Jersey size.
- New **Safety** section: medical/allergies + emergency contact (visually distinct;
  medical flag echoed near the top of the profile when present).

### 3. Read-only roll-ups (no schema)
- **Attendance snapshot** — this player's attended/absent/late counts across the
  season's events (reads existing attendance data).
- **Dues** — replace the placeholder with this player's real dues/payment status
  (reads existing accounting/dues data). Link through to the dues screen.

## Decisions locked (2026-06-28)
- **Jersey size = fixed list** (YS/YM/YL/AS/AM/AL/AXL) via dropdown.
- **Attendance = both** — season total AND last 10 sessions.

## Open (non-blocking)
- Should the medical flag also show as an icon on the roster table row? (defer)

## Out of scope (later)
- Per-player season stats (depends on per-player scorekeeping).
- Player photo upload (initials avatar covers it for now).
