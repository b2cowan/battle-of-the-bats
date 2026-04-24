import { createClient } from '@supabase/supabase-js';

// Admin client using service role key — server-side ONLY, never expose to browser
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
