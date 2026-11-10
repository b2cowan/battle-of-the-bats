# Bank check — an evaluation through a volunteer's eyes (both portals)

**Written:** 2026-11-08. **Kind:** an evaluation plus a proposal. You do not change product code in this session.
**Paste (the same line in Claude Code, Codex and Gemini):**

```
Read docs/projects/active/BANK_CHECK_NOVICE_UX_EVALUATION_PROMPT.md and carry it out, starting with its section 0.
```

---

## 0. Which agent you are (read first)

This prompt is written to run in Claude Code, Codex or Gemini. Everything below names an in-repo file you can open, never
a store only one tool can read. Where the tools differ, the difference is in this table; follow your row.

| Step | Claude Code | Codex / Gemini / other |
|---|---|---|
| **Project rules** | Loaded already (CLAUDE.md, AGENTS.md, AGENCY_RULES.md). | **Read all three before anything else:** `CLAUDE.md` (the coach season-close ruling and the "one page" rule), `AGENTS.md` (dev server, Next.js 16), `AGENCY_RULES.md` (push back first, one spelling, branch `dev`). They bind you exactly as they bind Claude. |
| **Broad reading** | Send it to a helper agent (CLAUDE.md rule). | Use sub-agents if your tool has them; otherwise read the plans by section (search for the heading, read that part), not whole. |
| **Specialist reviews** (§7) | Run `/ux`, `/design`, `/marketing` (and note for `/accounting`). | Open each command's file and apply it to your artifact as a checklist: `.claude/commands/ux.md` (which loads `memory/agents/ux-flow-agent.md`), `.claude/commands/design.md` (and `memory/agents/design-review-agent.md`), `.claude/commands/marketing.md`, `.claude/commands/accounting.md`. Say in the artifact that you applied them by hand. |
| **Publishing the artifact** (§7) | Load the `artifact-design` skill, then publish the HTML with the Artifact tool and give the owner the link. | Write the same self-contained HTML file and give the owner its path. Do not try to publish it anywhere. The owner can have Claude publish it later; build it so that works unchanged (rules in §7). |
| **Recording the session** (§8) | Claude's own auto-memory. | The in-repo `memory/` folder: one file, plus its line in `memory/MEMORY.md` in the same change (AGENCY_RULES, "Documentation"). |

Nothing else differs. A rule in this prompt that cites a reason is the whole rule; you do not need any file outside this
repository to follow it.

---

## 1. What the owner asked for (the owner's words, lightly trimmed)

> Do a complete walk-through and evaluation of the bank reconciliation part of our app, both the coaches portal and club
> admin. Take it from the perspective of a volunteer coach with limited accounting experience, and understand that it is
> meant as a tool to help them make sure they have logged everything they need to have logged. Think about the user
> experience from the first time they log in (what is this for? why is it here? how does it help me?), seeing the tab,
> reading it for the first time, all the way through checking a specific date. How does the flow work? Is it easy to
> understand and intuitive? Are the words and explanations easy to read for a non-accountant? How is the layout of the
> screens? Do things flow well? Is it easy to see how the data on these pages relates to the other money pages? Is it a
> helpful tool, or too complicated for these users? Think thoroughly about these questions, and also think of your own
> questions and the experiences you would expect this user to have. Draw up a full rundown in an artifact with your
> findings and proposals. Ideally a full end-to-end showing of the end state with your recommended improvements, or, if
> you think something more preliminary with questions works better, use the approach you think will work best.

## 2. Read this before you start: what this session is and is not

**The feature is finished and has been walked four times.** The balance check (stages BC1–BC9) and its sequel, the
working draft (WD1–WD3), are complete. The owner walked them in §481 (club), §482 (coach), §490 (club draft) and §491
(coach draft) in `docs/projects/active/OWNER_QA_LEDGER.md`, and all four passed with no findings. **Those walks asked "does
it do what we ruled?" This session asks a different question: "were the rulings right for someone who has never kept
books?"** Do not replay the walks. A pass on a walk is not evidence that a volunteer understands the screen.

**Two people, not one.** The owner framed this around a volunteer coach. The club Bank tab is used by a **volunteer club
treasurer**, who has the same lack of accounting background but a different job: several accounts, books assigned to
accounts, a starting statement, the fiscal-year close. Evaluate the coach first and most deeply, then the treasurer as
their own person. Do not judge the club screens as if a coach were reading them.

**Disagree out loud (AGENCY_RULES).** If the walk shows the question itself is wrong (for example, "the trouble is not the
Bank view, it is that a coach never learns it exists" or "most teams run the money through a personal account, so the
check measures nothing"), say so at the top of the artifact, not in a footnote. Do not invent problems to look rigorous;
where something works, say plainly that it works.

## 3. The standing rulings you are evaluating, with their reasons

Past decisions are reference, not authority. You may challenge any of these **on merit**, but you must name the ruling,
give its reason, and say why the evidence from your walk outweighs it. A proposal that quietly reverses one is a defect in
your report.

| Ruling | Reason given at the time | Where |
|---|---|---|
| **No ticking off line by line.** The check is: type a date and the bank balance, see the bank against what the books say, use *Find what's missing*, save even while off. | Treasurers and coaches are not accountants; the tick-off was an accountant's job. | Plan §0 (the 2026-11-05 replan) |
| **Unsettled is allowed.** A check can be saved while "Off by $X". | Warn, never block, is the house rule for money. | Plan §0 |
| **Bank code never writes a book line.** *Add the missing line* opens the Ledger's ordinary add form, prefilled. | One place enters money. | Plan §4 |
| **The coach's books stay the team's.** The club sees no team bank mark (the Teams column was withdrawn). | Coach independence (owner, 2026-11-06). | Plan §0 "Teams column" |
| **A closed season is one page.** The coach Bank view does not exist on a closed season; season-end windows carry a short bank line instead. | CLAUDE.md's season-close ruling. | CLAUDE.md, plan §9 BC8 |
| **The working draft lives in this browser for 14 days**, and shows "Started off by". | Owner asks 1A–6A, 2026-11-07. | Working draft plan §5 |

The plans: `docs/projects/archive/BANK_RECONCILIATION_PLAN.md` (the balance check) and
`docs/projects/archive/BANK_CHECK_WORKING_DRAFT_PLAN.md` (the draft). Both may be mid-move from `active/` to `archive/`;
look in both folders. They are long: pull out only the rulings in §0 and the settled words, and do not read them whole
(see §0 for how your tool does that).

## 4. Where the screens live

- **Coach:** the team's Money → Ledger → *View: Bank*, desk and phone; the bank line on the coach Overview, under the
  Cash on hand bars; the bank line in the *Start next season* and *Close the season* windows; the printed team check.
  Code: `components/coaches/bank/`.
- **Club:** Money → *Bank* tab (account setup, starting statement, *Check a statement*, *Find what's missing*, saved
  checks, the opened check, *Print this check*); the bank line on the club Overview; the bank row in *Close year*.
  Code: `components/admin/kit/club/money/bank/`.
- **Words:** `lib/bank-tab-words.ts`, `lib/bank-screen.ts`. **Help:** the `bank-tab` article in
  `lib/help-content/accounting.tsx` and the coach bank section in `lib/help-content/coaches.tsx`.
- **The pages a volunteer will compare against:** the coach Money hub (Cash on hand), Budget vs. Actual, the Ledger; the
  club Overview's "Where the club stands", Budget vs. Actual and the Ledger. If the Bank view's "your books" figure and
  Cash on hand can ever differ on the same day, find out whether the screen tells the user why.

**⚠ Another session may have uncommitted edits to the bank files** (on 2026-11-08 `BankTab.tsx`, `bank-screen.ts` and
`bank-tab-words.ts` were modified and not committed). Before you capture anything, run `git status` and
`git log -5 -- components/admin/kit/club/money/bank components/coaches/bank lib/bank-*`, and write in the artifact which
tree you walked (the commit, plus any uncommitted files).

## 5. How to walk it

**Walk it as the person, in the order they meet it.** For each persona, start before the Bank view: sign in fresh, land
on the Overview, open Money. Does anything say a bank check exists, what it is for, or when to do one? Then the first
sight of the empty view, the first reading of every sentence, setup, the first check on a chosen date, an off-by result,
*Find what's missing*, adding a missing line, coming back later, saving, opening a saved check, printing it, and the
season end (coach) or the year close (club). Do it on a desk at 1440 and on a phone at 390.

**You need a never-checked account to see a first time.** The BC9 walk data is probably still in place on dev (uat-rep-club,
"Walk chequing"; uat-rep-club / UAT Test Team; uat-standalone / UAT Standalone Team), so those already have checks. Find a
club account and a team with no checks by a read-only query on dev. If you must make data to reach a state, put a
setup/teardown pair in `.probe/bank-ux-eval/`, on **dev only**, and run the teardown before you finish. Never touch prod.
Never run `.probe/bank-bc9/teardown.mjs` (that is the owner's call). Never write to the demo sandboxes or sign a shared
demo user out; you may look at `riverdale-ridge` read-only to see what a prospect sees.

**Capturing:** the owner approves driving a headless browser (Playwright) in this session, for the bank screens and the
pages they connect to only. Copy the pattern of `.probe/bank-bc7/walk.mjs`: it signs in with a password through
supabase-js, hands the session to Playwright as the app's cookie, and screenshots the coach Bank view at each width. Read
the sign-in emails and passwords from `.env.local` (the `UAT_*` entries); never write a password into a file you create.
Put your probe in `.probe/bank-ux-eval/`. Check the dev server is up before starting one; if it is not, start it only
with `npm run dev`, with network access (AGENTS.md). No layout sweep.

**Measure, don't guess.** Count the clicks from sign-in to a saved check. Count the words on the first screen. Note every
term an accountant would know and a volunteer might not. Note every place a figure appears on two screens and whether the
two agree.

## 6. Questions to answer (the owner's, plus the ones a volunteer will run into)

Answer the owner's questions in §1 directly, one by one, with evidence. Then these, which are mine. Add your own.

**Purpose and discovery**
1. Could a coach who never opened Help say, in one sentence, what the Bank view is for? Does the product say "this helps
   you make sure everything is entered", or does it read as an accounting chore?
2. How does a coach find out it exists? The Overview line, the Ledger's view switch, Help, or nothing? What's new is drawn
   but not built; note it, do not design it.
3. When should they do one? Monthly, before the season-end meeting, when a parent asks? Does the product suggest a rhythm?

**The person's real situation**
4. Many volunteers check online banking, not a paper statement. Does "statement" and "statement date" fit someone typing
   today's balance from a banking app? Does the date they pick change the answer in a way they would understand?
5. What does a team with **no bank account** (cash only, or money in the club's account) see? What about a team whose money
   runs through the coach's personal account? Is there an honest way out, or does the view assume an account?
6. Cash still in the coach's pocket, an e-Transfer that has not landed, a cheque not cashed, online payments on their way
   from Stripe: does each read as plain sense to a non-accountant, or only to someone who knows what a payout is?
7. Off by a small amount (a bank fee, interest, a $2 rounding): does *Find what's missing* and *Add the missing line* lead
   them to record it properly, with a sensible category, or to dump it somewhere?
8. Off and they cannot find why: is there a dead end? Does saving while off feel like failing, or like a normal note?
9. The phone case: the banking app in one hand, our app in the other. Does switching apps lose anything? Does the working
   draft explain itself when they come back?

**How it fits the rest**
10. Is "your books" the same number as Cash on hand on the Money hub? If not, does the screen say why in plain words?
11. After a check, does anything else in the product reflect it (the Overview line, the season-end windows, the printed
    check)? Does the coach understand what saving did?
12. The assistant coach with money **read** only, and a parent treasurer: what do they see, and does it make sense?
13. The treasurer: why must they enter a starting statement, and do they understand why from the screen? Do "books" and
    "accounts" read as two different things? Is assigning books to an account understandable without help?

**The verdict**
14. Is this a helpful tool for these users, too complicated, or helpful but buried? Say which, and the two or three things
    that would move it most.

## 7. The artifact

**Default shape (the house pattern for a re-evaluation), all in ONE page.** The owner reviews the product with you
through this page, so it opens with the walk and the drawn proposal together; it is never a quiz or a QA checklist put in
front of the walk:
1. **The verdict first:** a short page in plain words: is it helpful, for whom, and the few changes that matter most.
2. **The measured walk:** stations in the order the person meets them, coach first, then treasurer. Each station: as built
   (captures, counts), your read (what works, what gets in the way), and a finding flag that opens on click.
3. **Words:** a table of every term and sentence a volunteer would stumble on, today's words beside the proposed ones.
4. **The end state drawn:** before = your captures, after = drawn, desk and phone, at true size, each changed part tagged
   with the stage that delivers it. Draw the end state, never an intermediate that looks like today.
5. **The stage ladder:** stage, what it covers, its asks, its rework risk, sequenced by dependency (no dates or release
   timing).
6. **Owner asks** beside the drawing each one is about: Keep / Reshape / Not yet, with your recommendation, what rides on
   it, and a notes box, plus a paste-back summary.

**When to go preliminary instead:** if the walk shows the concept itself is wrong for these users (not the screens, the
idea), publish the verdict, the walk and the shape questions with one sketch per option, and stop there. Say at the top
why you chose that. Do not draw a full end state on a premise the owner has not yet ruled.

**House rules for the drawing (owner rulings; these are the whole rules):**
- **Draw each control from the component the product ships**, not from memory of a generic UI. The view switch, for
  example, is one white track with the choices inside it, never separate pills. Open the component before you draw it.
- **The coaches portal is the formatting benchmark**: spacing, type sizes and table style follow what it ships today.
- **Money figures sit in one joined band**: the tiles touch and read as one strip, in a window too, never as loose cards.
- **Every highlight is clickable**: a finding flag, chip or tag opens its explanation on a click; hover alone is not enough.
- **Whole screen, true size**: before and after are the full screen at 1440 and at 390, not cropped fragments, with each
  changed part tagged NEW, RESTYLED or UNCHANGED.
- **Layout of the page**: tabs that stay at the top while scrolling, as little scrolling as possible, and an
  *Everything / Show only what differs* toggle.
- Every number in a drawing comes from the captured data or is marked as an example. Spell it the product's way (`cheque`,
  `8:00 a.m.`, `installment`) and run `npm run check:spelling` over your words.

**The file:** `docs/projects/active/BANK_CHECK_NOVICE_UX_EVALUATION.html`. It must be **one self-contained file** so it
opens from disk and can be published as-is: styles and scripts inline, screenshots inlined as data (keep the file under
16 MB; use JPEG for captures), no external scripts except a pinned version from cdnjs.cloudflare.com if you truly need one,
fonts only from Google Fonts. Give it a short `<title>` (two to four words), a light and a dark theme, and make it read
at phone width without sideways scrolling. Owner notes boxes save in the browser (wrapped in try/catch) and the
paste-back summary is a "Copy" button, so it works with no server. Publish it as §0 says for your tool.

**Before you hand it off, put it through the specialist reviews** (§0 says how for your tool): UX (flow), design (the
drawing), and marketing (the words, as they are customer copy). If a proposal changes what the product records, prints or
tells someone about money, note it for the accounting review. Apply what they find or list it as an open point in the
artifact.

## 8. Limits

- No product code changes, no migrations, no commits without the owner's yes. Files you may write: the artifact source,
  the probe folder, one line in `TODO.md` linking the artifact, and the session record (§0 says where).
- Work on the `dev` branch; check it with `git rev-parse --abbrev-ref HEAD` before you write anything. Other agents share
  this working copy, so never stage with `git add -A` or `git add .`, and never revert files you did not write.
- Do not re-open the closed-season rule, coach independence or the tick-off decision without the evidence and reasoning
  in §3.
- Do not change hooks, settings or database checks.

## 9. Your hand-off message

To the owner, as a product owner: the artifact link (or the file's path, if your tool cannot publish), the verdict in two or three sentences, the top three changes, which
tree you walked, the owner asks still waiting for a ruling, and anything you could not reach on dev (for example, the year-close bank
row needs a club with an ended open year, and dev has none).
