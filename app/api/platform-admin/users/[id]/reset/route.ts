import { NextRequest, NextResponse } from 'next/server';
import { getPlatformAuthContext } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getPlatformAuthContext();
  if (!user) return new NextResponse('Forbidden', { status: 403 });

  // id param is present but unused — email is the key for generateLink
  await params;

  const body = await req.json() as { email?: string };
  const { email } = body;

  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/auth/login`,
    },
  });

  if (error || !data?.properties?.action_link) {
    console.error('[platform-admin] generateLink error:', error);
    return NextResponse.json({ error: 'Failed to generate reset link' }, { status: 500 });
  }

  return NextResponse.json({ link: data.properties.action_link });
}
