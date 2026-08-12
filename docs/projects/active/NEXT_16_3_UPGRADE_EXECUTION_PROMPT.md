# Prompt — execute the Next 16.2.4 → 16.3.0 upgrade (Step 2 → Gate 3)

**How to use:** paste everything below the line into a fresh session.

---

## The task

Execute the approved upgrade plan at `docs/projects/active/NEXT_16_3_UPGRADE_PLAN.md`. **Read it
first — it is the binding spec.** Gates 1 and 2 are DONE (mitigations committed `c16931d9`; the
pending feature release was promoted to prod 2026-08-12; dev == origin/master). You are executing
**§10 Step 2** and preparing **Gate 3**:

1. Housekeeping commit (needs my OK): the plan + PM brief + TODO edits from 2026-08-12 are still
   uncommitted (`NEXT_16_3_UPGRADE_*.md`, `DEPENDENCY_UPDATE_PROCESS_*.md`, `TODO.md`) — verify with
   `git status` first; another session may have landed them.
2. Build the permanent measurement script (plan D5, method in §8 V4) — inspector + forced GC, never
   working-set numbers.
3. **V0 baseline on 16.2.4 BEFORE bumping** — fill the plan's §12 table.
4. The bump commit, exactly the §4 set: `next` 16.3.0 + `eslint-config-next` 16.3.0 + `sharp`
   `^0.35.3` + `agentRules: false` in next.config.ts + BOTH lockfiles (pnpm-lock.yaml AND
   package-lock.json). Check first whether a stable 16.3.1 has shipped (`npm view next dist-tags`) —
   if yes, use it and note the delta.
5. Verification battery V1–V6 (§8), including the V5 proxy-header/sandbox probe.
6. Report the V4 verdict to me in plain product-owner language — **that is Gate 3; STOP there.**
   No promote (Gates 4–5 are mine). Expectation is calibrated in the plan: V4a (per-request leak)
   may well NOT improve — that decides the supervisor's fate (D6), not the upgrade's.

## Ground rules

- Every commit needs my explicit per-action OK. Branch is `dev`, explicit pathspecs only.
- Coordinate before long dev-server measurement runs — I may be using it. Restart rules in AGENTS.md
  apply (fresh server before sweeps; measurement runs count as sweeps).
- If any gate fails in a way you can't resolve same-day, stop and report — the plan's §9 rollback
  ladder and D2 emergency rung (16.2.12) exist for that.
- Talk to me as the product owner: outcomes and numbers, not mechanics. Technical detail goes in the
  plan's §12 results table and commit messages.
