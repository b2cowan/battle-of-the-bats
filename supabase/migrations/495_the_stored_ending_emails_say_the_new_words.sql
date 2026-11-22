-- ---------------------------------------------------------------
-- Migration 495 — the stored plan-ending email rows say what the built-in emails now say (Plans end at the renewal date,
-- Stage 4 follow-up; owner ruling 2026-11-16, question Q3: "fix them in a data migration, only where is_customised = false").
-- Canonical words: docs/projects/active/PLAN_AND_BILLING_COPY.md §15 and lib/plan-ending-emails.ts, lib/email.ts
-- (cancellationConfirmationHtml, teamWorkspaceCancelledHtml, billingRetentionWarningHtml).
--
-- WHY: the app sends its own built-in words unless an operator customises a row (platform_email_templates.is_customised);
-- a row's stored words are only what an operator STARTS FROM when they customise it. Mig 425/434/083 seeded those words
-- before the Stage 4 rewrite, so they went stale: they say "resubscribe" (the door is now "Reactivate {Plan}"), "Nothing more
-- is charged" (a club with online payments still has fee invoices to the date — the words name the PLAN payment), "at
-- {{price}}" with no "plus applicable taxes" (the Keep window and the built-in kept email both say it), and the "ended" pair
-- still describes the old at-the-click cancel ("Your organization is now inactive", "Resubscribe").
--
--   1. plan_ends_on, team_workspace_ends_on: heading "We're sorry to see you go!"; the lead says nothing is switched off
--      before the date and that no more plan (Premium) payments are taken; "everything comes back if you resubscribe"
--      becomes "it comes back if you reactivate before then"; "its tournaments are archived" goes (the app counts them;
--      a stored row cannot).
--   2. plan_ending_reminder: the panel loses "its tournaments are archived" (same reason). team_workspace_ending_reminder
--      already matches the built-in words and is NOT touched.
--   3. plan_kept, team_workspace_kept: "at {{price}}" becomes "at {{price}} plus applicable taxes", and the sentence is
--      left out when the app has no price to give ({{price}} is empty then — the built-in email drops "at {price}" too).
--   4. plan_downgrade_scheduled, plan_downgrade_reminder, plan_downgraded: the sentence the built-in panel carries, "Tools
--      that come only with {{planLabel}} turn off." / "...came only with... are off."
--   5. cancellation_confirmation, team_workspace_cancelled (the "ended" pair): subject, heading, body and button become the
--      built-in ones — "{Plan} has ended", "is now suspended", "Your data is kept until X. You can restore it from Plan &
--      billing before then.", button "Reactivate {Plan}" / "Reactivate Premium". A data notice, never a price or an offer
--      (/legal CASL 2026-11-16). team_workspace_cancelled declares {{retentionUntil}}, which the app has always supplied.
--      Both DESCRIPTIONS are set (staff only, unconditional): the email goes on the END date, not at the confirm.
--   6. billing_retention_warning: "Resubscribe or contact support" becomes "You can restore it from Plan & billing before
--      then, or contact support"; subject becomes the built-in "Retention window ending soon for {{orgName}}".
--
-- Every UPDATE is `where key = ... and is_customised = false` (a row an operator has customised is never touched; the
-- two descriptions in step 5 are the one staff-only exception). No {{variable}} is used that the row's variables array does
-- not declare. Not expressible in a stored row (the app varies them per case), left to the built-in email: the day the cancel
-- was made, the door's "We cancelled ... at your request" / "in the billing portal", the trial and past-due leads, the count
-- of archived tournaments, the "renews as {move}" kept email, "{n} days left", and the retention list of records.
--
-- Data only: no column, constraint or function change. Re-runnable (each SET is absolute). Nothing a customer receives
-- changes while nobody has customised a template — the built-in words are sent then — so the order against the code
-- does not matter.
-- Prod order: after 425 and 434 (rows exist), any time before the next customisation of these templates is possible.
-- ---------------------------------------------------------------

BEGIN;

-- ── 1. ends on (club and Coaches Portal) ───────────────────────────────────────────────────────────────────────────────
update platform_email_templates
   set heading = $k$We’re sorry to see you go!$k$,
       body = $k$You cancelled **{{planLabel}}** for **{{orgName}}**. Everything stays open until {{date}}, the end of the period you paid for. Nothing is switched off before then, and no more plan payments are taken.

On {{date}}, {{orgName}} is suspended. Your data is kept until **{{retentionUntil}}**, and it comes back if you reactivate before then.

Changed your mind? You can keep {{planLabel}} any time before {{date}}.$k$,
       updated_at = now(),
       updated_by = $k$migration-495$k$
 where key = 'plan_ends_on'
   and is_customised = false;

update platform_email_templates
   set heading = $k$We’re sorry to see you go!$k$,
       body = $k$You cancelled Premium for your **{{orgName}}** Coaches Portal. Premium tools stay on until {{date}}, the end of the period you paid for. Nothing is switched off before then, and no more Premium payments are taken.

On {{date}}, Premium tools stop. Your team is kept until **{{retentionUntil}}**, and it comes back if you reactivate before then. Basic tournament records stay available.

Changed your mind? You can keep Premium any time before {{date}}.$k$,
       updated_at = now(),
       updated_by = $k$migration-495$k$
 where key = 'team_workspace_ends_on'
   and is_customised = false;

-- ── 2. the seven-day reminder (club only; the Coaches Portal's already matches) ───────────────────────────────────────
update platform_email_templates
   set body = $k$Your **{{planLabel}}** plan for **{{orgName}}** ends on {{date}}. Until then everything stays open.

On {{date}}, {{orgName}} is suspended. Your data is kept until **{{retentionUntil}}**.$k$,
       updated_at = now(),
       updated_by = $k$migration-495$k$
 where key = 'plan_ending_reminder'
   and is_customised = false;

-- ── 3. kept: the charge is the price before tax ────────────────────────────────────────────────────────────────────────
update platform_email_templates
   set body = $k$You kept **{{planLabel}}** for **{{orgName}}**.

::if price
It renews on {{date}} at {{price}} plus applicable taxes.
::else
It renews on {{date}}.
::end

Nothing else changes.$k$,
       updated_at = now(),
       updated_by = $k$migration-495$k$
 where key = 'plan_kept'
   and is_customised = false;

update platform_email_templates
   set body = $k$You kept Premium for your **{{orgName}}** Coaches Portal.

::if price
It renews on {{date}} at {{price}} plus applicable taxes.
::else
It renews on {{date}}.
::end

Nothing else changes.$k$,
       updated_at = now(),
       updated_by = $k$migration-495$k$
 where key = 'team_workspace_kept'
   and is_customised = false;

-- ── 4. a move to the free plan: the line about the tools ───────────────────────────────────────────────────────────────
update platform_email_templates
   set body = $k$You chose to move **{{orgName}}** from **{{planLabel}}** to **{{targetPlanLabel}}**. This takes effect on {{date}}, the end of the period you paid for. Until then you keep every {{planLabel}} tool. Nothing is credited.

On {{date}}, {{orgName}} moves to {{targetPlanLabel}}. You keep **{{keptTournaments}}**. Any other tournament is archived then and kept until **{{retentionUntil}}**, so it can come back if you upgrade before then. Tools that come only with {{planLabel}} turn off.

Changed your mind? You can keep {{planLabel}} any time before {{date}}.$k$,
       updated_at = now(),
       updated_by = $k$migration-495$k$
 where key = 'plan_downgrade_scheduled'
   and is_customised = false;

update platform_email_templates
   set body = $k$**{{orgName}}** moves from **{{planLabel}}** to **{{targetPlanLabel}}** on {{date}}. Until then everything stays open.

On {{date}}, you keep **{{keptTournaments}}**. Any other tournament is archived then and kept until **{{retentionUntil}}**. Tools that come only with {{planLabel}} turn off.$k$,
       updated_at = now(),
       updated_by = $k$migration-495$k$
 where key = 'plan_downgrade_reminder'
   and is_customised = false;

update platform_email_templates
   set body = $k$**{{orgName}}** moved from **{{fromPlanLabel}}** to **{{toPlanLabel}}** on {{date}}, as you chose.

You kept **{{keptTournaments}}**. Any other tournament was archived and is kept until **{{retentionUntil}}**. Upgrade before then and it comes back. Tools that came only with {{planLabel}} are off.$k$,
       updated_at = now(),
       updated_by = $k$migration-495$k$
 where key = 'plan_downgraded'
   and is_customised = false;

-- ── 5. the "ended" pair ────────────────────────────────────────────────────────────────────────────────────────────────
update platform_email_templates
   set subject = $k${{planLabel}} for {{orgName}} has ended$k$,
       heading = $k${{planLabel}} has ended$k$,
       body = $k$**{{planLabel}}** for **{{orgName}}** has ended, and {{orgName}} is now suspended.

Your data is kept until **{{retentionUntil}}**. You can restore it from Plan & billing before then.$k$,
       cta_label = $k$Reactivate {{planLabel}}$k$,
       cta_url_pattern = $k${{resubscribeUrl}}$k$,
       variables = '["orgName","planLabel","retentionUntil","resubscribeUrl"]'::jsonb,
       updated_at = now(),
       updated_by = $k$migration-495$k$
 where key = 'cancellation_confirmation'
   and is_customised = false;

update platform_email_templates
   set subject = $k$Premium for your {{workspaceName}} Coaches Portal has ended$k$,
       heading = $k$Premium has ended$k$,
       body = $k$Premium for your **{{workspaceName}}** Coaches Portal has ended, and Premium tools are off now.

Your team is kept until **{{retentionUntil}}**. You can restore it from your Coaches Portal before then. Basic tournament records stay available in Coaches Portal.$k$,
       cta_label = $k$Reactivate Premium$k$,
       cta_url_pattern = $k${{resubscribeUrl}}$k$,
       variables = '["workspaceName","retentionUntil","resubscribeUrl"]'::jsonb,
       updated_at = now(),
       updated_by = $k$migration-495$k$
 where key = 'team_workspace_cancelled'
   and is_customised = false;

-- The descriptions (staff only, so unconditional, as 434 did for plan_downgraded): the page's note said "when an owner
-- confirms the cancellation", which has not been true since Stage 4 — the email goes on the end date.
update platform_email_templates
   set description = $k$Sent on the date a plan ends (the end of the period an owner cancelled, or at once when there is no paid period to wait for), to every owner. A data notice: the date the data is kept until and where to restore it. Never a price or an offer.$k$
 where key = 'cancellation_confirmation';

update platform_email_templates
   set description = $k$Sent on the date Premium ends for a Coaches Portal (the end of the period the coach cancelled, or at once when there is no paid period to wait for), to every owner. A data notice: the date the team is kept until and where to restore it. Never a price or an offer.$k$
 where key = 'team_workspace_cancelled';

-- ── 6. the retention-window warning ────────────────────────────────────────────────────────────────────────────────────
update platform_email_templates
   set subject = $k$Retention window ending soon for {{orgName}}$k$,
       body = $k$The retained data for **{{orgName}}** is scheduled to leave the restore window in about **{{daysUntilExpiry}} days**. You can restore it from Plan & billing before then, or contact support.$k$,
       updated_at = now(),
       updated_by = $k$migration-495$k$
 where key = 'billing_retention_warning'
   and is_customised = false;

COMMIT;
