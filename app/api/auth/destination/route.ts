import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isPlatformAdminEmail } from '@/lib/platform-auth';

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

  if (await isPlatformAdminEmail(user.email)) {
    return NextResponse.json({ destination: '/platform-admin' });
  }

  const { data: member } = await supabaseAdmin
    .from('organization_members')
    .select('organization_id, organizations(slug)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  const orgRelation = (member as {
    organizations?: { slug?: string } | { slug?: string }[] | null;
  } | null)?.organizations;
  const slug = Array.isArray(orgRelation) ? orgRelation[0]?.slug : orgRelation?.slug;
  if (slug) {
    return NextResponse.json({ destination: `/${slug}/admin` });
  }

  return NextResponse.json({ destination: '/auth/signup' });
}
