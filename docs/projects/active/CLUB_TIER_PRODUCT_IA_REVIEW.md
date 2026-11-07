# Club Tier Product & Information Architecture Review

**Date**: 2026-11-07
**Scope**: Cold-eyed product and information architecture review of FieldLogicHQ's **Club tier** across all four personas (Club Admin, Rep Head Coach, Parent/Guardian, Tournament Organizer) and end-to-end Journeys A through H.

---

## 1. Verdict

**Does the product hang together for a first-time volunteer club admin? Almost — inside each module, the craft is remarkably high, but at the seams between modules, the mental model fractures.**

If a non-technical volunteer registrar or treasurer opens FieldLogicHQ tomorrow, they will find individual screens — the House League registration form, the draft board, the Public Site builder, the Bank balance check, and the rep coach's Season's End rollup — that are calmer and better written than almost anything in youth sports software. **Where the product breaks down is when a job crosses two modules or two roles.** The club admin is forced to hold three different calendars/clocks in their head (`Fiscal year`, House League `Season`, and per-team Rep `Season`), three different ways of creating practices, two completely different coaching worlds, and a family model that does not match what the product promises.

### Testing the Owner's Suspicion on Scheduling
> *"House league + rep + games + practices in one world feels confusing."*

**Confirmed — and narrowed to the exact structural cause.** It is *not* confusing that games and practices sit together on the read-only club `Calendar` (`app/[orgSlug]/admin/calendar/page.tsx`). What is deeply confusing is that **getting an event onto a field is split across 7 screens, 3 roles, 3 separate scheduling engines, and 4 different venue lists**, with silent handoffs between them:
1. City permits live under `Organization › Venue library › Permits` (`app/[orgSlug]/admin/org/venues/page.tsx:98-99`, scoped by **Fiscal year**).
2. Dividing those permits between Rep practices and House League time happens in `Schedules` (`app/[orgSlug]/admin/schedules/[scheduleId]/page.tsx`, visible only to Owner/Admin).
3. Slicing that House League time into division game slots vs. practice slots happens inside `House league › [Season] › Schedule › Tools ⋯` (`app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx:1292-1307`), which then runs two *more* separate generators (`Practice time` and `Generate games`).
4. Rep team games cannot be scheduled by the club at all — only by each coach in `Coaches Portal › Schedule` (`app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx`), where a coach can save a practice right on top of a House League game (receiving only an amber notice) or save it under `"Your places"`, bypassing clash detection altogether.

### The Five Most Important Problems (Ranked)

1. **The "Signed-In Family App" does not actually exist for House League, and hides all money for Rep teams (`F-01`).** House League parents have no signed-in view at all (only an emailed no-login magic link, `app/[orgSlug]/league/[seasonSlug]/status/[token]/YourSignup.tsx`), while the signed-in Rep parent view (`lib/family-guardian-view.ts:3-25`) is currently switched off in code (`GUARDIAN_TIER_ENABLED = false`) and structurally excludes player dues, fees, and RSVPs even when enabled. A parent with one child in House League and one in Rep has no single place to see their children's schedules or what they owe.
2. **Scheduling is fractured across Permits, `Schedules`, `Calendar`, House League `Tools ⋯`, and the Coaches Portal (`F-02`, `F-03`, `F-04`).** Permits are hidden inside `Organization › Venue library` (`app/[orgSlug]/admin/org/venues/page.tsx:376-404`); the League Admin's main scheduling jobs are buried in a `Tools ⋯` overflow menu (`app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx:1292-1307`); blacking out a rained-out Saturday requires visiting three different places (and the House League `Rainout` button cancels games while leaving practices standing); and editing a permit's dates off gives zero warning when existing games or practices sit on those dates.
3. **Rep Teams and House League work in opposite ways for seasons, coach invites, tryouts/registration, and online payment (`F-05`, `F-06`, `F-07`).** House League has a club-wide season, online Stripe payment, automatic parent emails on every status change, and a 1-page public team view for coaches. Rep Teams have no club-wide season (15 teams = 15 separate season start/rollover dialogs), no online payment for tryouts or player dues, silent tryout decisions that never email parents, and a 14-page Coaches Portal.
4. **Club Money has blind spots and contradicts its own privacy promise (`F-08`, `F-09`, `F-10`).** Every screen in Accounting and the Coaches Portal promises coaches that the club *"never sees your families' payments"* (`lib/club-money-words.ts:604-610`), yet `Club Admin › Families` (`lib/child-page.ts:142-170`) displays every rep child's exact dues, paid amount, balance, and fundraising credits. Meanwhile, `Accounting › Overview` (`app/[orgSlug]/admin/accounting/page.tsx`) omits unpaid House League registration fees from its headline figures, and `Schedules` and `Accounting › Allocations` can double-bill rep teams for the same dome budget line without warning.
5. **First-run onboarding is invisible to the invited Club Admin, and the self-serve signup path drops `Club` altogether (`F-11`, `F-12`).** If the club president invites a registrar/admin in Step 1 (`"Staff your board"`), that invited Club Admin is locked out of the setup checklist (`app/[orgSlug]/admin/onboarding/page.tsx:401-404`, `components/admin/kit/club/ClubHubKit.tsx:432-438`). And if the Club plan gate is flipped live, clicking `"Start your Club trial"` on `/pricing` drops the user into a `"Run a tournament"` flow whose plan picker only offers `Tournament` and `Tournament Plus` (`app/[orgSlug]/admin/onboarding/PlanStep.tsx:16`).

---

## 2. Vocabulary Map

| Key Noun | Where It Appears | Meaning in Each Place | Inconsistency or Collision |
| :--- | :--- | :--- | :--- |
| **Season** | 1. `House league` (`app/[orgSlug]/admin/house-league/page.tsx`)<br>2. `Rep teams › [Team]` (`app/[orgSlug]/admin/rep-teams/teams/[teamId]/page.tsx`) & `Coaches Portal` (`components/coaches/CoachesSidebar.tsx`) | 1. A club-wide recreational season container (`league_seasons`) holding all age groups, teams, registrations, and schedules.<br>2. A single rep team's individual year (`rep_program_years`). | **Major scope mismatch.** A club has *one* House League season for 2026, but if it has 12 Rep teams, it has *12 separate* Rep seasons that must be started and rolled forward one team at a time. |
| **Fiscal year** | `Club Admin › Accounting` (`app/[orgSlug]/admin/accounting/page.tsx:244`) & `Organization › Venue library › Permits` (`app/[orgSlug]/admin/org/venues/page.tsx:404`) | A 12-month club accounting period (`org_fiscal_years`, e.g., `2025–26`). | Deliberately distinct from `Season` (Settled Decision), but **collides on `Accounting › Teams › [Team]`** (`app/[orgSlug]/admin/accounting/teams/[teamId]/page.tsx:271-274`, where the header is scoped by Fiscal Year while the statement table groups by the team's Season) and in **Permits** (a municipal field permit belongs to a Fiscal Year, not a Season). |
| **Team** | 1. `Rep teams` (`app/[orgSlug]/admin/rep-teams/page.tsx`)<br>2. `House league › [Season] › Teams & draft` (`app/[orgSlug]/admin/house-league/seasons/[seasonId]/teams/page.tsx`)<br>3. `Tournaments › Teams` (`app/[orgSlug]/admin/tournaments/teams/page.tsx`) | 1. A permanent multi-year franchise (`rep_teams`) with its own Coaches Portal and bank book.<br>2. A single-season drafted squad inside a House League division (`league_teams`).<br>3. An external or internal entrant in a weekend tournament (`teams`). | Newcomers see `"Teams"` in the Public Site header (`lib/org-public-sections.ts:45`) and in `Accounting › Teams` (`app/[orgSlug]/admin/accounting/teams/page.tsx`) and assume it includes House League teams. In both places, `"Teams"` means **Rep teams only**. |
| **Division** vs. **Age group** | 1. `House league › [Season] › Overview` (`components/admin/kit/club/league/DivisionsBlock.tsx:61-74`) & `AddAgeGroupsWindow.tsx` (`components/admin/kit/club/league/AddAgeGroupsWindow.tsx:172-296`)<br>2. `Rep teams › Add team` (`components/admin/kit/club/AddTeamDialog.tsx:118-125`)<br>3. `Rep teams › Team groups` (`app/[orgSlug]/admin/rep-teams/page.tsx`) | 1. In House League, the card heading says `"Divisions"`, the empty state says `"No age groups yet"`, and the button says `"Add age groups"`. Creates structured `league_divisions` with birth years, capacity, and price.<br>2. In Rep Teams, `"Division"` is an optional 30-character free-text label on a team (e.g., `"U13 Tier 1"`), while birth years live separately on the team's season, and teams are grouped into `"Team groups"` (e.g., `"Boys"`, `"Girls"`). | Within the same House League screen, `"Divisions"` and `"Age groups"` are used interchangeably in adjacent sentences. Across the club, a House League division is a structural container of teams and fees, while a Rep division is just a text badge. |
| **Calendar** vs. **Schedules** vs. **Schedule** | 1. `Club Admin › Calendar` (`app/[orgSlug]/admin/calendar/page.tsx`)<br>2. `Club Admin › Schedules` (`app/[orgSlug]/admin/schedules/page.tsx`)<br>3. `House league › Schedule`, `Rep teams › [Team] › Schedule`, `Coaches Portal › Schedule` | 1. `Calendar`: Read-only master view of all club games and practices.<br>2. `Schedules`: A permit-slot allocator that assigns ice/field blocks to Rep practices or to House League.<br>3. `Schedule`: The event list for one House League season or one Rep team. | **Severe sidebar collision.** `Calendar` and `Schedules` sit one above the other at the top of the Club Admin sidebar (`lib/admin-kit-nav.ts:246-277`). No newcomer guesses that `Schedules` means *"Permit slot allocator for rep practices and house-league time blocks"* rather than game schedules. |
| **Venue** vs. **Facility** vs. **Diamond / Field** vs. **Your place** | 1. `Organization › Venue library` (`app/[orgSlug]/admin/org/venues/page.tsx:480`)<br>2. `House league › Schedule` (`app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx:314-539`)<br>3. `Coaches Portal › Schedule` (`components/venue/WhereField.tsx:224-255`)<br>4. `Tournaments › Venues & facilities` (`app/[orgSlug]/admin/tournaments/venues/page.tsx:53`) | 1. `Venue` = park/arena (`org_venues`); `Facility` = specific surface (`org_venue_facilities`, e.g., `"Diamond 1"`).<br>2. Uses `"Venue"`, `"Facility"`, `"Diamond"`, and `"Field"` across different modals on the same page.<br>3. Splits locations into `"● Club venue"` (clash-checked), `"● Your place"` (`rep_team_places`, coach's personal list — **not clash-checked**), and typed text.<br>4. Stores venues in a separate `diamonds` table (only linked if imported via `"From venue library"`). | Four different storage tiers for a playing surface; three of them (`Your place`, un-imported tournament venues, and typed strings) silently bypass club clash detection (`lib/venue-clash.ts:15-31`). |
| **Registration** vs. **Sign-up** vs. **Tryout application** | 1. `House league › Registrations` & `components/league/RegisterForm.tsx`<br>2. `app/[orgSlug]/league/[seasonSlug]/status/[token]/YourSignup.tsx`<br>3. `components/rep-teams/TryoutRegisterForm.tsx` | 1. Admin tab says `"Registrations"`; public button says `"Register now"`; form heading says `"Sign up"`.<br>2. Parent's magic-link status page is called `"Your sign-up"`.<br>3. Rep tryout button says `"Open sign-ups"`, while the form submits a `"tryout application"`. | Minor copy drift between `"Registration"` and `"Sign-up"`, and `"Open sign-ups"` on Rep Tryouts sounds like program registration even though it collects no fees and does not place the player on a roster. |
| **Dues** vs. **Price / Fee** vs. **Allocation** | 1. `Coaches Portal › Money › Player dues` (`app/[orgSlug]/coaches/teams/[teamId]/accounting/dues/panel.tsx`)<br>2. `House league › Money` (`app/[orgSlug]/admin/house-league/seasons/[seasonId]/money/page.tsx`)<br>3. `Club Admin › Families` (`lib/help-content/families.tsx:88-96`)<br>4. `Club Admin › Accounting › Allocations` (`app/[orgSlug]/admin/accounting/allocations/page.tsx`) | 1. Installments a rep family owes their team (`Player dues`).<br>2. Registration price a house-league family owes the club (`Price` / `Owed`).<br>3. Column in `Families` is labeled `"Dues"`, combining **both** rep player dues and house-league registration fees.<br>4. What a rep team owes the club for shared costs (`Allocations`). | In `Accounting`, what teams owe the club is `"Owed by the teams"` (`Allocations`), while in `Families`, `"Dues"` mixes money owed to the club (House League) with money owed to a coach's private team book (Rep). |
| **Members** vs. **The board** vs. **Staff** vs. **Coaches** | 1. `Organization › Members` (`lib/admin-kit-nav.ts:299-315`)<br>2. `Organization › The board` (`app/[orgSlug]/admin/org/board/page.tsx`)<br>3. `Coaches Portal › Staff` (`app/[orgSlug]/coaches/teams/[teamId]/staff/page.tsx`)<br>4. `Rep teams › [Team] › Coaches` & `Assistant coaches` | 1. Club-level operators (`Owner`, `Admin`, `Treasurer`, `League Admin`, `League Registrar`, `Staff`).<br>2. Read-only view of club operators shown to non-owners.<br>3. A rep team's coaching/managerial staff inside the Coaches Portal.<br>4. That same rep team's coaching staff when viewed in Club Admin. | The same table of rep team adults is called `"Coaches"` in Club Admin and `"Staff"` in the Coaches Portal; meanwhile `"Staff"` in `Organization › Members` is a low-privilege club role (`Staff` vs `Admin`), and Step 1 of Club Setup calls `Organization › Members` `"Staff your board"`. |
| **Following** vs. **Your teams** vs. **My team** | 1. `WorkspacesPill` (`lib/user-contexts.ts:696-698`) & `/following` (`components/consumer/FollowingList.tsx:218-238`)<br>2. `components/public/ClubBar.tsx:60-62` | 1. In the top-bar workspace switcher, a parent's link to their rep child's team is labeled `"Following"` (`"Teams & tournaments you follow"`). Inside `/following`, a verified guardian's team sits under `"Your teams"`.<br>2. On the public club site, a signed-in House League coach sees `"My team"` in the header. | A parent looking for their child's team in the workspace menu never sees `"Family"` or `"Your child"` — only `"Following"`, which sounds like an anonymous fan bookmark. |

---

## 3. Journey Notes (A to H)

### Journey A: Discovering the Product, Signing Up, and First-Run Setup of a Club

| Step | Where It Happens | What the User Must Already Know | Friction | Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **A1. Discover Club tier** | `app/for-clubs/page.tsx:75-88`, `components/PricingSection.tsx:320-322`, `app/(consumer)/start/club/page.tsx:26-61` | That Club is currently gated behind early access (`"Coming soon"` / `"We set up Club with you directly"`), while `/for-clubs` also pitches `"Start free with Tournament"` at the bottom. | **Minor** (while gated) | **OBSERVED**: `lib/plan-config.ts:101-146` sets `gatingStatus: 'early_access'` for `club`. `app/for-clubs/page.tsx:304` links to `/start/tournament`. |
| **A2. Self-serve signup when Club gate is opened** | `components/PricingSection.tsx:194-202` → `app/(consumer)/start/StartDoorForm.tsx:109-262` → `app/[orgSlug]/admin/onboarding/PlanStep.tsx:16-138` | Nothing — the user clicks `"Start your Club trial"`, but the app drops `?plan=club`, titles the page `"Run a tournament — Free to start"`, and at Step 3 (`Plan`) only offers `Tournament Plus` and `Tournament`. | **Blocking** (if ungated) | **OBSERVED**: `lib/start-door.ts:39-41` strips `club` and `league`; `app/[orgSlug]/admin/onboarding/PlanStep.tsx:16` comments `"League Plus and Club are not here"`. |
| **A3. Owner lands on First-Run Setup Checklist** | `components/admin/kit/club/ClubSetupKit.tsx:128-201` | That `/admin/onboarding` is a focused shell with no left sidebar (`AdminKitRail` is hidden until they click a step or `"Go to Overview"`). | **Minor** | **OBSERVED**: `app/[orgSlug]/admin/AdminChrome.tsx:46-55` hides the sidebar on `/admin/onboarding`; `ClubSetupKit.tsx:42-48` renders 5 numbered steps + quiet links for House League & Tournaments. |
| **A4. Step 1: Invite a Club Admin & Treasurer** | `app/[orgSlug]/admin/org/members/page.tsx` | That the invite dialog defaults to the low-privilege `Staff` role rather than `Admin` or `Treasurer`, so they must change the dropdown before sending. | **Minor** | **OBSERVED**: `docs/projects/active/CLUB_TIER_STAGE13_JOURNEYS_HUB.html` (`F-A1-2`) and `app/[orgSlug]/admin/org/members/page.tsx`. |
| **A5. Invited Club Admin signs in to finish setup** | `components/admin/kit/club/ClubHubKit.tsx:432-438` & `app/[orgSlug]/admin/onboarding/page.tsx:401-404` | The invited Club Admin (our primary persona!) cannot access `/admin/onboarding` (redirected away) and cannot see the `"Setup: X of 5 steps done · Continue setup"` link on `Overview` because both are restricted to `owner` only. | **Blocking** (for non-owner Admin) | **OBSERVED**: `app/[orgSlug]/admin/onboarding/page.tsx:401-404` redirects non-owners; `ClubHubKit.tsx:432-438` gates the setup link behind `isOwner`. |
| **A6. Step 4: Put your club online** | `app/[orgSlug]/admin/public-site/page.tsx` | Step 4 says *"Add a tagline and a contact email to your public page"*, but the checklist marks Step 4 complete as soon as a tagline is saved, even when contact email is blank. | **Minor** | **OBSERVED**: `components/admin/kit/club/ClubSetupKit.tsx:46` vs. `lib/club-checklist.ts:103`. |

---

### Journey B: Setting Up a Season (House League Divisions, Rep Teams, and Inviting Coaches)

| Step | Where It Happens | What the User Must Already Know | Friction | Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **B1. Open the club's Fiscal Year** | `components/admin/kit/club/money/FiscalYearParts.tsx:194-419` | That city field permits and club budgets require a `Fiscal year` in `Accounting` first; without one, `Venue library › Permits` dead-ends with `"Open a fiscal year in Accounting first"`. | **Minor** | **OBSERVED**: `app/[orgSlug]/admin/org/venues/page.tsx:419`. |
| **B2. Create a House League season & divisions** | `components/admin/kit/club/CreateLeagueSeasonDialog.tsx:308-409` → `components/admin/kit/club/league/AddAgeGroupsWindow.tsx:172-296` | Almost nothing — guided dialog creates the season, and `Add age groups` provides age chips (`U6`–`U18`), birth-year pickers, capacity, and price in one table. | **None** | **OBSERVED**: `components/admin/kit/club/league/AddAgeGroupsWindow.tsx:172-296`. |
| **B3. Create House League teams & assign coaches** | `app/[orgSlug]/admin/house-league/seasons/[seasonId]/teams/TeamsScreen.tsx:238-246` → `TeamWindow.tsx:260-280` | **Crucial hidden rule**: Entering a House League coach's name and email does **not** send an invite email until you click `"Publish teams"` for that division (it quietly shows `"Invited when you publish"`). And when the coach accepts, they do **not** get the Coaches Portal — they get a public team page (`/{orgSlug}/league/{seasonSlug}/team/{teamId}`). | **Minor** to **Blocking** | **OBSERVED**: `app/[orgSlug]/admin/house-league/seasons/[seasonId]/teams/TeamWindow.tsx:174-279`, `lib/house-league-coach-invites.ts:13-15`. |
| **B4. Create Rep Teams & start each team's season** | `components/admin/kit/club/AddTeamDialog.tsx:78-145` → `components/admin/kit/club/SeasonDialogs.tsx:326-387` | That adding a Rep team does **not** start its season, and there is no club-wide Rep season. The admin must click into every Rep team one by one and click `"Start first season"`, then open `"Team details"` to set birth years (`Born from` / `Born to`). | **Minor** (scales poorly for 10–15 teams) | **OBSERVED**: `app/[orgSlug]/admin/rep-teams/teams/[teamId]/page.tsx:327-332` and `:701-734`. |
| **B5. Invite Rep Team coaches** | `components/admin/kit/club/CoachDialogs.tsx:49-121` | Unlike House League, this form asks for **email only (no name field)**, sends the email **immediately**, and lands the coach inside the 14-page Premium Coaches Portal (`/{orgSlug}/coaches/teams/{teamId}`). | **Minor** | **OBSERVED**: `components/admin/kit/club/CoachDialogs.tsx:49-121`, `app/(consumer)/auth/accept-assistant-invite/page.tsx:73`. |

---

### Journey C: Registration and a Family Paying Online

| Step | Where It Happens | What the User Must Already Know | Friction | Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **C1. Connect Stripe & complete House League checklist** | `lib/help-content/house-league.tsx:1194` & `app/[orgSlug]/admin/house-league/seasons/[seasonId]/page.tsx:234-270` | That the **Owner** must connect Stripe in `Organization › Settings › Payouts` if families are to pay online by card/bank debit; otherwise the `"Before you open registration"` checklist only requires offline `How to pay` instructions, and families will only see offline payment instructions after registering. | **Minor** | **OBSERVED**: `lib/help-content/house-league.tsx:1194`, `components/admin/kit/club/league/SeasonRecordBlocks.tsx:289-322`. |
| **C2. Parent registers 1–8 children for House League** | `components/league/RegisterForm.tsx:193-285` | Nothing — entering each child's date of birth automatically picks the matching division, shows remaining spots or waitlist position, applies early-bird pricing, and totals the fee. | **None** | **OBSERVED**: `components/league/RegisterForm.tsx:193-250`. |
| **C3. Parent pays House League fee online** | In-place confirmation (`components/league/RegisterForm.tsx:391-459`) or emailed `"Your sign-up"` link (`app/[orgSlug]/league/[seasonSlug]/status/[token]/YourSignup.tsx`) | If the season has `Auto-approve when spots are open` turned off (`pending_review`), the parent **cannot pay at sign-up** (`"Nothing to pay yet"`) and must wait for an admin to click `Approve` and email them back. | **Minor** | **OBSERVED**: `components/public/LeaguePayBlock.tsx:103-134`, `lib/help-content/house-league.tsx:1173-1190`. |
| **C4. Registrar reviews & approves House League registrations** | `app/[orgSlug]/admin/house-league/seasons/[seasonId]/registrations/RegistrationsScreen.tsx` | Clicking the single-row `"Approve"` button **immediately approves the child and fires an email to the parent with zero confirmation prompt**, whereas bulk Approve asks for confirmation first. Also, `Mark received` only records the **full fee** (no partial payment support). | **Minor** | **OBSERVED**: `lib/help-content/house-league.tsx:1327` (`Approve`), `:1411` (`Mark received`). |
| **C5. Parent applies for a Rep Team tryout & pays Rep dues** | `components/rep-teams/TryoutRegisterForm.tsx` & `app/[orgSlug]/coaches/teams/[teamId]/accounting/dues/panel.tsx` | **Major shock for families and admins**: Rep tryout applications **cannot collect tryout fees online**, **never email families when an offer/waitlist/cut decision is recorded**, and once a player makes the Rep roster, **families cannot pay Rep player dues online** — the coach tracks installments manually and emails PDF statements/reminders for offline payment (e-Transfer/cheque/cash). | **Blocking** (if club expects online Rep registration/payment) | **OBSERVED**: `components/admin/kit/club/TryoutDialogs.tsx:14-15` (*"nothing is emailed"*), `app/[orgSlug]/coaches/teams/[teamId]/accounting/dues/panel.tsx:126-173`. |

---

### Journey D: Scheduling — Games, Practices, Venues/Fields Across House League and Rep

| Step | Where It Happens | What the User Must Already Know | Friction | Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **D1. Add club venues, fields/pads, and city permits** | `app/[orgSlug]/admin/org/venues/page.tsx:88-516` (`Venues` \| `Permits` switch) | That venues and city permits do not live under `Calendar` or `Schedules` — they are tucked inside `Organization › Venue library`. Also, editing a permit to add `"Dates off"` gives **no warning** if games or practices are already booked on those dates! | **Blocking** (discoverability & silent breakage) | **OBSERVED**: `lib/admin-kit-nav.ts:323`, `app/[orgSlug]/admin/org/venues/page.tsx:376-404`, `docs/projects/active/CLUB_TIER_STAGE13_JOURNEYS_HUB.html` (`F-O6-3`, `F-A4-3`). |
| **D2. Allocate permit slots to Rep teams and House League** | `app/[orgSlug]/admin/schedules/[scheduleId]/page.tsx:85-705` | That `"Schedules"` in the sidebar is actually the **permit-slot allocator** (Owner/Admin only). Clicking `"Send to teams"` writes locked practices onto Rep team schedules and hands raw time blocks to House League — **without notifying the League Admin**. Also, `"Fair shares"` (which calculates the bill to rep teams) is hidden inside a `View` dropdown instead of the 5-step bar. | **Blocking** | **OBSERVED**: `app/[orgSlug]/admin/schedules/[scheduleId]/page.tsx:427-662`, `lib/club-schedule-words.ts:19-47`, `F-O2-8`, `F-O3-7`. |
| **D3. League Admin divides House League's time & generates practices and games** | `app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx:1185-1307` | That the three core generators (`House league's time`, `Practice time`, and `Generate games`) are all hidden inside the `Tools ⋯` button; that if the club hasn't sent time from `Schedules` yet, `Generate games` refuses to run on a Club plan; and that a division with <2 teams or ≥1 existing game silently vanishes from `Generate games` without explanation. | **Blocking** | **OBSERVED**: `app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx:1185-1307`, `lib/help-content/house-league.tsx:625-645`, `F-L2-1`, `F-L2-5`, `F-L4-1`. |
| **D4. League Admin publishes the House League schedule** | `app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx:1389-1399` | That `"Publish schedule"` is **invisible** until the division's teams are published on the `Teams & draft` tab (`F-L2-8`); and that any game edits made *after* publishing do not show on the public website until clicking `"Changes to send"`. | **Minor** to **Blocking** | **OBSERVED**: `lib/help-content/house-league.tsx:656-693`. |
| **D5. Rep Coach schedules Rep games and extra practices** | `app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx` & `components/coaches/ScheduleEventForm.tsx:548-636` | That Club Admins **cannot** add or edit Rep games (`Rep teams › [Team] › Schedule` is read-only); that practices sent from `Schedules` are locked on the coach's calendar (coach can only click `"Hand back this practice"`); and that if the coach books a `"● Club venue"` during a House League game, the form shows an amber warning **but still lets the coach save the double-booking**! | **Minor** to **Blocking** | **OBSERVED**: `app/[orgSlug]/admin/rep-teams/teams/[teamId]/schedule/page.tsx:59`, `lib/venue-clash.ts:13-14`. |
| **D6. Handle a Saturday rainout across the club** | `app/[orgSlug]/admin/calendar/page.tsx:32`, `app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx:1402-1545` | There is **no club-wide rainout action** on `Calendar` (it is read-only). Worse, clicking `Rainout` on the House League schedule only cancels/postpones **games** and leaves **House League practices** on that same rained-out field untouched! | **Blocking** | **OBSERVED**: `app/[orgSlug]/admin/calendar/page.tsx:32`, `lib/help-content/house-league.tsx:583` (*"Practices are not moved by Rainout"*), `F-A2-1`. |

---

### Journey E: Money — Team Books, Club Accounting, and Bank Reconciliation

| Step | Where It Happens | What the User Must Already Know | Friction | Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **E1. Club Treasurer sets budget & allocates shared costs to Rep teams** | `app/[orgSlug]/admin/accounting/budget/page.tsx`, `app/[orgSlug]/admin/accounting/allocations/page.tsx`, & `app/[orgSlug]/admin/schedules/[scheduleId]/page.tsx:433` | **Double-billing trap**: If an Owner set up a dome schedule in `Schedules` with a draft bill against the `"Dome time"` budget line, `Accounting › Allocations` still shows 100% of `"Dome time"` as unbilled with **zero warning** (`F-T2-4`). Also, a Rep team with no active season cannot be billed even if the club's fiscal year is open. | **Blocking** | **OBSERVED**: `lib/club-money-words.ts:671-675`, `docs/projects/active/CLUB_TIER_STAGE13_JOURNEYS_HUB.html` (`F-T2-4`). |
| **E2. Rep Coach runs team book (dues, fundraising, expenses, club bills)** | `app/[orgSlug]/coaches/teams/[teamId]/accounting/page.tsx:442-555` | Very little — the single `+ Record` button uses plain-English choices (`"A family paid their dues"`, `"We paid for something"`, `"We settled up with the club"`). However, coaches **cannot attach a receipt image/PDF** when submitting a payment request to the club (`F-T4-2`). | **Minor** | **OBSERVED**: `app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/panel.tsx:698-759`, `F-T4-2`. |
| **E3. Who sees what between Coach and Club** | `app/[orgSlug]/admin/accounting/teams/page.tsx`, `app/[orgSlug]/admin/rep-teams/page.tsx`, & `app/[orgSlug]/admin/families/page.tsx` | Two surprises: (1) `Rep teams` and `Accounting › Teams` show **different `Outstanding` numbers** for the same team when prior-year balances exist (`$3,900` vs `$3,300`, `F-O6-5`). (2) Despite lock notices promising coaches the club *"never sees your families' payments"*, `Club Admin › Families` shows every Rep child's exact dues, payments, and balance! | **Blocking** (trust & number mismatch) | **OBSERVED**: `lib/club-money-words.ts:604-610` vs. `lib/child-page.ts:142-170` & `lib/help-content/families.tsx:88-96`. |
| **E4. Club Treasurer checks where the club stands across all programs** | `app/[orgSlug]/admin/accounting/page.tsx:7-10` & `app/[orgSlug]/admin/house-league/seasons/[seasonId]/money/page.tsx` | That `Accounting › Overview` (`"Where the club stands"`) shows `Cash on hand` and `Owed by the teams` (Rep allocations), but **completely omits unpaid House League registration fees** (`Still owing` on the House League `Money` tab) and has no link to the House League `Money` page (`F-O6-8`, `F-T5-1`). | **Blocking** | **OBSERVED**: `app/[orgSlug]/admin/accounting/page.tsx:1-542` vs. `lib/help-content/house-league.tsx:67`. |
| **E5. Parent hands the club one cheque for a Rep child + House League child** | `lib/help-content/families.tsx:248-300` | That the House League half records immediately, while the Rep half **cannot be recorded by the club** — it sends a `"Sent to coach"` handoff banner to the Rep head coach's Money page waiting for the coach to click `Record it`. And if the admin recording it *is* that team's head coach, the modal blocks the line! | **Minor** to **Blocking** | **OBSERVED**: `lib/help-content/families.tsx:248-300`, `app/[orgSlug]/coaches/teams/[teamId]/accounting/page.tsx:515`. |
| **E6. Monthly Bank Reconciliation ("The Balance Check")** | `components/admin/kit/club/money/bank/BankTab.tsx:1-224` & `components/coaches/bank/CoachBankView.tsx:1-203` | On the club side, the Treasurer must first enter a starting statement (`"Start checking the club's bank account"`), and then compares `The bank says` vs `Should be in the bank` (which automatically adjusts for Stripe payouts in transit and prints a 1-page board sign-off sheet). On the coach side, it starts automatically from the season's opening balance and adds `"Cash not deposited yet"`. | **None** | **OBSERVED**: `components/admin/kit/club/money/bank/BankTab.tsx:1-224`, `components/coaches/bank/CoachBankView.tsx:1-203`. |

---

### Journey F: The Public Website — What the Club Publishes and How It Stays Current

| Step | Where It Happens | What the User Must Already Know | Friction | Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **F1. Customize look, sections, and content** | `app/[orgSlug]/admin/public-site/page.tsx:558-742` | Almost nothing — split-screen editor with live preview (`≥1200px`), auto-extracted logo colours, section reordering, and `"N of 4 ready"` banner. | **None** | **OBSERVED**: `app/[orgSlug]/admin/public-site/page.tsx:498-742`. |
| **F2. Automatic updates from programs** | `components/public/ClubSiteHome.tsx:26-223`, `app/[orgSlug]/tryouts/page.tsx:34-143`, `app/[orgSlug]/tournaments/page.tsx:32-179` | Empty sections hide automatically (`"never a 'check back soon'"`). Open registrations and tryouts automatically surface in `"Open now"` ordered by nearest deadline; finished tryouts drop off after 28 days; finished tournaments move to `"Past tournaments"` after 30 days. | **None** | **OBSERVED**: `components/public/ClubSiteHome.tsx:26-170`, `lib/club-site-home.ts:16-127`. |
| **F3. Keeping House League schedules & standings current on the public site** | `app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx:1389-1399` & `app/[orgSlug]/league/[seasonSlug]/schedule/page.tsx` | Two things: (1) After `"Publish schedule"`, later game edits stay invisible to the public until the admin clicks `"Changes to send"`. (2) The public season schedule page (`/[orgSlug]/league/[seasonSlug]/schedule`) shows **games only** — a parent must click into their specific team (`/[orgSlug]/league/[seasonSlug]/team/[teamId]`) to see practices! | **Minor** | **OBSERVED**: `lib/help-content/house-league.tsx:693`, `app/[orgSlug]/league/[seasonSlug]/schedule/page.tsx` vs. `app/[orgSlug]/league/[seasonSlug]/team/[teamId]/page.tsx:78-167`. |
| **F4. Visitor goes to `/[orgSlug]/schedule`** | `app/[orgSlug]/schedule/page.tsx:1-5` | That there is no public club master schedule; visiting `/[orgSlug]/schedule` silently redirects to `/[orgSlug]/teams` (the Rep teams directory). | **Minor** | **OBSERVED**: `app/[orgSlug]/schedule/page.tsx:1-5`. |

---

### Journey G: End of Season — Closing, Rolling Forward, and Next Season's Tryouts & Registration

| Step | Where It Happens | What the User Must Already Know | Friction | Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **G1. Close or roll forward Rep Teams** | `app/[orgSlug]/admin/rep-teams/teams/[teamId]/page.tsx`, `components/admin/kit/club/SeasonDialogs.tsx`, `components/coaches/StartNextSeasonModal.tsx:55-574` | Three major constraints: (1) On a Club plan, **only the Club Owner/Admin** can close or start a Rep team's next season (coaches have no button). (2) There is **no batch rollover** — 15 Rep teams means running `"Start next season"` 15 separate times. (3) **You cannot open next year's spring tryout sign-ups without closing the current season first**, which immediately collapses the coach's live portal into `"Season's End"`. | **Blocking** (when spring tryouts overlap the current season) | **OBSERVED**: `lib/help-content/rep-teams.tsx:24`, `:123-130`, `:171` (*"To take sign-ups for next year, start the next season first"*). |
| **G2. Complete & roll forward a House League season** | `components/admin/kit/club/league/SeasonStatusWindow.tsx:21-110` & `components/admin/kit/club/CreateLeagueSeasonDialog.tsx:308-409` | Unlike Rep teams, House League's `"Start from"` **can** be run while the current season is still active! If run after the old season is marked `Finished`, it shifts all 5 dates forward by 52 weeks (same weekday) and shifts birth years +1. However, **club permit time from `Schedules` is never copied** — an Owner/Admin must re-allocate time in `Schedules`. Also, 30 days after a season finishes, the House League coach's team page disappears. | **Minor** | **OBSERVED**: `lib/house-league-start-from.ts:24-158`, `lib/help-content/house-league.tsx:128-158`, `:524`. |
| **G3. Close the Club Fiscal Year** | `components/admin/kit/club/money/FiscalYearParts.tsx` | From the day after the fiscal year ends, `"Close 2025–26"` locks that year's budget and ledger lines, carries the closing cash into the next year's opening balance, and keeps unpaid team allocations and uncleared cheques in a `"Still open"` list. | **None** | **OBSERVED**: `lib/help-content/accounting.tsx:824-875`. |

---

### Journey H: A Parent Opening the Product with a Child on Both a House-League Team and a Rep Team

| Step | Where It Happens | What the User Must Already Know | Friction | Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **H1. Sign in and look for both children's teams** | `components/consumer/FollowingList.tsx:218-238` (`"Your teams"`) & `lib/user-contexts.ts:696-698` (`"Following"`) | That **House League teams never appear in `/following` or under any signed-in account**. Only the Rep team appears (under `"Your teams"` inside `"Following"`), and only after the Rep coach manually entered the parent's email on the roster and the parent clicked `/family/claim/[token]`. | **Blocking** | **OBSERVED**: `components/consumer/FollowingList.tsx:155-238`, `docs/projects/active/SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md:195-214` (Stage 4 unbuilt). |
| **H2. Open the Rep child's family page** | `app/(consumer)/family/teams/[teamId]/FamilyTeamClient.tsx:60-248` | First, `GUARDIAN_TIER_ENABLED` is currently `false` in `lib/family-guardian-view.ts:3-18`, so the guardian tier is turned off in code. Second, even when turned on, `GuardianPayload` (`lib/family-guardian-view.ts:20-25`) **excludes all player dues, payments, attendance/RSVPs, and medical notes** — the parent sees `$0` / nothing about what they owe the Rep team. | **Blocking** | **OBSERVED**: `lib/family-guardian-view.ts:3-25` (*"structurally EXCLUDED... dues and fees"*). |
| **H3. Check the House League child's registration, fee, and schedule** | Emailed link `app/[orgSlug]/league/[seasonSlug]/status/[token]/YourSignup.tsx` & public page `app/[orgSlug]/league/[seasonSlug]/team/[teamId]/page.tsx` | The parent must find their emailed magic link (`"Your sign-up"`) or re-request it by email to see their registration status and pay online; and must visit the public club website to see their House League child's schedule. | **Blocking** (two totally different worlds) | **OBSERVED**: `app/[orgSlug]/league/[seasonSlug]/status/[token]/YourSignup.tsx:158-289`, `app/my/registrations/page.tsx:1-15` (redirects to `/discover`). |
| **H4. View a combined family schedule for Saturday** | Nowhere in the app | There is **no combined family calendar** in the app. The parent must subscribe to two separate `.ics` calendar feeds in an external calendar app (Apple/Google Calendar). | **Blocking** | **OBSERVED**: `app/(consumer)/family/teams/[teamId]/FamilyTeamClient.tsx:157-248` vs. `app/[orgSlug]/league/[seasonSlug]/team/[teamId]/page.tsx:78-167`. |

---

## 4. Overlap Table

| Place A | Place B | How They Overlap or Collide | What a Newcomer Would Likely Do Wrong |
| :--- | :--- | :--- | :--- |
| **`Club Admin › Calendar`** (`app/[orgSlug]/admin/calendar/page.tsx`) | **`Club Admin › Schedules`** (`app/[orgSlug]/admin/schedules/page.tsx`) | Both sit at the top of the Club Admin sidebar. `Calendar` is a read-only master view of games and practices; `Schedules` is a permit-slot allocator that generates Rep practices and House League time blocks. | Click `Schedules` expecting to see or edit game schedules, or click `Calendar` on a rainy Saturday expecting to cancel or move games. |
| **`Club Admin › Schedules › Bill teams`** (`app/[orgSlug]/admin/schedules/[scheduleId]/page.tsx:433`) | **`Club Admin › Accounting › Allocations`** (`app/[orgSlug]/admin/accounting/allocations/page.tsx`) | Both create cost allocations charging Rep teams against a club budget line (such as `"Dome time"`). `Schedules` holds a draft bill in its `"Fair shares"` view without reserving that amount in `Allocations`. | The Owner creates a dome schedule with a draft bill in `Schedules`, and the Treasurer opens `Allocations`, sees `"Dome time"` as 100% unallocated, and bills the Rep teams a second time (`F-T2-4`). |
| **`Club Admin › Schedules`** (Rep practice rotation) | **`House league › Schedule › Tools ⋯ › Practice time`** (`lib/league-practice-time.ts:25`) & **`Coaches Portal › Schedule`** | Three separate practice-creation engines with different rules. `Schedules` creates locked practices on Rep teams; `Practice time` slices division blocks into House League practices; `Coaches Portal` creates unlocked coach practices. | A Rep coach tries to move a club-assigned practice on their schedule and is blocked (`"Only the club can move or remove this practice"`), or books their own practice on top of a House League game because the clash check only warns in amber. |
| **`Organization › Venue library`** (`org_venues`) | **`Coaches Portal › Manage saved places`** (`rep_team_places`) & **`Tournament › Venues`** (`diamonds`) | Three separate places to save a field/diamond. Only `org_venues` (and tournament venues explicitly imported from it) are checked for clashes. | A coach adds `"Centennial Park Diamond 1"` under `"Your places"` (or a tournament director clicks `+ New venue` instead of `From venue library`), completely bypassing club clash detection. |
| **`House league › [Season] › Money`** (`app/[orgSlug]/admin/house-league/seasons/[seasonId]/money/page.tsx`) | **`Accounting › Overview`** & **`Accounting › Ledger`** (`app/[orgSlug]/admin/accounting/ledger/page.tsx`) | House League has its own `Money` tab showing registration receivables (`Owed`, `Received`, `Still owing`) AND an auto-created `house_league` book in `Accounting › Ledger`, but `Accounting › Overview` ignores unpaid House League fees. | The Treasurer checks `Accounting › Overview` (`"Where the club stands"`) and believes all receivables are accounted for, missing thousands of dollars in unpaid House League registrations (`F-O6-8`). |
| **`Rep teams`** (`Outstanding` column, `app/[orgSlug]/admin/rep-teams/page.tsx`) | **`Accounting › Teams`** (`Outstanding` column, `app/[orgSlug]/admin/accounting/teams/page.tsx`) | Both tables list the club's Rep teams with a column named `"Outstanding"`. `Rep teams` folds prior-fiscal-year overdue bills into the main number; `Accounting › Teams` puts only the current fiscal year in the main number and prior years in a sub-line. | The Club President (`Rep teams`) and the Treasurer (`Accounting › Teams`) look at the `"Outstanding"` column for the exact same team at a board meeting and read two different dollar figures (`$3,900` vs `$3,300`, `F-O6-5`). |
| **`Club Admin › Families`** (`Record a payment`, `app/[orgSlug]/admin/families/page.tsx`) | **`Coaches Portal › Money › Player dues`** & **`House league › Registrations`** | All three record family payments, and `Families` displays both Rep dues and House League fees side by side, even though Rep team books belong to the coach. | A Club Admin opens `Families` and sees every Rep family's individual dues and balance (violating the privacy notice shown to coaches), then tries to record a parent's cheque and discovers the Rep half only sends a message to the coach. |
| **`Rep teams › [Team] › Tryouts`** (Club Admin) | **`Coaches Portal › Tryouts`** (Rep Coach) | Both screens edit the same tryout applicants, offers, and roster additions for a Rep team. | Neither the Club Admin nor the Coach realizes that clicking `"Extend offer"`, `"Waitlist"`, or `"Decline"` **never sends an email to the family** (unlike House League, where every button emails the family automatically). |

---

## 5. Findings (Most Severe First)

### F-01: The "Signed-In Family App" does not exist for House League, and is disabled / stripped of money and RSVPs for Rep teams
- **Who is affected**: Parents/guardians (especially multi-child families in Journey H), Club Admins, Rep Coaches.
- **Evidence**:
  - **OBSERVED** (`docs/projects/active/SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md:195-214`, `docs/agents/strategy/PLAN_PRICING_FACTS.md:126`): Stage 4 (inviting House League parents to a signed-in account and turning on the Rep guardian tier) is marked not built.
  - **OBSERVED** (`lib/family-guardian.ts:16`, `lib/family-guardian-view.ts:3-25`): `GUARDIAN_TIER_ENABLED = false` in code, and lines 20–25 state that `GuardianPayload` *"structurally EXCLUDE[S] — not filtered, absent from the shape: medical notes, admin notes, dues and fees"*.
  - **OBSERVED** (`app/[orgSlug]/league/[seasonSlug]/status/[token]/YourSignup.tsx:14-22`, `components/consumer/FollowingList.tsx:155-238`): House League families rely entirely on a no-login emailed token link (`"Your sign-up"`) and never appear under `/following` (`"Your teams"`).
- **Why it confuses people**: A parent with one child in House League and one on a Rep team lives in two incompatible worlds: for House League they use an emailed no-login link where they *can* pay online, while for Rep they sign into `/following` → `/family/teams/[teamId]` where they see **nothing** about what dues they owe and cannot RSVP.
- **Suggested direction**: Finish and enable the unified signed-in family view so a signed-in parent sees all of their children (Rep and House League), a combined family schedule, and read/pay access to their own child's dues and fees in one place.
- **Effort**: Large | **Confidence**: High

---

### F-02: City permits are hidden inside `Organization › Venue library`, scoped by Fiscal Year, and silently strand games and practices when edited
- **Who is affected**: Club Admin, League Admin, Rep Coaches.
- **Evidence**:
  - **OBSERVED** (`lib/admin-kit-nav.ts:323`, `app/[orgSlug]/admin/org/venues/page.tsx:98-99`, `:376-419`): `Venue library` is a tab inside `Organization` (alongside `Members`, `Audit log`, and `Settings`), and `Permits` is a secondary switch inside `Venue library` that requires an open `Fiscal year` in `Accounting`.
  - **OBSERVED** (`docs/projects/active/CLUB_TIER_STAGE13_JOURNEYS_HUB.html` `F-O6-3`, `F-A4-3`, `F-A4-4`): Adding a `"Date off"` to a permit when the city pulls a field saves immediately with zero warning that Rep practices or House League games are already scheduled on that date, and a permit's `Dates off` list does not sync with the club schedule's `Dates off` list.
- **Why it confuses people**: No volunteer looking to enter city field permits checks `Organization` (where board members and PDF settings live). Worse, when the city cancels a date on a permit and the admin records that blackout on the permit, existing practices and games stay on the calendar as if the field were still open.
- **Suggested direction**: Move `Venues & permits` adjacent to `Schedules` / `Calendar` (or surface a direct door from `Schedules`), and whenever a permit's dates or hours shrink, warn the admin of any existing bookings on those dates and offer to cancel or flag them.
- **Effort**: Medium | **Confidence**: High

---

### F-03: `Calendar` vs. `Schedules` in the top sidebar — and hidden generators in House League `Tools ⋯` — obscure how scheduling works
- **Who is affected**: Club Admin, League Admin.
- **Evidence**:
  - **OBSERVED** (`lib/admin-kit-nav.ts:246-277`): `Calendar` and `Schedules` sit one above the other at the top of the Club Admin sidebar. `Schedules` is hidden from `league_admin`.
  - **OBSERVED** (`app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx:1185-1307`, `lib/help-content/house-league.tsx:625-656`): On the House League `Schedule` tab, the primary button is `+ Add` (single manual game/practice), while `House league's time`, `Practice time`, and `Generate games` are buried inside `Tools ⋯`. If a division has <2 teams or ≥1 existing game, it disappears from `Generate games` without explanation; if the club hasn't sent time from `Schedules`, `Generate games` refuses to run; and `"Publish schedule"` is hidden until teams are published on `Teams & draft`.
  - **OBSERVED** (`app/[orgSlug]/admin/schedules/[scheduleId]/page.tsx:85-705`, `F-O2-8`, `F-O3-7`, `F-L4-1`): Sending time to House League in `Schedules` sends no notification to the League Admin; inside `Schedules`, `"Fair shares"` is hidden under a `View` dropdown rather than the 5-step bar.
- **Why it confuses people**: First-time admins cannot tell the difference between `Calendar` and `Schedules` from their names. Then, when the League Admin opens House League `Schedule`, the workflow they actually need (`House league's time` → `Practice time` / `Generate games` → `Publish schedule`) is hidden in an overflow menu with silent prerequisites.
- **Suggested direction**: Rename `Schedules` to reflect what it does (e.g., `Field & ice allocation` or `Permit schedules`), notify the League Admin when time is assigned to House League, and promote the House League schedule setup sequence out of `Tools ⋯` with explicit inline explanations when a step or division is locked.
- **Effort**: Medium | **Confidence**: High

---

### F-04: Calling off a rained-out day requires visiting three modules, and House League's `Rainout` button leaves practices on the rained-out field
- **Who is affected**: Club Admin, League Admin, Rep Coaches, Parents.
- **Evidence**:
  - **OBSERVED** (`app/[orgSlug]/admin/calendar/page.tsx:32`): `Calendar` is strictly read-only (`"NOTHING HERE WRITES"`).
  - **OBSERVED** (`app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx:1402-1545`, `lib/help-content/house-league.tsx:583`): Clicking `Rainout` on the House League schedule cancels or postpones `league_games` on that date/venue, but explicitly states: *"Practices are not moved by Rainout — edit or delete a practice from its row."*
- **Why it confuses people**: When the city closes Centennial Park on a rainy Saturday morning, a club admin expects one place to call off Centennial Park for the day. Instead, `Calendar` has no actions, `House league › Schedule › Rainout` cancels the games on Centennial Park while leaving House League practices on the same wet diamonds, club-allocated Rep practices must be pulled in `Schedules`, and Rep games must be cancelled by individual coaches.
- **Suggested direction**: Include House League practices (as an option or by default) inside the House League `Rainout` modal, and add a club-level `"Close venue for the day"` action on `Calendar` / `Schedules` that cancels or flags all club practices and House League events on that venue/date.
- **Effort**: Medium | **Confidence**: High

---

### F-05: Four separate venue tiers and an amber-only cross-program clash check allow Rep coaches and tournaments to double-book fields
- **Who is affected**: Club Admin, League Admin, Rep Coaches, Tournament Organizer.
- **Evidence**:
  - **OBSERVED** (`components/venue/WhereField.tsx:18-38`, `lib/venue-clash.ts:13-31`, `:206-208`): Clash detection only checks events tied to `org_venue_facilities` (`"● Club venue"`). Events saved under a Rep coach's `"● Your place"` (`rep_team_places`), free-text locations (including the free League plan's `GenerateModal` in `app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx:314-322`), or tournament venues created via `+ New venue` (`app/[orgSlug]/admin/tournaments/venues/page.tsx:182` where `source_org_facility_id` is `null`) are never checked for clashes.
  - **OBSERVED** (`lib/venue-clash.ts:13-14`, `components/coaches/ScheduleEventForm.tsx:548-583`): Even on a shared `"● Club venue"`, two House League events block in red, whereas a Rep coach booking on top of a House League game (or vice versa) only shows an amber box and **lets the user save the double-booking**.
  - **OBSERVED** (`docs/projects/active/CLUB_TIER_STAGE13_JOURNEYS_HUB.html` `F-L4-4`): Editing a single House League game by hand to a time when one of the two teams is already playing another game gives no team double-booking warning in the edit modal.
- **Why it confuses people**: Two teams show up at Diamond 1 at 6:00 p.m. on Tuesday because a coach either ignored an amber warning or picked `"Centennial Park"` from `"Your places"` instead of `"Club venues"`.
- **Suggested direction**: Auto-link tournament venues created inside a club to `org_venues`, warn clearly (or require confirmation) before a coach saves an amber cross-program clash on a club venue, and check single-game edits for same-team time overlaps.
- **Effort**: Medium | **Confidence**: High

---

### F-06: Rep Teams and House League use opposite coach invite flows and opposite coaching destinations with no explanation
- **Who is affected**: Club Admin, Registrar, Rep Coaches, House League Coaches.
- **Evidence**:
  - **OBSERVED** (`app/[orgSlug]/admin/house-league/seasons/[seasonId]/teams/TeamWindow.tsx:174-280`, `lib/house-league-coach-invites.ts:13-15`): Adding a House League coach requires First name, Last name, and Email; **does not send an email** until the division's teams are published (`"Invited when you publish"`); and lands the coach on a public club website page (`/{orgSlug}/league/{seasonSlug}/team/{teamId}`) that disappears 30 days after the season ends (`lib/help-content/house-league.tsx:524`).
  - **OBSERVED** (`components/admin/kit/club/CoachDialogs.tsx:49-121`, `app/(consumer)/auth/accept-assistant-invite/page.tsx:73`): Inviting a Rep coach takes **Email only (no name field)**, sends the email **immediately**, and lands the coach in the 14-page Premium Coaches Portal (`/{orgSlug}/coaches/teams/{teamId}`).
- **Why it confuses people**: A club admin who adds 16 House League coaches in `Teams & draft` wonders why none of them got an email (because teams aren't published yet), while a coach who coaches both a House League team and a Rep team lands in the full Coaches Portal for one team and on a public web page for the other.
- **Suggested direction**: Add optional First/Last name fields to the Rep coach invite dialog so pending invites have human names, and make the `"Invited when you publish"` rule on House League teams prominent at the moment the admin clicks `Save` in `TeamWindow`.
- **Effort**: Small | **Confidence**: High

---

### F-07: Rep Tryouts never email families on offers/waitlist/cuts, and Rep Teams have no online payment for tryout fees or player dues
- **Who is affected**: Club Admin, Rep Coaches, Rep Parents.
- **Evidence**:
  - **OBSERVED** (`components/admin/kit/club/TryoutDialogs.tsx:14-15`, `app/[orgSlug]/admin/rep-teams/teams/[teamId]/tryouts/page.tsx:509-510`): Tryout applicant dialogs state *"Accepting adds a player to the {season.name} roster; nothing is emailed."* No emails are sent for `Extend offer`, `Waitlist`, `Add to roster`, or `Decline`.
  - **OBSERVED** (`components/rep-teams/TryoutRegisterForm.tsx:171-380`, `app/[orgSlug]/coaches/teams/[teamId]/accounting/dues/panel.tsx:126-173`): Unlike House League (`components/public/LeaguePayBlock.tsx`), neither Rep tryout applications nor Rep player dues support online Stripe payment.
  - **OBSERVED** (`app/[orgSlug]/admin/house-league/seasons/[seasonId]/registrations/RegistrationsScreen.tsx`, `lib/help-content/house-league.tsx:1327`): In contrast, clicking a single row's `Approve` button in House League **immediately sends an email to the family without a confirmation dialog**.
- **Why it confuses people**: In House League, clicking `Approve` emails the parent immediately without asking; in Rep Tryouts, clicking `Extend offer` or `Add to roster` emails nobody at all. Admins who learn one module will make the wrong assumption in the other.
- **Suggested direction**: Add a confirmation step (or explicit `"Approves & emails family"` label) to single-row House League `Approve`, and offer an optional `"Email offer / decision to family"` action in Rep Tryouts so coaches don't have to copy-paste parent emails into Gmail.
- **Effort**: Medium | **Confidence**: High

---

### F-08: `Club Admin › Families` exposes every Rep family's individual dues, payments, and balances — directly contradicting the privacy promise shown to coaches
- **Who is affected**: Rep Coaches, Club Admin, Treasurer, Club Owner.
- **Evidence**:
  - **OBSERVED** (`lib/club-money-words.ts:582`, `:604`, `:609-610`, `lib/help-content/rep-teams.tsx:23-24`): Lock notices on `Rep teams › [Team]`, `Accounting › Teams › [Team]`, and `Coaches Portal › Money › Club` explicitly tell coaches: *"The club sees: Cash on hand (one figure)... Never your families' payments"*.
  - **OBSERVED** (`lib/child-page.ts:142`, `:168-170`, `lib/child-page-words.ts:171-225`, `lib/help-content/families.tsx:88-96`, `:188-197`): In `Club Admin › Families` and on every child's page (`/[orgSlug]/admin/families/children/[childId]`), any club operator with `Families` access sees every Rep player's exact `Dues`, `Paid`, `Balance`, `Fundraising` credit, `Other credits`, `Handed back` payout, and `Chased` reminder date.
- **Why it confuses people**: This is a direct contradiction between the product's copy and its behavior. A Rep coach who is promised that the club never sees individual family dues or fundraising credits will lose trust the moment a board member mentions a Rep family's unpaid dues balance from `Families`.
- **Suggested direction**: Either hide per-family Rep dues figures in `Club Admin › Families` (showing only that the child is on the Rep roster) to honour Settled Decision #5, or update the lock notices in `Accounting`, `Rep teams`, and `Coaches Portal` to state honestly that `Families` shows household balances across the club.
- **Effort**: Small | **Confidence**: High

---

### F-09: `Accounting › Overview` omits unpaid House League registration fees and gives the Treasurer no link to House League `Money`
- **Who is affected**: Club Treasurer, Club Owner, Club Admin.
- **Evidence**:
  - **OBSERVED** (`app/[orgSlug]/admin/accounting/page.tsx:7-10`, `:240-542`): `Accounting › Overview` (`"Where the club stands"`) displays `Cash on hand`, `Owed by the teams` (Rep team allocations), and `Waiting on you` (Rep payment requests), plus `"How the books stand"` (`Money in`, `Money out`, `Net` for collected transactions). Unpaid House League registration fees (`Still owing` on `app/[orgSlug]/admin/house-league/seasons/[seasonId]/money/page.tsx`) do not appear anywhere on `Accounting › Overview`.
  - **OBSERVED** (`lib/help-content/house-league.tsx:67` vs. `lib/admin-kit-nav.ts:198-212`): Help states *"Treasurer — reads a season's Money page, through the club's Accounting"*, but there is no link from `Accounting` to `House league › [Season] › Money` (`F-O6-8`, `F-T5-1`, `F-T5-7`).
- **Why it confuses people**: In a minor-sports club, House League registration fees are often the largest single source of club revenue. A Treasurer looking at `"Where the club stands"` sees what Rep teams owe the club, but sees $0 for the $15,000 in unpaid House League registrations still owed by parents, and cannot click from the House League book row in `Accounting` to the season's `Money` page.
- **Suggested direction**: Surface unpaid House League registration receivables (`Still owing`) on `Accounting › Overview` alongside `Owed by the teams`, and link the House League book row in `Accounting › Overview` / `Ledger` directly to `House league › [Season] › Money`.
- **Effort**: Small | **Confidence**: High

---

### F-10: `Schedules` and `Accounting › Allocations` can double-bill Rep teams for the same budget line, and `Rep teams` vs. `Accounting › Teams` show different `Outstanding` totals
- **Who is affected**: Club Treasurer, Club Owner, Rep Coaches.
- **Evidence**:
  - **OBSERVED** (`app/[orgSlug]/admin/schedules/[scheduleId]/page.tsx:433`, `app/[orgSlug]/admin/accounting/allocations/page.tsx`, `docs/projects/active/CLUB_TIER_STAGE13_JOURNEYS_HUB.html` `F-T2-4`): When a schedule in `Schedules` has a draft bill against a club budget line (e.g., `$27,000` on `"Dome time"`), opening `Accounting › Allocations › New allocation` still shows `"Dome time · $27,000 left to bill"` with zero warning that a draft schedule is already billing that line.
  - **OBSERVED** (`app/[orgSlug]/admin/rep-teams/page.tsx` vs. `app/[orgSlug]/admin/accounting/teams/page.tsx`, `F-O6-5`): On `Rep teams`, the `Outstanding` column adds prior fiscal-year overdue amounts into the primary figure (`$3,900`), while on `Accounting › Teams`, the `Outstanding` column shows only the current fiscal year (`$3,300`) with prior-year overdue amounts in a sub-line, causing both the per-team figures and the club totals (`$10,950` vs `$9,750`) to disagree.
- **Why it confuses people**: When the President and the Treasurer split duties, the Treasurer can accidentally bill Rep teams twice for dome time, and when they compare the `Outstanding` column on `Rep teams` vs `Accounting › Teams`, the numbers don't match.
- **Suggested direction**: Show draft schedule bills on the budget line in `Accounting › Allocations` before the Treasurer creates a manual allocation, and use the exact same `Outstanding` calculation on both `Rep teams` and `Accounting › Teams`.
- **Effort**: Small | **Confidence**: High

---

### F-11: The invited Club Admin is locked out of the Club Setup Checklist, and removing a board member who is also a parent deletes their family sign-in
- **Who is affected**: Club Admin (primary persona), Club Owner, Board Members who are parents.
- **Evidence**:
  - **OBSERVED** (`app/[orgSlug]/admin/onboarding/page.tsx:401-404`, `components/admin/kit/club/ClubHubKit.tsx:432-438`, `F-A1-4`): Non-owners (including a user with the `admin` role invited in Step 1 `"Staff your board"`) are redirected away from `/[orgSlug]/admin/onboarding` and are not shown the `"Setup: X of 5 steps done · Continue setup"` link on `Overview`.
  - **OBSERVED** (`docs/projects/active/CLUB_TIER_STAGE13_JOURNEYS_HUB.html` `F-A1-new` / Ask 23): Removing a board member in `Organization › Members` who is also a parent deletes their family sign-in.
- **Why it confuses people**: Step 1 of Club Setup tells the President: *"Invite an admin and a treasurer so the work isn't all yours."* Yet when that newly invited Admin signs in to set up the club, the setup checklist is completely hidden from them! And at the end of a board term, removing a volunteer from `Organization › Members` breaks their personal parent access.
- **Suggested direction**: Allow users with the `admin` role to view and complete `/[orgSlug]/admin/onboarding` and see the `"Continue setup"` link on `Overview`, and scope member removal in `Organization › Members` strictly to `organization_members` without touching family/guardian links.
- **Effort**: Small | **Confidence**: High

---

### F-12: Self-serve signup drops `Club` and `League Plus` and forces new organizations through a `"Run a tournament"` flow
- **Who is affected**: Prospective Club Owner / Admin (Journey A).
- **Evidence**:
  - **OBSERVED** (`lib/start-door.ts:39-41`, `app/(consumer)/start/StartDoorForm.tsx:109-262`): When `club` is ungated on `/pricing`, clicking `"Start your Club trial"` links to `/start/tournament?plan=club&billing=monthly`, where `runATournamentPick()` explicitly strips `club` and `league` and titles the screen `"Run a tournament — Free to start"`.
  - **OBSERVED** (`app/[orgSlug]/admin/onboarding/PlanStep.tsx:16`, `:39-138`): Step 3 of onboarding (`PlanStep.tsx`) only renders `Tournament Plus` and `Tournament` (Free), with a code comment at line 16: `"League Plus and Club are not here"`.
- **Why it confuses people**: As long as Club is consultative (`"Talk to us about Club"`), this is masked; the moment you flip the Club plan gate to `'live'` for self-serve signups, a club president clicking `"Start your Club trial"` is told they are starting a tournament and cannot select the Club plan at Step 3.
- **Suggested direction**: Before opening self-serve Club signups, wire `?plan=club` through `/start` and `PlanStep.tsx` (or route `/start/club` to its own account → org → Club checkout flow).
- **Effort**: Medium | **Confidence**: High

---

### F-13: Starting or rolling forward a season for 15 Rep teams requires 15 separate team-by-team dialogs, and spring tryouts cannot open while the current season is still playing
- **Who is affected**: Club Admin, Rep Coaches.
- **Evidence**:
  - **OBSERVED** (`app/[orgSlug]/admin/rep-teams/page.tsx`, `app/[orgSlug]/admin/rep-teams/teams/[teamId]/page.tsx:327-332`, `components/admin/kit/club/SeasonDialogs.tsx`): There is no bulk `"Start season"` or `"Roll forward selected teams"` action on `Rep teams`. Each team's season is started and rolled forward inside `/admin/rep-teams/teams/[teamId]`.
  - **OBSERVED** (`lib/help-content/rep-teams.tsx:171`, `lib/season-roll-path.ts:153-155`): Help states: *"A team's tryouts belong to its live season. To take sign-ups for next year, start the next season first."* And starting the next season immediately **closes the current season** (`"This closes the 2025–26 Season"`), collapsing the coach's live portal into `"Season's End"`.
- **Why it confuses people**: In Canadian minor hockey, baseball, and soccer, spring tryouts for *next* season frequently open while teams are still finishing playoffs or wrap-up tournaments for the *current* season. Forcing the club to close the current season (and lock the coach's live schedule and money tools) just to open next year's tryout sign-up form is a major operational blocker.
- **Suggested direction**: Allow a Rep team to open `"Next season's tryouts"` while its current season remains active (or let a draft next season coexist for tryouts before closing the current season), and add a multi-team season start/rollover action on `Rep teams`.
- **Effort**: Large | **Confidence**: High

---

### F-14: In `Club Admin › Families`, an admin cannot add a missing parent email to a Rep player — they can only click `"Ask the coaches"`
- **Who is affected**: Club Admin, Registrar, Rep Coaches.
- **Evidence**:
  - **OBSERVED** (`components/admin/kit/club/families/FamiliesBook.tsx:25-27`, `:174`, `lib/help-content/families.tsx:105-135`): When a Rep child has no guardian on file, `Families` defaults to the `"No family on file"` filter. The Club Admin cannot type in the parent's email themselves; their only action is `"Ask the coaches"` (`CoachAskWindow`), which emails the Rep head coach asking the coach to enter it in `Coaches Portal › Roster`.
- **Why it confuses people**: The club registrar often has the parent's email right in front of them (or the parent is on the phone with the club). Forcing the registrar to send an email to a volunteer coach and wait for the coach to log in and type an email address feels needlessly bureaucratic.
- **Suggested direction**: Allow a Club Owner/Admin with `Families` access to add or edit a guardian contact on a Rep roster player directly from `Families › No family on file`.
- **Effort**: Small | **Confidence**: High

---

### F-15: Recording a single cheque from a parent with both a House League child and a Rep child splits into half-recorded, half-"Sent to coach" (and blocks if the Admin is also the coach)
- **Who is affected**: Club Admin, Treasurer, Rep Head Coach (dual role).
- **Evidence**:
  - **OBSERVED** (`lib/help-content/families.tsx:248-300`, `app/[orgSlug]/coaches/teams/[teamId]/accounting/page.tsx:515`): In `Families › [Family] › Record a payment`, a payment line for a House League registration writes immediately (`Recorded`), while a payment line for a Rep child creates a hand-off (`Sent to coach`) that waits for the Rep head coach to click `Record it` on their Money page. Line 277 notes that if the admin using `Record a payment` happens to *be* that Rep team's head coach, the modal disables the Rep line and tells them to go to the Coaches Portal instead.
- **Why it confuses people**: If a parent hands the club treasurer a single $600 cheque at registration night ($200 House League + $400 Rep dues), the club is depositing that $600 cheque into the club's bank account, yet the system won't record the Rep half until the coach clicks a button in a different portal. And if the admin *is* the coach, the modal refuses to let them check the box right there.
- **Suggested direction**: If the signed-in admin is also that Rep team's head coach, record the Rep dues line directly without blocking; otherwise, explain clearly in the modal which bank account received the cheque and how the club transfers or credits those funds to the team.
- **Effort**: Small | **Confidence**: High

---

### F-16: Treasurers, League Admins, and Registrars who also coach a Rep team have no `"Admin"` return door in the Coaches Portal sidebar
- **Who is affected**: Head Coach of a Rep team who is also a Club Treasurer, League Admin, or Registrar.
- **Evidence**:
  - **OBSERVED** (`components/coaches/CoachesSidebar.tsx:525-538`, `docs/projects/active/CLUB_TIER_STAGE13_JOURNEYS_HUB.html` Tab 1): `AdminKitRail.tsx` shows `"Coaches Portal"` at the bottom of the sidebar for any club operator who coaches a team, but `CoachesSidebar.tsx` only shows `"Admin"` at the bottom of the Coaches Portal sidebar if `isOrgAdmin` (`owner` or `admin`). A `treasurer`, `league_admin`, or `league_registrar` gets a one-way door into the Coaches Portal and must use the top-right `"Workspaces ▾"` menu to get back.
- **Why it confuses people**: In small volunteer clubs, the Treasurer or House League Director almost always coaches one of the teams. Clicking `"Coaches Portal"` at the bottom-left of Admin and finding no matching `"Admin"` button in the same spot on the Coaches Portal feels broken.
- **Suggested direction**: Show the `"Admin"` footer link in `CoachesSidebar.tsx` for any user who holds an active operator role in `organization_members` (not just `owner` and `admin`).
- **Effort**: Small | **Confidence**: High

---

### F-17: Neither the Club Ledger nor Coach Payment Requests support attaching receipt photos or invoices
- **Who is affected**: Club Treasurer, Rep Coaches.
- **Evidence**:
  - **OBSERVED** (`app/[orgSlug]/admin/accounting/ledger/page.tsx`, `app/[orgSlug]/admin/accounting/payment-requests/page.tsx`, `docs/projects/active/CLUB_TIER_STAGE13_JOURNEYS_HUB.html` `F-T3-2`, `F-T4-2`): While a coach can attach a receipt to their own private team expense (`We paid for something`), a coach submitting a `Payment request` to the club (`Ask the club to pay a bill` / reimbursement) cannot attach the invoice or receipt image, and the Club Treasurer cannot attach receipts/invoices to `Accounting › Ledger` entries.
- **Why it confuses people**: No volunteer club treasurer will approve a $1,400 reimbursement request from a coach without seeing the invoice or receipt, forcing them right back to emailing PDFs outside the system.
- **Suggested direction**: Add file/photo attachment support to Coach `Payment requests` (visible to the Club Treasurer) and to Club `Ledger` entries.
- **Effort**: Medium | **Confidence**: High

---

### F-18: Clicking a Rep team event on `Club Admin › Calendar` navigates to a read-only schedule page with no way to resolve a clash
- **Who is affected**: Club Admin, Club Owner.
- **Evidence**:
  - **OBSERVED** (`lib/club-calendar-view.ts:154-191`, `app/[orgSlug]/admin/rep-teams/teams/[teamId]/schedule/page.tsx:59`): When a Club Admin turns on the amber `Clashes only` filter on `Calendar` and clicks a clashing Rep team row, it navigates to `/[orgSlug]/admin/rep-teams/teams/[teamId]/schedule`, which is also 100% read-only (*"{Team}'s coaches keep the schedule in their Coaches Portal; the club reads it here"*).
- **Why it confuses people**: The `Calendar` row has a clickable right-chevron implying you can go fix the clash. Clicking it drops the admin on a second read-only list where they cannot move the practice, message the coach about that event, or jump to `Schedules` (even if the practice came from `Schedules`!).
- **Suggested direction**: If a Rep practice on `Calendar` came from `Club Admin › Schedules`, link its chevron to that schedule in `Schedules`; if it is a coach-created event, provide a `"Note to coach"` action or a direct `"Open in Coaches Portal"` link when the viewer also coaches that team.
- **Effort**: Small | **Confidence**: High

---

### F-19: Opening `Club Admin › Calendar` on an empty week shows seven dashes (`—`) with no indication of when the next scheduled event occurs
- **Who is affected**: Club Admin, League Admin.
- **Evidence**:
  - **OBSERVED** (`app/[orgSlug]/admin/calendar/page.tsx:68-271`, `docs/projects/active/CLUB_TIER_STAGE13_JOURNEYS_HUB.html` `F-O6-12`): In `Week` or `List` view, if the current week has no games or practices (for example, in April before the May season starts), the page shows seven empty day rows with dashes (`—`), even when 200 games are scheduled starting three weeks later.
- **Why it confuses people**: An admin who just generated an entire season's schedule clicks `Calendar` to verify it, sees seven dashes on the current week, and thinks the schedule generator failed.
- **Suggested direction**: When the current view range on `Calendar` has zero events but future (or past) events exist, show a one-click banner: `"No bookings this week · Next booking is Sat May 2 →"`.
- **Effort**: Small | **Confidence**: High

---

### F-20: Public House League season schedule hides practices, and `/[orgSlug]/schedule` silently redirects to the Rep teams directory
- **Who is affected**: Parents, House League Coaches, Public Visitors.
- **Evidence**:
  - **OBSERVED** (`app/[orgSlug]/league/[seasonSlug]/schedule/page.tsx:1-222` vs. `app/[orgSlug]/league/[seasonSlug]/team/[teamId]/page.tsx:78-167`): The public House League season schedule page (`/[orgSlug]/league/[seasonSlug]/schedule`) renders **games only**. Practices only appear if the parent drills into a specific team page (`/[orgSlug]/league/[seasonSlug]/team/[teamId]`).
  - **OBSERVED** (`app/[orgSlug]/schedule/page.tsx:1-5`): Visiting `/[orgSlug]/schedule` immediately redirects to `/[orgSlug]/teams` (Rep teams).
- **Why it confuses people**: When a League Admin generates practices and clicks `"Tell the families"`, parents who go to the House League season page and click `Schedule` (even after filtering by their child's team!) see only games and think their team has no practices.
- **Suggested direction**: Include published `league_practices` on `/[orgSlug]/league/[seasonSlug]/schedule` (especially when filtered by division or team), or add a `Games | Practices | All` toggle on that page.
- **Effort**: Small | **Confidence**: High

---

### F-21: House League has no automated payment reminders (`Chased` reads `"Not tracked"`) and cannot record partial offline payments or partial manual refunds
- **Who is affected**: Registrar, League Admin, Treasurer.
- **Evidence**:
  - **OBSERVED** (`lib/help-content/families.tsx:94`): In `Club Admin › Families`, the `Chased` column help states: *"for a rep team, the date the coach last sent a dues reminder; a house-league fee reads Not tracked."*
  - **OBSERVED** (`lib/help-content/house-league.tsx:1411`, `:1479`, `docs/projects/active/CLUB_TIER_STAGE13_JOURNEYS_HUB.html` `F-R3-7`, `F-R4-2`): `Mark received` on a House League registration always marks the **entire fee** received (no amount box for a partial payment or KidSport/Jumpstart subsidy + parent balance), and `Mark refunded` on an offline payment records a full refund only (whereas online Stripe refunds allow partial amounts).
- **Why it confuses people**: In Canadian minor sports, split payments (e.g., half paid by Jumpstart/KidSport or a deposit e-Transfer, half paid by the parent) and pro-rated mid-season offline refunds are routine, and registrars spend weeks chasing unpaid House League fees.
- **Suggested direction**: Allow an editable dollar amount on offline `Mark received` and `Mark refunded` in House League, and add an `"Email unpaid families"` reminder action on `House league › Registrations` / `Money` that updates the `Chased` date in `Families`.
- **Effort**: Medium | **Confidence**: High

---

### F-22: Club Setup Checklist Step 4 says *"Add a tagline and a contact email"*, but marks the step complete when contact email is still blank
- **Who is affected**: Club Owner, Club Admin.
- **Evidence**:
  - **OBSERVED** (`components/admin/kit/club/ClubSetupKit.tsx:46` vs. `lib/club-checklist.ts:103`, `:128-133`): The UI prompt for Step 4 (`"Put your club online"`) instructs: *"Add a tagline and a contact email to your public page."* However, `publicSiteReady` in `lib/club-checklist.ts:103` checks only `(siteRes.data?.tagline ?? '').trim().length > 0` and ignores `contact_email`.
- **Why it confuses people**: An admin who types a tagline sees Step 4 tick green (`Done`) and assumes their public site has a contact email configured, leaving the public site's `"Questions?"` contact card without a club email.
- **Suggested direction**: Check both `tagline` and `contact_email` in `lib/club-checklist.ts` before marking Step 4 complete.
- **Effort**: Small | **Confidence**: High

---

### F-23: Club Admin `Overview` (`"This morning"`) shows only pending task counts and zero club-level pulse (players, teams, or cash)
- **Who is affected**: Club Owner, Club Admin.
- **Evidence**:
  - **OBSERVED** (`components/admin/kit/club/ClubHubKit.tsx:325-397`, `docs/projects/active/CLUB_TIER_STAGE13_JOURNEYS_HUB.html` `F-O6-1`): When no approvals or requests are queued, `"This morning"` says *"Nothing is waiting on you this morning"*, followed by static program door cards (`Rep teams`, `House league`, `Accounting`, `Families`, `Public site`).
- **Why it confuses people**: A club president opening `Overview` cannot see at a glance how many players are registered in House League, how many Rep teams are active, or the club's cash/outstanding position without clicking into three separate places.
- **Suggested direction**: Add a quiet one-line status summary inside each program card on `Overview` (e.g., `"12 teams · 2 tryouts open"` on `Rep teams`, `"Spring 2026 · 184 registered"` on `House league`, `"$42,100 cash · $3,300 owed"` on `Accounting`).
- **Effort**: Small | **Confidence**: High

---

## 6. What Works Well (Do Not Break These in a Fix)

1. **The House League Public Sign-Up Form (`components/league/RegisterForm.tsx`)**: Entering 1 to 8 children on one screen where typing each child's date of birth immediately forecasts the matching age division, remaining spots or waitlist position, and early-bird price is best-in-class.
2. **House League `Teams & draft` Board (`app/[orgSlug]/admin/house-league/seasons/[seasonId]/teams/TeamsScreen.tsx`)**: Automatic sibling detection (`Siblings` badge), 1–5 player ratings that auto-erase when the season completes, snake-draft auto-balance (`Balance teams`), and keeping drafted teams private until `"Publish teams"` solves a real pain point that volunteers usually do on sticky notes.
3. **House League Season `"Start from"` Rollover (`components/admin/kit/club/CreateLeagueSeasonDialog.tsx`, `lib/house-league-start-from.ts`)**: Shifting all five season dates forward by 52 weeks (so opening Saturday stays a Saturday), bumping division birth years +1, and badging copied checklist items with `"From {lastSeason}"` until edited is extraordinarily thoughtful.
4. **Rep Team Rollover's Two-Path Question (`components/coaches/StartNextSeasonModal.tsx`, `lib/season-roll-path.ts`)**: Asking *"What is the team doing next season?"* — `"The same players, moving up an age group"` (keeps birth years, increments `11U` → `12U`, ticks active players) vs. `"A new group of players, same age group"` (shifts birth years +1, starts with an empty roster) — models how minor-sports rep teams actually work.
5. **The Public Site Builder & Self-Cleaning Public Website (`app/[orgSlug]/admin/public-site/page.tsx`, `components/public/ClubSiteHome.tsx`)**: Auto-extracting brand colours from the uploaded club logo, pinning `"Open now"` by nearest deadline, auto-hiding empty sections (*"never a 'check back soon'"*), and automatically dropping finished tryouts after 28 days and finished tournaments after 30 days means a volunteer club's website never rots in the off-season.
6. **Batching Published Schedule Edits via `"Changes to send"` (`app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx:1394`)**: Letting a League Admin tweak six games without spamming parents six times, then diffing against the published snapshot and emailing only the affected divisions when ready, is a huge improvement over typical league software.
7. **Monthly Bank Balance Check (`components/admin/kit/club/money/bank/BankTab.tsx`, `components/coaches/bank/CoachBankView.tsx`)**: Avoiding full line-by-line CSV bank import in favour of a statement-date balance check (`The bank says` vs `Should be in the bank`, automatically accounting for uncleared cheques, Stripe payouts in transit, and coach cash-in-bag, plus a 1-page printable board sign-off sheet) is pitched at the exact right level for a volunteer treasurer.
8. **The Recent Left-Sidebar Places Refactor (`components/admin/kit/AdminKitRail.tsx`, `lib/admin-kit-nav.ts`)**: Putting only top-level places in the left rail and rendering sub-pages as a horizontal `HubTabBar` at the top of each place made the Club Admin navigation dramatically calmer and more predictable.

---

## 7. Challenges to a Settled Decision

Per the review rules, these are kept out of the 23 main findings above because they touch settled decisions, but the code shows each of them actively causes user confusion:

1. **Challenge to *"Everyone signs in. There are no no-login family shortcuts."***
   - **What the code actually does**: House League families have **zero signed-in experience** — they rely 100% on a no-login magic link (`/status/[token]`, `app/[orgSlug]/league/[seasonSlug]/status/[token]/YourSignup.tsx`), while Rep families are forced to sign in (`/family/teams/[teamId]`) to a view where `GUARDIAN_TIER_ENABLED` is `false` (`lib/family-guardian-view.ts:3`) and dues/fees are excluded. Right now, the product has the exact opposite of this settled decision for House League, and an incomplete signed-in experience for Rep.
2. **Challenge to *"A coach's finished season collapses to a single 'season end' page. Live tools disappear once a season is closed."***
   - **Why it hurts clubs**: Because a Rep team's tryouts belong to its live season (`lib/help-content/rep-teams.tsx:171`), a club that holds spring tryouts in April/May for *next* year while the *current* season is still finishing cannot open tryout sign-ups without starting the next season — which immediately closes the current season and takes away the coach's live schedule, practice plans, lineups, and money tools!
3. **Challenge to *"The club side says 'fiscal year' and the coaches side says 'season'. This is deliberate."***
   - **Where the seam leaks**: The two clocks collide on `Accounting › Teams › [Team]` (`app/[orgSlug]/admin/accounting/teams/[teamId]/page.tsx:271-274`, where the page header is a `Fiscal year` pill, but the statement table inside it groups rows by the team's `Season`), on `Accounting › Allocations` (`lib/club-money-words.ts:671-675`, where a Treasurer in an open fiscal year is blocked from billing a Rep team whose season hasn't started or just closed), and on `Rep teams` vs `Accounting › Teams` (where carry-over balances across fiscal years produce two different `Outstanding` numbers).
4. **Challenge to *"A coach's team books stay the team's. The club sees one cash figure per team, not the coach's detail."***
   - **Why it contradicts `Families`**: As documented in `F-08`, building `Club Admin › Families` (`lib/child-page.ts:142-170`) to show every Rep child's `Dues`, `Paid`, `Balance`, and `Fundraising` credits broke this rule in practice while leaving the old privacy promise on every screen in `Accounting` and the `Coaches Portal`. Furthermore, when a parent writes one cheque to the club for a House League child and a Rep child, this boundary prevents the club from recording the Rep half directly.
5. **Challenge to *"Unifying the club and tournament top navigation was considered and parked."***
   - **Why it disorients Club Admins**: In `components/admin/kit/AdminKitRail.tsx:130-131` (`:201-330`), every other place in the club (`Rep teams`, `House league`, `Accounting`, `Families`, `Organization`) keeps the club sidebar intact and uses horizontal tabs. Clicking into a tournament under `Tournaments` is the **only** action that wipes out the entire club sidebar (`Calendar`, `Schedules`, `Rep teams`, `House league`, `Accounting`, `Families` all vanish) and replaces it with 15 tournament items in 3 collapsible accordion groups until the user clicks `"Club overview"`.

---

## 8. Questions Only the Owner Can Answer

1. **Online payments for Rep Teams**: Should Rep families be able to pay tryout fees and player dues online via Stripe (and if so, does a club-connected Stripe account settle to the club's bank account and credit the team's allocation, or do Rep teams connect their own bank accounts), or is Rep money permanently offline-only?
2. **Who owns Rep family dues visibility (`Families` vs. `Coaches Portal`)?**: Do you want to keep individual Rep player dues visible in `Club Admin › Families` (and rewrite the privacy promises in `Accounting` and `Coaches Portal`), or hide Rep dues in `Families` so the coach's book is truly private?
3. **House League coaches' toolset**: Is the 1-page public team view (`/[orgSlug]/league/[seasonSlug]/team/[teamId]`) the permanent home for House League coaches, or should House League coaches eventually get a lightweight version of the Coaches Portal (e.g., attendance/lineups/practice plans)?
4. **Spring tryouts overlapping a live Rep season**: In Canadian clubs where next season's tryouts run before the current season's games and books are wrapped up, should a Rep team be able to open next year's tryout sign-ups without closing its current season first?
5. **Cross-program field clashes**: When a Rep coach tries to save a practice on a `"● Club venue"` at the exact time a House League game is already scheduled there, should the system continue to allow saving with an amber warning, or should it hard-block (as House League already does internally)?

---

## 9. What Could Not Be Assessed, and What Extra Material Would Let You

1. **Real-world email deliverability and rendered email layouts on mobile mail clients**: We inspected the email sender templates and triggers in code (such as `lib/house-league-coach-invite-mail.ts`), but could not assess how a parent's inbox threads multiple emails when they have three children across House League and Rep. *Extra material needed*: Rendered email captures or an inbox trace from a multi-child test run.
2. **Live Stripe Connect onboarding and payout failure states**: We traced the Stripe checkout and payout code paths (`LeaguePayBlock`, `Accounting › Payouts`, `BankTab` in-transit calculation), but could not observe what a volunteer treasurer sees inside Stripe's hosted onboarding or when a parent's PAD bank debit bounces 5 days after registration. *Extra material needed*: Stripe test-mode webhook logs or screenshots of failed/disputed payment states.
3. **Consultative onboarding script for Club**: Because `/start/club` currently routes to `"We set up Club with you directly"`, we could not assess what your team configures on a club's behalf before handing the keys to the volunteer president. *Extra material needed*: Your internal onboarding runbook or provisioning checklist for new Club customers.

