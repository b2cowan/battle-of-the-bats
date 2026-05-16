-- Align persisted tournament slot limits with the current plan caps.
-- Tournament Plus is capped at 3 non-archived tournaments; archived tournaments
-- do not consume slots.

UPDATE organizations
SET tournament_limit = 1
WHERE plan_id = 'tournament'
  AND tournament_limit > 1;

UPDATE organizations
SET tournament_limit = 3
WHERE plan_id = 'tournament_plus'
  AND tournament_limit > 3;
