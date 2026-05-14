import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient as createBrowserSupabaseClient } from './supabase-browser';
import {
  assertSafeSupabaseBrowserEnvironment,
  assertSafeSupabaseServerEnvironment,
} from './supabase-safety';

if (typeof window === 'undefined') {
  assertSafeSupabaseServerEnvironment('Supabase public client');
} else {
  assertSafeSupabaseBrowserEnvironment('Supabase public client');
}

export const supabase = typeof window === 'undefined'
  ? createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
  )
  : createBrowserSupabaseClient();
