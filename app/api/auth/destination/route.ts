import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';

async function isPlatformAdmin(email: string): Promise<boolean> {
  const envList = (process.env.PLATFORM_ADMIN_EMAILS ?? '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  if (envList.includes(email.toLowerCase())) return true;

  const { data } = await supabaseAdmin
    .from('platform_users')
    .select('is_active')
    .eq('email', email.toLowerCase())
    .eq('is_active', true)
    .maybeSingle();
  return !!data;
}

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ destination: '/auth/login' });
  }

  if (await isPlatformAdmin(user.email)) {
    return NextResponse.json({ destination: '/platform-admin' });
  }

  const { data: member } = await supabaseAdmin
    .from('organization_members')
    .select('organization_id, organizations(slug)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  const slug = (member?.organizations as any)?.slug;
  if (slug) {
    return NextResponse.json({ destination: `/${slug}/admin` });
  }

  return NextResponse.json({ destination: '/auth/signup' });
}
