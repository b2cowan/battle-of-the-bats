# PM Brief — Team Structure

> Plan: [TEAM_STRUCTURE_PLAN.md](TEAM_STRUCTURE_PLAN.md) · Status: on the board (`team-structure`) · Created 2026-11-24

**What it does:** A club sets up its rep teams the way it really runs them: its levels (Milton: Rep and Select), the
age groups inside each level, and the teams in each age group (Milton: Purple and White). Every team list in the
product, and on the club's public site, then reads as a tidy grid instead of one long stacked list. A club can also
name the person who runs each level, such as a VP of Select, and that person can run their own teams without being
handed the whole club.

**Why it matters:**
- **Lists:** today a club gets one heading and then every team underneath it. Milton's Rep heading alone holds ten
  teams. A club with four levels gets a wall of names.
- **Ages:** age is only a free-text label, so the product can't line teams up by age.
- **Level leads:** the VP of Select can be limited to Select's teams, but then they can only look, not change
  anything. Clubs work around that by making every VP a full club admin. That gives the VP the money, the families and
  every other level.

**Who benefits:**
- Club owners and admins: setup and the lists they work in every day.
- Level leads, such as the VP of Rep or VP of Select: they get the right tools for their level and no more.
- Families: they can find their child's team on the public site.
- No change for coaches.
- Available wherever Rep Teams is included (the Club plans), with no new plan gate.

**Expected impact:**
- Rep Teams, the money filters, schedules, permits, tryouts and the public Teams page all show the same order: level,
  then age, then the teams side by side.
- A club can email one level.
- A VP runs their level without being given everyone else's.
- Tournament entry matches a team by its real age group, not by matching typed text.

**Priority:** Medium. It came straight from a prospect's demo and shows on the first screen a club president looks
at. Nothing launches on it, and it doesn't block the Canadian launch. Club Website Enhancements waits on it for its
Teams section, so it should be drawn before that project draws the Teams page.

**Success criteria:**
- Milton's 20 teams read as two levels × five ages × two sides on every team list, on a phone and a computer.
- A four-level club looks just as tidy.
- A VP of Select can edit a Select team and gets "not yours" on a Rep team.
- A VP never sees Families or club money beyond what the club side already allows them.
- No team list anywhere still shows the old single heading followed by a stacked list.

**How it will be built (proposed):**
1. **The walk and drawing (Stage 0).** We walk today's screens and draw the finished picture once.
2. **The structure itself (Stage 1).**
3. **Level leads (Stage 2).** `/legal` looks first.
4. **Every admin list (Stage 3).**
5. **The public pages (Stage 4).** Done with the website project.

Seven owner calls come back from the drawing with recommendations. They include what the product calls a level, a
grid or a tree, boys and girls, and what a level lead may open.
