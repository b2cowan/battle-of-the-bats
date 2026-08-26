-- 264_the_offer_letter_is_the_coachs_to_write.sql
--
-- Retires the three platform email templates behind the tryout DECISION emails. Owner ruling
-- 2026-08-26, binding: FieldLogicHQ sends a tryout family nothing as a consequence of a coach's
-- or club admin's decision. A rep offer is a custom letter the family SIGNS — frequently
-- conditional, frequently the opening of a negotiation — so a generic platform email cannot stand
-- in for it, and a control that could only ever be neutral-or-harmful sitting one tap from
-- "Not this season" is a mis-tap risk with no upside.
--
-- The senders, the opt-in switch on BOTH surfaces (coach decision board + club-admin tryouts
-- screen), and the family self-serve Accept/Decline loop that the offer email carried were all
-- removed in the same change. These three rows are the last thing left: without them a platform
-- admin sees three editable templates on /platform-admin/email-templates that nothing can ever
-- send. Plan: docs/projects/active/COACH_TRYOUT_EMAIL_REMOVAL_PLAN.md.
--
-- ⚠ 'tryout_application_received' is DELIBERATELY LEFT IN PLACE. That one is the family's receipt
-- for the family's OWN action — submitting the public tryout form — not a coach decision announced
-- on their behalf. Removing it would leave applicants with no confirmation their application
-- landed. Do not "finish the job" by deleting it.
--
-- No schema change: data only, so the dictionary and snapshots are unaffected.

DELETE FROM public.platform_email_templates
 WHERE key IN ('tryout_offer_extended', 'tryout_declined', 'tryout_offer_accepted');
