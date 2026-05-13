import { createClient } from '@supabase/supabase-js';
import {
  assertSafeSupabaseBrowserEnvironment,
  assertSafeSupabaseServerEnvironment,
} from './supabase-safety';

if (typeof window === 'undefined') {
  assertSafeSupabaseServerEnvironment('Supabase public client');
} else {
  assertSafeSupabaseBrowserEnvironment('Supabase public client');
}

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
);
