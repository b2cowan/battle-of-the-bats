-- Atomically claims the next available slot for a team in a division.
-- Uses SELECT ... FOR UPDATE SKIP LOCKED so concurrent registrations each
-- get a distinct slot rather than racing on the same row.
-- Returns the claimed slot UUID, or NULL if no empty slot is available.
CREATE OR REPLACE FUNCTION claim_next_slot(p_age_group_id UUID, p_team_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_slot_id UUID;
BEGIN
  UPDATE pool_slots
  SET    team_id = p_team_id
  WHERE  id = (
    SELECT ps.id
    FROM   pool_slots ps
    JOIN   pools p ON p.id = ps.pool_id
    WHERE  ps.age_group_id = p_age_group_id
      AND  ps.team_id IS NULL
    ORDER  BY p.display_order ASC, ps.slot_number ASC
    LIMIT  1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING id INTO v_slot_id;

  RETURN v_slot_id;
END;
$$;
