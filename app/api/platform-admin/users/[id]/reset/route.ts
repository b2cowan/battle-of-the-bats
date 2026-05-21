import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPermission } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { writePlatformAuditLog } from '@/lib/platform-audit';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePlatformPermission('manage_support');
  if (auth.response) return auth.response;

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

  await writePlatformAuditLog(auth.user.email!, null, 'generate_reset_link', 'email', null, email);

  return NextResponse.json({ link: data.properties.action_link });
}
