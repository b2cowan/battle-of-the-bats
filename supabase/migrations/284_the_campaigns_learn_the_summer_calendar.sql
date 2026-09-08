-- 284_the_campaigns_learn_the_summer_calendar.sql
--
-- CAMPAIGN RESEED  <- marker: tests/unit/marketing-campaign-registry.test.ts checks the
--                     HIGHEST-numbered migration carrying this line against the registry, so a
--                     later reseed takes over as the gate simply by carrying it too.
--
-- Founding Season 2027, Phase 1 (plan: docs/projects/active/FOUNDING_SEASON_2027_PLAN.md §3).
-- The free season now runs through September 30, 2027 for everyone who signs up by
-- December 31, 2026, but the LIVE campaign send-copy is the
-- platform_email_templates row (migration 179 seed, re-seeded by 198) and every one of those rows
-- still described the January 1, 2027 cliff. Campaigns render from the row unconditionally
-- (alwaysRenderFromTemplate), so a send would have contradicted every other surface in the app.
--
-- GENERATED, NEVER HAND-TYPED, by scripts/generate-campaign-reseed-migration.mjs from
-- lib/marketing-email-defaults.ts — the campaign registry, whose dates and prices are themselves
-- derived from lib/plan-config.ts. Pinned by tests/unit/marketing-campaign-registry.test.ts, which
-- fails the build if this file and the registry ever disagree (the "KEEP IN SYNC" comment on
-- migration 198 was an honour system; this is what replaces it).
--
-- Follows the migration-198 pattern: DATA-ONLY (no schema change) and every write is gated on
-- is_customised = false, so a saved operator override always wins.
--
-- ⚠ DATA-ONLY MIGRATIONS ARE INVISIBLE TO check:migrations — both drift checks compare SCHEMA, so
-- nothing can prove this ran on production. Record the prod apply in the release history.
--
-- WHAT CHANGES
--   · The live campaigns get the summer-2027 calendar. Every date and price reads from config.
--   · founding_renewal moves Nov 1, 2026 -> Jun 1, 2027 (the card window opens with it).
--   · founding_final  moves Dec 15, 2026 -> Sep 15, 2027.
--   · founding_nudge is NEW (Aug 1, 2027) — inserted here.
--   · spotlight_club / spotlight_league / spotlight_club_last are RETIRED: their description says
--     so, and the app no longer lists, previews, test-sends or sends them. Their BODIES ARE
--     DELIBERATELY UNTOUCHED so the copy survives for the day League or Club un-parks.
--   · No row is deleted. A data-only DELETE cannot be seen by any gate we have, which is how
--     migration 264 ended up stranded (CLAUDE.md).
--
-- A planned date moves only while it still holds a value a previous seed wrote (or is NULL) —
-- an operator who has picked their own date keeps it.


-- ── NEW: founding_nudge ──────────────────────────────────────────────────────────────
insert into platform_email_templates
  (key, label, description, subject, heading, body, variables, category, is_customised, planned_send_date, updated_at, updated_by)
values (
  $seed284$founding_nudge$seed284$,
  $seed284$Founding — Plan reminder$seed284$,
  $seed284$Sent two months before the free season ends. A short reminder for anyone who has not chosen a 2028 plan yet.$seed284$,
  $seed284$Still time to choose your 2028 plan$seed284$,
  $seed284$Still time to choose your 2028 plan.$seed284$,
  $seed284$Hi {{firstName}},

A short follow-up: **{{orgName}}**'s free season on Tournament Plus ends on **September 30, 2027**.

::if hasCard
Your payment method is on file, so there is nothing to do today. In September 2027 you'll pick annual or monthly, and that is the whole decision.
::else
Nothing has been charged, and nothing will be before **October 1, 2027**. If you already know you're continuing, adding a card now takes two minutes and takes it off your list:
::button Add a payment method → | {{billingUrl}}
::end

::callout What it costs from October 1, 2027
Tournament Plus is **$390/year** or **$39/month**. The year is one payment, in the month you're planning the season anyway.
::end

If Tournament Plus isn't right for 2028, there is nothing to cancel. **{{orgName}}** moves to the free Tournament plan and keeps everything it built.

— The FieldLogicHQ team$seed284$,
  $seed284$["firstName","orgName","hasCard","billingUrl"]$seed284$::jsonb,
  $seed284$marketing$seed284$,
  false,
  $seed284$2027-08-01$seed284$::date,
  now(),
  $seed284$migration-284$seed284$
)
on conflict (key) do nothing;


-- founding_welcome

update platform_email_templates set
  label = $seed284$Founding — Welcome$seed284$,
  description = $seed284$Sent to each new founding org owner at signup (transactional). Confirms free Tournament Plus through September 30, 2027.$seed284$,
  subject = $seed284$Your Founding Season starts now — free through September 30, 2027$seed284$,
  heading = $seed284$Your Founding Season starts now.$seed284$,
  body = $seed284$Hi {{firstName}},

You're in. **{{orgName}}** is set up on FieldLogicHQ, and **Tournament Plus is free through September 30, 2027** — your whole 2027 season. Normally $39/month. No credit card.

::callout What Tournament Plus gives you
- Auto-scheduling across any number of fields and time slots
- Single and double-elimination brackets
- Team communications and announcements
- As many tournaments as you run — no cap
- Tournament archives — every past event preserved
::end

::button Set up your first tournament → | {{setupUrl}}

In September 2027 you'll choose a plan for your 2028 season. Nothing is charged before then, and there is nothing to cancel.

If anything doesn't work the way you'd expect, reply to this email. We read everything.

— The FieldLogicHQ team$seed284$,
  variables = $seed284$["firstName","orgName","setupUrl"]$seed284$::jsonb,
  updated_at = now(),
  updated_by = $seed284$migration-284$seed284$
where key = $seed284$founding_welcome$seed284$
  and is_customised = false;

-- founding_checkin

update platform_email_templates set
  label = $seed284$Founding — Season Check-in$seed284$,
  description = $seed284$Sent ~60 days after signup. Celebrates activity so far and nudges another tournament.$seed284$,
  subject = $seed284$How's your season going?$seed284$,
  heading = $seed284$How's your season going?$seed284$,
  body = $seed284$Hi {{firstName}},

It's been **{{weeksPhrase}}** since **{{orgName}}** joined FieldLogicHQ.

::if hasActivity
::callout Season so far
You've run **{{tournamentsPhrase}}** — **{{gamesPhrase}} played**.
That's {{gameCount}} schedule exports and score entries you didn't have to do in a spreadsheet.
::end
::button Set up another tournament → | {{setupUrl}}
::else
You haven't run your first tournament yet — and you have your whole 2027 season on Tournament Plus to do it in.

If you have an event coming up, now's the time to set it up:
::button Set up a tournament → | {{setupUrl}}
::end

We're also curious: what's working, and what isn't? Reply and tell us.

Tournament Plus is free for **{{orgName}}** through **September 30, 2027**. In September 2027 you'll choose a plan for your 2028 season. Nothing is charged before then, and there is nothing to cancel.

— The FieldLogicHQ team$seed284$,
  variables = $seed284$["firstName","weeksPhrase","orgName","hasActivity","tournamentsPhrase","gamesPhrase","gameCount","setupUrl"]$seed284$::jsonb,
  updated_at = now(),
  updated_by = $seed284$migration-284$seed284$
where key = $seed284$founding_checkin$seed284$
  and is_customised = false;

-- founding_renewal

update platform_email_templates
  set planned_send_date = $seed284$2027-06-01$seed284$::date,
      updated_at = now(),
      updated_by = $seed284$migration-284$seed284$
where key = $seed284$founding_renewal$seed284$
  and is_customised = false
  and (updated_by is null or updated_by like $seed284$migration-%$seed284$)
  and (planned_send_date is null or planned_send_date in ($seed284$2026-11-01$seed284$::date));

update platform_email_templates set
  label = $seed284$Founding — Choose your plan$seed284$,
  description = $seed284$Sent when the card window opens. Explains what happens on October 1, 2027 and opens the 2028 plan choice, annual first.$seed284$,
  subject = $seed284$Your free season ends September 30, 2027 — choose your 2028 plan$seed284$,
  heading = $seed284$Your free season ends September 30, 2027.$seed284$,
  body = $seed284$Hi {{firstName}},

**{{orgName}}** has run on Tournament Plus at no cost since you joined. That free season ends on **September 30, 2027** — and this is the early note, not the last one.

::callout.blue What you're choosing
A plan for your 2028 season — **annual or monthly**. Tournament Plus is **$390/year** or **$39/month**. Annual suits most seasons: a year of tournaments paid once, in the month you're already doing the budget.
::end

::if hasHistory
::callout What {{orgName}} has built
::if hasActive
Your **{{activePhrase}}**, every registered team, every score and every archive carry over exactly as they are. Nothing moves.
::end
::if hasPast
Your **{{pastPhrase}}** stay in your archives on any plan, including the free one.
::end
::end
::end

You can add a card now and choose the plan later. Nothing is charged before **October 1, 2027**.

::button Add a payment method — takes 2 minutes → | {{billingUrl}}

**If Tournament Plus isn't right for 2028, there is nothing to cancel.** On October 1, 2027, **{{orgName}}** moves to the free Tournament plan and keeps everything it built.

::link See the plans → | {{planCompareUrl}}

Questions? Reply to this email.

— The FieldLogicHQ team$seed284$,
  variables = $seed284$["firstName","orgName","hasHistory","hasActive","activePhrase","hasPast","pastPhrase","billingUrl","planCompareUrl"]$seed284$::jsonb,
  updated_at = now(),
  updated_by = $seed284$migration-284$seed284$
where key = $seed284$founding_renewal$seed284$
  and is_customised = false;

-- founding_nudge

update platform_email_templates set
  label = $seed284$Founding — Plan reminder$seed284$,
  description = $seed284$Sent two months before the free season ends. A short reminder for anyone who has not chosen a 2028 plan yet.$seed284$,
  subject = $seed284$Still time to choose your 2028 plan$seed284$,
  heading = $seed284$Still time to choose your 2028 plan.$seed284$,
  body = $seed284$Hi {{firstName}},

A short follow-up: **{{orgName}}**'s free season on Tournament Plus ends on **September 30, 2027**.

::if hasCard
Your payment method is on file, so there is nothing to do today. In September 2027 you'll pick annual or monthly, and that is the whole decision.
::else
Nothing has been charged, and nothing will be before **October 1, 2027**. If you already know you're continuing, adding a card now takes two minutes and takes it off your list:
::button Add a payment method → | {{billingUrl}}
::end

::callout What it costs from October 1, 2027
Tournament Plus is **$390/year** or **$39/month**. The year is one payment, in the month you're planning the season anyway.
::end

If Tournament Plus isn't right for 2028, there is nothing to cancel. **{{orgName}}** moves to the free Tournament plan and keeps everything it built.

— The FieldLogicHQ team$seed284$,
  variables = $seed284$["firstName","orgName","hasCard","billingUrl"]$seed284$::jsonb,
  updated_at = now(),
  updated_by = $seed284$migration-284$seed284$
where key = $seed284$founding_nudge$seed284$
  and is_customised = false;

-- founding_final

update platform_email_templates
  set planned_send_date = $seed284$2027-09-15$seed284$::date,
      updated_at = now(),
      updated_by = $seed284$migration-284$seed284$
where key = $seed284$founding_final$seed284$
  and is_customised = false
  and (updated_by is null or updated_by like $seed284$migration-%$seed284$)
  and (planned_send_date is null or planned_send_date in ($seed284$2026-12-15$seed284$::date));

update platform_email_templates set
  label = $seed284$Founding — Final notice$seed284$,
  description = $seed284$Sent about two weeks before the free season ends. The last note before October 1, 2027.$seed284$,
  subject = $seed284$Last note before your free season ends September 30, 2027$seed284$,
  heading = $seed284$Your free season ends September 30, 2027.$seed284$,
  body = $seed284$Hi {{firstName}},

This is the last note before **{{orgName}}**'s free season ends on **September 30, 2027**.

::if hasCard
Your payment method is on file, so the only thing left is the choice itself: **$390/year** or **$39/month** from October 1, 2027.
::button Choose your 2028 plan → | {{billingUrl}}
::else
To keep Tournament Plus from October 1, 2027, choose a plan for your 2028 season:
::button Choose your 2028 plan → | {{billingUrl}}

**If you'd rather not continue, you don't have to do anything.** On October 1, 2027, **{{orgName}}** moves to the free Tournament plan — one active tournament, manual scheduling, no cost — and every team, score and archive you have built stays exactly where it is.
::end

Thank you for running your season with us. You were one of the first.

— The FieldLogicHQ team$seed284$,
  variables = $seed284$["firstName","orgName","hasCard","billingUrl"]$seed284$::jsonb,
  updated_at = now(),
  updated_by = $seed284$migration-284$seed284$
where key = $seed284$founding_final$seed284$
  and is_customised = false;

-- spotlight_coaches_org

update platform_email_templates set
  label = $seed284$Spotlight — Coaches Portal (to orgs)$seed284$,
  description = $seed284$Sent to org owners during the signup window. Pitches the Premium Coaches Portal for the coaches on their teams.$seed284$,
  subject = $seed284$For the coaches on your teams — free through September 30, 2027$seed284$,
  heading = $seed284$For the coaches on your teams — a workspace that's actually theirs.$seed284$,
  body = $seed284$Hi {{firstName}},

The coaches managing teams in your tournaments are tracking rosters in group texts, lineups in notes apps, and team fees in someone's head.

::callout The Premium Coaches Portal gives them one place for all of it
- Full roster management with season history
- Lineup builder — plan your starting lineup, export to PDF
- Team budget and player dues tracking
- Document management: consent forms, medical notes, eligibility files
::end

It works whether or not a coach's team is registered in a tournament you run on FieldLogicHQ. A coach can sign up on their own and run their team year-round.

The Premium Coaches Portal is free through September 30, 2027 when you sign up by December 31, 2026. No credit card. Normally $29/month or $290/year — or included when your organization is on Club.

Know a coach who'd use it? They can start today:
::link Send them this link → | {{coachShareUrl}}

Want the details first?
::button See the Premium Coaches Portal → | {{interestUrl}}

— The FieldLogicHQ team$seed284$,
  variables = $seed284$["firstName","coachShareUrl","interestUrl"]$seed284$::jsonb,
  updated_at = now(),
  updated_by = $seed284$migration-284$seed284$
where key = $seed284$spotlight_coaches_org$seed284$
  and is_customised = false;

-- spotlight_coaches_coach

update platform_email_templates set
  label = $seed284$Spotlight — Coaches Portal (to coaches)$seed284$,
  description = $seed284$Sent to coach accounts during the signup window. Pitches the standalone Premium Coaches Portal.$seed284$,
  subject = $seed284$Your team's season workspace — free through September 30, 2027$seed284$,
  heading = $seed284$Your team's season workspace.$seed284$,
  body = $seed284$Hi {{firstName}},

You've been through a tournament on FieldLogicHQ. But managing your team between tournaments is still probably spread across your phone, your email, and your memory.

::callout The Premium Coaches Portal is built for exactly that
- Your full roster, season over season
- Lineups you can plan, save, and export to PDF
- Team budget: dues in, expenses out, who owes what
- Documents in one place — consent, medical, eligibility
::end

No organization account required. Your team's workspace, on your timeline.

The Premium Coaches Portal is free through September 30, 2027 when you sign up by December 31, 2026. No credit card. Normally $29/month or $290/year.

In September 2027 you'll choose a plan for your 2028 season. Nothing is charged before then, and there is nothing to cancel.

::button Start your Premium Coaches Portal → | {{interestUrl}}

— The FieldLogicHQ team$seed284$,
  variables = $seed284$["firstName","interestUrl"]$seed284$::jsonb,
  updated_at = now(),
  updated_by = $seed284$migration-284$seed284$
where key = $seed284$spotlight_coaches_coach$seed284$
  and is_customised = false;

-- spotlight_full_picture

update platform_email_templates set
  label = $seed284$Spotlight — The Full Picture$seed284$,
  description = $seed284$Founding-season note: what's live, what's coming, and how long the window stays open.$seed284$,
  subject = $seed284$Where FieldLogicHQ is headed — a note from the Founding Season$seed284$,
  heading = $seed284$Where FieldLogicHQ is headed.$seed284$,
  body = $seed284$Hi {{firstName}},

You're one of the first organizations running on FieldLogicHQ. Here's where things stand, and where they're going.

::callout What's live today
- **Tournament** — registration, manual scheduling, brackets, live scores and archives, free with no end date
- **Tournament Plus** — everything above plus auto-scheduling, and as many tournaments as you run
- **The Premium Coaches Portal** — a full season workspace for one team: roster, lineups, budget, dues, documents
::end

Tournament Plus and the Premium Coaches Portal are free through September 30, 2027 when you sign up by December 31, 2026. No credit card.

::callout.blue What's coming
- More ways for families to follow their teams
- Deeper reporting on the money side of a season
- And more, shaped by what this first season has taught us
::end

You helped build this — by running real events on the platform and telling us what worked and what didn't.

If you know another tournament organizer or coach who should be here, the Founding Season is open until **December 31, 2026**:
::link Share FieldLogicHQ → | {{shareUrl}}

There is nothing to do about billing. In September 2027 you'll choose a plan for your 2028 season. Nothing is charged before then, and there is nothing to cancel.

— The FieldLogicHQ team$seed284$,
  variables = $seed284$["firstName","shareUrl"]$seed284$::jsonb,
  updated_at = now(),
  updated_by = $seed284$migration-284$seed284$
where key = $seed284$spotlight_full_picture$seed284$
  and is_customised = false;

-- spotlight_club — RETIRED 2026-09-07 (Club is a parked product). Description only; the copy is kept as written.

update platform_email_templates set
  label = $seed284$Spotlight — Club$seed284$,
  description = $seed284$RETIRED 2026-09-07 — Club is a parked product. Kept for revival; not sendable.$seed284$,
  subject = $seed284$Before your September season starts — Club is free through December 31$seed284$,
  heading = $seed284$Before your September season starts — Club is free through December 31.$seed284$,
  body = $seed284$Hi {{firstName}},

Most clubs are planning their September season right now.
Tryouts. Rep team rosters. League registrations. Budget prep.

If you're managing all of that across multiple tools — this is worth 15 minutes.

::callout Club on FieldLogicHQ puts your entire organization in one place
- Tournaments: same tools you're already using on your founding season
- House League: registration, draft, schedule, standings, parent notifications — no manual emails
- Rep Teams: tryouts, roster, lineups, and team budget — coaches run their own programs; your executive team gets the visibility
- Accounting: org ledger, team invoicing, budget vs. actual
::end

Your executive team sees everything. Your coaches run their own teams.
Nobody is sending weekly update emails.

Club is normally **from $219/month**, unlimited staff seats.
As a founding organization, **Club is free through December 31, 2026**.

If you're starting a September season, the time to set this up is now — not after you're three months in on the same old process.

::button Start on Club — free through December 31 → | {{setupUrl}}

Questions about whether Club is right for **{{orgName}}**? Reply to this email.

— The FieldLogicHQ team$seed284$,
  variables = $seed284$["firstName","setupUrl","orgName"]$seed284$::jsonb,
  updated_at = now(),
  updated_by = $seed284$migration-284$seed284$
where key = $seed284$spotlight_club$seed284$
  and is_customised = false;

-- spotlight_league — RETIRED 2026-09-07 (League is a parked product). Description only; the copy is kept as written.

update platform_email_templates set
  label = $seed284$Spotlight — House League$seed284$,
  description = $seed284$RETIRED 2026-09-07 — League is a parked product. Kept for revival; not sendable.$seed284$,
  subject = $seed284$What running a house league actually looks like on FieldLogicHQ$seed284$,
  heading = $seed284$What running a house league actually looks like on FieldLogicHQ.$seed284$,
  body = $seed284$Hi {{firstName}},

You're running tournaments. But if **{{orgName}}** also runs a house league season — or if that's where you're headed — here's what that looks like.

::callout From opening registration to final standings
- Parents register players online. You set division limits; waitlists fill automatically.
- Draft day uses a live board — pick order, team builds, no spreadsheet.
- The schedule generates itself. Parents get automated game notifications without you sending a single email.
- Standings update the moment scores are entered.
::end

No parallel spreadsheets. No manual notifications. One dashboard.

Available on the League Plus plan (**$89/month**) and Club plan (**from $219/month**).
Both are **free through December 31, 2026** for founding organizations.

If you're planning a league season:
::button Get set up on League Plus — free through December 31 → | {{setupUrl}}

— The FieldLogicHQ team$seed284$,
  variables = $seed284$["firstName","orgName","setupUrl"]$seed284$::jsonb,
  updated_at = now(),
  updated_by = $seed284$migration-284$seed284$
where key = $seed284$spotlight_league$seed284$
  and is_customised = false;

-- spotlight_club_last — RETIRED 2026-09-07 (Club is a parked product). Description only; the copy is kept as written.

update platform_email_templates set
  label = $seed284$Spotlight — Club (last call)$seed284$,
  description = $seed284$RETIRED 2026-09-07 — Club is a parked product. Kept for revival; not sendable.$seed284$,
  subject = $seed284$Last reminder — Club is still free through December 31$seed284$,
  heading = $seed284$Last reminder — Club is still free through December 31.$seed284$,
  body = $seed284$Hi {{firstName}},

A quick follow-up to our August note about Club.

If **{{orgName}}** is running a house league, rep teams, or both alongside your tournaments — Club is free through December 31, 2026 as part of your founding season.

After the new year, it's **from $219/month**. Starting now, it costs nothing.

The longer you wait to set it up, the deeper into the season you go on separate systems.

::button Start on Club — free through December 31 → | {{setupUrl}}

— The FieldLogicHQ team$seed284$,
  variables = $seed284$["firstName","orgName","setupUrl"]$seed284$::jsonb,
  updated_at = now(),
  updated_by = $seed284$migration-284$seed284$
where key = $seed284$spotlight_club_last$seed284$
  and is_customised = false;
