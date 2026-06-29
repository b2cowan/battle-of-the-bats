-- Phase 4: per-event resource links (V1) for the Premium coach schedule. A small jsonb store on a
-- coach event so a coach can attach labelled links (drill video, rules page, field map, flyer).
-- Modeled as a typed array of { type: 'link' | 'file', label, url } so FILE attachments can join
-- later (V2, reusing the Documents storage) WITHOUT a schema change. Additive + nullable; the array
-- shape, URL validity, and per-event count cap are app-enforced (lib/rep-event-resources.ts), NOT
-- DB constraints (mirrors this table's other UI-shaped fields).
ALTER TABLE rep_team_events
  ADD COLUMN IF NOT EXISTS resources jsonb;
