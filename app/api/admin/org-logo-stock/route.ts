import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { STOCK_LOGOS, PLAN_ORDER } from '@/lib/stock-logos';

export async function POST(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const { user, org } = ctx;

  const { data: membership } = await supabaseAdmin
    .from('organization_members')
    .select('role')
    .eq('organization_id', org.id)
    .eq('user_id', user.id)
    .single();

  if (membership?.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const stockPath: unknown = body?.stockPath;

  if (typeof stockPath !== 'string') {
    return NextResponse.json({ error: 'stockPath is required' }, { status: 400 });
  }

  const logo = STOCK_LOGOS.find(l => l.file === stockPath);
  if (!logo) {
    return NextResponse.json({ error: 'Unknown stock logo' }, { status: 400 });
  }

  if (PLAN_ORDER[org.planId] < PLAN_ORDER[logo.minPlan]) {
    return NextResponse.json(
      { error: `Upgrade to ${logo.minPlan} to use this icon` },
      { status: 403 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const logoUrl = `${appUrl}${stockPath}`;

  const { error: dbError } = await supabaseAdmin
    .from('organizations')
    .update({ logo_url: logoUrl })
    .eq('id', org.id);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ logoUrl });
}
