import { createClient } from '@supabase/supabase-js';

// Public client — for reads and inserts (used client-side and in public API routes)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
