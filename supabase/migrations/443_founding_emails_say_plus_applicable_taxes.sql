-- 443_founding_emails_say_plus_applicable_taxes.sql
--
-- CAMPAIGN RESEED  <- marker: tests/unit/marketing-campaign-registry.test.ts checks the
--                     HIGHEST-numbered migration carrying this line against the registry, so a
--                     later reseed takes over as the gate simply by carrying it too.
--
-- GST/HST Stage 2 Part 4 (build prompt: docs/projects/active/GST_HST_STAGE2_PART4_BUILD_PROMPT.md; owner ruling T4,
-- 2026-10-31: prices are "plus applicable taxes"). Three Founding Season campaigns name the next-season charge —
-- founding_renewal, founding_nudge and founding_final — and now say it is before tax, from the one spelling in
-- lib/billing-tax.ts (BILLING_TAX_WORDS.plusTax). Nothing else in the copy changes.
--
-- GENERATED, NEVER HAND-TYPED, by scripts/generate-campaign-reseed-migration.mjs from
-- lib/marketing-email-defaults.ts (the campaign registry; dates and prices from lib/plan-config.ts). It restates the
-- whole registry, as every reseed does, and takes over from migration 284 as the gate in
-- tests/unit/marketing-campaign-registry.test.ts. Re-running is safe: the one insert is on conflict do nothing (the row
-- 284 made), and every update is gated on is_customised = false, so a saved operator override always wins.
--
-- ⚠ DATA-ONLY: check:migrations cannot see it, so nothing can prove it ran on production. Record the prod apply in the
-- release history by hand.
--
-- A planned date moves only while it still holds a value a previous seed wrote (or is NULL) —
-- an operator who has picked their own date keeps it.


-- ── NEW: founding_nudge ──────────────────────────────────────────────────────────────
insert into platform_email_templates
  (key, label, description, subject, heading, body, variables, category, is_customised, planned_send_date, updated_at, updated_by)
values (
  $seed443$founding_nudge$seed443$,
  $seed443$Founding — Plan reminder$seed443$,
  $seed443$Sent two months before the free season ends. A short reminder for anyone who has not chosen a 2028 plan yet.$seed443$,
  $seed443$Still time to choose your 2028 plan$seed443$,
  $seed443$Still time to choose your 2028 plan.$seed443$,
  $seed443$Hi {{firstName}},

A short follow-up: **{{orgName}}**'s free season on Tournament Plus ends on **September 30, 2027**.

::if hasCard
Your payment method is on file, so there is nothing to do today. In September 2027 you'll pick annual or monthly, and that is the whole decision.
::else
Nothing has been charged, and nothing will be before **October 1, 2027**. If you already know you're continuing, adding a card now takes two minutes and takes it off your list:
::button Add a payment method → | {{billingUrl}}
::end

::callout What it costs from October 1, 2027
Tournament Plus is **$390/year** or **$39/month** plus applicable taxes. The year is one payment, in the month you're planning the season anyway.
::end

If Tournament Plus isn't right for 2028, there is nothing to cancel. **{{orgName}}** moves to the free Tournament plan and keeps everything it built.

— The FieldLogicHQ team$seed443$,
  $seed443$["firstName","orgName","hasCard","billingUrl"]$seed443$::jsonb,
  $seed443$marketing$seed443$,
  false,
  $seed443$2027-08-01$seed443$::date,
  now(),
  $seed443$migration-443$seed443$
)
on conflict (key) do nothing;


-- founding_welcome

update platform_email_templates set
  label = $seed443$Founding — Welcome$seed443$,
  description = $seed443$Sent to each new founding org owner at signup (transactional). Confirms free Tournament Plus through September 30, 2027.$seed443$,
  subject = $seed443$Your Founding Season starts now — free through September 30, 2027$seed443$,
  heading = $seed443$Your Founding Season starts now.$seed443$,
  body = $seed443$Hi {{firstName}},

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

— The FieldLogicHQ team$seed443$,
  variables = $seed443$["firstName","orgName","setupUrl"]$seed443$::jsonb,
  updated_at = now(),
  updated_by = $seed443$migration-443$seed443$
where key = $seed443$founding_welcome$seed443$
  and is_customised = false;

-- founding_checkin

update platform_email_templates set
  label = $seed443$Founding — Season Check-in$seed443$,
  description = $seed443$Sent ~60 days after signup. Celebrates activity so far and nudges another tournament.$seed443$,
  subject = $seed443$How's your season going?$seed443$,
  heading = $seed443$How's your season going?$seed443$,
  body = $seed443$Hi {{firstName}},

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

— The FieldLogicHQ team$seed443$,
  variables = $seed443$["firstName","weeksPhrase","orgName","hasActivity","tournamentsPhrase","gamesPhrase","gameCount","setupUrl"]$seed443$::jsonb,
  updated_at = now(),
  updated_by = $seed443$migration-443$seed443$
where key = $seed443$founding_checkin$seed443$
  and is_customised = false;

-- founding_renewal

update platform_email_templates
  set planned_send_date = $seed443$2027-06-01$seed443$::date,
      updated_at = now(),
      updated_by = $seed443$migration-443$seed443$
where key = $seed443$founding_renewal$seed443$
  and is_customised = false
  and (updated_by is null or updated_by like $seed443$migration-%$seed443$)
  and (planned_send_date is null or planned_send_date in ($seed443$2026-11-01$seed443$::date));

update platform_email_templates set
  label = $seed443$Founding — Choose your plan$seed443$,
  description = $seed443$Sent when the card window opens. Explains what happens on October 1, 2027 and opens the 2028 plan choice, annual first.$seed443$,
  subject = $seed443$Your free season ends September 30, 2027 — choose your 2028 plan$seed443$,
  heading = $seed443$Your free season ends September 30, 2027.$seed443$,
  body = $seed443$Hi {{firstName}},

**{{orgName}}** has run on Tournament Plus at no cost since you joined. That free season ends on **September 30, 2027** — and this is the early note, not the last one.

::callout.blue What you're choosing
A plan for your 2028 season — **annual or monthly**. Tournament Plus is **$390/year** or **$39/month** plus applicable taxes. Annual suits most seasons: a year of tournaments paid once, in the month you're already doing the budget.
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

— The FieldLogicHQ team$seed443$,
  variables = $seed443$["firstName","orgName","hasHistory","hasActive","activePhrase","hasPast","pastPhrase","billingUrl","planCompareUrl"]$seed443$::jsonb,
  updated_at = now(),
  updated_by = $seed443$migration-443$seed443$
where key = $seed443$founding_renewal$seed443$
  and is_customised = false;

-- founding_nudge

update platform_email_templates set
  label = $seed443$Founding — Plan reminder$seed443$,
  description = $seed443$Sent two months before the free season ends. A short reminder for anyone who has not chosen a 2028 plan yet.$seed443$,
  subject = $seed443$Still time to choose your 2028 plan$seed443$,
  heading = $seed443$Still time to choose your 2028 plan.$seed443$,
  body = $seed443$Hi {{firstName}},

A short follow-up: **{{orgName}}**'s free season on Tournament Plus ends on **September 30, 2027**.

::if hasCard
Your payment method is on file, so there is nothing to do today. In September 2027 you'll pick annual or monthly, and that is the whole decision.
::else
Nothing has been charged, and nothing will be before **October 1, 2027**. If you already know you're continuing, adding a card now takes two minutes and takes it off your list:
::button Add a payment method → | {{billingUrl}}
::end

::callout What it costs from October 1, 2027
Tournament Plus is **$390/year** or **$39/month** plus applicable taxes. The year is one payment, in the month you're planning the season anyway.
::end

If Tournament Plus isn't right for 2028, there is nothing to cancel. **{{orgName}}** moves to the free Tournament plan and keeps everything it built.

— The FieldLogicHQ team$seed443$,
  variables = $seed443$["firstName","orgName","hasCard","billingUrl"]$seed443$::jsonb,
  updated_at = now(),
  updated_by = $seed443$migration-443$seed443$
where key = $seed443$founding_nudge$seed443$
  and is_customised = false;

-- founding_final

update platform_email_templates
  set planned_send_date = $seed443$2027-09-15$seed443$::date,
      updated_at = now(),
      updated_by = $seed443$migration-443$seed443$
where key = $seed443$founding_final$seed443$
  and is_customised = false
  and (updated_by is null or updated_by like $seed443$migration-%$seed443$)
  and (planned_send_date is null or planned_send_date in ($seed443$2026-12-15$seed443$::date));

update platform_email_templates set
  label = $seed443$Founding — Final notice$seed443$,
  description = $seed443$Sent about two weeks before the free season ends. The last note before October 1, 2027.$seed443$,
  subject = $seed443$Last note before your free season ends September 30, 2027$seed443$,
  heading = $seed443$Your free season ends September 30, 2027.$seed443$,
  body = $seed443$Hi {{firstName}},

This is the last note before **{{orgName}}**'s free season ends on **September 30, 2027**.

::if hasCard
Your payment method is on file, so the only thing left is the choice itself: **$390/year** or **$39/month** plus applicable taxes, from October 1, 2027.
::button Choose your 2028 plan → | {{billingUrl}}
::else
To keep Tournament Plus from October 1, 2027, choose a plan for your 2028 season:
::button Choose your 2028 plan → | {{billingUrl}}

**If you'd rather not continue, you don't have to do anything.** On October 1, 2027, **{{orgName}}** moves to the free Tournament plan — one active tournament, manual scheduling, no cost — and every team, score and archive you have built stays exactly where it is.
::end

Thank you for running your season with us. You were one of the first.

— The FieldLogicHQ team$seed443$,
  variables = $seed443$["firstName","orgName","hasCard","billingUrl"]$seed443$::jsonb,
  updated_at = now(),
  updated_by = $seed443$migration-443$seed443$
where key = $seed443$founding_final$seed443$
  and is_customised = false;

-- spotlight_coaches_org — RETIRED 2026-10-26 (The Founding Season offer closed early). Description only; the copy is kept as written.

update platform_email_templates set
  label = $seed443$Spotlight — Coaches Portal (to orgs)$seed443$,
  description = $seed443$Sent to org owners during the signup window. Pitches the Premium Coaches Portal for the coaches on their teams.$seed443$,
  subject = $seed443$For the coaches on your teams — free through September 30, 2027$seed443$,
  heading = $seed443$For the coaches on your teams — a workspace that's actually theirs.$seed443$,
  body = $seed443$Hi {{firstName}},

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

— The FieldLogicHQ team$seed443$,
  variables = $seed443$["firstName","coachShareUrl","interestUrl"]$seed443$::jsonb,
  updated_at = now(),
  updated_by = $seed443$migration-443$seed443$
where key = $seed443$spotlight_coaches_org$seed443$
  and is_customised = false;

-- spotlight_coaches_coach — RETIRED 2026-10-26 (The Founding Season offer closed early). Description only; the copy is kept as written.

update platform_email_templates set
  label = $seed443$Spotlight — Coaches Portal (to coaches)$seed443$,
  description = $seed443$Sent to coach accounts during the signup window. Pitches the standalone Premium Coaches Portal.$seed443$,
  subject = $seed443$Your team's season workspace — free through September 30, 2027$seed443$,
  heading = $seed443$Your team's season workspace.$seed443$,
  body = $seed443$Hi {{firstName}},

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

— The FieldLogicHQ team$seed443$,
  variables = $seed443$["firstName","interestUrl"]$seed443$::jsonb,
  updated_at = now(),
  updated_by = $seed443$migration-443$seed443$
where key = $seed443$spotlight_coaches_coach$seed443$
  and is_customised = false;

-- spotlight_full_picture — RETIRED 2026-10-26 (The Founding Season offer closed early). Description only; the copy is kept as written.

update platform_email_templates set
  label = $seed443$Spotlight — The Full Picture$seed443$,
  description = $seed443$Founding-season note: what's live, what's coming, and how long the window stays open.$seed443$,
  subject = $seed443$Where FieldLogicHQ is headed — a note from the Founding Season$seed443$,
  heading = $seed443$Where FieldLogicHQ is headed.$seed443$,
  body = $seed443$Hi {{firstName}},

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

— The FieldLogicHQ team$seed443$,
  variables = $seed443$["firstName","shareUrl"]$seed443$::jsonb,
  updated_at = now(),
  updated_by = $seed443$migration-443$seed443$
where key = $seed443$spotlight_full_picture$seed443$
  and is_customised = false;

-- spotlight_club — RETIRED 2026-09-07 (Club is a parked product). Description only; the copy is kept as written.

update platform_email_templates set
  label = $seed443$Spotlight — Club$seed443$,
  description = $seed443$RETIRED 2026-09-07 — Club is a parked product. Kept for revival; not sendable.$seed443$,
  subject = $seed443$Before your September season starts — Club is free through December 31$seed443$,
  heading = $seed443$Before your September season starts — Club is free through December 31.$seed443$,
  body = $seed443$Hi {{firstName}},

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

— The FieldLogicHQ team$seed443$,
  variables = $seed443$["firstName","setupUrl","orgName"]$seed443$::jsonb,
  updated_at = now(),
  updated_by = $seed443$migration-443$seed443$
where key = $seed443$spotlight_club$seed443$
  and is_customised = false;

-- spotlight_league — RETIRED 2026-09-07 (League is a parked product). Description only; the copy is kept as written.

update platform_email_templates set
  label = $seed443$Spotlight — House League$seed443$,
  description = $seed443$RETIRED 2026-09-07 — League is a parked product. Kept for revival; not sendable.$seed443$,
  subject = $seed443$What running a house league actually looks like on FieldLogicHQ$seed443$,
  heading = $seed443$What running a house league actually looks like on FieldLogicHQ.$seed443$,
  body = $seed443$Hi {{firstName}},

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

— The FieldLogicHQ team$seed443$,
  variables = $seed443$["firstName","orgName","setupUrl"]$seed443$::jsonb,
  updated_at = now(),
  updated_by = $seed443$migration-443$seed443$
where key = $seed443$spotlight_league$seed443$
  and is_customised = false;

-- spotlight_club_last — RETIRED 2026-09-07 (Club is a parked product). Description only; the copy is kept as written.

update platform_email_templates set
  label = $seed443$Spotlight — Club (last call)$seed443$,
  description = $seed443$RETIRED 2026-09-07 — Club is a parked product. Kept for revival; not sendable.$seed443$,
  subject = $seed443$Last reminder — Club is still free through December 31$seed443$,
  heading = $seed443$Last reminder — Club is still free through December 31.$seed443$,
  body = $seed443$Hi {{firstName}},

A quick follow-up to our August note about Club.

If **{{orgName}}** is running a house league, rep teams, or both alongside your tournaments — Club is free through December 31, 2026 as part of your founding season.

After the new year, it's **from $219/month**. Starting now, it costs nothing.

The longer you wait to set it up, the deeper into the season you go on separate systems.

::button Start on Club — free through December 31 → | {{setupUrl}}

— The FieldLogicHQ team$seed443$,
  variables = $seed443$["firstName","orgName","setupUrl"]$seed443$::jsonb,
  updated_at = now(),
  updated_by = $seed443$migration-443$seed443$
where key = $seed443$spotlight_club_last$seed443$
  and is_customised = false;
