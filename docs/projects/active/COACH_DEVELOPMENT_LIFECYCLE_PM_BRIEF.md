# Skills & Goals: make development useful between assessments

**Product brief · 11 September 2026 · Proposal for review · mockup round 2 the same day**  
Companions: [assessment and implementation plan](COACH_DEVELOPMENT_LIFECYCLE_PLAN.md) · [project hub](COACH_DEVELOPMENT_LIFECYCLE_HUB.html) (mockup, brief, plan and decisions on one artifact)

The portal can collect test results and keep player focus areas, but it does not yet give a head coach a complete development workflow. Definitions are thin, goals have little review history, and Development in Insights mostly reports coverage. The next investment should help a coach answer **“What are we working on, what did I observe, and what should we do next?”**

The owner confirmed that **measured tests and coach-observed skills are equally relevant**. We should support both explicitly, with different recording methods and presentations.

## Proposed experience

| Change | What the coach sees and does | Customer benefit |
|---|---|---|
| Clear definitions | Create a measured test with its unit, method and direction, or an observed skill with descriptions of what to look for. See an example before saving. | Coaches know what they are recording and repeat it consistently. |
| A focused workspace | Skills & Goals opens with Sessions, Players and Metrics. Start a session, open a player, or edit the library without scrolling past unrelated features. | Routine work becomes easier to find; setup stops occupying the everyday screen. |
| Better recording | Select the tests or skills for this session, work down the roster, record every attempt (three sprints are three numbers, with the best or average as the headline), see saved/pending/error states, and correct a record without deleting its history. | Faster entry, more confidence that work was saved, and the raw attempts kept for averages and later analysis. |
| Goals with evidence | Keep free-text focus areas; optionally add what success looks like, a next review date and supporting results or observations. Choose status deliberately and retain the review history. | A goal becomes something a coach revisits and discusses with the player. |
| Reports that explain | In Insights → Development, choose Coverage, Player progress or Practice review. A player report shows a dated test chart or observation timeline, the evidence behind it, and a route back to recording. | Coaches can interpret progress and decide what to work on next. |
| A useful player handout | Preview a concise, current-season summary of selected goals and results before downloading it. Keep the full dated log as an optional appendix. | Better player conversations without handing over a dense record dump. |

## Priority

**First: protect trust in history.** The implementation can join different units in a sparkline, hide retained records when a test is retired or a player becomes inactive, and list future planned practices under “Practices you’ve run.” Past-season edit/delete guards also need to match the create guards. These are source findings; live reproduction is part of the proposed first phase.

**Then: complete the coaching loop.** Build definitions, observations, goal reviews and recording together. Add richer progress reporting once the records can support its claims. Navigation and existing-data report improvements can begin earlier.

**Later:** optional team-authored templates, structured file import, and delegated collection if coach demand warrants changing the current head-coach-only rule.

## Boundaries and decisions

Keep the existing Skills & Goals and Insights destinations; individual development remains part of the player profile. Preserve roster order, separate seasons, and keep tryout evaluations separate from development measurements. No player leaderboard, composite development score or automatic achievement decision.

Access changes in one place: the staff card gains a **Development** grant (owner ruling 11 September). The head coach always has it; switching it on for an assistant lets them do everything the head coach can in development — define tests, run sessions, record results, write goals and observations. Off by default, so delegation is deliberate. Every record names who wrote it. Reading is unchanged: authorized staff read the data their existing duties permit, and observations require player-notes access, including when reached through a session or report. Family sharing remains a coach-downloaded document; this proposal adds no family accounts or automatic messages.

The proposed observation model, richer goal fields, workspace layout and handout preview need product review. They extend or amend existing design decisions; the mockups do not constitute approval.

## What the second look changed (11 September, round 2)

A code walk of every finding and of the surfaces around them — the demo sandbox, the help guide, navigation, the closed-season page, staff access and the player record — held every trust finding and corrected one navigation claim. It also found four things the first mockup had left out that a coach uses today (the session’s date and practice link, the returning-player prompts and tryout snapshot, adding a second goal, and recording a single reading from a notebook), and two rules the proposal has to fit inside: the player record’s three-tab layout, and the demo sandbox’s guided tour, which describes the very screen this work changes. The mockup was redrawn with those in, every element tagged new, restyled or unchanged, and a “Today” screen added so the before and after can be judged side by side.

Two calls were made while reviewing: the library is called **Metrics**, and **every attempt is recorded** — a test says how many attempts a session takes and which one is the headline, and averages and spread are computed from the stored attempts. A third call kept the “within a stated range” aim, drawn properly: a test whose target is a band (a changeup between 62 and 68 mph) sets From and To, each attempt reads in or out against it, and its headline is attempts in range rather than best. **Ten calls are yours** and sit on the hub’s Decisions tab with a recommendation each: whether tabs replace the hub’s band layout; which attempt is the headline by default; whether the “no your” rule also renames the existing “Your drills” door; how a changed test definition is handled; (delegation was ruled: one Development grant on the staff card;) whether a goal review needs written text; where “Not assessed” lives; whether a finished season’s development record is in scope (recommended: named, not built here); re-narrating the demo tour; delegated recording; and how four development views fit the three-tab player record.

## Success criteria

Use a small coach usability study to establish the baseline, then aim for:

- At least four of five coaches can explain the difference between a test, an observation and a goal, and create one without help.
- A coach can reach a named player’s selected development record from Insights and return to the same report and filters.
- Every displayed change names the dates, unit and source records; unavailable data never reads as zero or as a coaching failure.
- Recorded entries survive retirement and roster changes; failed saves remain visible and recoverable.
- A coach can review a goal and prepare a readable handout without leaving the player context.

**Assessment limits:** source-based walkthrough of the development code and, in round 2, of the surfaces around it; schema snapshot review; one existing marketing screenshot. No signed-in browser walkthrough or coach interviews. The detailed plan identifies confirmed code behaviour separately from usability hypotheses and validation work.
