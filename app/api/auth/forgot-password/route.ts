import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendEmail, passwordResetHtml } from '@/lib/email';

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ ok: true }); // never reveal whether email exists
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.fieldlogichq.ca';

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email: email.trim().toLowerCase(),
    options: {
      redirectTo: `${appUrl}/auth/reset-password`,
    },
  });

  if (error || !data?.properties?.action_link) {
    console.error('[forgot-password] generateLink error:', error?.message);
    return NextResponse.json({ ok: true }); // still 200 — no enumeration
  }

  // Wrap the Supabase action_link in our own confirm page so email scanners
  // can't consume the one-time token by pre-fetching anchor hrefs in the email.
  const confirmUrl = `${appUrl}/auth/reset-confirm?link=${encodeURIComponent(data.properties.action_link)}`;

  try {
    await sendEmail(email, 'Reset your FieldLogicHQ password', passwordResetHtml(confirmUrl));
    console.log(`[forgot-password] reset email sent to ${email}`);
  } catch (emailErr) {
    console.error('[forgot-password] sendEmail error:', emailErr);
  }

  return NextResponse.json({ ok: true });
}
