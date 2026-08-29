-- 269: A PLEDGE KNOWS WHEN TO EXPECT THE CHEQUE
-- (COACH_SPONSORSHIP_LIFECYCLE_PLAN — owner ruling Q13, 2026-08-28, landed with Direction A of
-- the fundraising rework, 2026-08-29.)
--
-- THE CASE. Hilltop Autos promised $2,000 "for the spring". Until now nothing recorded when the
-- spring was: a June promise and yesterday's promise looked identical forever, and the treasurer
-- chased from memory. One optional date fixes it — and the product's whole use of it is QUIET:
-- a sentence on the sponsor's row and a clause on the Money overview once the date has passed.
-- No reminders, no emails, no red until it is actually late.
alter table rep_fundraisers
  add column if not exists expected_by date;

comment on column rep_fundraisers.expected_by is
  'SPONSOR ONLY, optional: the day the pledged money is expected (owner ruling Q13). NULL means '
  'no date was promised — most pledges. Read by the sponsor band''s row line and the Money '
  'overview''s past-due clause; deliberately NOT a due date: nothing schedules against it, '
  'nothing notifies, and Budget vs. Actual''s forward view keeps pledges in "No date yet" (a '
  'promise is not an installment). NULL on a fundraiser.';
