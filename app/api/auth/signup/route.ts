import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createOrganization, createOrganizationMember } from '@/lib/db';

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function POST(req: Request) {
  try {
    const { email, password, orgName } = await req.json();

    if (!email || !password || !orgName) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    const slug = slugify(orgName);
    if (!slug) {
      return NextResponse.json({ error: 'Organization name is invalid.' }, { status: 400 });
    }

    // Create Supabase Auth user via admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      const msg = authError?.message ?? 'Failed to create user account.';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const userId = authData.user.id;

    // Create the organization
    const org = await createOrganization(orgName, slug, 'starter');
    if (!org) {
      // Roll back auth user on failure
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: 'Failed to create organization. The name or URL may already be taken.' }, { status: 400 });
    }

    // Link user as owner
    const member = await createOrganizationMember(org.id, userId, 'owner');
    if (!member) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: 'Failed to link user to organization.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, orgSlug: org.slug });
  } catch (err) {
    console.error('Signup route error:', err);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
