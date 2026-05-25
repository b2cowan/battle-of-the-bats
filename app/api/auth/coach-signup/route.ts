import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { email?: unknown; password?: unknown };

  const email    = typeof body.email    === 'string' ? body.email.trim().toLowerCase()    : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    return json({ error: 'Email and password are required.' }, 400);
  }
  if (password.length < 8) {
    return json({ error: 'Password must be at least 8 characters.' }, 400);
  }
  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Please enter a valid email address.' }, 400);
  }

  const { error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // intent confirmed by completing the registration form
  });

  if (error) {
    // Supabase returns "User already registered" for duplicate emails
    if (
      error.message?.toLowerCase().includes('already registered') ||
      error.message?.toLowerCase().includes('already exists') ||
      error.status === 422
    ) {
      return json({ error: 'email_exists' }, 409);
    }
    console.error('[coach-signup] createUser error:', error);
    return json({ error: 'Account could not be created. Please try again.' }, 500);
  }

  return json({ ok: true });
}
