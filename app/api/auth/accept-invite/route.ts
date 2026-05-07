import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
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
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const displayName: string | null =
    typeof body.displayName === 'string' && body.displayName.trim()
      ? body.displayName.trim().slice(0, 60)
      : null;

  // Find the pending member row for this user.
  // Use supabaseAdmin to bypass RLS — the user's session may not yet have
  // org-level read access before accepted_at is set.
  const { data: member } = await supabaseAdmin
    .from('organization_members')
    .select('id, role, organization_id, organizations(slug)')
    .eq('user_id', user.id)
    .eq('status', 'invited')
    .maybeSingle();

  if (!member) {
    // Already accepted or not an invited member — not an error, just a no-op.
    // Try to return their existing accepted membership for redirect purposes.
    const { data: existing } = await supabaseAdmin
      .from('organization_members')
      .select('role, organizations(slug)')
      .eq('user_id', user.id)
      .maybeSingle();

    const orgSlug = (existing?.organizations as any)?.slug ?? null;
    const role = existing?.role ?? null;
    return NextResponse.json({ ok: true, orgSlug, role, alreadyAccepted: true });
  }

  const memberUpdate: Record<string, unknown> = {
    accepted_at: new Date().toISOString(),
    status: 'active',
  };
  if (displayName) memberUpdate.display_name = displayName;

  const { error } = await supabaseAdmin
    .from('organization_members')
    .update(memberUpdate)
    .eq('id', member.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const orgSlug = (member.organizations as any)?.slug ?? null;
  return NextResponse.json({ ok: true, orgSlug, role: member.role });
}
