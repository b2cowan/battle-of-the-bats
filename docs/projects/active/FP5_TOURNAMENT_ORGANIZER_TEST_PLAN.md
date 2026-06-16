# FP-5 Tournament Organizer — Browser Test Plan (Clusters 1–3)

Covers everything built this session on the `dev` branch:
- **Cluster 1** — bracket-math trust: tie guard, coin-toss re-seed, forfeit (J1-083/084/091)
- **Forfeit lifecycle** — propose→approve reusing score finalization
- **Close-out** — forfeit-aware seal/summary (champion + standings)
- **Cluster 2** — false strings: go-live URL, contact privacy, archive copy, results empty-state (J1-043/045/103/087)
- **Cluster 3** — live game day: Now Playing, auto-refresh, live champion (J1-085/086/100)

---

## 0. Setup (do this first)

1. **Restart the dev server** — Cluster 3 changed an API route and added polling, so a clean restart is required:
   - Stop the dev server (Ctrl+C).
   - Delete the cache: `rm -rf .next`
   - `npm run dev` and wait for **✓ Ready**.
   - Sanity check: open `http://localhost:3000/platform-admin/login?next=%2Fplatform-admin` → should return a page (HTTP 200), no Supabase errors in the server log.
2. **Sign in** as an org **owner or admin** for a test org that has the **Tournament** module (Plus needed for the post-tournament Summary and sealed Archive checks in §6).
3. **Use (or create) a test tournament** with at least: 2 divisions, ~4 accepted teams per division, and the ability to build a schedule with pool games + a playoff bracket. A seeded "live demo" tournament is ideal if you have one.
4. Have **two browser profiles/windows** ready for the forfeit-approval test (§3): one logged in as an **admin/owner**, one as an **official/scorekeeper**. (Optional — only needed for §3 Scenario B.)

> Throughout: "Schedule" = admin Schedule page, "Results" = admin Results & Scoring page, "Dashboard" = the tournament admin dashboard. All under **/{org}/admin/tournaments/…**.

---

## 1. Bracket math — tie guard (J1-083)

**Goal:** a tied elimination (playoff) game must NOT advance either team.

1. Open a tournament with a **playoff bracket** where at least one first-round game feeds a "Winner …" slot in the next round.
2. Go to **Results**, find a **playoff** game, and enter a **tied score** (e.g. 3–3). Save/finalize it.
3. Go to **Schedule** (or the bracket view) and look at the **next-round game** that should receive this game's winner.
   - ✅ **Expected:** the next-round slot still shows the **placeholder** ("Winner …") — **no team was advanced**. The bracket visibly stalls at the tie.
   - ❌ **Fail:** the away team (or any team) silently appears in the next slot.
4. Now change that same game to a **decisive score** (e.g. 4–3) and finalize.
   - ✅ **Expected:** the **winning** team now populates the next-round slot.

---

## 2. Bracket math — coin-toss re-seed (J1-084)

**Goal:** recording a coin toss re-seeds an already-filled bracket.

> Requires a division where pool play ends in a **tie that the tie-breakers can't resolve** (so a coin toss is needed). If your data doesn't naturally produce this, you can force it by scoring two teams to identical records/run-diff.

1. Complete **all pool games** in a division such that two teams are tied for a seed and the standings flag a **coin toss needed** (you'll see a coin-toss prompt in standings/dashboard).
2. Confirm the **playoff bracket first-round games auto-filled** with the tied teams in some order.
3. Record the **coin toss** result (the admin coin-toss control in standings/division settings), choosing a finishing order that is the **opposite** of how the slots are currently filled.
   - ✅ **Expected:** the bracket's first-round slots **re-point** to match the coin-toss order. The toss visibly took effect.
   - ❌ **Fail:** the bracket doesn't change (old bug — toss appeared inert).
4. **Regression guard:** if any first-round game was **already played/scored** before you recorded the toss, that game's teams/score must be **unchanged** (a re-seed must never rewrite a game that already happened).

---

## 3. Forfeit — the action and the approval lifecycle (J1-091)

### Scenario A — Admin forfeit is immediate (finalization OFF or acting as admin)

1. **Event Settings → Score Finalization**: set it to the mode where scores are **final immediately** (admin/no-review). Save.
2. Go to **Results**, expand a **scheduled** game that has both teams assigned, and open its score entry.
3. In the action bar you'll see a **"No-show:"** prompt with the two team names as buttons. Click the team that **did not show up** (the no-show). *(The label means "this team forfeits" — the OTHER team advances.)*
   - ✅ **Expected:** the game immediately shows **"⚑ Forfeit"** (final). The present team is the winner.
4. Check **standings** for that division:
   - ✅ **Expected:** the present team got a **win**, the no-show got a **loss**, BUT the forfeit's score did **not** change either team's **Runs For / Against / Run Diff** (those columns ignore the forfeit margin).
5. If it was a **playoff** game: the **winner advances** to the next bracket slot, same as a normal final.

### Scenario B — Volunteer forfeit needs admin approval (finalization ON)

1. **Event Settings → Score Finalization**: set it to **"Admin review"** (scorekeeper submissions go to Pending Review). Save.
2. As an **official/scorekeeper** (second browser profile), go to the scorekeeper/Results surface, find a scheduled game, and **mark a forfeit** (same "No-show:" buttons).
   - ✅ **Expected:** the game shows **"⚑ Forfeit — Pending"** (amber/pending), and the **bracket does NOT advance** yet.
3. As the **admin/owner** (first profile), go to **Results**, find that game, and click **Finalize** (the approval button that appears on pending games).
   - ✅ **Expected:** the game flips to **"⚑ Forfeit"** (final), W/L counts, and **now** the bracket advances (if playoff).
   - ❌ **Fail:** finalizing turns it into a normal "Final" instead of a forfeit, or the bracket advanced while still pending.
4. **Guards to spot-check** (each should be blocked with a clear message):
   - Forfeit on a **cancelled** game → refused.
   - Forfeit on an **already-final** game → refused.
   - Forfeit when a team slot is still **TBD/placeholder** → refused ("Both teams must be set").

---

## 4. Close-out — forfeit-aware champion & standings (seal / summary)

**Goal:** a championship decided by forfeit still records a champion; forfeits count in summary standings without polluting run-diff.

1. In a division, play the bracket down to the **final (FIN)** game. Mark the **final as a forfeit** (one team is a no-show). Approve it if finalization is on.
2. **Post-Tournament Summary** (Plus): open the admin **Summary** for the tournament.
   - ✅ **Expected:** the division shows a **champion** (the present team) — not blank.
   - ✅ **Expected:** in the summary **standings**, a team's forfeit win/loss is counted, but the forfeit's nominal margin is **not** in its RF/RA/RD.
3. **Seal / Archive** (Plus): mark the tournament **completed**, then **seal** it (Past Tournaments / archive flow).
   - ✅ **Expected:** the sealed archive records the **champion** and the correct **total games** (forfeits included in the count).
   - ❌ **Fail:** sealed record shows **no champion** for a forfeit-decided final (old bug).

---

## 5. False strings (Cluster 2 — J1-043/045/103/087)

### 5a. Activate modal — correct Public URL (J1-043)

1. With a **draft** tournament, click **Activate**. In the confirm modal, read the **"Public URL"** line.
   - ✅ **Expected:** the URL is `http://localhost:3000/{org}/{tournament-slug}` — **no `/tournaments/` segment**.
2. **Copy that exact URL** and open it in a new tab.
   - ✅ **Expected:** the **public tournament home page loads** (not a 404).
   - ❌ **Fail:** the URL contains `/tournaments/` and 404s.

### 5b. Contact-email privacy honored on public pages (J1-045)

1. **Event Settings → Notifications & Contact** (or wherever the contact email + "show on public" toggle live). Set a **contact email** and turn **"show contact email publicly" OFF**. Save.
2. Visit the public pages for that tournament: **home**, **/news**, **/rules**.
   - ✅ **Expected:** the contact email is **NOT shown** on any of the three.
3. Turn the toggle **ON**, save, reload the three public pages.
   - ✅ **Expected:** the **correct designated contact email** now appears on all three.
   - ❌ **Fail:** the email shows even when the toggle is OFF (old bug), or the wrong email appears.

### 5c. Archive confirm copy is honest (J1-103)

1. On a tournament, open the **Archive** confirmation modal (don't confirm yet).
   - ✅ **Expected:** the copy says archiving **moves it to Past Tournaments**, makes it **read-only**, **frees a tournament slot**, and is **restorable** — with **no** "seals permanently / cannot be undone" language.
2. (Optional, real round-trip) **Archive** the tournament → confirm it appears under **Past Tournaments** and is read-only. Then **restore** it (subject to your plan's tournament-slot limit) → confirm it returns to the active list.

### 5d. Results empty-state distinguishes "no schedule" (J1-087)

1. Use a tournament that has **no games scheduled yet** (or a fresh division). Open **Results**.
   - ✅ **Expected:** the callout reads **"No schedule built yet"** with a **"Go to Schedule"** link — it does **NOT** promise live scores.
2. Click the link → it should land you on the **Schedule** builder for that tournament.
3. Build/generate a schedule so **games exist but are unscored**, return to **Results**.
   - ✅ **Expected:** the "no schedule" callout is **gone**; the unscored games render as **scorable rows** (the live-scores reassurance only applies once games exist).

---

## 6. Live game day (Cluster 3 — J1-085/086/100)

> Best tested on a tournament whose dates are **today** (or where at least one game has started), so the dashboard enters **game-day** mode. The board's "Live" status chip should be visible.

### 6a. "Now Playing" live panel (J1-085)

1. Put a game **in progress**: either set a game's scheduled start time to **now/earlier today** (still unscored), or submit a score so it's **In Review**.
2. Open the tournament **Dashboard** (game-day view).
   - ✅ **Expected:** a **"Now Playing"** panel appears at the top of the board, listing the live game(s) with: a **LIVE** or **IN REVIEW** badge, the two team names, a **score**, and the **venue/location**. Most-urgent (in-review) first.
3. Click a Now Playing row → ✅ should take you to **Results** to score it.
4. With **no games currently live** (all scheduled for later / all complete) → ✅ the Now Playing panel is **absent** (no empty box).

### 6b. Auto-refresh — gauges no longer freeze (J1-086)

1. On the game-day **Dashboard**, note the **"games complete"** gauge (e.g. 2/10).
2. In a **second tab**, go to **Results** and **finalize another game's score**.
3. Return to the **Dashboard tab and wait up to ~30 seconds** (do **not** manually refresh).
   - ✅ **Expected:** the gauge **updates on its own** (e.g. 2/10 → 3/10), and the Now Playing / check-in numbers move too.
   - ❌ **Fail:** numbers stay frozen until you manually reload (old bug).
4. **Visibility gating:** switch to another browser tab for a minute, then come back to the dashboard tab.
   - ✅ **Expected:** it **refetches immediately on refocus** (numbers current), and it wasn't hammering the server while backgrounded. *(Optional: watch the Network tab — requests to `tournament-dashboard` should pause when the tab is hidden.)*

### 6c. Live champion the moment the final ends (J1-100)

1. On a **game-day** tournament (status still **active**, NOT marked completed), play a division's bracket to the **final** and **finalize the final game** with a decisive winner.
2. On the **Dashboard → By Division** panel, find that division (wait up to ~30s for the poll, or reload).
   - ✅ **Expected:** that division row now shows a **🏆 champion chip with the winning team's name**, live — even though the tournament is still "active" (not completed).
   - ❌ **Fail:** the row still shows "Done"/round progress with no champion until you mark the whole tournament completed (old bug).
3. (Ties back to §4) If you decided that final by **forfeit**, the champion chip should still appear.

---

## 7. Regression smoke (quick passes — make sure nothing normal broke)

- **Normal scoring still works:** enter a normal score on a pool game → standings update, RF/RA/RD reflect the real score.
- **Normal finalize flow:** with finalization ON, a scorekeeper's **normal** submitted score still becomes **"Final"** (completed) when an admin finalizes — NOT a forfeit.
- **Revert:** reverting a forfeited or scored game returns it to **Scheduled** and clears the result.
- **Non-game-day dashboard:** for a tournament whose dates are in the future, the dashboard shows the **pre-event** view (no Now Playing panel, no live polling churn) and still loads cleanly.

---

## What to report back

For any ❌, note: the tournament/division, the step number, what you saw vs. expected, and (if console errors) the browser console + dev-server log lines. Screenshots of the dashboard board and the forfeit states are especially useful.
