export type PlatformChangeRequestRow = {
  id: string;
  request_type: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  target_plan_id: string | null;
  target_addon_key: string | null;
  effective_at: string | null;
  impact_summary: string | null;
  submitted_by_email: string | null;
  submitted_at: string | null;
  reviewed_by_email: string | null;
  reviewed_at: string | null;
  implementation_notes: string | null;
  proposal: unknown;
  created_by_email: string;
  updated_by_email: string | null;
  created_at: string;
  updated_at: string;
};

export type PlatformChangeApplicationRow = {
  id: string;
  change_request_id: string;
  surface: string;
  target_key: string;
  actor_email: string;
  applied_payload: unknown;
  applied_at: string;
};
